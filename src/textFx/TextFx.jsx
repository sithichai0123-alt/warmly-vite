// Text FX — คอมโพเนนต์ครอบข้อความ: fx = รหัสไอเทม (จาก resolveTextFx) → แสดงด้วยฟอนต์/เอฟเฟกต์นั้น
// ไม่ได้ระบุ fx / ไอเทมไม่มี / ปิดระบบ / โหมด off → แสดงข้อความธรรมดา (span เปล่า) ไม่เปลี่ยนอะไร
// tune (เฟส 4, ไม่บังคับ) = ค่าปรับแต่งของเจ้าของ {s,g,h} → ปรับความเร็ว/เรืองแสง/โทนสีผ่าน inline style (ไม่มี tune = เหมือนเดิมทุกอย่าง)
import { useEffect } from "react";
import { TEXTFX_ENABLED } from "./config.js";
import { FX_BY_ID } from "./catalog.js";
import { ensureFont } from "./fonts.js";
import { injectCss, animSecs, glowColor } from "./css.js";
import { useTextFxMode } from "./store.js";
import { normalizeTune, isDefaultTune, tuneCaps, SPEED_K, GLOW_K, HUE_STEPS, MIN_CYCLE_SECS, MAX_BLUR, MAX_DROP_BLUR } from "./tune.js";

// คำนวณ inline style ของการปรับแต่ง (ฟังก์ชันล้วน ทดสอบได้)
export function tuneStyle(item, tune) {
  if (!item || !tune || isDefaultTune(tune)) return null;
  const t = normalizeTune(tune), caps = tuneCaps(item), st = {};
  if (caps.speed && t.s !== 1) st.animationDuration = animSecs(item).map(s => Math.max(MIN_CYCLE_SECS, +(s * SPEED_K[t.s]).toFixed(2)) + "s").join(",");
  const k = GLOW_K[t.g], hue = caps.hue && t.h ? "hue-rotate(" + HUE_STEPS[t.h] + "deg)" : "";
  if (caps.glow && t.g !== 1 && item.glow && !item.pulse && !item.glitch) st.textShadow = item.glow.map(([b, c, a]) => "0 0 " + Math.min(MAX_BLUR, +(b * k).toFixed(1)) + "px " + glowColor(c, a)).join(",");
  const parts = [];
  if (hue) parts.push(hue);
  if (item.dropGlow && (t.g !== 1 || hue)) parts.push("drop-shadow(0 0 " + Math.min(MAX_DROP_BLUR, +(item.dropGlow[0] * k).toFixed(1)) + "px " + glowColor(item.dropGlow[1], item.dropGlow[2]) + ")");
  else if (hue) { /* ไม่มี drop-shadow ในคลาส: ใช้ hue-rotate อย่างเดียว */ }
  if (parts.length) st.filter = parts.join(" ");
  return Object.keys(st).length ? st : null;
}

export default function TextFx({ fx, lite, tune, style, children }) {
  const item = TEXTFX_ENABLED && fx ? FX_BY_ID[fx] : null;
  const mode = useTextFxMode();
  const active = !!item && !item.plain && mode !== "off";
  useEffect(() => { if (active) ensureFont(item); }, [active, fx]); // eslint-disable-line
  if (!active) return <span style={style}>{children}</span>;
  injectCss();
  const ts = tuneStyle(item, tune);
  return <span className={"wm-tfx wm-tfx-" + item.id + (lite ? " wm-tfx-lite" : "")} data-tfx={item.id} style={ts ? { ...ts, ...style } : style}>{children}</span>;
}
