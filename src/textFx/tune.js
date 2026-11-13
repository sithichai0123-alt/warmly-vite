// Text FX เฟส 4 — ปรับแต่งเอฟเฟกต์รายจุด (ตรรกะล้วน ไม่แตะ DOM/Firebase)
//   users/{uid}.textFx.tune = { [area]: { s, g, h } }   s=ความเร็ว g=ความเรืองแสง h=โทนสี (ดัชนีในตารางด้านล่าง)
//   ค่ากลาง {s:1,g:1,h:0} = ไม่ปรับอะไรเลย (ได้ผลเหมือนก่อนมีเฟส 4 ทุกอย่าง)
//   ขอบเขตจำกัดไว้เสมอ: ความเร็วไม่เร็วเกินรอบละ 1.5 วินาที, เรืองแสงไม่เกิน 24px, โทนสีเฉพาะมุมที่ตรวจแล้วว่าอ่านออกบนทุกพื้น
export const SPEED_LABEL = ["ช้า", "ปกติ", "เร็ว"];
export const SPEED_K = [1.6, 1, 0.75];          // คูณเวลาต่อรอบ (ยิ่งน้อยยิ่งเร็ว)
export const MIN_CYCLE_SECS = 1.5;              // ไม่ให้รอบสั้นกว่านี้ (กันกะพริบถี่)
export const GLOW_LABEL = ["เบา", "ปกติ", "แรง"];
export const GLOW_K = [0.4, 1, 1.5];            // คูณรัศมีเบลอ
export const MAX_BLUR = 24, MAX_DROP_BLUR = 8;
export const HUE_STEPS = [0, 60, 120, 180, 240, 300]; // องศา hue-rotate (ตรวจความตัดกัน ≥ 3.5:1 บนทุกพื้นของธีม)
export const HUE_LABEL = ["ปกติ", "+60°", "+120°", "+180°", "+240°", "+300°"];
export const TUNE_DEFAULT = { s: 1, g: 1, h: 0 };

// รับเฉพาะตัวเลข หรือสตริงตัวเลขล้วน (กัน null/""/[]/true ที่ Number() แปลงเป็น 0/1 โดยไม่ตั้งใจ)
const int = (v, max, d) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : d;
};
export function normalizeTune(t) {
  const o = t && typeof t === "object" ? t : {};
  return { s: int(o.s, 2, 1), g: int(o.g, 2, 1), h: int(o.h, HUE_STEPS.length - 1, 0) };
}
export const isDefaultTune = t => { const n = normalizeTune(t); return n.s === 1 && n.g === 1 && n.h === 0; };
export const sameTune = (a, b) => { const x = normalizeTune(a), y = normalizeTune(b); return x.s === y.s && x.g === y.g && x.h === y.h; };

// ปรับอะไรได้บ้างกับไอเทมนี้ (ซ่อนตัวเลือกที่ไม่มีผล)
export function tuneCaps(item) {
  if (!item || item.plain) return { speed: false, glow: false, hue: false };
  const animated = !!(item.blink || item.pulse || item.sweep || item.flicker || item.glitch || (item.grad && item.grad.flow));
  // เรืองแสงที่ปรับได้: text-shadow ที่ไม่ถูกแอนิเมชันทับ (pulse/glitch ใช้ keyframes ของตัวเอง) หรือ drop-shadow ของตัวอักษรไล่สี
  const glow = !!(item.dropGlow || (item.glow && !item.pulse && !item.glitch));
  return { speed: animated, glow, hue: !!(item.color || item.grad || item.sweep || item.glow) };
}
