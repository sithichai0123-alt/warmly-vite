// Room Life — ตรรกะอายุห้องเสียง (ฟังก์ชันล้วน + hooks เล็ก ๆ) ไม่ import จาก App.jsx
//   ห้องมีฟิลด์ hostSeen (เวลาที่โฮสต์ยังอยู่ในห้องล่าสุด) — โฮสต์ในห้องเขียนทุก 1 นาที และตอนกดออก
//   ห้องไม่มี hostSeen (ห้องเก่า) → ใช้เวลาสร้างห้องแทน
//   เกิน 5 นาทีนับจากนั้น = หมดอายุ: ซ่อนจากรายการทันที และเครื่องใดก็ตามที่เปิดแอปอยู่จะลบห้องให้
import { useState, useEffect, useRef } from "react";
import { ROOM_AUTOCLOSE_ENABLED, ROOM_HOST_AWAY_MS, ROOM_HEARTBEAT_MS, ROOM_WARN_AFTER_MS } from "./config.js";
export { ROOM_AUTOCLOSE_ENABLED, ROOM_HOST_AWAY_MS, ROOM_HEARTBEAT_MS, ROOM_WARN_AFTER_MS } from "./config.js";

const ms = t => (t && typeof t.toMillis === "function" ? t.toMillis() : (typeof t === "number" ? t : null));

// เวลาล่าสุดที่รู้ว่าโฮสต์ยังอยู่ (ms) หรือ null ถ้าไม่รู้ (เช่น ห้องที่เพิ่งสร้างและเวลาจากเซิร์ฟเวอร์ยังมาไม่ถึง)
export function roomHostLastSeen(r) {
  if (!r) return null;
  if (r.hostSeen === null) return null; // เพิ่งเขียน เวลาจากเซิร์ฟเวอร์ยังมาไม่ถึง → ยังไม่นับ
  const h = ms(r.hostSeen);
  if (h !== null) return h;
  return ms(r.createdAt);
}

// โฮสต์ไม่อยู่นานแค่ไหนแล้ว (ms) — null = ไม่รู้/ไม่ควรนับ
export function roomAwayMs(r, now) {
  if (!ROOM_AUTOCLOSE_ENABLED) return null;
  const t = roomHostLastSeen(r);
  if (t === null) return null;
  return Math.max(0, now - t);
}
export function roomExpired(r, now) {
  const a = roomAwayMs(r, now);
  return a !== null && a > ROOM_HOST_AWAY_MS;
}
// เหลือเวลาก่อนห้องปิดอีกกี่ ms (null = โฮสต์ยังอยู่/ยังไม่ต้องเตือน)
export function roomCloseInMs(r, now) {
  const a = roomAwayMs(r, now);
  if (a === null || a < ROOM_WARN_AFTER_MS) return null;
  return Math.max(0, ROOM_HOST_AWAY_MS - a);
}
export function fmtCountdown(msLeft) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// เวลาปัจจุบันที่อัปเดตทุก every ms (ไว้ให้หน้าจอซ่อนห้องหมดอายุ/นับถอยหลังได้เอง)
export function useNow(every) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), every); return () => clearInterval(id); }, [every]);
  return n;
}

// โฮสต์อยู่ในห้อง (active) → เช็กชื่อทันที + ทุก ROOM_HEARTBEAT_MS + ทุกครั้งที่กลับมาเปิดแท็บ
export function useRoomHeartbeat(active, beat, key) {
  const ref = useRef(beat);
  ref.current = beat;
  useEffect(() => {
    if (!ROOM_AUTOCLOSE_ENABLED || !active) return;
    const go = () => { try { ref.current(); } catch (e) { /* ไม่เป็นไร */ } };
    go();
    const id = setInterval(go, ROOM_HEARTBEAT_MS);
    const vis = () => { if (typeof document !== "undefined" && document.visibilityState === "visible") go(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); if (typeof document !== "undefined") document.removeEventListener("visibilitychange", vis); };
  }, [active, key]);
}

// เครื่องที่เปิดแอปอยู่ลบห้องที่หมดอายุ (remove ต้องตรวจซ้ำกับข้อมูลล่าสุดก่อนลบ) — ลบแต่ละห้องครั้งเดียวต่อเครื่อง
export function useRoomJanitor(rooms, now, remove) {
  const done = useRef(new Set());
  useEffect(() => {
    if (!ROOM_AUTOCLOSE_ENABLED) return;
    rooms.forEach(r => {
      if (!roomExpired(r, now) || done.current.has(r.id)) return;
      done.current.add(r.id);
      Promise.resolve().then(() => remove(r)).catch(() => { done.current.delete(r.id); });
    });
  }, [rooms, now]); // eslint-disable-line
}
