// Profile Photos — แถบรูปโปรไฟล์ของคนอื่น (ในหน้าโปรไฟล์) แตะแล้วดูเต็มจอ
import { useEffect, useState } from "react";
import { emptyState, ordered } from "./photos.js";

export default function PhotoStrip({ uid, api, onOpen, size = 56, wrap = false, label = "" }) {
  const [state, setState] = useState(emptyState());
  useEffect(() => {
    setState(emptyState());
    const unsub = api.subscribe(uid, setState, () => {});
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [api, uid]);
  const list = ordered(state);
  if (list.length < 2) return null; // มี 0-1 รูป = ไม่ต้องแสดงแถบ (รูปหลักเห็นอยู่แล้วที่ avatar)
  const srcs = list.map(p => p.src);
  return (
    <div data-photo-strip style={{ marginTop: 10 }}>
      {label && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, opacity: 0.85 }}>{label} ({list.length})</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: wrap ? "wrap" : "nowrap", overflowX: wrap ? "visible" : "auto" }}>
      {list.map((p, i) => (
        <img key={p.id} data-strip-img src={p.src} alt="" onClick={() => onOpen && onOpen(srcs, i)} style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", flexShrink: 0, cursor: onOpen ? "zoom-in" : "default", border: "2px solid " + (i === 0 ? "#A78BFA" : "#2E2A45") }} />
      ))}
      </div>
    </div>
  );
}
