// Themes — เก็บธีมที่เลือกรายหน้า (เก็บในเครื่องทันที → เปิดแอปแล้วไม่กะพริบ; เฟส 2 เพิ่มการบันทึกเข้าบัญชี)
import { useState, useEffect } from "react";
import { THEMES_ENABLED } from "./config.js";
import { THEME_BY_ID, THEME_SECTIONS, DEFAULT_THEME } from "./catalog.js";

const KEY = "wm_themes";
const listeners = new Set();

function readAll() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
let cache = readAll();

export function getSectionTheme(section) {
  if (!THEMES_ENABLED) return DEFAULT_THEME;
  const id = cache[section];
  return id && THEME_BY_ID[id] ? id : DEFAULT_THEME;
}
export function setSectionTheme(section, id) {
  if (!THEME_SECTIONS.includes(section)) return;
  const next = { ...cache };
  if (!id || id === DEFAULT_THEME) delete next[section]; else next[section] = id;
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ไม่เป็นไร */ }
  listeners.forEach(f => f());
}
// แทนที่ทั้งชุด (ใช้ตอนโหลดค่าจากบัญชีที่ล็อกอิน)
export function replaceSectionThemes(obj) {
  const next = {};
  THEME_SECTIONS.forEach(s => { const id = obj && obj[s]; if (id && id !== DEFAULT_THEME && THEME_BY_ID[id]) next[s] = id; });
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ไม่เป็นไร */ }
  listeners.forEach(f => f());
}
export function useSectionTheme(section) {
  const [id, setId] = useState(() => getSectionTheme(section));
  useEffect(() => {
    const f = () => setId(getSectionTheme(section));
    listeners.add(f);
    f();
    return () => { listeners.delete(f); };
  }, [section]);
  return id;
}
