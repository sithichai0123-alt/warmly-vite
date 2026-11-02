// Themes — รายการธีมและตัวแปรสี (ข้อมูลล้วน ไม่มี UI ไม่แตะฐานข้อมูล)
//
// หลักการ: โค้ดเดิมใช้สีผ่านออบเจ็กต์ T ใน App.jsx ซึ่งตอนนี้เป็น var(--ชื่อตัวแปร, สีเดิม)
//   • ธีมเริ่มต้น "dark" ไม่ตั้งตัวแปรใด ๆ → ใช้สีเดิมที่ฝังเป็นค่าสำรอง = หน้าตาเหมือนเดิมทุกพิกเซล
//   • ธีมอื่นตั้งตัวแปรเฉพาะในกรอบของหน้านั้น (ThemeScope) จึงไม่รั่วไปหน้าอื่น/แถบเมนูล่าง/หน้าล็อกอิน
// เพิ่มธีมใหม่: เพิ่มรายการใน THEMES ที่เดียว ไม่ต้องแก้ App.jsx

export const THEME_SECTIONS = ["voice", "feed", "chat", "profile"];
export const SECTION_LABEL = { voice: "ห้องเสียง", feed: "ฟีด/โพสต์", chat: "แชท", profile: "โปรไฟล์" };
export const DEFAULT_THEME = "dark";

// ตัวแปรสีที่ธีมกำหนดได้ (ชื่อตามสเปก + ชื่อที่ใช้ภายใน)
export const VAR_KEYS = [
  "--app-background", "--surface-background", "--panel-background", "--border-color", "--border-strong",
  "--primary-color", "--secondary-color", "--button-background",
  "--text-primary", "--text-secondary", "--text-muted",
  "--success-color", "--danger-color", "--danger-background", "--warning-color", "--glass-background",
  // ใช้ในเฟส 2 (พื้นหลังห้อง/ฟองข้อความ/สีเน้น)
  "--room-background", "--message-bubble", "--accent-color",
];

// สีโปร่งใสที่โค้ดเดิมต่อสตริง (เช่น T.brand+"22") — คำนวณจากสีของธีมให้อัตโนมัติ
// [ชื่อตัวแปรโปร่งใส, ตัวแปรสีต้นทาง, ค่า alpha]
export const ALPHA_VARS = [
  ["--primary-a13", "--primary-color", 0.133],
  ["--primary-a20", "--primary-color", 0.2],
  ["--primary-a27", "--primary-color", 0.267],
  ["--secondary-a13", "--secondary-color", 0.133],
  ["--success-a20", "--success-color", 0.2],
  ["--warning-a13", "--warning-color", 0.133],
];

export const RARITY_T = {
  free: { label: "ฟรี", color: "#10B981" },
  common: { label: "ทั่วไป", color: "#9CA3AF" },
  rare: { label: "หายาก", color: "#38BDF8" },
  epic: { label: "เอพิค", color: "#F472B6" },
  legendary: { label: "ตำนาน", color: "#F59E0B" },
};

// vars: null = ใช้สีเดิมของ Warmly (ไม่ตั้งตัวแปร)  scheme: "dark"|"light" (ใช้กับ color-scheme ของช่องกรอก)
// cur: null | "gold" | "purple"  price: ราคา (0 = ฟรี)
export const THEMES = [
  { id: "dark", name: "Premium Dark", th: "ม่วงเข้มพรีเมียม (ค่าเริ่มต้นของ Warmly)", cur: null, price: 0, rarity: "free", scheme: "dark", vars: null,
    preview: ["#0F0E17", "#221F33", "#7C5CFC"] },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));
export const themeItemId = id => "theme:" + id; // รหัสในสมุดไอเทม (inventory)

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ตัวแปร CSS ที่จะตั้งให้กรอบของหน้านั้น ({} = ไม่ตั้งอะไร ใช้สีเดิม)
export function themeStyleVars(theme) {
  if (!theme || !theme.vars) return {};
  const out = {};
  VAR_KEYS.forEach(k => { if (theme.vars[k]) out[k] = theme.vars[k]; });
  ALPHA_VARS.forEach(([name, src, a]) => {
    const rgb = hexToRgb(theme.vars[src]);
    if (rgb) out[name] = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  });
  return out;
}
