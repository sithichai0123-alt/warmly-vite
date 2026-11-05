// Themes — ธีมของเจ้าของ: ครอบสิ่งที่เป็นของใครคนหนึ่ง (ห้องของโฮสต์ / โพสต์ของคนโพสต์ / โปรไฟล์ของเจ้าของ)
// แล้วแสดงด้วยธีมของเจ้าของคนนั้น — ใช้ได้เมื่อเจ้าของเป็นเจ้าของธีมจริง (ธีมฟรี หรือมี "theme:<id>" ในคลังของเขา)
// ไม่ได้ตั้งธีม/ไม่ใช่เจ้าของจริง = กรอบว่าง (display:contents) ไม่เปลี่ยนอะไร ใช้ธีมของคนดูต่อ
// โครงสร้างกรอบเหมือนเดิมเสมอ (ไม่ว่ามีธีมหรือไม่) → ส่วนที่อยู่ข้างใน (เช่น ห้องเสียงที่ต่ออยู่) ไม่ถูกสร้างใหม่เวลาธีมเปลี่ยน
import { useMemo } from "react";
import { THEMES_ENABLED, THEME_OWNER_MODE } from "./config.js";
import { THEME_BY_ID, DEFAULT_THEME, canUseTheme, themeStyleVarsIsolated } from "./catalog.js";

// ช่องกรอกในกรอบของเจ้าของ ให้โทนสว่าง/มืดตามธีมของเจ้าของ (แม้อยู่ในหน้าที่คนดูใช้ธีมอีกโทนหนึ่ง)
if (typeof document !== "undefined" && !document.getElementById("wm-owner-css")) {
  const st = document.createElement("style");
  st.id = "wm-owner-css";
  st.textContent = ["light", "dark"].map(m => '[data-wowner][data-wscheme="' + m + '"] input,[data-wowner][data-wscheme="' + m + '"] textarea,[data-wowner][data-wscheme="' + m + '"] select{color-scheme:' + m + '}').join("");
  document.head.appendChild(st);
}

// คืนรหัสธีมของเจ้าของสำหรับหน้านั้น หรือ null = ไม่มีธีมที่ใช้ได้
export function resolveOwnerTheme(ownerDoc, section) {
  if (!THEMES_ENABLED || !THEME_OWNER_MODE || !ownerDoc || !ownerDoc.theme) return null;
  const id = ownerDoc.theme[section];
  if (!id || id === DEFAULT_THEME || !THEME_BY_ID[id]) return null;
  return canUseTheme(ownerDoc, id) ? id : null;
}

export default function OwnerScope({ ownerDoc, section, children }) {
  const id = resolveOwnerTheme(ownerDoc, section);
  const vars = useMemo(() => (id ? themeStyleVarsIsolated(THEME_BY_ID[id], section) : {}), [id, section]);
  const t = id ? THEME_BY_ID[id] : null;
  // color-scheme ตั้งตรงที่กรอบ (สืบทอดไปถึงช่องกรอก) → ช่องคอมเมนต์ในโพสต์สว่าง/มืดตรงกับธีมของเจ้าของ
  const style = t ? { display: "contents", ...vars, colorScheme: t.scheme } : { display: "contents" };
  return <div data-wowner={id || ""} data-wscheme={t ? t.scheme : undefined} style={style}>{children}</div>;
}
