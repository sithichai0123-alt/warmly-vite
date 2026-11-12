// สวิตช์ปิด/เปิดฟีเจอร์ "ลบข้อความแชทส่วนตัว" (ลบให้หายทั้งสองฝั่ง)
// false = ไม่มีปุ่มลบใหม่ใด ๆ ในแชท (พฤติกรรมเดิมทั้งหมด)
export const CHAT_DELETE_ENABLED = true;

// ปลายทาง Backend (Vercel Serverless: /api/chat-delete.js)
export const ENDPOINT = "/api/chat-delete";

// การลบทุกอย่างทำผ่าน Backend เท่านั้น (ตามโจทย์)
// ถ้าเซิร์ฟเวอร์ยังไม่พร้อม ปุ่มจะแจ้ง "เซิร์ฟเวอร์ยังไม่พร้อม" และไม่ลบอะไร
// ตั้งเป็น true เฉพาะกรณีฉุกเฉินที่ยังไม่ได้ตั้ง Firebase Admin: จะลบจากฝั่งแอปตรง ๆ (ปลอดภัยน้อยกว่า)
export const CLIENT_FALLBACK = false;

export const REQUEST_TIMEOUT_MS = 20000;
