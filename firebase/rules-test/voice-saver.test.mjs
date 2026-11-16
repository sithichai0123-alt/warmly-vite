// ทดสอบ "พักเสียงห้องเมื่อเงียบ" (src/voiceSaver) — ตรรกะล้วน + ฟิลด์ voiceActiveAt เขียนได้ตามกฎจริง
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import fs from "fs";
import { tsMs, isPureListener, hasVoiceActivity, shouldPause, shouldResume, shouldStamp } from "../../src/voiceSaver/logic.js";

let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };

console.log("\n── ตรรกะ (logic.js) ──");
ok(tsMs(null) === 0 && tsMs(7) === 7 && tsMs({ toMillis: () => 9 }) === 9 && tsMs({ seconds: 2, nanoseconds: 5e6 }) === 2005, "อ่านเวลาได้ทุกแบบ (ไม่มี / ตัวเลข / Timestamp / seconds)");
ok(isPureListener({ stageOn: true, onStage: false, isHost: false }) === true, "ผู้ฟังล้วน = มีเวที + ไม่อยู่บนเวที + ไม่ใช่เจ้าของห้อง");
ok(!isPureListener({ stageOn: true, onStage: true, isHost: false }) && !isPureListener({ stageOn: true, onStage: false, isHost: true }) && !isPureListener({ stageOn: false, onStage: false, isHost: false }), "คนบนเวที / เจ้าของห้อง / ห้องไม่มีเวที → ไม่ถูกพัก");
ok(hasVoiceActivity({ a: true }) === true && hasVoiceActivity({ a: false }) === false && hasVoiceActivity({}) === false && hasVoiceActivity(null) === false, "มีคนพูด = มีใครสักคนใน active speakers");
ok(hasVoiceActivity({ me: true }) === true, "เจ้าของห้องพูดเอง ก็ถือว่ามีเสียง (จะได้ประทับเวลาให้ผู้ฟังที่พักอยู่)");
// shouldPause
ok(shouldPause({ enabled: true, connected: true, listener: true, lastActiveAt: 0, now: 60000, quietMs: 60000 }) === true, "เงียบครบ 60 วิ + เป็นผู้ฟัง + เชื่อมต่ออยู่ → พัก");
ok(!shouldPause({ enabled: true, connected: true, listener: true, lastActiveAt: 0, now: 59999, quietMs: 60000 }), "ยังไม่ครบเวลา → ไม่พัก");
ok(!shouldPause({ enabled: true, connected: true, listener: false, lastActiveAt: 0, now: 99999, quietMs: 60000 }), "ไม่ใช่ผู้ฟัง (คนบนเวที/เจ้าของห้อง) → ไม่พักแม้เงียบ");
ok(!shouldPause({ enabled: false, connected: true, listener: true, lastActiveAt: 0, now: 99999, quietMs: 60000 }) && !shouldPause({ enabled: true, connected: false, listener: true, lastActiveAt: 0, now: 99999, quietMs: 60000 }), "ปิดสวิตช์ / ไม่ได้เชื่อมต่อ → ไม่พัก");
// shouldResume
ok(shouldResume({ paused: true, roomVoiceAtMs: 5000, pausedAt: 4000, graceMs: 0 }) === true, "พักอยู่ + มีคนพูดหลังพัก → กลับเข้าเสียง");
ok(!shouldResume({ paused: true, roomVoiceAtMs: 3000, pausedAt: 4000, graceMs: 0 }), "ประทับเวลาเก่ากว่าตอนพัก → ยังไม่กลับ");
ok(shouldResume({ paused: true, roomVoiceAtMs: 3800, pausedAt: 4000, graceMs: 2000 }) === true, "เผื่อนาฬิกาต่างกัน 2 วิ → กลับได้");
ok(!shouldResume({ paused: false, roomVoiceAtMs: 9999, pausedAt: 0, graceMs: 0 }), "ไม่ได้พักอยู่ → ไม่เกี่ยว");
// shouldStamp
ok(shouldStamp({ isHost: true, connected: true, activity: true, roomVoiceAtMs: 0, now: 20000, throttleMs: 20000 }) === true, "เจ้าของห้อง + มีคนพูด + ค่าห้องเก่ากว่า throttle → ประทับเวลา");
ok(!shouldStamp({ isHost: false, connected: true, activity: true, roomVoiceAtMs: 0, now: 99999, throttleMs: 20000 }), "ไม่ใช่เจ้าของห้อง → ไม่ประทับ (ให้เขียนคนเดียว ลดภาระ Firestore)");
ok(!shouldStamp({ isHost: true, connected: true, activity: true, roomVoiceAtMs: 15000, now: 20000, throttleMs: 20000 }), "เพิ่งประทับไปเมื่อ 5 วิ (ยังไม่ถึง throttle) → ไม่เขียนซ้ำ");
ok(!shouldStamp({ isHost: true, connected: true, activity: false, roomVoiceAtMs: 0, now: 99999, throttleMs: 20000 }), "ไม่มีใครพูด → ไม่ประทับ (ห้องเงียบจะไม่มีการเขียนเลย)");

console.log("\n── ฟิลด์ voiceActiveAt เขียนได้ตามกฎจริง ──");
const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url), "utf8"), host: "127.0.0.1", port: 8089 } });
const A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa", G = "guestanon0000000000000000000";
const google = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = u => env.authenticatedContext(u, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const rejects = async fn => { try { await fn(); return false; } catch (e) { return true; } };
await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "voiceRooms", "r1"), { name: "ห้อง", members: [{ uid: A, mic: true, stage: true }] }));
let okWrite = true; try { await updateDoc(doc(google(A), "voiceRooms", "r1"), { voiceActiveAt: serverTimestamp() }); } catch (e) { okWrite = false; }
ok(okWrite, "เจ้าของห้อง (ล็อกอิน) เขียน voiceActiveAt ได้ (กฎ voiceRooms อนุญาต update)");
let okGuest = true; try { await updateDoc(doc(anon(G), "voiceRooms", "r1"), { voiceActiveAt: serverTimestamp() }); } catch (e) { okGuest = false; }
ok(okGuest, "ผู้เยี่ยมชมก็เขียนได้ (เผื่อเจ้าของห้องเป็น Guest)");
ok(await rejects(() => updateDoc(doc(env.unauthenticatedContext().firestore(), "voiceRooms", "r1"), { voiceActiveAt: serverTimestamp() })), "ยังไม่ล็อกอิน เขียนไม่ได้ (กฎยังกันอยู่)");
let snap; await env.withSecurityRulesDisabled(async c => { snap = (await getDoc(doc(c.firestore(), "voiceRooms", "r1"))).data(); });
ok(snap.voiceActiveAt != null && Array.isArray(snap.members), "เขียน voiceActiveAt แล้ว members เดิมไม่หาย (merge ไม่ทับทั้งก้อน)");
await env.cleanup();

console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
