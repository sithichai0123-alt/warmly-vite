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

// ── อ่านข้อมูล (อ่านอย่างเดียวทั้งหมด ไม่มีการเขียน/ลบในไฟล์นี้) ──
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

export async function loadUsers() { return rows(await getDocs(collection(db, "users"))); }
export async function loadUserImages(uid) {
  const [p, c] = await Promise.all([getDoc(doc(db, "profilePhotos", uid)), getDoc(doc(db, "covers", uid))]);
  return { photosDoc: p.exists() ? p.data() : null, coverDoc: c.exists() ? c.data() : null };
}
export async function loadPosts(n = 60) { return rows(await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(n)))); }
export async function loadGroupChat(n = 150) { return rows(await getDocs(query(collection(db, "groupChat"), orderBy("t", "desc"), limit(n)))); }
