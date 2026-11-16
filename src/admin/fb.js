// Admin — ต่อ Firebase ของตัวเอง (สำเนาค่าตั้งเดียวกับแอป ค่าเหล่านี้เปิดเผยได้อยู่แล้วเพราะอยู่ในหน้าเว็บ)
// แยกจาก App.jsx ตั้งใจ: หน้าแอดมินพังก็ไม่กระทบแอปหลัก และแอปหลักไม่ต้องแก้อะไรเลย
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBlruTPdcfWPMgJkQufyhtZnPsT_mbDvKs",
  authDomain: "warmly-app-9e8d6.firebaseapp.com",
  projectId: "warmly-app-9e8d6",
  storageBucket: "warmly-app-9e8d6.firebasestorage.app",
  messagingSenderId: "340884704147",
  appId: "1:340884704147:web:86ab4e1a8aceab0daeb666",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export function watchAuth(cb) { return onAuthStateChanged(auth, cb); }
export async function login() {
  const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    const c = (e && e.code) || "";
    if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") { await signInWithRedirect(auth, p); return; }
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return;
    throw e;
  }
}
export function logout() { return signOut(auth); }

// ── อ่านข้อมูล (อ่านตรงจาก Firestore อย่างเดียว · การลบทำผ่านเซิร์ฟเวอร์ด้านล่าง ไม่เขียน/ลบจากหน้าเว็บเอง) ──
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

export async function loadUsers() { return rows(await getDocs(collection(db, "users"))); }
export async function loadUserImages(uid) {
  const [p, c] = await Promise.all([getDoc(doc(db, "profilePhotos", uid)), getDoc(doc(db, "covers", uid))]);
  return { photosDoc: p.exists() ? p.data() : null, coverDoc: c.exists() ? c.data() : null };
}
export async function loadPosts(n = 60) { return rows(await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(n)))); }
export async function loadGroupChat(n = 150) { return rows(await getDocs(query(collection(db, "groupChat"), orderBy("t", "desc"), limit(n)))); }

// ── ลบ/ระงับผู้ใช้ (เฉพาะแอดมิน) ── ไม่เขียนฐานข้อมูลจากหน้าเว็บเลย: ส่งคำสั่งไปเซิร์ฟเวอร์ /api/admin-delete-user
// เซิร์ฟเวอร์ตรวจสิทธิ์เองทุกครั้ง (ต้องเป็นอีเมล/uid ที่ตั้งใน Vercel: ADMIN_EMAILS หรือ ADMIN_UIDS)
export async function callAdmin(action, payload = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("ต้องเข้าสู่ระบบด้วย Google ก่อน");
  const token = await u.getIdToken();
  const r = await fetch("/api/admin-delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action, ...payload }),
  });
  let j = null; try { j = await r.json(); } catch (e) { /* ไม่ใช่ JSON */ }
  if (!r.ok) throw Object.assign(new Error((j && j.error) || ("ทำไม่สำเร็จ (" + r.status + ")")), { status: r.status });
  return j;
}

// ── AI โพสต์: ดู/อนุมัติ/ปฏิเสธ draft ที่ AI แต่งไว้ (เฉพาะแอดมิน) ──
export async function callAiReview(action, payload = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("ต้องเข้าสู่ระบบด้วย Google ก่อน");
  const token = await u.getIdToken();
  const r = await fetch("/api/ai-post-review", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action, ...payload }),
  });
  let j = null; try { j = await r.json(); } catch (e) { /* ไม่ใช่ JSON */ }
  if (!r.ok) throw Object.assign(new Error((j && j.error) || ("ทำไม่สำเร็จ (" + r.status + ")")), { status: r.status });
  return j;
}
