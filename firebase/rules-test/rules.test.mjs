import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, arrayUnion, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import fs from "fs";
const env = await initializeTestEnvironment({ projectId: "demo-warmly", firestore: { rules: fs.readFileSync(new URL("../firestore.rules.draft", import.meta.url),"utf8"), host:"127.0.0.1", port:8089 } });
const A="aaaaaaaaaaaaaaaaaaaaaaaaaaaa", B="bbbbbbbbbbbbbbbbbbbbbbbbbbbb", C="cccccccccccccccccccccccccccc", G="guestanon0000000000000000000";
const google = u => env.authenticatedContext(u, { firebase:{ sign_in_provider:"google.com" } }).firestore();
const anon   = u => env.authenticatedContext(u, { firebase:{ sign_in_provider:"anonymous" } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();
const pid = (x,y)=>[x,y].sort().join("_");
let pass=0, fail=0; const bad=[];
async function t(name, fn, expectOk){ await env.clearFirestore(); let ok; try{ await fn(); ok=true;}catch(e){ ok=false; }
  const good = ok===expectOk; good?pass++:(fail++,bad.push(name)); console.log((good?"✓ ":"✗ ")+(expectOk?"ได้   ":"ห้าม  ")+name); }
const seed = async fn => env.withSecurityRulesDisabled(async c => { const s = c.firestore(); return fn(s); });
const OK=(n,f)=>t(n,f,true), NO=(n,f)=>t(n,f,false);

console.log("\n── ยังไม่ล็อกอิน (ช่องโหว่ที่เจอ) ──");
await NO("อ่านรายชื่อผู้ใช้", ()=>getDocs(collection(nobody(),"users")));
await NO("อ่านรายการแชทส่วนตัว", ()=>getDocs(collection(nobody(),"dms")));
await NO("เขียนโพสต์", ()=>addDoc(collection(nobody(),"posts"),{authorUid:A}));
await NO("แก้เหรียญตัวเอง", ()=>setDoc(doc(nobody(),"users",A),{coins:999999}));

console.log("\n── users / เหรียญ ──");
await OK("ผู้ใช้ล็อกอินอ่านรายชื่อผู้ใช้ (หน้าฟีด)", ()=>getDocs(collection(google(A),"users")));
await OK("บันทึกโปรไฟล์ตัวเอง (saveMyProfile)", ()=>setDoc(doc(google(A),"users",A),{name:"ก",init:"กก",isGuest:false,lastSeen:serverTimestamp()},{merge:true}));
await NO("แก้โปรไฟล์คนอื่น", ()=>setDoc(doc(google(A),"users",B),{name:"ถูกแฮ็ก"},{merge:true}));
await OK("เหรียญต้อนรับครั้งแรก 50 (ensureWallet)", ()=>setDoc(doc(google(A),"users",A),{coins:50,inventory:[],giftCount:0},{merge:true}));
await OK("เหรียญต้อนรับหลังบันทึกโปรไฟล์ไปแล้ว (ลำดับจริงในแอป)", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{name:"ก",init:"กก",isGuest:false})); await setDoc(doc(google(A),"users",A),{coins:50,inventory:[],giftCount:0},{merge:true}); });
await NO("ตั้งเหรียญต้อนรับเกิน 50 หลังบันทึกโปรไฟล์แล้ว", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{name:"ก"})); await setDoc(doc(google(A),"users",A),{coins:99999,inventory:[]},{merge:true}); });
await NO("ตั้งเหรียญต้อนรับเกิน 50", ()=>setDoc(doc(google(A),"users",A),{coins:99999,inventory:[],giftCount:0},{merge:true}));
await NO("ผู้เยี่ยมชมรับเหรียญต้อนรับ", ()=>setDoc(doc(anon(G),"users",G),{coins:50},{merge:true}));
await OK("หักเหรียญตอนซื้อของ (buyItem)", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100,inventory:[]})); await setDoc(doc(google(A),"users",A),{coins:60,inventory:["badge:x"]},{merge:true}); });
await NO("เพิ่มเหรียญเอง 100 → 99999", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100})); await setDoc(doc(google(A),"users",A),{coins:99999},{merge:true}); });
await OK("โบนัสรายวัน +20 (claimDaily)", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100,lastDaily:"2026-11-13",streak:1})); await setDoc(doc(google(A),"users",A),{coins:120,lastDaily:"2026-11-14",streak:2},{merge:true}); });
await OK("โบนัสรายวันครบ 7 วัน +70", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100,lastDaily:"2026-11-13",streak:6})); await setDoc(doc(google(A),"users",A),{coins:170,lastDaily:"2026-11-14",streak:7},{merge:true}); });
await NO("ขอโบนัสรายวันแต่ใส่เหรียญเกิน 70", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100,lastDaily:"2026-11-13"})); await setDoc(doc(google(A),"users",A),{coins:5000,lastDaily:"2026-11-14"},{merge:true}); });
await NO("เพิ่มเหรียญโดยไม่เปลี่ยนวันรับ", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{coins:100,lastDaily:"2026-11-14"})); await setDoc(doc(google(A),"users",A),{coins:120,lastDaily:"2026-11-14"},{merge:true}); });
await NO("ผู้เยี่ยมชมรับโบนัสรายวัน", async()=>{ await seed(d=>setDoc(doc(d,"users",G),{coins:10,lastDaily:"x"})); await setDoc(doc(anon(G),"users",G),{coins:30,lastDaily:"y"},{merge:true}); });
await NO("เพิ่มเหรียญม่วงเอง", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{purple:5})); await setDoc(doc(google(A),"users",A),{purple:500},{merge:true}); });
await OK("หักเหรียญม่วง (ซื้อธีม/ส่งของขวัญม่วง)", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{purple:5,purpleBought:3})); await setDoc(doc(google(A),"users",A),{purple:2,purpleBought:1,giftsSent:increment(1)},{merge:true}); });

console.log("\n── ส่งของขวัญ (แตะเอกสารผู้รับ) ──");
await OK("ผู้ส่งเพิ่มตัวนับของขวัญให้ผู้รับ (ทอง)", async()=>{ await seed(d=>setDoc(doc(d,"users",B),{giftCount:2,giftValue:10})); await setDoc(doc(google(A),"users",B),{giftCount:increment(1),giftValue:increment(100)},{merge:true}); });
await OK("ผู้ส่งเพิ่มตัวนับของขวัญให้ผู้รับ (ม่วง)", async()=>{ await seed(d=>setDoc(doc(d,"users",B),{giftCount:2})); await setDoc(doc(google(A),"users",B),{giftCount:increment(1),giftPurple:increment(8)},{merge:true}); });
await NO("ลดตัวนับของขวัญของคนอื่น", async()=>{ await seed(d=>setDoc(doc(d,"users",B),{giftCount:5})); await setDoc(doc(google(A),"users",B),{giftCount:0},{merge:true}); });
await NO("แอบแก้เหรียญคนอื่นผ่านช่องส่งของขวัญ", async()=>{ await seed(d=>setDoc(doc(d,"users",B),{coins:10,giftCount:1})); await setDoc(doc(google(A),"users",B),{giftCount:increment(1),coins:0},{merge:true}); });
await NO("ลบเอกสารผู้ใช้", async()=>{ await seed(d=>setDoc(doc(d,"users",A),{name:"x"})); await deleteDoc(doc(google(A),"users",A)); });

console.log("\n── ประวัติเหรียญ (ledger) ──");
await OK("เขียนประวัติของตัวเอง", ()=>addDoc(collection(google(A),"ledger"),{uid:A,gold:5,t:serverTimestamp()}));
await NO("เขียนประวัติแทนคนอื่น", ()=>addDoc(collection(google(A),"ledger"),{uid:B,gold:5}));
await OK("อ่านประวัติของตัวเอง (query uid==me)", ()=>getDocs(query(collection(google(A),"ledger"),where("uid","==",A))));
await NO("อ่านประวัติของคนอื่น", ()=>getDocs(query(collection(google(A),"ledger"),where("uid","==",B))));
await NO("แก้ประวัติย้อนหลัง", async()=>{ await seed(d=>setDoc(doc(d,"ledger","l1"),{uid:A,gold:5})); await updateDoc(doc(google(A),"ledger","l1"),{gold:999}); });

console.log("\n── โพสต์ ──");
await OK("โพสต์ของตัวเอง", ()=>addDoc(collection(google(A),"posts"),{authorUid:A,content:"hi"}));
await OK("ผู้เยี่ยมชมโพสต์ได้", ()=>addDoc(collection(anon(G),"posts"),{authorUid:G,content:"hi"}));
await NO("โพสต์สวมชื่อคนอื่น", ()=>addDoc(collection(google(A),"posts"),{authorUid:B,content:"hi"}));
await OK("คนอื่นกดถูกใจ", async()=>{ await seed(d=>setDoc(doc(d,"posts","p1"),{authorUid:B,likes:0,likers:[]})); await updateDoc(doc(google(A),"posts","p1"),{likers:arrayUnion({uid:A}),likes:increment(1)}); });
await OK("คนอื่นคอมเมนต์/ตอบกลับ", async()=>{ await seed(d=>setDoc(doc(d,"posts","p1"),{authorUid:B,comments:[]})); await updateDoc(doc(google(A),"posts","p1"),{comments:arrayUnion({uid:A,text:"x"})}); });
await NO("คนอื่นแก้เนื้อหาโพสต์", async()=>{ await seed(d=>setDoc(doc(d,"posts","p1"),{authorUid:B,content:"เดิม"})); await updateDoc(doc(google(A),"posts","p1"),{content:"ถูกแก้"}); });
await NO("คนอื่นลบโพสต์", async()=>{ await seed(d=>setDoc(doc(d,"posts","p1"),{authorUid:B})); await deleteDoc(doc(google(A),"posts","p1")); });
await OK("เจ้าของลบโพสต์ตัวเอง", async()=>{ await seed(d=>setDoc(doc(d,"posts","p1"),{authorUid:A})); await deleteDoc(doc(google(A),"posts","p1")); });

console.log("\n── แชทห้องรวม / ห้องเสียง ──");
await OK("ส่งข้อความห้องรวม", ()=>addDoc(collection(google(A),"groupChat"),{uid:A,text:"hi",t:serverTimestamp()}));
await NO("ส่งข้อความห้องรวมสวมรอยคนอื่น", ()=>addDoc(collection(google(A),"groupChat"),{uid:B,text:"hi"}));
await OK("ระบบล้างข้อความเก่าห้องรวม (batch delete)", async()=>{ await seed(d=>setDoc(doc(d,"groupChat","m1"),{uid:B})); const d2=google(A); const b=writeBatch(d2); b.delete(doc(d2,"groupChat","m1")); await b.commit(); });
await OK("ส่งข้อความในห้องเสียง", ()=>addDoc(collection(google(A),"voiceRooms","r1","chat"),{uid:A,text:"hi"}));
await NO("ส่งข้อความห้องเสียงสวมรอย", ()=>addDoc(collection(google(A),"voiceRooms","r1","chat"),{uid:B,text:"hi"}));
await OK("สร้าง/เข้า/ออกห้องเสียง", async()=>{ const r=await addDoc(collection(google(A),"voiceRooms"),{hostUid:A,members:[]}); await updateDoc(doc(google(B),"voiceRooms",r.id),{members:[{uid:B}]}); });

console.log("\n── แชทส่วนตัว (dms) ──");
const P=pid(A,B);
await OK("ส่งข้อความแรกของห้องใหม่ (ห้องยังไม่มี)", async()=>{ await addDoc(collection(google(A),"dms",P,"messages"),{uid:A,text:"hi"}); await setDoc(doc(google(A),"dms",P),{uids:[A,B].sort(),last:"hi",lastFrom:A,lastT:serverTimestamp()},{merge:true}); });
await OK("เช็กว่ามีห้องแล้วหรือยัง (get ห้องที่ยังไม่มี)", ()=>getDoc(doc(google(A),"dms",P)));
await OK("อ่านรายการ 'บทสนทนาของฉัน'", async()=>{ await seed(d=>setDoc(doc(d,"dms",P),{uids:[A,B].sort()})); await getDocs(query(collection(google(A),"dms"),where("uids","array-contains",A))); });
await OK("คู่สนทนาอ่านข้อความ", async()=>{ await seed(d=>setDoc(doc(d,"dms",P,"messages","m1"),{uid:A,text:"x"})); await getDocs(collection(google(B),"dms",P,"messages")); });
await NO("คนนอกอ่านข้อความส่วนตัว", async()=>{ await seed(d=>setDoc(doc(d,"dms",P,"messages","m1"),{uid:A,text:"x"})); await getDocs(collection(google(C),"dms",P,"messages")); });
await NO("คนนอกอ่านรายการแชททั้งหมด", ()=>getDocs(collection(google(C),"dms")));
await NO("คนนอกอ่านรายการแชทของคนอื่น (query ของ A)", ()=>getDocs(query(collection(google(C),"dms"),where("uids","array-contains",A))));
await NO("คนนอกส่งข้อความเข้าห้องของคนอื่น", ()=>addDoc(collection(google(C),"dms",P,"messages"),{uid:C,text:"x"}));
await NO("ส่งข้อความสวมรอยคู่สนทนา", ()=>addDoc(collection(google(A),"dms",P,"messages"),{uid:B,text:"x"}));
await OK("ล้างประวัติแชทของตัวเอง (clearedAt)", ()=>setDoc(doc(google(A),"dms",P),{uids:[A,B].sort(),clearedAt:{[A]:serverTimestamp()}},{merge:true}));
await OK("ลบข้อความแชทส่วนตัว (คู่สนทนา)", async()=>{ await seed(d=>setDoc(doc(d,"dms",P,"messages","m1"),{uid:A})); await deleteDoc(doc(google(B),"dms",P,"messages","m1")); });
await NO("คนนอกลบข้อความแชทส่วนตัว", async()=>{ await seed(d=>setDoc(doc(d,"dms",P,"messages","m1"),{uid:A})); await deleteDoc(doc(google(C),"dms",P,"messages","m1")); });
await OK("ผู้เยี่ยมชามคุยแชทส่วนตัวกับคนอื่น", async()=>{ const Q=pid(G,A); await addDoc(collection(anon(G),"dms",Q,"messages"),{uid:G,text:"hi"}); await setDoc(doc(anon(G),"dms",Q),{uids:[G,A].sort(),last:"hi"},{merge:true}); });

console.log("\n── เพื่อน ──");
const F=pid(A,B);
await OK("ส่งคำขอเป็นเพื่อน", ()=>setDoc(doc(google(A),"friendships",F),{uids:[A,B].sort(),status:"pending",from:A,createdAt:serverTimestamp()}));
await NO("ส่งคำขอสวมรอยเป็นคนอื่น", ()=>setDoc(doc(google(A),"friendships",F),{uids:[A,B].sort(),status:"pending",from:B}));
await NO("สร้างความเป็นเพื่อนระหว่างคนอื่น 2 คน", ()=>setDoc(doc(google(C),"friendships",F),{uids:[A,B].sort(),status:"pending",from:C}));
await NO("ส่งคำขอแล้วตั้งเป็นเพื่อนกันเองทันที", ()=>setDoc(doc(google(A),"friendships",F),{uids:[A,B].sort(),status:"accepted",from:A}));
await OK("ฝั่งที่ถูกขอกดตอบรับ", async()=>{ await seed(d=>setDoc(doc(d,"friendships",F),{uids:[A,B].sort(),status:"pending",from:A})); await setDoc(doc(google(B),"friendships",F),{status:"accepted",acceptedAt:serverTimestamp()},{merge:true}); });
await NO("คนส่งคำขอตอบรับให้ตัวเอง", async()=>{ await seed(d=>setDoc(doc(d,"friendships",F),{uids:[A,B].sort(),status:"pending",from:A})); await setDoc(doc(google(A),"friendships",F),{status:"accepted"},{merge:true}); });
await OK("ปฏิเสธ/เลิกเป็นเพื่อน (ลบ)", async()=>{ await seed(d=>setDoc(doc(d,"friendships",F),{uids:[A,B].sort(),status:"accepted",from:A})); await deleteDoc(doc(google(B),"friendships",F)); });
await NO("คนนอกลบความเป็นเพื่อน", async()=>{ await seed(d=>setDoc(doc(d,"friendships",F),{uids:[A,B].sort(),status:"accepted",from:A})); await deleteDoc(doc(google(C),"friendships",F)); });
await OK("เช็กสถานะเพื่อน (get คู่ที่ยังไม่มี)", ()=>getDoc(doc(google(A),"friendships",F)));
await OK("รายชื่อเพื่อนของฉัน (query)", ()=>getDocs(query(collection(google(A),"friendships"),where("uids","array-contains",A))));

console.log("\n── เชิญเข้าห้อง / โทร ──");
await OK("เชิญเพื่อนเข้าห้อง", ()=>setDoc(doc(google(A),"inbox",B,"roomInvites",A),{from:A,roomId:"r1",status:"pending"}));
await NO("เชิญสวมรอยเป็นคนอื่น", ()=>setDoc(doc(google(A),"inbox",B,"roomInvites",C),{from:C,roomId:"r1"}));
await OK("ผู้รับอ่าน/ลบคำเชิญของตัวเอง", async()=>{ await seed(d=>setDoc(doc(d,"inbox",B,"roomInvites",A),{from:A})); await getDoc(doc(google(B),"inbox",B,"roomInvites",A)); await deleteDoc(doc(google(B),"inbox",B,"roomInvites",A)); });
await NO("คนอื่นแอบอ่านกล่องคำเชิญ", async()=>{ await seed(d=>setDoc(doc(d,"inbox",B,"roomInvites",A),{from:A})); await getDoc(doc(google(C),"inbox",B,"roomInvites",A)); });
await OK("โทรหาเพื่อน: สร้างสาย + ปลุกกล่องผู้รับ", async()=>{ await setDoc(doc(google(A),"calls","c1"),{from:A,to:B,status:"ringing"}); await setDoc(doc(google(A),"callInbox",B),{callId:"c1",dir:"in",from:A}); await setDoc(doc(google(A),"callInbox",A),{callId:"c1",dir:"out"}); });
await OK("ผู้รับกดรับสาย", async()=>{ await seed(d=>setDoc(doc(d,"calls","c1"),{from:A,to:B,status:"ringing"})); await updateDoc(doc(google(B),"calls","c1"),{status:"accepted"}); await setDoc(doc(google(B),"callInbox",A),{callId:"c1",dir:"out",from:A,status:"accepted"}); });
await NO("คนนอกยุ่งกับสายของคนอื่น", async()=>{ await seed(d=>setDoc(doc(d,"calls","c1"),{from:A,to:B,status:"ringing"})); await updateDoc(doc(google(C),"calls","c1"),{status:"ended"}); });
await NO("แอบอ่านกล่องปลุกสายของคนอื่น", async()=>{ await seed(d=>setDoc(doc(d,"callInbox",B),{callId:"c1"})); await getDoc(doc(google(A),"callInbox",B)); });
await OK("เช็กสายที่ยังไม่มี (get)", ()=>getDoc(doc(google(A),"calls","none")));

console.log("\n── ข้อมูลของเจ้าของ / ธีม / ออนไลน์ ──");
await OK("อัปโหลดรูปโปรไฟล์/ปกของตัวเอง", async()=>{ await setDoc(doc(google(A),"profilePhotos",A),{photos:[]}); await setDoc(doc(google(A),"covers",A),{cover:"x"}); });
await NO("เปลี่ยนรูปโปรไฟล์/ปกคนอื่น", async()=>{ await setDoc(doc(google(A),"profilePhotos",B),{photos:[]}); });
await OK("อ่านรูปโปรไฟล์คนอื่น", ()=>getDoc(doc(google(A),"profilePhotos",B)));
await OK("อัปเดตสถานะออนไลน์ตัวเอง", ()=>setDoc(doc(google(A),"presence",A),{state:"online",t:serverTimestamp()},{merge:true}));
await NO("ปลอมสถานะออนไลน์คนอื่น", ()=>setDoc(doc(google(A),"presence",B),{state:"online"}));
await OK("รายชื่อที่บล็อก: ตัวเองอ่าน/เขียน", async()=>{ await setDoc(doc(google(A),"userBlocks",A),{list:[B]}); await getDoc(doc(google(A),"userBlocks",A)); });
await NO("แอบอ่านรายชื่อที่คนอื่นบล็อก", async()=>{ await seed(d=>setDoc(doc(d,"userBlocks",B),{list:[A]})); await getDoc(doc(google(A),"userBlocks",B)); });
await OK("ผู้ใช้ Google ตั้งธีมร่วม", ()=>setDoc(doc(google(A),"appConfig","theme"),{id:"x"},{merge:true}));
await NO("ผู้เยี่ยมชมตั้งธีมร่วม", ()=>setDoc(doc(anon(G),"appConfig","theme"),{id:"x"},{merge:true}));
await OK("ทุกคนที่ล็อกอินอ่านธีมร่วม", ()=>getDoc(doc(anon(G),"appConfig","theme")));
await NO("คอลเลกชันที่ไม่รู้จัก", ()=>setDoc(doc(google(A),"hack","x"),{a:1}));

console.log(`\nผ่าน ${pass} / ${pass+fail}`); if(bad.length) console.log("ไม่ผ่าน:\n - "+bad.join("\n - "));
await env.cleanup(); process.exit(fail?1:0);
