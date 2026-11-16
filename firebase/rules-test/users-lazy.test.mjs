// ทดสอบการโหลดผู้ใช้เฉพาะที่ต้องใช้ (src/scale ส่วนผู้ใช้) กับตัวจำลอง Firestore + กฎจริง
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, query, where, orderBy, limit, getDocs, getCountFromServer, setDoc, documentId, Timestamp } from "firebase/firestore";
import fs from "fs";
import { chunkIds, isUidLike, nameVariants, mergePeople, mergeCache } from "../../src/scale/usersLogic.js";
import { USERS_CHUNK, PEOPLE_PAGE, PEOPLE_SEARCH_LIMIT } from "../../src/scale/config.js";

const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const ME = "mmmmmmmmmmmmmmmmmmmmmmmmmmmm", G = "guestanon0000000000000000000";
const google = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "anonymous" } }).firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };
const rejects = async fn => { try { await fn(); return false; } catch (e) { return true; } };
const uidOf = i => "u" + String(i).padStart(27, "0");   // 28 ตัวเหมือน uid จริง

console.log("\n── ตรรกะ (usersLogic.js) ──");
ok(USERS_CHUNK === 30, "ขนาดกลุ่ม = 30 (ขีดจำกัด “in” ของ Firestore)");
ok(isUidLike(uidOf(1)) && isUidLike("aaaaaaaaaaaaaaaaaaaaaaaaaaaa") && !isUidLike("constructor") && !isUidLike("hasOwnProperty") && !isUidLike("toLocaleString") && !isUidLike("then") && isUidLike("0123456789abcdef") /* รหัสสำรอง 16 ตัว */ && !isUidLike("undefined") && !isUidLike("") && !isUidLike(Symbol("x")) && !isUidLike("a b c d e f g h i j"), "แยกรหัสผู้ใช้จริงออกจากคีย์อื่น (constructor / then / undefined / ช่องว่าง / Symbol)");
const ids = Array.from({ length: 65 }, (_, i) => "id" + i);
ok(chunkIds(ids, 30).map(c => c.length).join() === "30,30,5" && chunkIds([], 30).length === 0, "แบ่ง 65 รหัส → 30,30,5");
ok(nameVariants("toi").join() === "toi,Toi" && nameVariants("Mint").join() === "Mint,mint" && nameVariants("สม").join() === "สม" && nameVariants("  ").length === 0, "ตัวแปรคำค้นหา: toi→[toi,Toi] · Mint→[Mint,mint] · ไทย→คงเดิม");
const mp = mergePeople([[{ id: "a", name: "B" }, { id: "me", name: "Me" }], [{ id: "a", name: "B" }, { id: "c", name: "A" }]], "me", { sortByName: true });
ok(mp.map(p => p.id).join() === "c,a", "รวมผลค้นหา: ตัดซ้ำ ตัดตัวเอง เรียงตามชื่อ");
const c0 = {}; ok(mergeCache(c0, { x: 1 }) !== c0 && c0.x === undefined, "รวมแคชได้ออบเจกต์ใหม่ ไม่แก้ของเดิม");

console.log("\n── คำค้นหาจริงกับกฎจริง (ผู้ใช้ 505 คน) ──");
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  const names = ["Toi", "toi", "Tom", "Mint", "mint", "สมชาย", "สมหญิง", "วิไล", "Arm", "Pam"];
  for (let i = 0; i < 500; i++) await setDoc(doc(d, "users", uidOf(i)), { name: i < names.length ? names[i] : "user" + i, init: "U" + (i % 10), isGuest: i % 7 === 0, coins: 50, lastSeen: Timestamp.fromMillis(1_700_000_000_000 + i * 1000) });
  for (let i = 500; i < 505; i++) await setDoc(doc(d, "users", uidOf(i)), { name: "ghost" + i, init: "GH" });   // ไม่เคยบันทึก lastSeen
});
const U = google(ME);
const inQ = (db, arr) => query(collection(db, "users"), where(documentId(), "in", arr));
const first30 = Array.from({ length: 30 }, (_, i) => uidOf(i + 40));
const g30 = await getDocs(inQ(U, first30));
ok(g30.size === 30, "ดึงผู้ใช้ตามรหัส 30 คนในคำสั่งเดียว (ตอนนี้ฟังทั้ง 505 คน) → ได้ 30 เอกสาร");
ok(await rejects(() => getDocs(inQ(U, Array.from({ length: 31 }, (_, i) => uidOf(i))))), "31 รหัสในคำสั่งเดียว Firestore ปฏิเสธ → ต้องแบ่งกลุ่มละ 30 ตามที่ทำ");
const mixed = await getDocs(inQ(U, [uidOf(1), "nonexistentuid0000000000000000", uidOf(2)]));
ok(mixed.size === 2, "รหัสที่ไม่มีเอกสาร → ไม่คืนมา (ระบบจึงจำเป็น null ให้เอง ไม่ถามซ้ำ)");
ok((await getDocs(inQ(anon(G), first30))).size === 30, "ผู้เยี่ยมชม (Guest) ดึงผู้ใช้ได้");
ok(await rejects(() => getDocs(inQ(env.unauthenticatedContext().firestore(), first30))), "ยังไม่ล็อกอิน ดึงไม่ได้ (กฎยังกันอยู่)");

const cnt = await getCountFromServer(collection(U, "users"));
ok(cnt.data().count === 505 && (await getCountFromServer(collection(anon(G), "users"))).data().count === 505, "ให้เซิร์ฟเวอร์นับสมาชิก = 505 (Guest ก็นับได้)");
ok(await rejects(() => getCountFromServer(collection(env.unauthenticatedContext().firestore(), "users"))), "ยังไม่ล็อกอิน นับไม่ได้");

const page = await getDocs(query(collection(U, "users"), orderBy("lastSeen", "desc"), limit(PEOPLE_PAGE + 1)));
ok(page.size === PEOPLE_PAGE + 1 && page.docs[0].id === uidOf(499), `รายชื่อ “เริ่มแชทกับ...” ดึง ${page.size} คน ใช้งานล่าสุดก่อน (แทน 505 คน)`);
ok(!page.docs.some(d => d.data().name.startsWith("ghost")), "เอกสารผี (ไม่เคยมี lastSeen) ไม่โผล่ในรายชื่อ — ข้อแตกต่างจากเดิมที่แสดงทุกเอกสาร");

const search = async v => (await getDocs(query(collection(U, "users"), where("name", ">=", v), where("name", "<=", v + ""), limit(PEOPLE_SEARCH_LIMIT)))).docs.map(d => d.data().name);
const lists = await Promise.all(nameVariants("to").map(search));
ok(mergePeople(lists.map(l => l.map((n, i) => ({ id: n + i, name: n }))), "x", { sortByName: true }).map(p => p.name).sort().join() === "Tom,Toi,toi".split(",").sort().join(), "ค้น “to” → ได้ Toi / toi / Tom (ลองทั้งตัวพิมพ์ใหญ่และเล็ก): " + [...new Set(lists.flat())].join("/"));
ok((await search("สม")).sort().join() === "สมชาย,สมหญิง", "ค้นชื่อไทย “สม” → สมชาย, สมหญิง");
ok((await search("ิล")).length === 0, "ค้นตัวอักษรกลางชื่อ (“ิล” ใน “วิไล”) → ไม่เจอ — ข้อแตกต่างจากเดิมที่ค้นตรงไหนของชื่อก็เจอ");
ok((await search("zzzz")).length === 0, "ค้นไม่เจอ → ว่าง ไม่ error");

await env.cleanup();
console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
