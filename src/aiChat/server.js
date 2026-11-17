// AI Chat — ฝั่งเซิร์ฟเวอร์: เรียก Claude + เขียนข้อความบอทลง groupChat ผ่าน firebase-admin (ข้ามกฎ Firestore)
// ฉีด admin ({db, FieldValue}) เข้ามาเพื่อทดสอบได้ · เรียกจาก api/ai-chat-reply.js เท่านั้น ยิงทันทีตอนมีคนเรียกในแชท ไม่ใช่ cron
import { AI_MODEL, AI_CHAT_BOTS, AI_CHAT_MAX_TOKENS, AI_CHAT_BANTER_MAX_TOKENS, buildBanterSystemPrompt } from "./config.js";
import { isBotMention, extractQuestion, parseChatReply, buildBotChatMessage } from "./logic.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

// เรียก Claude ดิบๆ 1 ครั้ง — คืนข้อความดิบ (ยัง parse ไม่สำเร็จก็ได้ ผู้เรียก parse เอง)
async function callClaudeRaw(apiKey, { systemPrompt, userContent, model = AI_MODEL, maxTokens, fetchFn = fetch }) {
  if (!apiKey) throw httpError(501, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY");
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      thinking: { type: "disabled" },   // เป็นแชทสั้นๆ ไม่จำเป็นต้องคิดยาว ตัดออกให้ตอบเร็ว/ถูกลง
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
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

// เรียก Claude ให้ตอบคำถาม 1 คำถามในแชท (บอทที่ถูกเรียกตรงๆ)
export async function callClaudeChat(apiKey, { question, systemPrompt, model, maxTokens = AI_CHAT_MAX_TOKENS, fetchFn } = {}) {
  const userContent = question
    ? ("คำถามจากคนในแชท: " + question)
    : "มีคนพิมพ์ชื่อคุณมาเฉยๆ ไม่ได้ถามอะไรจริงจัง ตอบทักทายกลับสั้นๆ ตามบุคลิกของคุณ";
  return callClaudeRaw(apiKey, { systemPrompt, userContent, model, maxTokens, fetchFn });
}

// เรียก Claude ให้แซวคู่ปรับสั้นๆ (ไม่ตอบคำถามเดิม)
export async function callClaudeBanter(apiKey, { systemPrompt, model, maxTokens = AI_CHAT_BANTER_MAX_TOKENS, fetchFn } = {}) {
  return callClaudeRaw(apiKey, { systemPrompt, userContent: "แซวเพื่อนคุณหน่อย", model, maxTokens, fetchFn });
}

async function ensureBotProfile({ db }, bot) {
  await db.collection("users").doc(bot.uid).set({ name: bot.name, avatar: bot.avatar || "" }, { merge: true });
}

// ประมวลผล 1 ครั้งที่มีคนเรียกบอทตัวใดตัวหนึ่งในห้องแชทรวม: ตอบคำถามจริงจากบอทที่ถูกเรียก แล้วให้คู่ปรับแทรกมาแซวต่อ (best-effort)
export async function handleChatMention({ db, FieldValue }, apiKey, { rawText, triggerUid, triggerName, triggerMsgId, fetchFn } = {}) {
  const triggerKey = Object.keys(AI_CHAT_BOTS).find(t => isBotMention(rawText, t));
  if (!triggerKey) throw httpError(400, "ข้อความนี้ไม่ได้เรียกบอทตัวไหนเลย");
  const bot = AI_CHAT_BOTS[triggerKey];
  const rivalKey = Object.keys(AI_CHAT_BOTS).find(t => t !== triggerKey);
  const rival = rivalKey ? AI_CHAT_BOTS[rivalKey] : null;

  const question = extractQuestion(rawText, triggerKey);
  const raw = await callClaudeChat(apiKey, { question, systemPrompt: bot.systemPrompt, fetchFn });
  const replyText = parseChatReply(raw);
  if (!replyText) throw httpError(502, "Claude ตอบกลับไม่ใช่รูปแบบที่ใช้ได้ ลองใหม่อีกครั้ง — raw: " + JSON.stringify(raw).slice(0, 500));

  await ensureBotProfile({ db }, bot);
  const msg = buildBotChatMessage({
    text: replyText, bot, now: FieldValue.serverTimestamp(),
    replyTo: triggerMsgId ? { id: triggerMsgId, uid: triggerUid, name: triggerName, text: rawText } : null,
  });
  const ref = await db.collection("groupChat").add(msg);

  // คู่ปรับแทรกมาแซว — แยกเรียก Claude อีกครั้ง ถ้าพังก็แค่ไม่มีมุกแซว ไม่ทำให้คำตอบหลักเสียหาย
  let banterMessageId = null, banterText = null;
  if (rival) {
    try {
      await ensureBotProfile({ db }, rival);
      const banterRaw = await callClaudeBanter(apiKey, { systemPrompt: buildBanterSystemPrompt({ speakerName: rival.name, rivalName: bot.name }), fetchFn });
      banterText = parseChatReply(banterRaw);
      if (banterText) {
        const banterMsg = buildBotChatMessage({
          text: banterText, bot: rival, now: FieldValue.serverTimestamp(),
          replyTo: { id: ref.id, uid: bot.uid, name: bot.name, text: replyText },
        });
        const banterRef = await db.collection("groupChat").add(banterMsg);
        banterMessageId = banterRef.id;
      }
    } catch (e) { /* best-effort */ }
  }

  return { messageId: ref.id, reply: replyText, banterMessageId, banterReply: banterText };
}
