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
  "--page-background", "--message-bubble", "--card-shadow", "--accent-color",
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
// cur: null | "gold" | "purple"  price: ราคา (0 = ฟรี)   preview: [พื้นหลัง, การ์ด, สีเน้น] ไว้วาดรูปย่อ
// sections: (ไม่บังคับ) ตัวแปรที่ต่างกันเฉพาะบางหน้า เช่น พื้นหลังห้องเสียงคนละแบบกับฟีด
// เพิ่มธีมใหม่ = เพิ่มรายการในนี้ที่เดียว (ต้องผ่านการตรวจความตัดกันของสีใน test เสมอ)
const GLOW = (c, a1, a2, base, x1 = "50%", y1 = "-8%") => "radial-gradient(700px 420px at " + x1 + " " + y1 + ",rgba(" + c + "," + a1 + "),transparent 65%)" + (a2 ? ",radial-gradient(520px 380px at 0% 100%,rgba(" + c + "," + a2 + "),transparent 62%)" : "") + "," + base;

export const THEMES = [
  { id: "dark", name: "Premium Dark", th: "ม่วงเข้มพรีเมียม (ค่าเริ่มต้นของ Warmly)", cur: null, price: 0, rarity: "free", scheme: "dark", vars: null,
    preview: ["#0F0E17", "#221F33", "#7C5CFC"] },

  { id: "cozy", name: "Warm & Cozy", th: "อบอุ่นสบายตา โทนส้มน้ำตาลนุ่ม ๆ", cur: null, price: 0, rarity: "free", scheme: "dark",
    preview: ["#1B1310", "#2F211A", "#E8803A"],
    vars: {
      "--app-background": "#1B1310", "--surface-background": "#251A15", "--panel-background": "#2F211A", "--border-color": "#4A3427", "--border-strong": "#C77B43",
      "--primary-color": "#E8803A", "--secondary-color": "#F7B77A", "--button-background": "linear-gradient(135deg,#B84E14,#CF6620)",
      "--text-primary": "#FFF2E6", "--text-secondary": "#DDBFA6", "--text-muted": "#B09075", "--danger-color": "#FB7185",
      "--page-background": GLOW("232,128,58", ".20", ".08", "#1B1310"), "--message-bubble": "#3A2A21", "--accent-color": "#F7B77A",
    } },

  { id: "pastel", name: "Pastel", th: "พาสเทลหวานนุ่ม ชมพู-ม่วงอ่อน สว่างสบายตา", cur: "gold", price: 400, rarity: "common", scheme: "light",
    preview: ["#FFF1F8", "#FFFFFF", "#D0679F"],
    vars: {
      "--app-background": "#FFF6FA", "--surface-background": "#FFEAF3", "--panel-background": "#FFFFFF", "--border-color": "#F1CFE0", "--border-strong": "#C46B9B",
      "--primary-color": "#C0568F", "--secondary-color": "#A23B78", "--button-background": "linear-gradient(135deg,#C2427E,#A855B8)",
      "--text-primary": "#3B2340", "--text-secondary": "#654468", "--text-muted": "#85618A",
      "--success-color": "#0F7B55", "--danger-color": "#C0143C", "--danger-background": "rgba(192,20,60,.08)", "--warning-color": "#A8560B",
      "--page-background": "linear-gradient(180deg,#FFF1F8,#F3EDFF 55%,#EAF6FF)", "--message-bubble": "#FBE8F2",
      "--card-shadow": "0 4px 18px rgba(176,90,150,.15)", "--accent-color": "#A23B78",
    } },

  { id: "light", name: "Premium Light", th: "สว่างสะอาด หรูทันสมัย โทนม่วงอ่อน", cur: "gold", price: 600, rarity: "rare", scheme: "light",
    preview: ["#F6F4FF", "#FFFFFF", "#5B3AD2"],
    vars: {
      "--app-background": "#F6F4FF", "--surface-background": "#EEEAFE", "--panel-background": "#FFFFFF", "--border-color": "#DDD6FA", "--border-strong": "#7C5CE0",
      "--primary-color": "#6A45E6", "--secondary-color": "#5B3AD2", "--button-background": "linear-gradient(135deg,#5B3AD2,#7452E8)",
      "--text-primary": "#1B1838", "--text-secondary": "#47427A", "--text-muted": "#6A6598",
      "--success-color": "#047857", "--danger-color": "#BE123C", "--danger-background": "rgba(190,18,60,.08)", "--warning-color": "#9A4A06",
      "--page-background": "linear-gradient(180deg,#F6F4FF,#EDE9FE)", "--message-bubble": "#EFEBFF",
      "--card-shadow": "0 4px 20px rgba(91,58,210,.12)", "--accent-color": "#5B3AD2",
    } },

  { id: "sakura", name: "Sakura Night", th: "คืนซากุระ โทนกุหลาบเข้มนุ่มนวล", cur: "gold", price: 1000, rarity: "rare", scheme: "dark",
    preview: ["#170D13", "#2D1824", "#F06292"],
    vars: {
      "--app-background": "#170D13", "--surface-background": "#21121B", "--panel-background": "#2D1824", "--border-color": "#4D2A3E", "--border-strong": "#D9628F",
      "--primary-color": "#F06292", "--secondary-color": "#FFB3CF", "--button-background": "linear-gradient(135deg,#B82460,#D03E78)",
      "--text-primary": "#FFEFF5", "--text-secondary": "#E0B3C6", "--text-muted": "#B58C9F",
      "--page-background": "radial-gradient(600px 400px at 85% 0%,rgba(240,98,146,.20),transparent 65%),radial-gradient(500px 360px at 0% 100%,rgba(255,179,207,.10),transparent 60%),#170D13",
      "--message-bubble": "#3B2030", "--accent-color": "#FFB3CF",
    } },

  { id: "ocean", name: "Ocean Glow", th: "ประกายมหาสมุทร โทนฟ้าน้ำทะเลลึก", cur: "gold", price: 1000, rarity: "rare", scheme: "dark",
    preview: ["#061419", "#0F2B36", "#1FB6D6"],
    vars: {
      "--app-background": "#061419", "--surface-background": "#0A1E26", "--panel-background": "#0F2B36", "--border-color": "#1E4553", "--border-strong": "#22B8D6",
      "--primary-color": "#1FB6D6", "--secondary-color": "#7DE3F4", "--button-background": "linear-gradient(135deg,#0A7090,#0E86A8)",
      "--text-primary": "#E6FBFF", "--text-secondary": "#A5D3DF", "--text-muted": "#78A3B2", "--danger-color": "#FB7185",
      "--page-background": "radial-gradient(800px 420px at 20% -10%,rgba(34,184,214,.22),transparent 65%),linear-gradient(180deg,#061419,#04101A)",
      "--message-bubble": "#16394A", "--accent-color": "#7DE3F4",
    } },

  { id: "royal", name: "Royal Gold", th: "ดำทองหรูหราสไตล์ราชวงศ์", cur: "purple", price: 3, rarity: "legendary", scheme: "dark",
    preview: ["#0A0906", "#1D180C", "#D4A017"],
    vars: {
      "--app-background": "#0A0906", "--surface-background": "#14110A", "--panel-background": "#1D180C", "--border-color": "#3F3516", "--border-strong": "#D4A017",
      "--primary-color": "#D4A017", "--secondary-color": "#F3D77A", "--button-background": "linear-gradient(135deg,#8A6205,#A67A10)",
      "--text-primary": "#FFF8E1", "--text-secondary": "#D9C88C", "--text-muted": "#A99A66",
      "--page-background": GLOW("212,160,23", ".22", ".08", "#0A0906"), "--message-bubble": "#2B2312", "--accent-color": "#F3D77A",
    } },

  { id: "aurora", name: "Aurora", th: "แสงเหนือเหนือท้องฟ้ายามค่ำ เขียว-ม่วงเรืองแสง", cur: "purple", price: 8, rarity: "legendary", scheme: "dark",
    preview: ["#080B1A", "#141A36", "#7B8CFF"],
    vars: {
      "--app-background": "#080B1A", "--surface-background": "#0D1226", "--panel-background": "#141A36", "--border-color": "#29315E", "--border-strong": "#7B8CFF",
      "--primary-color": "#7B8CFF", "--secondary-color": "#8EF0C4", "--button-background": "linear-gradient(135deg,#4752C9,#2A8F6E)",
      "--text-primary": "#EEF1FF", "--text-secondary": "#AEB7E6", "--text-muted": "#8791C4",
      "--page-background": "radial-gradient(700px 400px at 10% 0%,rgba(52,211,153,.20),transparent 60%),radial-gradient(700px 420px at 90% 10%,rgba(129,140,248,.25),transparent 60%),#080B1A",
      "--message-bubble": "#1E2650", "--accent-color": "#8EF0C4",
    } },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));
export const themeItemId = id => "theme:" + id; // รหัสในสมุดไอเทม (inventory)

// ใช้ธีมนี้ได้ไหม: ฟรี หรือเป็นเจ้าของ (มี "theme:<id>" ใน inventory ของบัญชี)
export function canUseTheme(userDoc, id) {
  const t = THEME_BY_ID[id];
  if (!t) return false;
  if (!t.price) return true;
  const inv = userDoc && Array.isArray(userDoc.inventory) ? userDoc.inventory : [];
  return inv.includes(themeItemId(id));
}

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ตัวแปร CSS ที่จะตั้งให้กรอบของหน้านั้น ({} = ไม่ตั้งอะไร ใช้สีเดิม)
export function themeStyleVars(theme, section) {
  if (!theme || !theme.vars) return {};
  const v = { ...theme.vars, ...((theme.sections && section && theme.sections[section]) || {}) };
  const out = {};
  VAR_KEYS.forEach(k => { if (v[k]) out[k] = v[k]; });
  ALPHA_VARS.forEach(([name, src, a]) => {
    const rgb = hexToRgb(v[src]);
    if (rgb) out[name] = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  });
  return out;
}

// ตัวแปรสำหรับ "กรอบของเจ้าของ" ที่ซ้อนอยู่ในหน้าที่มีธีมของคนดู: ตัวแปรที่ธีมนี้ไม่ได้ตั้ง ต้องล้างค่าที่สืบทอดมา
// (ไม่งั้นสีจากธีมของคนดูจะรั่วเข้ามาปนกับธีมของเจ้าของ) — "initial" ทำให้ var(--x, สีเดิม) กลับไปใช้สีเดิม
export function themeStyleVarsIsolated(theme, section) {
  const v = themeStyleVars(theme, section);
  const out = { ...v };
  VAR_KEYS.forEach(k => { if (!(k in out)) out[k] = "initial"; });
  ALPHA_VARS.forEach(([name]) => { if (!(name in out)) out[name] = "initial"; });
  return out;
}
