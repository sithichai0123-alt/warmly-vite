// Profile Photos — ตรรกะรายการรูป/รูปหลัก (ฟังก์ชันล้วน ไม่แตะ Firebase/DOM)
//   state = { photos: [{ id, src, t }], mainId }   รูปแรกที่เพิ่มจะเป็นรูปหลักอัตโนมัติ
import { MAX_PHOTOS, DOC_MAX_CHARS } from "./config.js";

export const emptyState = () => ({ photos: [], mainId: null });
const okSrc = s => typeof s === "string" && /^(data:image\/|https:\/\/)/.test(s);

// เอกสารจากฐานข้อมูล (อาจผิดรูปแบบ) → state ที่ปลอดภัย
export function normalize(d) {
  const out = emptyState();
  if (!d || typeof d !== "object" || !Array.isArray(d.photos)) return out;
  const seen = new Set();
  for (const p of d.photos) {
    if (out.photos.length >= MAX_PHOTOS) break;
    if (!p || typeof p.id !== "string" || !okSrc(p.src) || seen.has(p.id)) continue;
    seen.add(p.id); out.photos.push({ id: p.id, src: p.src, t: typeof p.t === "number" ? p.t : 0 });
  }
  out.mainId = out.photos.some(p => p.id === d.mainId) ? d.mainId : (out.photos[0] ? out.photos[0].id : null);
  return out;
}

export const mainOf = s => (s.photos.find(p => p.id === s.mainId) || null);
export const totalChars = s => s.photos.reduce((n, p) => n + p.src.length, 0);
// รูปหลักขึ้นก่อน ที่เหลือเรียงตามที่เพิ่ม
export const ordered = s => { const m = mainOf(s); return m ? [m, ...s.photos.filter(p => p.id !== m.id)] : s.photos.slice(); };

export function newId() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function planAdd(s, photo) {
  if (!photo || !okSrc(photo.src)) return { ok: false, reason: "รูปไม่ถูกต้อง", state: s };
  if (s.photos.length >= MAX_PHOTOS) return { ok: false, reason: "มีรูปได้สูงสุด " + MAX_PHOTOS + " รูป — ลบรูปเดิมก่อนเพิ่มใหม่", state: s };
  if (totalChars(s) + photo.src.length > DOC_MAX_CHARS) return { ok: false, reason: "พื้นที่เก็บรูปเต็ม — ลบรูปเดิมบางรูปก่อน", state: s };
  const p = { id: photo.id || newId(), src: photo.src, t: photo.t || Date.now() };
  if (s.photos.some(x => x.id === p.id)) p.id = newId();
  const photos = [...s.photos, p];
  return { ok: true, state: { photos, mainId: s.mainId && s.photos.some(x => x.id === s.mainId) ? s.mainId : p.id }, added: p };
}

export function planRemove(s, id) {
  if (!s.photos.some(p => p.id === id)) return s;
  const photos = s.photos.filter(p => p.id !== id);
  const mainId = s.mainId === id ? (photos[0] ? photos[0].id : null) : s.mainId;
  return { photos, mainId };
}

export function planSetMain(s, id) {
  if (!s.photos.some(p => p.id === id) || s.mainId === id) return s;
  return { photos: s.photos, mainId: id };
}
