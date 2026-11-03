// Themes — ค่าตั้งต้นของระบบธีม (ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิดทั้งระบบ)
//
// ปิดทั้งระบบ: เปลี่ยน THEMES_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว
//   → ทุกหน้ากลับเป็นสีม่วงเข้มเดิมของ Warmly 100% (ค่าสีเดิมฝังเป็นค่าสำรองในโค้ดอยู่แล้ว)
export const THEMES_ENABLED = true;

// ปิดเฉพาะ "การซื้อธีม" ชั่วคราว (ธีมที่ซื้อไว้แล้วและธีมฟรียังใช้ได้ตามปกติ)
//   false → ปุ่มซื้อในร้านธีมจะถูกปิด แสดงข้อความ "ปิดร้านธีมชั่วคราว"
export const THEME_SHOP_ENABLED = true;

// ซื้อผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์ (api/theme-buy.js) หรือไม่
// false = ซื้อผ่าน Firestore transaction จากแอปโดยตรง (เหมือนระบบกระเป๋าเดิมและ Voice Aura)
// true  = เรียก /api/theme-buy (ต้องตั้งค่า Firebase Admin + ล็อกกฎ Firestore ก่อน — ดู THEMES.md)
export const THEME_SERVER_PURCHASE = false;
