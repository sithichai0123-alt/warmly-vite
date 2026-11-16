// Voice Token — ตัวออกโทเคนห้องเสียง (LiveKit) ที่ตรวจสิทธิ์ผู้ใช้ ก่อนหน้านี้ใครก็ขอโทเคนห้องไหนด้วยชื่อใครก็ได้ (ไม่ต้องล็อกอิน)
// ปิด/ย้อนกลับ: VOICE_TOKEN_AUTH_REQUIRED = false (แก้ไฟล์นี้) หรือตั้งตัวแปร Vercel VOICE_TOKEN_LEGACY=1 แล้ว Redeploy → กลับเป็นแบบเดิม 100%
export const VOICE_TOKEN_AUTH_REQUIRED = true;

export const TOKEN_TTL = "2h";                 // อายุโทเคนใหม่ (เดิม 10h) — ใช้ตอนเชื่อมต่อ/เชื่อมต่อใหม่เท่านั้น คนที่เชื่อมต่ออยู่แล้วไม่ถูกตัด
export const LEGACY_TOKEN_TTL = "10h";         // อายุโทเคนแบบเดิม (ใช้เมื่อย้อนกลับ)
export const RATE_WINDOW_MS = 10 * 60 * 1000;  // ช่วงนับจำนวนครั้ง
export const RATE_MAX = 60;                    // ขอโทเคนได้กี่ครั้งต่อคนต่อช่วง (เผื่อเน็ตหลุดแล้วต่อใหม่หลายรอบ)
export const RATE_COLLECTION = "tokenRate";    // ตัวนับ (เข้าถึงได้เฉพาะเซิร์ฟเวอร์ — กฎ Firestore ปิดจากฝั่งแอปอยู่แล้ว)
