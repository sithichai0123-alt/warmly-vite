// ตรรกะล้วน ๆ ของระบบเพื่อน (ไม่มี import — ทดสอบด้วย Node ได้ตรง ๆ)
import { MAX_FRIENDS } from "./config.js";

export const pairIdOf = (a, b) => [a, b].sort().join("_");
export const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0);

// docs = เอกสาร friendships ที่ uids มีเรา → แยกเป็น เพื่อน / คำขอที่ได้รับ / คำขอที่ส่งไป
export function parseFriendships(docs, me) {
  const friends = [], incoming = [], outgoing = [];
  for (const d of docs || []) {
    if (!d || !Array.isArray(d.uids) || d.uids.length !== 2 || !d.uids.includes(me)) continue;
    const peer = d.uids.find(x => x !== me);
    if (!peer || typeof peer !== "string") continue;
    if (d.status === "accepted") friends.push({ uid: peer, t: toMs(d.acceptedAt) || toMs(d.createdAt) });
    else if (d.status === "pending") {
      if (d.from === me) outgoing.push({ uid: peer, t: toMs(d.createdAt) });
      else if (d.from === peer) incoming.push({ uid: peer, t: toMs(d.createdAt) });
    }
  }
  const byT = (a, b) => b.t - a.t;
  return { friends: friends.sort(byT), incoming: incoming.sort(byT), outgoing: outgoing.sort(byT) };
}

export function relationOf(parsed, peer) {
  if (!parsed || !peer) return "none";
  if (parsed.friends.some(x => x.uid === peer)) return "friends";
  if (parsed.incoming.some(x => x.uid === peer)) return "incoming";
  if (parsed.outgoing.some(x => x.uid === peer)) return "outgoing";
  return "none";
}

// ตัดสินใจว่ากด "เพิ่มเพื่อน" แล้วควรทำอะไร
export function planRequest(parsed, me, peer, { blockedByMe = false, max = MAX_FRIENDS } = {}) {
  if (!me || !peer || typeof peer !== "string" || peer === me || /[\/\s]/.test(peer)) return { action: "none", reason: "invalid" };
  if (blockedByMe) return { action: "none", reason: "blocked" };
  const rel = relationOf(parsed, peer);
  if (rel === "friends") return { action: "none", reason: "already" };
  if (rel === "outgoing") return { action: "none", reason: "pending" };
  if (rel === "incoming") return { action: "accept" };   // เขาขอเรามาก่อน → กดเพิ่มเพื่อน = ตอบรับเลย
  if (parsed && parsed.friends.length >= max) return { action: "none", reason: "limit" };
  return { action: "create" };
}

// ตัดคำขอที่มาจากคนที่เราบล็อกไว้ (ฝั่งผู้รับ)
export function withoutBlocked(list, blocked) {
  if (!blocked || !blocked.size) return list;
  return list.filter(x => !blocked.has(x.uid));
}

export function sortFriends(friends, presenceOf) {
  // ออนไลน์ก่อน แล้วเรียงตามเวลาที่เป็นเพื่อนล่าสุด
  return [...friends].sort((a, b) => ((presenceOf && presenceOf(b.uid) ? 1 : 0) - (presenceOf && presenceOf(a.uid) ? 1 : 0)) || b.t - a.t);
}
