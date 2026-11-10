// Profile Photos — ตรวจไฟล์ก่อนอัปโหลด (ไม่แตะ DOM)
import { ALLOWED_TYPES, MAX_FILE_BYTES, MIN_SIDE_PX, MAX_PHOTOS } from "./config.js";

const EXT_OK = /\.(jpe?g|png|webp|gif)$/i;

// คืน { ok:true } หรือ { ok:false, reason:"ข้อความไทย" }
export function validateFile(file) {
  if (!file || typeof file !== "object") return { ok: false, reason: "ไม่พบไฟล์" };
  const name = file.name || "ไฟล์";
  if (!file.size) return { ok: false, reason: name + ": ไฟล์ว่างเปล่า" };
  const type = String(file.type || "").toLowerCase();
  const typeOk = ALLOWED_TYPES.includes(type) || (!type && EXT_OK.test(name));
  if (!typeOk) {
    if (/hei[cf]/i.test(type) || /\.hei[cf]$/i.test(name)) return { ok: false, reason: name + ": รูปแบบ HEIC ยังไม่รองรับ — ถ่าย/บันทึกเป็น JPG หรือ PNG ก่อน" };
    return { ok: false, reason: name + ": รองรับเฉพาะรูป JPG, PNG, WebP, GIF" };
  }
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: name + ": ไฟล์ใหญ่เกิน " + Math.round(MAX_FILE_BYTES / 1048576) + " MB" };
  return { ok: true };
}

export function validateDecoded(w, h, name = "ไฟล์") {
  if (!(w > 0 && h > 0)) return { ok: false, reason: name + ": เปิดรูปไม่ได้ (ไฟล์อาจเสียหาย)" };
  if (Math.min(w, h) < MIN_SIDE_PX) return { ok: false, reason: name + ": รูปเล็กเกินไป (อย่างน้อย " + MIN_SIDE_PX + " พิกเซล)" };
  return { ok: true };
}

export function validateCount(current, adding = 1) {
  if (current + adding > MAX_PHOTOS) return { ok: false, reason: "มีรูปได้สูงสุด " + MAX_PHOTOS + " รูป — ลบรูปเดิมก่อนเพิ่มใหม่" };
  return { ok: true };
}
