// Text FX — โหมดแอนิเมชันของคนดู (เก็บในเครื่อง ไม่ขึ้นฐานข้อมูล)
//   full    = เคลื่อนไหวเต็มรูปแบบ
//   reduced = เห็นสี/เรืองแสง/ฟอนต์ครบ แต่ไม่ขยับ (ค่าเริ่มต้นเมื่อเครื่องตั้ง Reduced Motion)
//   off     = ปิดเอฟเฟกต์ทั้งหมด แสดงข้อความธรรมดา (ฟอนต์ก็ไม่โหลด) — เผื่อคนที่อ่านลำบากหรือเครื่องช้า
import { useState, useEffect } from "react";

const KEY = "wm_textfxMode";
export const TEXTFX_MODES = ["full", "reduced", "off"];
const listeners = new Set();

function systemDefault() {
  try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full"; } catch (e) { return "full"; }
}
function read() {
  let v = null;
  try { v = localStorage.getItem(KEY); } catch (e) { /* ไม่เป็นไร */ }
  return TEXTFX_MODES.includes(v) ? v : systemDefault();
}
let mode = read();
function apply() { try { document.documentElement.setAttribute("data-tfx-mode", mode); } catch (e) { /* ไม่เป็นไร */ } }
if (typeof document !== "undefined") apply();

export function getTextFxMode() { return mode; }
export function setTextFxMode(m) {
  if (!TEXTFX_MODES.includes(m)) return;
  mode = m;
  try { localStorage.setItem(KEY, m); } catch (e) { /* ไม่เป็นไร */ }
  apply();
  listeners.forEach(f => f());
}
export function useTextFxMode() {
  const [m, setM] = useState(mode);
  useEffect(() => { const f = () => setM(mode); listeners.add(f); f(); return () => { listeners.delete(f); }; }, []);
  return m;
}
