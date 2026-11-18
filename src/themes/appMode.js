// โหมดสว่าง/มืดทั้งแอป (สลับด้วยปุ่ม ☀️/🌙 บนแถบบน) — ฟรีสำหรับทุกคน เก็บค่าในเครื่อง (ไม่แตะฐานข้อมูล)
// หลักการ: โหมดมืด = ไม่ตั้งตัวแปรสีเลย (ใช้สีเดิมที่ฝังเป็นค่าสำรอง = หน้าตาเหมือนเดิมทุกพิกเซล)
//          โหมดสว่าง = ตั้งตัวแปรสีชุดนี้ที่ <html> → ทุกหน้า/ทุกหน้าต่างเปลี่ยนตามอัตโนมัติ
// ธีมรายหน้า (ห้องเสียง/ฟีด/แชท/โปรไฟล์) ที่ผู้ใช้เลือกไว้ยังทำงานเหมือนเดิม และทับโหมดนี้เฉพาะหน้านั้น
// ปิดทั้งฟีเจอร์: APP_MODE_ENABLED = false
import { useSyncExternalStore } from "react";
import { themeStyleVars } from "./catalog.js";

export const APP_MODE_ENABLED = true;
const KEY = "wm_appMode";

// ปรับโทนสว่างที่นี่ที่เดียว (ตอนนี้: ครีมอบอุ่น + สีเน้นม่วง)
export const LIGHT_VARS = {
  "--app-background": "#FFF9F2", "--surface-background": "#FFF0DF", "--panel-background": "#FFFFFF", "--border-color": "#F0DDC6", "--border-strong": "#8A63F0",
  "--primary-color": "#7C4DEB", "--secondary-color": "#6A3FD6", "--button-background": "linear-gradient(135deg,#6A3FD6,#8A63F0)",
  "--text-primary": "#2B2118", "--text-secondary": "#6B5844", "--text-muted": "#7D6850",
  "--success-color": "#047857", "--danger-color": "#BE123C", "--danger-background": "rgba(190,18,60,.08)", "--warning-color": "#9A4A06",
  "--page-background": "linear-gradient(180deg,#FFF9F2,#FFF1E0)", "--message-bubble": "#FBEBD6",
  "--card-shadow": "0 4px 18px rgba(160,110,60,.14)", "--accent-color": "#6A3FD6", "--glass-background": "rgba(255,249,242,.9)",
};
const LIGHT_BG = "#FFF9F2", DARK_BG = "#0F0E17";

function allVars() {
  const v = themeStyleVars({ scheme: "light", vars: LIGHT_VARS }, null); // รวมสีโปร่งใส + --wm-dark
  v["--wm-cs"] = "light";
  return v;
}

let mode = "dark";
try { if (APP_MODE_ENABLED && localStorage.getItem(KEY) === "light") mode = "light"; } catch (e) { /* ignore */ }
const subs = new Set();

function apply(m) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = allVars();
  if (m === "light") Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));
  else Object.keys(vars).forEach(k => root.style.removeProperty(k));
  root.style.colorScheme = m;
  root.setAttribute("data-wmode", m);
  if (document.body) document.body.style.background = m === "light" ? LIGHT_BG : DARK_BG;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", m === "light" ? LIGHT_BG : DARK_BG);
}
apply(mode); // ก่อน React วาดหน้าแรก → ไม่มีจอมืดวาบ

export function getAppMode() { return mode; }
export function setAppMode(m) {
  if (!APP_MODE_ENABLED) return;
  mode = m === "light" ? "light" : "dark";
  try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  apply(mode);
  subs.forEach(f => f());
}
export function useAppMode() {
  const m = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => mode, () => "dark");
  return [m, () => setAppMode(m === "light" ? "dark" : "light")];
}
