// Vercel Serverless Function — แอดมินดู/อนุมัติ/ปฏิเสธ draft ที่ AI แต่งไว้ — ดู src/aiContent/server.js
// ใช้ Firebase Admin (ข้ามกฎ Firestore) แต่ตรวจสิทธิ์แอดมินเองทุกครั้ง (เหมือน api/admin-delete-user.js)
//
// ต้องตั้งก่อนใช้: ADMIN_EMAILS หรือ ADMIN_UIDS ใน Vercel (ตัวเดียวกับที่ใช้อยู่แล้วสำหรับลบผู้ใช้)
import { listPendingDrafts, approveDraft, rejectDraft } from "../src/aiContent/server.js";
import { isAdmin, isConfigured, parseUids, parseEmails } from "../src/adminTools/logic.js";

let adminCache = null;
async function getAdmin() {
  if (adminCache) return adminCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT"), { status: 501 });
  let initializeApp, cert, getApps, getAuth, getFirestore, FieldValue;
  try {
    ({ initializeApp, cert, getApps } = await import("firebase-admin/app"));
    ({ getAuth } = await import("firebase-admin/auth"));
    ({ getFirestore, FieldValue } = await import("firebase-admin/firestore"));
  } catch (e) {
    throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง firebase-admin"), { status: 501 });
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  adminCache = { auth: getAuth(), db: getFirestore(), FieldValue };
  return adminCache;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const m = /^Bearer (.+)$/.exec((req.headers && req.headers.authorization) || "");
    if (!m) return res.status(401).json({ error: "ต้องล็อกอินก่อน" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = body.action;
    if (!["list", "approve", "reject"].includes(action)) return res.status(400).json({ error: "คำสั่งไม่ถูกต้อง" });

    const admin = await getAdmin();
    let decoded;
    try { decoded = await admin.auth.verifyIdToken(m[1]); } catch (e) { return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" }); }
    const cfg = { uids: parseUids(process.env.ADMIN_UIDS), emails: parseEmails(process.env.ADMIN_EMAILS) };
    if (!isConfigured(cfg)) return res.status(403).json({ error: "ยังไม่ได้ตั้งค่า ADMIN_EMAILS (หรือ ADMIN_UIDS) ใน Vercel" });
    if (!isAdmin(decoded, cfg)) return res.status(403).json({ error: "บัญชีนี้ไม่มีสิทธิ์แอดมิน" });

    if (action === "list") {
      const drafts = await listPendingDrafts(admin, 30);
      return res.status(200).json({ ok: true, drafts });
    }
    if (!body.draftId || typeof body.draftId !== "string") return res.status(400).json({ error: "ไม่พบ draftId" });

    if (action === "approve") {
      const r = await approveDraft(admin, body.draftId, decoded.uid);
      return res.status(200).json({ ok: true, ...r });
    }
    await rejectDraft(admin, body.draftId, decoded.uid, body.reason);
    return res.status(200).json({ ok: true });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
  }
}
