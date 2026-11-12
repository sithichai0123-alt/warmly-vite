// Feed Video — คำนวณกรอบวิดีโอ (ฟังก์ชันล้วน)
import { MIN_ASPECT, MAX_ASPECT } from "./config.js";
// สัดส่วน กว้าง/สูง ของวิดีโอ → ค่าที่ใช้จัดกรอบ (แคบ/กว้างเกินไปจะถูกบีบ แล้วใช้แถบดำแทนการตัดภาพ)
export function frameAspect(w, h) {
  if (!(w > 0 && h > 0)) return 16 / 9;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, w / h));
}
