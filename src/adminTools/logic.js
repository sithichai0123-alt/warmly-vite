// Admin Tools — ตรรกะล้วน (ไม่แตะ Firebase) ใช้เฉพาะฝั่งเซิร์ฟเวอร์ (api/admin-delete-user.js)

// uid ที่ยอมรับ: ตัวอักษร/ตัวเลข 6–64 ตัว (Firebase uid 28 ตัว · รหัสผู้เยี่ยมชมเดิม 16 ตัว)
// ห้ามมี "_" หรือ "/" เพราะรหัสห้องแชทคือ uidA_uidB และกันการแทรก path
export const validUid = uid => typeof uid === "string" && /^[A-Za-z0-9]{6,64}$/.test(uid);

// ค่าที่ตั้งใน Vercel คั่นด้วย comma หรือเว้นวรรคได้ · uid แยกตัวพิมพ์เล็กใหญ่ · อีเมลไม่แยก
const split = s => String(s || "").split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
export const parseUids = s => split(s);
export const parseEmails = s => split(s).map(x => x.toLowerCase());

// ตั้งค่าแล้วหรือยัง (ไม่ตั้ง = ไม่มีใครเป็นแอดมิน ปฏิเสธทุกคน)
export const isConfigured = cfg => !!cfg && ((cfg.uids || []).length + (cfg.emails || []).length) > 0;

// เป็นแอดมินไหม: ผู้เยี่ยมชม (นิรนาม) ไม่มีทางเป็น · ต้องตรง uid หรืออีเมลที่ยืนยันแล้วเท่านั้น
export function isAdmin(decoded, cfg) {
  if (!decoded || !decoded.uid || !isConfigured(cfg)) return false;
  if (decoded.firebase && decoded.firebase.sign_in_provider === "anonymous") return false;
  if ((cfg.uids || []).includes(decoded.uid)) return true;
  return !!(decoded.email && decoded.email_verified === true && (cfg.emails || []).includes(String(decoded.email).toLowerCase()));
}

// เป้าหมายที่จะลบเป็นแอดมินหรือเปล่า (ใช้กันลบตัวเอง/แอดมินคนอื่น) — รู้แค่ uid และอีเมลจากบัญชีล็อกอิน
export function targetIsAdmin(uid, email, cfg) {
  if (!isConfigured(cfg)) return false;
  if ((cfg.uids || []).includes(uid)) return true;
  return !!(email && (cfg.emails || []).includes(String(email).toLowerCase()));
}

// คำยืนยันที่ต้องพิมพ์ = 6 ตัวท้ายของ uid
export const confirmWord = uid => String(uid || "").slice(-6);

// ── วิดีโอบน Cloudinary ──
// ลิงก์ที่แอปเก็บ:  https://res.cloudinary.com/<cloud>/video/upload/[so_0,eo_30/][v123/]<public_id>.<ext>
// คืน public_id (ไม่มีนามสกุล) เฉพาะลิงก์ของบัญชี Cloudinary ของแอปเท่านั้น · นอกนั้น = null (จะไม่ถูกลบ)
export function cloudinaryPublicId(url, cloud) {
  if (typeof url !== "string" || !cloud) return null;
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/video\/upload\/([^?#]+)(?:[?#].*)?$/.exec(url);
  if (!m || m[1] !== cloud) return null;
  let seg = m[2].split("/").filter(Boolean);
  const v = seg.findIndex(s => /^v\d+$/.test(s));
  if (v >= 0) seg = seg.slice(v + 1);                                          // ตัดตัวแปลง (transformation) + เลขเวอร์ชันทิ้ง
  else while (seg.length > 1 && (seg[0].includes(",") || /^[a-z]{1,4}_[^/]*$/.test(seg[0]))) seg.shift(); // ไม่มีเลขเวอร์ชัน
  if (!seg.length) return null;
  let id;
  try { id = seg.map(decodeURIComponent).join("/"); } catch (e) { return null; }
  id = id.replace(/\.[A-Za-z0-9]{2,5}$/, "");                                   // ตัดนามสกุลไฟล์
  if (!id || id.split("/").some(p => p === ".." || p === "." || p === "")) return null;
  return id;
}

// เก็บลิงก์วิดีโอจากโพสต์ (ฟิลด์ images) — ไม่ซ้ำกัน · รูปที่เป็น data: และลิงก์ของที่อื่นถูกข้าม
export function collectVideos(posts, cloud) {
  const seen = new Map();
  for (const p of posts || []) {
    for (const u of (Array.isArray(p.images) ? p.images : [])) {
      const id = cloudinaryPublicId(u, cloud);
      if (id && !seen.has(id)) seen.set(id, { url: u, publicId: id });
    }
  }
  return [...seen.values()];
}
