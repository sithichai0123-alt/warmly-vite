// Presence — ตรรกะล้วน (ไม่แตะ Firebase/DOM) เพื่อทดสอบง่าย
import { STALE_MS } from "./config.js";

const toMs = t => {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") { try { return t.toMillis(); } catch (e) { return null; } }
  return null;
};

// เอกสาร presence → { state:"online"|"offline", lastSeen:ms|null }
//   - โหมดซ่อน (hidden) = แสดงเป็นออฟไลน์เสมอ และไม่เปิดเผยเวลาล่าสุด
//   - hideLast = ซ่อนเฉพาะ "ออนไลน์ล่าสุดเมื่อไหร่"
//   - state="online" แต่เงียบเกิน STALE_MS = ออฟไลน์ (กันสถานะค้างเมื่อแอปถูกปิดโดยไม่ได้ส่งออฟไลน์)
//   - t ยังไม่ได้ค่าจากเซิร์ฟเวอร์ (เพิ่งเขียน) = ใช้เวลาปัจจุบัน
export function computeStatus(d, now, staleMs = STALE_MS) {
  if (!d || typeof d !== "object") return { state: "offline", lastSeen: null };
  if (d.hidden === true) return { state: "offline", lastSeen: null };
  let t = toMs(d.t);
  if (t == null) t = now;
  if (t > now) t = now; // นาฬิกาเครื่องเพี้ยน
  const fresh = now - t < staleMs;
  const online = d.state === "online" && fresh;
  return { state: online ? "online" : "offline", lastSeen: d.hideLast === true ? null : t };
}

export function formatLastSeen(ms, now) {
  if (ms == null) return "";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "ออนไลน์ล่าสุดเมื่อกี้";
  if (s < 3600) return "ออนไลน์ล่าสุด " + Math.floor(s / 60) + " นาทีที่แล้ว";
  if (s < 86400) return "ออนไลน์ล่าสุด " + Math.floor(s / 3600) + " ชม.ที่แล้ว";
  if (s < 86400 * 30) return "ออนไลน์ล่าสุด " + Math.floor(s / 86400) + " วันที่แล้ว";
  return "ออนไลน์ล่าสุดนานแล้ว";
}

// ข้อความสถานะสำหรับแสดงใต้ชื่อ ("ออนไลน์" / "ออนไลน์ล่าสุด 5 นาทีที่แล้ว" / "")
export function statusLabel(st, now) {
  if (st.state === "online") return "ออนไลน์";
  return formatLastSeen(st.lastSeen, now);
}

// ค่าที่จะเขียนลง presence/{uid}
//   ซ่อนอยู่ = เขียน "ออฟไลน์" ธรรมดา (ไม่ใส่เวลาจริงที่กำลังใช้งาน) และจะไม่ส่ง heartbeat
export function buildPresenceWrite(state, prefs) {
  const hidden = prefs && prefs.showOnline === false;
  const hideLast = hidden || (prefs && prefs.showLast === false);
  return { state: hidden ? "offline" : state, hidden: !!hidden, hideLast: !!hideLast, lastPrefOff: !!(prefs && prefs.showLast === false) };
}
