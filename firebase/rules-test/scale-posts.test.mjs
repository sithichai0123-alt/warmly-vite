// ทดสอบการโหลดโพสต์แบบทีละส่วน (src/scale) กับตัวจำลอง Firestore + กฎจริง: คำค้นหาที่แอปจะใช้ ผ่านกฎ/ไม่ต้องมี index/ได้จำนวนเอกสารตามที่ตั้งใจ
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import fs from "fs";
import { fetchLimit, sliceFeed, mergePosts, withFocus, createdMs } from "../../src/scale/logic.js";
import { FEED_PAGE_SIZE, NOTIF_WINDOW, OWN_POSTS_LIMIT, USER_POSTS_LIMIT } from "../../src/scale/config.js";

const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbb", G = "guestanon0000000000000000000";
const google = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "anonymous" } }).firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };
const rejects = async fn => { try { await fn(); return false; } catch (e) { return true; } };

// ── ตรรกะล้วน ──
console.log("\n── ตรรกะ (logic.js) ──");
ok(NOTIF_WINDOW >= FEED_PAGE_SIZE, "หน้าต่างแจ้งเตือน ≥ หน้าฟีด");
ok(fetchLimit(30, 60) === 61 && fetchLimit(90, 60) === 91, "ขอเกิน 1 รายการเสมอ (61 / 91)");
const mk = (id, ms) => ({ id, createdAt: { toMillis: () => ms } });
const docs = Array.from({ length: 61 }, (_, i) => mk("p" + i, 1000 - i));
let sl = sliceFeed(docs, 30);
ok(sl.feed.length === 30 && sl.all.length === 61 && sl.hasMore, "ได้ 61 แสดง 30 → ยังมีให้ดูเพิ่ม");
sl = sliceFeed(docs.slice(0, 20), 30);
ok(sl.feed.length === 20 && !sl.hasMore, "ได้ 20 (ไม่ถึง 30) → ไม่มีปุ่มดูเพิ่ม");
sl = sliceFeed(docs.slice(0, 31), 30);
ok(sl.feed.length === 30 && sl.hasMore, "ได้ 31 แสดง 30 → มีให้ดูเพิ่ม 1");
sl = sliceFeed(docs.slice(0, 30), 30);
ok(!sl.hasMore, "ได้ 30 พอดี → ไม่มีเก่ากว่านี้");
const m1 = mergePosts([mk("a", 5), mk("b", 3)], [mk("b", 3), mk("c", 9), { id: "d", createdAt: null }]);
ok(m1.map(p => p.id).join() === "d,c,a,b", "รวมรายการ: ตัดซ้ำ + ใหม่สุดก่อน + โพสต์ที่กำลังส่ง (ยังไม่มีเวลา) อยู่บนสุด");
ok(mergePosts().length === 0 && mergePosts(null, undefined).length === 0, "รวมรายการว่าง/null ไม่พัง");
ok(createdMs({ createdAt: new Date(7) }) === 7 && createdMs({ createdAt: { seconds: 2, nanoseconds: 5e6 } }) === 2005 && createdMs({ createdAt: 9 }) === 9, "อ่านเวลาได้ทั้ง Date / seconds / ตัวเลข");
const feed = [mk("x", 9)], all = [mk("x", 9), mk("old", 1)];
ok(withFocus(feed, all, "old").map(p => p.id).join() === "old,x", "โพสต์จากแจ้งเตือนที่เก่ากว่าฟีด → ใส่ไว้บนสุดให้เปิดได้");
ok(withFocus(feed, all, "x") === feed && withFocus(feed, all, null) === feed && withFocus(feed, all, "nope") === feed, "โพสต์อยู่ในฟีดแล้ว/ไม่มี/หาไม่เจอ → ไม่เปลี่ยน");

// ── กับ Firestore จริง (ตัวจำลอง) ──
console.log("\n── คำค้นหาจริงกับกฎจริง (โพสต์ 250 รายการ: 40 ของ A, 210 ของ B) ──");
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  for (let i = 0; i < 250; i++) {
    const mine = i < 40;
    await addDoc(collection(d, "posts"), { authorUid: mine ? A : B, author: mine ? "A" : "B", content: "p" + i, likes: 0, likers: [], comments: [], createdAt: Timestamp.fromMillis(1_700_000_000_000 + i * 1000) });
  }
});
const winQ = (db, n) => query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(fetchLimit(n, NOTIF_WINDOW)));
const ownQ = (db, uid) => query(collection(db, "posts"), where("authorUid", "==", uid), limit(OWN_POSTS_LIMIT));
const userQ = (db, uid) => query(collection(db, "posts"), where("authorUid", "==", uid), limit(USER_POSTS_LIMIT));

const old = await getDocs(query(collection(google(A), "posts"), orderBy("createdAt", "desc")));
const w = await getDocs(winQ(google(A), FEED_PAGE_SIZE));
ok(old.size === 250 && w.size === 61, `เดิมดึง ${old.size} รายการ → ใหม่ดึง ${w.size} รายการ (ลด ${Math.round((1 - w.size / old.size) * 100)}%)`);
ok(w.docs[0].data().content === "p249", "หน้าต่างเรียงใหม่สุดก่อน (โพสต์ล่าสุดอยู่บนสุด)");
const w2 = await getDocs(winQ(google(A), 90));
ok(w2.size === 91, "กดดูเพิ่มจนเกิน 60 → ขอ 91 รายการ");
const ownA = await getDocs(ownQ(google(A), A));
ok(ownA.size === 40 && ownA.docs.every(d => d.data().authorUid === A), "โพสต์ของตัวเอง ดึงมา 40 รายการ ถูกคนทั้งหมด (ไม่ต้องสร้าง index)");
const userB = await getDocs(userQ(google(A), B));
ok(userB.size === USER_POSTS_LIMIT, `เปิดโปรไฟล์คนอื่น (B มี 210 โพสต์) ดึงแค่ ${userB.size}`);
ok((await getDocs(winQ(anon(G), FEED_PAGE_SIZE))).size === 61, "ผู้เยี่ยมชม (Guest) ดึงฟีดได้");
ok((await getDocs(ownQ(anon(G), G))).size === 0, "ผู้เยี่ยมชมดึง “โพสต์ของตัวเอง” ได้ (ไม่มีโพสต์ = ว่าง ไม่ error)");
ok(await rejects(() => getDocs(winQ(env.unauthenticatedContext().firestore(), 30))), "ยังไม่ล็อกอิน ดึงไม่ได้ (กฎยังกันอยู่)");
// เทียบแจ้งเตือน: ไลก์/คอมเมนต์ในโพสต์เก่าของตัวเองยังอยู่ในชุดข้อมูล
const merged = mergePosts(w.docs.map(d => ({ id: d.id, ...d.data() })), ownA.docs.map(d => ({ id: d.id, ...d.data() })));
ok(merged.filter(p => p.authorUid === A).length === 40, "ชุดแจ้งเตือน = หน้าต่าง 61 + โพสต์ตัวเอง → มีโพสต์ของ A ครบ 40 (แม้ส่วนใหญ่เก่ากว่าหน้าต่าง)");
console.log(`   (ชุดที่ใช้คำนวณแจ้งเตือน ${merged.length} รายการ แทน 250)`);

await env.cleanup();
console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
