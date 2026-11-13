// ตรรกะล้วน ๆ ของโทรส่วนตัว (ไม่มี import นอกจาก config) — ทดสอบด้วย Node ได้ตรง ๆ
import { BUSY_RING_WINDOW_MS, BUSY_ACTIVE_WINDOW_MS, RING_TIMEOUT_MS } from "./config.js";

export const toMs = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0);
export const callRoomName = (callId) => "call_" + String(callId);

// กล่องสายเข้า/ออกของผู้ใช้ยังนับว่า "ไม่ว่าง" อยู่ไหม
export function inboxLive(entry, now) {
  if (!entry || typeof entry !== "object") return false;
  const t = toMs(entry.t) || now;
  if (entry.status === "ringing") return now - t < BUSY_RING_WINDOW_MS;
  if (entry.status === "accepted") return now - t < BUSY_ACTIVE_WINDOW_MS;
  return false;
}

// สายเข้าที่ควรแสดงหน้าจอ "รับสาย" ตอนนี้ไหม
export function incomingRing(entry, now) {
  if (!entry || entry.dir !== "in" || entry.status !== "ringing" || !entry.callId || !entry.from) return null;
  const t = toMs(entry.t) || now;
  if (now - t > RING_TIMEOUT_MS + 5000) return null;
  return { callId: entry.callId, from: entry.from, fromName: entry.fromName || "", t, leftMs: Math.max(0, RING_TIMEOUT_MS - (now - t)) };
}

const REASONS = {
  self: "โทรหาตัวเองไม่ได้", guest: "บัญชี Guest ใช้โทรส่วนตัวไม่ได้ (ต้องล็อกอิน Google)", "peer-guest": "ผู้ใช้นี้เป็น Guest โทรหาไม่ได้",
  blocked: "คุณบล็อกผู้ใช้นี้อยู่ — เลิกบล็อกก่อนจึงจะโทรได้", "not-met": "โทรได้เฉพาะเพื่อน หรือคนที่อยู่ในห้องเสียงเดียวกับคุณ",
  "in-call": "คุณกำลังอยู่ในสายอื่นอยู่", "peer-busy": "ผู้ใช้นี้กำลังสายไม่ว่าง ลองใหม่อีกครั้ง",
};
export const reasonText = (r) => REASONS[r] || "โทรไม่ได้ในขณะนี้";

// กติกาว่าโทรหาใครได้: เพื่อน หรือ คนที่อยู่ห้องเสียงเดียวกับเราตอนนี้ ("คนที่เคยเจอในห้องเสียง")
export function canStartCall({ me, peer, guest, peerGuest, sameRoom, isFriend, blockedByMe, inCall }) {
  if (!me || !peer || typeof peer !== "string" || /[\/\s]/.test(peer) || me === peer) return { ok: false, reason: "self" };
  if (guest) return { ok: false, reason: "guest" };
  if (peerGuest) return { ok: false, reason: "peer-guest" };
  if (blockedByMe) return { ok: false, reason: "blocked" };
  if (inCall) return { ok: false, reason: "in-call" };
  if (!sameRoom && !isFriend) return { ok: false, reason: "not-met" };
  return { ok: true };
}

export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? h + ":" + p(m) + ":" + p(x) : p(m) + ":" + p(x);
}

// ข้อความแจ้งเมื่อสายจบ (ตามฝั่งที่เราเป็น)
export function endText(status, role, name) {
  const n = name || "อีกฝ่าย";
  switch (status) {
    case "declined": return role === "caller" ? n + " ปฏิเสธสาย" : "ปฏิเสธสายแล้ว";
    case "busy": return n + " กำลังสายไม่ว่าง";
    case "missed": return role === "caller" ? n + " ไม่ได้รับสาย" : "พลาดสายจาก " + n;
    case "cancelled": return role === "caller" ? "ยกเลิกสายแล้ว" : n + " ยกเลิกสาย";
    case "ended": return "สายจบแล้ว";
    default: return "สายจบแล้ว";
  }
}
export const TERMINAL = new Set(["declined", "busy", "missed", "cancelled", "ended"]);
