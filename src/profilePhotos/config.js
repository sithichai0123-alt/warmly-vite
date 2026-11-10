// Profile Photos — รูปโปรไฟล์หลายรูป (สูงสุด 5) + เลือกรูปหลัก ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิด
//
// ปิดทั้งระบบ: เปลี่ยน PROFILE_PHOTOS_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว
//   → แตะรูปโปรไฟล์แล้วเปลี่ยนรูปเดี่ยวแบบเดิม ไม่มีแกลเลอรี (รูปที่เคยอัปไว้ไม่ถูกลบ)
export const PROFILE_PHOTOS_ENABLED = true;

export const MAX_PHOTOS = 5;                  // จำนวนรูปสูงสุดต่อคน
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // ไฟล์ต้นฉบับใหญ่สุดที่รับ (10 MB)
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MIN_SIDE_PX = 64;                // เล็กกว่านี้ถือว่าใช้ไม่ได้
export const PHOTO_MAX_PX = 720;              // ด้านยาวสุดของรูปที่เก็บ
export const THUMB_PX = 160;                  // รูปเล็กสำหรับ avatar ที่ทุกคนเห็นทั่วแอป (ขนาดเดียวกับเดิม)
export const PHOTO_MAX_CHARS = 150000;        // ขนาดต่อรูปหลังบีบอัด (ตัวอักษร base64 ≈ 110 KB)
export const DOC_MAX_CHARS = 850000;          // เพดานรวมต่อเอกสาร (Firestore จำกัด 1 MB)
export const COLLECTION = "profilePhotos";    // แยกจาก users เพื่อไม่ให้ทุกคนโหลดรูปทั้ง 5 ของทุกคนตลอดเวลา
