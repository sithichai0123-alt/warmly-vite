// Vercel Serverless Function — ลบ/ระงับผู้ใช้ทั้งหมด (เฉพาะแอดมิน) — ดู src/adminTools/server.js
// ใช้ Firebase Admin (ข้ามกฎ Firestore) แต่ตรวจสิทธิ์เองทุกครั้ง
//
// ต้องตั้งก่อนใช้ (นอกเหนือจาก FIREBASE_SERVICE_ACCOUNT ที่มีอยู่แล้ว):
//   ตัวแปร Vercel  ADMIN_EMAILS = อีเมล Google ของแอดมิน (คั่นหลายคนด้วย comma)  หรือ  ADMIN_UIDS = uid
//   แล้ว Redeploy · ถ้าไม่ตั้ง = ไม่มีใครใช้ได้ (ปลอดภัยไว้ก่อน)
import { makeHandler } from "../src/adminTools/server.js";
import { parseUids, parseEmails } from "../src/adminTools/logic.js";

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

export default makeHandler(getAdmin, () => ({ uids: parseUids(process.env.ADMIN_UIDS), emails: parseEmails(process.env.ADMIN_EMAILS) }));
