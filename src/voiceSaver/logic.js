// Voice Saver — ตรรกะล้วน (ไม่แตะ Firebase/LiveKit/React) เพื่อทดสอบได้ตรง ๆ

// เวลาเป็นมิลลิวินาที: รองรับ Timestamp ของ Firestore / Date / ตัวเลข / ไม่มี
export const tsMs = t => {
  if (t == null) return 0;
  if (typeof t === "number") return Number.isFinite(t) ? t : 0;
  if (typeof t.toMillis === "function") { try { return t.toMillis(); } catch (e) { return 0; } }
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return 0;
};

// "ผู้ฟังล้วน": มีระบบเวที และเราไม่ได้อยู่บนเวที และไม่ใช่เจ้าของห้อง (คนบนเวที/เจ้าของห้องไม่ถูกพักเสียง)
export const isPureListener = ({ stageOn, onStage, isHost }) => !!stageOn && !onStage && !isHost;

// มีคน "กำลังพูด" ในห้องไหม — ใช้สัญญาณผู้พูด (ActiveSpeakers) ของ LiveKit เท่านั้น
//   ไม่ใช้ "เปิดไมค์ค้าง" เพราะเจ้าของห้องมักเปิดไมค์ไว้ตลอดแม้ไม่ได้พูด → จะไม่มีวันพักเลย
export function hasVoiceActivity(speaking) {
  for (const k in (speaking || {})) if (speaking[k]) return true;
  return false;
}

// ควรพักเสียงไหม (เฉพาะตอนเชื่อมต่ออยู่ เป็นผู้ฟัง และเงียบมานานพอ)
export const shouldPause = ({ enabled, connected, listener, lastActiveAt, now, quietMs }) =>
  !!enabled && !!connected && !!listener && (now - lastActiveAt) >= quietMs;

// ตอนพักอยู่ ควรกลับเข้าเสียงไหม — มีการประทับเวลา "มีคนพูด" ใหม่กว่าตอนที่เริ่มพัก (เผื่อนาฬิกาต่างกัน)
export const shouldResume = ({ paused, roomVoiceAtMs, pausedAt, graceMs = 0 }) =>
  !!paused && roomVoiceAtMs > (pausedAt - graceMs);

// เจ้าของห้องควรประทับเวลาลงห้องไหม — มีคนพูด และค่าที่มีอยู่เก่ากว่า throttle (กันเขียนถี่)
export const shouldStamp = ({ isHost, connected, activity, roomVoiceAtMs, now, throttleMs }) =>
  !!isHost && !!connected && !!activity && (now - roomVoiceAtMs) >= throttleMs;
