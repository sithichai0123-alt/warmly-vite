// Text FX — คอมโพเนนต์ครอบข้อความ: fx = รหัสไอเทม (จาก resolveTextFx) → แสดงด้วยฟอนต์/เอฟเฟกต์นั้น
// ไม่ได้ระบุ fx / ไอเทมไม่มี / ปิดระบบ / โหมด off → แสดงข้อความธรรมดา (span เปล่า) ไม่เปลี่ยนอะไร
import { useEffect } from "react";
import { TEXTFX_ENABLED } from "./config.js";
import { FX_BY_ID } from "./catalog.js";
import { ensureFont } from "./fonts.js";
import { injectCss } from "./css.js";
import { useTextFxMode } from "./store.js";

export default function TextFx({ fx, lite, style, children }) {
  const item = TEXTFX_ENABLED && fx ? FX_BY_ID[fx] : null;
  const mode = useTextFxMode();
  const active = !!item && !item.plain && mode !== "off";
  useEffect(() => { if (active) ensureFont(item); }, [active, fx]); // eslint-disable-line
  if (!active) return <span style={style}>{children}</span>;
  injectCss();
  return <span className={"wm-tfx wm-tfx-" + item.id + (lite ? " wm-tfx-lite" : "")} data-tfx={item.id} style={style}>{children}</span>;
}
