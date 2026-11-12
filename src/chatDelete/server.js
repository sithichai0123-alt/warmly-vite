// ตรรกะฝั่งเซิร์ฟเวอร์ของการลบข้อความ (ไม่ถูก import จากฝั่งแอป — ใช้เฉพาะ api/chat-delete.js)
// ฉีด admin (auth/db/FieldValue) เข้ามาเพื่อทดสอบได้โดยไม่ต้องมี Firebase จริง
//
// กฎความปลอดภัย:
//  - ตรวจ ID token → ได้ uid จริง (ไม่เชื่อ uid จาก body)
//  - path ของแชทคำนวณฝั่งเซิร์ฟเวอร์จาก uid ที่ยืนยันแล้ว + peer เท่านั้น ไม่รับ path จากไคลเอนต์
//  - ลบทีละข้อความ: ต้องเป็นข้อความของตัวเอง และห้ามลบข้อความของขวัญ (เกี่ยวกับเหรียญ)
//  - ลบทั้งหมด: เฉพาะ dms/{pair}/messages ของคู่สนทนานี้ + เอกสาร dms/{pair} เท่านั้น
//  - ไม่แตะ users / ledger / groupChat / แชทของคู่อื่น

import { pairIdOf, validPeer, validMsgId, previewOf, MAX_BATCH, MAX_ROUNDS } from "./logic.js";
export { pairIdOf, validPeer, MAX_BATCH, MAX_ROUNDS };

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

// ตรวจว่าเป็นห้องแชทของ uid กับ peer จริง (กันกรณี uid มี "_" แล้ว pairId ชนกับคู่อื่น)
async function loadPair(db, uid, peer) {
  const pid = pairIdOf(uid, peer);
  const ref = db.collection("dms").doc(pid);
  const sn = await ref.get();
  if (sn.exists) {
    const uids = (sn.data() || {}).uids;
    if (Array.isArray(uids) && !(uids.includes(uid) && uids.includes(peer) && uids.length === 2)) throw httpError(403, "ไม่ใช่แชทของคุณ");
    return { pid, ref, hasDoc: true };
  }
  return { pid, ref, hasDoc: false };
}

export async function deleteOne({ db }, { uid, peer, messageId }) {
  if (!validPeer(uid, peer)) throw httpError(400, "ผู้สนทนาไม่ถูกต้อง");
  if (!validMsgId(messageId)) throw httpError(400, "ไม่ระบุข้อความ");
  const { pid, ref, hasDoc } = await loadPair(db, uid, peer);
  const mref = db.collection("dms").doc(pid).collection("messages").doc(messageId);
  const sn = await mref.get();
  if (!sn.exists) return { ok: true, deleted: 0, already: true }; // ลบไปแล้ว = สำเร็จ (idempotent)
  const m = sn.data() || {};
  if (m.uid !== uid) throw httpError(403, "ลบได้เฉพาะข้อความของตัวเอง");
  if (m.gift) throw httpError(403, "ข้อความของขวัญลบไม่ได้");
  await mref.delete();

  // อัปเดตข้อความล่าสุดของรายการแชทให้ตรงกับที่เหลืออยู่
  let conversationRemoved = false;
  if (hasDoc) {
    const left = await db.collection("dms").doc(pid).collection("messages").orderBy("t", "desc").limit(1).get();
    if (left.empty) {
      await ref.delete();
      conversationRemoved = true;
    } else {
      const d = left.docs[0].data() || {};
      const patch = { last: previewOf(d), lastFrom: d.uid || null };
      if (d.t !== undefined) patch.lastT = d.t;
      await ref.set(patch, { merge: true });
    }
  }
  return { ok: true, deleted: 1, conversationRemoved };
}

export async function deleteAll({ db }, { uid, peer }) {
  if (!validPeer(uid, peer)) throw httpError(400, "ผู้สนทนาไม่ถูกต้อง");
  const { pid, ref, hasDoc } = await loadPair(db, uid, peer);
  const col = db.collection("dms").doc(pid).collection("messages");
  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // ไม่มีเอกสารห้อง (ตรวจคู่สนทนาไม่ได้) → ลบเฉพาะข้อความที่เขียนโดย uid สองคนนี้เท่านั้น
    const q = hasDoc ? col.limit(MAX_BATCH) : col.where("uid", "in", [uid, peer]).limit(MAX_BATCH);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.docs.length;
    if (snap.docs.length < MAX_BATCH) break;
  }
  if (hasDoc) await ref.delete();
  return { ok: true, deleted, conversationRemoved: hasDoc };
}

export function makeHandler(getAdmin) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    try {
      const m = /^Bearer (.+)$/.exec((req.headers && req.headers.authorization) || "");
      if (!m) return res.status(401).json({ error: "ต้องล็อกอินก่อน" });
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const action = body.action;
      if (action !== "deleteOne" && action !== "deleteAll") return res.status(400).json({ error: "คำสั่งไม่ถูกต้อง" });

      const admin = await getAdmin();
      let uid;
      try { uid = (await admin.auth.verifyIdToken(m[1])).uid; } catch (e) { return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" }); }

      const out = action === "deleteOne"
        ? await deleteOne(admin, { uid, peer: body.peer, messageId: body.messageId })
        : await deleteAll(admin, { uid, peer: body.peer });
      return res.status(200).json(out);
    } catch (e) {
      const status = e && (e.code === 501 || e.status) ? (e.code === 501 ? 501 : e.status) : 500;
      return res.status(status).json({ error: (e && e.message) || "ลบไม่สำเร็จ" });
    }
  };
}
