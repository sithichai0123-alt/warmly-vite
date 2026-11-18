// Presence — ตรรกะล้วน (ไม่แตะ Firebase/DOM) เพื่อทดสอบง่าย
import { STALE_MS, RECENT_MS } from "./config.js";

const toMs = t => {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") { try { return t.toMillis(); } catch (e) { return null; } }
  return null;
};

// เอกสาร presence → { state:"online"|"recent"|"offline", lastSeen:ms|null }  (recent = เพิ่งออกไปไม่เกิน RECENT_MS และไม่ได้ซ่อนเวลาล่าสุด)
//   - โหมดซ่อน (hidden) = แสดงเป็นออฟไลน์เสมอ และไม่เปิดเผยเวลาล่าสุด
//   - hideLast = ซ่อนเฉพาะ "ออนไลน์ล่าสุดเมื่อไหร่"
//   - state="online" แต่เงียบเกิน STALE_MS = ออฟไลน์ (กันสถานะค้างเมื่อแอปถูกปิดโดยไม่ได้ส่งออฟไลน์)
//   - t ยังไม่ได้ค่าจากเซิร์ฟเวอร์ (เพิ่งเขียน) = ใช้เวลาปัจจุบัน
export function computeStatus(d, now, staleMs = STALE_MS, recentMs = RECENT_MS) {
  if (!d || typeof d !== "object") return { state: "offline", lastSeen: null };
  if (d.hidden === true) return { state: "offline", lastSeen: null };
  let t = toMs(d.t);
  if (t == null) t = now;
  if (t > now) t = now; // นาฬิกาเครื่องเพี้ยน
  const fresh = now - t < staleMs;
  const online = d.state === "online" && fresh;
  const lastSeen = d.hideLast === true ? null : t;
  const recent = !online && lastSeen != null && now - lastSeen < recentMs;
  return { state: online ? "online" : recent ? "recent" : "offline", lastSeen };
}

// เวลาเริ่มของ "หน้าต่างคนที่เพิ่ง active" (ms) — เอกสารที่ t เก่ากว่านี้ไม่ต้องฟัง (ออฟไลน์อยู่แล้ว)
export const windowStart = (now, windowMs) => now - windowMs;

// นับคนที่ออนไลน์จริง ๆ จากเอกสารสถานะ (แทนการเอารายชื่อผู้ใช้ทั้งหมดมานับ)
export function countOnline(docs, now, staleMs = STALE_MS) {
  let n = 0;
  if (!docs) return 0;
  for (const k of Object.keys(docs)) if (computeStatus(docs[k], now, staleMs).state === "online") n++;
  return n;
}

export function formatLastSeen(ms, now) {
  if (ms == null) return "";
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "เห็นล่าสุดเมื่อกี้";
  if (s < 3600) return "เห็นล่าสุด " + Math.floor(s / 60) + " นาทีที่แล้ว";
  if (s < 86400) return "เห็นล่าสุด " + Math.floor(s / 3600) + " ชม.ที่แล้ว";
  if (s < 86400 * 30) return "เห็นล่าสุด " + Math.floor(s / 86400) + " วันที่แล้ว";
  return "เห็นล่าสุดนานแล้ว";
}

// ข้อความสถานะใต้ชื่อ: ออนไลน์ = ไม่มีข้อความ (ดูจากจุด) / ออกไปแล้ว = "เห็นล่าสุด 5 นาทีที่แล้ว" / ซ่อน = ""
export function statusLabel(st, now) {
  if (st.state === "online") return ""; // ออนไลน์ดูจากจุดเขียวพอ ไม่ต้องมีข้อความ
  return formatLastSeen(st.lastSeen, now);
}

// ค่าที่จะเขียนลง presence/{uid}
//   ซ่อนอยู่ = เขียน "ออฟไลน์" ธรรมดา (ไม่ใส่เวลาจริงที่กำลังใช้งาน) และจะไม่ส่ง heartbeat
export function buildPresenceWrite(state, prefs) {
  const hidden = prefs && prefs.showOnline === false;
  const hideLast = hidden || (prefs && prefs.showLast === false);
  return { state: hidden ? "offline" : state, hidden: !!hidden, hideLast: !!hideLast, lastPrefOff: !!(prefs && prefs.showLast === false) };
}
