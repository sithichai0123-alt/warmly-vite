// Admin Tools — ลบผู้ใช้ทั้งหมดจากฝั่งเซิร์ฟเวอร์ (ใช้ Firebase Admin ข้ามกฎ Firestore)
// ไม่ถูก import จากฝั่งแอป · ฉีด admin ({auth, db, FieldValue}) เข้ามาเพื่อทดสอบได้
//
// ความปลอดภัย (ทุกข้อบังคับที่เซิร์ฟเวอร์ ไม่เชื่อหน้าเว็บ):
//  - ตรวจ ID token → ต้องเป็นแอดมินตามค่า ADMIN_UIDS / ADMIN_EMAILS ใน Vercel · ไม่ตั้ง = ปฏิเสธทุกคน
//  - ลบแอดมิน/ตัวเองไม่ได้ · ลบจริงต้องพิมพ์ยืนยัน (6 ตัวท้ายของ uid) ที่ส่งมาตรงกับเป้าหมาย
//  - รายการที่ลบกำหนดตายตัวในไฟล์นี้ ไม่รับ path จากหน้าเว็บ
//  - ไม่ลบ ledger (ประวัติเหรียญ เก็บไว้เป็นหลักฐาน) และไม่แก้ข้อมูลในโพสต์/ห้องของคนอื่น
//  - บันทึกทุกการกระทำลง adminLog (คอลเลกชันนี้ไม่มีกฎเปิด เฉพาะเซิร์ฟเวอร์เขียน/อ่านได้)
import { validUid, isAdmin, isConfigured, targetIsAdmin, confirmWord } from "./logic.js";

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ── รายการที่จะลบ (กำหนดตายตัว) ──
const OWN_DOCS = ["users", "profilePhotos", "covers", "presence", "userBlocks", "callInbox"]; // รหัสเอกสาร = uid
const QUERIES = [ // [ชื่อ, คอลเลกชัน, ฟิลด์, ตัวดำเนินการ, ลบรวมคอลเลกชันย่อยไหม]
  ["posts", "posts", "authorUid", "==", false],
  ["groupChat", "groupChat", "uid", "==", false],
  ["friendships", "friendships", "uids", "array-contains", false],
  ["callsFrom", "calls", "from", "==", false],
  ["callsTo", "calls", "to", "==", false],
  ["dms", "dms", "uids", "array-contains", true],         // ห้องแชท + ข้อความทั้งหมดในห้อง (ของอีกฝ่ายด้วย)
  ["rooms", "voiceRooms", "hostUid", "==", true],         // ห้องเสียงที่เป็นโฮสต์ + แชทในห้อง
];

async function authInfo(auth, uid) {
  try {
    const u = await auth.getUser(uid);
    return { exists: true, disabled: !!u.disabled, email: u.email || "", providers: (u.providerData || []).map(p => p.providerId) };
  } catch (e) {
    if (e && e.code === "auth/user-not-found") return { exists: false, disabled: false, email: "", providers: [] };
    throw e;
  }
}

// นับว่าจะลบอะไรบ้าง (ไม่ลบจริง)
export async function planDelete({ db }, uid) {
  const counts = {};
  const own = await db.getAll(...OWN_DOCS.map(n => db.collection(n).doc(uid)));
  OWN_DOCS.forEach((n, i) => { counts[n] = own[i].exists ? 1 : 0; });
  const inv = await db.collection("inbox").doc(uid).collection("roomInvites").count().get();
  counts.roomInvites = inv.data().count;
  for (const [name, col, field, op] of QUERIES) {
    const s = await db.collection(col).where(field, op, uid).count().get();
    counts[name] = s.data().count;
  }
  let messages = 0;
  if (counts.dms) {
    const rooms = await db.collection("dms").where("uids", "array-contains", uid).select().get();
    for (const d of rooms.docs) messages += (await d.ref.collection("messages").count().get()).data().count;
  }
  counts.dmMessages = messages;
  const ledger = await db.collection("ledger").where("uid", "==", uid).count().get();
  return { counts, kept: { ledger: ledger.data().count } };
}

// ลบจริง — คืนจำนวนที่ลบ (จากแผนที่นับไว้ก่อนลบ)
export async function deleteUserData({ db }, uid) {
  const plan = await planDelete({ db }, uid);
  const bw = db.bulkWriter();
  // 1) ข้อมูลที่ผูกกับคนนี้ ยกเว้นโปรไฟล์ (ไว้ลบท้ายสุด ถ้าพังกลางทางยังหาตัวเจอและกดซ้ำได้)
  for (const [name, col, field, op, recursive] of QUERIES) {
    const snap = await db.collection(col).where(field, op, uid).select().get();
    for (const d of snap.docs) {
      if (recursive) await db.recursiveDelete(d.ref); else bw.delete(d.ref);
    }
  }
  await db.recursiveDelete(db.collection("inbox").doc(uid));   // กล่องคำเชิญ (คอลเลกชันย่อย roomInvites)
  OWN_DOCS.filter(n => n !== "users").forEach(n => bw.delete(db.collection(n).doc(uid)));
  await bw.close();
  await db.collection("users").doc(uid).delete();              // ท้ายสุด
  return plan;
}

async function writeLog({ db, FieldValue }, entry) {
  try { await db.collection("adminLog").add({ ...entry, t: FieldValue.serverTimestamp() }); } catch (e) { /* บันทึกไม่ได้ไม่ควรทำให้งานหลักล้ม */ }
}

export function makeHandler(getAdmin, getConfig) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    try {
      const m = /^Bearer (.+)$/.exec((req.headers && req.headers.authorization) || "");
      if (!m) return res.status(401).json({ error: "ต้องล็อกอินก่อน" });
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const action = body.action;
      if (!["plan", "disable", "enable", "delete"].includes(action)) return res.status(400).json({ error: "คำสั่งไม่ถูกต้อง" });

      const admin = await getAdmin();
      let decoded;
      try { decoded = await admin.auth.verifyIdToken(m[1]); } catch (e) { return res.status(401).json({ error: "โทเคนไม่ถูกต้อง" }); }
      const cfg = getConfig();
      if (!isConfigured(cfg)) return res.status(403).json({ error: "ยังไม่ได้ตั้งค่า ADMIN_EMAILS (หรือ ADMIN_UIDS) ใน Vercel จึงยังไม่มีใครใช้ฟังก์ชันนี้ได้" });
      if (!isAdmin(decoded, cfg)) return res.status(403).json({ error: "บัญชีนี้ไม่มีสิทธิ์แอดมิน" });

      const uid = body.uid;
      if (!validUid(uid)) return res.status(400).json({ error: "uid ไม่ถูกต้อง" });
      const info = await authInfo(admin.auth, uid);
      if (uid === decoded.uid || targetIsAdmin(uid, info.email, cfg)) return res.status(400).json({ error: "ลบ/ระงับบัญชีแอดมิน (รวมถึงตัวเอง) ไม่ได้" });

      if (action === "plan") {
        const p = await planDelete(admin, uid);
        const u = await admin.db.collection("users").doc(uid).get();
        return res.status(200).json({ ok: true, uid, name: (u.exists && (u.data() || {}).name) || "", auth: info, ...p });
      }

      if (action === "disable" || action === "enable") {
        if (!info.exists) return res.status(404).json({ error: "ไม่พบบัญชีล็อกอินของ uid นี้ (อาจเป็นผู้เยี่ยมชมรุ่นเก่า หรือถูกลบไปแล้ว)" });
        await admin.auth.updateUser(uid, { disabled: action === "disable" });
        if (action === "disable") await admin.auth.revokeRefreshTokens(uid);   // เซสชันที่เปิดค้างจะหลุดเมื่อโทเคนหมดอายุ (ไม่เกิน ~1 ชม.)
        await writeLog(admin, { by: decoded.uid, action, target: uid });
        return res.status(200).json({ ok: true, action, auth: { ...info, disabled: action === "disable" } });
      }

      // delete
      if (body.confirm !== confirmWord(uid)) return res.status(400).json({ error: "คำยืนยันไม่ตรง (พิมพ์ 6 ตัวท้ายของ uid)" });
      const plan = await deleteUserData(admin, uid);
      let authAction = "none";
      if (body.deleteAuth === true && info.exists) { await admin.auth.deleteUser(uid); authAction = "deleted"; }
      await writeLog(admin, { by: decoded.uid, action: "delete", target: uid, counts: plan.counts, authAction });
      return res.status(200).json({ ok: true, uid, ...plan, authAction });
    } catch (e) {
      const status = e && (e.code === 501 || e.status) ? (e.code === 501 ? 501 : e.status) : 500;
      return res.status(status).json({ error: (e && e.message) || "ทำไม่สำเร็จ" });
    }
  };
}
