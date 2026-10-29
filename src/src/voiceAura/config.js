// Voice Aura — ค่าตั้งต้นของระบบ (ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิดทั้งระบบ)
//
// ปิดทั้งระบบ: เปลี่ยน VOICE_AURA_ENABLED เป็น false แล้วอัปโหลดใหม่
//   → ห้องเสียงกลับเป็นวงเขียว + คลื่นไมค์แบบเดิม 100% (ไม่ต้องแก้ไฟล์อื่น)
export const VOICE_AURA_ENABLED = true;

// เวลาค่อย ๆ จางหายหลังหยุดพูด (มิลลิวินาที)
export const AURA_FADE_MS = 700;

// ห้องที่มีสมาชิกมากกว่านี้ จะใช้เอฟเฟกต์แบบเบา (ไม่มีอนุภาค) เพื่อไม่ให้เครื่องหนัก
export const AURA_LITE_ROOM_SIZE = 8;

// ซื้อผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์ (api/aura-buy.js) หรือไม่
// false = ซื้อผ่าน Firestore transaction จากแอปโดยตรง (เหมือนระบบกระเป๋าเดิม)
// true  = เรียก /api/aura-buy (ต้องตั้งค่า Firebase Admin + ล็อกกฎ Firestore ก่อน — ดู VOICE-AURA.md)
export const AURA_SERVER_PURCHASE = false;
