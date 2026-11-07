// Text FX — ตรวจว่าใครใช้อะไรได้ (ฟังก์ชันล้วน)
//   users/{uid}.textFx = { name, voiceName, roomName, bio, message }  (แต่ละจุดเป็นรหัสไอเทม หรือ ไม่มี = แบบเดิม)
//   users/{uid}.inventory มี "font:<id>" = เป็นเจ้าของไอเทมนั้น
import { TEXTFX_ENABLED } from "./config.js";
import { FX_BY_ID, FX_DEFAULT, fontItemId } from "./catalog.js";

export const TEXTFX_AREAS = ["name", "voiceName", "roomName", "bio", "message"];
export const AREA_LABEL = { name: "ชื่อโปรไฟล์", voiceName: "ชื่อในห้องเสียง", roomName: "ชื่อห้องเสียง", bio: "ข้อความแนะนำตัว", message: "ข้อความแชท" };

// ใช้ไอเทมนี้ได้ไหม: ของฟรี = ได้เสมอ, ของเสียเงิน = ต้องมี "font:<id>" ในคลัง
export function canUseFx(userDoc, id) {
  const t = FX_BY_ID[id];
  if (!t) return false;
  if (!t.price) return true;
  const inv = userDoc && Array.isArray(userDoc.inventory) ? userDoc.inventory : [];
  return inv.includes(fontItemId(id));
}

// รหัสไอเทมที่เจ้าของเลือกไว้ในจุดนั้นและใช้ได้จริง หรือ null = แบบเดิม (ไม่มีอะไรเปลี่ยน)
export function resolveTextFx(userDoc, area) {
  if (!TEXTFX_ENABLED || !userDoc || !userDoc.textFx || typeof userDoc.textFx !== "object") return null;
  const id = userDoc.textFx[area];
  if (!id || id === FX_DEFAULT || typeof id !== "string" || !FX_BY_ID[id]) return null;
  return canUseFx(userDoc, id) ? id : null;
}

// ข้อความรายข้อความ (แชท): doc ข้อความเก็บ fx = รหัสไอเทมที่ผู้ส่งเลือก — คนดูตรวจกับคลังไอเทมของ "ผู้ส่ง" อีกชั้น
// (ใครแก้ข้อมูลส่งมาเป็นไอเทมที่ไม่ได้ซื้อ → แสดงเป็นข้อความธรรมดา)
export function resolveMessageFx(senderDoc, id) {
  if (!TEXTFX_ENABLED || !id || typeof id !== "string" || id === FX_DEFAULT || !FX_BY_ID[id]) return null;
  return canUseFx(senderDoc, id) ? id : null;
}
