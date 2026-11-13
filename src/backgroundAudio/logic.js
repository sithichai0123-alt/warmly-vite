// Background Audio — ตรรกะล้วน (ไม่แตะ DOM/Firebase/React) เพื่อทดสอบง่าย
import { REJOIN_MAX_TRIES, REJOIN_WINDOW_MS } from "./config.js";

export function detectPlatform(ua = "", maxTouchPoints = 0) {
  const u = String(ua || "");
  if (/iPad|iPhone|iPod/.test(u) || (/Macintosh/.test(u) && Number(maxTouchPoints) > 1)) return "ios"; // iPadOS ปลอมตัวเป็น Mac
  if (/Android/i.test(u)) return "android";
  return "desktop";
}

// ข้อความอธิบายข้อจำกัดจริงของแต่ละระบบ (พูดตรง ๆ ไม่สัญญาเกินจริง)
export function platformNotice(platform, { standalone = false } = {}) {
  if (platform === "ios") {
    return {
      level: "limited",
      title: "iPhone / iPad: ระบบจำกัดเสียงเบื้องหลังของเว็บ",
      lines: [
        "เมื่อล็อกจอหรือสลับไปแอปอื่น iOS อาจตัดเสียงและไมค์ของเว็บ ซึ่งแอปเว็บแก้ที่ตัวเองไม่ได้",
        "แอปจะเชื่อมต่อห้องให้ใหม่อัตโนมัติเมื่อคุณกลับมาที่หน้านี้",
        standalone ? "คุณเปิดจากไอคอนบนหน้าจอหลักอยู่แล้ว ซึ่งดีที่สุดเท่าที่ iOS ให้ทำได้" : "ลองเพิ่มไว้ที่หน้าจอหลัก (แชร์ → เพิ่มลงในหน้าจอโฮม) แล้วเปิดจากไอคอน จะเสถียรกว่าเปิดในเบราว์เซอร์",
        "ถ้าต้องการให้จอไม่ดับระหว่างอยู่ในห้อง เปิด 'กันจอดับ' ด้านล่าง (กินแบตมากขึ้น)",
      ],
    };
  }
  if (platform === "android") {
    return {
      level: "ok",
      title: "Android: รองรับดีที่สุด",
      lines: [
        "ล็อกจอหรือสลับแอปแล้วเสียงห้องควรเล่นต่อ และมีปุ่มควบคุมบนหน้าจอล็อก",
        "บางรุ่นที่ประหยัดแบตแรง ๆ อาจตัดแอปเอง ให้ตั้งค่าแบตเตอรี่ของเบราว์เซอร์เป็น 'ไม่จำกัด'",
        "ห้ามปัดปิดเบราว์เซอร์ออกจากหน้าจอแอปล่าสุด เพราะจะตัดการเชื่อมต่อ",
      ],
    };
  }
  return { level: "ok", title: "คอมพิวเตอร์: ใช้ได้ตามปกติ", lines: ["เสียงเล่นต่อได้เมื่อสลับแท็บหรือย่อหน้าต่าง", "ห้ามปิดแท็บนี้ระหว่างอยู่ในห้อง"] };
}

// ตัดสินใจเมื่อผู้ใช้กลับมาที่หน้าจอ (หรือเน็ตกลับมา)
//   state: สถานะการเชื่อมต่อของห้อง "connected" | "connecting" | "reconnecting" | "disconnected" | null (ไม่มีห้อง)
//   tries: รายการเวลา (ms) ที่เคยพยายามเชื่อมต่อใหม่
export function pruneTries(tries, now, windowMs = REJOIN_WINDOW_MS) {
  return (tries || []).filter(t => now - t < windowMs);
}
export function planResume({ wanted, state, connecting = false, tries = [], now = Date.now(), maxTries = REJOIN_MAX_TRIES, windowMs = REJOIN_WINDOW_MS }) {
  if (!wanted) return { resumeAudio: false, rejoin: false, exhausted: false };
  const dead = state === "disconnected" || state == null;
  if (!dead || connecting) return { resumeAudio: true, rejoin: false, exhausted: false };
  const recent = pruneTries(tries, now, windowMs);
  if (recent.length >= maxTries) return { resumeAudio: true, rejoin: false, exhausted: true };
  return { resumeAudio: true, rejoin: true, exhausted: false };
}

export const mediaTitle = (name, kind) => (kind === "call" ? "สายส่วนตัว" : "ห้อง " + (name || "เสียง"));

export function parsePrefs(raw) {
  try { const o = JSON.parse(raw); return { wake: !!(o && o.wake) }; } catch (e) { return { wake: false }; }
}
