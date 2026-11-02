// Themes — กรอบครอบหน้าแต่ละส่วน ตั้งตัวแปรสีของธีมให้เฉพาะลูกหลานในกรอบนี้
// display:contents = กรอบนี้ไม่มีกล่องของตัวเอง จึงไม่กระทบเลย์เอาต์/การเลื่อน/ขนาดของหน้าเดิมเลย
// (ตัวแปร CSS ยังสืบทอดลงไปถึงลูกหลานตามปกติ)
import { useMemo } from "react";
import { THEMES_ENABLED } from "./config.js";
import { THEME_BY_ID, DEFAULT_THEME, themeStyleVars } from "./catalog.js";
import { useSectionTheme } from "./store.js";

// themeId = ระบุธีมตรง ๆ (ใช้ดูตัวอย่าง — ไม่แตะค่าที่บันทึกไว้)
export default function ThemeScope({ section, themeId, children }) {
  const saved = useSectionTheme(section);
  const id = THEMES_ENABLED ? (themeId && THEME_BY_ID[themeId] ? themeId : saved) : DEFAULT_THEME;
  const theme = THEME_BY_ID[id] || THEME_BY_ID[DEFAULT_THEME];
  const vars = useMemo(() => themeStyleVars(theme), [theme]);
  return <div data-wtheme={theme.id} data-wsection={section} style={{ display: "contents", ...vars }}>{children}</div>;
}
