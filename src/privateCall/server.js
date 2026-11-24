// ฝั่งเซิร์ฟเวอร์ของโทรส่วนตัว (ใช้เฉพาะ api/call.js — ไม่ถูก import จากฝั่งแอป)
// ทำไมต้องมี: กฎ Firestore ให้อ่าน/ลบ "กล่องสาย" ได้เฉพาะเจ้าของ แต่การโทรต้องตรวจ/เขียนกล่องของอีกฝ่าย
//   → ทำที่เซิร์ฟเวอร์ด้วย Firebase Admin (ข้ามกฎ) แต่ตรวจสิทธิ์เองทุกครั้งจาก ID token
import { inboxLive } from "./logic.js";

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const FINAL = ["declined", "busy", "missed", "cancelled", "ended"];
const httpError = (status, message, code) => Object.assign(new Error(message), { status, code });

export async function startCall({ db, FieldValue }, uid, { peer, fromName, toName }) {
  if (!UID_RE.test(String(peer || "")) || peer === uid) throw httpError(400, "ข้อมูลไม่ถูกต้อง", "invalid");
  const inbox = db.collection("callInbox");
  const pin = await inbox.doc(peer).get();
  if (pin.exists && inboxLive(pin.data(), Date.now())) throw httpError(409, "ผู้ใช้นี้กำลังสายไม่ว่าง", "busy");
  const ref = db.collection("calls").doc();
  const ts = FieldValue.serverTimestamp();
  const fn = String(fromName || "").slice(0, 40), tn = String(toName || "").slice(0, 40);
  await ref.set({ from: uid, to: peer, fromName: fn, toName: tn, status: "ringing", createdAt: ts });
  await inbox.doc(peer).set({ callId: ref.id, dir: "in", other: uid, from: uid, fromName: fn, status: "ringing", t: ts });
  await inbox.doc(uid).set({ callId: ref.id, dir: "out", other: peer, from: uid, status: "ringing", t: ts });
  return { ok: true, callId: ref.id };
}

export async function acceptCall({ db, FieldValue }, uid, { callId }) {
  if (!UID_RE.test(String(callId || ""))) throw httpError(400, "ข้อมูลไม่ถูกต้อง", "invalid");
  const ref = db.collection("calls").doc(callId);
  const sn = await ref.get();
  const d = sn.exists ? sn.data() : null;
  if (!d || d.to !== uid || d.status !== "ringing") throw httpError(410, "สายนี้ถูกยกเลิกหรือหมดเวลาแล้ว", "gone");
  const ts = FieldValue.serverTimestamp();
  await ref.update({ status: "accepted", acceptedAt: ts });
  const inbox = db.collection("callInbox");
  await inbox.doc(d.to).set({ callId, dir: "in", other: d.from, from: d.from, status: "accepted", t: ts });
  await inbox.doc(d.from).set({ callId, dir: "out", other: d.to, from: d.from, status: "accepted", t: ts });
  return { ok: true, from: d.from };
}

export async function finishCall({ db, FieldValue }, uid, { callId, status }) {
  if (!UID_RE.test(String(callId || "")) || !FINAL.includes(status)) throw httpError(400, "ข้อมูลไม่ถูกต้อง", "invalid");
  const ref = db.collection("calls").doc(callId);
  const sn = await ref.get();
  if (!sn.exists) return { ok: true, changed: false };
  const d = sn.data() || {};
  if (d.from !== uid && d.to !== uid) throw httpError(403, "ไม่ใช่สายของคุณ", "forbidden");
  if (FINAL.includes(d.status)) return { ok: true, changed: false };
  await ref.update({ status, endedAt: FieldValue.serverTimestamp(), endedBy: uid });
  for (const who of [d.from, d.to]) {
    try { const r = db.collection("callInbox").doc(who); const s = await r.get(); if (s.exists && (s.data() || {}).callId === callId) await r.delete(); } catch (e) { /* best effort */ }
  }
  return { ok: true, changed: true };
}

export function makeCallHandler(getAdmin) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    try {
      const m = /^Bearer (.+)$/.exec((req.headers && req.headers.authorization) || "");
      if (!m) return res.status(401).json({ error: "ต้องล็อกอินก่อน" });
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const admin = await getAdmin();
      let tok;
      try { tok = await admin.auth.verifyIdToken(m[1]); } catch (e) { return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" }); }
      if (tok.firebase && tok.firebase.sign_in_provider === "anonymous") return res.status(403).json({ error: "ผู้เยี่ยมชมโทรไม่ได้", code: "guest" });
      const a = body.action;
      const out = a === "start" ? await startCall(admin, tok.uid, body)
        : a === "accept" ? await acceptCall(admin, tok.uid, body)
        : a === "finish" ? await finishCall(admin, tok.uid, body)
        : null;
      if (!out) return res.status(400).json({ error: "คำสั่งไม่ถูกต้อง" });
      return res.status(200).json(out);
    } catch (e) {
      const status = e && e.code === 501 ? 501 : (e && e.status) || 500;
      return res.status(status).json({ error: (e && e.message) || "ทำรายการไม่สำเร็จ", code: e && typeof e.code === "string" ? e.code : undefined });
    }
  };
}
