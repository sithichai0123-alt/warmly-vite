// Profile Photos — แถบรูปโปรไฟล์ของคนอื่น (ในหน้าโปรไฟล์) แตะแล้วดูเต็มจอ
import { useEffect, useState } from "react";
import { emptyState, ordered } from "./photos.js";

export default function PhotoStrip({ uid, api, onOpen }) {
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
    <div data-photo-strip style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }}>
      {list.map((p, i) => (
        <img key={p.id} data-strip-img src={p.src} alt="" onClick={() => onOpen && onOpen(srcs, i)} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0, cursor: onOpen ? "zoom-in" : "default", border: "2px solid " + (i === 0 ? "#A78BFA" : "#2E2A45") }} />
      ))}
    </div>
  );
}
