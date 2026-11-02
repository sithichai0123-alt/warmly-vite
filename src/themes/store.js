// Themes — เก็บธีมที่เลือกรายหน้า (เก็บในเครื่องทันที → เปิดแอปแล้วไม่กะพริบ; เฟส 2 เพิ่มการบันทึกเข้าบัญชี)
import { useState, useEffect } from "react";
import { THEMES_ENABLED } from "./config.js";
import { THEME_BY_ID, THEME_SECTIONS, DEFAULT_THEME, canUseTheme } from "./catalog.js";

const KEY = "wm_themes";
const listeners = new Set();

function readAll() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
let cache = readAll();
// สมุดไอเทมของบัญชีที่ล็อกอิน (ไว้ตรวจว่าเป็นเจ้าของธีมจริงไหม) — ก่อนโหลดบัญชีเสร็จ ใช้ค่าในเครื่องไปก่อนเพื่อไม่ให้กะพริบ
let ownerDoc = null;
export function setThemeOwner(doc) { ownerDoc = doc || null; listeners.forEach(f => f()); }

export function getSectionTheme(section) {
  if (!THEMES_ENABLED) return DEFAULT_THEME;
  const id = cache[section];
  if (!id || !THEME_BY_ID[id]) return DEFAULT_THEME;
  if (ownerDoc && !canUseTheme(ownerDoc, id)) return DEFAULT_THEME; // ไม่ได้เป็นเจ้าของ = ใช้ไม่ได้
  return id;
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

// ซิงก์กับบัญชี: บัญชีคือค่าจริง (ล็อกอินใหม่ได้ธีมเดิมคืน) และกันธีมของคนก่อนหน้าค้างในเครื่องเดียวกัน
const UID_KEY = "wm_themes_uid";
export function useThemeAccountSync(uid, userDoc) {
  const themeKey = userDoc ? JSON.stringify(userDoc.theme || null) : "?";
  const invKey = userDoc && Array.isArray(userDoc.inventory) ? userDoc.inventory.filter(x => String(x).startsWith("theme:")).join(",") : "";
  useEffect(() => {
    if (!uid) return;
    let last = null;
    try { last = localStorage.getItem(UID_KEY); } catch (e) { /* ไม่เป็นไร */ }
    if (last && last !== uid) replaceSectionThemes({}); // เปลี่ยนบัญชีในเครื่องเดียวกัน → ล้างธีมของคนก่อน
    try { localStorage.setItem(UID_KEY, uid); } catch (e) { /* ไม่เป็นไร */ }
    if (!userDoc) return;
    setThemeOwner({ inventory: userDoc.inventory || [] });
    replaceSectionThemes(userDoc.theme || {});
  }, [uid, themeKey, invKey]); // eslint-disable-line
}
