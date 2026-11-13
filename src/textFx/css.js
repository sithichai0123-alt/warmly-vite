// Text FX — ตัวสร้าง CSS ของเอฟเฟกต์ทั้งหมด (CSS ล้วน ไม่มี JS ทำงานทุกเฟรม) แล้วฉีดเข้าหน้าเว็บครั้งเดียว
// สีสองโทน: ใช้ color-mix กับตัวแปร --wm-dark (1=พื้นเข้ม ค่าเริ่มต้น / 0=พื้นสว่าง ตั้งโดยธีมของหน้านั้น)
// เบราว์เซอร์ที่ไม่รองรับ color-mix → ใช้โทนมืดตรง ๆ (ยังอ่านได้ ไม่พัง)
import { FX } from "./catalog.js";
import { FALLBACK_STACK, FONTS } from "./fonts.js";

const hex = (h, a) => { const n = parseInt(h.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };

// รายการแอนิเมชันของไอเทม (ลำดับคงที่) — ใช้ทั้งตอนสร้าง CSS และตอนปรับความเร็วรายบุคคล (animSecs)
export function animList(item) {
  const a = [];
  if (item.grad && item.grad.flow) a.push({ name: "wm-tfx-flow", secs: item.grad.flow, ease: "linear" });
  if (item.sweep) a.push({ name: "wm-tfx-sweep", secs: item.sweep.secs, ease: "ease-in-out" });
  if (item.blink) a.push({ name: "wm-tfx-blink", secs: item.blink, ease: "ease-in-out" });
  if (item.pulse) a.push({ name: "wm-tfx-p-" + item.id, secs: item.pulse, ease: "ease-in-out" });
  if (item.flicker) a.push({ name: "wm-tfx-flicker", secs: item.flicker, ease: "linear" });
  if (item.glitch) a.push({ name: "wm-tfx-g-" + item.id, secs: item.glitch, ease: "steps(1,end)" });
  return a;
}
export const animSecs = item => animList(item).map(a => a.secs);

// สีพร้อมโทนสว่าง/มืดของธีม (ใช้กับเงาที่คำนวณตอนปรับแต่ง)
export function glowColor(c, a) { return "color-mix(in srgb," + hex(c, a) + " calc(var(--wm-dark,1)*100%),transparent)"; }

function build(item, mix) {
  const C = ([d, l]) => (mix ? "color-mix(in srgb," + d + " calc(var(--wm-dark,1)*100%)," + l + ")" : d);
  const G = (c, a) => (mix ? "color-mix(in srgb," + hex(c, a) + " calc(var(--wm-dark,1)*100%),transparent)" : hex(c, a));
  const o = [];
  const anims = animList(item);
  if (item.font) {
    const fam = FONTS[item.font.key].family;
    o.push("font-family:\"" + fam + "\"," + FALLBACK_STACK, "font-weight:" + item.font.w);
  }
  if (item.color) o.push("color:" + C(item.color));
  if (item.glow) o.push("text-shadow:" + item.glow.map(([b, c, a]) => "0 0 " + b + "px " + G(c, a)).join(","));
  if (item.grad) {
    const s = item.grad.stops.map(C);
    const cyc = item.grad.flow ? [...s, ...s, s[0]] : s; // ไหลได้ไม่สะดุด: สองรอบต่อภาพ เลื่อนทีละหนึ่งรอบ
    o.push("color:" + (mix ? C(item.grad.stops[0]) : item.grad.stops[0][0]));
    o.push("background-image:linear-gradient(90deg," + cyc.join(",") + ")", "background-size:" + (item.grad.flow ? "200% 100%" : "100% 100%"), "background-repeat:repeat-x");
    o.push("-webkit-background-clip:text", "background-clip:text", "-webkit-text-fill-color:transparent", "-webkit-box-decoration-break:clone", "box-decoration-break:clone");
  }
  if (item.sweep) {
    const b = C(item.sweep.base), h = C(item.sweep.hi);
    o.push("color:" + (mix ? b : item.sweep.base[0]));
    o.push("background-image:linear-gradient(100deg," + b + " 0%," + b + " 40%," + h + " 50%," + b + " 60%," + b + " 100%)", "background-size:300% 100%", "background-position:100% 0", "background-repeat:no-repeat");
    o.push("-webkit-background-clip:text", "background-clip:text", "-webkit-text-fill-color:transparent");
  }
  if (item.dropGlow) o.push("filter:drop-shadow(0 0 " + item.dropGlow[0] + "px " + G(item.dropGlow[1], item.dropGlow[2]) + ")");
  if (anims.length) o.push("animation:" + anims.map(a => a.name + " " + a.secs + "s " + a.ease + " infinite").join(","));
  return ".wm-tfx-" + item.id + "{" + o.join(";") + "}";
}

export function buildCss() {
  const items = FX.filter(t => !t.plain);
  let css = "@keyframes wm-tfx-flow{from{background-position:0% 0}to{background-position:100% 0}}"
    + "@keyframes wm-tfx-sweep{0%{background-position:100% 0}55%{background-position:0% 0}100%{background-position:0% 0}}"
    + "@keyframes wm-tfx-blink{0%,100%{opacity:1}50%{opacity:.7}}"
    // นีออนสะดุด: ตกวูบสั้น ๆ 2 จังหวะต่อรอบ (ความทึบต่ำสุด .72) ห่างกันเกิน 1 วินาทีเสมอเมื่อรอบ ≥ 3 วินาที
    + "@keyframes wm-tfx-flicker{0%,17%,23%,60%,100%{opacity:1}19%{opacity:.72}21%{opacity:.9}64%{opacity:.78}67%{opacity:1}}";
  items.filter(t => t.pulse).forEach(t => {
    const dim = t.glow.map(([b, c, a]) => "0 0 " + b + "px " + hex(c, +(a * 0.55).toFixed(2))).join(",");
    const full = t.glow.map(([b, c, a]) => "0 0 " + b + "px " + hex(c, a)).join(",");
    css += "@keyframes wm-tfx-p-" + t.id + "{0%,100%{text-shadow:" + full + "}50%{text-shadow:" + dim + "}}";
  });
  // Glitch: เงาสองสี (ชั้นแรก/ชั้นที่สองของ glow) เยื้องซ้าย-ขวา แล้วสะบัดสั้น ๆ ช่วงท้ายรอบ (ไม่ใช่การกะพริบของความสว่าง)
  items.filter(t => t.glitch).forEach(t => {
    const sh = (dx1, dx2) => t.glow.map(([b, c, a], i) => (i === 0 ? dx1 : dx2) + "px 0 " + b + "px " + hex(c, a)).join(",");
    css += "@keyframes wm-tfx-g-" + t.id + "{0%,84%,100%{text-shadow:" + sh(-1.5, 1.5) + "}86%{text-shadow:" + sh(3, -3) + "}88%{text-shadow:" + sh(-3, 3) + "}90%{text-shadow:" + sh(2, -2) + "}92%{text-shadow:" + sh(-1.5, 1.5) + "}}";
  });
  css += ".wm-tfx{display:inline}";
  css += items.map(t => build(t, false)).join("");
  css += "@supports (color:color-mix(in srgb,red calc(1*100%),blue)){" + items.map(t => build(t, true)).join("") + "}";
  // โหมดลดแอนิเมชัน/ปิด, ห้องที่คนเยอะ (lite) และการตั้งค่า Reduced Motion ของเครื่อง → นิ่ง (ยังเห็นสี/ฟอนต์ แต่ไม่ขยับ)
  css += "html[data-tfx-mode=\"reduced\"] .wm-tfx,html[data-tfx-mode=\"off\"] .wm-tfx,.wm-tfx.wm-tfx-lite{animation:none!important}"
    + "@media (prefers-reduced-motion:reduce){.wm-tfx{animation:none!important}}";
  return css;
}

export function injectCss() {
  if (typeof document === "undefined" || document.getElementById("wm-textfx-css")) return;
  const st = document.createElement("style");
  st.id = "wm-textfx-css";
  st.textContent = buildCss();
  document.head.appendChild(st);
}
