// Text FX — ฟอนต์พิเศษและเอฟเฟกต์ตัวอักษร: ค่าตั้งต้นของระบบ (ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิดทั้งระบบ)
//
// ปิดทั้งระบบ: เปลี่ยน TEXTFX_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว
//   → ทุกชื่อ/ข้อความกลับเป็นแบบเดิมของ Warmly 100% (ไม่โหลดฟอนต์ ไม่ใส่เอฟเฟกต์ใด ๆ)
export const TEXTFX_ENABLED = true;

// ห้องที่มีชื่อเอฟเฟกต์เคลื่อนไหวพร้อมกันมากกว่านี้ → ใช้แบบนิ่ง (ไม่ขยับ) เพื่อไม่ให้เครื่องหนัก (ใช้ในเฟส 2)
export const TEXTFX_LITE_COUNT = 12;

// ร้านค้า (ซื้อฟอนต์ทอง/ม่วง): false = ปิดการซื้อชั่วคราว (ของที่ซื้อแล้วและของฟรียังใช้ได้ตามปกติ, ดูตัวอย่างได้)
export const TEXTFX_SHOP_ENABLED = true;

// ซื้อผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์ (api/font-buy.js) หรือไม่
// false = ซื้อผ่าน Firestore transaction จากแอปโดยตรง (เหมือนระบบกระเป๋าเดิม, Voice Aura และธีม)
// true  = เรียก /api/font-buy (ต้องตั้งค่า Firebase Admin + ล็อกกฎ Firestore ก่อน — ดู api/font-buy.js)
export const TEXTFX_SERVER_PURCHASE = false;
