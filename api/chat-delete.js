// Vercel Serverless Function — ลบข้อความแชทส่วนตัว (ทีละข้อความ / ทั้งหมด) ให้หายทั้งสองฝั่ง
// ผ่าน Backend เท่านั้น ใช้ Firebase Admin (ข้ามกฎ Firestore) แต่ตรวจสิทธิ์เองทุกครั้ง — ดู src/chatDelete/server.js
//
// ต้องทำก่อนใช้ (เหมือน api/theme-buy.js):
//   1) เพิ่ม "firebase-admin" ใน package.json (dependencies)
//   2) ตั้งตัวแปร Vercel: FIREBASE_SERVICE_ACCOUNT = เนื้อหา JSON ของ service account (ห้ามแปะในแชท/โค้ด)
//   3) Redeploy
import { makeHandler } from "../src/chatDelete/server.js";

let adminCache = null;
async function getAdmin() {
  if (adminCache) return adminCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT"), { code: 501 });
  let initializeApp, cert, getApps, getAuth, getFirestore, FieldValue;
  try {
    ({ initializeApp, cert, getApps } = await import("firebase-admin/app"));
    ({ getAuth } = await import("firebase-admin/auth"));
    ({ getFirestore, FieldValue } = await import("firebase-admin/firestore"));
  } catch (e) {
    throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง firebase-admin"), { code: 501 });
  }
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  adminCache = { auth: getAuth(), db: getFirestore(), FieldValue };
  return adminCache;
}

export default makeHandler(getAdmin);
