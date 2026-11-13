// ชุดแจ้งเตือนกลางของเฟส C (เพื่อน/คำเชิญ/สายเข้า ใช้ร่วมกัน) — pub/sub เล็ก ๆ ไม่ผูกกับ Firebase
import { useSyncExternalStore } from "react";

let items = [];
const subs = new Set();
const timers = new Map();
const emit = () => subs.forEach(f => f());

export function showBanner(b) {
  if (!b || !b.key) return;
  if (timers.has(b.key)) { clearTimeout(timers.get(b.key)); timers.delete(b.key); }
  items = [...items.filter(x => x.key !== b.key), { tone: "info", ...b, at: Date.now() }];
  emit();
  if (b.ttl) timers.set(b.key, setTimeout(() => hideBanner(b.key), b.ttl));
}
export function hideBanner(key) {
  if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key); }
  const n = items.filter(x => x.key !== key);
  if (n.length !== items.length) { items = n; emit(); }
}
export function clearBanners() { timers.forEach(t => clearTimeout(t)); timers.clear(); items = []; emit(); }
export function getBanners() { return items; }
export function subscribeBanners(fn) { subs.add(fn); return () => subs.delete(fn); }
export function useBanners() { return useSyncExternalStore(subscribeBanners, getBanners, getBanners); }
