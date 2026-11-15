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
