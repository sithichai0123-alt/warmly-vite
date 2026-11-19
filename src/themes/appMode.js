// โหมดสว่าง/มืดทั้งแอป (สลับด้วยปุ่ม ☀️/🌙 บนแถบบน) — ฟรีสำหรับทุกคน เก็บค่าในเครื่อง (ไม่แตะฐานข้อมูล)
// หลักการ: ตั้งตัวแปรสีของโหมดที่เลือกที่ <html> → ทุกหน้า/ทุกหน้าต่างเปลี่ยนตามอัตโนมัติ (ค่าสำรองม่วงเดิมยังฝังอยู่ในโค้ดเป็นตาข่ายนิรภัย)
// ธีมรายหน้า (ห้องเสียง/ฟีด/แชท/โปรไฟล์) ที่ผู้ใช้เลือกไว้ยังทำงานเหมือนเดิม และทับโหมดนี้เฉพาะหน้านั้น
// ปิดทั้งฟีเจอร์: APP_MODE_ENABLED = false
import { useSyncExternalStore } from "react";
import { themeStyleVars } from "./catalog.js";

export const APP_MODE_ENABLED = true;
const KEY = "wm_appMode";

// ชุดสีของแอป: ลุค "Midnight" (ดำเทามืออาชีพ + ทองอำพัน) — แก้โทนสีทั้งแอปที่ 2 ชุดนี้ที่เดียว
//   --on-primary = สีตัวอักษรบนปุ่ม/ฟองข้อความสีหลัก (พื้นทอง → ตัวอักษรดำเข้ม)
export const DARK_VARS = {
  "--app-background": "#0A0B0D", "--surface-background": "#0F1114", "--panel-background": "#15181C", "--border-color": "#23272D", "--border-strong": "#6B5A2B",
  "--primary-color": "#E8B64C", "--secondary-color": "#F0C970", "--button-background": "linear-gradient(135deg,#E8B64C,#F3C76A)", "--on-primary": "#1A1304",
  "--text-primary": "#ECEDEE", "--text-secondary": "#9AA1A9", "--text-muted": "#6C727A",
  "--success-color": "#3DDC97", "--danger-color": "#F0616D", "--danger-background": "rgba(240,97,109,.12)", "--warning-color": "#F2A93B",
  "--page-background": "transparent", "--message-bubble": "#1A1D22", "--card-shadow": "0 4px 24px rgba(0,0,0,.45)", "--accent-color": "#F0C970", "--glass-background": "rgba(10,11,13,.85)", "--brand-text-gradient": "linear-gradient(135deg,#E8B64C,#F3C76A)",
};
export const LIGHT_VARS = {
  "--app-background": "#FAFAF8", "--surface-background": "#F2F1ED", "--panel-background": "#FFFFFF", "--border-color": "#E4E2DB", "--border-strong": "#C99A2E",
  "--primary-color": "#A86E12", "--secondary-color": "#8A5A0B", "--button-background": "linear-gradient(135deg,#E8B64C,#F3C76A)", "--on-primary": "#1A1304",
  "--text-primary": "#1A1815", "--text-secondary": "#5B5750", "--text-muted": "#7A756B",
  "--success-color": "#047857", "--danger-color": "#BE123C", "--danger-background": "rgba(190,18,60,.08)", "--warning-color": "#9A4A06",
  "--page-background": "transparent", "--message-bubble": "#F1EFE8", "--card-shadow": "0 4px 18px rgba(60,45,10,.10)", "--accent-color": "#8A5A0B", "--glass-background": "rgba(250,250,248,.9)", "--brand-text-gradient": "linear-gradient(135deg,#8A5A0B,#B07418)",
};
const LIGHT_BG = "#FAFAF8", DARK_BG = "#0A0B0D";

function allVars(m) {
  const light = m === "light";
  const v = themeStyleVars({ scheme: light ? "light" : "dark", vars: light ? LIGHT_VARS : DARK_VARS }, null); // รวมสีโปร่งใส + --wm-dark
  v["--wm-cs"] = light ? "light" : "dark";
  // จุดออนไลน์/เพิ่งออก/ออฟไลน์: พื้นสว่างให้เขียวสดมีแสงเรือง vs เทาอ่อน (ดูต่างกันชัด)
  v["--presence-on"] = light ? "#16A34A" : "#3DDC97"; v["--presence-off"] = light ? "#B1AEA5" : "#4A4F57";
  v["--presence-glow"] = light ? "rgba(22,163,74,.6)" : "rgba(61,220,151,.45)"; v["--presence-recent"] = "#F59E0B";
  return v;
}

let mode = "dark";
try { if (APP_MODE_ENABLED && localStorage.getItem(KEY) === "light") mode = "light"; } catch (e) { /* ignore */ }
const subs = new Set();

function apply(m) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(allVars(m)).forEach(([k, val]) => root.style.setProperty(k, val));
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
