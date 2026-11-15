// ทดสอบ "ลบผู้ใช้ทั้งหมด" กับ Firestore Emulator จริง (ใช้โค้ดจริงจาก src/adminTools ไม่ใช่สำเนา)
// บัญชีล็อกอิน (Auth) จำลองด้วยออบเจ็กต์ เพราะไม่ได้รัน Auth Emulator — ส่วนที่ทดสอบจริงคือการลบข้อมูล
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { makeHandler, planDelete, deleteUserData } from "../../src/adminTools/server.js";
import { isAdmin, isConfigured, validUid, targetIsAdmin, confirmWord, parseEmails } from "../../src/adminTools/logic.js";

const app = initializeApp({ projectId: "demo-warmly" });
const db = getFirestore(app);
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { c ? pass++ : (fail++, bad.push(m)); console.log((c ? "✓ " : "✗ ") + m); };
const exists = async p => (await db.doc(p).get()).exists;
const clear = async () => { for (const c of await db.listCollections()) await db.recursiveDelete(c); };

// ── ตรรกะสิทธิ์ ──
console.log("\n── สิทธิ์แอดมิน ──");
const cfg = { uids: ["ADMINUID0001"], emails: parseEmails("Boss@Example.com, other@x.com") };
ok(!isConfigured({ uids: [], emails: [] }) && isConfigured(cfg), "ไม่ตั้งค่า = ไม่มีใครเป็นแอดมิน");
ok(isAdmin({ uid: "ADMINUID0001" }, cfg), "uid ตรงรายการ → แอดมิน");
ok(!isAdmin({ uid: "adminuid0001" }, cfg), "uid ต้องตรงตัวพิมพ์เล็กใหญ่");
ok(isAdmin({ uid: "zz", email: "boss@example.com", email_verified: true }, cfg), "อีเมลตรง (ไม่แยกตัวพิมพ์) และยืนยันแล้ว → แอดมิน");
ok(!isAdmin({ uid: "zz", email: "boss@example.com", email_verified: false }, cfg), "อีเมลตรงแต่ยังไม่ยืนยัน → ไม่ใช่");
ok(!isAdmin({ uid: "ADMINUID0001", firebase: { sign_in_provider: "anonymous" } }, cfg), "บัญชีนิรนามเป็นแอดมินไม่ได้แม้ uid ตรง");
ok(!isAdmin({ uid: "someone", email: "nobody@x.com", email_verified: true }, cfg), "คนอื่น → ไม่ใช่");
ok(!isAdmin({ uid: "ADMINUID0001" }, { uids: [], emails: [] }), "ไม่ตั้งค่าแล้ว uid ตรงก็ไม่ผ่าน");
ok(validUid("abcDEF123456") && !validUid("a_b") && !validUid("a/b") && !validUid("abc") && !validUid("") && !validUid(null) && !validUid("x".repeat(65)), "uid ที่ยอมรับ: ตัวอักษร/ตัวเลข 6–64 ไม่มี _ หรือ /");
ok(targetIsAdmin("x1x1x1", "BOSS@example.com", cfg) && targetIsAdmin("ADMINUID0001", "", cfg) && !targetIsAdmin("x1x1x1", "n@x.com", cfg), "ตรวจเป้าหมายเป็นแอดมิน (ทาง uid/อีเมล)");

// ── ข้อมูลทดลอง ──
const U = "targetUser0000000000000000AA", V = "bystander000000000000000000BB", W = "otherperson00000000000000000CC", U2 = U + "X"; // U2 ขึ้นต้นเหมือน U (กันลบเกิน)
const pid = (a, b) => [a, b].sort().join("_");
async function seed() {
  await clear();
  for (const id of [U, V, W, U2]) await db.doc("users/" + id).set({ name: "n-" + id.slice(0, 6), coins: 10 });
  for (const c of ["profilePhotos", "covers", "presence", "userBlocks", "callInbox"]) { await db.doc(`${c}/${U}`).set({ x: 1 }); await db.doc(`${c}/${V}`).set({ x: 1 }); }
  await db.doc(`inbox/${U}/roomInvites/${V}`).set({ from: V }); await db.doc(`inbox/${V}/roomInvites/${U}`).set({ from: U });
  await db.doc(`inbox/${V}/roomInvites/${W}`).set({ from: W });
  await db.collection("posts").add({ authorUid: U, content: "ของ U" }); await db.collection("posts").add({ authorUid: U, content: "ของ U 2" });
  await db.collection("posts").add({ authorUid: V, content: "ของ V", comments: [{ uid: U, text: "คอมเมนต์ของ U" }] });
  await db.collection("groupChat").add({ uid: U, text: "u" }); await db.collection("groupChat").add({ uid: V, text: "v" });
  await db.doc(`friendships/${pid(U, V)}`).set({ uids: [U, V].sort(), status: "accepted" }); await db.doc(`friendships/${pid(V, W)}`).set({ uids: [V, W].sort(), status: "accepted" });
  await db.doc(`dms/${pid(U, V)}`).set({ uids: [U, V].sort() }); await db.collection(`dms/${pid(U, V)}/messages`).add({ uid: U, text: "a" }); await db.collection(`dms/${pid(U, V)}/messages`).add({ uid: V, text: "b" });
  await db.doc(`dms/${pid(V, W)}`).set({ uids: [V, W].sort() }); await db.collection(`dms/${pid(V, W)}/messages`).add({ uid: V, text: "c" });
  await db.doc(`dms/${pid(U2, V)}`).set({ uids: [U2, V].sort() }); await db.collection(`dms/${pid(U2, V)}/messages`).add({ uid: U2, text: "d" });
  await db.doc("calls/c1").set({ from: U, to: V }); await db.doc("calls/c2").set({ from: W, to: U }); await db.doc("calls/c3").set({ from: V, to: W });
  await db.doc("voiceRooms/r1").set({ hostUid: U }); await db.collection("voiceRooms/r1/chat").add({ uid: V, text: "ในห้องของ U" }); await db.doc("voiceRooms/r2").set({ hostUid: V });
  await db.collection("ledger").add({ uid: U, gold: 5 }); await db.collection("ledger").add({ uid: V, gold: 5 });
}
const count = async c => (await db.collection(c).count().get()).data().count;

console.log("\n── แผน (ยังไม่ลบ) ──");
await seed();
const plan = await planDelete({ db }, U);
ok(plan.counts.users === 1 && plan.counts.posts === 2 && plan.counts.groupChat === 1 && plan.counts.dms === 1 && plan.counts.dmMessages === 2, "นับถูก: โปรไฟล์ 1 · โพสต์ 2 · แชทห้องรวม 1 · ห้องแชท 1 (ข้อความ 2)");
ok(plan.counts.friendships === 1 && plan.counts.callsFrom === 1 && plan.counts.callsTo === 1 && plan.counts.rooms === 1 && plan.counts.roomInvites === 1, "นับถูก: เพื่อน 1 · สายโทร 2 · ห้องเสียง 1 · คำเชิญ 1");
ok(plan.kept.ledger === 1, "ประวัติเหรียญ (ledger) ถูกระบุว่าเก็บไว้");
ok(await exists("users/" + U) && (await count("posts")) === 3, "การดูแผนไม่ลบอะไร");

console.log("\n── ลบจริง ──");
await seed();
await deleteUserData({ db }, U);
for (const c of ["users", "profilePhotos", "covers", "presence", "userBlocks", "callInbox"]) ok(!(await exists(`${c}/${U}`)), `ลบ ${c}/<uid> แล้ว`);
ok(!(await exists(`inbox/${U}/roomInvites/${V}`)), "ลบกล่องคำเชิญของเขาแล้ว");
ok(!(await db.collection("posts").where("authorUid", "==", U).count().get()).data().count, "ลบโพสต์ของเขาครบ");
ok(!(await db.collection("groupChat").where("uid", "==", U).count().get()).data().count, "ลบข้อความห้องรวมของเขา");
ok(!(await exists(`friendships/${pid(U, V)}`)), "ลบความเป็นเพื่อนที่มีเขา");
ok(!(await exists(`dms/${pid(U, V)}`)) && (await db.collection(`dms/${pid(U, V)}/messages`).count().get()).data().count === 0, "ลบห้องแชทที่มีเขา พร้อมข้อความทั้งหมดในห้อง (รวมของอีกฝ่าย)");
ok(!(await exists("calls/c1")) && !(await exists("calls/c2")), "ลบสายโทรที่เขาโทรออก/รับ");
ok(!(await exists("voiceRooms/r1")) && (await db.collection("voiceRooms/r1/chat").count().get()).data().count === 0, "ลบห้องเสียงที่เขาเป็นโฮสต์ พร้อมแชทในห้อง");
console.log("   — ต้องไม่โดนของคนอื่น —");
ok(await exists("users/" + V) && await exists("users/" + W) && await exists("users/" + U2), "โปรไฟล์ V, W และ U2 (uid ขึ้นต้นเหมือน U) ยังอยู่");
ok(await exists(`profilePhotos/${V}`) && await exists(`presence/${V}`) && await exists(`callInbox/${V}`), "ข้อมูลของ V ยังอยู่");
ok((await db.collection("posts").where("authorUid", "==", V).count().get()).data().count === 1, "โพสต์ของ V ยังอยู่");
ok((await db.collection("groupChat").where("uid", "==", V).count().get()).data().count === 1, "ข้อความห้องรวมของ V ยังอยู่");
ok(await exists(`friendships/${pid(V, W)}`) && await exists(`dms/${pid(V, W)}`) && (await db.collection(`dms/${pid(V, W)}/messages`).count().get()).data().count === 1, "เพื่อน/แชทระหว่าง V กับ W ยังอยู่");
ok(await exists(`dms/${pid(U2, V)}`) && (await db.collection(`dms/${pid(U2, V)}/messages`).count().get()).data().count === 1, "แชทของ U2 (uid ใกล้เคียง) ยังอยู่ครบ");
ok(await exists("calls/c3") && await exists("voiceRooms/r2"), "สายโทรและห้องเสียงของคนอื่นยังอยู่");
ok(await exists(`inbox/${V}/roomInvites/${W}`), "คำเชิญที่คนอื่นส่งถึง V ยังอยู่");
ok((await db.collection("ledger").where("uid", "==", U).count().get()).data().count === 1 && (await db.collection("ledger").where("uid", "==", V).count().get()).data().count === 1, "ประวัติเหรียญเก็บไว้ทั้งของ U และ V");
const vp = (await db.collection("posts").where("authorUid", "==", V).get()).docs[0].data();
ok(Array.isArray(vp.comments) && vp.comments.length === 1, "คอมเมนต์ของ U ในโพสต์ของ V ยังอยู่ (ไม่แก้ข้อมูลของคนอื่น ระบุไว้ในข้อจำกัด)");
await deleteUserData({ db }, U);
ok(true, "ลบซ้ำได้ ไม่ error (กดซ้ำเมื่อโปรไฟล์ถูกสร้างใหม่ได้)");

console.log("\n── ตัวจัดการคำขอ (handler) ──");
const calls = [];
const fakeAuth = (decodedByToken, users) => ({
  verifyIdToken: async t => { if (!decodedByToken[t]) throw new Error("bad"); return decodedByToken[t]; },
  getUser: async uid => { if (!users[uid]) throw Object.assign(new Error("nf"), { code: "auth/user-not-found" }); return users[uid]; },
  updateUser: async (uid, p) => { calls.push(["updateUser", uid, p]); }, revokeRefreshTokens: async uid => { calls.push(["revoke", uid]); }, deleteUser: async uid => { calls.push(["deleteUser", uid]); },
});
const tokens = {
  admin: { uid: "ADMINUID0001", email: "boss@example.com", email_verified: true, firebase: { sign_in_provider: "google.com" } },
  user: { uid: V, email: "v@x.com", email_verified: true, firebase: { sign_in_provider: "google.com" } },
  anon: { uid: "ADMINUID0001", firebase: { sign_in_provider: "anonymous" } },
};
const authUsers = { [U]: { disabled: false, email: "u@x.com", providerData: [{ providerId: "google.com" }] }, ADMINUID0001: { email: "boss@example.com", providerData: [] } };
const mk = (config = cfg) => makeHandler(async () => ({ auth: fakeAuth(tokens, authUsers), db, FieldValue }), () => config);
async function call(h, { method = "POST", token = "admin", body = {} } = {}) {
  let status = 0, json = null; const res = { setHeader() {}, status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await h({ method, headers: token ? { authorization: "Bearer " + token } : {}, body }, res); return { status, json };
}
let r;
await seed();
r = await call(mk(), { method: "GET" }); ok(r.status === 405, "GET → 405");
r = await call(mk(), { token: null, body: { action: "plan", uid: U } }); ok(r.status === 401, "ไม่มีโทเคน → 401");
r = await call(mk(), { token: "garbage", body: { action: "plan", uid: U } }); ok(r.status === 401, "โทเคนปลอม → 401");
r = await call(mk(), { token: "user", body: { action: "plan", uid: U } }); ok(r.status === 403, "ผู้ใช้ทั่วไป → 403");
r = await call(mk(), { token: "anon", body: { action: "plan", uid: U } }); ok(r.status === 403, "บัญชีนิรนามที่ uid ตรงแอดมิน → 403");
r = await call(mk({ uids: [], emails: [] }), { body: { action: "plan", uid: U } }); ok(r.status === 403 && /ADMIN_EMAILS/.test(r.json.error), "ยังไม่ตั้งค่า → 403 พร้อมบอกให้ไปตั้ง ADMIN_EMAILS");
r = await call(mk(), { body: { action: "nope", uid: U } }); ok(r.status === 400, "คำสั่งไม่รู้จัก → 400");
r = await call(mk(), { body: { action: "plan", uid: "a/b" } }); ok(r.status === 400, "uid แปลก → 400");
r = await call(mk(), { body: { action: "delete", uid: "ADMINUID0001", confirm: confirmWord("ADMINUID0001") } }); ok(r.status === 400, "ลบตัวเอง → 400");
authUsers[W] = { email: "other@x.com", providerData: [] };
r = await call(mk(), { body: { action: "delete", uid: W, confirm: confirmWord(W) } }); ok(r.status === 400 && await exists("users/" + W), "ลบแอดมินอีกคน (ตรงอีเมลในรายการ) → 400 และไม่ลบ");
r = await call(mk(), { body: { action: "plan", uid: U } }); ok(r.status === 200 && r.json.counts.posts === 2 && r.json.auth.exists && !r.json.auth.disabled && r.json.name === "n-target", "plan → 200 ได้จำนวนและสถานะบัญชีล็อกอิน");
r = await call(mk(), { body: { action: "delete", uid: U } }); ok(r.status === 400 && await exists("users/" + U), "ลบโดยไม่ส่งคำยืนยัน → 400 และไม่ลบ");
r = await call(mk(), { body: { action: "delete", uid: U, confirm: "wrong1" } }); ok(r.status === 400 && await exists("users/" + U), "คำยืนยันผิด → 400 และไม่ลบ");
r = await call(mk(), { body: { action: "disable", uid: U } });
ok(r.status === 200 && calls.some(c => c[0] === "updateUser" && c[2].disabled === true) && calls.some(c => c[0] === "revoke"), "ระงับบัญชี → ปิดการล็อกอิน + เพิกถอนเซสชัน");
r = await call(mk(), { body: { action: "enable", uid: U } }); ok(r.status === 200 && calls.some(c => c[0] === "updateUser" && c[2].disabled === false), "เปิดบัญชีคืนได้");
r = await call(mk(), { body: { action: "disable", uid: V } }); ok(r.status === 404, "ระงับ uid ที่ไม่มีบัญชีล็อกอิน → 404 (บอกชัดเจน)");
calls.length = 0;
r = await call(mk(), { body: { action: "delete", uid: U, confirm: confirmWord(U) } });
ok(r.status === 200 && !(await exists("users/" + U)) && r.json.authAction === "none" && !calls.some(c => c[0] === "deleteUser"), "ลบข้อมูล (ไม่ติ๊กลบบัญชีล็อกอิน) → ลบข้อมูล แต่บัญชีล็อกอินยังอยู่");
const logs = await db.collection("adminLog").get();
ok(logs.size >= 3 && logs.docs.some(d => d.data().action === "delete" && d.data().target === U && d.data().by === "ADMINUID0001"), "มีบันทึกใน adminLog (ใคร ทำอะไร กับใคร)");
await seed(); calls.length = 0;
r = await call(mk(), { body: { action: "delete", uid: U, confirm: confirmWord(U), deleteAuth: true } });
ok(r.status === 200 && r.json.authAction === "deleted" && calls.some(c => c[0] === "deleteUser" && c[1] === U), "ติ๊กลบบัญชีล็อกอินด้วย → ลบทั้งข้อมูลและบัญชี");
r = await call(mk(), { body: { action: "delete", uid: V, confirm: confirmWord(V), deleteAuth: true } });
ok(r.status === 200 && !calls.some(c => c[0] === "deleteUser" && c[1] === V), "uid ที่ไม่มีบัญชีล็อกอิน (เช่นเหลือแต่ห้องแชท) ลบข้อมูลได้ ไม่ error");

console.log(`\nผ่าน ${pass} / ${pass + fail}`); if (bad.length) console.log("ไม่ผ่าน:\n - " + bad.join("\n - "));
process.exit(fail ? 1 : 0);
