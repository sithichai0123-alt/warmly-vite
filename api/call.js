// Vercel Serverless Function — โทรส่วนตัว: เริ่มสาย / รับสาย / จบสาย (ทำที่เซิร์ฟเวอร์เพราะต้องแตะกล่องสายของอีกฝ่าย)
// ใช้ Firebase Admin (ข้ามกฎ Firestore) แต่ตรวจตัวตนจาก ID token ทุกครั้ง — ดู src/privateCall/server.js
// ใช้ FIREBASE_SERVICE_ACCOUNT ตัวเดียวกับ api/chat-delete.js · ไม่ได้ตั้ง → แอปกลับไปเขียนตรงจากเครื่อง (แบบเดิม)
import { makeCallHandler } from "../src/privateCall/server.js";

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

export default makeCallHandler(getAdmin);
