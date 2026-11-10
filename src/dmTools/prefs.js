// DM Tools — การตั้งค่าเสียงแจ้งเตือน (เก็บในเครื่องนี้)
//   soundOn = เปิด/ปิดเสียงทั้งหมด, tone = เสียงที่เลือก, volume 0..1, customSound = ไฟล์เสียงของฉัน (data URL),
//   mutedPeers = ปิดเสียงเฉพาะแชทกับบางคน
import { useSyncExternalStore } from "react";

const KEY = "wm_dmPrefs";
const DEFAULTS = { soundOn: true, tone: "pop", volume: 0.7, customSound: "", mutedPeers: {} };
let state = { ...DEFAULTS };
const listeners = new Set();
let loaded = false;

const TONE_IDS = ["pop", "bell", "chime", "knock", "soft", "custom"];
function sanitize(o) {
  const x = o && typeof o === "object" ? o : {};
  const v = Number(x.volume);
  const muted = {};
  if (x.mutedPeers && typeof x.mutedPeers === "object") for (const k of Object.keys(x.mutedPeers)) if (x.mutedPeers[k] === true) muted[k] = true;
  const custom = typeof x.customSound === "string" && x.customSound.startsWith("data:audio/") ? x.customSound : "";
  let tone = TONE_IDS.includes(x.tone) ? x.tone : "pop";
  if (tone === "custom" && !custom) tone = "pop";
  return { soundOn: x.soundOn !== false, tone, volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7, customSound: custom, mutedPeers: muted };
}
function load() { if (loaded) return; loaded = true; try { const raw = window.localStorage.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); } catch (e) { /* ค่าเริ่มต้น */ } }
function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
export function getDmPrefs() { load(); return state; }
export function setDmPrefs(patch) {
  load();
  const next = sanitize({ ...state, ...patch });
  if (JSON.stringify(next) === JSON.stringify(state)) return true;
  const prev = state; state = next;
  if (!save()) { state = prev; return false; } // เก็บไม่ได้ (พื้นที่เต็ม/โหมดส่วนตัว) → ไม่เปลี่ยนค่า และบอกผู้เรียก
  listeners.forEach(f => f()); return true;
}
export function setPeerMuted(uid, muted) { const m = { ...getDmPrefs().mutedPeers }; if (muted) m[uid] = true; else delete m[uid]; return setDmPrefs({ mutedPeers: m }); }
export function subscribeDmPrefs(f) { listeners.add(f); return () => listeners.delete(f); }
export function useDmPrefs() { return useSyncExternalStore(subscribeDmPrefs, getDmPrefs, () => DEFAULTS); }
export function _resetDmPrefs() { loaded = false; state = { ...DEFAULTS }; listeners.clear(); }

// แชทที่กำลังเปิดอยู่ (ChatPage เขียน, ตัวแจ้งเตือนอ่าน)
let activePair = null;
export function setActiveDm(id) { activePair = id || null; }
export function getActiveDm() { return activePair; }
