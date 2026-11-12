// Feed Video — วิดีโอในฟีด: ขนาดพอดี, เสียงต้นฉบับ, ตัด 30 วินาที, เล่น/หยุดอัตโนมัติ, เล่นทีละคลิป
// ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิด
//
// ปิดทั้งระบบ: เปลี่ยน FEED_VIDEO_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว
//   → ตัวเล่นวิดีโอและหน้าโพสต์กลับเป็นแบบเดิม 100% (วิดีโอที่เคยโพสต์ไม่ถูกแตะ)
export const FEED_VIDEO_ENABLED = true;

export const MAX_VIDEO_SECONDS = 30;   // วิดีโอยาวกว่านี้จะถูกตัดเหลือ 30 วินาทีแรก
export const TRIM_ON_UPLOAD = true;    // ตัดที่ Cloudinary (ใส่ so_0,eo_30 ในลิงก์) ไม่ต้องตัดในเครื่อง
export const PLAY_RATIO = 0.6;         // เล่นเองเมื่อวิดีโอโผล่บนจอ ≥ 60% ของพื้นที่วิดีโอ
export const SWITCH_MARGIN = 0.25;     // มีคลิปใหม่เด่นกว่าคลิปที่เล่นอยู่เกินค่านี้ถึงจะสลับ (กันกระพริบสลับไปมา)
export const MAX_HEIGHT_PX = 520;      // ความสูงสูงสุดของวิดีโอเดี่ยว (และไม่เกิน MAX_HEIGHT_VH)
export const MAX_HEIGHT_VH = 70;
export const MIN_ASPECT = 9 / 16;      // สัดส่วนแคบสุด/กว้างสุดที่ใช้จัดกรอบ (เกินนี้ใส่แถบดำ ไม่ตัดภาพ)
export const MAX_ASPECT = 16 / 9;
export const SOUND_KEY = "wm_feedVideoSound";
