// Background Audio — สถานะกลางเล็ก ๆ (ไม่ผูกกับ Firebase): ห้อง/สายที่ต้องดูแล + ค่าที่ผู้ใช้ตั้ง + สถานะปัจจุบัน
import { useSyncExternalStore } from "react";
import { PREF_KEY } from "./config.js";
import { parsePrefs } from "./logic.js";

const subs = new Set();
const emit = () => subs.forEach(f => f());
const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };

// ── เซสชัน (ห้องเสียงที่เราอยู่) ──
let sessions = [];
export function registerSession(s) {
  const item = { ...s };
  sessions = [...sessions.filter(x => x.id !== item.id), item]; emit();
  return () => { sessions = sessions.filter(x => x !== item); emit(); };
}
export const getSessions = () => sessions;
export const useSessions = () => useSyncExternalStore(subscribe, getSessions, getSessions);

// ── ค่าที่ผู้ใช้ตั้ง (เก็บในเครื่องนี้) ──
let prefs = null;
function loadPrefs() { try { return parsePrefs(localStorage.getItem(PREF_KEY)); } catch (e) { return { wake: false }; } }
export function getBgPrefs() { if (!prefs) prefs = loadPrefs(); return prefs; }
export function setBgPrefs(p) {
  prefs = { ...getBgPrefs(), ...p };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  emit();
}
export const useBgPrefs = () => useSyncExternalStore(subscribe, getBgPrefs, getBgPrefs);

// ── สถานะที่แผง 🌙 ใช้แสดงผล ──
let status = { keepAlive: false, mediaSession: false, wakeLock: false, lastResumeAt: 0, rejoins: 0 };
export function setBgStatus(p) { status = { ...status, ...p }; emit(); }
export const getBgStatus = () => status;
export const useBgStatus = () => useSyncExternalStore(subscribe, getBgStatus, getBgStatus);
