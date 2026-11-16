// ทดสอบตัวออกโทเคนห้องเสียง (src/voiceToken/server.js): Firebase Admin ตัวจริงคุยกับตัวจำลอง Firestore · ถอดรหัสโทเคน LiveKit ที่ออกมาจริง
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { TokenVerifier } from "livekit-server-sdk";
import { makeTokenHandler } from "../../src/voiceToken/server.js";
import { makeAuthedFetch } from "../../src/voiceToken/client.js";
import { parseRoom, bearerOf, callUsable, kickedFrom, rateStep } from "../../src/voiceToken/logic.js";
import { VOICE_TOKEN_AUTH_REQUIRED, TOKEN_TTL, RATE_MAX, RATE_WINDOW_MS } from "../../src/voiceToken/config.js";

if (!getApps().length) initializeApp({ projectId: "demo-warmly" });
const db = getFirestore();
const A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbb", C = "cccccccccccccccccccccccccccc", BAD = "badbadbadbadbadbadbadbadbadb";
const ENV = { LIVEKIT_API_KEY: "devkey", LIVEKIT_API_SECRET: "devsecret-devsecret-devsecret-devsecret", LIVEKIT_URL: "wss://example.livekit.cloud" };
const verifier = new TokenVerifier(ENV.LIVEKIT_API_KEY, ENV.LIVEKIT_API_SECRET);
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log((c ? "✓ " : "✗ ") + m); };
const fakeAuth = { verifyIdToken: async t => { const m = /^tok:(.+)$/.exec(t); if (!m) throw new Error("bad"); return { uid: m[1] }; } };
let clock = 1_700_000_000_000;
const quiet = { error() {} };
const mk = (over = {}) => makeTokenHandler({ getAdmin: async () => ({ auth: fakeAuth, db }), env: ENV, now: () => clock, authRequired: true, log: quiet, ...over });
async function call(handler, { query, headers }) {
  const out = { headers: {} };
  const res = { setHeader: (k, v) => { out.headers[k] = v; }, status: s => { out.status = s; return { json: b => { out.body = b; return out; } }; } };
  await handler({ query, headers: headers || {} }, res);
  return out;
}
const asUser = (uid, query, h = mk()) => call(h, { query: { identity: uid, name: "ทดสอบ", ...query }, headers: { authorization: "Bearer tok:" + uid } });
const claims = async t => verifier.verify(t);

console.log("\n── ตรรกะ ──");
ok(JSON.stringify(parseRoom("abcDEF123")) === '{"kind":"voice","id":"abcDEF123"}' && JSON.stringify(parseRoom("call_xyz789")) === '{"kind":"call","id":"xyz789"}', "แยกห้องเสียงหลัก / สายโทร จากชื่อห้อง");
ok(parseRoom("") === null && parseRoom("a b") === null && parseRoom("call_") === null && parseRoom("x".repeat(129)) === null && parseRoom("../etc") === null && parseRoom("a/b") === null, "ชื่อห้องแปลกๆ (ว่าง / ช่องว่าง / call_ เปล่า / ยาวเกิน / ../ / /) ถูกปฏิเสธ");
ok(bearerOf({ authorization: "Bearer abc" }) === "abc" && bearerOf({ Authorization: "bearer  x " }) === "x" && bearerOf({}) === null && bearerOf({ authorization: "Basic x" }) === null, "อ่านบัตรผ่านจากหัวคำขอ");
ok(callUsable({ from: A, to: B, status: "accepted" }, B) && callUsable({ from: A, to: B, status: "ringing" }, A) && !callUsable({ from: A, to: B, status: "ended" }, A) && !callUsable({ from: A, to: B, status: "accepted" }, C) && !callUsable(null, A), "สายใช้ได้เฉพาะผู้โทร/ผู้รับ และสายยังไม่จบ");
ok(kickedFrom({ kicked: [BAD] }, BAD) && !kickedFrom({ kicked: [BAD] }, A) && !kickedFrom({}, A), "คนที่ถูกเตะถูกรู้");
const r1 = rateStep(null, 1000, 600000, 3), r2 = rateStep(r1.next, 2000, 600000, 3), r3 = rateStep(r2.next, 3000, 600000, 3), r4 = rateStep(r3.next, 4000, 600000, 3), r5 = rateStep(r4.next, 700000, 600000, 3);
ok(r1.allow && r2.allow && r3.allow && !r4.allow && r4.retryAfterSec > 0 && r5.allow && r5.next.n === 1, "ตัวนับ: 3 ครั้งแรกผ่าน ครั้งที่ 4 ถูกกัน พ้นช่วงเวลาแล้วเริ่มนับใหม่");
ok(VOICE_TOKEN_AUTH_REQUIRED === true && TOKEN_TTL === "2h", "ค่าตั้งต้น: ตรวจสิทธิ์เปิดอยู่ · อายุโทเคน 2 ชั่วโมง");

console.log("\n── ฝั่งแอป ──");
{ const seen = []; const f = makeAuthedFetch({ getIdToken: async () => "T1", fetchFn: async (u, i) => { seen.push([u, i]); return { ok: true }; } });
  await f("/api/token?x=1", { method: "GET", headers: { "X-A": "1" } });
  ok(seen[0][1].headers.Authorization === "Bearer T1" && seen[0][1].headers["X-A"] === "1" && seen[0][1].method === "GET", "แนบบัตรผ่านไปกับคำขอ และคงหัวคำขออื่นไว้");
  const g = makeAuthedFetch({ getIdToken: async () => { throw new Error("no user"); }, fetchFn: async (u, i) => { seen.push([u, i]); return { ok: true }; } });
  await g("/api/token"); ok(!("Authorization" in seen[1][1].headers), "ไม่มีบัญชี → ส่งแบบไม่แนบบัตร (ไม่ throw) ให้เซิร์ฟเวอร์ตอบ 401 เอง"); }

console.log("\n── ตัวออกโทเคน (Firestore จำลอง) ──");
await db.collection("voiceRooms").doc("room1").set({ name: "ห้องทดสอบ", kicked: [BAD] });
await db.collection("calls").doc("call1").set({ from: A, to: B, status: "accepted" });
await db.collection("calls").doc("call2").set({ from: A, to: B, status: "ended" });
const H = mk();
let r = await call(H, { query: { room: "room1", identity: A } });
ok(r.status === 401, "ไม่แนบบัตรผ่าน → 401 (เดิมออกโทเคนให้ใครก็ได้): " + JSON.stringify(r.body));
r = await call(H, { query: { room: "room1", identity: A }, headers: { authorization: "Bearer garbage" } });
ok(r.status === 401, "บัตรผ่านปลอม → 401");
r = await call(H, { query: { identity: A }, headers: { authorization: "Bearer tok:" + A } });
ok(r.status === 400, "ไม่ระบุห้อง → 400");
r = await asUser(A, { room: "room1" }, H); const c1 = await claims(r.body.token);
ok(r.status === 200 && c1.sub === A && c1.video.room === "room1" && c1.video.roomJoin && c1.video.canSubscribe, "ผู้ใช้ที่ล็อกอิน เข้าห้องที่มีอยู่ → ได้โทเคน identity=uid ห้อง=room1 · url=" + r.body.url);
ok(c1.video.canPublish === true, "สิทธิ์พูดยังเป็นแบบเดิม (ทุกคนพูดได้) — ไม่เปลี่ยนพฤติกรรมเวที");
ok(c1.exp - c1.nbf <= 7200 + 5 && c1.exp - c1.nbf >= 7200 - 5, `อายุโทเคน ${c1.exp - c1.nbf} วินาที (2 ชั่วโมง) เดิม 10 ชั่วโมง`);
ok(c1.name === "ทดสอบ", "ชื่อที่แสดงยังส่งผ่านได้");
r = await call(H, { query: { room: "room1", identity: B }, headers: { authorization: "Bearer tok:" + A } });
ok(r.status === 403, "ขอโทเคนในชื่อคนอื่น (identity ≠ บัญชีที่ล็อกอิน) → 403 กันการปลอมตัว/เตะคนอื่น: " + (r.body && r.body.error));
r = await asUser(A, { room: "noSuchRoom123" }, H);
ok(r.status === 404, "ห้องที่ไม่มี (หรือปิดแล้ว) → 404 ไม่เปิดห้องใหม่ให้เปล่าๆ");
r = await asUser(BAD, { room: "room1" }, H);
ok(r.status === 403 && /เตะ/.test(r.body.error), "คนที่ถูกเตะจากห้อง → 403");
r = await asUser(A, { room: "a b" }, H);
ok(r.status === 400, "ชื่อห้องแปลก → 400");

console.log("\n── สายโทรส่วนตัว ──");
r = await asUser(A, { room: "call_call1" }, H); ok(r.status === 200 && (await claims(r.body.token)).video.room === "call_call1", "ผู้โทรเข้าสายของตัวเอง → ได้");
r = await asUser(B, { room: "call_call1" }, H); ok(r.status === 200, "ผู้รับเข้าสายของตัวเอง → ได้");
r = await asUser(C, { room: "call_call1" }, H); ok(r.status === 403, "คนนอกเข้าสายของคนอื่น → 403");
r = await asUser(A, { room: "call_call2" }, H); ok(r.status === 403, "สายที่จบแล้ว → 403");
r = await asUser(A, { room: "call_nosuchcall" }, H); ok(r.status === 404, "สายที่ไม่มี → 404");

console.log("\n── จำกัดจำนวนครั้ง ──");
{ const HH = mk(); await db.collection("tokenRate").doc(C).delete().catch(() => {});
  let last, codes = [];
  for (let i = 0; i < RATE_MAX + 2; i++) { last = await asUser(C, { room: "room1" }, HH); codes.push(last.status); }
  ok(codes.slice(0, RATE_MAX).every(s => s === 200) && codes[RATE_MAX] === 429 && codes[RATE_MAX + 1] === 429, `ขอได้ ${RATE_MAX} ครั้ง ครั้งที่ ${RATE_MAX + 1} เป็นต้นไป → 429`);
  ok(Number(last.headers["Retry-After"]) > 0, "บอกเวลาที่ควรรอ (Retry-After=" + last.headers["Retry-After"] + " วินาที)");
  r = await asUser(A, { room: "room1" }, HH); ok(r.status === 200, "คนอื่นไม่ถูกกันไปด้วย (นับแยกรายคน)");
  clock += RATE_WINDOW_MS + 1000; r = await asUser(C, { room: "room1" }, HH); ok(r.status === 200, "พ้นช่วงเวลา → ใช้ได้อีก"); }

console.log("\n── ระบบเสริม ──");
r = await call(mk({ env: { ...ENV, LIVEKIT_URL: "" } }), { query: { room: "room1", identity: A }, headers: {} }); ok(r.status === 500, "ตัวแปร LiveKit หาย → 500 (เหมือนเดิม)");
r = await call(mk({ getAdmin: async () => { throw Object.assign(new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT"), { code: 501 }); } }), { query: { room: "room1", identity: A }, headers: { authorization: "Bearer tok:" + A } });
ok(r.status === 501 && /FIREBASE_SERVICE_ACCOUNT/.test(r.body.error), "ยังไม่ได้ตั้ง FIREBASE_SERVICE_ACCOUNT → 501 พร้อมข้อความบอกสาเหตุ (ไม่ออกโทเคนแบบเงียบๆ)");
const brokenDb = { collection: () => ({ doc: () => ({ get: async () => { throw new Error("boom"); } }) }), runTransaction: async () => { throw new Error("rate down"); } };
r = await call(mk({ getAdmin: async () => ({ auth: fakeAuth, db: brokenDb }) }), { query: { room: "room1", identity: A }, headers: { authorization: "Bearer tok:" + A } });
ok(r.status === 503, "ตรวจห้องไม่ได้ (Firestore ล่ม) → 503 ไม่ออกโทเคน");
{ const dbRateDown = { ...db, collection: n => db.collection(n), runTransaction: async () => { throw new Error("rate down"); } };
  r = await call(mk({ getAdmin: async () => ({ auth: fakeAuth, db: { collection: n => db.collection(n), runTransaction: async () => { throw new Error("rate down"); } } }) }), { query: { room: "room1", identity: A }, headers: { authorization: "Bearer tok:" + A } });
  ok(r.status === 200, "ตัวนับจำนวนครั้งพังเอง → ปล่อยผ่าน ห้องเสียงไม่ล่มเพราะตัวนับ"); }

console.log("\n── ย้อนกลับเป็นแบบเดิม ──");
{ const L = mk({ authRequired: false }); r = await call(L, { query: { room: "anything", identity: "someone" }, headers: {} }); const cl = await claims(r.body.token);
  ok(r.status === 200 && cl.sub === "someone" && cl.exp - cl.nbf >= 36000 - 5, "สวิตช์ปิด: ออกโทเคนแบบเดิม (ไม่ตรวจสิทธิ์ อายุ 10 ชั่วโมง)");
  const L2 = mk({ env: { ...ENV, VOICE_TOKEN_LEGACY: "1" } }); r = await call(L2, { query: { room: "anything", identity: "someone" }, headers: {} });
  ok(r.status === 200, "ตัวแปร Vercel VOICE_TOKEN_LEGACY=1: ย้อนกลับได้โดยไม่ต้องแก้โค้ด"); }

console.log(`\nผ่าน ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
