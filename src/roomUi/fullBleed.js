// สไตล์ "ห้องเต็มจอบนมือถือ" — ใช้ผ่าน className="wm-room" ที่กล่องนอกสุดของห้อง
//   ชดเชยขอบหน้า (padding 14/12 ของหน้า) ด้วย margin ติดลบ · ตัดมุมโค้ง/เส้นซ้าย-ขวาของการ์ด · ตัดกรอบธีม 8px
//   แถวผู้พูด [data-stage-seats] ขยายทั้งก้อนด้วย zoom (เบราว์เซอร์ที่ไม่รองรับ zoom = ขนาดเดิม ไม่พัง)
import { ROOM_FULL_BLEED_ENABLED, FULL_BLEED_MAX_W, STAGE_SEAT_ZOOM } from "./config.js";

export const ROOM_CLASS = ROOM_FULL_BLEED_ENABLED ? "wm-room" : undefined;

export function fullBleedCss(pageTop = 14, pageSide = 12) {
  if (!ROOM_FULL_BLEED_ENABLED) return "";
  return `@media (max-width:${FULL_BLEED_MAX_W}px){
.wm-room{margin:-${pageTop}px -${pageSide}px 16px !important;padding:0 !important;border-radius:0 !important}
.wm-room>div{border-radius:0 !important;border-left:none !important;border-right:none !important;margin-bottom:0 !important}
.wm-room [data-stage-seats]{zoom:${STAGE_SEAT_ZOOM}}
}`;
}
