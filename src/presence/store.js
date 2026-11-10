// Presence — การตั้งค่าของผู้ใช้ (เก็บในเครื่อง + ซิงค์ไปที่ presence/{uid} เพื่อข้ามอุปกรณ์)
//   showOnline = แสดงสถานะออนไลน์ให้คนอื่นเห็น (false = โหมดซ่อน/Invisible)
//   showLast   = แสดงเวลาออนไลน์ล่าสุด
import { useSyncExternalStore } from "react";

const KEY = "wm_presencePrefs";
const DEFAULTS = { showOnline: true, showLast: true, explicit: false };
let state = { ...DEFAULTS };
const listeners = new Set();
let loaded = false;

function sanitize(o) {
  const x = o && typeof o === "object" ? o : {};
  return { showOnline: x.showOnline !== false, showLast: x.showLast !== false, explicit: x.explicit === true };
}
function load() {
  if (loaded) return; loaded = true;
  try { const raw = window.localStorage.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); } catch (e) { /* ใช้ค่าเริ่มต้น */ }
}
function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
function commit(next) {
  if (next.showOnline === state.showOnline && next.showLast === state.showLast && next.explicit === state.explicit) return false;
  state = next; save(); listeners.forEach(f => f()); return true;
}
export function getPresencePrefs() { load(); return state; }
// ผู้ใช้กดตั้งเอง → ถือเป็นค่าที่ตั้งใจ (explicit)
export function setPresencePrefs(patch) { load(); return commit(sanitize({ ...state, ...patch, explicit: true })); }
// รับค่าจากบัญชี (อุปกรณ์ใหม่) — ใช้เฉพาะเมื่อเครื่องนี้ยังไม่เคยตั้งเอง
export function adoptRemotePrefs(remote) {
  load();
  if (state.explicit || !remote || typeof remote !== "object") return false;
  if (typeof remote.hidden !== "boolean") return false;
  return commit({ showOnline: !remote.hidden, showLast: remote.lastPrefOff !== true, explicit: true });
}
export function subscribePresencePrefs(f) { listeners.add(f); return () => listeners.delete(f); }
export function usePresencePrefs() { return useSyncExternalStore(subscribePresencePrefs, getPresencePrefs, () => DEFAULTS); }
export function _resetPresencePrefs() { loaded = false; state = { ...DEFAULTS }; listeners.clear(); }
