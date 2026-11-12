// Feed Video — ตัดความยาวด้วยลิงก์ Cloudinary (transformation ตอนส่งวิดีโอ ไม่ต้องประมวลผลในเครื่อง/ไม่มีเซิร์ฟเวอร์เพิ่ม)
import { MAX_VIDEO_SECONDS } from "./config.js";

const SEG = n => "so_0,eo_" + n;
const CLD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.*)$/;
const SEG_RE = /(^|\/)so_0,eo_\d+(\/|$)/;

export const isCloudinaryVideo = u => typeof u === "string" && CLD.test(u);
export const isTrimmed = u => isCloudinaryVideo(u) && SEG_RE.test(u.match(CLD)[2]);

// ใส่ตัวตัด so_0,eo_30 (เริ่ม 0 จบ 30 วินาที) — ไม่ใช่ลิงก์ Cloudinary หรือตัดไว้แล้ว = คืนค่าเดิม
export function trimVideoUrl(u, secs = MAX_VIDEO_SECONDS) {
  const m = typeof u === "string" && u.match(CLD);
  if (!m || SEG_RE.test(m[2])) return u;
  return m[1] + SEG(Math.max(1, Math.floor(secs))) + "/" + m[2];
}

// ลิงก์ต้นฉบับก่อนตัด (ใช้เป็นตัวสำรองถ้า Cloudinary ปฏิเสธการตัด)
export function originalVideoUrl(u) {
  const m = typeof u === "string" && u.match(CLD);
  if (!m) return u;
  const rest = m[2].replace(/^so_0,eo_\d+\//, "").replace(/\/so_0,eo_\d+(?=\/)/, "");
  return m[1] + rest;
}

// ความยาวที่อ่านได้ → ต้องตัดไหม (อ่านความยาวไม่ได้ = ตัดไว้ก่อนเพื่อความปลอดภัย)
export const needsTrim = d => !Number.isFinite(d) || d > MAX_VIDEO_SECONDS;
