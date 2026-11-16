// Scale — โพสต์ในฟีดแบบโหลดทีละส่วน (ใช้แทนการดึงโพสต์ทั้งหมด 2 ที่)
//   • หน้าต่างโพสต์ล่าสุด (สดตลอด) · ขยายได้ด้วย loadMore() · ดึงครั้งเดียวทั้งแอป ไม่ดึงซ้ำเมื่อสลับแท็บ
//   • โพสต์ของตัวเองทุกอายุ (สด) → แจ้งเตือนของโพสต์เก่าตัวเอง/หน้าโปรไฟล์ตัวเองไม่หาย
//   • หมายเหตุ: ไม่ใช้ orderBy ร่วมกับ where เพื่อไม่ต้องสร้าง index เพิ่มใน Firebase
import { useCallback, useEffect, useMemo, useState } from "react";
import { FEED_PAGE_SIZE, NOTIF_WINDOW, OWN_POSTS_LIMIT, USER_POSTS_LIMIT } from "./config.js";
import { fetchLimit, mergePosts, sliceFeed } from "./logic.js";

const toPosts = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// fb = ฟังก์ชัน Firebase ที่ App.jsx ส่งมาให้ (เหมือนโมดูลอื่น)
export function usePostsFeed({ enabled, uid, fb }) {
  const { db, collection, query, orderBy, limit, where, onSnapshot } = fb;
  const [shown, setShown] = useState(FEED_PAGE_SIZE);
  const [docs, setDocs] = useState([]);
  const [ready, setReady] = useState(false);
  const [own, setOwn] = useState([]);
  const lim = fetchLimit(shown, NOTIF_WINDOW);

  useEffect(() => {
    if (!enabled) { setDocs([]); setReady(false); setShown(FEED_PAGE_SIZE); return undefined; }
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(lim));
    return onSnapshot(q, snap => { setDocs(toPosts(snap)); setReady(true); }, e => { console.error("posts", e); setReady(true); });
  }, [enabled, lim]); // eslint-disable-line

  useEffect(() => {
    if (!enabled || !uid) { setOwn([]); return undefined; }
    const q = query(collection(db, "posts"), where("authorUid", "==", uid), limit(OWN_POSTS_LIMIT));
    return onSnapshot(q, snap => setOwn(toPosts(snap)), e => console.error("ownPosts", e));
  }, [enabled, uid]); // eslint-disable-line

  const view = useMemo(() => sliceFeed(docs, shown), [docs, shown]);
  const all = useMemo(() => mergePosts(view.all, own), [view.all, own]);
  const loadMore = useCallback(() => setShown(n => n + FEED_PAGE_SIZE), []);
  return { feed: view.feed, all, ready, hasMore: view.hasMore, loadMore };
}

// โพสต์ของคนที่กำลังเปิดโปรไฟล์ดู (สด) — โหลดเฉพาะตอนเปิด ไม่ต้องมีโพสต์ทั้งหมดในเครื่อง
export function useUserPosts({ uid, fb }) {
  const { db, collection, query, limit, where, onSnapshot } = fb;
  const [list, setList] = useState([]);
  useEffect(() => {
    setList([]);
    if (!uid) return undefined;
    const q = query(collection(db, "posts"), where("authorUid", "==", uid), limit(USER_POSTS_LIMIT));
    return onSnapshot(q, snap => setList(toPosts(snap)), e => console.error("userPosts", e));
  }, [uid]); // eslint-disable-line
  return list;
}
