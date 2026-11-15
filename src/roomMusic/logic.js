// Room Music — ตรรกะล้วน (ไม่แตะ DOM/React/YouTube) จึงทดสอบได้ง่าย

// สถานะตัวเล่น YouTube (ตามเอกสาร IFrame Player API)
export const YT = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

const ORIGINS = new Set(["https://www.youtube.com", "https://youtube.com", "https://m.youtube.com", "https://www.youtube-nocookie.com"]);
export const isYtOrigin = o => ORIGINS.has(String(o || ""));

// ห้องเล่นไปแล้วกี่วินาที (นับจากเวลาที่ Host กดเล่น) · ไม่รู้เวลาเริ่ม = null
export function liveSeconds(startedAt, now) {
  const s = Number(startedAt);
  if (!Number.isFinite(s) || s <= 0) return null;
  return Math.max(0, Math.floor((now - s) / 1000));
}

// อ่านข้อความที่ตัวเล่น YouTube ส่งกลับมา (postMessage) → { state?, time?, duration?, ready? } หรือ null
export function parseYtMessage(data) {
  let d = data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { return null; } }
  if (!d || typeof d !== "object" || typeof d.event !== "string") return null;
  const out = {};
  if (d.event === "onStateChange") {
    if (typeof d.info !== "number") return null;
    out.state = d.info;
  } else if (d.event === "infoDelivery" || d.event === "initialDelivery") {
    const i = d.info;
    if (!i || typeof i !== "object") return null;
    if (typeof i.playerState === "number") out.state = i.playerState;
    if (typeof i.currentTime === "number") out.time = i.currentTime;
    if (typeof i.duration === "number" && i.duration > 0) out.duration = i.duration;
  } else if (d.event === "onReady") {
    out.ready = true;
  } else return null;
  return out;
}

// จำว่า "ตอนออกจากแอป เพลงกำลังเล่นอยู่ไหม" เพื่อแยก "ระบบสั่งหยุด" ออกจาก "ผู้ใช้กดหยุดเอง"
//   ข้อความหยุดจาก YouTube อาจมาถึงก่อนเหตุการณ์ซ่อนหน้าเล็กน้อย จึงนับการหยุดที่เพิ่งเกิด (≤ nearHideMs) ว่าระบบหยุด
export function createPlayTracker({ nearHideMs = 1500 } = {}) {
  let state = YT.UNSTARTED, prev = YT.UNSTARTED, stateAt = 0, playingAtHide = false, duration = 0;
  return {
    get state() { return state; },
    get duration() { return duration; },
    // กำลังเล่น (รวมช่วงโหลดสั้น ๆ ระหว่างเล่น)
    get playing() { return state === YT.PLAYING || (state === YT.BUFFERING && prev === YT.PLAYING); },
    onState(s, now) { if (s === state) return; prev = state; state = s; stateAt = now; },
    onDuration(d) { if (d > 0) duration = d; },
    onHide(now) {
      const justStopped = (state === YT.PAUSED || state === YT.BUFFERING) && prev === YT.PLAYING && now - stateAt <= nearHideMs;
      playingAtHide = state === YT.PLAYING || (state === YT.BUFFERING && prev === YT.PLAYING) || justStopped;
    },
    takeShow() { const v = playingAtHide; playingAtHide = false; return v; },
    reset() { state = YT.UNSTARTED; prev = YT.UNSTARTED; stateAt = 0; playingAtHide = false; duration = 0; },
  };
}

// กลับมาที่แอปแล้วควรทำอะไร
//   none   = ไม่ต้องทำ (ไม่ได้เล่นอยู่ตอนออก / ยังเล่นอยู่ / เพลงจบแล้ว / ผู้ใช้กดหยุดเอง)
//   ended  = เพลงของห้องน่าจะจบไปแล้วระหว่างที่ไม่อยู่ (ไม่สั่งเล่นซ้ำ)
//   resume = สั่งเล่นต่อ ที่วินาที at (null = ไม่รู้เวลาห้อง → เล่นต่อจากเดิม)
export function planReturn({ playingAtHide, state, startedAt, now, duration = 0 }) {
  if (!playingAtHide || state === YT.PLAYING || state === YT.ENDED) return { action: "none" };
  const at = liveSeconds(startedAt, now);
  if (at != null && duration > 0 && at >= duration - 1) return { action: "ended" };
  return { action: "resume", at };
}

// กันจอดับเมื่อ: ผู้ใช้เปิดตัวเลือกไว้ + เพลงกำลังเล่น + หน้าแอปแสดงอยู่ (ระบบปล่อยล็อกเองเมื่อซ่อนหน้า)
export const shouldHoldWake = ({ pref, playing, visible }) => !!pref && !!playing && !!visible;

// ค่าในเครื่อง: ไม่เคยตั้ง = เปิด
export const parseWakePref = raw => !(raw === "0" || raw === "false");
