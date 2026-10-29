// Vercel Serverless Function — ซื้อ Voice Aura ฝั่งเซิร์ฟเวอร์ (ตรวจยอดเหรียญจริง ๆ ที่นี่)
// ยังไม่ถูกเรียกใช้จนกว่าจะตั้ง AURA_SERVER_PURCHASE = true ใน src/voiceAura/config.js
//
// ต้องทำก่อนเปิดใช้ (ดูรายละเอียดใน VOICE-AURA.md):
//   1) npm i firebase-admin  (เพิ่มใน package.json)
//   2) ตั้งตัวแปร Vercel: FIREBASE_SERVICE_ACCOUNT = เนื้อหา JSON ของ service account (ห้ามแปะในแชท/โค้ด)
//   3) ล็อกกฎ Firestore ไม่ให้แอปแก้ coins / purple / purpleBought / inventory ได้เอง
// ใช้กฎการซื้อชุดเดียวกับในแอป (planBuyAura) จึงไม่มีสองมาตรฐาน
import { planBuyAura } from "../src/voiceAura/wallet.js";

let adminCache = null;
async function getAdmin() {
  if (adminCache) return adminCache;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT"), { code: 501 });
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  adminCache = { auth: getAuth(), db: getFirestore(), FieldValue };
  return adminCache;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!m) return res.status(401).json({ error: "ต้องล็อกอินก่อน" });
    const id = req.body && typeof req.body.id === "string" ? req.body.id.slice(0, 32) : "";
    if (!id) return res.status(400).json({ error: "ไม่ระบุเอฟเฟกต์" });

    const { auth, db, FieldValue } = await getAdmin();
    let uid;
    try { uid = (await auth.verifyIdToken(m[1])).uid; } catch (e) { return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" }); }

    const ref = db.collection("users").doc(uid);
    const entry = await db.runTransaction(async tx => {
      const sn = await tx.get(ref);
      const p = planBuyAura(sn.exists ? sn.data() : {}, id); // เหรียญไม่พอ/ซื้อซ้ำ → throw (ไม่เขียนอะไรเลย)
      tx.set(ref, p.patch, { merge: true });
      tx.set(db.collection("ledger").doc(), { uid, gold: 0, purple: 0, purpleBought: 0, ...p.entry, t: FieldValue.serverTimestamp() });
      return p.entry;
    });
    return res.status(200).json({ ok: true, entry });
  } catch (e) {
    const code = e && e.code === 501 ? 501 : 400;
    return res.status(code).json({ error: e.message || "ซื้อไม่สำเร็จ" });
  }
}
