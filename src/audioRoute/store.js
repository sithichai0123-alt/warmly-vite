// Audio Route — ค่าที่ผู้ใช้เลือก ("auto" หรือรหัสอุปกรณ์) + สถานะอุปกรณ์ที่ตรวจเจอ (เก็บในเครื่อง)
import { useSyncExternalStore } from "react";

const KEY = "wm_audioOut";
let state = { pref: "auto", outputs: [], activeId: null, supported: false };
let loaded = false;
const subs = new Set();
function load() { if (loaded) return; loaded = true; try { const v = window.localStorage.getItem(KEY); if (v) state = { ...state, pref: v }; } catch (e) { /* ค่าเริ่มต้น */ } }
const emit = () => subs.forEach(f => f());
export function getRouteState() { load(); return state; }
export function setRoutePref(pref) { load(); state = { ...state, pref: pref || "auto" }; try { window.localStorage.setItem(KEY, state.pref); } catch (e) { /* ignore */ } emit(); }
export function patchRouteState(patch) {
  load();
  const next = { ...state, ...patch };
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next; emit();
}
export const subscribeRoute = f => { subs.add(f); return () => subs.delete(f); };
export const useRouteState = () => useSyncExternalStore(subscribeRoute, getRouteState, () => state);
