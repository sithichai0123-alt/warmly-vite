// Room Stage — ตรรกะล้วน (ไม่แตะ Firebase/DOM/React) · ข้อมูลห้อง: members[{uid,init,name,mic,stage?,hand?}] + cohosts[uid]
//   stage: true = บนเวที · false = ผู้ฟัง · ไม่มี (ห้องเก่า) = ขอขึ้นเวทีตามลำดับจนเต็ม
//   mic:   false = ถูกเจ้าของ/รองปิดไมค์ (ความหมายเดิม)
//   hand:  เวลาที่ยกมือขอพูด (ผู้ฟัง)
import { STAGE_MAX, COHOST_MAX } from "./config.js";

export const keyOf = m => (m && (m.uid || m.init)) || "";
export const isHostOf = (room, m) => !!room && !!m && (room.hostUid ? m.uid === room.hostUid : m.init === room.hostInit);
export const cohostsOf = room => (Array.isArray(room && room.cohosts) ? room.cohosts.filter(x => typeof x === "string" && x) : []).slice(0, COHOST_MAX);
const membersOf = room => (Array.isArray(room && room.members) ? room.members : []);

export function roleOf(room, m) {
  if (!m) return "none";
  if (isHostOf(room, m)) return "host";
  if (m.uid && cohostsOf(room).includes(m.uid)) return "cohost";
  return "member";
}

// แบ่งคนในห้องเป็น ผู้พูด / ผู้ฟัง / คำขอ — เจ้าของห้องได้ที่นั่งแรกเสมอ · เกินจำนวนที่นั่ง = เป็นผู้ฟัง
export function stageView(room, max = STAGE_MAX) {
  const members = membersOf(room);
  const host = members.find(m => isHostOf(room, m)) || null;
  const speakers = host ? [host] : [], audience = [];
  for (const m of members) {
    if (m === host) continue;
    const wants = m.stage === undefined ? true : !!m.stage;
    if (wants && speakers.length < max) speakers.push(m); else audience.push(m);
  }
  const requests = audience.filter(m => typeof m.hand === "number").sort((a, b) => a.hand - b.hand);
  return { speakers, audience, requests, free: Math.max(0, max - speakers.length), max };
}
export const isOnStage = (room, m, max = STAGE_MAX) => !!m && stageView(room, max).speakers.some(s => keyOf(s) === keyOf(m));

// ใครจัดการใครได้ (ปิดไมค์ · ให้ลง/เชิญขึ้นเวที · เตะ): เจ้าของห้อง = ทุกคน · รอง = เฉพาะสมาชิกทั่วไป · ทำกับตัวเองไม่ได้
export function canModerate(room, actor, target) {
  if (!actor || !target || keyOf(actor) === keyOf(target)) return false;
  const a = roleOf(room, actor), t = roleOf(room, target);
  if (a === "host") return true;
  if (a === "cohost") return t === "member";
  return false;
}
export const canManageCohosts = (room, actor) => roleOf(room, actor) === "host";

const without = (o, k) => { const c = { ...o }; delete c[k]; return c; };
const patchMember = (room, key, fn) => membersOf(room).map(m => (keyOf(m) === key ? fn(m) : m));

// เข้าห้อง: เวทีว่าง (หรือเป็นเจ้าของห้อง) = ขึ้นเวทีเลย · เต็ม = เป็นผู้ฟัง
export function joinEntry(room, me, max = STAGE_MAX) {
  const isHost = isHostOf(room, me);
  const onStage = isHost || stageView(room, max).free > 0;
  return { entry: { uid: me.uid, init: me.init, name: me.name, mic: true, stage: onStage }, onStage };
}

// ขึ้นเวที: ต้องมีที่ว่าง · byModerator = เจ้าของ/รองเชิญหรืออนุมัติ (อนุญาตไมค์ด้วย) · ขึ้นเองยังคงสถานะถูกปิดไมค์ไว้เหมือนเดิม
export function takeSeat(room, key, { byModerator = false, max = STAGE_MAX } = {}) {
  const v = stageView(room, max);
  if (v.speakers.some(s => keyOf(s) === key)) return { ok: true, members: membersOf(room), already: true };
  if (v.free <= 0) return { ok: false, reason: "full" };
  return { ok: true, members: patchMember(room, key, m => ({ ...without(m, "hand"), stage: true, mic: byModerator ? true : m.mic !== false })) };
}
// ลงจากเวที (ลงเอง หรือถูกให้ลง) — เจ้าของห้องลงไม่ได้
export function leaveSeat(room, key) {
  const m = membersOf(room).find(x => keyOf(x) === key);
  if (!m || isHostOf(room, m)) return { ok: false, reason: "host" };
  return { ok: true, members: patchMember(room, key, x => ({ ...without(x, "hand"), stage: false })) };
}
// ยกมือ / เอามือลง / ปฏิเสธคำขอ
export function setHand(room, key, on, now = Date.now()) {
  return membersOf(room).map(m => (keyOf(m) === key ? (on ? { ...m, hand: now } : without(m, "hand")) : m));
}
// ปิด/อนุญาตไมค์ (ความหมายเดิม)
export const setMicAllowed = (room, key, allowed) => patchMember(room, key, m => ({ ...m, mic: !!allowed }));

// ตั้ง/ถอดรอง (เฉพาะเจ้าของห้อง) — ไม่เกิน COHOST_MAX
export function setCohost(room, uid, on) {
  const cur = cohostsOf(room).filter(x => x !== uid);
  if (!on) return { ok: true, cohosts: cur };
  if (!uid || room.hostUid === uid) return { ok: false, reason: "host" };
  if (cur.length >= COHOST_MAX) return { ok: false, reason: "full" };
  return { ok: true, cohosts: [...cur, uid] };
}
