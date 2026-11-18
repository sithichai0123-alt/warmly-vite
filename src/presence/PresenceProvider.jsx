import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HEARTBEAT_MS, STALE_MS, PRESENCE_ENABLED, PRESENCE_WINDOW_ENABLED, PRESENCE_WINDOW_MS, PRESENCE_START_WAIT_MS } from "./config.js";
import { computeStatus, statusLabel, windowStart, countOnline } from "./logic.js";
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
  // โหมดหน้าต่าง: ฟังเฉพาะคนที่เพิ่ง active + ดึงทีละคนเมื่อจำเป็น (ปิดที่ config.js = ฟังทุกคนแบบเดิม)
  const windowed = PRESENCE_WINDOW_ENABLED && !!(api && api.getOne);
  const [extra, setExtra] = useState({});   // สถานะที่ดึงทีละคน (คนที่เงียบนานจนไม่อยู่ในหน้าต่าง)
  const [seed, setSeed] = useState(null);   // สถานะเดิมของ "เรา" (เผื่อเก่าจนไม่อยู่ในหน้าต่าง) ไว้รับค่าตั้งค่าซ่อนสถานะจากบัญชี
  const asked = useRef(new Set());

  // ฟังสถานะ (ทุกคน หรือเฉพาะคนที่เพิ่ง active)
  useEffect(() => {
    if (!active) return undefined;
    const since = windowed ? windowStart(Date.now(), PRESENCE_WINDOW_MS) : undefined;
    const unsub = api.subscribe(setDocs, e => console.error("presence", e), since);
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [active, api, windowed]);

  // อ่านสถานะเดิมของเราครั้งเดียว (ล้างของที่ดึงไว้เมื่อเปลี่ยนบัญชี) ใช้ 2 อย่าง:
  //   1) โหมดหน้าต่าง: เอกสารของเราอาจเก่าจนไม่อยู่ในหน้าต่าง
  //   2) เครื่องที่ยังไม่เคยตั้งค่าซ่อนสถานะ: รับค่าที่เคยตั้งไว้จากบัญชี "ก่อน" ส่งสถานะครั้งแรก (ready = พร้อมส่งสถานะ)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    asked.current = new Set(); setExtra({}); setSeed(null);
    if (!active) { setReady(false); return undefined; }
    const mustWait = !!api.getOne && !getPresencePrefs().explicit;   // เครื่องใหม่: ต้องรู้ค่าของบัญชีก่อน
    setReady(!mustWait);
    if (!api.getOne || (!windowed && !mustWait)) return undefined;
    let dead = false;
    const go = () => { if (!dead) setReady(true); };
    api.getOne(uid).then(d => {
      if (dead) return;
      if (d) { if (windowed) setSeed(d); adoptRemotePrefs(d); }
      setReady(true);
    }).catch(go);
    const timer = mustWait ? setTimeout(go, PRESENCE_START_WAIT_MS) : null;
    return () => { dead = true; if (timer) clearTimeout(timer); };
  }, [active, windowed, api, uid]);

  // ขอดึงสถานะของคนที่ไม่อยู่ในหน้าต่าง (ครั้งเดียวต่อคน)
  const request = useCallback(id => {
    if (!windowed || !id || asked.current.has(id)) return;
    asked.current.add(id);
    api.getOne(id).then(d => setExtra(x => ({ ...x, [id]: d || null }))).catch(() => { asked.current.delete(id); });
  }, [api, windowed]);

  // นาฬิกา: ให้ "ค้างเกิน STALE_MS = ออฟไลน์" และข้อความ "กี่นาทีที่แล้ว" อัปเดตเอง
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [active]);

  // ส่งสถานะของเรา (เครื่องใหม่รอรับค่าตั้งค่าจากบัญชีก่อน)
  useEffect(() => {
    if (!active || !ready) return undefined;
    const c = createPresenceController({
      write: payload => api.write(uid, payload),
      getPrefs: getPresencePrefs,
      doc: typeof document !== "undefined" ? document : null,
      win: typeof window !== "undefined" ? window : null,
      heartbeatMs: HEARTBEAT_MS,
    });
    ctrl.current = c; c.start();
    return () => { c.stop(); ctrl.current = null; };
  }, [active, ready, api, uid]);

  // เปลี่ยนค่าตั้ง (ซ่อน/แสดง) → ส่งสถานะใหม่ทันที
  useEffect(() => { ctrl.current && ctrl.current.refresh(); }, [prefs.showOnline, prefs.showLast]);

  // อุปกรณ์ใหม่ที่ยังไม่เคยตั้งค่า → รับค่าที่เคยตั้งไว้จากบัญชี
  const mine = uid ? (docs[uid] || seed) : null;
  useEffect(() => { if (mine) adoptRemotePrefs(mine); }, [mine]);

  const value = useMemo(() => (active ? { docs, now, extra, request, windowed } : null), [active, docs, now, extra, request, windowed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePresence(uid) {
  const v = useContext(Ctx);
  if (!v || !uid) return OFFLINE;
  return computeStatus(docOf(v, uid), v.now, STALE_MS);
}
// เอกสารสถานะของคนนี้: จากที่ฟังอยู่ก่อน ไม่มีค่อยดูที่ดึงทีละคน
const docOf = (v, uid) => v.docs[uid] || (v.extra && v.extra[uid]) || undefined;
export function usePresenceLabel(uid) {
  const v = useContext(Ctx);
  const st = usePresence(uid);
  const need = !!(v && v.windowed && uid && !v.docs[uid]);   // ไม่อยู่ในหน้าต่าง = เงียบนาน → ดึงเวลา "ออนไลน์ล่าสุด" มาครั้งเดียว
  useEffect(() => { if (need) v.request(uid); }, [need, uid]); // eslint-disable-line
  if (!v || !uid) return "";
  return statusLabel(st, v.now);
}
export function usePresenceEnabled() { return !!useContext(Ctx); }
// ฟังก์ชันเช็กออนไลน์ของใครก็ได้ (ใช้กับรายชื่อ: เพื่อน/เชิญเข้าห้อง) — ตามค่าที่เจ้าตัวตั้งซ่อนสถานะไว้ด้วย
export function useIsOnline() {
  const v = useContext(Ctx);
  return (uid) => !!v && !!uid && computeStatus(docOf(v, uid), v.now, STALE_MS).state === "online";
}
// จำนวนคนที่ออนไลน์ตอนนี้ (นับจากสถานะที่ฟังอยู่ ไม่ต้องใช้รายชื่อผู้ใช้ทั้งหมด)
export function useOnlineCount() {
  const v = useContext(Ctx);
  return useMemo(() => (v ? countOnline(v.docs, v.now, STALE_MS) : 0), [v]);
}

// จุดสถานะมุมขวาล่างของรูปโปรไฟล์ (วางใน wrapper ที่เป็น position:relative)
export function PresenceDot({ uid, size = 40, bg = "var(--app-background,#0F0E17)", green = "var(--presence-on,#22C55E)", gray = "var(--presence-off,#6B7280)" }) {
  const v = useContext(Ctx);
  const st = usePresence(uid);
  if (!v || !uid) return null;
  const d = Math.max(9, Math.round(size * 0.24));
  return <span data-presence-dot={st.state} title={st.state === "online" ? "ออนไลน์" : "ออฟไลน์"} style={{ position: "absolute", bottom: 0, right: 0, width: d, height: d, borderRadius: "50%", background: st.state === "online" ? green : gray, border: "2px solid " + bg, boxShadow: st.state === "online" ? "0 0 6px 1px var(--presence-glow,transparent)" : "none", boxSizing: "content-box", pointerEvents: "none" }} />;
}

// ข้อความสถานะ: "● ออนไลน์" / "ออนไลน์ล่าสุด 5 นาทีที่แล้ว" (ไม่มีข้อมูล/ซ่อนเวลา = ไม่แสดงอะไร)
export function PresenceText({ uid, style, green = "#22C55E" }) {
  const st = usePresence(uid);
  const label = usePresenceLabel(uid);
  if (!label) return null;
  return <span data-presence-text={st.state} style={{ fontSize:12, color: st.state === "online" ? green : undefined, ...style }}>{st.state === "online" ? "● " : ""}{label}</span>;
}
