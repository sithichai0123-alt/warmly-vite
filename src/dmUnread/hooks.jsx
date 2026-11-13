import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { computeUnread, parseReadState, markReadState } from "./logic.js";
import { STORAGE_PREFIX } from "./config.js";

const OFF = { enabled: false, count: 0, isUnread: () => false, markRead: () => {} };
const Ctx = createContext(OFF);
export const useDmUnread = () => useContext(Ctx);

const load = uid => { try { return parseReadState(localStorage.getItem(STORAGE_PREFIX + uid)); } catch (e) { return { since: 0, read: {} }; } };
const save = (uid, st) => { try { localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(st)); } catch (e) { /* ignore */ } };

// ฟังบทสนทนาของเรา แล้วคำนวณว่ามีใครส่งข้อความใหม่มาที่ยังไม่ได้เปิดอ่านบ้าง
// api.subscribeConvs(uid, cb, onErr) มาจาก dmTools (ใช้ตัวเดิม ไม่เพิ่มคอลเลกชันใหม่)
export function DmUnreadProvider({ api, uid, blocked, children }) {
  const [convs, setConvs] = useState([]);
  const [state, setState] = useState(() => ({ since: 0, read: {} }));
  const stateRef = useRef(state), convsRef = useRef([]);
  useEffect(() => {
    if (!api || !uid) return undefined;
    let st = load(uid);
    if (!st.since) { st = { ...st, since: Date.now() }; save(uid, st); } // เปิดใช้ครั้งแรก: ข้อความเก่าถือว่าอ่านแล้ว
    stateRef.current = st; setState(st);
    const un = api.subscribeConvs(uid, list => { convsRef.current = list; setConvs(list); }, e => console.error("dmUnread", e));
    return () => { try { un && un(); } catch (e) { /* ignore */ } };
  }, [api, uid]);
  const markRead = useCallback(pairId => {
    if (!uid || !pairId) return;
    const c = convsRef.current.find(x => x.id === pairId);
    const lt = c && c.lastT && typeof c.lastT.toMillis === "function" ? c.lastT.toMillis() : 0;
    const next = markReadState(stateRef.current, pairId, Math.max(Date.now(), lt));
    if (next !== stateRef.current) { stateRef.current = next; save(uid, next); setState(next); }
  }, [uid]);
  const value = useMemo(() => {
    if (!api || !uid) return OFF;
    const r = computeUnread(convs, { myUid: uid, readMap: state.read, since: state.since, blocked });
    return { enabled: true, count: r.count, isUnread: id => !!r.byPair[id], markRead };
  }, [api, uid, convs, state, blocked, markRead]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const bubble = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9, background: "#EF4444", color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1, boxSizing: "border-box" };
export function UnreadBadge({ n, style }) {
  if (!n) return null;
  return <span data-dm-badge={n} style={{ ...bubble, ...style }}>{n > 99 ? "99+" : n}</span>;
}
export function UnreadDot({ style }) {
  return <span data-dm-dot style={{ width: 10, height: 10, borderRadius: 5, background: "#EF4444", display: "inline-block", flexShrink: 0, ...style }} />;
}
