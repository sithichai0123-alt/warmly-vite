// Voice Token — ตัวจัดการคำขอโทเคนฝั่งเซิร์ฟเวอร์ (ใช้เฉพาะ api/token.js) ฉีด admin/env เข้ามาเพื่อทดสอบได้โดยไม่ต้องมี Firebase/LiveKit จริง
//
// กฎความปลอดภัย:
//  - ต้องแนบ Firebase ID token ของผู้ใช้ที่ล็อกอินอยู่ (Google หรือผู้เยี่ยมชม) → ได้ uid จริงจากเซิร์ฟเวอร์ Firebase
//  - ชื่อในห้องเสียง (identity) ต้องตรงกับ uid นั้น: กันการปลอมเป็นคนอื่น (LiveKit: เข้าด้วยชื่อซ้ำ = เตะคนเดิมออก)
//  - ห้องเสียงหลัก: ต้องมีเอกสารห้องอยู่จริง และไม่ถูกเตะ · สายโทร: ต้องเป็นผู้โทร/ผู้รับ และสายยังไม่จบ
//  - จำกัดจำนวนครั้งที่ขอโทเคนต่อคน · อายุโทเคนสั้นลง
//  - สิทธิ์พูด (canPublish) ยังเป็นแบบเดิม (ทุกคนพูดได้): การบังคับสิทธิ์บนเวทีต้องแก้กฎเอกสารห้องก่อน (ดู PR)
import { AccessToken as DefaultAccessToken } from "livekit-server-sdk";
import { parseRoom, bearerOf, callUsable, kickedFrom, rateStep } from "./logic.js";
import { VOICE_TOKEN_AUTH_REQUIRED, TOKEN_TTL, LEGACY_TOKEN_TTL, RATE_WINDOW_MS, RATE_MAX, RATE_COLLECTION } from "./config.js";

const httpError = (status, message, extra) => Object.assign(new Error(message), { status, ...(extra || {}) });

export function makeTokenHandler({ getAdmin, env: envOverride, AccessToken = DefaultAccessToken, now = Date.now, authRequired = VOICE_TOKEN_AUTH_REQUIRED, log = console }) {
  const issue = async ({ identity, name, room, ttl }) => {
    const env = envOverride || process.env;   // อ่านตอนมีคำขอ (ไม่ใช่ตอนโหลดไฟล์)
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = env;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: String(identity).slice(0, 64), name: String(name || identity).slice(0, 64), ttl });
    at.addGrant({ roomJoin: true, room: String(room).slice(0, 128), canPublish: true, canSubscribe: true });
    return { token: await at.toJwt(), url: LIVEKIT_URL };
  };

  return async function handler(req, res) {
    const send = (status, body, headers) => { Object.entries(headers || {}).forEach(([k, v]) => res.setHeader(k, v)); return res.status(status).json(body); };
    try {
      const { room, identity, name } = req.query || {};
      const env = envOverride || process.env;
      if (!room || !identity) throw httpError(400, "room and identity required");
      const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = env;
      if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) throw httpError(500, "LIVEKIT env vars missing on server");
      res.setHeader("Cache-Control", "no-store");

      // ย้อนกลับฉุกเฉิน: แบบเดิม (ไม่ตรวจสิทธิ์)
      if (!authRequired || env.VOICE_TOKEN_LEGACY === "1") {
        return send(200, await issue({ identity, name, room, ttl: LEGACY_TOKEN_TTL }));
      }

      const where = parseRoom(room);
      if (!where) throw httpError(400, "ชื่อห้องไม่ถูกต้อง");
      const idToken = bearerOf(req.headers);
      if (!idToken) throw httpError(401, "ต้องล็อกอินก่อนเข้าห้องเสียง");

      let admin;
      try { admin = await getAdmin(); } catch (e) { throw httpError(e.code === 501 ? 501 : 500, e.message || "เซิร์ฟเวอร์ยังไม่พร้อม"); }
      const { auth, db } = admin;

      let uid;
      try { uid = (await auth.verifyIdToken(idToken)).uid; } catch (e) { throw httpError(401, "บัญชีหมดอายุหรือไม่ถูกต้อง — ล็อกอินใหม่"); }
      if (String(identity) !== uid) throw httpError(403, "ชื่อในห้องเสียงไม่ตรงกับบัญชีที่ล็อกอิน");

      // จำกัดจำนวนครั้ง (ถ้าตัวนับพังเอง ปล่อยผ่าน ไม่ให้ห้องเสียงล่มเพราะตัวนับ)
      try {
        const ref = db.collection(RATE_COLLECTION).doc(uid);
        const st = await db.runTransaction(async tx => {
          const s = await tx.get(ref);
          const r = rateStep(s.exists ? s.data() : null, now(), RATE_WINDOW_MS, RATE_MAX);
          tx.set(ref, r.next);
          return r;
        });
        if (!st.allow) throw httpError(429, "ขอเข้าห้องเสียงบ่อยเกินไป รอสักครู่แล้วลองใหม่", { retryAfter: st.retryAfterSec });
      } catch (e) { if (e.status === 429) throw e; log.error && log.error("voice-token rate", e); }

      // ตรวจห้อง
      let snap;
      try { snap = await db.collection(where.kind === "call" ? "calls" : "voiceRooms").doc(where.id).get(); }
      catch (e) { log.error && log.error("voice-token room", e); throw httpError(503, "ตรวจห้องไม่สำเร็จ ลองใหม่อีกครั้ง"); }
      if (!snap.exists) throw httpError(404, where.kind === "call" ? "ไม่พบสายนี้" : "ไม่พบห้องนี้ (อาจถูกปิดแล้ว)");
      const d = snap.data() || {};
      if (where.kind === "call") { if (!callUsable(d, uid)) throw httpError(403, "เข้าสายนี้ไม่ได้"); }
      else if (kickedFrom(d, uid)) throw httpError(403, "คุณถูกเตะออกจากห้องนี้");

      return send(200, await issue({ identity: uid, name, room, ttl: TOKEN_TTL }));
    } catch (e) {
      const status = e.status || 500;
      return send(status, { error: e.message }, e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined);
    }
  };
}
