// แถบแจ้งเตือนลอยด้านบนจอ (คำขอเป็นเพื่อน / คำเชิญเข้าห้อง) — กดปุ่มในแถบได้เลย
import { useBanners, hideBanner } from "./bus.js";

const C = { card: "#221F33", border: "#4F46A8", text: "#F0EEFF", sub: "#9B94C4", brand: "#7C6BF0", red: "#F87171" };

export default function BannerStack() {
  const list = useBanners();
  if (!list.length) return null;
  return (
    <div data-banner-stack style={{ position: "fixed", top: 58, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, padding: "0 10px", zIndex: 95, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {list.map(b => (
        <div key={b.key} data-banner={b.key} role="status" style={{ pointerEvents: "auto", background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,.5)", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{b.title}</div>
            {b.body && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{b.body}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {(b.actions || []).map((a, i) => (
              <button key={i} type="button" data-banner-action={a.id || String(i)} onClick={() => { try { a.onClick && a.onClick(); } finally { if (a.keep !== true) hideBanner(b.key); } }} style={{ border: a.primary ? "none" : "1px solid " + C.border, background: a.primary ? C.brand : "transparent", color: a.primary ? "#fff" : C.sub, borderRadius: 10, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{a.label}</button>
            ))}
            <button type="button" aria-label="ปิด" data-banner-close onClick={() => { try { b.onClose && b.onClose(); } finally { hideBanner(b.key); } }} style={{ border: "none", background: "transparent", color: C.sub, fontSize: 14, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
