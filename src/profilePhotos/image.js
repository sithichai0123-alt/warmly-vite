// Profile Photos — ย่อ/บีบอัดรูปในเบราว์เซอร์ (canvas) แล้วคืน data URL
import { PHOTO_MAX_PX, PHOTO_MAX_CHARS, THUMB_PX } from "./config.js";
import { validateDecoded } from "./validate.js";

function loadImage(srcUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = srcUrl;
  });
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read"));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}
function draw(img, max, q, crop) {
  // crop = { sx, sy, size } (พิกเซลของรูปต้นฉบับ) → ผลลัพธ์เป็นสี่เหลี่ยมจัตุรัส
  const sw = crop ? crop.size : img.width, sh = crop ? crop.size : img.height;
  const sc = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); // PNG โปร่งใสไม่กลายเป็นดำเมื่อเป็น JPEG
  if (crop) g.drawImage(img, crop.sx, crop.sy, crop.size, crop.size, 0, 0, w, h);
  else g.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", q);
}

// ไฟล์ → { ok, src } | { ok:false, reason }   (ลดคุณภาพ/ขนาดทีละขั้นจนไม่เกิน PHOTO_MAX_CHARS)
export async function processFile(file, { maxPx = PHOTO_MAX_PX, maxChars = PHOTO_MAX_CHARS, crop = null } = {}) {
  let url;
  try { url = await readFile(file); } catch (e) { return { ok: false, reason: (file.name || "ไฟล์") + ": อ่านไฟล์ไม่ได้" }; }
  let img;
  try { img = await loadImage(url); } catch (e) { return { ok: false, reason: (file.name || "ไฟล์") + ": เปิดรูปไม่ได้ (ไฟล์อาจเสียหาย หรือเบราว์เซอร์ไม่รองรับรูปแบบนี้)" }; }
  const v = validateDecoded(img.naturalWidth || img.width, img.naturalHeight || img.height, file.name || "ไฟล์");
  if (!v.ok) return v;
  let px = maxPx;
  for (let round = 0; round < 4; round++) {
    for (let q = 0.82; q >= 0.4; q -= 0.14) {
      const out = draw(img, px, q, crop);
      if (out.length <= maxChars) return { ok: true, src: out };
    }
    px = Math.round(px * 0.8);
  }
  return { ok: false, reason: (file.name || "ไฟล์") + ": บีบอัดให้เล็กพอไม่ได้ ลองรูปอื่น" };
}

// รูปที่เก็บแล้ว (data URL) → รูปเล็กสำหรับ avatar ทั่วแอป
export async function makeThumb(src, px = THUMB_PX) {
  const img = await loadImage(src);
  return draw(img, px, 0.72);
}
