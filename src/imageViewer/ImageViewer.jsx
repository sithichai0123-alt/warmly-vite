// Image Viewer — แตะรูปแล้วเปิดเต็มจอ: คงสัดส่วนเดิม (ไม่ตัด ไม่บิดภาพ), ปิดได้หลายวิธี, ใช้ได้ทั้งมือถือและเดสก์ท็อป
//   • ปิด: ปุ่ม ✕ / กด Esc / แตะพื้นหลังดำ / ปุ่ม Back ของมือถือ (กลับหน้าเดิมโดยไม่ออกจากแอป)
//   • หลายรูป: ปุ่ม ‹ › / ลูกศรคีย์บอร์ด / ปัดซ้าย-ขวา
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { IMAGE_VIEWER_ENABLED } from "./config.js";

const Ctx = createContext(null);

// คืน { open(list, index) } — ถ้าระบบปิดอยู่หรืออยู่นอก Provider จะเป็นฟังก์ชันเปล่า (ไม่ error)
export function useImageViewer() {
  const c = useContext(Ctx);
  return c || { open: () => {}, enabled: false };
}

function Viewer({ list, start, onClose }) {
  const [i, setI] = useState(start);
  const [bad, setBad] = useState(false);
  const touch = useRef(null);
  const closeRef = useRef(null);
  const n = list.length;
  const go = useCallback(d => { setBad(false); setI(x => (x + d + n) % n); }, [n]);

  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // กันหน้าด้านหลังเลื่อน
    if (closeRef.current) closeRef.current.focus();
    const key = e => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (n > 1 && e.key === "ArrowLeft") go(-1);
      else if (n > 1 && e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* ignore */ } }
    };
  }, [go, n, onClose]);

  const onTouchStart = e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null;
    if (!s || n < 2) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };
  const arrow = (side, d) => (
    <button type="button" data-iv-nav={side} aria-label={side === "prev" ? "รูปก่อนหน้า" : "รูปถัดไป"} onClick={e => { e.stopPropagation(); go(d); }}
      style={{ position: "absolute", top: "50%", [side === "prev" ? "left" : "right"]: 10, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 26, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}>{side === "prev" ? "‹" : "›"}</button>
  );

  return (
    <div data-image-viewer role="dialog" aria-modal="true" aria-label="ดูรูปเต็มจอ" onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,.94)", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "pan-y pinch-zoom" }}>
      {bad
        ? <div style={{ color: "#fff", fontSize: 14, padding: 24, textAlign: "center" }}>โหลดรูปนี้ไม่ได้</div>
        : <img data-iv-img src={list[i]} alt="" onClick={e => e.stopPropagation()} onError={() => setBad(true)} draggable={false}
            style={{ maxWidth: "100vw", maxHeight: "100dvh", width: "auto", height: "auto", objectFit: "contain", display: "block", userSelect: "none" }} />}
      <button ref={closeRef} type="button" data-iv-close aria-label="ปิด" onClick={e => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: "max(10px, env(safe-area-inset-top))", right: 10, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
      {n > 1 && (
        <>
          {arrow("prev", -1)}{arrow("next", 1)}
          <div data-iv-count style={{ position: "absolute", bottom: "max(14px, env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 13, background: "rgba(0,0,0,.55)", borderRadius: 20, padding: "4px 12px" }}>{i + 1} / {n}</div>
        </>
      )}
    </div>
  );
}

export function ImageViewerProvider({ children }) {
  const [state, setState] = useState(null); // { id, list, index } | null
  const pushed = useRef(false);

  const close = useCallback(() => {
    setState(null);
    // เปิดไว้ด้วยการเพิ่มประวัติหนึ่งช่อง — ปิดด้วยตัวเองให้ถอยประวัติกลับ (ไม่ทิ้งช่องค้าง)
    if (pushed.current) { pushed.current = false; try { window.history.back(); } catch (e) { /* ignore */ } }
  }, []);

  const open = useCallback((list, index = 0) => {
    if (!IMAGE_VIEWER_ENABLED) return;
    const l = (Array.isArray(list) ? list : [list]).filter(x => typeof x === "string" && x);
    if (!l.length) return;
    setState({ id: Date.now() + Math.random(), list: l, index: Math.min(Math.max(0, index | 0), l.length - 1) });
    try {
      if (!pushed.current) { window.history.pushState({ wmViewer: 1 }, ""); pushed.current = true; }
    } catch (e) { pushed.current = false; }
  }, []);

  // ปุ่ม Back ของมือถือ/เบราว์เซอร์ = ปิดตัวดูรูป กลับหน้าเดิม
  useEffect(() => {
    const pop = () => { if (pushed.current) { pushed.current = false; setState(null); } };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  const value = useMemo(() => ({ open, enabled: IMAGE_VIEWER_ENABLED }), [open]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {state && createPortal(<Viewer key={state.id} list={state.list} start={state.index} onClose={close} />, document.body)}
    </Ctx.Provider>
  );
}
