// ตรรกะล้วน ๆ ของการลบข้อความ — ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์ (server.js) และฝั่งแอป (api.js/fallback.js)
// ไม่มี import ใด ๆ (ทดสอบด้วย Node ได้ตรง ๆ)

export const MAX_BATCH = 400;   // ลบต่อ batch (Firestore จำกัด 500)
export const MAX_ROUNDS = 50;   // กันลูปไม่จบ (สูงสุด ~20,000 ข้อความต่อคำสั่ง)

export function pairIdOf(a, b) { return [a, b].sort().join("_"); }

export function validPeer(uid, peer) {
  return typeof peer === "string" && peer.length > 0 && peer.length <= 128 && !/[\/\s]/.test(peer) && peer !== uid && peer !== "." && peer !== "..";
}

export function validMsgId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 128 && !/[\/\s]/.test(id) && !id.startsWith("tmp-") && id !== "." && id !== "..";
}

export function previewOf(m) {
  if (m.gift) return "🎁 ของขวัญ";
  if (m.text) return String(m.text).slice(0, 80);
  if (m.image) return "📷 รูปภาพ";
  return "";
}

