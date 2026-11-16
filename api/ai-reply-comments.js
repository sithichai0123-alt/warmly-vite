// Vercel Serverless Function — ให้ "หัมน้อย" ตอบคอมเมนต์ใหม่ที่คนมาคอมเมนต์ใต้โพสต์ของตัวเอง
// ยิงจาก GitHub Actions cron ทุก 15 นาที (ดู .github/workflows/ai-reply-comments.yml) — ไม่ได้ยิงจากหน้าเว็บ ไม่เรียลไทม์
//
// ต้องตั้งก่อนใช้ (ใช้ตัวแปรเดียวกับ ai-generate-post.js ทั้งหมด ไม่ต้องตั้งเพิ่ม):
//   ตัวแปร Vercel  ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT, AI_CRON_SECRET
import { replyToComments } from "../src/aiContent/server.js";

let adminCache = null;
async function getAdmin() {
  if (adminCache) return adminCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT"), { status: 501 });
  let initializeApp, cert, getApps, getFirestore, FieldValue;
  try {
    ({ initializeApp, cert, getApps } = await import("firebase-admin/app"));
    ({ getFirestore, FieldValue } = await import("firebase-admin/firestore"));
  } catch (e) {
    throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง firebase-admin"), { status: 501 });
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  adminCache = { db: getFirestore(), FieldValue };
  return adminCache;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const secret = process.env.AI_CRON_SECRET;
    if (!secret) return res.status(501).json({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า AI_CRON_SECRET" });
    const given = req.headers["x-cron-secret"];
    if (given !== secret) return res.status(401).json({ error: "ไม่ได้รับอนุญาต" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const admin = await getAdmin();
    const result = await replyToComments(admin, apiKey);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
  }
}
