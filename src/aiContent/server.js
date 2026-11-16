// AI Content — ฝั่งเซิร์ฟเวอร์: เรียก Claude + อ่าน/เขียน Firestore ผ่าน firebase-admin (ข้ามกฎ Firestore)
// ฉีด admin ({db, FieldValue}) เข้ามาเพื่อทดสอบได้ · ไม่ถูก import จากฝั่งแอป
import { AI_DRAFTS_COLLECTION, AI_BOT_UID, AI_BOT_NAME, AI_BOT_INIT, AI_BOT_AVATAR, AI_SYSTEM_PROMPT, AI_MODEL, AI_MAX_TOKENS } from "./config.js";
import { parseAiReply, buildDraft, buildPublishedPost, isAutoPublishOn } from "./logic.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

// เรียก Claude ให้แต่งโพสต์ 1 อัน — คืนข้อความดิบ (ยัง parse ไม่สำเร็จก็ได้ ผู้เรียก parse เอง)
export async function callClaude(apiKey, { model = AI_MODEL, maxTokens = AI_MAX_TOKENS, fetchFn = fetch } = {}) {
  if (!apiKey) throw httpError(501, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY");
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      thinking: { type: "disabled" },   // โพสต์สั้น ๆ ไม่จำเป็นต้องคิดยาว ตัดออกให้ตอบเร็ว/ถูกลง และกันโควตาโดน thinking กินจนไม่เหลือที่เขียนข้อความ
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],  // ให้ไปดูกระแสโซเชียลตอนนี้ก่อนแต่งโพสต์ (จำกัดจำนวนครั้งกันค่าใช้จ่ายบาน)
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: "ค้นหากระแสโซเชียลตอนนี้ก่อน แล้วเขียนโพสต์ 1 อัน ตามกฎที่ให้ไว้" }],
    }),
  });
  if (!r.ok) {
    let msg = "เรียก Claude ไม่สำเร็จ (" + r.status + ")";
    try { const j = await r.json(); if (j && j.error && j.error.message) msg += ": " + j.error.message; } catch (e) { /* ignore */ }
    throw httpError(502, msg);
  }
  const data = await r.json();
  // อาจมีหลาย text block ปนกับ block ของผลค้นเว็บ (web_search_tool_result) — เอาตัวหนังสือทุกบล็อกมาต่อกัน แล้วให้ parseAiReply หา JSON ก้อนสุดท้ายเอง
  const texts = Array.isArray(data.content) ? data.content.filter(b => b.type === "text").map(b => b.text) : [];
  return texts.join("\n");
}

// สร้าง/อัปเดตโปรไฟล์บอทให้ตรงกับค่าปัจจุบันใน config.js เสมอ (ชื่อ/รูป) — ทำก่อนสร้างโพสต์ทุกครั้ง เบาและ idempotent
async function ensureBotProfile({ db }) {
  await db.collection("users").doc(AI_BOT_UID).set({ name: AI_BOT_NAME, avatar: AI_BOT_AVATAR }, { merge: true });
}

// สร้างคอนเทนต์ 1 อัน แล้วเขียนลงฐานข้อมูล — autoPublish=true โพสต์เข้า "posts" จริงทันที, false เขียนเป็น draft รออนุมัติ
export async function generateAndStore({ db, FieldValue }, apiKey, { autoPublish = false, fetchFn } = {}) {
  const raw = await callClaude(apiKey, { fetchFn });
  const parsed = parseAiReply(raw);
  if (!parsed) throw httpError(502, "Claude ตอบกลับไม่ใช่รูปแบบที่ใช้ได้ ลองใหม่อีกครั้ง — raw: " + JSON.stringify(raw).slice(0, 500));
  const now = FieldValue.serverTimestamp();
  if (autoPublish) {
    await ensureBotProfile({ db });
    const post = buildPublishedPost({ content: parsed.content, bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT }, now });
    const ref = await db.collection("posts").add(post);
    return { mode: "published", postId: ref.id, content: parsed.content, topic: parsed.topic };
  }
  const draft = buildDraft({ content: parsed.content, topic: parsed.topic, model: AI_MODEL, now });
  const ref = await db.collection(AI_DRAFTS_COLLECTION).add(draft);
  return { mode: "pending", draftId: ref.id, content: parsed.content, topic: parsed.topic };
}

// where เดี่ยว ๆ ไม่ต้องใช้ composite index (ตั้งใจเลี่ยง orderBy คู่กับ where ต่างฟิลด์) — เรียงเองในนี้แทน
export async function listPendingDrafts({ db }, limit = 30) {
  const snap = await db.collection(AI_DRAFTS_COLLECTION).where("status", "==", "pending").limit(limit).get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0));
  return rows;
}

// อนุมัติ draft → สร้างโพสต์จริงใน "posts" แล้วปิดสถานะ draft (ทำเป็น batch กันค้างครึ่งเดียว)
export async function approveDraft({ db, FieldValue }, draftId, reviewerUid) {
  const ref = db.collection(AI_DRAFTS_COLLECTION).doc(draftId);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, "ไม่พบ draft นี้ (อาจถูกจัดการไปแล้ว)");
  const d = doc.data();
  if (d.status !== "pending") throw httpError(400, "draft นี้ถูกจัดการไปแล้ว (" + d.status + ")");
  await ensureBotProfile({ db });
  const now = FieldValue.serverTimestamp();
  const post = buildPublishedPost({ content: d.content, bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT }, now });
  const postRef = db.collection("posts").doc();
  const batch = db.batch();
  batch.set(postRef, post);
  batch.update(ref, { status: "approved", reviewedAt: now, reviewedBy: reviewerUid, publishedPostId: postRef.id });
  await batch.commit();
  return { postId: postRef.id };
}

export async function rejectDraft({ db, FieldValue }, draftId, reviewerUid, reason) {
  const ref = db.collection(AI_DRAFTS_COLLECTION).doc(draftId);
  const doc = await ref.get();
  if (!doc.exists) throw httpError(404, "ไม่พบ draft นี้ (อาจถูกจัดการไปแล้ว)");
  if (doc.data().status !== "pending") throw httpError(400, "draft นี้ถูกจัดการไปแล้ว");
  await ref.update({ status: "rejected", reviewedAt: FieldValue.serverTimestamp(), reviewedBy: reviewerUid, rejectReason: (reason || "").slice(0, 300) });
}

export { isAutoPublishOn };
