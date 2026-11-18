// โหมดสว่าง/มืดทั้งแอป (สลับด้วยปุ่ม ☀️/🌙 บนแถบบน) — ฟรีสำหรับทุกคน เก็บค่าในเครื่อง (ไม่แตะฐานข้อมูล)
// หลักการ: โหมดมืด = ไม่ตั้งตัวแปรสีเลย (ใช้สีเดิมที่ฝังเป็นค่าสำรอง = หน้าตาเหมือนเดิมทุกพิกเซล)
//          โหมดสว่าง = ตั้งตัวแปรสีชุดนี้ที่ <html> → ทุกหน้า/ทุกหน้าต่างเปลี่ยนตามอัตโนมัติ
// ธีมรายหน้า (ห้องเสียง/ฟีด/แชท/โปรไฟล์) ที่ผู้ใช้เลือกไว้ยังทำงานเหมือนเดิม และทับโหมดนี้เฉพาะหน้านั้น
// ปิดทั้งฟีเจอร์: APP_MODE_ENABLED = false
import { useSyncExternalStore } from "react";
import { themeStyleVars } from "./catalog.js";

export const APP_MODE_ENABLED = true;
const KEY = "wm_appMode";

// ปรับโทนสว่างที่นี่ที่เดียว
export const LIGHT_VARS = {
  "--app-background": "#F6F4FF", "--surface-background": "#EEEAFE", "--panel-background": "#FFFFFF", "--border-color": "#DDD6FA", "--border-strong": "#7C5CE0",
  "--primary-color": "#6A45E6", "--secondary-color": "#5B3AD2", "--button-background": "linear-gradient(135deg,#5B3AD2,#7452E8)",
  "--text-primary": "#1B1838", "--text-secondary": "#47427A", "--text-muted": "#6A6598",
  "--success-color": "#047857", "--danger-color": "#BE123C", "--danger-background": "rgba(190,18,60,.08)", "--warning-color": "#9A4A06",
  "--page-background": "linear-gradient(180deg,#F6F4FF,#EDE9FE)", "--message-bubble": "#EFEBFF",
  "--card-shadow": "0 4px 20px rgba(91,58,210,.12)", "--accent-color": "#5B3AD2", "--glass-background": "rgba(246,244,255,.88)",
};
const LIGHT_BG = "#F6F4FF", DARK_BG = "#0F0E17";

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
