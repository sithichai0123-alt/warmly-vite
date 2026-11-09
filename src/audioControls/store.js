// Audio Controls — ค่าที่ผู้ใช้ตั้ง (เก็บในเครื่องนี้) ใช้ร่วมกันระหว่างแผงควบคุม, ตัวคุมไมค์ และตัวเล่นเพลง
//   mic   = ระดับเสียงไมค์ของตัวเอง 0..MIC_GAIN_MAX (ค่าเริ่มต้น 1 = ไม่แตะสตรีมไมค์เลย)
//   music = ระดับเสียงเพลง 0..100, musicMuted = ปิดเสียงเพลงเฉพาะเครื่องนี้
// ทั้งหมดมีผลเฉพาะสิ่งที่ "เรา" ได้ยิน/ส่ง — ไม่กระทบเสียงพูดของคนอื่น
import { useSyncExternalStore } from "react";
import { MIC_GAIN_MAX } from "./config.js";

const KEY = "wm_audioPrefs";
const DEFAULTS = { mic: 1, music: 100, musicMuted: false };
let state = { ...DEFAULTS };
const listeners = new Set();
let loaded = false;

const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function sanitize(o) {
  const x = o && typeof o === "object" ? o : {};
  return { mic: clamp(x.mic, 0, MIC_GAIN_MAX, 1), music: clamp(x.music, 0, 100, 100), musicMuted: x.musicMuted === true };
}
function load() {
  if (loaded) return; loaded = true;
  try { const raw = window.localStorage.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); } catch (e) { /* ใช้ค่าเริ่มต้น */ }
}
function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
function set(patch) {
  load();
  const next = sanitize({ ...state, ...patch });
  if (next.mic === state.mic && next.music === state.music && next.musicMuted === state.musicMuted) return;
  state = next; save(); listeners.forEach(f => f());
}
export function getAudioPrefs() { load(); return state; }
export function setMicGain(v) { set({ mic: v }); }
export function setMusicVolume(v) { set({ music: v }); }
export function setMusicMuted(m) { set({ musicMuted: !!m }); }
export function subscribeAudioPrefs(f) { listeners.add(f); return () => listeners.delete(f); }
export function useAudioPrefs() { return useSyncExternalStore(subscribeAudioPrefs, getAudioPrefs, () => DEFAULTS); }
// สำหรับทดสอบ
export function _resetAudioPrefs() { loaded = false; state = { ...DEFAULTS }; listeners.clear(); }

// สถานะการปรับเสียงไมค์ (ตัวคุมไมค์เขียน แผงควบคุมอ่าน): "idle" | "ok" | "unsupported"
let micStatus = "idle";
const sl = new Set();
export function _micStatus() { return micStatus; }
export function setMicStatus(s) { if (s !== micStatus) { micStatus = s; sl.forEach(f => f()); } }
export function useMicStatus() { return useSyncExternalStore(f => { sl.add(f); return () => sl.delete(f); }, () => micStatus, () => "idle"); }
