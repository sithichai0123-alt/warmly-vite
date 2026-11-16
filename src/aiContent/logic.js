// AI Content — ตรรกะล้วน (ไม่แตะ Firebase/เครือข่าย) จึงทดสอบได้ง่าย

// ตัด ```json ... ``` หรือข้อความเกินรอบ ๆ ออก แล้ว parse เอาแค่ {content, topic}
// คำตอบไม่ใช่ JSON ที่ใช้ได้ / content ว่าง → คืน null (ผู้เรียกต้องไม่เขียนอะไรต่อ)
export function parseAiReply(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (e) { return null; }
  if (!obj || typeof obj !== "object") return null;
  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!content) return null;
  const topic = typeof obj.topic === "string" ? obj.topic.trim().slice(0, 120) : "";
  return { content: content.slice(0, 1200), topic };
}

// สร้างเอกสาร draft ที่จะเขียนลง AI_DRAFTS_COLLECTION
export function buildDraft({ content, topic, model, now }) {
  return {
    content, topic: topic || "",
    model: model || "", status: "pending",
    createdAt: now, reviewedAt: null, reviewedBy: null, rejectReason: null, publishedPostId: null,
  };
}

// สร้างเอกสาร post จริง (schema เดียวกับที่ NewPostBox ใช้) จาก draft ที่อนุมัติแล้ว
export function buildPublishedPost({ content, bot, now }) {
  return {
    author: bot.name, authorInit: bot.init, authorUid: bot.uid,
    content, mood: "", privacy: "public",
    images: [], mediaTypes: [],
    likes: 0, liked: false, likers: [], comments: [],
    createdAt: now,
  };
}

// โพสต์ตรงทันทีไหม (true) หรือรอแอดมินอนุมัติก่อน (false) — อ่านจาก env var ฝั่งเซิร์ฟเวอร์เท่านั้น
export const isAutoPublishOn = raw => raw === "1" || raw === "true";
