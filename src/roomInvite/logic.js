// ตรรกะล้วน ๆ ของคำเชิญเข้าห้องเสียง (ไม่มี import)
import { INVITE_TTL_MS, RESEND_COOLDOWN_MS } from "./config.js";

export const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0);

// คำเชิญที่ยังใช้ได้: pending, ยังไม่หมดอายุ, มีห้อง, ไม่ได้มาจากคนที่เราบล็อก
export function activeInvites(list, now, { blocked, ttl = INVITE_TTL_MS } = {}) {
  return (list || []).filter(i => i && i.status === "pending" && typeof i.roomId === "string" && i.roomId && typeof i.from === "string"
    && (!blocked || !blocked.has(i.from)) && (() => { const t = toMs(i.t); return !t || now - t < ttl; })());
}
export function expiredInvites(list, now, ttl = INVITE_TTL_MS) {
  return (list || []).filter(i => i && (() => { const t = toMs(i.t); return t && now - t >= ttl; })());
}

// state ของเพื่อนแต่ละคนในหน้าต่างเชิญ: in-room | cooldown | can
export function inviteStates(friendUids, memberUids, sentAt, now, cooldown = RESEND_COOLDOWN_MS) {
  return friendUids.map(uid => {
    if (memberUids.has(uid)) return { uid, state: "in-room" };
    const t = sentAt && sentAt.get(uid);
    if (t && now - t < cooldown) return { uid, state: "cooldown", left: cooldown - (now - t) };
    return { uid, state: sentAt && sentAt.has(uid) ? "again" : "can" };
  });
}

export function canInvite({ me, to, isFriend, inRoomId, memberUids, guest }) {
  if (!me || !to || me === to) return { ok: false, reason: "invalid" };
  if (guest) return { ok: false, reason: "guest" };
  if (!inRoomId) return { ok: false, reason: "no-room" };
  if (!isFriend) return { ok: false, reason: "not-friend" };
  if (memberUids && memberUids.has(to)) return { ok: false, reason: "in-room" };
  return { ok: true };
}
