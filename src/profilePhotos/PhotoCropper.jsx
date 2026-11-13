// Profile Photos — ปรับตำแหน่ง/ซูมรูปก่อนอัปโหลด (ลากเพื่อย้าย, สไลเดอร์เพื่อซูม)
// ผลลัพธ์: { sx, sy, sw, sh } = สี่เหลี่ยมที่ครอปจากรูปต้นฉบับ (หน่วยพิกเซลของรูปต้นฉบับ) ตามสัดส่วน aspect
import { useEffect, useRef, useState } from "react";

const C = { card: "#221F33", surface: "#1A1825", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", muted: "#8A84B0", grad: "linear-gradient(135deg,#7C5CFC,#A78BFA)" };
const MAX_ZOOM = 4;

// ขนาดกรอบตามอุปกรณ์: มือถือเกือบเต็มจอ • แท็บเล็ตกลางๆ • คอมใหญ่ขึ้นแต่ไม่เกินความสูงจอ
function frameWidth(aspect) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 780;
  const wide = aspect > 1; // รูปปก (กว้างกว่าสูง) ให้กรอบกว้างกว่า
  const cap = vw < 600 ? 480 : vw < 1024 ? (wide ? 540 : 480) : (wide ? 600 : 520); // เพดานตามชนิดอุปกรณ์
  const byWidth = vw - 60;            // เผื่อขอบหน้าต่างและช่องว่างด้านข้าง
  const byHeight = (vh - 280) * aspect; // เผื่อพื้นที่หัวข้อ แถบซูม และปุ่ม
  return Math.round(Math.max(200, Math.min(cap, byWidth, byHeight)));
}

export default function PhotoCropper({ file, index = 1, total = 1, aspect = 1, circle = true, title = "จัดตำแหน่งรูป", hint = "วงกลม = ส่วนที่จะแสดงเป็นรูปโปรไฟล์เมื่อตั้งเป็นรูปหลัก", onDone, onCancel }) {
  const [url, setUrl] = useState("");
  const [dim, setDim] = useState(null); // { w, h }
  const [z, setZ] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const [F] = useState(() => frameWidth(aspect)); // ความกว้างกรอบ (คงที่ตลอดการจัดรูป)
  const FH = F / aspect; // ความสูงกรอบ

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      const s = Math.max(F / w, FH / h);
      setDim({ w, h }); setZ(1); setOff({ x: (F - w * s) / 2, y: (FH - h * s) / 2 });
    };
    im.onerror = () => onDone(null); // เปิดดูไม่ได้ = ใช้ขั้นตอนเดิม (ไม่ครอป) แล้วให้ตัวตรวจไฟล์แจ้งเอง
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]); // eslint-disable-line

  const s0 = dim ? Math.max(F / dim.w, FH / dim.h) : 1;
  const scale = s0 * z;
  const clamp = (o, sc) => dim ? ({
    x: Math.min(0, Math.max(F - dim.w * sc, o.x)),
    y: Math.min(0, Math.max(FH - dim.h * sc, o.y)),
  }) : o;

  function changeZoom(nz) {
    if (!dim) return;
    const ns = s0 * nz;
    const cx = (F / 2 - off.x) / scale, cy = (FH / 2 - off.y) / scale; // จุดกลางกรอบ (พิกัดบนรูป)
    setZ(nz);
    setOff(clamp({ x: F / 2 - cx * ns, y: FH / 2 - cy * ns }, ns));
  }
  function down(e) { drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
  function move(e) { const d = drag.current; if (!d) return; setOff(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, scale)); }
  function up() { drag.current = null; }

  function confirm() {
    if (!dim) return;
    onDone({ sx: Math.max(0, -off.x / scale), sy: Math.max(0, -off.y / scale), sw: Math.min(F / scale, dim.w), sh: Math.min(FH / scale, dim.h) });
  }

  return (
    <div data-photo-cropper style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: F + 40, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, padding: 16, color: C.text }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>✂️ {title}{total > 1 ? " (" + index + "/" + total + ")" : ""}</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 10px", lineHeight: 1.6 }}>ลากรูปเพื่อย้าย • เลื่อนแถบเพื่อซูม{hint ? <><br />{hint}</> : null}</div>
        <div
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ position: "relative", width: F, height: FH, margin: "0 auto", overflow: "hidden", borderRadius: 12, background: "#000", touchAction: "none", cursor: "grab", userSelect: "none" }}
        >
          {dim && url && <img src={url} alt="" draggable={false} style={{ position: "absolute", left: off.x, top: off.y, width: dim.w * scale, height: dim.h * scale, maxWidth: "none", pointerEvents: "none" }} />}
          {!dim && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.muted }}>กำลังโหลด...</div>}
          {circle && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 999px rgba(0,0,0,.5)", border: "2px solid rgba(255,255,255,.7)", pointerEvents: "none" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 4px 0" }}>
          <span style={{ fontSize: 13, color: C.muted }}>ซูม</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={z} onChange={e => changeZoom(parseFloat(e.target.value))} disabled={!dim} style={{ flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "1px solid " + C.borderHi, background: "transparent", color: C.brand2, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>ข้ามรูปนี้</button>
          <button type="button" onClick={confirm} disabled={!dim} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: C.grad, color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: dim ? 1 : .5 }}>ใช้รูปนี้</button>
        </div>
        <button type="button" onClick={() => onDone(null)} style={{ width: "100%", marginTop: 8, padding: "8px 0", border: "none", background: "transparent", color: C.muted, fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>ไม่ครอป ใช้ทั้งรูป</button>
      </div>
    </div>
  );
}
