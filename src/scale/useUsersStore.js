// Scale/ผู้ใช้ — โหลดข้อมูลผู้ใช้เฉพาะคนที่ปรากฏบนจอ (แทนการฟังผู้ใช้ทุกคนตอนเปิดแอป)
//   • users[uid] ใช้เหมือนเดิมทุกที่ (UsersCtx) — พออ่านรหัสที่ยังไม่รู้จัก ระบบจะรวมคำขอ แล้วโหลดเป็นกลุ่มละ ≤30 คน (ฟังสดต่อ)
//   • ข้อมูลที่ได้มาแล้วไม่โหลดซ้ำ · ไม่มีเอกสาร = จำไว้ว่าไม่มี · คนอื่นแก้โปรไฟล์/ธีมระหว่างใช้งานก็ยังขึ้นสด เหมือนเดิม
//   • ตัวเราเองโหลดตั้งแต่เริ่ม · เกิน USERS_MAX_LISTENERS กลุ่ม → ดึงครั้งเดียวแทนฟังสด
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { USERS_CHUNK, USERS_FLUSH_MS, USERS_MAX_LISTENERS } from "./config.js";
import { chunkIds, isUidLike, mergeCache } from "./usersLogic.js";

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function useUsersStore({ enabled, uid, fb }) {
  const { db, collection, query, where, documentId, onSnapshot, getDocs } = fb;
  const [cache, setCache] = useState({});
  const S = useRef(null);
  if (!S.current) S.current = { known: new Set(), pending: new Set(), timer: null, unsubs: [] };

  const apply = useCallback((ids, snap) => {
    const got = {}, seen = new Set();
    snap.docs.forEach(d => { got[d.id] = d.data(); seen.add(d.id); });
    ids.forEach(id => { if (!seen.has(id)) got[id] = null; });   // ไม่มีเอกสาร = null (จำไว้ ไม่ถามซ้ำ)
    setCache(prev => mergeCache(prev, got));
  }, []);

  const flush = useCallback(() => {
    const s = S.current; s.timer = null;
    const ids = [...s.pending].filter(id => !s.known.has(id)); s.pending.clear();
    if (!ids.length) return;
    ids.forEach(id => s.known.add(id));
    for (const grp of chunkIds(ids, USERS_CHUNK)) {
      const q = query(collection(db, "users"), where(documentId(), "in", grp));
      if (s.unsubs.length < USERS_MAX_LISTENERS) s.unsubs.push(onSnapshot(q, snap => apply(grp, snap), e => console.error("users", e)));
      else getDocs(q).then(snap => apply(grp, snap)).catch(e => console.error("users", e));
    }
  }, [apply]); // eslint-disable-line

  const request = useCallback(id => {
    if (!enabled) return;
    const s = S.current;
    if (s.known.has(id) || s.pending.has(id)) return;
    s.pending.add(id);
    if (!s.timer) s.timer = setTimeout(flush, USERS_FLUSH_MS);
  }, [enabled, flush]);

  // ใส่ข้อมูลที่ได้มาจากที่อื่นแล้ว (เช่นรายชื่อ "เริ่มแชทกับ...") ลงแคช โดยไม่ต้องอ่านซ้ำ (ไม่ฟังสด)
  const seed = useCallback(map => {
    const s = S.current, got = {};
    for (const id of Object.keys(map || {})) if (!s.known.has(id)) { s.known.add(id); s.pending.delete(id); got[id] = map[id]; }
    if (Object.keys(got).length) setCache(prev => mergeCache(prev, got));
  }, []);

  // เปิด/ปิดระบบ (ล็อกอิน/ออกจากระบบ) → ล้างทุกอย่าง ปิดการฟังทั้งหมด
  useEffect(() => {
    if (!enabled) return undefined;
    const s = S.current;
    return () => {
      if (s.timer) clearTimeout(s.timer); s.timer = null;
      s.unsubs.forEach(u => { try { u(); } catch (e) { /* ignore */ } }); s.unsubs = [];
      s.known = new Set(); s.pending = new Set(); setCache({});
    };
  }, [enabled]);

  useEffect(() => { if (enabled && uid) request(uid); }, [enabled, uid, request]);   // ตัวเอง: โหลด+ฟังสดตั้งแต่เริ่ม

  const users = useMemo(() => new Proxy(cache, {
    get(t, p, r) {
      if (isUidLike(p)) { if (!own(t, p)) request(p); return t[p] || undefined; }
      return Reflect.get(t, p, r);
    },
  }), [cache, request]);

  return { users, seed };
}
