// AI Chat — ตรรกะล้วน (ไม่แตะ Firebase/เครือข่าย) จึงทดสอบได้ง่าย

// ข้อความเริ่มด้วยคำเรียกบอทไหม (ตัดช่องว่างหัว-ท้ายก่อนเทียบ)
export function isBotMention(text, trigger) {
  return String(text || "").trim().startsWith(trigger);
}

// ตัดคำเรียกบอท + เครื่องหมาย/ช่องว่างที่ติดมาหัวประโยคออก เหลือแค่คำถามจริง ("" = แค่ทักไม่ได้ถามอะไร)
export function extractQuestion(text, trigger) {
  const t = String(text || "").trim();
  if (!t.startsWith(trigger)) return "";
  return t.slice(trigger.length).replace(/^[\s,.:!?-]+/, "").trim();
}

// parse คำตอบของ Claude ({reply}) — parse ไม่ได้/ว่าง → คืน null
export function parseChatReply(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (e) { return null; }
  if (!obj || typeof obj !== "object") return null;
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  // ตาข่ายกันพลาดเฉยๆ (ความยาวจริงถูกคุมด้วยกฎใน AI_CHAT_SYSTEM_PROMPT ~70 ตัวอักษรแล้ว) ตัดที่ 200 ให้มีระยะห่างกันคำตอบปกติโดนตัดกลางประโยค
  return reply ? reply.slice(0, 200) : null;
}

// สร้าง message object ของบอทให้ตรง schema เดียวกับที่ BubbleChat/send() ใช้ใน groupChat (uid/author/init/text/t[/replyTo])
export function buildBotChatMessage({ text, bot, now, replyTo }) {
  const msg = { uid: bot.uid, author: bot.name, init: bot.init, text, t: now };
  if (replyTo && replyTo.id) msg.replyTo = { id: replyTo.id, uid: replyTo.uid || "", name: replyTo.name || "", text: (replyTo.text || "").slice(0, 80) };
  return msg;
}
