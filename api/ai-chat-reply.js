// Vercel Serverless Function — หัมน้อย/หัมใหญ่ ตอบในห้องแชทรวม เมื่อมีคนพิมพ์ชื่อบอทนำหน้าข้อความ (เรียกตัวไหนก็ได้ อีกตัวจะแทรกมาแซว)
// ยิงจากฝั่งแอปทันทีตอนมีคนส่งข้อความแบบนั้น (ไม่ใช่ cron) — ต้องแนบ Firebase ID token ของผู้ใช้ (ล็อกอินจริงหรือผู้เยี่ยมชมก็ได้)
// จำกัดจำนวนครั้งต่อคนต่อนาที กันเรียกรัวๆ จนเปลืองค่า Claude API (ดู AI_CHAT_RATE_MAX/WINDOW_MS ใน src/aiChat/config.js)
//
// ใช้ตัวแปร Vercel ที่มีอยู่แล้วทั้งหมด (ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT) ไม่ต้องตั้งเพิ่ม
import { handleChatMention } from "../src/aiChat/server.js";
import { isAnyBotMention } from "../src/aiChat/logic.js";
import { AI_CHAT_TRIGGERS, AI_CHAT_BOTS, AI_CHAT_RATE_WINDOW_MS, AI_CHAT_RATE_MAX, AI_CHAT_RATE_COLLECTION } from "../src/aiChat/config.js";
import { rateStep, bearerOf } from "../src/voiceToken/logic.js";

const BOT_UIDS = new Set(Object.values(AI_CHAT_BOTS).map(b => b.uid));

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
    if (!idToken) return res.status(401).json({ error: "ต้องเข้าแอปก่อนถึงจะเรียกหัมน้อยได้" });

    const admin = await getAdmin();
    let uid, email;
    try { const decoded = await admin.auth.verifyIdToken(idToken); uid = decoded.uid; email = decoded.email || null; }
    catch (e) { return res.status(401).json({ error: "บัญชีหมดอายุหรือไม่ถูกต้อง — ลองโหลดหน้าใหม่" }); }

    const { text, msgId, name, replyToBotUid: rawReplyToBotUid } = req.body || {};
    const replyToBotUid = BOT_UIDS.has(rawReplyToBotUid) ? rawReplyToBotUid : null; // ยอมรับเฉพาะ uid บอทจริงเท่านั้น กัน client ส่งมั่ว
    if (!isAnyBotMention(text, AI_CHAT_TRIGGERS) && !replyToBotUid) return res.status(400).json({ error: "ข้อความนี้ไม่ได้เรียกบอทตัวไหนเลย" });

    // จำกัดจำนวนครั้งต่อคน (ถ้าตัวนับพังเอง ปล่อยผ่าน ไม่ให้ฟีเจอร์ล่มเพราะตัวนับ)
    try {
      const ref = admin.db.collection(AI_CHAT_RATE_COLLECTION).doc(uid);
      const st = await admin.db.runTransaction(async tx => {
        const s = await tx.get(ref);
        const r = rateStep(s.exists ? s.data() : null, Date.now(), AI_CHAT_RATE_WINDOW_MS, AI_CHAT_RATE_MAX);
        tx.set(ref, r.next);
        return r;
      });
      if (!st.allow) return res.status(429).json({ error: "เรียกบอทถี่เกินไป รอสักครู่แล้วลองใหม่" });
    } catch (e) { /* best-effort */ }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const result = await handleChatMention(admin, apiKey, {
      rawText: String(text || "").slice(0, 500),
      triggerUid: uid,
      triggerEmail: email,
      triggerName: String(name || "").slice(0, 60),
      triggerMsgId: msgId ? String(msgId).slice(0, 80) : null,
      replyToBotUid,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const status = (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
  }
}
