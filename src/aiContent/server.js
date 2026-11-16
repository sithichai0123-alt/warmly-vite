// AI Content — ฝั่งเซิร์ฟเวอร์: เรียก Claude + อ่าน/เขียน Firestore ผ่าน firebase-admin (ข้ามกฎ Firestore)
// ฉีด admin ({db, FieldValue}) เข้ามาเพื่อทดสอบได้ · ไม่ถูก import จากฝั่งแอป
import { AI_DRAFTS_COLLECTION, AI_BOT_UID, AI_BOT_NAME, AI_BOT_INIT, AI_BOT_AVATAR, AI_MASCOT_IMAGES, AI_MOODS, AI_SYSTEM_PROMPT, AI_REPLY_SYSTEM_PROMPT, AI_MODEL, AI_MAX_TOKENS, AI_STALE_DRAFT_DAYS, AI_MAX_REPLIES_PER_RUN } from "./config.js";
import { parseAiReply, fallbackPosterLines, buildPosterSvg, buildDraft, buildPublishedPost, isAutoPublishOn, parseReplyJson, buildBotReplyComment } from "./logic.js";

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
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],  // ให้ไปดูกระแสโซเชียลตอนนี้ก่อนแต่งโพสต์ (จำกัดจำนวนครั้งกันค่าใช้จ่ายบาน) — Haiku 5.5 ใช้รุ่น 20260209 ไม่ได้ ต้องใช้รุ่นพื้นฐานนี้
      // บังคับ tool_choice ไม่ได้ (บัญชีนี้ไม่อนุญาตให้บังคับเรียก web_search ตรง ๆ) ปล่อยเป็น auto แล้วสั่งผ่าน prompt แทน
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
export async function ensureBotProfile({ db }) {
  await db.collection("users").doc(AI_BOT_UID).set({ name: AI_BOT_NAME, avatar: AI_BOT_AVATAR }, { merge: true });
}

// เรียก Claude ให้แต่งคำตอบ 1 คอมเมนต์ — คืนข้อความดิบ (ยัง parse ไม่สำเร็จก็ได้ ผู้เรียก parse เอง)
export async function callClaudeReply(apiKey, { postContent, commentText, model = AI_MODEL, maxTokens = 512, fetchFn = fetch } = {}) {
  if (!apiKey) throw httpError(501, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY");
  const r = await fetchFn("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      thinking: { type: "disabled" },
      system: AI_REPLY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `โพสต์ของคุณ: ${String(postContent || "").slice(0, 500)}\n\nคอมเมนต์ที่มีคนมาตอบ: ${String(commentText || "").slice(0, 500)}` }],
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

const svgToDataUri = svg => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

// สร้างคอนเทนต์ 1 อัน แล้วเขียนลงฐานข้อมูล — autoPublish=true โพสต์เข้า "posts" จริงทันที, false เขียนเป็น draft รออนุมัติ
export async function generateAndStore({ db, FieldValue }, apiKey, { autoPublish = false, fetchFn } = {}) {
  const raw = await callClaude(apiKey, { fetchFn });
  const parsed = parseAiReply(raw, AI_MOODS);
  if (!parsed) throw httpError(502, "Claude ตอบกลับไม่ใช่รูปแบบที่ใช้ได้ ลองใหม่อีกครั้ง — raw: " + JSON.stringify(raw).slice(0, 500));
  const lines = parsed.posterLines.length ? parsed.posterLines : fallbackPosterLines(parsed.content);
  const mascotImage = AI_MASCOT_IMAGES[parsed.mood] || AI_MASCOT_IMAGES[AI_MOODS[0]];
  const poster = svgToDataUri(buildPosterSvg({ lines, mascotImage }));
  const images = [poster], mediaTypes = ["image"];
  const now = FieldValue.serverTimestamp();
  if (autoPublish) {
    await ensureBotProfile({ db });
    const post = buildPublishedPost({ content: parsed.content, bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT }, now, images, mediaTypes });
    const ref = await db.collection("posts").add(post);
    return { mode: "published", postId: ref.id, content: parsed.content, topic: parsed.topic };
  }
  const draft = buildDraft({ content: parsed.content, topic: parsed.topic, model: AI_MODEL, now, images, mediaTypes });
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
  const post = buildPublishedPost({ content: d.content, bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT }, now, images: d.images, mediaTypes: d.mediaTypes });
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

// draft "รออนุมัติ" ที่ค้างเกิน AI_STALE_DRAFT_DAYS วัน (กระแสที่หยิบมาใช้น่าจะหมดอายุไปแล้ว) → ลบทิ้งอัตโนมัติ
// เรียกจาก api/ai-generate-post.js ทุกครั้งที่ cron ยิงมา (ไม่ใช่งาน cron แยก) ทำแบบ best-effort ไม่ให้ error จุดนี้ล้มการสร้างคอนเทนต์รอบนั้น
export async function sweepStaleDrafts({ db }) {
  const cutoff = Date.now() - AI_STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000;
  const snap = await db.collection(AI_DRAFTS_COLLECTION).where("status", "==", "pending").get();
  const stale = snap.docs.filter(d => {
    const t = d.data().createdAt;
    const ms = t && t.toMillis ? t.toMillis() : 0;
    return ms > 0 && ms < cutoff;
  });
  if (!stale.length) return { deleted: 0 };
  const batch = db.batch();
  stale.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { deleted: stale.length };
}

// โพสต์ของ "หัมน้อย" ที่ขึ้นฟีดจริงแล้วเกิน AI_STALE_DRAFT_DAYS วัน → ลบทิ้งอัตโนมัติเช่นกัน (เนื้อหาผูกกับกระแสที่หมดอายุไปแล้ว)
// จำกัดเฉพาะ authorUid === AI_BOT_UID เท่านั้น — ไม่แตะโพสต์ของผู้ใช้จริงคนอื่นเด็ดขาด
export async function sweepStalePublishedPosts({ db }) {
  const cutoff = Date.now() - AI_STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000;
  const snap = await db.collection("posts").where("authorUid", "==", AI_BOT_UID).get();
  const stale = snap.docs.filter(d => {
    const t = d.data().createdAt;
    const ms = t && t.toMillis ? t.toMillis() : 0;
    return ms > 0 && ms < cutoff;
  });
  if (!stale.length) return { deleted: 0 };
  const batch = db.batch();
  stale.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return { deleted: stale.length };
}

// ตอบคอมเมนต์ใหม่ใต้โพสต์ของ "หัมน้อย" — เช็คทุก 15 นาทีจาก cron (ไม่เรียลไทม์ เพราะแอปนี้ไม่มี Firebase Cloud Functions)
// where เดี่ยว ๆ บน authorUid (ตามแพทเทิร์นเดียวกับ sweepStalePublishedPosts) แล้วกรอง/ตัดจำนวนเองในนี้
// ติดตามคอมเมนต์ที่ตอบไปแล้วด้วยฟีลด์ aiRepliedCommentIds ต่อโพสต์ กันตอบคอมเมนต์เดิมซ้ำรอบถัดไป
export async function replyToComments({ db, FieldValue }, apiKey, { fetchFn, maxReplies = AI_MAX_REPLIES_PER_RUN } = {}) {
  const snap = await db.collection("posts").where("authorUid", "==", AI_BOT_UID).get();
  let repliesLeft = maxReplies, postsTouched = 0, repliesSent = 0;
  for (const doc of snap.docs) {
    if (repliesLeft <= 0) break;
    const data = doc.data();
    const comments = Array.isArray(data.comments) ? data.comments : [];
    const already = new Set(Array.isArray(data.aiRepliedCommentIds) ? data.aiRepliedCommentIds : []);
    const pending = comments.filter(c => c && c.uid !== AI_BOT_UID && c.id && !already.has(c.id));
    if (!pending.length) continue;
    const newComments = [], newIds = [];
    for (const c of pending) {
      if (repliesLeft <= 0) break;
      let raw;
      try { raw = await callClaudeReply(apiKey, { postContent: data.content, commentText: c.text, fetchFn }); }
      catch (e) { continue; }
      const replyText = parseReplyJson(raw);
      if (!replyText) continue;
      newComments.push(buildBotReplyComment({ text: replyText, bot: { uid: AI_BOT_UID, name: AI_BOT_NAME, init: AI_BOT_INIT }, now: Date.now(), replyToUid: c.uid, replyToName: c.author }));
      newIds.push(c.id);
      repliesLeft--;
    }
    if (!newComments.length) continue;
    await doc.ref.update({
      comments: FieldValue.arrayUnion(...newComments),
      aiRepliedCommentIds: FieldValue.arrayUnion(...newIds),
    });
    postsTouched++;
    repliesSent += newComments.length;
  }
  return { postsTouched, repliesSent };
}

export { isAutoPublishOn };
