import { useEffect, useRef, useState, useCallback } from "react";
import { normalizeBlocks, toggleBlock, detectIncoming } from "./logic.js";
import { getDmPrefs, getActiveDm } from "./prefs.js";
import { playNotification, unlockAudio } from "./sounds.js";

// รายชื่อที่เราบล็อก (เรียลไทม์) + ฟังก์ชันบล็อก/เลิกบล็อก (คืน true = สำเร็จ)
export function useBlocks(api, myUid) {
  const [list, setList] = useState([]);
  const ref = useRef([]);
  useEffect(() => {
    if (!api || !myUid) return undefined;
    const unsub = api.subscribeBlocks(myUid, l => { ref.current = l; setList(l); }, e => console.error("blocks", e));
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [api, myUid]);
  const apply = useCallback(async (uid, on) => {
    const prev = ref.current, next = toggleBlock(prev, uid, on);
    if (on && next.length === prev.length && !prev.includes(uid)) return false; // เต็มเพดาน
    ref.current = next; setList(next);
    try { await api.saveBlocks(myUid, next); return true; }
    catch (e) { console.error("saveBlocks", e); ref.current = prev; setList(prev); return false; }
  }, [api, myUid]);
  return { list, set: new Set(list), isBlocked: uid => list.includes(uid), block: uid => apply(uid, true), unblock: uid => apply(uid, false) };
}

// อีกฝ่ายบล็อกเราอยู่ไหม (ฟังรายชื่อบล็อกของเขา) — ใช้ปิดช่องพิมพ์
export function usePeerBlocksMe(api, peerUid, myUid) {
  const [v, setV] = useState(false);
  useEffect(() => {
    setV(false);
    if (!api || !peerUid || !myUid) return undefined;
    const unsub = api.subscribeBlocks(peerUid, l => setV(l.includes(myUid)), () => {});
    return () => { try { unsub && unsub(); } catch (e) { /* ignore */ } };
  }, [api, peerUid, myUid]);
  return v;
}

// ตัวแจ้งเตือนเสียง: ฟังทุกบทสนทนา เมื่อมีข้อความใหม่จากคนอื่นก็เล่นเสียงตามที่ตั้งไว้ (ไม่แสดงอะไรบนจอ)
export function DmNotifier({ api, myUid }) {
  const prev = useRef(null);
  const blocked = useRef(new Set());
  useEffect(() => {
    if (!api || !myUid) return undefined;
    prev.current = null;
    const un1 = api.subscribeBlocks(myUid, l => { blocked.current = new Set(l); }, () => {});
    const un2 = api.subscribeConvs(myUid, convs => {
      const r = detectIncoming(prev.current, convs, {
        myUid, blocked: blocked.current, prefs: getDmPrefs(), activePair: getActiveDm(),
        pageVisible: typeof document === "undefined" || document.visibilityState !== "hidden",
      });
      prev.current = r.seen;
      if (r.play) playNotification(getDmPrefs());
    }, e => console.error("dmNotify", e));
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true }); window.addEventListener("keydown", unlock);
    return () => {
      try { un1 && un1(); un2 && un2(); } catch (e) { /* ignore */ }
      window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock);
    };
  }, [api, myUid]);
  return null;
}
