// AI Chat — ฝั่งเซิร์ฟเวอร์: เรียก Claude + เขียนข้อความบอทลง groupChat ผ่าน firebase-admin (ข้ามกฎ Firestore)
// ฉีด admin ({db, FieldValue}) เข้ามาเพื่อทดสอบได้ · เรียกจาก api/ai-chat-reply.js เท่านั้น ยิงทันทีตอนมีคนเรียกในแชท ไม่ใช่ cron
import { AI_MODEL, AI_CHAT_BOTS, AI_CHAT_MAX_TOKENS, AI_CHAT_BANTER_MAX_TOKENS, AI_CHAT_BANTER_CHANCE, AI_CHAT_WELCOME_MAX_TOKENS, buildBanterSystemPrompt, buildWelcomeSystemPrompt } from "./config.js";
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

// เรียก Claude ให้พิจารณาแซวคู่ปรับ (แนบบทสนทนาจริงให้ดู ให้ AI ตัดสินใจเองว่าน่าแซวไหม ไม่ใช่สั่งให้แซวเสมอ)
export async function callClaudeBanter(apiKey, { context, model, maxTokens = AI_CHAT_BANTER_MAX_TOKENS, fetchFn, systemPrompt } = {}) {
  const userContent = context ? ("บทสนทนาที่เพิ่งเกิดขึ้น:\n" + context) : "เพื่อนคุณเพิ่งคุยกับคนในแชทไป ดูว่ามีจังหวะน่าแซวไหม";
  return callClaudeRaw(apiKey, { systemPrompt, userContent, model, maxTokens, fetchFn });
}

// เรียก Claude ให้ทักทายคนใหม่ (ไม่ใช่ตอบคำถาม/แซว — ข้อความคงที่ ตัวแปรอยู่ที่ systemPrompt ที่ส่งมาแทน)
export async function callClaudeWelcome(apiKey, { systemPrompt, model, maxTokens = AI_CHAT_WELCOME_MAX_TOKENS, fetchFn } = {}) {
  return callClaudeRaw(apiKey, { systemPrompt, userContent: "ทักทายคนใหม่หน่อย", model, maxTokens, fetchFn });
}

async function ensureBotProfile({ db }, bot) {
  await db.collection("users").doc(bot.uid).set({ name: bot.name, avatar: bot.avatar || "" }, { merge: true });
}

// ประมวลผล 1 ครั้งที่มีคนเรียกบอทตัวใดตัวหนึ่งในห้องแชทรวม: ตอบคำถามจริงจากบอทที่ถูกเรียก แล้วให้คู่ปรับแทรกมาแซวต่อ (best-effort)
// random ฉีดเข้ามาได้เพื่อทดสอบ (ไม่งั้นใช้ Math.random จริง) — เช็คที่นี่ก่อนเรียก Claude เลย กันกรณี AI เองมักเออออว่า "น่าแซว" เกือบทุกครั้งถ้าถามตรงๆ
// replyToBotUid: ถ้าผู้ใช้กด "ตอบกลับ" ข้อความของบอทตัวไหนโดยตรง ให้ถือว่ากำลังถามบอทตัวนั้นเสมอ (สำคัญกว่าชื่อที่พิมพ์ในข้อความ)
// กันเคสที่ข้อความดันมีชื่ออีกบอทติดอยู่ในประโยคเอง (เช่น "หัมน้อยไปไหน" ที่ตอบกลับหัมใหญ่ ไม่ได้ตั้งใจเรียกหัมน้อย)
export async function handleChatMention({ db, FieldValue }, apiKey, { rawText, triggerUid, triggerName, triggerMsgId, replyToBotUid, fetchFn, random = Math.random } = {}) {
  let triggerKey = replyToBotUid ? Object.keys(AI_CHAT_BOTS).find(t => AI_CHAT_BOTS[t].uid === replyToBotUid) : null;
  let question;
  if (triggerKey) {
    // ถูกเรียกผ่านการตอบกลับโดยตรง ไม่ใช่พิมพ์ชื่อนำหน้า — เอาข้อความทั้งก้อนเป็นคำถาม (ตัด prefix ออกด้วยถ้าบังเอิญพิมพ์ชื่อบอทตัวนี้มาด้วย)
    question = isBotMention(rawText, triggerKey) ? extractQuestion(rawText, triggerKey) : String(rawText || "").trim();
  } else {
    triggerKey = Object.keys(AI_CHAT_BOTS).find(t => isBotMention(rawText, t));
    if (!triggerKey) throw httpError(400, "ข้อความนี้ไม่ได้เรียกบอทตัวไหนเลย");
    question = extractQuestion(rawText, triggerKey);
  }
  const bot = AI_CHAT_BOTS[triggerKey];
  const rivalKey = Object.keys(AI_CHAT_BOTS).find(t => t !== triggerKey);
  const rival = rivalKey ? AI_CHAT_BOTS[rivalKey] : null;
  const raw = await callClaudeChat(apiKey, { question, systemPrompt: bot.systemPrompt, fetchFn });
  const replyText = parseChatReply(raw);
  if (!replyText) throw httpError(502, "Claude ตอบกลับไม่ใช่รูปแบบที่ใช้ได้ ลองใหม่อีกครั้ง — raw: " + JSON.stringify(raw).slice(0, 500));

  await ensureBotProfile({ db }, bot);
  const msg = buildBotChatMessage({
    text: replyText, bot, now: FieldValue.serverTimestamp(),
    replyTo: triggerMsgId ? { id: triggerMsgId, uid: triggerUid, name: triggerName, text: rawText } : null,
  });
  const ref = await db.collection("groupChat").add(msg);

  // คู่ปรับแทรกมาแซว — สุ่มก่อนว่าจะลองไหม (กันแซวทุกครั้ง) แล้วค่อยแยกเรียก Claude อีกครั้ง ถ้าพังก็แค่ไม่มีมุกแซว ไม่ทำให้คำตอบหลักเสียหาย
  let banterMessageId = null, banterText = null;
  if (rival && random() < AI_CHAT_BANTER_CHANCE) {
    try {
      await ensureBotProfile({ db }, rival);
      const context = (triggerName || "มีคนหนึ่ง") + ' พิมพ์ว่า: "' + rawText + '"\n' + bot.name + ' ตอบว่า: "' + replyText + '"';
      const banterRaw = await callClaudeBanter(apiKey, { systemPrompt: buildBanterSystemPrompt({ speakerName: rival.name, rivalName: bot.name }), context, fetchFn });
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

// คนเข้าแอปมาเป็นครั้งแรก (เช็คครั้งเดียวต่อ uid ตลอดไป ด้วย flag chatWelcomedAt กันทักซ้ำ) — บอททั้งสองตัวทักทายต้อนรับเสมอ (ไม่มีเงื่อนไข/สุ่มแบบมุกแซว เพราะเป็นโอกาสพิเศษ)
export async function handleNewUserWelcome({ db, FieldValue }, apiKey, { uid, name, fetchFn } = {}) {
  if (!uid) throw httpError(400, "ไม่มี uid");
  const ref = db.collection("users").doc(uid);
  const isNew = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.data().chatWelcomedAt) return false;
    tx.set(ref, { chatWelcomedAt: Date.now() }, { merge: true });
    return true;
  });
  if (!isNew) return { welcomed: false };

  const [firstKey, secondKey] = Object.keys(AI_CHAT_BOTS); // ลำดับคงที่ ไม่สุ่ม กันผลลัพธ์เดาไม่ได้ตอนดีบั๊ก
  const first = AI_CHAT_BOTS[firstKey], second = AI_CHAT_BOTS[secondKey];

  await ensureBotProfile({ db }, first);
  const raw1 = await callClaudeWelcome(apiKey, {
    systemPrompt: buildWelcomeSystemPrompt({ name: first.name, rivalName: second.name, personality: first.personality, newcomerName: name }),
    fetchFn,
  });
  const text1 = parseChatReply(raw1);
  let messageId1 = null;
  if (text1) {
    const msg1 = buildBotChatMessage({ text: text1, bot: first, now: FieldValue.serverTimestamp() });
    messageId1 = (await db.collection("groupChat").add(msg1)).id;
  }

  // ตัวที่สองทักต่อ — ถ้าพังก็แค่ทักคนเดียว ไม่ทำให้การทักทายของตัวแรกเสียหาย
  let messageId2 = null, text2 = null;
  try {
    await ensureBotProfile({ db }, second);
    const raw2 = await callClaudeWelcome(apiKey, {
      systemPrompt: buildWelcomeSystemPrompt({ name: second.name, rivalName: first.name, personality: second.personality, newcomerName: name, priorGreeting: text1 }),
      fetchFn,
    });
    text2 = parseChatReply(raw2);
    if (text2) {
      const msg2 = buildBotChatMessage({
        text: text2, bot: second, now: FieldValue.serverTimestamp(),
        replyTo: messageId1 ? { id: messageId1, uid: first.uid, name: first.name, text: text1 } : null,
      });
      messageId2 = (await db.collection("groupChat").add(msg2)).id;
    }
  } catch (e) { /* best-effort */ }

  return { welcomed: true, messageId1, messageId2, reply1: text1, reply2: text2 };
}
