// Voice Token — ตรรกะล้วน (ไม่แตะ Firebase/LiveKit) เพื่อทดสอบได้ตรง ๆ
export const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

// ชื่อห้อง LiveKit → ชนิด + รหัสเอกสารใน Firestore
//   ห้องเสียงหลัก = รหัสเอกสาร voiceRooms/{id} · สายโทรส่วนตัว = "call_" + รหัสเอกสาร calls/{id}
export function parseRoom(room) {
  const s = String(room == null ? "" : room);
  if (s.startsWith("call_")) { const id = s.slice(5); return ROOM_ID_RE.test(id) ? { kind: "call", id } : null; }
  return ROOM_ID_RE.test(s) ? { kind: "voice", id: s } : null;
}

export function bearerOf(headers) {
  const v = (headers && (headers.authorization || headers.Authorization)) || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(v));
  return m ? m[1].trim() : null;
}

export const TERMINAL_CALL = ["declined", "busy", "missed", "cancelled", "ended"];
// สายนี้เข้าห้องเสียงได้ไหม: ต้องเป็นผู้โทรหรือผู้รับ และสายยังไม่จบ
export const callUsable = (d, uid) => !!d && (d.from === uid || d.to === uid) && !TERMINAL_CALL.includes(d.status);

// ห้องเสียงหลัก: คนที่ถูกเตะ (เก็บเป็น uid หรือ init ของสมาชิก) เข้าไม่ได้
export const kickedFrom = (d, uid) => !!d && Array.isArray(d.kicked) && d.kicked.includes(uid);

// นับจำนวนครั้งในช่วงเวลา: คืนค่าใหม่ที่ต้องบันทึก + อนุญาตไหม (นับทุกครั้งที่ขอ รวมครั้งที่ถูกปฏิเสธ)
export function rateStep(prev, now, windowMs, max) {
  const fresh = !prev || typeof prev.start !== "number" || now - prev.start >= windowMs;
  const start = fresh ? now : prev.start;
  const n = (fresh ? 0 : (prev.n || 0)) + 1;
  return { allow: n <= max, next: { start, n }, retryAfterSec: Math.max(1, Math.ceil((start + windowMs - now) / 1000)) };
}
