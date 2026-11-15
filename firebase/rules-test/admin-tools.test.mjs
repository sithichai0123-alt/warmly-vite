// ทดสอบ "ลบผู้ใช้ทั้งหมด" กับ Firestore Emulator จริง (ใช้โค้ดจริงจาก src/adminTools ไม่ใช่สำเนา)
// บัญชีล็อกอิน (Auth) จำลองด้วยออบเจ็กต์ เพราะไม่ได้รัน Auth Emulator — ส่วนที่ทดสอบจริงคือการลบข้อมูล
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { makeHandler, planDelete, deleteUserData } from "../../src/adminTools/server.js";
import { isAdmin, isConfigured, validUid, targetIsAdmin, confirmWord, parseEmails, cloudinaryPublicId, collectVideos } from "../../src/adminTools/logic.js";
import { deleteVideos } from "../../src/adminTools/cloudinary.js";

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


// ── วิดีโอบน Cloudinary ──
console.log("\n── อ่านลิงก์วิดีโอ → public_id ──");
const CL = "ochjk9uo", base = "https://res.cloudinary.com/" + CL + "/video/upload/";
ok(cloudinaryPublicId(base + "v1699999999/abcd1234.mp4", CL) === "abcd1234", "ลิงก์ปกติ → abcd1234");
ok(cloudinaryPublicId(base + "so_0,eo_30/v1699999999/abcd1234.mp4", CL) === "abcd1234", "ลิงก์ที่แทรกตัวตัด so_0,eo_30 (แบบที่แอปเก็บ) → abcd1234");
ok(cloudinaryPublicId(base + "so_0,eo_30/abcd1234.mp4", CL) === "abcd1234", "มีตัวตัดแต่ไม่มีเลขเวอร์ชัน → abcd1234");
ok(cloudinaryPublicId(base + "v12/warmly/clips/ab%20cd.mov", CL) === "warmly/clips/ab cd", "อยู่ในโฟลเดอร์ + ชื่อมีช่องว่าง/นามสกุลอื่น");
ok(cloudinaryPublicId(base + "v12/abcd1234.mp4?x=1#y", CL) === "abcd1234", "มี query/hash ท้ายลิงก์");
ok(cloudinaryPublicId("https://res.cloudinary.com/otheracct/video/upload/v1/abcd.mp4", CL) === null, "ลิงก์ของบัญชี Cloudinary อื่น → ไม่ลบ");
ok(cloudinaryPublicId("https://res.cloudinary.com/" + CL + "/image/upload/v1/abcd.jpg", CL) === null, "ไม่ใช่วิดีโอ (image/upload) → ไม่ลบ");
ok(cloudinaryPublicId("https://evil.example.com/" + CL + "/video/upload/v1/abcd.mp4", CL) === null, "โดเมนอื่นแอบอ้างชื่อบัญชี → ไม่ลบ");
ok(cloudinaryPublicId("data:image/png;base64,AAAA", CL) === null && cloudinaryPublicId("", CL) === null && cloudinaryPublicId(null, CL) === null && cloudinaryPublicId(base + "v1/a.mp4", "") === null, "รูป base64 / ว่าง / ไม่รู้ชื่อบัญชี → ไม่ลบ");
ok(cloudinaryPublicId(base + "v1/%2e%2e/secret.mp4", CL) === null && cloudinaryPublicId(base + "v1/../secret.mp4", CL) === null, "พยายามแทรก ../ → ไม่ลบ");
ok(collectVideos([{ images: [base + "v1/aa.mp4", base + "so_0,eo_30/v1/aa.mp4", "data:image/png;base64,AA", base + "v1/bb.mp4"] }, { images: "ไม่ใช่อาร์เรย์" }, {}], CL).map(v => v.publicId).join() === "aa,bb", "รวมลิงก์จากหลายโพสต์: ตัดซ้ำ (ลิงก์เดิมกับแบบตัด) และข้ามรูป base64");

console.log("\n── ตัวเรียก Cloudinary ──");
const reqs = [];
const okFetch = async (url, init) => { reqs.push({ url, init }); const ids = new URLSearchParams(init.body).getAll("public_ids[]"); return { ok: true, status: 200, json: async () => ({ deleted: Object.fromEntries(ids.map((i, n) => [i, i.startsWith("gone") ? "not_found" : "deleted"])) }) }; };
let dv = await deleteVideos({ cloud: CL, key: "K", secret: "S", fetchFn: okFetch }, ["aa", "gone1"]);
ok(reqs.length === 1 && reqs[0].init.method === "DELETE" && reqs[0].url === "https://api.cloudinary.com/v1_1/ochjk9uo/resources/video/upload", "ส่ง DELETE ไปที่ /resources/video/upload ของบัญชีที่ถูกต้อง");
ok(reqs[0].init.headers.Authorization === "Basic " + Buffer.from("K:S").toString("base64"), "ยืนยันตัวตนแบบ Basic (key:secret)");
ok(new URLSearchParams(reqs[0].init.body).getAll("public_ids[]").join() === "aa,gone1" && new URLSearchParams(reqs[0].init.body).get("invalidate") === "true", "ส่ง public_ids[] ครบ และสั่งล้างแคช CDN");
ok(dv.deleted === 1 && dv.notFound === 1, "นับ ลบแล้ว 1 · ไม่พบ 1 (ไม่พบ = ไม่ถือว่าล้มเหลว)");
reqs.length = 0;
dv = await deleteVideos({ cloud: CL, key: "K", secret: "S", fetchFn: okFetch }, Array.from({ length: 205 }, (_, i) => "v" + i));
ok(reqs.length === 3 && dv.deleted === 205 && new URLSearchParams(reqs[0].init.body).getAll("public_ids[]").length === 100 && new URLSearchParams(reqs[2].init.body).getAll("public_ids[]").length === 5, "205 ไฟล์ → แบ่งส่ง 3 ครั้ง (100/100/5)");
let threw = ""; try { await deleteVideos({ cloud: CL, key: "K", secret: "S", fetchFn: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid credentials" } }) }) }, ["aa"]); } catch (e) { threw = e.message; }
ok(/401/.test(threw) && /Invalid credentials/.test(threw), "Cloudinary ปฏิเสธ → โยน error ที่อ่านเข้าใจ");

console.log("\n── ลบผู้ใช้ + วิดีโอ ──");
const vids = [CL, "x"].map(() => null);
async function seedVideos() {
  await seed();
  await db.collection("posts").add({ authorUid: U, content: "คลิป", images: [base + "so_0,eo_30/v1/clipU1.mp4", "data:image/png;base64,AA", base + "v2/clipU2.mp4"] });
  await db.collection("posts").add({ authorUid: V, content: "คลิปของ V", images: [base + "v3/clipV.mp4"] });
}
const fetchLog = []; const spyFetch = async (u, i) => { fetchLog.push(new URLSearchParams(i.body).getAll("public_ids[]")); return okFetch(u, i); };
const cl = { cloud: CL, key: "K", secret: "S", fetchFn: spyFetch };
await seedVideos();
let pl = await planDelete({ db }, U, CL);
ok(pl.videos.map(v => v.publicId).sort().join() === "clipU1,clipU2", "แผนแสดงลิงก์วิดีโอของ U เท่านั้น (ไม่รวมของ V และข้ามรูป base64)");
await deleteUserData({ db }, U, { cloudinary: cl, deleteVideos: false });
ok(fetchLog.length === 0 && !(await exists("users/" + U)), "ไม่ติ๊กลบวิดีโอ → ไม่เรียก Cloudinary เลย แต่ลบข้อมูลตามปกติ");
await seedVideos(); fetchLog.length = 0;
let dr = await deleteUserData({ db }, U, { cloudinary: cl, deleteVideos: true });
ok(fetchLog.length === 1 && fetchLog[0].sort().join() === "clipU1,clipU2", "ติ๊กลบวิดีโอ → ส่งเฉพาะ clipU1, clipU2 (ไม่แตะ clipV ของ V)");
ok(dr.videoResult.deleted === 2 && !(await exists("users/" + U)) && (await db.collection("posts").where("authorUid", "==", U).count().get()).data().count === 0, "ลบวิดีโอสำเร็จ แล้วลบข้อมูลใน Firestore ตามหลัง");
ok((await db.collection("posts").where("content", "==", "คลิปของ V").count().get()).data().count === 1 && (await db.collection("posts").where("authorUid", "==", V).count().get()).data().count === 2, "โพสต์วิดีโอของ V (และโพสต์เดิมของ V) ยังอยู่ครบ");
await seedVideos();
let failed = ""; try { await deleteUserData({ db }, U, { cloudinary: { ...cl, fetchFn: async () => ({ ok: false, status: 500, json: async () => ({}) }) }, deleteVideos: true }); } catch (e) { failed = e.message; }
ok(/500/.test(failed) && /ยังไม่ได้ลบข้อมูลใดๆ/.test(failed) && await exists("users/" + U) && (await db.collection("posts").where("authorUid", "==", U).count().get()).data().count === 3, "Cloudinary ล้มเหลว → หยุดทั้งหมด ข้อมูลและลิงก์ใน Firestore ยังอยู่ครบ (ลองใหม่ได้)");

console.log("\n── handler: วิดีโอ ──");
const mkc = c => makeHandler(async () => ({ auth: fakeAuth(tokens, authUsers), db, FieldValue }), () => cfg, () => c);
await seedVideos();
r = await call(mkc({ cloud: CL }), { body: { action: "plan", uid: U } });
ok(r.status === 200 && r.json.cloudinary.configured === false && r.json.videos.length === 2 && r.json.videos.every(v => /^https:\/\/res\.cloudinary\.com\//.test(v.url)), "ยังไม่ตั้ง key → plan ยังแสดงลิงก์วิดีโอให้คัดลอก และบอกว่า configured = false");
r = await call(mkc({ cloud: CL }), { body: { action: "delete", uid: U, confirm: confirmWord(U), deleteVideos: true } });
ok(r.status === 400 && /CLOUDINARY_API_KEY/.test(r.json.error) && await exists("users/" + U), "ติ๊กลบวิดีโอแต่ยังไม่ตั้ง key → 400 ไม่ลบอะไร");
r = await call(mkc({ cloud: CL }), { body: { action: "delete", uid: U, confirm: confirmWord(U) } });
ok(r.status === 200 && r.json.videos.length === 2 && r.json.videoResult === null && !(await exists("users/" + U)), "ไม่ติ๊กลบวิดีโอ → ลบข้อมูล และตอบลิงก์วิดีโอกลับมาให้จดไปลบเอง");
await seedVideos(); fetchLog.length = 0;
r = await call(mkc(cl), { body: { action: "plan", uid: U } });
ok(r.json.cloudinary.configured === true, "ตั้ง key แล้ว → configured = true");
r = await call(mkc(cl), { body: { action: "delete", uid: U, confirm: confirmWord(U), deleteVideos: true } });
ok(r.status === 200 && r.json.videoResult.deleted === 2 && fetchLog.length === 1, "ตั้ง key + ติ๊ก → ลบวิดีโอบน Cloudinary ผ่าน handler สำเร็จ");
const lg = (await db.collection("adminLog").get()).docs.map(d => d.data()).find(d => d.videos && d.videos.deleted === 2);
ok(!!lg && !JSON.stringify(lg).includes("res.cloudinary.com"), "บันทึก adminLog จำนวนวิดีโอที่ลบ (ไม่เก็บลิงก์)");

console.log(`\nผ่าน ${pass} / ${pass + fail}`); if (bad.length) console.log("ไม่ผ่าน:\n - " + bad.join("\n - "));
process.exit(fail ? 1 : 0);
