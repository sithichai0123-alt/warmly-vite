// Vercel Serverless Function — หัมน้อย+หัมใหญ่ ทักทายต้อนรับคนเข้าแอปใหม่ในห้องแชทรวม (ครั้งแรกเท่านั้น ต่อ 1 คน ตลอดไป)
// ยิงจากฝั่งแอปตอนเข้าแอปครั้งแรก (ไม่ใช่ cron) — ต้องแนบ Firebase ID token ของผู้ใช้ (ล็อกอินจริงหรือผู้เยี่ยมชมก็ได้)
// ใช้ uid จาก token ที่ verify แล้วเท่านั้น (ไม่เชื่อ uid ที่ client ส่งมา) กันปลอมเป็นคนอื่น
// idempotent ในตัว (เช็ค chatWelcomedAt ด้วย transaction ใน handleNewUserWelcome) เรียกซ้ำกี่ครั้งก็ไม่ทักซ้ำ/ไม่เสียค่า Claude ซ้ำ จึงไม่ต้องจำกัดอัตราเรียก
//
// ใช้ตัวแปร Vercel ที่มีอยู่แล้วทั้งหมด (ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT) ไม่ต้องตั้งเพิ่ม
import { handleNewUserWelcome } from "../src/aiChat/server.js";
import { bearerOf } from "../src/voiceToken/logic.js";

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
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "ใช้ POST เท่านั้น" });
    const idToken = bearerOf(req.headers);
    if (!idToken) return res.status(401).json({ error: "ต้องเข้าแอปก่อน" });

    const admin = await getAdmin();
    let uid;
    try { uid = (await admin.auth.verifyIdToken(idToken)).uid; }
    catch (e) { return res.status(401).json({ error: "บัญชีหมดอายุหรือไม่ถูกต้อง — ลองโหลดหน้าใหม่" }); }

    const { name } = req.body || {};
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const result = await handleNewUserWelcome(admin, apiKey, { uid, name: String(name || "").slice(0, 60) });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
  }
}
