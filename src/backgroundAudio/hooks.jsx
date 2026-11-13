import { useCallback, useEffect, useRef } from "react";
import { showBanner, hideBanner } from "../social/bus.js";
import { createKeepAlive } from "./keepAlive.js";
import { createMediaSession } from "./mediaSession.js";
import { createWakeLock } from "./wakeLock.js";
import { planResume, pruneTries, mediaTitle, detectPlatform, platformNotice } from "./logic.js";
import { REJOIN_RETRY_MS } from "./config.js";
import { useSessions, useBgPrefs, useBgStatus, setBgPrefs, setBgStatus, getBgStatus } from "./store.js";

// ตัวดูแลเสียงเบื้องหลัง: ไม่แสดงอะไรบนจอ ทำงานเมื่อมีห้องเสียง (หรือสายส่วนตัว) ที่ผู้ใช้อยู่เท่านั้น
//  1) เล่นเสียงเงียบวนซ้ำ + ตั้งชื่อ/ปุ่มบนหน้าจอล็อก  2) (ถ้าเปิด) กันจอดับ
//  3) เมื่อกลับมาที่หน้าจอ/เน็ตกลับมา: ปลุกเสียงที่ถูกหยุด และเชื่อมต่อห้องใหม่ให้ถ้าหลุด (ไม่เปิดไมค์ให้เองถ้าเราปิดไว้)
export function BackgroundAudioKeeper({ callActive = false }) {
  const sessions = useSessions();
  const prefs = useBgPrefs();
  const active = sessions.length > 0 || !!callActive;
  const title = sessions.length ? mediaTitle(sessions[0].title, "room") : mediaTitle("", "call");
  const sessRef = useRef(sessions); sessRef.current = sessions;
  const kaRef = useRef(null), triesRef = useRef([]), rejoining = useRef(false), retryT = useRef(null);

  const playPaused = useCallback(() => {
    document.querySelectorAll("audio[data-lk],audio[data-lk-call]").forEach(el => { if (el.paused) { try { const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } });
    const ka = kaRef.current;
    if (ka && !ka.isPlaying()) ka.start().then(ok => setBgStatus({ keepAlive: ok }));
  }, []);

  const rejoinIfNeeded = useCallback(async () => {
    for (const s of sessRef.current) {
      const now = Date.now();
      triesRef.current = pruneTries(triesRef.current, now);
      const plan = planResume({ wanted: true, state: s.getState ? s.getState() : null, connecting: rejoining.current, tries: triesRef.current, now });
      if (plan.exhausted) {
        showBanner({ key: "bg-rejoin", title: "⚠️ เชื่อมต่อห้องเสียงไม่สำเร็จ", body: "กดลองใหม่ หรือกด 📵 ออกจากห้องแล้วเข้าใหม่", ttl: 9000, actions: [{ id: "retry", label: "ลองใหม่", primary: true, onClick: () => { triesRef.current = []; rejoinIfNeeded(); } }] });
        continue;
      }
      if (!plan.rejoin || !s.rejoin) continue;
      rejoining.current = true; triesRef.current = [...triesRef.current, now];
      setBgStatus({ rejoins: getBgStatus().rejoins + 1 });
      showBanner({ key: "bg-rejoin", title: "🔄 กำลังเชื่อมต่อเสียงห้องใหม่...", ttl: 15000 });
      try { await s.rejoin(); } catch (e) { /* ลองใหม่ด้านล่าง */ }
      rejoining.current = false;
      if (s.getState && s.getState() === "connected") { hideBanner("bg-rejoin"); showBanner({ key: "bg-rejoin-ok", title: "✅ กลับเข้าห้องเสียงแล้ว", ttl: 2500 }); }
      else if (document.visibilityState === "visible") { clearTimeout(retryT.current); retryT.current = setTimeout(() => rejoinIfNeeded(), REJOIN_RETRY_MS); }
    }
  }, []);

  const resume = useCallback(() => {
    setBgStatus({ lastResumeAt: Date.now() });
    playPaused();
    sessRef.current.forEach(s => { try { s.enableAudio && s.enableAudio(); } catch (e) { /* ignore */ } });
    return rejoinIfNeeded();
  }, [playPaused, rejoinIfNeeded]);

  // เสียงเงียบ + ชื่อห้องบนหน้าจอล็อก
  useEffect(() => {
    if (!active) return undefined;
    const ka = createKeepAlive(document); kaRef.current = ka;
    let off = false;
    ka.start().then(ok => { if (!off) setBgStatus({ keepAlive: ok }); });
    const ms = createMediaSession(navigator);
    setBgStatus({ mediaSession: ms.set({ title, onPause: () => sessRef.current.forEach(s => s.onPause && s.onPause()), onPlay: () => { resume(); } }) });
    const retry = () => { if (!ka.isPlaying()) ka.start().then(ok => { if (!off) setBgStatus({ keepAlive: ok }); }); }; // กฎ autoplay: ลองใหม่เมื่อผู้ใช้แตะหน้าจอ
    window.addEventListener("pointerdown", retry, { passive: true });
    return () => { off = true; window.removeEventListener("pointerdown", retry); ka.stop(); kaRef.current = null; ms.clear(); setBgStatus({ keepAlive: false, mediaSession: false }); };
  }, [active, title]); // eslint-disable-line

  // กันจอดับ (เฉพาะเมื่อผู้ใช้เปิดเอง)
  useEffect(() => {
    if (!active || !prefs.wake) { setBgStatus({ wakeLock: false }); return undefined; }
    const wl = createWakeLock(navigator, document);
    wl.enable().then(() => setBgStatus({ wakeLock: wl.isHeld() }));
    return () => { wl.disable(); setBgStatus({ wakeLock: false }); };
  }, [active, prefs.wake]);

  // กลับมาที่หน้าจอ / เน็ตกลับมา → ปลุกเสียง + เชื่อมต่อใหม่ถ้าหลุด; เฝ้าดูเบา ๆ ตอนเปิดหน้าอยู่ (เช่น เน็ตหลุดนานจน LiveKit ยอมแพ้)
  useEffect(() => {
    if (!active) return undefined;
    const onVis = () => { if (document.visibilityState === "visible") resume(); };
    const onBack = () => { resume(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onBack); window.addEventListener("focus", onBack); window.addEventListener("online", onBack);
    const watch = setInterval(() => { if (document.visibilityState === "visible") rejoinIfNeeded(); }, 8000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onBack); window.removeEventListener("focus", onBack); window.removeEventListener("online", onBack);
      clearInterval(watch); clearTimeout(retryT.current); rejoining.current = false; triesRef.current = [];
    };
  }, [active, resume, rejoinIfNeeded]);

  return null;
}

// แผงข้อมูล 🌙: บอกสถานะจริง + ข้อจำกัดของเครื่องนี้ + สวิตช์กันจอดับ
const C = { card: "#221F33", border: "#2E2A45", borderHi: "#4F46A8", text: "#F0EEFF", sub: "#9B94C4", green: "#34D399", yellow: "#F59E0B", brand: "#7C6BF0" };
const Row = ({ ok, label, hint }) => (
  <div data-bg-row style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 13, color: C.text }}>
    <span style={{ width: 18, textAlign: "center", color: ok === true ? C.green : ok === false ? C.yellow : C.sub }}>{ok === true ? "✅" : ok === false ? "⚠️" : "•"}</span>
    <div style={{ flex: 1 }}>{label}{hint && <div style={{ fontSize: 11, color: C.sub }}>{hint}</div>}</div>
  </div>
);
export function BackgroundAudioPanel({ onClose }) {
  const st = useBgStatus(), prefs = useBgPrefs();
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const platform = detectPlatform(nav.userAgent, nav.maxTouchPoints);
  const standalone = (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) || nav.standalone === true;
  const notice = platformNotice(platform, { standalone });
  const wlSupported = !!(nav.wakeLock && nav.wakeLock.request);
  return (
    <div data-bg-panel style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.55)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80dvh", overflowY: "auto", background: C.card, border: "1px solid " + C.borderHi, borderRadius: "18px 18px 0 0", padding: "16px 16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: C.text }}>🌙 ฟังต่อเมื่อพับจอ / ล็อกจอ</div>
          <button type="button" data-bg-close onClick={onClose} style={{ border: "none", background: "transparent", color: C.sub, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <div data-bg-notice={notice.level} style={{ background: notice.level === "ok" ? "rgba(52,211,153,.10)" : "rgba(245,158,11,.12)", border: "1px solid " + (notice.level === "ok" ? "rgba(52,211,153,.35)" : "rgba(245,158,11,.4)"), borderRadius: 12, padding: "10px 12px", margin: "8px 0 10px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{notice.title}</div>
          {notice.lines.map((l, i) => <div key={i} style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>• {l}</div>)}
        </div>
        <Row ok={st.keepAlive} label="เสียงเงียบกันระบบหยุดหน้าเว็บ" hint={st.keepAlive ? "ทำงานอยู่" : "ยังไม่เริ่ม — แตะหน้าจอหนึ่งครั้ง (เบราว์เซอร์ต้องการให้ผู้ใช้แตะก่อน)"} />
        <Row ok={st.mediaSession} label="ชื่อห้อง/ปุ่มบนหน้าจอล็อก" hint={st.mediaSession ? "ปุ่มหยุด = ปิดไมค์ (ไม่ออกจากห้อง)" : "เบราว์เซอร์นี้ไม่รองรับ"} />
        <Row ok={wlSupported ? (prefs.wake ? st.wakeLock : null) : false} label="กันจอดับขณะอยู่ในห้อง" hint={wlSupported ? (prefs.wake ? (st.wakeLock ? "ทำงานอยู่" : "ขอไม่สำเร็จ (อาจเปิดโหมดประหยัดแบต)") : "ปิดอยู่") : "เครื่องนี้ไม่รองรับ"} />
        {wlSupported && <button type="button" data-bg-wake onClick={() => setBgPrefs({ wake: !prefs.wake })} style={{ marginTop: 8, width: "100%", border: "1px solid " + C.borderHi, background: prefs.wake ? C.brand : "transparent", color: prefs.wake ? "#fff" : C.text, borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{prefs.wake ? "🔆 กันจอดับ: เปิดอยู่ (แตะเพื่อปิด)" : "🔅 เปิดกันจอดับ (กินแบตมากขึ้น)"}</button>}
        <div style={{ fontSize: 11, color: C.sub, marginTop: 12, lineHeight: 1.5 }}>ถ้าระบบตัดการเชื่อมต่อตอนอยู่เบื้องหลัง แอปจะเชื่อมต่อห้องให้ใหม่เมื่อคุณกลับมา (ไมค์ที่ปิดไว้จะยังปิดอยู่) เพลง YouTube ที่ฝังในห้องอาจหยุดเมื่ออยู่เบื้องหลังตามข้อจำกัดของเบราว์เซอร์ ถ้าเงียบหลังกลับมาให้กดเล่นเพลงใหม่</div>
      </div>
    </div>
  );
}
