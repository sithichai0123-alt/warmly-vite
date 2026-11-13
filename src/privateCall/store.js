// สถานะ "กำลังคุยสายส่วนตัวอยู่" ให้ห้องเสียงหลักรู้ (เพื่อปิดไมค์/ลดเสียงห้องระหว่างโทร)
import { useSyncExternalStore } from "react";

let active = false;
const subs = new Set();
export function setCallActive(v) { v = !!v; if (v !== active) { active = v; subs.forEach(f => f()); } }
export function isCallActive() { return active; }
export function useCallActive() { return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, isCallActive, isCallActive); }
