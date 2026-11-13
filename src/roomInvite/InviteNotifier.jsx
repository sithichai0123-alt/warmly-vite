// ฟังกล่องคำเชิญของเรา → ขึ้นแถบ "ชวนเข้าห้อง" พร้อมปุ่มเข้าร่วม/ปฏิเสธ (ไม่ render อะไรเอง)
import { useEffect, useRef } from "react";
import { showBanner, hideBanner } from "../social/bus.js";
import { activeInvites, expiredInvites } from "./logic.js";

export default function InviteNotifier({ api, uid, blocked, nameOf, onAccept }) {
  const shown = useRef(new Map()); // from → `${roomId}:${t}` ที่แสดงไปแล้ว
  const ref = useRef({}); ref.current = { blocked, nameOf, onAccept };
  useEffect(() => {
    if (!api || !uid) return undefined;
    const map = shown.current; map.clear();
    const un = api.subscribe(uid, list => {
      const now = Date.now();
      expiredInvites(list, now).forEach(i => api.dismiss(uid, i.from).catch(() => {})); // เก็บกวาดคำเชิญหมดอายุ
      const act = activeInvites(list, now, { blocked: ref.current.blocked });
      const keep = new Set(act.map(i => i.from));
      [...map.keys()].forEach(f => { if (!keep.has(f)) { map.delete(f); hideBanner("inv-" + f); } });
      act.forEach(i => {
        const sig = i.roomId + ":" + (i.t && i.t.toMillis ? i.t.toMillis() : 0);
        if (map.get(i.from) === sig) return;
        map.set(i.from, sig);
        const nm = (ref.current.nameOf && ref.current.nameOf(i.from)) || i.fromName || "เพื่อน";
        showBanner({
          key: "inv-" + i.from, title: "🎙️ " + nm + " ชวนเข้าห้อง “" + (i.roomName || "ห้องเสียง") + "”", ttl: 120000, tone: "invite",
          actions: [
            { id: "join", label: "เข้าร่วม", primary: true, onClick: () => { api.dismiss(uid, i.from).catch(() => {}); ref.current.onAccept && ref.current.onAccept({ roomId: i.roomId, roomName: i.roomName, from: i.from }); } },
            { id: "decline", label: "ปฏิเสธ", onClick: () => { api.dismiss(uid, i.from).catch(() => {}); } },
          ],
          onClose: () => { api.dismiss(uid, i.from).catch(() => {}); },
        });
      });
    }, e => console.error("roomInvites", e));
    return () => { un && un(); [...map.keys()].forEach(f => hideBanner("inv-" + f)); map.clear(); };
  }, [api, uid]);
  return null;
}
