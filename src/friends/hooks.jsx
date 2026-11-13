// สถานะเพื่อนของเรา (ฟังเอกสาร friendships ที่มีเรา 1 ตัวฟังทั้งแอป) + แจ้งเตือนเมื่อมีคนขอเป็นเพื่อน
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { parseFriendships, relationOf, planRequest, withoutBlocked } from "./logic.js";
import { showBanner, hideBanner } from "../social/bus.js";

const OFF = { enabled: false, ready: true, friends: [], friendSet: new Set(), incoming: [], outgoing: [], relation: () => "none", request: async () => ({ ok: false }), accept: async () => {}, remove: async () => {} };
const Ctx = createContext(OFF);
export const useFriends = () => useContext(Ctx);

export function FriendsProvider({ api, uid, blocked, nameOf, onOpenFriends, children }) {
  const [docs, setDocs] = useState(null); // null = ยังไม่ได้ข้อมูลชุดแรก
  const seen = useRef(null);
  const nameRef = useRef(nameOf); nameRef.current = nameOf;
  const openRef = useRef(onOpenFriends); openRef.current = onOpenFriends;

  useEffect(() => {
    setDocs(null); seen.current = null;
    if (!api || !uid) return undefined;
    return api.subscribe(uid, setDocs, e => console.error("friends", e));
  }, [api, uid]);

  const parsed = useMemo(() => parseFriendships(docs || [], uid), [docs, uid]);
  const incoming = useMemo(() => withoutBlocked(parsed.incoming, blocked), [parsed, blocked]);

  // แจ้งเตือนคำขอใหม่ (ไม่แจ้งชุดแรกตอนเปิดแอป — คำขอเก่าเห็นได้ในแท็บเพื่อน)
  useEffect(() => {
    if (docs === null) return;
    const cur = new Set(incoming.map(x => x.uid));
    if (seen.current !== null) {
      cur.forEach(p => {
        if (seen.current.has(p)) return;
        const nm = (nameRef.current && nameRef.current(p)) || "ผู้ใช้";
        showBanner({
          key: "fr-" + p, title: "👋 " + nm + " ส่งคำขอเป็นเพื่อน", ttl: 15000,
          actions: [
            { id: "accept", label: "ตอบรับ", primary: true, onClick: () => { api.accept(uid, p).catch(e => console.error(e)); } },
            { id: "view", label: "ดู", onClick: () => openRef.current && openRef.current() },
          ],
        });
      });
      seen.current.forEach(p => { if (!cur.has(p)) hideBanner("fr-" + p); });
    }
    seen.current = cur;
  }, [docs, incoming, api, uid]);

  const request = useCallback(async (peer) => {
    const plan = planRequest(parsed, uid, peer, { blockedByMe: !!(blocked && blocked.has(peer)) });
    if (plan.action === "none") return { ok: false, reason: plan.reason };
    if (plan.action === "accept") { await api.accept(uid, peer); return { ok: true, result: "accepted" }; }
    return { ok: true, result: await api.request(uid, peer) };
  }, [api, uid, parsed, blocked]);

  const value = useMemo(() => !api || !uid ? OFF : ({
    enabled: true, ready: docs !== null,
    friends: parsed.friends, friendSet: new Set(parsed.friends.map(x => x.uid)),
    incoming, outgoing: parsed.outgoing,
    relation: (peer) => relationOf({ ...parsed, incoming }, peer),
    request, accept: (peer) => api.accept(uid, peer), remove: (peer) => api.remove(uid, peer),
  }), [api, uid, docs, parsed, incoming, request]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
