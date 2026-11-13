// Profile Photos — หน้าจัดการรูปโปรไฟล์ (สูงสุด 5 รูป, เลือกรูปหลัก, ลบ, ดูเต็มจอ)
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS, ALLOWED_TYPES } from "./config.js";
import { validateFile, validateCount } from "./validate.js";
import { processFile, makeThumb } from "./image.js";
import PhotoCropper from "./PhotoCropper.jsx";
import { emptyState, planAdd, planRemove, planSetMain, mainOf, ordered } from "./photos.js";

const C = { card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", yellow: "#F59E0B", red: "#F87171", grad: "linear-gradient(135deg,#7C5CFC,#A78BFA)" };
const btn = (extra) => ({ fontFamily: "inherit", fontSize:12, fontWeight: 700, padding: "5px 9px", borderRadius: 8, border: "1px solid " + C.borderHi, background: "transparent", color: C.brand2, cursor: "pointer", ...extra });

export default function ProfilePhotosManager({ uid, api, legacyAvatar, onMainChange, onOpen, onClose }) {
  const [state, setState] = useState(emptyState());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);
  const [cropJob, setCropJob] = useState(null); // { file, index, total, resolve }
  const ref = useRef(emptyState());
  const fileRef = useRef(null);

  useEffect(() => {
    const unsub = api.subscribe(uid, s => { ref.current = s; setState(s); setLoaded(true); }, () => { setLoaded(true); setMsgs(["โหลดรูปไม่ได้ ลองใหม่อีกครั้ง"]); });
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [api, uid]);

  async function commit(next, prevMainId) {
    await api.save(uid, next);
    ref.current = next; setState(next);
    const m = mainOf(next);
    if ((m ? m.id : null) !== (prevMainId || null) || !m) {
      let thumb = "";
      if (m) { try { thumb = await makeThumb(m.src); } catch (e) { thumb = ""; } }
      if (!m || thumb) { try { await onMainChange(thumb); } catch (e) { setMsgs(x => [...x, "บันทึกรูปหลักไม่สำเร็จ ลองกด 'ตั้งเป็นรูปหลัก' อีกครั้ง"]); } }
    }
  }

  // เปิดหน้าจัดตำแหน่งรูป → คืน { sx, sy, size } | null (ไม่ครอป) | "skip" (ข้ามรูปนี้)
  const askCrop = (file, index, total) => new Promise(resolve => setCropJob({ file, index, total, resolve }));

  async function onPick(e) {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length || busy) return;
    const room = MAX_PHOTOS - ref.current.photos.length;
    const out = [];
    if (room <= 0) { setMsgs([validateCount(MAX_PHOTOS, 1).reason]); return; }
    if (files.length > room) out.push("เลือกมา " + files.length + " รูป แต่เพิ่มได้อีก " + room + " รูป — ใช้ " + room + " รูปแรก");
    setBusy(true); setMsgs([]);
    try {
      const picked = files.slice(0, room);
      for (let i = 0; i < picked.length; i++) {
        const f = picked[i];
        const v = validateFile(f); if (!v.ok) { out.push(v.reason); continue; }
        const crop = await askCrop(f, i + 1, picked.length);
        if (crop === "skip") continue;
        const r = await processFile(f, { crop }); if (!r.ok) { out.push(r.reason); continue; }
        const plan = planAdd(ref.current, { src: r.src });
        if (!plan.ok) { out.push(plan.reason); continue; }
        try { await commit(plan.state, ref.current.mainId); }
        catch (err) { out.push((f.name || "ไฟล์") + ": บันทึกไม่สำเร็จ (" + ((err && (err.code || err.message)) || "เน็ตมีปัญหา") + ")"); }
      }
    } finally { setBusy(false); setMsgs(out); }
  }

  async function setMain(id) {
    if (busy) return; setBusy(true); setMsgs([]);
    try { await commit(planSetMain(ref.current, id), ref.current.mainId); }
    catch (err) { setMsgs(["ตั้งรูปหลักไม่สำเร็จ (" + ((err && (err.code || err.message)) || "เน็ตมีปัญหา") + ")"]); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    if (busy) return; setBusy(true); setMsgs([]); setConfirmDel(null);
    try { await commit(planRemove(ref.current, id), ref.current.mainId); }
    catch (err) { setMsgs(["ลบรูปไม่สำเร็จ (" + ((err && (err.code || err.message)) || "เน็ตมีปัญหา") + ")"]); }
    finally { setBusy(false); }
  }

  const list = ordered(state);
  const full = list.length >= MAX_PHOTOS;
  const srcs = list.map(p => p.src);
  return (
    <div data-photos-manager onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, padding: 16, color: C.text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>📸 รูปโปรไฟล์ของฉัน <span data-photos-count style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{list.length}/{MAX_PHOTOS}</span></div>
          <button type="button" data-photos-close onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.muted, margin: "4px 0 12px" }}>เพิ่มได้สูงสุด {MAX_PHOTOS} รูป • รูปหลัก (⭐) คือรูปที่ทุกคนเห็นทั่วแอป • รองรับ JPG, PNG, WebP, GIF ไม่เกิน 10 MB</div>

        {!loaded && <div style={{ fontSize: 13, color: C.muted, padding: "20px 0", textAlign: "center" }}>กำลังโหลด...</div>}

        {loaded && list.length === 0 && legacyAvatar && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 10, marginBottom: 10 }}>
            <img src={legacyAvatar} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
            <div style={{ fontSize: 12, color: C.sub }}>รูปโปรไฟล์ปัจจุบันของคุณ — เมื่อเพิ่มรูปด้านล่าง รูปแรกจะกลายเป็นรูปหลักแทนรูปนี้</div>
          </div>
        )}

        {loaded && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, alignItems: "start" }}>
            {list.map(p => {
              const isMain = p.id === state.mainId;
              return (
                <div key={p.id} data-photo={p.id} data-main={isMain ? "1" : "0"} style={{ background: C.surface, border: "2px solid " + (isMain ? C.brand2 : C.border), borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ position: "relative", aspectRatio: "1/1", cursor: onOpen ? "zoom-in" : "default" }} onClick={() => onOpen && onOpen(srcs, srcs.indexOf(p.src))}>
                    <img src={p.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {isMain && <span style={{ position: "absolute", top: 4, left: 4, fontSize:12, fontWeight: 800, background: C.grad, color: "#fff", borderRadius: 8, padding: "2px 6px" }}>⭐ รูปหลัก</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 5 }}>
                    {!isMain && <button type="button" data-photo-setmain onClick={() => setMain(p.id)} disabled={busy} style={btn({ opacity: busy ? .5 : 1 })}>ตั้งเป็นรูปหลัก</button>}
                    {confirmDel === p.id
                      ? <div style={{ display: "flex", gap: 4 }}><button type="button" data-photo-delete-yes onClick={() => remove(p.id)} disabled={busy} style={btn({ flex: 1, background: C.red, borderColor: C.red, color: "#fff" })}>ลบเลย</button><button type="button" onClick={() => setConfirmDel(null)} style={btn({ flex: 1 })}>ยกเลิก</button></div>
                      : <button type="button" data-photo-delete onClick={() => setConfirmDel(p.id)} disabled={busy} style={btn({ color: C.red, borderColor: "#5B2A35", opacity: busy ? .5 : 1 })}>🗑️ ลบ</button>}
                  </div>
                </div>
              );
            })}
            {!full && (
              <button type="button" data-photo-add onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={{ aspectRatio: "1/1", borderRadius: 12, border: "2px dashed " + C.borderHi, background: "transparent", color: C.brand2, cursor: busy ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, opacity: busy ? .6 : 1 }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{busy ? "⏳" : "＋"}</span>{busy ? "กำลังอัปโหลด..." : "เพิ่มรูป"}
              </button>
            )}
          </div>
        )}
        {full && <div data-photos-full style={{ fontSize: 12, color: C.yellow, marginTop: 8 }}>ครบ {MAX_PHOTOS} รูปแล้ว — ลบรูปเดิมก่อนถึงจะเพิ่มรูปใหม่ได้</div>}
        <input ref={fileRef} data-photos-input type="file" multiple accept={ALLOWED_TYPES.join(",")} style={{ display: "none" }} onChange={onPick} />
        {cropJob && <PhotoCropper file={cropJob.file} index={cropJob.index} total={cropJob.total} onDone={c => { cropJob.resolve(c); setCropJob(null); }} onCancel={() => { cropJob.resolve("skip"); setCropJob(null); }} />}
        {msgs.length > 0 && <div data-photos-msgs style={{ marginTop: 10, fontSize: 12, color: C.yellow, display: "flex", flexDirection: "column", gap: 3 }}>{msgs.map((m, i) => <div key={i}>⚠️ {m}</div>)}</div>}
      </div>
    </div>
  );
}
