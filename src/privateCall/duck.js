// ระหว่างคุยสายส่วนตัว: ห้องเสียงหลักต้อง "ไม่รบกวน" ทั้งสองทาง
//   1) ไมค์ห้องถูกปิด (คนในห้องจะไม่ได้ยินสายส่วนตัวของเรา) แล้วเปิดคืนให้ถ้าเดิมเปิดอยู่
//   2) เสียงของห้อง (audio[data-lk]) ถูกปิดเฉพาะฝั่งเรา เพื่อให้ได้ยินแต่สาย แล้วเปิดคืนตอนวางสาย
import { useEffect, useRef } from "react";
import { useCallActive } from "./store.js";

const sel = "audio[data-lk]";
export function muteRoomAudio(doc) {
  const D = doc || (typeof document !== "undefined" ? document : null);
  if (!D) return () => {};
  const touched = new Set();
  const apply = (el) => { if (!el.muted) { el.muted = true; touched.add(el); } };
  D.querySelectorAll(sel).forEach(apply);
  const MO = typeof MutationObserver !== "undefined" ? MutationObserver : null;
  const mo = MO ? new MO(() => D.querySelectorAll(sel).forEach(apply)) : null; // เสียงของคนที่เพิ่งเข้าห้องระหว่างโทร ก็ต้องเงียบด้วย
  if (mo) mo.observe(D.body, { childList: true, subtree: true });
  return () => { if (mo) mo.disconnect(); touched.forEach(el => { try { el.muted = false; } catch (e) { /* */ } }); touched.clear(); };
}

// ใช้ใน VoiceRoomsPage: useRoomDuck({micOn,setMic}) → คืน true ถ้ากำลังคุยสายอยู่ (ไว้กันกดเปิดไมค์ห้อง)
export function useRoomDuck({ micOn, setMic }) {
  const active = useCallActive();
  const was = useRef(false);
  const live = useRef({}); live.current = { micOn, setMic };
  useEffect(() => {
    if (!active) return undefined;
    const { micOn: on, setMic: sm } = live.current;
    was.current = !!on;
    if (on) sm(false);
    const un = muteRoomAudio();
    return () => { un(); if (was.current) { was.current = false; live.current.setMic(true); } };
  }, [active]);
  useEffect(() => { if (active && micOn) { was.current = true; live.current.setMic(false); } }, [active, micOn]); // เข้าห้องระหว่างสายแล้วระบบเปิดไมค์ให้อัตโนมัติ → ปิดซ้ำ
  return active;
}
