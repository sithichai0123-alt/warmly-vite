// Themes — กรอบครอบหน้าแต่ละส่วน ตั้งตัวแปรสีของธีมให้เฉพาะลูกหลานในกรอบนี้
// display:contents = กรอบนี้ไม่มีกล่องของตัวเอง จึงไม่กระทบเลย์เอาต์/การเลื่อน/ขนาดของหน้าเดิมเลย
// (ตัวแปร CSS ยังสืบทอดลงไปถึงลูกหลานตามปกติ)
import { useMemo } from "react";
import { THEMES_ENABLED } from "./config.js";
import { THEME_BY_ID, DEFAULT_THEME, themeStyleVars } from "./catalog.js";
import { useSectionTheme } from "./store.js";

// ช่องกรอก/แถบเลื่อนของระบบให้ตรงกับโทนสว่าง/มืดของธีม
if (typeof document !== "undefined" && !document.getElementById("wm-theme-css")) {
  const st = document.createElement("style");
  st.id = "wm-theme-css";
  st.textContent = '[data-wscheme="light"] input,[data-wscheme="light"] textarea,[data-wscheme="light"] select{color-scheme:light}';
  document.head.appendChild(st);
}

// section = หน้าที่ใช้ธีม (null = หน้าที่ไม่มีธีม ใช้สีเดิม)  themeId = ระบุธีมตรง ๆ (ดูตัวอย่าง — ไม่แตะค่าที่บันทึกไว้)
export default function ThemeScope({ section, themeId, children }) {
  const saved = useSectionTheme(section || "");
  const id = !THEMES_ENABLED ? DEFAULT_THEME : (themeId && THEME_BY_ID[themeId] ? themeId : (section ? saved : DEFAULT_THEME));
  const theme = THEME_BY_ID[id] || THEME_BY_ID[DEFAULT_THEME];
  const vars = useMemo(() => themeStyleVars(theme, section), [theme, section]);
  return <div data-wtheme={theme.id} data-wsection={section || ""} data-wscheme={theme.scheme} style={{ display: "contents", ...vars }}>{children}</div>;
}
