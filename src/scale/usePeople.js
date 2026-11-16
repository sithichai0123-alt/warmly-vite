// Scale/ผู้ใช้ — รายชื่อ "เริ่มแชทกับ..." และตัวเลข "สมาชิก N คน" โดยไม่ต้องมีผู้ใช้ทุกคนในเครื่อง
import { useEffect, useState } from "react";
import { PEOPLE_CACHE_MS, PEOPLE_PAGE, PEOPLE_SEARCH_LIMIT } from "./config.js";
import { mergePeople, nameVariants } from "./usersLogic.js";

// ไม่ค้นหา = ผู้ใช้งานล่าสุด PEOPLE_PAGE คน · ค้นหา = ชื่อที่ขึ้นต้นด้วยคำที่พิมพ์ (ลองตัวพิมพ์ใหญ่/เล็กให้) ฝั่งเซิร์ฟเวอร์
//   ผลที่ได้ใส่ลงแคชผู้ใช้ด้วย (seed) → รูป/ชื่อในแถวไม่ต้องอ่านซ้ำ
let lastDefault = null;   // { uid, t, list } — รายชื่อหน้าแรกล่าสุด (ไม่ใช่ผลค้นหา)
export function usePeopleList({ enabled, myUid, search, fb, seed }) {
  const { db, collection, query, where, orderBy, limit, getDocs } = fb;
  const [state, setState] = useState({ list: [], loading: false });
  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    const q = String(search || "").trim();
    if (!q && lastDefault && lastDefault.uid === myUid && Date.now() - lastDefault.t < PEOPLE_CACHE_MS) { setState({ list: lastDefault.list, loading: false }); return undefined; }
    setState(s => ({ ...s, loading: true }));
    const run = async () => {
      try {
        const col = collection(db, "users");
        const qs = q
          ? nameVariants(q).map(v => query(col, where("name", ">=", v), where("name", "<=", v + ""), limit(PEOPLE_SEARCH_LIMIT)))
          : [query(col, orderBy("lastSeen", "desc"), limit(PEOPLE_PAGE + 1))];   // +1: เผื่อมีตัวเราเองอยู่ในนั้น
        const snaps = await Promise.all(qs.map(x => getDocs(x)));
        if (dead) return;
        const list = mergePeople(snaps.map(sn => sn.docs.map(d => ({ id: d.id, ...d.data() }))), myUid, { sortByName: !!q, max: PEOPLE_PAGE });
        const map = {}; list.forEach(p => { const { id, ...rest } = p; map[id] = rest; });
        if (seed) seed(map);
        if (!q) lastDefault = { uid: myUid, t: Date.now(), list };
        setState({ list, loading: false });
      } catch (e) { if (!dead) { console.error("people", e); setState({ list: [], loading: false }); } }
    };
    const t = setTimeout(run, q ? 300 : 0);   // ค้นหา: รอให้พิมพ์เสร็จก่อน
    return () => { dead = true; clearTimeout(t); };
  }, [enabled, myUid, search]); // eslint-disable-line
  return state;
}

// จำนวนผู้ใช้ทั้งหมด: ให้เซิร์ฟเวอร์นับ (คิดเป็น 1 ครั้งต่อ 1,000 รายการ) แทนการโหลดทุกคนมานับ
export function useMemberCount({ enabled, fb }) {
  const { db, collection, getCountFromServer } = fb;
  const [count, setCount] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let dead = false;
    getCountFromServer(collection(db, "users")).then(s => { if (!dead) setCount(s.data().count); }).catch(e => console.error("memberCount", e));
    return () => { dead = true; };
  }, [enabled]); // eslint-disable-line
  return count;
}
