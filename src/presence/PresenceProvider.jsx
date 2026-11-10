import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HEARTBEAT_MS, STALE_MS, PRESENCE_ENABLED } from "./config.js";
import { computeStatus, statusLabel } from "./logic.js";
import { createPresenceController } from "./controller.js";
import { getPresencePrefs, adoptRemotePrefs, usePresencePrefs } from "./store.js";

const Ctx = createContext(null);
const OFFLINE = { state: "offline", lastSeen: null };

// ครอบแอป: ฟังสถานะทุกคน + ส่งสถานะของเรา (ทำงานเฉพาะเมื่อ uid มีค่า = ล็อกอินแล้ว)
export function PresenceProvider({ api, uid, children }) {
  const [docs, setDocs] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const prefs = usePresencePrefs();
  const ctrl = useRef(null);
  const active = PRESENCE_ENABLED && !!uid && !!api;

  // ฟังสถานะทุกคน
  useEffect(() => {
    if (!active) return undefined;
    const unsub = api.subscribe(setDocs, e => console.error("presence", e));
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [active, api]);

  // นาฬิกา: ให้ "ค้างเกิน STALE_MS = ออฟไลน์" และข้อความ "กี่นาทีที่แล้ว" อัปเดตเอง
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);

  // ส่งสถานะของเรา
  useEffect(() => {
    if (!active) return undefined;
    const c = createPresenceController({
      write: payload => api.write(uid, payload),
      getPrefs: getPresencePrefs,
      doc: typeof document !== "undefined" ? document : null,
      win: typeof window !== "undefined" ? window : null,
      heartbeatMs: HEARTBEAT_MS,
    });
    ctrl.current = c; c.start();
    return () => { c.stop(); ctrl.current = null; };
  }, [active, api, uid]);

  // เปลี่ยนค่าตั้ง (ซ่อน/แสดง) → ส่งสถานะใหม่ทันที
  useEffect(() => { ctrl.current && ctrl.current.refresh(); }, [prefs.showOnline, prefs.showLast]);

  // อุปกรณ์ใหม่ที่ยังไม่เคยตั้งค่า → รับค่าที่เคยตั้งไว้จากบัญชี
  const mine = uid ? docs[uid] : null;
  useEffect(() => { if (mine) adoptRemotePrefs(mine); }, [mine]);

  const value = useMemo(() => (active ? { docs, now } : null), [active, docs, now]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePresence(uid) {
  const v = useContext(Ctx);
  if (!v || !uid) return OFFLINE;
  return computeStatus(v.docs[uid], v.now, STALE_MS);
}
export function usePresenceLabel(uid) {
  const v = useContext(Ctx);
  const st = usePresence(uid);
  if (!v || !uid) return "";
  return statusLabel(st, v.now);
}
export function usePresenceEnabled() { return !!useContext(Ctx); }

// จุดสถานะมุมขวาล่างของรูปโปรไฟล์ (วางใน wrapper ที่เป็น position:relative)
export function PresenceDot({ uid, size = 40, bg = "#0F0E17", green = "#22C55E", gray = "#6B7280" }) {
  const v = useContext(Ctx);
  const st = usePresence(uid);
  if (!v || !uid) return null;
  const d = Math.max(9, Math.round(size * 0.24));
  return <span data-presence-dot={st.state} title={st.state === "online" ? "ออนไลน์" : "ออฟไลน์"} style={{ position: "absolute", bottom: 0, right: 0, width: d, height: d, borderRadius: "50%", background: st.state === "online" ? green : gray, border: "2px solid " + bg, boxSizing: "content-box", pointerEvents: "none" }} />;
}

// ข้อความสถานะ: "● ออนไลน์" / "ออนไลน์ล่าสุด 5 นาทีที่แล้ว" (ไม่มีข้อมูล/ซ่อนเวลา = ไม่แสดงอะไร)
export function PresenceText({ uid, style, green = "#22C55E" }) {
  const st = usePresence(uid);
  const label = usePresenceLabel(uid);
  if (!label) return null;
  return <span data-presence-text={st.state} style={{ fontSize: 11, color: st.state === "online" ? green : undefined, ...style }}>{st.state === "online" ? "● " : ""}{label}</span>;
}
