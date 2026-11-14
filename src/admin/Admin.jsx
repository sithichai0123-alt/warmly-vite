// Admin — หน้าค้นหารูปในฐานข้อมูล (อ่านอย่างเดียว ไม่ลบอะไรเลย)
// บอกว่ารูปแต่ละรูปอยู่เอกสารไหน ฟิลด์อะไร แล้วคัดลอกเส้นทางไปลบเองใน Firebase Console
import { useEffect, useState } from "react";
import { watchAuth, login, logout, loadUsers, loadUserImages, loadPosts, loadGroupChat } from "./fb.js";
import { userImages, postImages, locate, srcKind, isVideo, srcBytes, fmtBytes } from "./paths.js";

const C = { bg: "#0F0E17", card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8",
  text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", brand: "#7C5CFC", brand2: "#A78BFA", red: "#F43F5E", yellow: "#FBBF24", green: "#22C55E" };
const PROJECT = "warmly-app-9e8d6";
const consoleUrl = path => "https://console.firebase.google.com/project/" + PROJECT + "/firestore/databases/-default-/data/~2F" + path.split("/").join("~2F");
const fmtT = ms => { try { return ms ? new Date(ms).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"; } catch (e) { return "—"; } };

export default function Admin() {
  const [user, setUser] = useState(undefined);        // undefined = ยังไม่รู้ · null = ยังไม่ล็อกอิน
  const [tab, setTab] = useState("users");
  const [err, setErr] = useState("");
  useEffect(() => watchAuth(u => setUser(u || null)), []);

  if (user === undefined) return <Shell><div style={{ padding: 30, textAlign: "center", color: C.muted }}>กำลังโหลด...</div></Shell>;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid " + C.border }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>🔎 ค้นหารูปในฐานข้อมูล</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>อ่านอย่างเดียว · หน้านี้ลบอะไรไม่ได้</div>
        </div>
        {user
          ? <button onClick={() => logout()} style={btn(C.border, "transparent", C.sub)}>ออก</button>
          : <button data-login onClick={() => login().catch(e => setErr("เข้าสู่ระบบไม่สำเร็จ (" + (e.code || e.message) + ")"))} style={btn(C.borderHi, C.brand, "#fff")}>เข้าสู่ระบบ</button>}
      </div>

      <div style={{ padding: "10px 14px", background: "rgba(251,191,36,.1)", borderBottom: "1px solid rgba(251,191,36,.3)", fontSize: 12, color: C.yellow, lineHeight: 1.6 }}>
        ⚠️ การลบใน Firebase Console <b>กู้คืนไม่ได้</b> และคนที่เปิดแอปอยู่จะเห็นหายทันที — คัดลอกค่าเก็บไว้ก่อนถ้าอาจต้องใช้เป็นหลักฐาน
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid " + C.border }}>
        {[["users", "👤 ผู้ใช้"], ["posts", "📝 โพสต์"], ["chat", "💬 แชทห้องรวม"]].map(([k, l]) => (
          <button key={k} data-tab={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "11px 4px", border: "none", borderBottom: "2px solid " + (tab === k ? C.brand : "transparent"),
            background: "transparent", color: tab === k ? C.brand2 : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
        ))}
      </div>

      {err && <div style={{ padding: "10px 14px", color: C.red, fontSize: 13 }}>{err}</div>}
      {tab === "users" && <UsersTab />}
      {tab === "posts" && <PostsTab />}
      {tab === "chat" && <ChatTab />}
    </Shell>
  );
}

const btn = (bd, bg, col) => ({ border: "1px solid " + bd, background: bg, color: col, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

function Shell({ children }) {
  return <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
  </div>;
}

// ปุ่มคัดลอก (ไม่มี clipboard ก็ให้เลือกเองจากกล่องข้อความ)
function Copy({ text, label = "คัดลอก" }) {
  const [ok, setOk] = useState(false);
  return <button onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1600); } catch (e) { window.prompt("คัดลอกข้อความนี้", text); } }}
    style={{ border: "1px solid " + C.borderHi, background: "transparent", color: ok ? C.green : C.brand2, borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{ok ? "คัดลอกแล้ว ✓" : label}</button>;
}

function Loading({ on, empty, children }) {
  if (on) return <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>กำลังโหลด...</div>;
  if (empty) return <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>ไม่พบข้อมูล</div>;
  return children;
}

function Err({ e }) {
  if (!e) return null;
  const denied = /permission|insufficient/i.test(String(e));
  return <div style={{ margin: "12px 14px", padding: 12, borderRadius: 12, background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.35)", color: "#FCA5A5", fontSize: 13, lineHeight: 1.6 }}>
    ⚠️ อ่านข้อมูลไม่ได้: {String(e)}
    {denied && <div style={{ marginTop: 6, color: C.sub }}>กฎความปลอดภัยของ Firestore ไม่อนุญาตให้อ่าน — ลองเข้าสู่ระบบด้วยบัญชีของคุณก่อน</div>}
  </div>;
}

// ── การ์ดรูปหนึ่งรูป: ภาพจริง + เส้นทางที่ต้องไปลบ ──
function ImgCard({ it, owner }) {
  const kind = srcKind(it.src), vid = isVideo(kind);
  return (
    <div data-img-card style={{ display: "flex", gap: 10, padding: 10, borderTop: "1px solid " + C.border }}>
      <div style={{ width: 76, height: 76, borderRadius: 10, overflow: "hidden", background: C.surface, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {vid ? <span style={{ fontSize: 26 }}>🎬</span>
          : <img src={it.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{it.label}{owner ? " · " + owner : ""}</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "2px 0 6px" }}>{fmtBytes(srcBytes(it.src))}{it.t ? " · " + fmtT(it.t) : ""}</div>
        <div style={{ fontSize: 12, color: C.sub, background: C.surface, borderRadius: 8, padding: "6px 9px", wordBreak: "break-all", lineHeight: 1.6 }}>
          เอกสาร <b style={{ color: C.text }}>{it.doc}</b><br />ฟิลด์ <b style={{ color: C.text }}>{it.field}</b>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.6 }}>วิธีลบ: {it.how}</div>
        {vid && <div style={{ fontSize: 12, color: C.yellow, marginTop: 4, lineHeight: 1.5 }}>วิดีโออยู่บน Cloudinary — ลบเอกสารแล้วไฟล์ยังอยู่ ต้องไปลบที่ Cloudinary เองด้วย</div>}
        <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
          <Copy text={it.doc} label="คัดลอกเอกสาร" />
          <a href={consoleUrl(it.doc)} target="_blank" rel="noreferrer" style={{ ...btn(C.border, "transparent", C.sub), textDecoration: "none", display: "inline-block" }}>เปิดใน Console ↗</a>
          {!vid && <button onClick={() => { const w = window.open(); if (w) w.document.write('<img src="' + it.src.replace(/"/g, "&quot;") + '" style="max-width:100%">'); }}
            style={btn(C.border, "transparent", C.sub)}>ดูรูปเต็ม</button>}
        </div>
      </div>
    </div>
  );
}

// ── แท็บผู้ใช้: เลือกคน แล้วค่อยโหลดรูปของคนนั้น (ไม่โหลดรูปทุกคนพร้อมกัน) ──
function UsersTab() {
  const [list, setList] = useState(null), [e, setE] = useState(null), [q, setQ] = useState(""), [open, setOpen] = useState(null), [imgs, setImgs] = useState(null);
  useEffect(() => { loadUsers().then(setList).catch(setE); }, []);
  const pick = async u => {
    if (open === u.id) { setOpen(null); setImgs(null); return; }
    setOpen(u.id); setImgs(null);
    try { const r = await loadUserImages(u.id); setImgs(userImages({ uid: u.id, userDoc: u, ...r })); }
    catch (x) { setE(x); setImgs([]); }
  };
  if (e) return <Err e={e} />;
  const kw = q.trim().toLowerCase();
  const rows = (list || []).filter(u => !kw || String(u.name || "").toLowerCase().includes(kw) || u.id.toLowerCase().includes(kw))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return (
    <Loading on={!list} empty={list && rows.length === 0}>
      <div style={{ padding: "10px 14px" }}>
        <input data-search value={q} onChange={e2 => setQ(e2.target.value)} placeholder="ค้นหาชื่อ หรือ uid..."
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid " + C.border, borderRadius: 20, padding: "9px 15px", fontSize: 14, background: C.card, color: C.text, outline: "none", fontFamily: "inherit" }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>แตะชื่อเพื่อดูรูปทั้งหมดของคนนั้น ({rows.length} คน)</div>
      </div>
      {rows.map(u => (
        <div key={u.id} style={{ borderTop: "1px solid " + C.border }}>
          <div data-user={u.id} onClick={() => pick(u)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", cursor: "pointer", background: open === u.id ? "rgba(124,92,252,.1)" : "transparent" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", background: C.surface, flexShrink: 0 }}>
              {u.avatar ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || "(ไม่มีชื่อ)"}</div>
              <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.id}</div>
            </div>
            <span style={{ color: C.brand2, fontSize: 13 }}>{open === u.id ? "▴" : "▾"}</span>
          </div>
          {open === u.id && (imgs === null
            ? <div style={{ padding: "10px 14px", color: C.muted, fontSize: 13 }}>กำลังโหลดรูป...</div>
            : imgs.length === 0 ? <div style={{ padding: "10px 14px", color: C.muted, fontSize: 13 }}>คนนี้ไม่มีรูป</div>
              : imgs.map(it => <ImgCard key={it.key} it={it} />))}
        </div>
      ))}
    </Loading>
  );
}

function PostsTab() {
  const [list, setList] = useState(null), [e, setE] = useState(null);
  useEffect(() => { loadPosts().then(setList).catch(setE); }, []);
  if (e) return <Err e={e} />;
  const withImg = (list || []).map(p => ({ p, imgs: postImages(p) })).filter(x => x.imgs.length);
  return (
    <Loading on={!list} empty={list && withImg.length === 0}>
      <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted }}>โพสต์ล่าสุดที่มีรูปหรือวิดีโอ ({withImg.length} โพสต์ จาก {list ? list.length : 0} โพสต์ล่าสุด)</div>
      {withImg.map(({ p, imgs }) => (
        <div key={p.id} style={{ borderTop: "1px solid " + C.border }}>
          <div style={{ padding: "10px 14px 0", fontSize: 13 }}>
            <b>{p.author || "ผู้ใช้"}</b> <span style={{ color: C.muted, fontSize: 12 }}>· {p.authorUid || "—"}</span>
            {p.content ? <div style={{ color: C.sub, fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>“{p.content}”</div> : null}
          </div>
          {imgs.map(it => <ImgCard key={it.key} it={it} />)}
        </div>
      ))}
    </Loading>
  );
}

function ChatTab() {
  const [list, setList] = useState(null), [e, setE] = useState(null);
  useEffect(() => { loadGroupChat().then(setList).catch(setE); }, []);
  if (e) return <Err e={e} />;
  const items = (list || []).filter(m => typeof m.image === "string" && m.image).map(m => ({
    key: "gc:" + m.id, label: "รูปในแชทห้องรวม", src: m.image, author: m.author || "ผู้ใช้", uid: m.uid || "—",
    t: m.t && m.t.toMillis ? m.t.toMillis() : 0, ...locate("groupChat", { id: m.id }),
  }));
  return (
    <Loading on={!list} empty={list && items.length === 0}>
      <div style={{ padding: "10px 14px", fontSize: 12, color: C.muted }}>ข้อความล่าสุดในห้องรวมที่มีรูป ({items.length} รูป) — แชทส่วนตัวดูที่นี่ไม่ได้ ต้องเปิดใน Console ที่ dms</div>
      {items.map(it => <ImgCard key={it.key} it={it} owner={it.author + " · " + it.uid} />)}
    </Loading>
  );
}
