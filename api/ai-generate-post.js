// Vercel Serverless Function — ให้ AI แต่งโพสต์ 1 อัน แล้วเก็บเป็น draft รออนุมัติ (หรือโพสต์จริงทันทีถ้าเปิด auto)
// ยิงจาก GitHub Actions cron ตามตารางเวลา (ดู .github/workflows/ai-content-post.yml) — ไม่ได้ยิงจากหน้าเว็บ
// ทุกครั้งที่ยิงมา จะเก็บกวาด draft เก่าที่รออนุมัติเกิน AI_STALE_DRAFT_DAYS วัน (ดู config.js) ทิ้งไปด้วยเสมอ
//
// ต้องตั้งก่อนใช้ (นอกเหนือจาก FIREBASE_SERVICE_ACCOUNT ที่มีอยู่แล้ว):
//   ตัวแปร Vercel  ANTHROPIC_API_KEY = คีย์ Claude API
//                  AI_CRON_SECRET    = รหัสลับที่ตั้งเอง (ตัวเดียวกับ secret ของ GitHub Actions) ไม่ตั้ง = ปฏิเสธทุกคน
//   (ไม่บังคับ)   AI_AUTO_PUBLISH   = "1" ให้โพสต์เข้าฟีดจริงทันทีโดยไม่ต้องรอแอดมินอนุมัติ (ค่าเริ่มต้น = ต้องรออนุมัติ)
import { generateAndStore, sweepStaleDrafts } from "../src/aiContent/server.js";
import { isAutoPublishOn } from "../src/aiContent/logic.js";

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
    let swept = { deleted: 0 };
    try { swept = await sweepStaleDrafts(admin); } catch (e) { /* best-effort: อย่าให้ล้มรอบสร้างคอนเทนต์หลัก */ }
    const result = await generateAndStore(admin, apiKey, { autoPublish: isAutoPublishOn(process.env.AI_AUTO_PUBLISH) });
    return res.status(200).json({ ok: true, staleDraftsDeleted: swept.deleted, ...result });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
  }
}
