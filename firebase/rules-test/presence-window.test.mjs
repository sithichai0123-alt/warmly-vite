// ทดสอบสถานะออนไลน์แบบ "ฟังเฉพาะคนที่เพิ่ง active" (src/presence) กับตัวจำลอง Firestore + กฎจริง
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, query, where, getDocs, getDoc, setDoc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import fs from "fs";
import { makePresenceApi } from "../../src/presence/api.js";
import { computeStatus, countOnline, windowStart } from "../../src/presence/logic.js";
import { STALE_MS, PRESENCE_WINDOW_MS, PRESENCE_WINDOW_ENABLED } from "../../src/presence/config.js";

const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const ME = "mmmmmmmmmmmmmmmmmmmmmmmmmmmm", G = "guestanon0000000000000000000";
const google = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "anonymous" } }).firestore();
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };
const rejects = async fn => { try { await fn(); return false; } catch (e) { return true; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("\n── ตรรกะ ──");
ok(PRESENCE_WINDOW_ENABLED && PRESENCE_WINDOW_MS > STALE_MS, "หน้าต่าง (15 นาที) ต้องกว้างกว่า STALE_MS (13 นาที) เสมอ — ไม่งั้นคนที่ยังออนไลน์จะหลุดจากรายการ");
ok(windowStart(1000, 300) === 700, "windowStart ถูกต้อง");
const now = Date.now();
const docsT = { a: { state: "online", t: now - 60_000 }, b: { state: "offline", t: now - 60_000 }, c: { state: "online", t: now - 20 * 60_000 }, d: { state: "online", hidden: true, t: now } };
ok(countOnline(docsT, now) === 1, "นับออนไลน์: เฉพาะ a (b ออฟไลน์, c เงียบเกิน, d ซ่อนอยู่) = 1");
ok(countOnline(null, now) === 0 && countOnline({}, now) === 0, "นับจากข้อมูลว่างไม่พัง");

console.log("\n── คำค้นหาจริงกับกฎจริง (ผู้ใช้ 600 คน: 12 คน active ใน 5 นาที, 588 คนหายไปเป็นวัน) ──");
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  for (let i = 0; i < 600; i++) {
    const fresh = i < 12;
    await setDoc(doc(d, "presence", "u" + String(i).padStart(3, "0")), { state: fresh ? "online" : "offline", hidden: false, hideLast: false, t: Timestamp.fromMillis(Date.now() - (fresh ? 2 * 60_000 : (2 + i) * 3_600_000)) });
  }
});
const api = db => makePresenceApi({ db, doc, setDoc, collection, onSnapshot, serverTimestamp, query, where, getDoc });
const listen = (db, since) => new Promise((res, rej) => { const a = api(db); const un = a.subscribe(m => { un(); res(m); }, rej, since); });
const full = await listen(google(ME));
const win = await listen(google(ME), windowStart(Date.now(), PRESENCE_WINDOW_MS));
ok(Object.keys(full).length === 600 && Object.keys(win).length === 12, `เดิมฟัง ${Object.keys(full).length} เอกสาร → ใหม่ฟัง ${Object.keys(win).length} เอกสาร (ลด ${Math.round((1 - 12 / 600) * 100)}%)`);
ok(countOnline(full, Date.now()) === countOnline(win, Date.now()) && countOnline(win, Date.now()) === 12, "จำนวนคนออนไลน์เท่ากันทั้ง 2 แบบ (12 คน) → จุดเขียว/ตัวเลขออนไลน์ตรงเดิม");
const same = Object.keys(full).every(k => computeStatus(full[k], Date.now()).state === computeStatus(win[k], Date.now()).state);
ok(same, "สถานะออนไลน์/ออฟไลน์ของทั้ง 600 คน เหมือนกันทุกคน (คนที่ไม่อยู่ในหน้าต่างถูกมองเป็นออฟไลน์ ซึ่งตรงกับของเดิม)");
ok((await listen(anon(G), windowStart(Date.now(), PRESENCE_WINDOW_MS)).then(m => Object.keys(m).length)) === 12, "ผู้เยี่ยมชม (Guest) ฟังได้");
ok(await rejects(() => listen(env.unauthenticatedContext().firestore(), windowStart(Date.now(), PRESENCE_WINDOW_MS))), "ยังไม่ล็อกอิน ฟังไม่ได้ (กฎยังกันอยู่)");
// ดึงทีละคน (ออนไลน์ล่าสุดของคนเงียบนาน + สถานะเดิมของตัวเอง)
const one = await api(google(ME)).getOne("u500");
ok(one && one.state === "offline" && computeStatus(one, Date.now()).lastSeen > 0, "ดึงเอกสารของ u500 (หายไปเป็นวัน) ทีละคนได้ → ได้เวลา “ออนไลน์ล่าสุด”");
ok((await api(google(ME)).getOne("nobody")) === null, "คนที่ไม่เคยมีสถานะ → ได้ null ไม่ error");

console.log("\n── เขียนสถานะตัวเอง แล้วโผล่ในหน้าต่างทันที ──");
{
  const db = google(ME); const a = api(db);
  const seen = []; const un = a.subscribe(m => seen.push(Object.keys(m).includes(ME)), e => console.error(e), windowStart(Date.now(), PRESENCE_WINDOW_MS));
  await sleep(400);
  const before = seen[seen.length - 1];
  await a.write(ME, { state: "online", hidden: false, hideLast: false, lastPrefOff: false });
  await sleep(500); un();
  ok(before === false && seen[seen.length - 1] === true, "ก่อนเขียน: ตัวเองไม่อยู่ในหน้าต่าง → เขียนสถานะ (ส่งสัญญาณ) แล้ว ตัวเองเข้ามาในรายการ");
}
await env.cleanup();
console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
