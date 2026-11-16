// Vercel Serverless Function — สร้าง LiveKit token สำหรับเข้าห้องเสียง / สายโทรส่วนตัว
// ตรวจสิทธิ์ผู้ใช้ก่อนออกโทเคนทุกครั้ง — ดู src/voiceToken/server.js (ต้องมี FIREBASE_SERVICE_ACCOUNT ในสภาพแวดล้อมนั้น ๆ ของ Vercel)
// ย้อนกลับฉุกเฉิน: ตั้งตัวแปร Vercel VOICE_TOKEN_LEGACY=1 แล้ว Redeploy = กลับเป็นแบบเดิม (ไม่ตรวจสิทธิ์)
import { makeTokenHandler } from "../src/voiceToken/server.js";

let adminCache = null;
async function getAdmin() {
  if (adminCache) return adminCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT (ต้องตั้งในสภาพแวดล้อมนี้ด้วย)"), { code: 501 });
  let initializeApp, cert, getApps, getAuth, getFirestore;
  try {
    ({ initializeApp, cert, getApps } = await import("firebase-admin/app"));
    ({ getAuth } = await import("firebase-admin/auth"));
    ({ getFirestore } = await import("firebase-admin/firestore"));
  } catch (e) {
    throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง firebase-admin"), { code: 501 });
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  adminCache = { auth: getAuth(), db: getFirestore() };
  return adminCache;
}

export default makeTokenHandler({ getAdmin });
