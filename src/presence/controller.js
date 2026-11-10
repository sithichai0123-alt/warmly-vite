// Presence — ตัวส่งสัญญาณของ "เรา" (ไม่มี React / ไม่แตะ Firebase โดยตรง: รับ write() จากภายนอก)
//   เปิดแอป/กลับมาที่หน้าจอ → ออนไลน์ + heartbeat ทุก heartbeatMs
//   ซ่อนแอป/สลับแท็บ/ปิดหน้า → ออฟไลน์ทันที (ส่งไม่ทันก็มี STALE_MS ครอบอยู่)
//   โหมดซ่อน (showOnline=false) → ไม่ส่ง heartbeat เลย (ประหยัดด้วย)
import { buildPresenceWrite } from "./logic.js";

export function createPresenceController({ write, getPrefs, doc, win, heartbeatMs, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let timer = null;
  let running = false;

  const visible = () => !doc || doc.visibilityState !== "hidden";
  const send = state => {
    try {
      const r = write(buildPresenceWrite(state, getPrefs()));
      if (r && typeof r.catch === "function") r.catch(() => { /* ไม่ให้สถานะทำแอปล้ม */ });
    } catch (e) { /* ignore */ }
  };
  const hiddenPref = () => getPrefs().showOnline === false;
  const stopTimer = () => { if (timer) { clearIntervalFn(timer); timer = null; } };
  const startTimer = () => {
    stopTimer();
    if (hiddenPref()) return;
    timer = setIntervalFn(() => { if (visible() && !hiddenPref()) send("online"); }, heartbeatMs);
  };
  const goOnline = () => { send("online"); startTimer(); };
  const goOffline = () => { stopTimer(); send("offline"); };

  const onVis = () => { if (!running) return; visible() ? goOnline() : goOffline(); };
  const onHide = () => { if (running) goOffline(); };
  const onNet = () => { if (running && visible()) goOnline(); };

  return {
    start() {
      if (running) return; running = true;
      doc && doc.addEventListener && doc.addEventListener("visibilitychange", onVis);
      win && win.addEventListener && (win.addEventListener("pagehide", onHide), win.addEventListener("online", onNet));
      visible() ? goOnline() : goOffline();
    },
    // เปลี่ยนค่าตั้งค่า (ซ่อน/แสดง) → เขียนสถานะใหม่ทันที
    refresh() { if (!running) return; visible() ? goOnline() : goOffline(); },
    stop() {
      if (!running) return; running = false;
      doc && doc.removeEventListener && doc.removeEventListener("visibilitychange", onVis);
      win && win.removeEventListener && (win.removeEventListener("pagehide", onHide), win.removeEventListener("online", onNet));
      goOffline();
    },
    _hasTimer: () => !!timer,
  };
}
