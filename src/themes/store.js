// Themes — เก็บธีมที่เลือกรายหน้า (เก็บในเครื่องทันที → เปิดแอปแล้วไม่กะพริบ; เฟส 2 เพิ่มการบันทึกเข้าบัญชี)
import { useState, useEffect } from "react";
import { THEMES_ENABLED, THEME_SHARED_MODE } from "./config.js";
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

// ธีมร่วมทั้งแอป (โหมด THEME_SHARED_MODE): เก็บสำเนาในเครื่องไว้ด้วย → เปิดแอปแล้วไม่กะพริบ แล้วค่อยอัปเดตตามฐานข้อมูล
const SKEY = "wm_themes_shared";
function readShared() {
  try { const v = JSON.parse(localStorage.getItem(SKEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
let shared = readShared();
export function setSharedThemes(obj) {
  const next = {};
  THEME_SECTIONS.forEach(s => { const id = obj && obj[s]; if (id && id !== DEFAULT_THEME && THEME_BY_ID[id]) next[s] = id; });
  if (obj && obj.byName) next.byName = String(obj.byName).slice(0, 40);
  shared = next;
  try { localStorage.setItem(SKEY, JSON.stringify(shared)); } catch (e) { /* ไม่เป็นไร */ }
  listeners.forEach(f => f());
}
// ใช้ธีมร่วมทันทีที่บันทึกสำเร็จ (ก่อนที่ข้อมูลจากฐานข้อมูลจะวิ่งกลับมา)
function setSharedSection(section, id, byName) {
  const next = { ...shared, byName: byName || shared.byName };
  if (!id || id === DEFAULT_THEME) delete next[section]; else next[section] = id;
  setSharedThemes(next);
}
export function useSharedBy() {
  const [v, setV] = useState(() => shared.byName || "");
  useEffect(() => { const f = () => setV(shared.byName || ""); listeners.add(f); f(); return () => { listeners.delete(f); }; }, []);
  return v;
}
// ติดตามธีมร่วมจากฐานข้อมูล (subscribe = api.subscribeShared) — ทำงานเฉพาะตอนล็อกอิน/เป็นผู้เยี่ยมชมแล้ว
export function useSharedThemeSync(subscribe, enabled) {
  useEffect(() => {
    if (!THEMES_ENABLED || !THEME_SHARED_MODE || !subscribe || !enabled) return;
    return subscribe(data => setSharedThemes(data || {}));
  }, [subscribe, enabled]);
}

export function getSectionTheme(section) {
  if (!THEMES_ENABLED) return DEFAULT_THEME;
  if (THEME_SHARED_MODE) { const sid = shared[section]; return sid && THEME_BY_ID[sid] ? sid : DEFAULT_THEME; }
  const id = cache[section];
  if (!id || !THEME_BY_ID[id]) return DEFAULT_THEME;
  if (ownerDoc && !canUseTheme(ownerDoc, id)) return DEFAULT_THEME; // ไม่ได้เป็นเจ้าของ = ใช้ไม่ได้
  return id;
}
export function setSectionTheme(section, id, byName) {
  if (!THEME_SECTIONS.includes(section)) return;
  if (THEME_SHARED_MODE) { setSharedSection(section, id, byName); return; }
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
