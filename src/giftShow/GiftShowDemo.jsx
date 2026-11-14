// Gift Show — หน้าทดลองดูเอฟเฟกต์ของขวัญ (เปิดด้วย ?giftdemo=1)
// ไม่เสียเหรียญ ไม่ส่งให้ใคร ไม่แตะฐานข้อมูล — ใช้ทางเดินเดียวกับของขวัญจริงทุกอย่าง
// App.jsx ส่ง children = <GiftFx/> เข้ามาแสดงในเวที จึงเห็นของจริงไม่ใช่ของจำลอง
import { useEffect, useRef, useState } from "react";

const C = {
  bg: "#0F0E17", card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8",
  text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", brand2: "#A78BFA", gold: "#FBBF24", green: "#22C55E",
};

export default function GiftShowDemo({ items = [], onPlay, onClose, children }) {
  const [cur, setCur] = useState(null);     // { id, dur, t0 }
  const [prog, setProg] = useState(0);      // 0–1
  const [auto, setAuto] = useState(false);
  const raf = useRef(0), timer = useRef(0);

  const play = id => {
    const it = items.find(x => x.id === id);
    if (!it) return;
    setCur({ id, dur: it.dur, t0: performance.now() });
    setProg(0);
    if (onPlay) onPlay(id);
  };

  useEffect(() => {
    if (!cur) return;
    const step = () => {
      const p = (performance.now() - cur.t0) / (cur.dur * 1000);
      setProg(p > 1 ? 1 : p);
      if (p < 1) raf.current = requestAnimationFrame(step); else setCur(null);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [cur]);

  // เล่นทั้งหมดต่อกัน (เว้น .4 วิระหว่างชิ้น)
  useEffect(() => {
    if (!auto) { clearTimeout(timer.current); return; }
    let i = 0, stop = false;
    const next = () => {
      if (stop || i >= items.length) { setAuto(false); return; }
      const it = items[i++];
      play(it.id);
      timer.current = setTimeout(next, it.dur * 1000 + 400);
    };
    next();
    return () => { stop = true; clearTimeout(timer.current); };
  }, [auto]); // eslint-disable-line

  const playing = cur ? items.find(x => x.id === cur.id) : null;
  const groups = [["ทอง 100 เหรียญขึ้นไป", items.filter(i => i.cur !== "purple")], ["เหรียญม่วง", items.filter(i => i.cur === "purple")]];

  const row = it => {
    const on = cur && cur.id === it.id;
    return (
      <button key={it.id} data-demo-gift={it.id} onClick={() => play(it.id)}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 12px",
          border: "1px solid " + (on ? C.borderHi : "transparent"), background: on ? "rgba(124,92,252,.14)" : "transparent",
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit", color: C.text }}>
        <span style={{ fontSize: 26, width: 34, textAlign: "center", flexShrink: 0 }}>{it.emoji}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span>
          <span style={{ display: "block", fontSize: 12, color: C.muted }}>
            {it.cur === "purple" ? "💜 " : "🪙 "}{it.price} · ระดับ {it.tier} · {it.dur.toFixed(1)} วิ
          </span>
        </span>
        <Beats show={it} width={76} />
      </button>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, background: C.bg, display: "flex", flexDirection: "column",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: C.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid " + C.border, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🎬 ตัวอย่างเอฟเฟกต์ของขวัญ</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>ไม่เสียเหรียญ · ไม่ส่งให้ใคร</div>
        </div>
        <button onClick={() => setAuto(a => !a)} style={{ border: "1px solid " + C.borderHi, background: auto ? "rgba(124,92,252,.2)" : "transparent",
          color: C.brand2, borderRadius: 20, padding: "6px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {auto ? "หยุด" : "เล่นทั้งหมด"}
        </button>
        <button data-demo-close onClick={onClose} aria-label="ปิด" style={{ width: 32, height: 32, borderRadius: "50%", border: "none",
          background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 15, flexShrink: 0 }}>✕</button>
      </div>

      {/* เวที: เอฟเฟกต์ของจริงเล่นตรงนี้ */}
      <div style={{ position: "relative", flex: "0 0 46%", minHeight: 240, overflow: "hidden",
        background: "radial-gradient(circle at 50% 45%, #1C1830, #0F0E17 70%)", borderBottom: "1px solid " + C.border }}>
        {children}
        {!cur && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: C.muted, fontSize: 14, textAlign: "center", padding: 20 }}>แตะของขวัญด้านล่างเพื่อดูเอฟเฟกต์พร้อมเสียง</div>}
      </div>

      {/* แถบเวลา + จังหวะเสียง */}
      <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginBottom: 6 }}>
          <span style={{ flex: 1, minWidth: 0, color: playing ? C.text : C.muted, fontWeight: playing ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {playing ? playing.emoji + " " + playing.name : "ยังไม่ได้เล่น"}
          </span>
          <span>{playing ? (prog * playing.dur).toFixed(1) + " / " + playing.dur.toFixed(1) + " วิ" : "—"}</span>
        </div>
        <div style={{ position: "relative", height: 10, borderRadius: 6, background: C.surface, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (prog * 100) + "%", background: "linear-gradient(90deg,#7C5CFC,#A78BFA)" }} />
          {playing && (playing.flash || []).map(([t, v, col], i) => (
            <span key={i} title={"จังหวะเสียงที่ " + t + " วิ"} style={{ position: "absolute", top: 1, bottom: 1, width: 2,
              left: "calc(" + (t / playing.dur * 100) + "% - 1px)", background: col || "#fff", opacity: .35 + (v || 0) * .65 }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>ขีดบนแถบ = จังหวะที่เสียงกับภาพต้องตรงกัน</div>
      </div>

      {/* รายการของขวัญ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 18px" }}>
        {groups.map(([title, list]) => list.length > 0 && (
          <div key={title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, padding: "10px 12px 4px", textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
            {list.map(row)}
          </div>
        ))}
      </div>
    </div>
  );
}

// แถบจังหวะย่อขนาดเล็กท้ายแต่ละแถว
function Beats({ show, width }) {
  const f = show.flash || [];
  return (
    <span style={{ position: "relative", width, height: 16, borderRadius: 4, background: "#1A1825", flexShrink: 0, display: "inline-block" }}>
      {f.map(([t, v, col], i) => (
        <span key={i} style={{ position: "absolute", top: 2, bottom: 2, width: 2, left: (t / show.dur * (width - 2)) + "px", background: col || "#fff", opacity: .3 + (v || 0) * .7 }} />
      ))}
    </span>
  );
}
