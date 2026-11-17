// AI Chat — ฝั่งเซิร์ฟเวอร์: เรียก Claude + เขียนข้อความบอทลง groupChat ผ่าน firebase-admin (ข้ามกฎ Firestore)
// ฉีด admin ({db, FieldValue}) เข้ามาเพื่อทดสอบได้ · เรียกจาก api/ai-chat-reply.js เท่านั้น ยิงทันทีตอนมีคนเรียกในแชท ไม่ใช่ cron
import { AI_BOT_UID, AI_BOT_NAME, AI_BOT_INIT, AI_MODEL, AI_CHAT_TRIGGER, AI_CHAT_SYSTEM_PROMPT, AI_CHAT_MAX_TOKENS } from "./config.js";
import { isBotMention, extractQuestion, parseChatReply, buildBotChatMessage } from "./logic.js";
import { ensureBotProfile } from "../aiContent/server.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

// เรียก Claude ให้ตอบคำถาม 1 คำถามในแชท — คืนข้อความดิบ (ยัง parse ไม่สำเร็จก็ได้ ผู้เรียก parse เอง)
export async function callClaudeChat(apiKey, { question, model = AI_MODEL, maxTokens = AI_CHAT_MAX_TOKENS, fetchFn = fetch } = {}) {
  if (!apiKey) throw httpError(501, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY");
  const userMsg = question
    ? ("คำถามจากคนในแชท: " + question)
    : "มีคนพิมพ์ชื่อคุณมาเฉยๆ ไม่ได้ถามอะไรจริงจัง ตอบทักทายกลับสั้นๆ ตามบุคลิกของคุณ";
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      thinking: { type: "disabled" },   // เป็นแชทสั้นๆ ไม่จำเป็นต้องคิดยาว ตัดออกให้ตอบเร็ว/ถูกลง
      system: AI_CHAT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) {
    let msg = "เรียก Claude ไม่สำเร็จ (" + r.status + ")";
    try { const j = await r.json(); if (j && j.error && j.error.message) msg += ": " + j.error.message; } catch (e) { /* ignore */ }
    throw httpError(502, msg);
  }
  const data = await r.json();
  const texts = Array.isArray(data.content) ? data.content.filter(b => b.type === "text").map(b => b.text) : [];
  return texts.join("\n");
}

// ประมวลผล 1 ครั้งที่มีคนเรียกบอทในห้องแชทรวม: ตรวจว่าเรียกจริง → เรียก Claude → parse → เขียนข้อความบอทลง groupChat
export async function handleChatMention({ db, FieldValue }, apiKey, { rawText, triggerUid, triggerName, triggerMsgId, fetchFn } = {}) {
  if (!isBotMention(rawText, AI_CHAT_TRIGGER)) throw httpError(400, "ข้อความนี้ไม่ได้เรียกหัมน้อย");
  const question = extractQuestion(rawText, AI_CHAT_TRIGGER);
  const raw = await callClaudeChat(apiKey, { question, fetchFn });
  const replyText = parseChatReply(raw);
  if (!replyText) throw httpError(502, "Claude ตอบกลับไม่ใช่รูปแบบที่ใช้ได้ ลองใหม่อีกครั้ง — raw: " + JSON.stringify(raw).slice(0, 500));
  await ensureBotProfile({ db });
  const now = FieldValue.serverTimestamp();
  const msg = buildBotChatMessage({
    text: replyText,
    bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT },
    now,
    replyTo: triggerMsgId ? { id: triggerMsgId, uid: triggerUid, name: triggerName, text: rawText } : null,
  });
  const ref = await db.collection("groupChat").add(msg);
  return { messageId: ref.id, reply: replyText };
}
