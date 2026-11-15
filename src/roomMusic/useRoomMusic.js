// Room Music — ตัวดูแลตัวเล่น YouTube ในห้องคุย (ไม่แสดงอะไรเอง คืนสถานะให้หน้าจอใช้)
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createWakeLock } from "../backgroundAudio/wakeLock.js";
import { WAKE_PREF_KEY, RESUME_TAP_HINT_MS, PAUSE_NEAR_HIDE_MS, AUTOPLAY_HINT_MS, SYNC_TOLERANCE_S } from "./config.js";
import { isYtOrigin, parseYtMessage, createPlayTracker, planReturn, shouldHoldWake, liveSeconds, parseWakePref, initialSyncAt, YT } from "./logic.js";

// ส่งคำสั่งให้ตัวเล่น YouTube (ต้องมี enablejsapi=1 ในลิงก์ฝัง)
const send = (iframe, msg) => { try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify(msg), "*"); } catch (e) { /* ignore */ } };
const cmd = (iframe, func, args = []) => send(iframe, { event: "command", func, args, id: 1, channel: "widget" });

// ── ค่า "กันจอดับระหว่างเล่นเพลง" (เก็บในเครื่องนี้ ใช้ร่วมกันทุกห้อง) ──
let wakePref = null;
const subs = new Set();
function getWakePref() {
  if (wakePref === null) { try { wakePref = parseWakePref(localStorage.getItem(WAKE_PREF_KEY)); } catch (e) { wakePref = true; } }
  return wakePref;
}
export function setMusicWakePref(v) {
  wakePref = !!v;
  try { localStorage.setItem(WAKE_PREF_KEY, v ? "1" : "0"); } catch (e) { /* ignore */ }
  subs.forEach(f => f());
}
const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const useMusicWakePref = () => useSyncExternalStore(subscribe, getWakePref, () => true);

const wakeSupported = () => typeof navigator !== "undefined" && !!navigator.wakeLock && typeof navigator.wakeLock.request === "function";

// iframeRef = ตัวเล่น · active = เครื่องนี้กำลังเล่นเพลงของห้องอยู่ · songKey เปลี่ยน = ตัวเล่นใหม่ · startedAt = เวลาที่ห้องเริ่มเพลง
// acceptOrigin ใช้เปลี่ยนเฉพาะตอนทดสอบ (ค่าเริ่มต้นรับเฉพาะข้อความจาก YouTube)
export function useRoomMusicKeeper(iframeRef, { active, songKey, startedAt, acceptOrigin = isYtOrigin }) {
  const tracker = useRef(null);
  if (!tracker.current) tracker.current = createPlayTracker({ nearHideMs: PAUSE_NEAR_HIDE_MS });
  const [playing, setPlaying] = useState(false);
  const [tapReason, setTapReason] = useState("");   // "" · "return" = หยุดตอนออกจากแอป · "autoplay" = เบราว์เซอร์ไม่ให้เปิดเสียงเอง
  const needTap = !!tapReason;
  const [wakeHeld, setWakeHeld] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const pref = useMusicWakePref();
  const startedRef = useRef(startedAt); startedRef.current = startedAt;
  const needTapRef = useRef(false); needTapRef.current = needTap;
  const gotMsg = useRef(false), hsTimers = useRef([]), tapTimer = useRef(null), autoTimer = useRef(null);
  const timeRef = useRef(null), syncPending = useRef(true), activeRef = useRef(active); activeRef.current = active;

  // ตัวเล่นใหม่ (เพลงเปลี่ยน / กดเข้าฟังใหม่) → เริ่มนับใหม่
  useEffect(() => { tracker.current.reset(); setPlaying(false); setTapReason(""); gotMsg.current = false; timeRef.current = null; syncPending.current = true; clearTimeout(tapTimer.current); clearTimeout(autoTimer.current); }, [songKey]);

  // ฟังสถานะจากตัวเล่น
  useEffect(() => {
    if (!active) return undefined;
    const onMsg = e => {
      const f = iframeRef.current;
      if (!f || e.source !== f.contentWindow || !acceptOrigin(e.origin)) return;
      const m = parseYtMessage(e.data);
      if (!m) return;
      gotMsg.current = true;
      const t = tracker.current;
      if (m.duration) t.onDuration(m.duration);
      if (typeof m.time === "number") timeRef.current = m.time;
      if (typeof m.state === "number") {
        t.onState(m.state, Date.now());
        setPlaying(t.playing);
        if (m.state === 1) clearTimeout(autoTimer.current);
        if (m.state === 1 && needTapRef.current) {   // ผู้ใช้แตะ ▶ เองแล้ว → ข้ามไปตรงที่ห้องกำลังเล่น
          setTapReason(""); syncPending.current = false;
          const at = liveSeconds(startedRef.current, Date.now());
          if (at != null) cmd(f, "seekTo", [at, true]);
        }
      }
      // เริ่มเล่นครั้งแรก: ช้ากว่าห้องเพราะเวลาโหลด → ข้ามไปตรงที่ห้องเล่นอยู่ (ครั้งเดียว)
      if (syncPending.current && t.playing && timeRef.current != null) {
        syncPending.current = false;
        const at = initialSyncAt({ startedAt: startedRef.current, now: Date.now(), time: timeRef.current, duration: t.duration, tolerance: SYNC_TOLERANCE_S });
        if (at != null) cmd(f, "seekTo", [at, true]);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [active, iframeRef, acceptOrigin]);

  // เรียกเมื่อ iframe โหลดเสร็จ: ขอให้ตัวเล่นส่งสถานะมาให้ (ส่งซ้ำจนกว่าจะได้คำตอบ)
  const onLoad = useCallback(() => {
    hsTimers.current.forEach(clearTimeout);
    gotMsg.current = false;
    // ตัวเล่นไม่เริ่มเอง (เบราว์เซอร์บล็อกเสียงอัตโนมัติ) → บอกให้แตะ ▶ บนวิดีโอ
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      const s = tracker.current.state;
      if (activeRef.current && !tracker.current.playing && (s === YT.UNSTARTED || s === YT.CUED)) setTapReason("autoplay");
    }, AUTOPLAY_HINT_MS);
    hsTimers.current = [0, 500, 1500, 3000, 6000].map(ms => setTimeout(() => {
      if (!gotMsg.current) send(iframeRef.current, { event: "listening", id: 1, channel: "widget" });
    }, ms));
  }, [iframeRef]);
  useEffect(() => () => { hsTimers.current.forEach(clearTimeout); clearTimeout(tapTimer.current); clearTimeout(autoTimer.current); }, []);

  // ออกจากแอป / กลับมา
  useEffect(() => {
    if (!active) return undefined;
    const onShown = () => {
      const t = tracker.current;
      const plan = planReturn({ playingAtHide: t.takeShow(), state: t.state, startedAt: startedRef.current, now: Date.now(), duration: t.duration });
      if (plan.action !== "resume") return;
      const f = iframeRef.current;
      if (plan.at != null) cmd(f, "seekTo", [plan.at, true]);
      cmd(f, "playVideo");
      clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => { if (!tracker.current.playing) setTapReason("return"); }, RESUME_TAP_HINT_MS);
    };
    const onVis = () => {
      const v = document.visibilityState !== "hidden";
      setVisible(v);
      if (v) onShown(); else tracker.current.onHide(Date.now());
    };
    const onPageShow = e => { if (e && e.persisted) { setVisible(true); onShown(); } };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pageshow", onPageShow); };
  }, [active, iframeRef]);

  // กันจอดับระหว่างเพลงกำลังเล่น
  const hold = !!active && shouldHoldWake({ pref, playing, visible });
  useEffect(() => {
    if (!hold) return undefined;
    const wl = createWakeLock(navigator, document);
    let off = false;
    wl.enable().then(() => { if (!off) setWakeHeld(wl.isHeld()); });
    return () => { off = true; wl.disable(); setWakeHeld(false); };
  }, [hold]);

  return { onLoad, playing: !!active && playing, needTap: !!active && needTap, tapReason: active ? tapReason : "", wakeSupported: wakeSupported(), wakePref: pref, setWakePref: setMusicWakePref, wakeHeld };
}
