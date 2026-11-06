// Text FX — ตัวโหลดฟอนต์ (โหลดเฉพาะตัวที่ถูกใช้บนหน้าจอ ไม่โหลดล่วงหน้า)
// ไฟล์ฟอนต์มาจากแพ็กเกจ @fontsource (อยู่ในโปรเจกต์เอง ไม่พึ่ง Google) เฉพาะชุดอักษรไทย + ละติน (woff2)
// เราประกาศ @font-face เองพร้อม unicode-range → เบราว์เซอร์ดึงไฟล์ไทย/ละตินเฉพาะเมื่อมีตัวอักษรนั้นจริง
// ฟอนต์ที่ไม่มีอักษรไทย (เช่น Orbitron) จะมีฟอนต์ไทย Kanit เป็นตัวสำรองเสมอ ข้อความไทยจึงอ่านได้
import kanit_thai_400 from "@fontsource/kanit/files/kanit-thai-400-normal.woff2?url";
import kanit_latin_400 from "@fontsource/kanit/files/kanit-latin-400-normal.woff2?url";
import kanit_thai_600 from "@fontsource/kanit/files/kanit-thai-600-normal.woff2?url";
import kanit_latin_600 from "@fontsource/kanit/files/kanit-latin-600-normal.woff2?url";
import sarabun_thai_500 from "@fontsource/sarabun/files/sarabun-thai-500-normal.woff2?url";
import sarabun_latin_500 from "@fontsource/sarabun/files/sarabun-latin-500-normal.woff2?url";
import prompt_thai_500 from "@fontsource/prompt/files/prompt-thai-500-normal.woff2?url";
import prompt_latin_500 from "@fontsource/prompt/files/prompt-latin-500-normal.woff2?url";
import prompt_thai_600 from "@fontsource/prompt/files/prompt-thai-600-normal.woff2?url";
import prompt_latin_600 from "@fontsource/prompt/files/prompt-latin-600-normal.woff2?url";
import prompt_thai_700 from "@fontsource/prompt/files/prompt-thai-700-normal.woff2?url";
import prompt_latin_700 from "@fontsource/prompt/files/prompt-latin-700-normal.woff2?url";
import niramit_thai_500 from "@fontsource/niramit/files/niramit-thai-500-normal.woff2?url";
import niramit_latin_500 from "@fontsource/niramit/files/niramit-latin-500-normal.woff2?url";
import mitr_thai_500 from "@fontsource/mitr/files/mitr-thai-500-normal.woff2?url";
import mitr_latin_500 from "@fontsource/mitr/files/mitr-latin-500-normal.woff2?url";
import chonburi_thai_400 from "@fontsource/chonburi/files/chonburi-thai-400-normal.woff2?url";
import chonburi_latin_400 from "@fontsource/chonburi/files/chonburi-latin-400-normal.woff2?url";
import pattaya_thai_400 from "@fontsource/pattaya/files/pattaya-thai-400-normal.woff2?url";
import pattaya_latin_400 from "@fontsource/pattaya/files/pattaya-latin-400-normal.woff2?url";
import sriracha_thai_400 from "@fontsource/sriracha/files/sriracha-thai-400-normal.woff2?url";
import sriracha_latin_400 from "@fontsource/sriracha/files/sriracha-latin-400-normal.woff2?url";
import charmonman_thai_700 from "@fontsource/charmonman/files/charmonman-thai-700-normal.woff2?url";
import charmonman_latin_700 from "@fontsource/charmonman/files/charmonman-latin-700-normal.woff2?url";
import orbitron_latin_700 from "@fontsource/orbitron/files/orbitron-latin-700-normal.woff2?url";

const UR = {
  thai: "U+0E01-0E5B,U+200C-200D,U+25CC",
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};

export const FONTS = {
  kanit: { family: "Kanit", thai: true, w: {
      400: { thai: kanit_thai_400, latin: kanit_latin_400 },
      600: { thai: kanit_thai_600, latin: kanit_latin_600 },
    } },
  sarabun: { family: "Sarabun", thai: true, w: {
      500: { thai: sarabun_thai_500, latin: sarabun_latin_500 },
    } },
  prompt: { family: "Prompt", thai: true, w: {
      500: { thai: prompt_thai_500, latin: prompt_latin_500 },
      600: { thai: prompt_thai_600, latin: prompt_latin_600 },
      700: { thai: prompt_thai_700, latin: prompt_latin_700 },
    } },
  niramit: { family: "Niramit", thai: true, w: {
      500: { thai: niramit_thai_500, latin: niramit_latin_500 },
    } },
  mitr: { family: "Mitr", thai: true, w: {
      500: { thai: mitr_thai_500, latin: mitr_latin_500 },
    } },
  chonburi: { family: "Chonburi", thai: true, w: {
      400: { thai: chonburi_thai_400, latin: chonburi_latin_400 },
    } },
  pattaya: { family: "Pattaya", thai: true, w: {
      400: { thai: pattaya_thai_400, latin: pattaya_latin_400 },
    } },
  sriracha: { family: "Sriracha", thai: true, w: {
      400: { thai: sriracha_thai_400, latin: sriracha_latin_400 },
    } },
  charmonman: { family: "Charmonman", thai: true, w: {
      700: { thai: charmonman_thai_700, latin: charmonman_latin_700 },
    } },
  orbitron: { family: "Orbitron", thai: false, w: {
      700: { latin: orbitron_latin_700 },
    } },
};

// ฟอนต์สำรองภาษาไทย (ต่อท้ายทุกชุดฟอนต์) — ฟอนต์ที่ไม่มีอักษรไทยจะตกมาใช้ตัวนี้
export const THAI_FALLBACK = { key: "kanit", weight: 600 };
export const FALLBACK_STACK = '"Kanit","Sarabun",system-ui,-apple-system,"Segoe UI",sans-serif';

const injected = new Set();
// สร้างข้อความ @font-face ของฟอนต์/น้ำหนักนี้ (ใช้ทดสอบได้)
export function fontFaceCss(key, weight) {
  const f = FONTS[key];
  const files = f && f.w[weight];
  if (!files) return "";
  return Object.keys(files).map(sub => "@font-face{font-family:\"" + f.family + "\";font-style:normal;font-weight:" + weight + ";font-display:swap;src:url(" + files[sub] + ") format(\"woff2\");unicode-range:" + UR[sub] + "}").join("");
}
function load(key, weight) {
  const id = key + ":" + weight;
  if (injected.has(id) || typeof document === "undefined") return;
  const css = fontFaceCss(key, weight);
  if (!css) return;
  injected.add(id);
  const st = document.createElement("style");
  st.setAttribute("data-wm-font", id);
  st.textContent = css;
  document.head.appendChild(st);
}
// ลงทะเบียนฟอนต์ของไอเทมนี้ (+ ฟอนต์สำรองไทยถ้าตัวฟอนต์ไม่มีอักษรไทย) — เรียกซ้ำได้ ไม่ซ้ำซ้อน
// เบราว์เซอร์จะดาวน์โหลดไฟล์จริงตอนมีข้อความที่ใช้ฟอนต์นั้นแสดงอยู่เท่านั้น
export function ensureFont(item) {
  if (!item || !item.font || !FONTS[item.font.key]) return;
  load(item.font.key, item.font.w);
  if (!FONTS[item.font.key].thai) load(THAI_FALLBACK.key, THAI_FALLBACK.weight);
}
