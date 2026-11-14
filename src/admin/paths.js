// Admin — ตัวช่วยล้วน (ไม่แตะ Firebase/DOM) สำหรับบอกว่า "รูปนี้อยู่ตรงไหนในฐานข้อมูล"
// หน้าแอดมินนี้อ่านอย่างเดียว ไม่ลบอะไรทั้งสิ้น — ใช้บอกเส้นทางให้ไปลบเองใน Firebase Console

// รูปเก็บเป็นข้อความ base64 ในเอกสารโดยตรง ยกเว้นวิดีโอที่อยู่บน Cloudinary (ลบเอกสารไม่ได้ลบไฟล์)
export function srcKind(src) {
  if (typeof src !== "string" || !src) return "none";
  if (src.startsWith("data:image/")) return "image";
  if (src.startsWith("data:video/")) return "video";
  if (/^https?:\/\//.test(src)) return /\.(mp4|webm|mov)(\?|$)/i.test(src) || /\/video\//.test(src) ? "video-url" : "image-url";
  return "other";
}
export const isVideo = k => k === "video" || k === "video-url";

// ขนาดโดยประมาณของ base64 (ไบต์จริง ≈ 3/4 ของจำนวนตัวอักษรหลังเครื่องหมายจุลภาค)
export function srcBytes(src) {
  if (typeof src !== "string") return 0;
  const i = src.indexOf(",");
  if (src.startsWith("data:") && i > 0) return Math.round((src.length - i - 1) * 0.75);
  return src.length;
}
export function fmtBytes(n) {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

// เส้นทางที่ต้องไปลบใน Firebase Console
//   doc   = เอกสาร เช่น profilePhotos/abc123
//   field = ฟิลด์ในเอกสาร เช่น photos[2]
//   how   = วิธีลบแบบสั้นๆ
export function locate(kind, o = {}) {
  switch (kind) {
    case "avatar":
      return { doc: "users/" + o.uid, field: "avatar", how: "ลบฟิลด์ avatar (รูปโปรไฟล์เล็กที่เห็นทั่วแอป)" };
    case "cover":
      return { doc: "covers/" + o.uid, field: "cover", how: "ลบทั้งเอกสาร covers/" + o.uid + " หรือลบเฉพาะฟิลด์ cover" };
    case "photo":
      return { doc: "profilePhotos/" + o.uid, field: "photos[" + o.index + "]", how: "เปิดเอกสารแล้วลบสมาชิกลำดับที่ " + o.index + " ออกจากอาร์เรย์ photos" + (o.isMain ? " (รูปนี้เป็นรูปหลัก ลบแล้วระบบจะเลือกรูปแรกที่เหลือแทนให้เอง แต่ users/" + o.uid + ".avatar ไม่เปลี่ยนตาม ต้องลบเองด้วย)" : "") };
    case "post":
      return { doc: "posts/" + o.id, field: "images[" + o.index + "]", how: "ลบทั้งโพสต์ได้เลย หรือถ้าจะลบเฉพาะรูป ต้องลบสมาชิกลำดับที่ " + o.index + " ทั้งใน images และ mediaTypes ให้ตรงกัน" };
    case "groupChat":
      return { doc: "groupChat/" + o.id, field: "image", how: "ลบทั้งข้อความได้เลย หรือลบเฉพาะฟิลด์ image" };
    default:
      return { doc: "?", field: "?", how: "" };
  }
}

// รวมรูปทั้งหมดของผู้ใช้หนึ่งคนเป็นรายการเดียว (รูปหลักขึ้นก่อน)
export function userImages({ uid, userDoc, photosDoc, coverDoc }) {
  const out = [];
  const u = userDoc || {}, p = photosDoc || {}, c = coverDoc || {};
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const mainId = p.mainId || null;
  photos.forEach((ph, i) => {
    if (!ph || typeof ph.src !== "string") return;
    out.push({ key: "photo:" + uid + ":" + i, label: "รูปโปรไฟล์" + (ph.id === mainId ? " (รูปหลัก ⭐)" : ""), src: ph.src, t: ph.t || 0, ...locate("photo", { uid, index: i, isMain: ph.id === mainId }) });
  });
  if (typeof c.cover === "string" && c.cover) out.push({ key: "cover:" + uid, label: "รูปปก", src: c.cover, t: 0, ...locate("cover", { uid }) });
  if (typeof u.avatar === "string" && u.avatar) out.push({ key: "avatar:" + uid, label: "รูปโปรไฟล์เล็ก (avatar)", src: u.avatar, t: 0, ...locate("avatar", { uid }) });
  return out;
}

// รูปจากโพสต์ (โพสต์เดียวอาจมีหลายรูป)
export function postImages(post) {
  const imgs = Array.isArray(post.images) ? post.images : [];
  const types = Array.isArray(post.mediaTypes) ? post.mediaTypes : [];
  return imgs.map((src, i) => typeof src === "string" && src ? {
    key: "post:" + post.id + ":" + i,
    label: (types[i] === "video" || isVideo(srcKind(src)) ? "วิดีโอ" : "รูป") + "ในโพสต์",
    src, t: post.createdAt && post.createdAt.toMillis ? post.createdAt.toMillis() : 0,
    ...locate("post", { id: post.id, index: i }),
  } : null).filter(Boolean);
}
