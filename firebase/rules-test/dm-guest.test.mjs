// ยืนยันว่าผู้เยี่ยมชม (ล็อกอินแบบ anonymous) รับ-ส่งแชทส่วนตัวได้จริงตามกฎ → การเปิดแจ้งเตือนให้เขาจึงมีความหมาย
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import { computeUnread } from "../../src/dmUnread/logic.js";

const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const GUEST = "guestanon0000000000000000000", G2 = "googleuser00000000000000000b";
const anon = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const google = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "google.com" } }).firestore();
const pid = (a, b) => [a, b].sort().join("_");
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };
const rejects = async fn => { try { await fn(); return false; } catch (e) { return true; } };

const PID = pid(GUEST, G2);
console.log("\n── คนล็อกอิน (Google) ทักผู้เยี่ยมชม ──");
let okCreate = true; try { await setDoc(doc(google(G2), "dms", PID), { uids: [GUEST, G2].sort(), last: "สวัสดี", lastFrom: G2, lastT: serverTimestamp() }); } catch (e) { okCreate = false; }
ok(okCreate, "สร้างบทสนทนา dms/{pair} ได้ (คนทักอยู่ในคู่สนทนา)");
let okMsg = true; try { await addDoc(collection(google(G2), "dms", PID, "messages"), { uid: G2, text: "สวัสดีครับ", t: serverTimestamp() }); } catch (e) { okMsg = false; }
ok(okMsg, "ส่งข้อความเข้าห้องแชทได้");

console.log("\n── ผู้เยี่ยมชมอ่านได้ (ฝั่งที่จะต้องเห็นแจ้งเตือน) ──");
let conv; try { conv = (await getDoc(doc(anon(GUEST), "dms", PID))).data(); } catch (e) { conv = null; }
ok(conv && conv.lastFrom === G2, "ผู้เยี่ยมชมอ่านบทสนทนาของตัวเองได้ (lastFrom = คนทัก)");
const msgs = await getDocs(collection(anon(GUEST), "dms", PID, "messages"));
ok(msgs.size === 1, "ผู้เยี่ยมชมอ่านข้อความได้");
const myConvs = await getDocs(query(collection(anon(GUEST), "dms"), where("uids", "array-contains", GUEST)));
ok(myConvs.size === 1, "ผู้เยี่ยมชมดึง 'บทสนทนาของฉัน' ได้ (ตัวเดียวกับที่หน้าแชทและตัวนับใช้)");

console.log("\n── ตัวนับแจ้งเตือนของผู้เยี่ยมชม (ตรรกะเดียวกับในแอป) ──");
const list = myConvs.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
const r1 = computeUnread(list, { myUid: GUEST, readMap: {}, since: 0 });
ok(r1.count === 1 && r1.byPair[PID], "มีข้อความใหม่จากคนอื่น → นับเป็น 1 (ผู้เยี่ยมชมจะเห็นจุดแดง)");
const r2 = computeUnread(list, { myUid: GUEST, readMap: { [PID]: Date.now() + 3600000 }, since: 0 });
ok(r2.count === 0, "อ่านแล้ว (readMap ใหม่กว่า) → ไม่นับ");

console.log("\n── ผู้เยี่ยมชมก็ตอบกลับได้ ──");
ok(!(await rejects(() => addDoc(collection(anon(GUEST), "dms", PID, "messages"), { uid: GUEST, text: "สวัสดีค่ะ", t: serverTimestamp() }))), "ผู้เยี่ยมชมส่งข้อความตอบได้");
ok(await rejects(() => addDoc(collection(anon(GUEST), "dms", PID, "messages"), { uid: G2, text: "ปลอม", t: serverTimestamp() })), "ส่งโดยสวมรอยเป็นคนอื่น (uid ไม่ตรง) → ถูกกฎกัน");

await env.cleanup();
console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
