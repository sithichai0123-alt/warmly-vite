import { useState, useRef, useEffect, useCallback, useMemo, Component, createContext, useContext } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, doc, updateDoc, increment, serverTimestamp, deleteDoc, getDocs, setDoc, getDoc, where, limit, arrayUnion, runTransaction } from "firebase/firestore";
import { VoiceAura, AuraShop, makeAuraWallet, resolveAura, useAuraMode, VOICE_AURA_ENABLED, AURA_LITE_ROOM_SIZE, AURA_SERVER_PURCHASE } from "./voiceAura/index.js"; // Voice Aura (ระบบแยกไฟล์ — ปิดได้ที่ voiceAura/config.js)

// ── Firebase Config ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBlruTPdcfWPMgJkQufyhtZnPsT_mbDvKs",
  authDomain: "warmly-app-9e8d6.firebaseapp.com",
  projectId: "warmly-app-9e8d6",
  storageBucket: "warmly-app-9e8d6.firebasestorage.app",
  messagingSenderId: "340884704147",
  appId: "1:340884704147:web:86ab4e1a8aceab0daeb666"
};

// ── Cloudinary (อัปโหลดวิดีโอฟรี ไม่ต้องผูกบัตร) ───────────
const CLOUDINARY={cloud:"ochjk9uo",preset:"warmly_video"};

function uploadVideo(file,onProgress){
  return new Promise((resolve,reject)=>{
    if(!CLOUDINARY.cloud||!CLOUDINARY.preset){reject(new Error("ยังไม่ได้ตั้งค่า Cloudinary"));return;}
    const fd=new FormData();
    fd.append("file",file);
    fd.append("upload_preset",CLOUDINARY.preset);
    const x=new XMLHttpRequest();
    x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUDINARY.cloud+"/video/upload");
    x.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(Math.round(e.loaded/e.total*100));};
    x.onload=()=>{
      let j={};try{j=JSON.parse(x.responseText);}catch(e){}
      if(x.status>=200&&x.status<300&&j.secure_url)resolve(j.secure_url);
      else reject(new Error((j.error&&j.error.message)||("อัปโหลดไม่สำเร็จ ("+x.status+")")));
    };
    x.onerror=()=>reject(new Error("เครือข่ายขัดข้อง"));
    x.send(fd);
  });
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// ── Design Tokens ────────────────────────────────────────
const T = {
  bg:"#0F0E17", surface:"#1A1825", card:"#221F33", border:"#2E2A45",
  borderHi:"#4F46A8", brand:"#7C5CFC", brand2:"#A78BFA",
  brandGrad:"linear-gradient(135deg,#7C5CFC,#A78BFA)",
  text:"#F0EEFF", sub:"#9B94C4", muted:"#5C5780",
  green:"#10B981", red:"#F43F5E", redBg:"rgba(244,63,94,.12)",
  yellow:"#F59E0B", glass:"rgba(34,31,51,.8)",
};

// ── Persistent local storage ──────────────────────────────
const ls = {
  get:(k,d)=>{try{const v=localStorage.getItem("wm_"+k);return v?JSON.parse(v):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem("wm_"+k,JSON.stringify(v));}catch{}},
  del:(k)=>{try{localStorage.removeItem("wm_"+k);}catch{}},
};

// ── ผู้ใช้ทั้งหมด (แชร์รูป/ชื่อให้ทุกคนเห็น) ─────────────
const UsersCtx=createContext({});
const ProfileCtx=createContext(null);

// ย่อรูปก่อนเก็บ (Firestore จำกัด 1MB ต่อเอกสาร)
function compressImage(file,max=160,q=0.72){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=reject;
    r.onload=ev=>{
      const img=new Image();
      img.onerror=reject;
      img.onload=()=>{
        const sc=Math.min(1,max/Math.max(img.width,img.height));
        const w=Math.max(1,Math.round(img.width*sc)),h=Math.max(1,Math.round(img.height*sc));
        const c=document.createElement("canvas");c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",q));
      };
      img.src=ev.target.result;
    };
    r.readAsDataURL(file);
  });
}

function saveMyProfile(patch){
  return setDoc(doc(db,"users",getUid()),{...patch,lastSeen:serverTimestamp()},{merge:true});
}

// ── ระบบเหรียญฟรี / ของขวัญ / ไอเทม (ขั้นที่ 1: ฟรีทั้งหมด) ────
// <WALLET-CORE>
const WELCOME_COINS=50;
const DAILY_COINS=20;
const GIFTS=[
  {id:"heart",emoji:"💜",name:"หัวใจ",price:3},
  {id:"rose",emoji:"🌹",name:"กุหลาบ",price:5},
  {id:"coffee",emoji:"☕",name:"กาแฟ",price:8},
  {id:"bear",emoji:"🧸",name:"หมีน้อย",price:10},
  {id:"cake",emoji:"🎂",name:"เค้ก",price:15},
  {id:"star",emoji:"🌟",name:"ดาว",price:20},
  {id:"rocket",emoji:"🚀",name:"จรวด",price:40},
  {id:"crown",emoji:"👑",name:"มงกุฎ",price:80},
  // ไอเทมพิเศษ 3 มิติ
  {id:"diamond",emoji:"💎",name:"เพชร 3D",price:120,model:"diamond"},
  {id:"crown3d",emoji:"👑",name:"มงกุฎทอง 3D",price:200,model:"crown"},
  // ของขวัญ 3 มิติตามเทศกาล (เปิดเฉพาะช่วงที่กำหนด — แก้วันที่ได้ทุกปี)
  {id:"pumpkin",emoji:"🎃",name:"ฟักทอง 3D",price:60,model:"pumpkin",event:{label:"ฮาโลวีน",from:"2026-10-20",to:"2026-11-02"}},
  {id:"krathong",emoji:"🪷",name:"กระทง 3D",price:60,model:"krathong",event:{label:"ลอยกระทง",from:"2026-11-15",to:"2026-11-28"}},
  {id:"firework",emoji:"🎆",name:"พลุปีใหม่ 3D",price:80,model:"firework",event:{label:"ปีใหม่",from:"2026-12-25",to:"2027-01-03"}},
  // ระดับสูง (เหรียญทองเยอะ) — เอฟเฟกต์ใหญ่เต็มห้อง
  {id:"supercar",emoji:"🏎️",name:"ซูเปอร์คาร์ 3D",price:300,model:"supercar"},
  {id:"castle",emoji:"🏰",name:"ปราสาท 3D",price:600,model:"castle"},
  {id:"galaxy",emoji:"🌌",name:"กาแล็กซี 3D",price:1000,model:"galaxy"},
];

// แอนิเมชันเฉพาะตัวของของขวัญแต่ละชิ้น (ไม่ใส่ = ใช้ค่าเริ่มต้น) — เพิ่มของขวัญใหม่แค่เพิ่มบรรทัดใน GIFTS และ (ถ้าอยากได้ท่าเฉพาะ) ที่นี่
// motion: rise | bounce | drop | spin | fly | zoom | drive    p: อีโมจิที่พุ่งกระจายรอบของขวัญ
const GIFT_FX={
  heart:{motion:"bounce",p:["💜","💖","💗"]},
  rose:{motion:"drop",p:["🌹","🌸"]},
  coffee:{motion:"rise",p:["💨","✨"]},
  bear:{motion:"bounce",p:["⭐","🧸"]},
  cake:{motion:"drop",p:["🎉","🕯️","✨"]},
  star:{motion:"spin",p:["⭐","✨","🌟"]},
  rocket:{motion:"fly",p:["🔥","💨","✨"]},
  crown:{motion:"drop",p:["✨","💛","👑"]},
  diamond:{motion:"spin",p:["💎","✨","💠"]},
  crown3d:{motion:"drop",p:["✨","👑","💛"]},
  pumpkin:{motion:"bounce",p:["🎃","🦇","👻"]},
  krathong:{motion:"rise",p:["🪷","✨","🕯️"]},
  firework:{motion:"rise",p:["🎆","🎇","✨"]},
  supercar:{motion:"zoom",p:["💨","🔥","✨"],tint:"#F43F5E"},
  castle:{motion:"zoom",p:["✨","👑","🏆"],tint:"#FBBF24"},
  galaxy:{motion:"spin",p:["⭐","🌟","💫","✨"],tint:"#7C5CFC"},
};

// ระดับของขวัญตามมูลค่าเหรียญทอง: ยิ่งแพง เอฟเฟกต์/เสียงยิ่งอลังการ (ใส่ tier ในของขวัญเองเพื่อกำหนดเองได้)
const TIER_META={
  1:{name:"ธรรมดา",color:"#94A3B8",dur:2400},
  2:{name:"หายาก",color:"#38BDF8",dur:2900},
  3:{name:"เอปิก",color:"#A78BFA",dur:3500},
  4:{name:"เลเจนดารี",color:"#FBBF24",dur:4400},
  5:{name:"มิธิก",color:"#F43F5E",dur:5600},
};
function giftTier(g){
  if(g.tier)return g.tier;
  const p=g.price||0;
  return p<10?1:p<40?2:p<100?3:p<300?4:5;
}
const TH_M=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtD(str){const [,m,d]=str.split("-").map(Number);return d+" "+TH_M[m-1];}
function giftAvailable(g){
  if(!g.event)return true;
  const t=todayBkk();
  return t>=g.event.from&&t<=g.event.to;
}
const GIFT_BY_ID=Object.fromEntries(GIFTS.map(g=>[g.id,g]));
const FRAMES={
  gold:{bg:"linear-gradient(135deg,#FDE68A,#F59E0B,#B45309)",glow:"0 0 12px rgba(245,158,11,.6)"},
  neon:{bg:"linear-gradient(135deg,#22D3EE,#7C5CFC)",glow:"0 0 12px rgba(34,211,238,.6)"},
  rainbow:{bg:"linear-gradient(135deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7)",glow:"0 0 12px rgba(168,85,247,.5)"},
  heart:{bg:"linear-gradient(135deg,#F9A8D4,#EC4899)",glow:"0 0 12px rgba(236,72,153,.55)"},
  fire:{bg:"linear-gradient(135deg,#FDE047,#F97316,#DC2626)",glow:"0 0 14px rgba(249,115,22,.7)"},
  // พรีเมียม (เหรียญม่วง) — conic = สีไล่หมุนรอบรูป, pulse = เรืองแสงเต้น, crown/sparkle = ประดับ
  aurora:{bg:"linear-gradient(135deg,#22D3EE,#A78BFA)",glow:"0 0 14px rgba(167,139,250,.6)",conic:"#22D3EE,#7C5CFC,#F472B6,#22D3EE",speed:4,glowColor:"rgba(167,139,250,.7)"},
  galaxy:{bg:"linear-gradient(135deg,#312E81,#7C5CFC)",glow:"0 0 16px rgba(129,140,248,.7)",conic:"#312E81,#7C5CFC,#22D3EE,#F0ABFC,#312E81",speed:3,glowColor:"rgba(129,140,248,.85)",pulse:true,sparkle:true},
  royal:{bg:"linear-gradient(135deg,#FDE68A,#B45309)",glow:"0 0 16px rgba(251,191,36,.8)",conic:"#FDE68A,#F59E0B,#B45309,#FDE68A,#F59E0B,#FFF7D6,#FDE68A",speed:2.6,glowColor:"rgba(251,191,36,.85)",pulse:true,crown:true},
  legend:{bg:"linear-gradient(135deg,#f43f5e,#a855f7)",glow:"0 0 18px rgba(244,63,94,.8)",conic:"#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7,#f43f5e",speed:1.8,glowColor:"rgba(244,63,94,.85)",pulse:true,crown:true,sparkle:true},
};
const NAME_COLORS={
  gold:{color:"#FBBF24"},
  pink:{color:"#F472B6"},
  cyan:{color:"#22D3EE"},
  rainbow:{background:"linear-gradient(90deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent"},
  // พรีเมียม (เหรียญม่วง) — ไล่สีเคลื่อนไหว / เรืองแสง (keyframes อยู่ใน FX_CSS)
  shimmer:{background:"linear-gradient(90deg,#C4B5FD,#FFFFFF,#C4B5FD)",backgroundSize:"200% 100%",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent",animation:"wmShimmer 2.4s linear infinite"},
  neonpulse:{color:"#67E8F9",animation:"wmNeon 1.6s ease-in-out infinite"},
  auroratext:{background:"linear-gradient(90deg,#22D3EE,#A78BFA,#F472B6,#22D3EE)",backgroundSize:"200% 100%",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent",animation:"wmShimmer 3s linear infinite",filter:"drop-shadow(0 0 5px rgba(167,139,250,.85))"},
  royalgold:{background:"linear-gradient(90deg,#FDE68A,#F59E0B,#FFF7D6,#F59E0B,#FDE68A)",backgroundSize:"200% 100%",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent",animation:"wmShimmer 2s linear infinite",filter:"drop-shadow(0 0 6px rgba(251,191,36,.9))"},
};
// ป้ายพรีเมียม (แยกจาก BADGES เดิมที่เป็นอีโมจิล้วน) — tier สูง = ดีไซน์หรูขึ้น
const PREMIUM_BADGES={
  vip:{label:"VIP",emoji:"💜",tier:2,bg:"linear-gradient(135deg,#7C5CFC,#A78BFA)",glow:"0 0 6px rgba(124,92,252,.6)"},
  elite:{label:"ELITE",emoji:"💠",tier:3,bg:"linear-gradient(135deg,#0EA5E9,#7C5CFC)",glow:"0 0 8px rgba(14,165,233,.7)"},
  royal:{label:"ROYAL",emoji:"👑",tier:4,bg:"linear-gradient(135deg,#B45309,#FBBF24,#B45309)",glow:"0 0 10px rgba(251,191,36,.8)",shine:true},
  legend:{label:"LEGEND",emoji:"🌌",tier:5,bg:"linear-gradient(90deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7,#f43f5e)",glow:"0 0 12px rgba(168,85,247,.9)",shine:true,anim:true},
};
const BADGES={star:"🌟",dj:"🎧",crown:"👑",fire:"🔥"};
const ENTRANCES={
  sparkle:{emoji:"✨",text:"เข้าห้องมาแล้ว",bg:"linear-gradient(90deg,#7C5CFC,#EC4899)"},
  rainbow:{emoji:"🌈",text:"มาพร้อมสายรุ้ง",bg:"linear-gradient(90deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7)"},
  royal:{emoji:"👑",text:"เสด็จเข้าห้อง",bg:"linear-gradient(90deg,#B45309,#FBBF24,#B45309)"},
  // พรีเมียม (เหรียญม่วง) — มี tier = ใช้ EntranceFx (ภาพเต็มห้อง + เสียง) / dur = ความยาว (มิลลิวินาที)
  mist:{emoji:"🔮",text:"ปรากฏตัวท่ามกลางหมอกม่วง",bg:"linear-gradient(90deg,#4C1D95,#7C5CFC,#4C1D95)",tier:2,dur:3800,fx:"mist"},
  thunder:{emoji:"⚡",text:"สายฟ้าฟาด! มาถึงแล้ว",bg:"linear-gradient(90deg,#1E3A8A,#38BDF8,#1E3A8A)",tier:3,dur:4400,fx:"thunder"},
  dragon:{emoji:"🐉",text:"มังกรไฟนำทางเข้าห้อง",bg:"linear-gradient(90deg,#7F1D1D,#F97316,#7F1D1D)",tier:4,dur:5200,fx:"dragon"},
  emperor:{emoji:"👑",text:"จักรพรรดิเสด็จเข้าห้อง",bg:"linear-gradient(90deg,#78350F,#FBBF24,#FFF7D6,#FBBF24,#78350F)",tier:5,dur:6500,fx:"emperor"},
};
const ITEMS=[
  {id:"frame:gold",type:"frame",key:"gold",name:"กรอบทอง",price:60},
  {id:"frame:neon",type:"frame",key:"neon",name:"กรอบนีออน",price:60},
  {id:"frame:heart",type:"frame",key:"heart",name:"กรอบชมพูหวาน",price:40},
  {id:"frame:rainbow",type:"frame",key:"rainbow",name:"กรอบรุ้ง",price:100},
  {id:"frame:fire",type:"frame",key:"fire",name:"กรอบเปลวไฟ",special:"ล็อกอินครบ 7 วันติดกัน"},
  {id:"nameColor:pink",type:"nameColor",key:"pink",name:"ชื่อสีชมพู",price:30},
  {id:"nameColor:cyan",type:"nameColor",key:"cyan",name:"ชื่อสีฟ้า",price:30},
  {id:"nameColor:gold",type:"nameColor",key:"gold",name:"ชื่อสีทอง",price:40},
  {id:"nameColor:rainbow",type:"nameColor",key:"rainbow",name:"ชื่อสีรุ้ง",price:80},
  {id:"badge:star",type:"badge",key:"star",name:"ป้ายดาว 🌟",price:30},
  {id:"badge:dj",type:"badge",key:"dj",name:"ป้าย DJ 🎧",price:40},
  {id:"badge:crown",type:"badge",key:"crown",name:"ป้ายมงกุฎ 👑",price:120},
  {id:"badge:fire",type:"badge",key:"fire",name:"ป้ายไฟ 🔥",special:"ล็อกอินครบ 7 วันติดกัน"},
  {id:"entrance:sparkle",type:"entrance",key:"sparkle",name:"ประกายดาว ✨",price:50},
  {id:"entrance:rainbow",type:"entrance",key:"rainbow",name:"สายรุ้ง 🌈",price:90},
  {id:"entrance:royal",type:"entrance",key:"royal",name:"ราชาเข้าห้อง 👑",price:150},
];

// ไอเทมพรีเมียม ซื้อด้วยเหรียญม่วง (price = จำนวนเหรียญม่วง) — เพิ่มไอเทมใหม่ = เพิ่มบรรทัดที่นี่ + นิยามหน้าตาใน FRAMES/NAME_COLORS/PREMIUM_BADGES/ENTRANCES
const PURPLE_ITEMS=[
  {id:"frame:aurora",type:"frame",key:"aurora",name:"กรอบออโรร่า",price:1,tier:2},
  {id:"frame:galaxy",type:"frame",key:"galaxy",name:"กรอบกาแล็กซี",price:3,tier:3},
  {id:"frame:royal",type:"frame",key:"royal",name:"กรอบราชันย์ทอง",price:6,tier:4},
  {id:"frame:legend",type:"frame",key:"legend",name:"กรอบตำนานสายรุ้ง",price:12,tier:5},
  {id:"nameColor:shimmer",type:"nameColor",key:"shimmer",name:"ชื่อประกายเงิน",price:1,tier:2},
  {id:"nameColor:neonpulse",type:"nameColor",key:"neonpulse",name:"ชื่อนีออนเรืองแสง",price:2,tier:3},
  {id:"nameColor:auroratext",type:"nameColor",key:"auroratext",name:"ชื่อออโรร่าไหลเวียน",price:5,tier:4},
  {id:"nameColor:royalgold",type:"nameColor",key:"royalgold",name:"ชื่อทองคำเรืองรอง",price:10,tier:5},
  {id:"badge:vip",type:"badge",key:"vip",name:"ป้าย VIP",price:1,tier:2},
  {id:"badge:elite",type:"badge",key:"elite",name:"ป้าย ELITE",price:3,tier:3},
  {id:"badge:royal",type:"badge",key:"royal",name:"ป้าย ROYAL",price:6,tier:4},
  {id:"badge:legend",type:"badge",key:"legend",name:"ป้าย LEGEND",price:12,tier:5},
  {id:"entrance:mist",type:"entrance",key:"mist",name:"หมอกม่วงลึกลับ",price:2,tier:2},
  {id:"entrance:thunder",type:"entrance",key:"thunder",name:"สายฟ้าฟาด",price:4,tier:3},
  {id:"entrance:dragon",type:"entrance",key:"dragon",name:"มังกรไฟ",price:8,tier:4},
  {id:"entrance:emperor",type:"entrance",key:"emperor",name:"จักรพรรดิ",price:15,tier:5},
].map(i=>({currency:"purple",...i}));

function todayBkk(offsetDays=0){
  return new Date(Date.now()+7*3600*1000+offsetDays*86400000).toISOString().slice(0,10);
}

// เหรียญต้อนรับ (ครั้งแรก)
async function ensureWallet(){
  const ref=doc(db,"users",getUid());
  let granted=false;
  await runTransaction(db,async tx=>{
    granted=false;
    const sn=await tx.get(ref);
    if(!sn.exists()||sn.data().coins===undefined){
      tx.set(ref,{coins:WELCOME_COINS,inventory:[],giftCount:0},{merge:true});
      granted=true;
    }
  });
  return granted;
}

// รับเหรียญรายวัน (นับตามเวลาไทย) + ล็อกอินครบ 7 วันติดกันได้ไอเทมพิเศษ
async function claimDaily(){
  const ref=doc(db,"users",getUid());
  return runTransaction(db,async tx=>{
    const sn=await tx.get(ref);
    const d=sn.exists()?sn.data():{};
    const today=todayBkk(),yest=todayBkk(-1);
    if(d.lastDaily===today)throw new Error("วันนี้รับไปแล้ว");
    const streak=d.lastDaily===yest?(d.streak||0)+1:1;
    const bonus=DAILY_COINS+(streak%7===0?50:0);
    const patch={coins:(d.coins||0)+bonus,lastDaily:today,streak};
    const inv=Array.isArray(d.inventory)?d.inventory:[];
    let unlocked=false;
    if(streak>=7&&!inv.includes("badge:fire")){patch.inventory=[...inv,"badge:fire","frame:fire"];unlocked=true;}
    tx.set(ref,patch,{merge:true});
    return{bonus,streak,unlocked};
  });
}

async function buyItem(item){
  const ref=doc(db,"users",getUid());
  await runTransaction(db,async tx=>{
    const sn=await tx.get(ref);
    const d=sn.exists()?sn.data():{};
    const inv=Array.isArray(d.inventory)?d.inventory:[];
    if(inv.includes(item.id))throw new Error("มีไอเทมนี้แล้ว");
    if((d.coins||0)<item.price)throw new Error("เหรียญไม่พอ");
    tx.set(ref,{coins:(d.coins||0)-item.price,inventory:[...inv,item.id]},{merge:true});
  });
}

function equipItem(item,on){
  return setDoc(doc(db,"users",getUid()),{[item.type]:on?item.key:null},{merge:true});
}

// ส่งของขวัญในแชทส่วนตัว (หักเหรียญผู้ส่ง + เพิ่มจำนวนของขวัญผู้รับ + ขึ้นข้อความในแชท)
async function sendGift(gift,fromUser,toUid,toName,ctx){
  const myUid=getUid();
  if(toUid===myUid)throw new Error("ส่งให้ตัวเองไม่ได้");
  if(!giftAvailable(gift))throw new Error("ของขวัญนี้ยังไม่ถึงช่วงเทศกาล");
  const meRef=doc(db,"users",myUid),toRef=doc(db,"users",toUid);
  await runTransaction(db,async tx=>{
    const sn=await tx.get(meRef);
    const coins=(sn.exists()&&sn.data().coins)||0;
    if(coins<gift.price)throw new Error("เหรียญไม่พอ");
    tx.set(meRef,{coins:coins-gift.price,giftsSent:increment(1)},{merge:true});
    tx.set(toRef,{giftCount:increment(1),giftValue:increment(gift.price)},{merge:true});
  });
  const msg={
    uid:myUid,author:fromUser.name,init:fromUser.init,gift:gift.id,
    text:"ส่ง "+gift.emoji+" "+gift.name+" ให้ "+toName,t:serverTimestamp()
  };
  if(ctx&&ctx.type==="room"){
    await addDoc(collection(db,"voiceRooms",ctx.roomId,"chat"),msg);
    return;
  }
  if(ctx&&ctx.type==="group"){
    await addDoc(collection(db,"groupChat"),msg);
    return;
  }
  const pid=[myUid,toUid].sort().join("_");
  await addDoc(collection(db,"dms",pid,"messages"),msg);
  await setDoc(doc(db,"dms",pid),{uids:[myUid,toUid].sort(),last:"🎁 "+gift.emoji+" "+gift.name,lastFrom:myUid,lastT:serverTimestamp()},{merge:true});
}

// ── เหรียญม่วง (Purple Coin) ──────────────────────────────────
// users/{uid}.purple       = เหรียญม่วงที่ได้จากการแลก/รางวัล (ฟรี)
// users/{uid}.purpleBought = เหรียญม่วงที่ซื้อด้วยเงินจริง (อนาคต — เขียนได้จากเซิร์ฟเวอร์เท่านั้น เก็บแยกเพื่อเงื่อนไขการใช้/คืนเงิน)
// ledger/{auto}            = ประวัติธุรกรรมแบบเพิ่มอย่างเดียว (ทุกการแลก/ซื้อ/รางวัลบันทึกพร้อมยอดคงเหลือ)
const PURPLE_RATE=500;          // เหรียญทอง 500 = เหรียญม่วง 1
const PURPLE_DAILY_LIMIT=5;     // เงื่อนไข: แลกได้สูงสุดวันละ 5 เหรียญม่วง/คน (นับตามเวลาไทย) และต้องเป็นบัญชี Google
const RECEIVE_REWARD_PER=1000;  // รางวัล: ได้รับของขวัญรวมทุก 1,000 เหรียญทอง = เหรียญม่วง 1 (ต่ำกว่าอัตราแลก กันปั๊มเหรียญ)

// ตัวคำนวณล้วน ๆ (ไม่แตะฐานข้อมูล ทดสอบง่าย) — คืน {patch, entry} หรือ throw ข้อความไทย
function planExchange(d,n,today){
  n=Math.floor(Number(n));
  if(!(n>=1))throw new Error("จำนวนไม่ถูกต้อง");
  if(d.isGuest)throw new Error("บัญชีผู้เยี่ยมชมแลกเหรียญม่วงไม่ได้ — ล็อกอินด้วย Google ก่อน");
  const done=d.purpleEx&&d.purpleEx.day===today?(d.purpleEx.n||0):0;
  if(done+n>PURPLE_DAILY_LIMIT)throw new Error("แลกได้สูงสุดวันละ "+PURPLE_DAILY_LIMIT+" เหรียญม่วง (วันนี้แลกแล้ว "+done+")");
  const cost=n*PURPLE_RATE,gold=d.coins||0;
  if(gold<cost)throw new Error("เหรียญทองไม่พอ (ต้องใช้ "+cost+")");
  const purple=(d.purple||0)+n;
  return{
    patch:{coins:gold-cost,purple,purpleEx:{day:today,n:done+n}},
    entry:{kind:"exchange",label:"แลกเหรียญทอง "+cost+" เป็นเหรียญม่วง "+n,gold:-cost,purple:n,purpleBought:0,after:{gold:gold-cost,purple,purpleBought:d.purpleBought||0}},
  };
}
// ใช้เหรียญม่วง "ที่ได้ฟรี" ก่อน แล้วค่อยใช้ที่ซื้อด้วยเงินจริง (เหรียญที่ซื้อจึงเหลือให้คืนเงินได้มากที่สุด) และจดว่าไอเทมชิ้นนี้จ่ายด้วยอะไร
function planBuyPremium(d,item){
  const inv=Array.isArray(d.inventory)?d.inventory:[];
  if(inv.includes(item.id))throw new Error("มีไอเทมนี้แล้ว");
  const earned=d.purple||0,bought=d.purpleBought||0;
  if(earned+bought<item.price)throw new Error("เหรียญม่วงไม่พอ (ต้องใช้ "+item.price+")");
  const fromE=Math.min(earned,item.price),fromB=item.price-fromE;
  const patch={purple:earned-fromE,inventory:[...inv,item.id],purpleSrc:{...(d.purpleSrc||{}),[item.id]:fromB===0?"earned":(fromE===0?"bought":"mixed")}};
  if(fromB>0)patch.purpleBought=bought-fromB;
  return{
    patch,
    entry:{kind:"buy_premium",label:"ซื้อ "+item.name,ref:item.id,gold:0,purple:-fromE,purpleBought:-fromB,after:{gold:d.coins||0,purple:earned-fromE,purpleBought:bought-fromB}},
  };
}
function planReceiveReward(d){
  const value=d.giftValue||0;
  const n=Math.floor(value/RECEIVE_REWARD_PER)-(d.purpleRecvClaimed||0);
  if(n<1)throw new Error("ยังไม่ถึงเกณฑ์ — ต้องได้รับของขวัญเพิ่มอีก "+(RECEIVE_REWARD_PER-(value%RECEIVE_REWARD_PER))+" เหรียญทอง");
  const purple=(d.purple||0)+n;
  return{
    patch:{purple,purpleRecvClaimed:Math.floor(value/RECEIVE_REWARD_PER)},
    entry:{kind:"reward",label:"รางวัลจากของขวัญที่ได้รับ",gold:0,purple:n,purpleBought:0,after:{gold:d.coins||0,purple,purpleBought:d.purpleBought||0}},
  };
}

// รันแผนใน transaction เดียว: อัปเดตยอด + เขียนประวัติพร้อมกัน (สำเร็จทั้งคู่หรือไม่สำเร็จเลย)
function walletTx(plan){
  const uid=getUid(),ref=doc(db,"users",uid);
  return runTransaction(db,async tx=>{
    const sn=await tx.get(ref);
    const p=plan(sn.exists()?sn.data():{});
    tx.set(ref,p.patch,{merge:true});
    tx.set(doc(collection(db,"ledger")),{uid,gold:0,purple:0,purpleBought:0,...p.entry,t:serverTimestamp()});
    return p.entry;
  });
}
const exchangeGoldToPurple=n=>walletTx(d=>planExchange(d,n,todayBkk()));
const buyPremium=item=>walletTx(d=>planBuyPremium(d,item));
const claimReceiveReward=()=>walletTx(planReceiveReward);

// ประวัติของเหรียญทอง: บันทึกหลังทำรายการสำเร็จ (ถ้าบันทึกประวัติพลาด จะไม่กระทบการใช้งานเดิม)
function logLedger(e){
  return addDoc(collection(db,"ledger"),{uid:getUid(),gold:0,purple:0,purpleBought:0,...e,t:serverTimestamp()}).catch(err=>console.warn("ledger",err));
}
async function claimDailyLogged(){
  const r=await claimDaily();
  logLedger({kind:"daily",label:"รับเหรียญรายวัน (ติดต่อกัน "+r.streak+" วัน)",gold:r.bonus});
  return r;
}
async function buyItemLogged(item){
  await buyItem(item);
  logLedger({kind:"buy_gold",label:"ซื้อ "+item.name,gold:-item.price,ref:item.id});
}
async function sendGiftLogged(gift,fromUser,toUid,toName,ctx){
  await sendGift(gift,fromUser,toUid,toName,ctx);
  logLedger({kind:"gift_sent",label:"ส่ง "+gift.emoji+" "+gift.name+" ให้ "+toName,gold:-gift.price,ref:gift.id});
}

// </WALLET-CORE>

// Voice Aura: ซื้อ/สวมใส่เอฟเฟกต์เสียง (ตรรกะอยู่ใน voiceAura/wallet.js — ใช้ transaction + ledger แบบเดียวกับกระเป๋าเดิม)
const auraWallet=makeAuraWallet({db,getUid,runTransaction,doc,collection,serverTimestamp,serverMode:AURA_SERVER_PURCHASE,getToken:()=>auth.currentUser?auth.currentUser.getIdToken():Promise.reject(new Error("ต้องล็อกอินด้วย Google ก่อน"))});
const auraApi={buy:id=>auraWallet.buyAura(id),equip:id=>auraWallet.equipAura(id)};

// ── Static Data ───────────────────────────────────────────
const FRIENDS=[
  {id:1,name:"หนูนก",init:"NK",bg:"#1A3A2A",tc:"#6EE7B7",online:true, mood:"เหงา 🌙"},
  {id:2,name:"อาร์ม", init:"AR",bg:"#1A2A3A",tc:"#93C5FD",online:true, mood:"สนุก 🎉"},
  {id:3,name:"มิ้นท์",init:"MT",bg:"#3A1A2A",tc:"#F9A8D4",online:false,mood:"ง่วง 😴"},
  {id:4,name:"ไบรท์",init:"BR",bg:"#2A2A1A",tc:"#FCD34D",online:true, mood:"สงบ ✨"},
  {id:5,name:"แพม",  init:"PM",bg:"#1A3A1A",tc:"#86EFAC",online:true, mood:"สบายดี 😊"},
];
const MOODS=["สบายดี 😊","เหงา 🌙","สนุก 🎉","เครียด 😮‍💨","ง่วง 😴","สงบ ✨","ตื่นเต้น ⚡","โดดเดี่ยว 🫥"];
const PV_LBL={public:"สาธารณะ",friends:"เพื่อนเท่านั้น",only_me:"ฉันเท่านั้น"};
const PV_ICO={public:"🌐",friends:"👥",only_me:"🔒"};
const AUTO_REPLIES=["อ่อ จริงๆ เหรอ 😊","รู้สึกแบบเดียวกันเลย 💜","ฮ่าๆ น่ารักมาก 🥰","แล้วยังไงต่อล่ะ?","ใช่เลย!","เดี๋ยวเล่าให้ฟังนะ 🎵"];

function getYTId(url){try{const u=new URL(url.trim());if(u.hostname.includes("youtu.be"))return u.pathname.slice(1).split(/[?&]/)[0];return u.searchParams.get("v")||"";}catch{return "";}}
function ytThumb(id){return`https://img.youtube.com/vi/${id}/mqdefault.jpg`;}
function ytEmbed(id){return`https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;}
function timeAgo(ts){if(!ts)return"เมื่อกี้";const s=Math.floor((Date.now()-ts.toMillis())/1000);if(s<60)return"เมื่อกี้";if(s<3600)return Math.floor(s/60)+" นาทีที่แล้ว";if(s<86400)return Math.floor(s/3600)+" ชม.";return Math.floor(s/86400)+" วันที่แล้ว";}

// ── Shared UI ─────────────────────────────────────────────
function Av({init,bg,tc,size=40,online,grad,isSelf,uid}){
  const _users=useContext(UsersCtx);
  const _u=uid?_users[uid]:null;
  // รูปของตัวเอง/คนอื่นดึงจากฐานข้อมูล (ทุกคนเห็นเหมือนกัน) สำรองจากเครื่องตัวเอง
  const selfImg = (_u&&(_u.avatar||_u.photo)) || (isSelf ? ls.get("avatarImg","") : "");
  const frame = _u&&_u.frame&&FRAMES[_u.frame];
  const core = selfImg
    ? <img src={selfImg} alt={init} referrerPolicy="no-referrer" style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:"2px solid "+(grad?T.brand:T.border)}}/>
    : <div style={{width:size,height:size,borderRadius:"50%",background:grad?T.brandGrad:(bg||T.card),color:grad?"#fff":(tc||T.brand2),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,boxShadow:grad?"0 0 16px rgba(124,92,252,.5)":"none"}}>{init}</div>;
  return(<div style={{position:"relative",flexShrink:0}}>
    {frame
      ? (frame.conic
          ? <AnimFrame frame={frame} size={size}>{core}</AnimFrame>
          : <div style={{padding:Math.max(2,Math.round(size*.07)),borderRadius:"50%",background:frame.bg,boxShadow:frame.glow,display:"inline-block",lineHeight:0}}>{core}</div>)
      : core}
    {online&&<div style={{position:"absolute",bottom:1,right:1,width:Math.max(8,size*.2),height:Math.max(8,size*.2),borderRadius:"50%",background:T.green,border:"2px solid "+T.bg}}/>}
  </div>);
}

// ชื่อผู้ใช้ (ใช้ชื่อล่าสุด + สีชื่อ + ป้ายที่ใส่ไว้)
function Nm({uid,name,own,style}){
  const users=useContext(UsersCtx);
  const u=uid?users[uid]:null;
  const nm=own?(name||(u&&u.name)):((u&&u.name)||name);
  const col=u&&u.nameColor&&NAME_COLORS[u.nameColor];
  const badge=u&&u.badge&&BADGES[u.badge];
  const pbadge=u&&u.badge&&PREMIUM_BADGES[u.badge];
  return <span style={style}><span style={col||undefined}>{nm||"ผู้ใช้"}</span>{badge&&<span style={{marginLeft:4}}>{badge}</span>}{pbadge&&<BadgePill b={pbadge}/>}</span>;
}

function Btn({children,onClick,v="primary",sz="md",full,style={}}){
  const variants={primary:{background:T.brandGrad,color:"#fff",border:"none",boxShadow:"0 4px 16px rgba(124,92,252,.35)"},ghost:{background:"transparent",color:T.sub,border:"1px solid "+T.border},outline:{background:"transparent",color:T.brand2,border:"1px solid "+T.borderHi},danger:{background:T.redBg,color:T.red,border:"1px solid rgba(244,63,94,.3)"}};
  const sizes={sm:{padding:"6px 14px",borderRadius:10,fontSize:12},md:{padding:"9px 20px",borderRadius:12,fontSize:14},lg:{padding:"13px 28px",borderRadius:14,fontSize:15}};
  return(<button onClick={onClick} style={{fontFamily:"inherit",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:full?"100%":undefined,transition:"all .18s",...variants[v],...sizes[sz],...style}}>{children}</button>);
}

function Card({children,style={}}){return(<div style={{background:T.card,border:"1px solid "+T.border,borderRadius:18,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.3)",...style}}>{children}</div>);}

function Input({value,onChange,placeholder,type="text",onKeyDown,style={}}){
  return(<input type={type} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown}
    style={{width:"100%",background:T.surface,border:"1px solid "+T.border,borderRadius:12,padding:"11px 16px",fontSize:14,outline:"none",color:T.text,boxSizing:"border-box",fontFamily:"inherit",...style}}
    onFocus={e=>e.target.style.borderColor=T.borderHi} onBlur={e=>e.target.style.borderColor=T.border}/>);
}

// วิดีโอในฟีด: เล่นเองแบบปิดเสียงเมื่อเลื่อนมาถึง หยุดเมื่อเลื่อนผ่าน (กดที่วิดีโอเพื่อเปิดเสียง/ควบคุม)
function FeedVideo({src}){
  const ref=useRef();
  useEffect(()=>{
    const v=ref.current;
    if(!v)return;
    v.muted=true;
    if(typeof IntersectionObserver==="undefined")return;
    const io=new IntersectionObserver(([en])=>{
      if(en.isIntersecting&&en.intersectionRatio>=0.6){
        const pr=v.play();
        if(pr&&pr.catch)pr.catch(()=>{});
      }else{
        v.pause();
      }
    },{threshold:[0,0.6,1]});
    io.observe(v);
    return()=>io.disconnect();
  },[src]);
  return <video ref={ref} src={src} controls muted loop playsInline preload="metadata" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",minHeight:130}}/>;
}

function ImgGrid({images,mediaTypes}){
  if(!images?.length)return null;
  const n=images.length;
  return(<div style={{display:"grid",gap:2,margin:"10px 0",borderRadius:14,overflow:"hidden",gridTemplateColumns:n===1?"1fr":"1fr 1fr",maxHeight:n===1?380:260}}>
    {images.slice(0,4).map((src,i)=>{
      const isVid=mediaTypes?.[i]==="video"||src?.startsWith("data:video");
      return(
        <div key={i} style={{overflow:"hidden",position:"relative",gridColumn:n===3&&i===0?"1/3":undefined,background:"#000",minHeight:130}}>
          {isVid
            ? <FeedVideo src={src}/>
            : <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",minHeight:130}} onError={e=>e.target.style.display="none"}/>
          }
          {i===3&&n>4&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:22,fontWeight:700}}>+{n-4}</div>}
        </div>
      );
    })}
  </div>);
}

// ── Auth ──────────────────────────────────────────────────
function AuthPage({onLogin}){
  const [mode,setMode]=useState("main");
  const [gName,setGName]=useState("");
  const [gErr,setGErr]=useState("");
  const [name,setName]=useState("");
  const [err,setErr]=useState("");

  const [busy,setBusy]=useState(false);
  const inApp=/Line\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)|WebView/i.test(navigator.userAgent||"");
  async function loginGoogle(){
    if(busy)return;
    setBusy(true);setGErr("");
    const provider=new GoogleAuthProvider();
    provider.setCustomParameters({prompt:"select_account"});
    try{
      await signInWithPopup(auth,provider);
      // onAuthStateChanged ใน App จะตั้งค่าผู้ใช้ให้เอง
    }catch(e){
      const c=(e&&e.code)||"";
      if(c==="auth/popup-blocked"||c==="auth/operation-not-supported-in-this-environment"){
        try{await signInWithRedirect(auth,provider);return;}
        catch(e2){setGErr("เข้า Google ไม่ได้: "+(e2.code||e2.message));}
      }else if(c==="auth/popup-closed-by-user"||c==="auth/cancelled-popup-request"){
        // ผู้ใช้ปิดหน้าต่างเอง
      }else if(c==="auth/unauthorized-domain"){
        setGErr("โดเมนนี้ยังไม่ได้อนุญาตใน Firebase (Authentication → Settings → Authorized domains)");
      }else if(c==="auth/operation-not-allowed"){
        setGErr("ยังไม่ได้เปิด Google Sign-in ใน Firebase Authentication");
      }else{
        setGErr("เข้า Google ไม่ได้: "+(c||(e&&e.message)));
      }
    }
    setBusy(false);
  }
  function loginGuest(){
    if(!name.trim()){setErr("ใส่ชื่อก่อนนะ");return;}
    const n=name.trim();
    const init=n.slice(0,2).toUpperCase();
    const u={name:n,email:"",avatar:"",isGuest:true,init,provider:"guest",uid:getUid()};
    ls.set("user",u);
    onLogin(u);
  }
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes mic-wave{0%{height:3px}100%{height:14px}}`}</style>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:72,height:72,borderRadius:22,background:T.brandGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 16px",boxShadow:"0 8px 32px rgba(124,92,252,.5)",animation:"float 3s ease-in-out infinite"}}>💜</div>
        <div style={{fontSize:36,fontWeight:800,color:T.text,letterSpacing:-1}}>Warmly</div>
        <div style={{fontSize:15,color:T.sub,marginTop:8,lineHeight:1.6}}>พื้นที่อบอุ่น สำหรับทุกคน<br/>หาเพื่อน คุยเล่น ไม่เหงา</div>
      </div>
      <div style={{width:"100%",maxWidth:360}}>
        {mode==="main"&&(<>
          {inApp&&(
            <div style={{background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.35)",borderRadius:14,padding:"12px 14px",marginBottom:14,fontSize:12,color:T.yellow,lineHeight:1.6}}>
              ⚠️ ดูเหมือนคุณเปิดผ่านแอปอื่น (เช่น LINE/Facebook) ซึ่งมักล็อกอิน Google ไม่ได้ (จอขาว)
              <br/>กดจุดสามจุด (⋮) แล้วเลือก <b>เปิดใน Chrome / Safari</b> หรือคัดลอกลิงก์ไปเปิดเอง
              <div style={{marginTop:8}}><Btn onClick={()=>{try{navigator.clipboard.writeText(window.location.origin);setGErr("คัดลอกลิงก์แล้ว — ไปวางในเบราว์เซอร์ Chrome/Safari");}catch(e){setGErr(window.location.origin);}}} v="outline" sz="sm">📋 คัดลอกลิงก์</Btn></div>
            </div>
          )}
          <button onClick={loginGoogle} disabled={busy}
            style={{width:"100%",padding:"14px 20px",borderRadius:16,border:"1px solid "+T.border,background:T.card,color:T.text,cursor:"pointer",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:16,fontFamily:"inherit"}}
            onMouseOver={e=>e.currentTarget.style.borderColor=T.borderHi}
            onMouseOut={e=>e.currentTarget.style.borderColor=T.border}>
            <span style={{fontSize:22}}>🔵</span> {busy?"กำลังเชื่อมต่อ Google...":"เข้าสู่ระบบด้วย Google"}
          </button>
          {gErr&&<div style={{fontSize:12,color:T.red,marginBottom:12,textAlign:"center",lineHeight:1.5}}>{gErr}</div>}
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}>
            <div style={{flex:1,height:1,background:T.border}}/><span style={{fontSize:12,color:T.muted}}>หรือ</span><div style={{flex:1,height:1,background:T.border}}/>
          </div>
          <div style={{background:T.surface,border:"1px solid "+T.border,borderRadius:16,padding:"20px 18px"}}>
            <div style={{fontSize:13,color:T.sub,marginBottom:12,textAlign:"center"}}>เข้าแบบผู้เยี่ยมชม 👋<br/>ไม่ต้องสมัคร</div>
            <Input value={name} onChange={e=>{setName(e.target.value);setErr("");}} placeholder="ชื่อที่ต้องการแสดง..." onKeyDown={e=>e.key==="Enter"&&loginGuest()} style={{marginBottom:10}}/>
            {err&&<div style={{fontSize:12,color:T.red,marginBottom:10,fontWeight:500}}>{err}</div>}
            <Btn onClick={loginGuest} v="outline" sz="md" full>เข้าแบบผู้เยี่ยมชม</Btn>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── YouTube Playlist ──────────────────────────────────────
// YoutubePlaylist — Sync เวลาเพลงด้วย startedAt timestamp
// Host กดเปิด → บันทึก nowPlaying + songStartedAt ใน Firebase
// คนใหม่เข้ามา → คำนวณว่าเพลงเล่นไปแล้วกี่วินาที → ข้ามไปตรงนั้นเลย
function YoutubePlaylist({playlist,nowPlaying,songStartedAt,onAdd,onRemove,onPlay,isHost}){
  const [url,setUrl]=useState("");
  const [title,setTitle]=useState("");
  const [err,setErr]=useState("");
  const [joined,setJoined]=useState(false);
  const [seekSrc,setSeekSrc]=useState(null);
  const safeList=Array.isArray(playlist)?playlist:[];
  const currentSong=safeList.find(s=>s.id===nowPlaying);

  // Reset joined state เมื่อเพลงเปลี่ยน
  useEffect(()=>{
    setJoined(false);
    setSeekSrc(null);
  },[nowPlaying]);

  // คำนวณ embed URL พร้อม start time (seconds ที่เพลงเล่นไปแล้ว)
  function getSeekUrl(songId){
    if(!songStartedAt)return `https://www.youtube.com/embed/${songId}?autoplay=1&rel=0&modestbranding=1`;
    const elapsed=Math.floor((Date.now()-songStartedAt)/1000);
    const start=Math.max(0,elapsed);
    return `https://www.youtube.com/embed/${songId}?autoplay=1&start=${start}&rel=0&modestbranding=1`;
  }

  function handleJoin(){
    // คนใหม่กดเข้าฟัง → สร้าง URL พร้อม start time ณ ขณะนั้น
    setSeekSrc(getSeekUrl(nowPlaying));
    setJoined(true);
  }

  function add(){
    try{
      const id=getYTId(url.trim());
      if(!id){setErr("ลิงก์ YouTube ไม่ถูกต้อง");return;}
      if(safeList.find(p=>p.id===id)){setErr("เพลงนี้อยู่ใน playlist แล้ว");return;}
      onAdd({id,title:title.trim()||"YouTube: "+id.slice(0,10)+"…",thumb:ytThumb(id)});
      setUrl("");setTitle("");setErr("");
    }catch{setErr("ลองใหม่อีกครั้ง");}
  }

  // คำนวณเวลาที่ผ่านไปแสดง
  function elapsed(){
    if(!songStartedAt)return"";
    const s=Math.floor((Date.now()-songStartedAt)/1000);
    const m=Math.floor(s/60);
    const sec=s%60;
    return `${m}:${String(sec).padStart(2,"0")}`;
  }

  return(
    <div style={{borderTop:"1px solid "+T.border,paddingTop:14,marginTop:14}}>
      <div style={{fontSize:13,fontWeight:700,color:T.brand2,marginBottom:12,display:"flex",alignItems:"center",gap:7}}>
        🎵 Playlist
        <span style={{fontSize:11,fontWeight:400,color:T.muted}}>({safeList.length})</span>
        {currentSong&&<span style={{fontSize:11,background:T.green+"33",color:T.green,borderRadius:20,padding:"2px 8px",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:T.green,display:"inline-block",animation:"pulse 1.5s infinite"}}/>LIVE
        </span>}
      </div>

      {/* Add song - Host only */}
      {isHost&&(
        <div style={{background:T.surface,border:"1px dashed "+T.border,borderRadius:14,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:8}}>➕ เพิ่มจาก YouTube URL</div>
          <Input value={url} onChange={e=>{setUrl(e.target.value);setErr("");}} placeholder="https://youtube.com/watch?v=..." style={{marginBottom:7}}/>
          <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="ชื่อเพลง (ไม่บังคับ)" onKeyDown={e=>e.key==="Enter"&&add()} style={{marginBottom:7}}/>
          {err&&<div style={{fontSize:12,color:T.red,marginBottom:7}}>{err}</div>}
          <Btn onClick={add} v="primary" sz="sm">เพิ่มเพลง</Btn>
        </div>
      )}

      {/* Now Playing */}
      {currentSong&&(
        <div style={{marginBottom:14,borderRadius:14,overflow:"hidden",border:"1px solid "+T.borderHi}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"linear-gradient(90deg,"+T.brand+"44,"+T.brand2+"22)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <img src={currentSong.thumb} alt="" style={{width:36,height:26,borderRadius:6,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.brand2,maxWidth:160,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentSong.title}</div>
                <div style={{fontSize:11,color:T.green,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:T.green,display:"inline-block",animation:"pulse 1.5s infinite"}}/>
                  {isHost?"คุณกำลังเปิดให้ทุกคน":"Host กำลังเปิด"}
                  {songStartedAt&&<span style={{color:T.muted,marginLeft:4}}>⏱ {elapsed()}</span>}
                </div>
              </div>
            </div>
            {isHost&&<button onClick={()=>onPlay(null)} style={{background:T.redBg,border:"1px solid rgba(244,63,94,.3)",color:T.red,cursor:"pointer",fontSize:12,padding:"4px 10px",borderRadius:8,fontFamily:"inherit",fontWeight:600}}>⏹ หยุด</button>}
          </div>

          {/* Player */}
          {isHost?(
            // Host เล่นตั้งแต่ต้น
            <iframe
              key={currentSong.id}
              src={`https://www.youtube.com/embed/${currentSong.id}?autoplay=1&rel=0&modestbranding=1`}
              width="100%" height="220" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{display:"block"}} title="YouTube player"/>
          ):joined&&seekSrc?(
            // คนอื่น — เล่น sync ณ เวลาที่กด (ข้ามไปตรงที่เพลงเล่นอยู่)
            <iframe
              key={seekSrc}
              src={seekSrc}
              width="100%" height="220" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{display:"block"}} title="YouTube player"/>
          ):(
            // คนใหม่ — แสดง banner พร้อมบอกว่าเพลงเล่นไปแล้วกี่นาที
            <div style={{padding:"24px 16px",textAlign:"center",background:T.surface}}>
              <div style={{fontSize:28,marginBottom:10}}>🎵</div>
              <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>กำลังเล่นเพลงในห้องนี้</div>
              <div style={{fontSize:12,color:T.sub,marginBottom:4}}>{currentSong.title}</div>
              {songStartedAt&&(
                <div style={{fontSize:12,color:T.muted,marginBottom:14,background:T.card,borderRadius:8,padding:"4px 10px",display:"inline-block"}}>
                  ⏱ เพลงเล่นไปแล้ว {elapsed()} — กดเพื่อ sync ไปตรงนั้น
                </div>
              )}
              <div style={{marginTop:4}}>
                <Btn onClick={handleJoin} v="primary" sz="md">▶ เข้าฟัง (sync เวลา)</Btn>
              </div>
              <div style={{fontSize:11,color:T.muted,marginTop:8}}>เพลงจะเริ่มตรงที่กำลังเล่นอยู่ทันที</div>
            </div>
          )}
        </div>
      )}

      {safeList.length===0&&(
        <div style={{textAlign:"center",padding:"16px 0",color:T.muted,fontSize:13}}>
          {isHost?"วาง YouTube URL ด้านบนเพื่อเพิ่มเพลง 🎵":"Host ยังไม่ได้เพิ่มเพลง"}
        </div>
      )}

      {/* Playlist items */}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {safeList.map((s,i)=>{
          const isPlaying=nowPlaying===s.id;
          return(
            <div key={s.id} style={{display:"flex",gap:10,alignItems:"center",padding:"9px 12px",borderRadius:12,
              background:isPlaying?T.brand+"22":T.surface,
              border:"1px solid "+(isPlaying?T.borderHi:T.border),transition:"all .18s"}}>
              <span style={{fontSize:13,fontWeight:700,color:isPlaying?T.brand2:T.muted,width:18,textAlign:"center",flexShrink:0}}>{isPlaying?"▶":i+1}</span>
              <img src={s.thumb} alt="" style={{width:48,height:34,borderRadius:8,objectFit:"cover",flexShrink:0,border:"1px solid "+T.border}} onError={e=>e.target.style.display="none"}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:isPlaying?T.brand2:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.title}</div>
                <div style={{fontSize:11,color:isPlaying?T.green:T.muted,marginTop:2}}>
                  {isPlaying?"🎵 กำลังเล่น — sync เวลา":(isHost?"กด ▶ เพื่อเปิดให้ทุกคน":"—")}
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {isHost&&<button onClick={()=>onPlay(isPlaying?null:s.id)} style={{border:"none",background:"transparent",color:isPlaying?T.red:T.brand2,cursor:"pointer",fontSize:16,fontFamily:"inherit"}}>{isPlaying?"⏹":"▶"}</button>}
                {isHost&&<button onClick={()=>onRemove(s.id)} style={{border:"none",background:"transparent",color:T.muted,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>✕</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// บรรทัดของขวัญในแชท: ระดับสูงเด่นขึ้น (พื้นไล่สี/กรอบ/ตัวหนา) ให้ทุกคนในห้องสังเกตเห็น
function GiftLine({m}){
  const g=GIFT_BY_ID[m.gift],tr=g?giftTier(g):1,c=TIER_META[tr].color;
  return(
    <div style={{textAlign:"center",fontSize:12,color:T.sub,padding:tr>=3?"6px 8px":"4px 0",borderRadius:12,background:tr>=3?"linear-gradient(90deg,transparent,"+c+"33,transparent)":undefined,border:tr>=4?"1px solid "+c+"66":undefined,fontWeight:tr>=3?700:400}}>
      <span style={{fontSize:tr>=3?26:20}}>{(g||{}).emoji||"🎁"}</span> <Nm uid={m.uid} name={m.author}/> {m.text}
    </div>
  );
}
// ── Room Chat (text chat ในห้องเสียง) ────────────────────
function RoomChat({roomId,user,onGift}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const endRef=useRef();

  useEffect(()=>{
    if(!roomId)return;
    const q=query(collection(db,"voiceRooms",roomId,"chat"),orderBy("t","asc"));
    let first=true;
    const unsub=onSnapshot(q,
      snap=>{
        if(!first&&onGift){
          snap.docChanges().forEach(ch=>{
            if(ch.type==="added"){const d=ch.doc.data();if(d.gift)onGift(d.gift,d);}
          });
        }
        first=false;
        setMsgs(snap.docs.map(d=>({id:d.id,...d.data()})));
      },
      err=>console.error("chat snapshot error:",err)
    );
    return unsub;
  },[roomId]);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  async function send(){
    const txt=input.trim();
    if(!txt||!roomId)return;
    // Optimistic update — แสดงข้อความทันทีก่อน Firebase ตอบกลับ
    const tempMsg={id:"tmp-"+Date.now(),uid:getUid(),author:user.name,init:user.init,text:txt,t:{toMillis:()=>Date.now()}};
    setMsgs(prev=>[...prev,tempMsg]);
    setInput("");
    try{
      await addDoc(collection(db,"voiceRooms",roomId,"chat"),{
        uid:getUid(),
        author:user.name,
        init:user.init||user.name.slice(0,2).toUpperCase(),
        text:txt,
        t:serverTimestamp()
      });
    }catch(e){
      console.error("send chat error:",e);
      // ถ้า Firebase ส่งไม่ได้ ลบ temp message ออก
      setMsgs(prev=>prev.filter(m=>m.id!==tempMsg.id));
    }
  }

  return(
    <div style={{borderTop:"1px solid "+T.border,marginTop:12}}>
      <div style={{fontSize:12,fontWeight:700,color:T.sub,padding:"10px 0 8px",display:"flex",alignItems:"center",gap:6}}>
        💬 แชทในห้อง <span style={{fontSize:11,fontWeight:400,color:T.muted}}>(สำหรับคนที่ไม่อยากพูดเสียง)</span>
      </div>
      <div style={{maxHeight:160,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
        {msgs.map(m=>m.gift?(
          <GiftLine key={m.id} m={m}/>
        ):(
          <div key={m.id} style={{display:"flex",gap:7,alignItems:"flex-start"}}>
            <Av uid={m.uid} init={(m.init||"??").slice(0,2)} bg={T.card} tc={T.brand2} size={24}/>
            <div>
              <span style={{fontSize:11,fontWeight:700,color:T.brand2,marginRight:5}}>{m.author}</span>
              <span style={{fontSize:13,color:T.text}}>{m.text}</span>
            </div>
          </div>
        ))}
        {msgs.length===0&&<div style={{fontSize:12,color:T.muted,textAlign:"center",padding:"10px 0"}}>ยังไม่มีข้อความ — พิมพ์คุยได้เลย</div>}
        <div ref={endRef}/>
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center"}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง)"
          style={{flex:1,background:T.surface,border:"1.5px solid "+T.border,borderRadius:20,padding:"8px 14px",fontSize:13,outline:"none",color:T.text,fontFamily:"inherit",transition:"border .15s"}}
          onFocus={e=>e.target.style.borderColor=T.borderHi}
          onBlur={e=>e.target.style.borderColor=T.border}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          style={{width:36,height:36,borderRadius:"50%",background:input.trim()?T.brandGrad:"#333",border:"none",color:"#fff",cursor:input.trim()?"pointer":"default",fontSize:16,fontFamily:"inherit",flexShrink:0,transition:"background .15s"}}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ── Device id (unique per browser) ───────────────────────
function getUid(){
  let id=ls.get("uid",null);
  if(!id||typeof id!=="string"){
    id=((window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now()+Math.random().toString(36).slice(2)).replace(/-/g,"").slice(0,16);
    ls.set("uid",id);
  }
  return id;
}

// ── LiveKit Voice Hook (imperative: connect ตอนกดปุ่ม เพื่อให้ผ่าน autoplay policy) ──
function useVoice(){
  const roomRef=useRef(null);
  const [connected,setConnected]=useState(false);
  const [speaking,setSpeaking]=useState({});
  const [mics,setMics]=useState({});
  const [micOn,setMicOn]=useState(false);
  const [needAudio,setNeedAudio]=useState(false);
  const [error,setError]=useState("");

  const refreshMics=useCallback(()=>{
    const room=roomRef.current; if(!room)return;
    const m={};
    m[room.localParticipant.identity]=room.localParticipant.isMicrophoneEnabled;
    room.remoteParticipants.forEach(p=>{m[p.identity]=p.isMicrophoneEnabled;});
    setMics(m);
    setMicOn(room.localParticipant.isMicrophoneEnabled);
  },[]);

  const disconnect=useCallback(()=>{
    const room=roomRef.current; roomRef.current=null;
    if(room){try{room.removeAllListeners();room.disconnect();}catch(e){}}
    document.querySelectorAll("audio[data-lk]").forEach(el=>{try{el.srcObject=null;}catch(e){} el.remove();});
    setConnected(false);setSpeaking({});setMics({});setMicOn(false);setNeedAudio(false);
  },[]);

  const connect=useCallback(async(roomId,identity,name)=>{
    disconnect();
    setError("");
    const room=new Room({
      adaptiveStream:true,dynacast:true,
      audioCaptureDefaults:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
    });
    roomRef.current=room;
    room.on(RoomEvent.ActiveSpeakersChanged,sp=>{const m={};sp.forEach(p=>{m[p.identity]=true;});setSpeaking(m);});
    room.on(RoomEvent.TrackSubscribed,track=>{
      if(track.kind===Track.Kind.Audio){
        const el=track.attach();
        el.setAttribute("data-lk","1");
        el.style.display="none";
        document.body.appendChild(el);
      }
      refreshMics();
    });
    room.on(RoomEvent.TrackUnsubscribed,track=>{track.detach().forEach(el=>el.remove());refreshMics();});
    room.on(RoomEvent.AudioPlaybackStatusChanged,()=>setNeedAudio(!room.canPlaybackAudio));
    [RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,
     RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished,RoomEvent.TrackPublished].forEach(ev=>room.on(ev,refreshMics));
    room.on(RoomEvent.Disconnected,()=>{if(roomRef.current===room){setConnected(false);setMicOn(false);setSpeaking({});}});

    try{
      const url=`/api/token?room=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(name)}`;
      const r=await fetch(url);
      let data={};try{data=await r.json();}catch(e){}
      if(!r.ok||!data.token||!data.url)throw new Error(data.error||("token "+r.status));
      await room.connect(data.url,data.token);
      if(roomRef.current!==room){room.disconnect();return;}
      setConnected(true);
      try{await room.startAudio();}catch(e){}
      setNeedAudio(!room.canPlaybackAudio);
      try{
        await room.localParticipant.setMicrophoneEnabled(true);
      }catch(e){
        console.error("mic error",e);
        setError("เปิดไมค์ไม่ได้ — กดอนุญาตไมค์ในเบราว์เซอร์ แล้วกดปุ่มไมค์อีกครั้ง");
      }
      refreshMics();
    }catch(e){
      console.error("voice connect error",e);
      if(roomRef.current===room)setError("เชื่อมต่อเสียงไม่สำเร็จ: "+(e&&e.message?e.message:e));
    }
  },[disconnect,refreshMics]);

  const setMic=useCallback(async(on)=>{
    const room=roomRef.current; if(!room)return;
    try{
      await room.localParticipant.setMicrophoneEnabled(on);
      setError("");
    }catch(e){
      console.error("toggleMic",e);
      setError("เปิดไมค์ไม่ได้ — อนุญาตไมค์ในเบราว์เซอร์ก่อน");
    }
    refreshMics();
  },[refreshMics]);

  const toggleMic=useCallback(()=>{
    const room=roomRef.current; if(!room)return;
    return setMic(!room.localParticipant.isMicrophoneEnabled);
  },[setMic]);

  const enableAudio=useCallback(async()=>{
    const room=roomRef.current; if(!room)return;
    try{await room.startAudio();}catch(e){}
    setNeedAudio(!room.canPlaybackAudio);
  },[]);

  useEffect(()=>()=>disconnect(),[disconnect]);

  return{connected,micOn,speaking,mics,needAudio,error,connect,disconnect,toggleMic,setMic,enableAudio};
}

// ── Error Boundary (class จริง จับ error ตอน render ได้) ────────
class VoiceErrorBoundary extends Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:String(e&&e.message?e.message:e)};}
  componentDidCatch(e){console.error("VoiceRooms crashed:",e);}
  render(){
    if(this.state.err)return(
      <div style={{padding:24,textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:8}}>⚠️</div>
        <div style={{color:T.red,fontWeight:700,marginBottom:8}}>ห้องเสียงเจอปัญหา</div>
        <div style={{color:T.muted,fontSize:13,marginBottom:16}}>{this.state.err}</div>
        <Btn onClick={()=>this.setState({err:null})} v="primary" sz="sm">ลองใหม่</Btn>
      </div>
    );
    return this.props.children;
  }
}


// ── Voice Rooms (Firebase + LiveKit) ─────────────────────
function VoiceRoomsPage({user}){
  const [rooms,setRooms]=useState([]);
  const [inRoomId,setInRoomId]=useState(null);
  const [inRoomName,setInRoomName]=useState("");
  const [showPL,setShowPL]=useState(false);
  const [newName,setNewName]=useState("");
  const [creating,setCreating]=useState(false);
  const [nameErr,setNameErr]=useState("");
  const [giftTo,setGiftTo]=useState(null);
  const [roomFx,pushRoomGift]=useGiftStage();
  const [soundOn,setSoundOn]=useState(sfx.isOn());
  useEffect(()=>{if(inRoomId)sfx.preload();},[inRoomId]); // eslint-disable-line
  const [loading,setLoading]=useState(true);

  const myUid=getUid();
  const _users=useContext(UsersCtx);
  const [entryFx,setEntryFx]=useState(null);
  const prevKeysRef=useRef(null);
  const seenRef=useRef(false);
  const voice=useVoice();
  const {connected,micOn,speaking,mics,needAudio,error:voiceError,toggleMic,enableAudio}=voice;
  const [auraMode]=useAuraMode();
  const [auraOpen,setAuraOpen]=useState(false);

  const inRoom=rooms.find(r=>r.id===inRoomId);
  const memberList=inRoom&&Array.isArray(inRoom.members)?inRoom.members:[];
  const isMeM=m=>m.uid?m.uid===myUid:m.init===user.init;
  const me=memberList.find(isMeM);
  const isHost=!!inRoom&&(inRoom.hostUid?inRoom.hostUid===myUid:inRoom.hostInit===user.init);

  // เอฟเฟกต์ตอนมีคนเข้าห้อง (ถ้าเขาใส่ไอเทม "เข้าห้อง" ไว้)
  const memberKeys=memberList.map(m=>m.uid||m.init).join(",");
  useEffect(()=>{
    if(!inRoomId){prevKeysRef.current=null;return;}
    const keys=memberList.map(m=>m.uid||m.init);
    if(prevKeysRef.current===null){prevKeysRef.current=keys;return;}
    memberList.forEach(m=>{
      const k=m.uid||m.init;
      if(prevKeysRef.current.includes(k))return;
      const u=m.uid?_users[m.uid]:null;
      const e=u&&u.entrance&&ENTRANCES[u.entrance];
      if(isMeM(m)&&!(e&&e.tier))return; // เอฟเฟกต์พรีเมียมให้เจ้าตัวเห็นด้วย (ของฟรีเดิมยังข้ามตัวเองเหมือนเดิม)
      if(e){
        const id=Date.now()+Math.random();
        setEntryFx({id,name:m.name,e});
        if(e.tier)sfx.entrance(e.fx,(e.dur||4000)/1000);
        setTimeout(()=>setEntryFx(f=>(f&&f.id===id?null:f)),e.dur||3300);
      }
    });
    prevKeysRef.current=keys;
  },[inRoomId,memberKeys]); // eslint-disable-line

  // ถูกเตะ / ห้องถูกปิด → ออกจากห้องฝั่งเรา
  useEffect(()=>{
    if(!inRoomId||loading)return;
    if(me){seenRef.current=true;return;}
    if(seenRef.current){
      seenRef.current=false;
      if(inRoom&&Array.isArray(inRoom.kicked)&&inRoom.kicked.includes(myUid))alert("คุณถูกเจ้าของห้องเตะออกจากห้อง");
      voice.disconnect();setInRoomId(null);setShowPL(false);
    }
  },[inRoomId,loading,rooms]); // eslint-disable-line

  // โฮสต์ปิดไมค์เรา → ปิดไมค์จริง
  useEffect(()=>{
    if(connected&&me&&me.mic===false&&micOn)voice.setMic(false);
  },[connected,me&&me.mic,micOn]); // eslint-disable-line

  // มีเพลงเริ่มเล่น → เปิดแผงเพลงให้ทุกคนเห็นอัตโนมัติ (รวม Guest)
  const nowPlayingId=inRoom?inRoom.nowPlaying:null;
  useEffect(()=>{ if(nowPlayingId)setShowPL(true); },[nowPlayingId]);

  function onMicClick(){
    if(me&&me.mic===false&&!micOn){alert("โฮสต์ปิดไมค์ของคุณอยู่");return;}
    toggleMic();
  }

  useEffect(()=>{
    const q=query(collection(db,"voiceRooms"),orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>{
      setRooms(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return unsub;
  },[]);

  async function join(r){
    if(Array.isArray(r.kicked)&&r.kicked.includes(myUid)){
      alert("คุณถูกเจ้าของห้องเตะออก เข้าห้องนี้ไม่ได้");
      return;
    }
    // เชื่อมต่อเสียงทันทีในจังหวะที่กดปุ่ม (ต้องมี user gesture ถึงจะได้ยินเสียงและขอไมค์ได้)
    seenRef.current=false;
    setInRoomId(r.id);setInRoomName(r.name);setShowPL(true);
    voice.connect(r.id,myUid,user.name);
    const members=Array.isArray(r.members)?r.members:[];
    if(!members.find(m=>m.uid===myUid)){
      try{
        await updateDoc(doc(db,"voiceRooms",r.id),{
          members:[...members.filter(m=>m.uid||m.init!==user.init),{uid:myUid,init:user.init,name:user.name,mic:true}]
        });
      }catch(e){console.error(e);}
    }
  }

  async function leave(){
    if(!inRoom)return;
    const rid=inRoomId;
    const members=memberList.filter(m=>!isMeM(m));
    voice.disconnect();
    seenRef.current=false;
    setInRoomId(null);setInRoomName("");setShowPL(false);
    try{
      if(members.length===0){await deleteDoc(doc(db,"voiceRooms",rid));}
      else{await updateDoc(doc(db,"voiceRooms",rid),{members});}
    }catch(e){console.error(e);}
  }

  async function hostToggleMic(key){
    if(!isHost)return;
    const members=memberList.map(m=>(m.uid||m.init)===key?{...m,mic:m.mic===false}:m);
    await updateDoc(doc(db,"voiceRooms",inRoomId),{members});
  }

  async function kick(key){
    if(!isHost||key===myUid)return;
    const target=memberList.find(m=>(m.uid||m.init)===key);
    if(!window.confirm("เตะ "+((target&&target.name)||"คนนี้")+" ออกจากห้อง? (เข้าห้องนี้ใหม่ไม่ได้)"))return;
    const members=memberList.filter(m=>(m.uid||m.init)!==key);
    try{
      await updateDoc(doc(db,"voiceRooms",inRoomId),{members,kicked:arrayUnion(key)});
    }catch(e){console.error(e);alert("เตะไม่สำเร็จ: "+(e.code||e.message));}
  }

  async function create(){
    if(!newName.trim()){setNameErr("ใส่ชื่อห้องก่อนนะ");return;}
    const nm=newName.trim();
    seenRef.current=false;
    try{
      const r=await addDoc(collection(db,"voiceRooms"),{
        name:nm,vibe:"🎵",hostInit:user.init,hostUid:myUid,hostName:user.name,
        members:[{uid:myUid,init:user.init,name:user.name,mic:true}],
        playlist:[],nowPlaying:null,songStartedAt:null,
        createdAt:serverTimestamp()
      });
      setInRoomId(r.id);setInRoomName(nm);setShowPL(true);
      voice.connect(r.id,myUid,user.name);
    }catch(e){console.error(e);setNameErr("สร้างห้องไม่สำเร็จ: "+(e.message||e));return;}
    setNewName("");setCreating(false);setNameErr("");
  }

  async function addSong(song){
    if(!inRoom)return;
    const playlist=[...(Array.isArray(inRoom.playlist)?inRoom.playlist:[]),song];
    await updateDoc(doc(db,"voiceRooms",inRoomId),{playlist});
  }

  async function removeSong(songId){
    if(!inRoom)return;
    const playlist=(Array.isArray(inRoom.playlist)?inRoom.playlist:[]).filter(s=>s.id!==songId);
    const nowPlaying=inRoom.nowPlaying===songId?null:inRoom.nowPlaying;
    const songStartedAt=inRoom.nowPlaying===songId?null:inRoom.songStartedAt;
    await updateDoc(doc(db,"voiceRooms",inRoomId),{playlist,nowPlaying,songStartedAt});
  }

  async function playSong(songId,startedAtMs){
    if(!inRoom||!isHost)return;
    // ใช้ Date.now() เป็น ms timestamp จริงๆ เพื่อ sync เพลงได้แม่นยำ
    const now = songId ? (startedAtMs||Date.now()) : null;
    await updateDoc(doc(db,"voiceRooms",inRoomId),{
      nowPlaying:songId||null,
      songStartedAt:now,
    });
  }


  return(
    <div>
      {auraOpen&&VOICE_AURA_ENABLED&&!user.isGuest&&<AuraShop me={_users[myUid]||{}} user={user} onClose={()=>setAuraOpen(false)} api={auraApi}/>}
      {inRoom&&(
        <Card style={{marginBottom:16,border:"1px solid "+T.borderHi,position:"relative"}}>
          <GiftFx fx={roomFx}/>
          {entryFx&&entryFx.e.tier&&<EntranceFx fx={entryFx}/>}
          {entryFx&&!entryFx.e.tier&&(
            <div key={entryFx.id} style={{position:"absolute",top:10,left:0,right:0,display:"flex",justifyContent:"center",zIndex:21,pointerEvents:"none"}}>
              <div style={{animation:"entryslide 3.2s ease-out forwards",background:entryFx.e.bg,color:"#fff",padding:"8px 18px",borderRadius:22,fontWeight:800,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,.45)",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{entryFx.e.emoji}</span>{entryFx.name} {entryFx.e.text}<span style={{fontSize:20}}>{entryFx.e.emoji}</span>
              </div>
            </div>
          )}
          {giftTo&&<GiftPicker user={user} to={giftTo} ctx={{type:"room",roomId:inRoomId}} onClose={()=>setGiftTo(null)}/>}
          <div style={{background:"linear-gradient(135deg,"+T.card+","+T.surface+")",padding:"16px 16px 0"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,gap:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:connected?T.green:T.yellow,boxShadow:"0 0 8px "+(connected?T.green:T.yellow)}}/>
                  {inRoom.vibe} {inRoom.name}
                </div>
                <div style={{fontSize:12,color:T.muted,marginTop:3}}>
                  {connected?(micOn?"🎙️ เชื่อมต่อแล้ว • ไมค์เปิด":"🔇 เชื่อมต่อแล้ว • ไมค์ปิด"):"⏳ กำลังเชื่อมต่อ..."}
                  {" • "}{(inRoom.members||[]).length} คน
                </div>
                {voiceError&&<div style={{fontSize:11,color:T.red,marginTop:3}}>⚠️ {voiceError}</div>}
                {isHost&&(inRoom.members||[]).length>1&&<div style={{fontSize:11,color:T.brand2,marginTop:3}}>👑 คุณเป็นเจ้าของห้อง — กด 🚫 ที่มุมรูปสมาชิกเพื่อเตะออก</div>}
                {!user.isGuest&&(inRoom.members||[]).length>1&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>🎁 แตะรูปสมาชิกเพื่อส่งของขวัญ</div>}
                {needAudio&&<div onClick={enableAudio} style={{fontSize:12,color:T.yellow,marginTop:4,cursor:"pointer",fontWeight:700}}>🔊 แตะที่นี่เพื่อเปิดเสียงห้อง</div>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <Btn onClick={()=>{const v=!soundOn;sfx.set(v);setSoundOn(v);}} v="ghost" sz="sm">{soundOn?"🔔":"🔕"}</Btn>
                {VOICE_AURA_ENABLED&&!user.isGuest&&<Btn onClick={()=>setAuraOpen(true)} v="ghost" sz="sm">✨</Btn>}
                <Btn onClick={()=>setShowPL(!showPL)} v={showPL?"primary":"ghost"} sz="sm">🎵 Playlist</Btn>
                <Btn onClick={onMicClick} v={micOn?"primary":"danger"} sz="sm">{micOn?"🎙️ เปิด":"🔇 ปิด"}</Btn>
                <Btn onClick={leave} v="danger" sz="sm">📵</Btn>
              </div>
            </div>

            {/* Members */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",paddingBottom:16}}>
              {memberList.map((m,i)=>{
                const isMe=isMeM(m);
                const key=m.uid||m.init;
                const isSpeaking=!!speaking[isMe?myUid:key];
                const lkMic=mics[isMe?myUid:key];
                const showMicOn=isMe?micOn:(lkMic===undefined?m.mic!==false:(lkMic&&m.mic!==false));
                const auraId=resolveAura(m.uid?_users[m.uid]:null,auraMode); // เอฟเฟกต์เสียงที่สมาชิกคนนี้สวมใส่ (null = วงเขียวเดิม)
                const avatarBtn=(
                    <div onClick={()=>{if(!isMe&&!user.isGuest&&m.uid)setGiftTo({uid:m.uid,name:m.name});}} style={{cursor:(!isMe&&!user.isGuest&&m.uid)?"pointer":"default",padding:3,borderRadius:"50%",
                      border:"2.5px solid "+(isSpeaking&&!auraId?T.green:T.border),
                      boxShadow:isSpeaking&&!auraId?"0 0 16px rgba(16,185,129,.5)":"none",
                      transition:"all .2s"}}>
                      <Av uid={m.uid} init={m.init} bg={T.card} tc={T.brand2} grad={isMe} isSelf={isMe} size={48}/>
                    </div>
                );
                return(
                  <div key={key+i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,position:"relative"}}>
                    {isHost&&!isMe&&(
                      <div style={{position:"absolute",top:-10,right:-12,display:"flex",gap:3,zIndex:2}}>
                        <button onClick={()=>hostToggleMic(key)} style={{width:26,height:26,borderRadius:"50%",background:m.mic!==false?"#1A3A2A":"#2A2A1A",border:"1px solid "+T.border,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>{m.mic!==false?"🎙":"🔇"}</button>
                        <button onClick={()=>kick(key)} style={{width:26,height:26,borderRadius:"50%",background:T.redBg,border:"1px solid rgba(244,63,94,.5)",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",color:T.red,fontFamily:"inherit"}}>🚫</button>
                      </div>
                    )}
                    {auraId
                      ?<VoiceAura aura={auraId} active={isSpeaking&&showMicOn} lite={memberList.length>AURA_LITE_ROOM_SIZE}>{avatarBtn}</VoiceAura>
                      :avatarBtn}
                    <div style={{fontSize:11,color:T.brand2,fontWeight:700,maxWidth:56,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",position:"relative",zIndex:1}}>{isMe?"คุณ":m.name}</div>
                    {/* ไมค์ animation เมื่อพูด */}
                    {isSpeaking?(
                      <div style={{display:"flex",alignItems:"flex-end",gap:1.5,height:14}}>
                        {[3,6,9,6,3].map((h,j)=>(
                          <div key={j} style={{width:2.5,borderRadius:2,background:T.green,
                            animation:`mic-wave ${0.4+j*0.08}s ease-in-out infinite alternate`,
                            animationDelay:`${j*60}ms`}}/>
                        ))}
                      </div>
                    ):(
                      <span style={{fontSize:11,color:T.muted}}>{showMicOn?"🎙️":"🔇"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {showPL&&<div style={{padding:"0 16px 16px"}}><YoutubePlaylist playlist={inRoom.playlist} nowPlaying={inRoom.nowPlaying||null} songStartedAt={inRoom.songStartedAt||null} onAdd={addSong} onRemove={removeSong} onPlay={playSong} isHost={isHost}/></div>}
          <div style={{padding:"0 16px 16px",borderTop:"1px solid "+T.border}}><RoomChat roomId={inRoomId} user={user} onGift={(gid,d)=>pushRoomGift(gid,d)}/></div>
        </Card>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:800,color:T.text}}>ห้องเสียง 🎙️</div>
        <div style={{display:"flex",gap:6}}>
          {VOICE_AURA_ENABLED&&!user.isGuest&&<Btn onClick={()=>setAuraOpen(true)} v="ghost" sz="sm">✨ Voice Aura</Btn>}
          {!user.isGuest&&<Btn onClick={()=>setCreating(!creating)} v={creating?"primary":"outline"} sz="sm">+ ห้องใหม่</Btn>}
        </div>
      </div>

      {creating&&(
        <Card style={{marginBottom:14}}>
          <div style={{padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>🏠 สร้างห้องใหม่</div>
            <Input value={newName} onChange={e=>{setNewName(e.target.value);setNameErr("");}} placeholder="ชื่อห้อง เช่น คืนนี้ใครว่างบ้าง 🌙" onKeyDown={e=>e.key==="Enter"&&create()} style={{marginBottom:8}}/>
            {nameErr&&<div style={{fontSize:12,color:T.red,marginBottom:8}}>{nameErr}</div>}
            <div style={{display:"flex",gap:7}}>
              <Btn onClick={create} v="primary" sz="sm">สร้างห้อง ✨</Btn>
              <Btn onClick={()=>{setCreating(false);setNameErr("");}} v="ghost" sz="sm">ยกเลิก</Btn>
            </div>
          </div>
        </Card>
      )}

      {loading&&<div style={{textAlign:"center",padding:"24px 0",color:T.muted,fontSize:13}}>⏳ กำลังโหลด...</div>}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {rooms.map(r=>(
          <Card key={r.id} style={{border:"1px solid "+(inRoomId===r.id?T.borderHi:T.border)}}>
            <div style={{padding:"16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:T.text}}>{r.vibe||"🎵"} {r.name}</div>
                  <div style={{fontSize:12,color:T.muted,display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:T.green}}/>{(r.members||[]).length} คน
                    {(r.playlist||[]).length>0&&<span>• 🎵 {r.playlist.length}</span>}
                  </div>
                </div>
                {inRoomId===r.id?<Btn onClick={leave} v="danger" sz="sm">ออก</Btn>:<Btn onClick={()=>join(r)} v="primary" sz="sm">เข้าร่วม</Btn>}
              </div>
              <div style={{display:"flex"}}>
                {(r.members||[]).slice(0,7).map((m,i)=>(
                  <div key={i} style={{width:28,height:28,borderRadius:"50%",background:T.card,color:T.brand2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,border:"2px solid "+T.bg,marginLeft:i>0?-8:0}}>{m.init}</div>
                ))}
              </div>
            </div>
          </Card>
        ))}
        {!loading&&rooms.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:T.muted,fontSize:13}}>ยังไม่มีห้องเสียง — เปิดห้องใหม่ได้เลย!</div>}
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────
function PostCard({p,user}){
  const users=useContext(UsersCtx);
  const openProfile=useContext(ProfileCtx);
  const myUid=getUid();
  const [open,setOpen]=useState(false);
  const [cmt,setCmt]=useState("");
  const [err,setErr]=useState("");
  const [liked,setLiked]=useState(false);
  const [likeCount,setLikeCount]=useState(p.likes||0);
  const [comments,setComments]=useState(Array.isArray(p.comments)?p.comments:[]);
  const isOwner=!user.isGuest&&(p.authorUid?p.authorUid===myUid:p.author===user.name);

  async function handleLike(){
    if(user.isGuest)return;
    const next=!liked;
    setLiked(next);
    setLikeCount(c=>next?c+1:c-1);
    await updateDoc(doc(db,"posts",p.id),{likes:increment(next?1:-1)});
  }

  async function handleDelete(){
    if(!window.confirm("ลบโพสต์นี้?"))return;
    await deleteDoc(doc(db,"posts",p.id));
  }

  async function submitComment(){
    if(!cmt.trim()){setErr("เม้นอะไรก่อนนะ");return;}
    const newCmt={id:"c"+Date.now(),uid:myUid,author:user.name,init:user.init,text:cmt.trim(),time:"เมื่อกี้"};
    const updated=[...comments,newCmt];
    setComments(updated);
    await updateDoc(doc(db,"posts",p.id),{comments:updated});
    setCmt("");setErr("");
  }

  return(
    <Card style={{marginBottom:12}}>
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <div onClick={()=>openProfile&&openProfile(p.authorUid)} style={{cursor:p.authorUid?"pointer":"default"}}><Av uid={p.authorUid} init={p.authorInit||p.author?.slice(0,2)||"??"} bg={T.card} tc={T.brand2} size={42}/></div>
          <div style={{flex:1}}>
            <div onClick={()=>openProfile&&openProfile(p.authorUid)} style={{fontSize:14,fontWeight:700,color:T.text,cursor:p.authorUid?"pointer":"default"}}><Nm uid={p.authorUid} name={p.author}/></div>
            <div style={{fontSize:12,color:T.muted,display:"flex",flexWrap:"wrap",gap:6,marginTop:3}}>
              <span>{p.createdAt?timeAgo(p.createdAt):"เมื่อกี้"}</span><span>·</span>
              <span style={{background:T.surface,borderRadius:20,padding:"1px 8px",border:"1px solid "+T.border}}>{PV_ICO[p.privacy||"public"]} {PV_LBL[p.privacy||"public"]}</span>
              {p.mood&&<span style={{background:T.brand+"22",borderRadius:20,padding:"1px 8px",color:T.brand2,fontWeight:600,fontSize:12}}>✦ {p.mood}</span>}
            </div>
          </div>
        </div>
        {p.content&&<div style={{fontSize:15,color:T.text,lineHeight:1.75,marginBottom:4}}>{p.content}</div>}
      </div>
      <ImgGrid images={p.images} mediaTypes={p.mediaTypes}/>
      <div style={{padding:"0 16px 14px"}}>
        <div style={{borderTop:"1px solid "+T.border,paddingTop:10,display:"flex",gap:7}}>
          <Btn onClick={handleLike} v={liked?"primary":"ghost"} sz="sm">{liked?"❤️":"🤍"} {likeCount}</Btn>
          <Btn onClick={()=>setOpen(!open)} v={open?"outline":"ghost"} sz="sm">💬 {comments.length}</Btn>
          {isOwner&&<Btn onClick={handleDelete} v="danger" sz="sm">🗑️ ลบ</Btn>}
        </div>
        {open&&(
          <div style={{marginTop:12}}>
            {comments.map(c=>(
              <div key={c.id} style={{display:"flex",gap:9,marginBottom:10}}>
                <Av uid={c.uid} init={c.init||"??"} bg={T.card} tc={T.brand2} size={30}/>
                <div style={{background:T.surface,borderRadius:14,padding:"8px 13px",flex:1,border:"1px solid "+T.border}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.text}}>{(c.uid&&users[c.uid]&&users[c.uid].name)||c.author} <span style={{fontWeight:400,color:T.muted,fontSize:11}}>{c.time}</span></div>
                  <div style={{fontSize:13,color:T.sub,marginTop:3,lineHeight:1.5}}>{c.text}</div>
                </div>
              </div>
            ))}
            <div style={{display:"flex",gap:9,alignItems:"center",marginTop:6}}>
              <Av uid={myUid} init={user.init} grad size={30}/>
              <input value={cmt} onChange={e=>{setCmt(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submitComment()} placeholder="เม้นอะไรสักอย่าง..."
                style={{flex:1,border:"1px solid "+T.border,borderRadius:20,padding:"8px 14px",fontSize:13,outline:"none",background:T.surface,color:T.text,fontFamily:"inherit"}}
                onFocus={e=>e.target.style.borderColor=T.borderHi} onBlur={e=>e.target.style.borderColor=T.border}/>
              <Btn onClick={submitComment} v="primary" sz="sm">ส่ง</Btn>
            </div>
            {err&&<div style={{fontSize:12,color:T.red,marginTop:6,marginLeft:39}}>{err}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── New Post ──────────────────────────────────────────────
function NewPostBox({user}){
  if(user.isGuest) return(
    <Card style={{marginBottom:14}}>
      <div style={{padding:"20px 16px",textAlign:"center"}}>
        <div style={{fontSize:20,marginBottom:8}}>🔒</div>
        <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:4}}>ต้องเข้าสู่ระบบด้วย Google</div>
        <div style={{fontSize:13,color:T.muted}}>ผู้เยี่ยมชมไม่สามารถโพสต์ได้</div>
      </div>
    </Card>
  );
  const [text,setText]=useState("");
  const [mood,setMood]=useState("");
  const [privacy,setPrivacy]=useState("public");
  const [images,setImages]=useState([]);
  const [err,setErr]=useState("");
  const [showM,setShowM]=useState(false);
  const [posting,setPosting]=useState(false);
  const [progress,setProgress]=useState(0);
  const fileRef=useRef();

  function handleFiles(e){
    Array.from(e.target.files).forEach(f=>{
      if(f.type.startsWith("video/")){
        if(f.size>100*1024*1024){setErr("วิดีโอใหญ่เกิน 100MB");return;}
        const url=URL.createObjectURL(f);
        const vid=document.createElement("video");
        vid.preload="metadata";
        vid.onloadedmetadata=()=>{
          if(vid.duration>30){URL.revokeObjectURL(url);setErr("วิดีโอต้องไม่เกิน 30 วินาที (ของคุณ: "+Math.round(vid.duration)+"วิ)");return;}
          setImages(p=>[...p,{src:url,file:f,name:f.name,isVideo:true,duration:Math.round(vid.duration)}]);
        };
        vid.onerror=()=>setErr("อ่านวิดีโอนี้ไม่ได้ ลองไฟล์อื่น (MP4)");
        vid.src=url;
      } else {
        compressImage(f,1000,0.7)
          .then(src=>setImages(p=>[...p,{src,name:f.name,isVideo:false}]))
          .catch(()=>setErr("อ่านรูปไม่ได้ ลองรูปอื่น"));
      }
    });
    e.target.value="";
  }

  async function submit(){
    if(!text.trim()&&!images.length){setErr("เขียนหรือเพิ่มรูปก่อนนะ");return;}
    setPosting(true);setErr("");setProgress(0);
    // อัปโหลดวิดีโอขึ้น Cloudinary ก่อน แล้วเก็บแค่ลิงก์ในโพสต์
    const urls=[];
    try{
      for(const i of images){
        if(i.isVideo&&i.file)urls.push(await uploadVideo(i.file,setProgress));
        else urls.push(i.src);
      }
    }catch(e){
      setErr("อัปโหลดวิดีโอไม่สำเร็จ: "+(e&&e.message?e.message:e));
      setPosting(false);setProgress(0);
      return;
    }
    try{
      const postName = user.name;
      const postInit = postName.slice(0,2).toUpperCase();
      await addDoc(collection(db,"posts"),{
        author:postName, authorInit:postInit,
        authorUid:getUid(),
        content:text.trim(), mood, privacy,
        images:urls,
        mediaTypes:images.map(i=>i.isVideo?"video":"image"),
        likes:0, liked:false, comments:[],
        createdAt:serverTimestamp()
      });
      setText("");setMood("");setImages([]);setErr("");setShowM(false);
    }catch(e){setErr("โพสต์ไม่สำเร็จ ลองใหม่");}
    setPosting(false);
  }

  return(
    <Card style={{marginBottom:14}}>
      <div style={{padding:"16px"}}>
        <div style={{display:"flex",gap:12}}>
          <Av uid={getUid()} init={user.init} grad isSelf size={42}/>
          <textarea value={text} onChange={e=>{setText(e.target.value);setErr("");}} placeholder="คุณรู้สึกยังไงวันนี้? 💜"
            style={{flex:1,border:"1px solid "+T.border,borderRadius:14,padding:"10px 14px",fontSize:14,resize:"none",outline:"none",minHeight:72,lineHeight:1.6,background:T.surface,color:T.text,fontFamily:"inherit",transition:"border .15s"}}
            onFocus={e=>e.target.style.borderColor=T.borderHi} onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        {images.length>0&&(
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10,marginLeft:54}}>
            {images.map((img,i)=>(
              <div key={i} style={{position:"relative",width:72,height:72,borderRadius:12,overflow:"hidden",border:"1px solid "+T.border}}>
                {img.isVideo
                  ? <video src={img.src} style={{width:"100%",height:"100%",objectFit:"cover"}} muted/>
                  : <img src={img.src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                }
                {img.isVideo&&<div style={{position:"absolute",bottom:2,left:2,background:"rgba(0,0,0,.7)",color:"#fff",fontSize:9,padding:"1px 4px",borderRadius:4}}>{img.duration}วิ 🎬</div>}
                <button onClick={()=>setImages(imgs=>imgs.filter((_,j)=>j!==i))} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.7)",border:"none",color:"#fff",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
              </div>
            ))}
          </div>
        )}
        {err&&<div style={{fontSize:12,color:T.red,marginTop:7,marginLeft:54,fontWeight:500}}>{err}</div>}
        <div style={{display:"flex",alignItems:"center",gap:7,marginTop:12,marginLeft:54,flexWrap:"wrap"}}>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}} onChange={handleFiles}/>
          <Btn onClick={()=>fileRef.current.click()} v="ghost" sz="sm">📷{images.length>0?` (${images.length})`:""}</Btn>
          <Btn onClick={()=>setShowM(!showM)} v={mood?"outline":"ghost"} sz="sm">✦ {mood||"Mood"}</Btn>
          <select value={privacy} onChange={e=>setPrivacy(e.target.value)} style={{padding:"7px 10px",borderRadius:10,border:"1px solid "+T.border,background:T.surface,color:T.sub,fontSize:12,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
            <option value="public">🌐 สาธารณะ</option>
            <option value="friends">👥 เพื่อนเท่านั้น</option>
            <option value="only_me">🔒 ฉันเท่านั้น</option>
          </select>
          <Btn onClick={submit} v="primary" sz="sm" style={{marginLeft:"auto"}} disabled={posting}>{posting?(progress>0&&progress<100?"อัปโหลด "+progress+"%":"กำลังโพสต์..."):"โพสต์"}</Btn>
        </div>
        {showM&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10,marginLeft:54}}>{MOODS.map(m=><Btn key={m} onClick={()=>{setMood(m);setShowM(false);}} v={mood===m?"outline":"ghost"} sz="sm">{m}</Btn>)}</div>}
      </div>
    </Card>
  );
}

// ── Feed (Firebase realtime) ──────────────────────────────
function FeedPage({user}){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const q=query(collection(db,"posts"),orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>{
      setPosts(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return unsub;
  },[]);

  return(
    <div>
      <NewPostBox user={user}/>
      {loading&&<div style={{textAlign:"center",padding:"24px 0",color:T.muted,fontSize:13}}>⏳ กำลังโหลด...</div>}
      {!loading&&posts.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:T.muted,fontSize:14}}>ยังไม่มีโพสต์ — โพสต์แรกได้เลย! ✨</div>}
      {posts.map(p=><PostCard key={p.id} p={p} user={user}/>)}
    </div>
  );
}

// ── Chat (local) ──────────────────────────────────────────
function fmtTime(ms){
  if(!ms)return"";
  try{return new Date(ms).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"});}catch(e){return"";}
}

// ── แชทแบบฟองข้อความ (ใช้ทั้งห้องรวมและแชทส่วนตัว) ────────
function BubbleChat({path,user,showNames,placeholder="พิมพ์ข้อความ...",onSent,giftTo,avatarGift}){
  const users=useContext(UsersCtx);
  const myUid=getUid();
  const pathKey=path.join("/");
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [img,setImg]=useState(null);
  const [err,setErr]=useState("");
  const [giftOpen,setGiftOpen]=useState(false);
  const [pickTarget,setPickTarget]=useState(null);
  const [fx,setFx]=useState(null);
  const fileRef=useRef();const endRef=useRef();

  useEffect(()=>{
    setMsgs([]);setErr("");
    let first=true;
    const q=query(collection(db,...path),orderBy("t","desc"),limit(150));
    return onSnapshot(q,snap=>{
      if(!first){
        snap.docChanges().forEach(ch=>{
          if(ch.type==="added"){
            const d=ch.doc.data();
            if(d.gift)triggerGiftFx(d.gift,setFx,d);
          }
        });
      }
      first=false;
      setMsgs(snap.docs.map(d=>({id:d.id,...d.data({serverTimestamps:"estimate"})})).reverse());
    },e=>{console.error("chat",e);setErr("โหลดแชทไม่ได้ ("+(e.code||e.message)+") — ตรวจ Firestore rules");});
  },[pathKey]); // eslint-disable-line

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  async function send(){
    const txt=input.trim();
    if(!txt&&!img)return;
    const payload={uid:myUid,author:user.name,init:user.init,t:serverTimestamp()};
    if(txt)payload.text=txt;
    if(img)payload.image=img;
    const keepImg=img;
    setInput("");setImg(null);setErr("");
    try{
      await addDoc(collection(db,...path),payload);
      onSent&&onSent(txt||"📷 รูปภาพ");
    }catch(e){
      console.error("send",e);
      setInput(txt);setImg(keepImg);
      setErr("ส่งไม่ได้ ("+(e.code||e.message)+")");
    }
  }

  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,position:"relative"}}>
      <GiftFx fx={fx}/>
      <div style={{flex:1,overflowY:"auto",padding:"12px 12px",display:"flex",flexDirection:"column",gap:6}}>
        {msgs.length===0&&!err&&<div style={{textAlign:"center",color:T.muted,fontSize:13,padding:"30px 0"}}>ยังไม่มีข้อความ — ทักทายกันได้เลย 👋</div>}
        {msgs.map((m,i)=>{
          if(m.gift){
            const g=GIFT_BY_ID[m.gift];
            return(<div key={m.id} style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:46,lineHeight:1.1,animation:"giftpop .6s ease-out"}}>{g?g.emoji:"🎁"}</div>
              <div style={{fontSize:12,color:T.sub,marginTop:2}}>🎁 <Nm uid={m.uid} name={m.author}/> {m.text}</div>
            </div>);
          }
          const me=m.uid===myUid;
          const prev=msgs[i-1];
          const head=!me&&showNames&&(!prev||prev.uid!==m.uid);
          const nm=(m.uid&&users[m.uid]&&users[m.uid].name)||m.author||"ผู้ใช้";
          const ms=m.t&&m.t.toMillis?m.t.toMillis():0;
          return(
            <div key={m.id} style={{display:"flex",gap:8,alignItems:"flex-end",flexDirection:me?"row-reverse":"row"}}>
              {!me&&<div onClick={()=>{if(avatarGift&&!user.isGuest&&m.uid)setPickTarget({uid:m.uid,name:nm});}} style={{cursor:avatarGift&&!user.isGuest?"pointer":"default"}}><Av uid={m.uid} init={(m.init||"??").slice(0,2)} bg={T.card} tc={T.brand2} size={28}/></div>}
              <div style={{maxWidth:"74%",display:"flex",flexDirection:"column",alignItems:me?"flex-end":"flex-start"}}>
                {head&&<div style={{fontSize:11,fontWeight:700,color:T.brand2,margin:"0 0 3px 4px"}}><Nm uid={m.uid} name={m.author}/></div>}
                {m.image&&<img src={m.image} alt="" style={{maxWidth:"100%",borderRadius:14,display:"block",border:"1px solid "+T.border,marginBottom:m.text?4:0}}/>}
                {m.text&&<div style={{padding:"8px 13px",borderRadius:16,fontSize:14,lineHeight:1.5,wordBreak:"break-word",whiteSpace:"pre-wrap",background:me?T.brandGrad:T.card,color:me?"#fff":T.text,border:me?"none":"1px solid "+T.border,borderBottomLeftRadius:!me?4:16,borderBottomRightRadius:me?4:16}}>{m.text}</div>}
                <div style={{fontSize:10,color:T.muted,margin:"2px 4px 0"}}>{fmtTime(ms)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      {err&&<div style={{fontSize:12,color:T.red,padding:"6px 14px",background:T.redBg}}>⚠️ {err}</div>}
      {img&&<div style={{padding:"8px 14px 0"}}><div style={{position:"relative",display:"inline-block"}}><img src={img} alt="" style={{height:60,borderRadius:10,objectFit:"cover",border:"1px solid "+T.border}}/><button onClick={()=>setImg(null)} style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#444",border:"none",color:"#fff",cursor:"pointer",fontSize:10}}>✕</button></div></div>}
      <div style={{padding:"10px 12px",borderTop:"1px solid "+T.border,background:T.surface,flexShrink:0}}>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];e.target.value="";if(!f)return;compressImage(f,900,0.6).then(setImg).catch(()=>setErr("อ่านรูปไม่ได้"));}}/>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>fileRef.current.click()} style={{width:36,height:36,borderRadius:"50%",border:"1px solid "+T.border,background:T.card,cursor:"pointer",fontSize:15,flexShrink:0,fontFamily:"inherit"}}>📷</button>
          {giftTo&&!user.isGuest&&<button onClick={()=>setGiftOpen(true)} style={{width:36,height:36,borderRadius:"50%",border:"1px solid "+T.borderHi,background:T.brand+"22",cursor:"pointer",fontSize:15,flexShrink:0,fontFamily:"inherit"}}>🎁</button>}
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={placeholder}
            style={{flex:1,minWidth:0,border:"1px solid "+T.border,borderRadius:20,padding:"9px 16px",fontSize:14,color:T.text,background:T.card,outline:"none",fontFamily:"inherit"}}
            onFocus={e=>e.target.style.borderColor=T.borderHi} onBlur={e=>e.target.style.borderColor=T.border}/>
          <button onClick={send} style={{width:38,height:38,borderRadius:"50%",background:T.brandGrad,border:"none",cursor:"pointer",color:"#fff",flexShrink:0,fontSize:17,fontFamily:"inherit"}}>↑</button>
        </div>
      </div>
      {giftOpen&&giftTo&&<GiftPicker user={user} to={giftTo} onClose={()=>setGiftOpen(false)}/>}
      {pickTarget&&<GiftPicker user={user} to={pickTarget} ctx={{type:"group"}} onClose={()=>setPickTarget(null)}/>}
    </div>
  );
}

// ── Chat: ห้องรวม + แชทส่วนตัว ────────────────────────────
function ChatPage({user,openPeer,onPeerOpened}){
  const users=useContext(UsersCtx);
  const myUid=getUid();
  const [tab,setTab]=useState("group");
  const [peer,setPeer]=useState(null);
  const [convs,setConvs]=useState([]);
  const [search,setSearch]=useState("");
  useEffect(()=>{ if(openPeer){setTab("dm");setPeer(openPeer);onPeerOpened&&onPeerOpened();} },[openPeer]); // eslint-disable-line

  useEffect(()=>{
    const q=query(collection(db,"dms"),where("uids","array-contains",myUid));
    return onSnapshot(q,snap=>setConvs(snap.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error("dms",e));
  },[myUid]);

  const pairId=uid=>[myUid,uid].sort().join("_");
  const people=Object.entries(users).filter(([id])=>id!==myUid).map(([id,u])=>({id,...u}))
    .filter(u=>!search.trim()||String(u.name||"").toLowerCase().includes(search.trim().toLowerCase()));
  const sortedConvs=[...convs].sort((a,b)=>((b.lastT&&b.lastT.toMillis?b.lastT.toMillis():0)-(a.lastT&&a.lastT.toMillis?a.lastT.toMillis():0)));
  const memberCount=Object.keys(users).length;

  function onDmSent(txt){
    if(!peer)return;
    setDoc(doc(db,"dms",pairId(peer)),{uids:[myUid,peer].sort(),last:txt.slice(0,80),lastFrom:myUid,lastT:serverTimestamp()},{merge:true}).catch(e=>console.error(e));
  }

  const tabBtn=(k,label)=>(
    <button key={k} onClick={()=>{setTab(k);}} style={{flex:1,padding:"11px 4px",border:"none",borderBottom:"2px solid "+(tab===k?T.brand:"transparent"),background:"transparent",color:tab===k?T.brand2:T.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
  );

  const pu=peer?(users[peer]||{}):{};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 112px)",overflow:"hidden"}}>
      <div style={{display:"flex",background:T.surface,borderBottom:"1px solid "+T.border,flexShrink:0}}>
        {tabBtn("group","💬 ห้องรวม")}
        {tabBtn("dm","🔒 ส่วนตัว")}
      </div>

      {tab==="group"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{padding:"8px 14px",fontSize:12,color:T.muted,background:T.surface,flexShrink:0,borderBottom:"1px solid "+T.border}}>
            🌐 ห้องแชทรวมของทุกคนใน Warmly • สมาชิก {memberCount} คน{!user.isGuest&&" • 🎁 แตะรูปคนอื่นเพื่อส่งของขวัญ"}
          </div>
          <BubbleChat path={["groupChat"]} user={user} showNames avatarGift placeholder="คุยกับทุกคน..."/>
        </div>
      )}

      {tab==="dm"&&!peer&&(
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.sub,marginBottom:8}}>บทสนทนาของฉัน</div>
          {sortedConvs.length===0&&<div style={{fontSize:13,color:T.muted,padding:"6px 0 14px"}}>ยังไม่มีแชทส่วนตัว — เลือกคนด้านล่างเพื่อเริ่มคุย</div>}
          {sortedConvs.map(c=>{
            const other=(c.uids||[]).find(x=>x!==myUid);
            if(!other)return null;
            const ou=users[other]||{};
            return(
              <div key={c.id} onClick={()=>setPeer(other)} style={{display:"flex",gap:11,alignItems:"center",padding:"10px 6px",borderBottom:"1px solid "+T.border,cursor:"pointer"}}>
                <Av uid={other} init={ou.init||"??"} bg={T.card} tc={T.brand2} size={42}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{ou.name||"ผู้ใช้"}</div>
                  <div style={{fontSize:12,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.lastFrom===myUid?"คุณ: ":""}{c.last||""}</div>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:13,fontWeight:700,color:T.sub,margin:"16px 0 8px"}}>เริ่มแชทกับ...</div>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ..." style={{marginBottom:8}}/>
          {people.length===0&&<div style={{fontSize:13,color:T.muted,padding:"10px 0"}}>ยังไม่มีผู้ใช้คนอื่น — ชวนเพื่อนเข้ามาได้เลย 💜</div>}
          {people.map(u=>(
            <div key={u.id} onClick={()=>setPeer(u.id)} style={{display:"flex",gap:11,alignItems:"center",padding:"9px 6px",borderBottom:"1px solid "+T.border,cursor:"pointer"}}>
              <Av uid={u.id} init={u.init||"??"} bg={T.card} tc={T.brand2} size={38}/>
              <div style={{flex:1,fontSize:14,fontWeight:600,color:T.text}}>{u.name||"ผู้ใช้"}{u.isGuest&&<span style={{fontSize:10,marginLeft:6,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"1px 7px",fontWeight:700}}>Guest</span>}</div>
              <span style={{fontSize:12,color:T.brand2}}>💬</span>
            </div>
          ))}
        </div>
      )}

      {tab==="dm"&&peer&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:10,background:T.surface,borderBottom:"1px solid "+T.border,flexShrink:0}}>
            <button onClick={()=>setPeer(null)} style={{border:"none",background:"transparent",color:T.sub,fontSize:20,cursor:"pointer",padding:"0 6px",fontFamily:"inherit"}}>‹</button>
            <Av uid={peer} init={pu.init||"??"} bg={T.card} tc={T.brand2} size={34}/>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{pu.name||"ผู้ใช้"}</div>
          </div>
          <BubbleChat path={["dms",pairId(peer),"messages"]} user={user} giftTo={{uid:peer,name:pu.name||"เพื่อน"}} placeholder={"ข้อความถึง "+(pu.name||"เพื่อน")+"..."} onSent={onDmSent}/>
        </div>
      )}
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────
function ProfilePage({user,posts,onUpdateName}){
  const [bio,setBio]=useState(()=>ls.get("bio","ชอบคุยเล่น • ฟังเพื่อนใหม่ 💜"));
  const [mood,setMood]=useState(()=>ls.get("mood","สบายดี 😊"));
  const [editing,setEditing]=useState(false);
  const [bioInput,setBioInput]=useState(bio);
  const [displayName,setDisplayName]=useState(user.name);
  const [editName,setEditName]=useState(false);
  const [nameInput,setNameInput]=useState(displayName);
  const saveName=()=>{
    const n=nameInput.trim();
    if(!n)return;
    setDisplayName(n);
    ls.set("displayName",n);
    // อัปเดต user object ใน localStorage ด้วย
    const saved=ls.get("user",{});
    ls.set("user",{...saved,name:n,init:n.slice(0,2).toUpperCase()});
    onUpdateName&&onUpdateName(n);
    setEditName(false);
  };
  const [showMP,setShowMP]=useState(false);
  const [coverImg,setCoverImg]=useState(()=>ls.get("coverImg",""));
  const [avatarImg,setAvatarImg]=useState(()=>ls.get("avatarImg",""));
  const coverRef=useRef();const avatarRef=useRef();
  const _allUsers=useContext(UsersCtx);
  // ซิงค์รูปปก/รูปโปรไฟล์ข้ามอุปกรณ์แบบเรียลไทม์
  useEffect(()=>{
    return onSnapshot(doc(db,"covers",getUid()),sn=>{
      if(sn.exists()){const c=sn.data().cover||"";setCoverImg(c);ls.set("coverImg",c);}
    },()=>{});
  },[]);
  const _myAv=_allUsers[getUid()]&&_allUsers[getUid()].avatar;
  useEffect(()=>{ if(_myAv){setAvatarImg(_myAv);ls.set("avatarImg",_myAv);} },[_myAv]);
  const myPosts=posts.filter(p=>p.authorUid?p.authorUid===getUid():(p.author===user.name||p.author===displayName));
  const saveBio=()=>{setBio(bioInput);ls.set("bio",bioInput);saveMyProfile({bio:bioInput}).catch(()=>{});setEditing(false);};
  const saveMood=m=>{setMood(m);ls.set("mood",m);saveMyProfile({mood:m}).catch(()=>{});setShowMP(false);};
  const saveCover=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;compressImage(f,900,0.6).then(src=>{setCoverImg(src);ls.set("coverImg",src);return setDoc(doc(db,"covers",getUid()),{cover:src,lastSeen:serverTimestamp()});}).catch(err=>{console.error("cover",err);alert("เปลี่ยนรูปปกไม่สำเร็จ: "+((err&&(err.code||err.message))||"ไฟล์รูปนี้ไม่รองรับ ลองรูป JPG/PNG"));});};
  const saveAvatar=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;compressImage(f,160,0.72).then(src=>{setAvatarImg(src);ls.set("avatarImg",src);return saveMyProfile({avatar:src});}).catch(err=>{console.error("avatar",err);alert("เปลี่ยนรูปโปรไฟล์ไม่สำเร็จ: "+((err&&(err.code||err.message))||"ไฟล์รูปนี้ไม่รองรับ ลองรูป JPG/PNG"));});};
  return(
    <div>
      <Card style={{marginBottom:14,overflow:"hidden"}}>
        <div style={{height:120,background:coverImg?`url(${coverImg}) center/cover`:T.brandGrad,position:"relative",cursor:"pointer"}} onClick={()=>coverRef.current.click()}>
          {!coverImg&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>✏️ เปลี่ยนรูปปก</div>}
          <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}} onChange={saveCover}/>
        </div>
        <div style={{padding:"0 18px 20px",position:"relative"}}>
          <div style={{position:"absolute",top:-34,left:18,cursor:"pointer"}} onClick={()=>avatarRef.current.click()}>
            {avatarImg?<div style={{width:68,height:68,borderRadius:"50%",overflow:"hidden",border:"4px solid "+T.bg,boxShadow:"0 4px 16px rgba(124,92,252,.4)"}}><img src={avatarImg} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
            :<div style={{width:68,height:68,borderRadius:"50%",background:T.brandGrad,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,border:"4px solid "+T.bg,boxShadow:"0 4px 16px rgba(124,92,252,.4)"}}>{user.init}</div>}
            <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={saveAvatar}/>
          </div>
          <div style={{paddingTop:42}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div>
                {editName
                  ?<div style={{marginTop:2,display:"flex",gap:7}}><Input value={nameInput} onChange={e=>setNameInput(e.target.value)} style={{width:180,padding:"6px 11px",fontSize:16,fontWeight:700}}/><Btn onClick={saveName} v="primary" sz="sm">บันทึก</Btn></div>
                  :<div style={{fontSize:19,fontWeight:800,color:T.text,display:"flex",alignItems:"center",gap:8}}><Nm uid={getUid()} name={displayName} own/>{!user.isGuest&&<span onClick={()=>{setEditName(true);setNameInput(displayName);}} style={{fontSize:13,cursor:"pointer",color:T.muted}}>✏️</span>}</div>
                }
                {user.isGuest&&<span style={{fontSize:11,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"2px 8px",fontWeight:600}}>👋 Guest</span>}
                {!user.isGuest&&user.email&&<div style={{fontSize:12,color:T.muted,marginTop:3}}>🔗 เชื่อมกับ {user.email}</div>}
                {editing?<div style={{marginTop:7,display:"flex",gap:7}}><Input value={bioInput} onChange={e=>setBioInput(e.target.value)} style={{width:220,padding:"6px 11px",fontSize:13}}/><Btn onClick={saveBio} v="primary" sz="sm">บันทึก</Btn></div>
                :<div style={{fontSize:13,color:T.sub,marginTop:5,lineHeight:1.6}}>{bio}</div>}
                <div style={{marginTop:9}}>
                  <span onClick={()=>setShowMP(!showMP)} style={{background:T.brand+"22",color:T.brand2,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",border:"1px solid "+T.borderHi}}>✦ {mood}</span>
                </div>
                {showMP&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>{MOODS.map(m=><Btn key={m} onClick={()=>saveMood(m)} v={mood===m?"outline":"ghost"} sz="sm">{m}</Btn>)}</div>}
              </div>
              <Btn onClick={()=>{setEditing(!editing);setBioInput(bio);}} v="ghost" sz="sm">✏️</Btn>
            </div>
            <div style={{display:"flex",gap:28,marginTop:16,paddingTop:14,borderTop:"1px solid "+T.border}}>
              {[["48","เพื่อน"],[String(myPosts.length),"โพสต์"],[String((_allUsers[getUid()]&&_allUsers[getUid()].giftCount)||0),"ของขวัญ"]].map(([n,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:19,fontWeight:800,background:T.brandGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{n}</div>
                  <div style={{fontSize:12,color:T.muted}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div style={{padding:"16px 18px"}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:14}}>โพสต์ของฉัน</div>
          {myPosts.length===0&&<div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"20px 0"}}>ยังไม่มีโพสต์ ✨</div>}
          {myPosts.map(p=>(
            <div key={p.id} style={{borderBottom:"1px solid "+T.border,paddingBottom:12,marginBottom:12}}>
              {p.images?.length>0&&<div style={{display:"flex",gap:5,marginBottom:7,flexWrap:"wrap"}}>{p.images.map((src,i)=><img key={i} src={src} alt="" style={{width:56,height:56,borderRadius:10,objectFit:"cover",border:"1px solid "+T.border}}/>)}</div>}
              {p.content&&<div style={{fontSize:13,color:T.sub,lineHeight:1.65}}>{p.content}</div>}
              <div style={{fontSize:11,color:T.muted,marginTop:5,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <span>{p.createdAt?timeAgo(p.createdAt):"เมื่อกี้"}</span>
                {p.mood&&<span style={{background:T.brand+"22",borderRadius:20,padding:"0 7px",color:T.brand2,fontWeight:600}}>✦ {p.mood}</span>}
                <span>❤️{p.likes||0}</span><span>💬{(p.comments||[]).length}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── โมเดล 3 มิติ (three.js โหลดเมื่อต้องใช้เท่านั้น) ───────────
// <3D-MODELS>
// สร้างโมเดล 3 มิติแบบโปรซีเดอรัล (ไม่ต้องใช้ไฟล์โมเดลภายนอก)
function build3DModel(THREE,name){
  const g=new THREE.Group();
  const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.45,metalness:.1,...o});
  g.userData.cam=[0,1.1,5.4];
  g.userData.look=[0,0,0];

  if(name==="diamond"){
    const mat=M(0x67e8f9,{metalness:.25,roughness:.08,flatShading:true,emissive:0x0e7490,emissiveIntensity:.4});
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.75,1.15,.55,8,1),mat);
    top.position.y=.27;
    const bottom=new THREE.Mesh(new THREE.CylinderGeometry(1.15,.02,1.35,8,1),mat);
    bottom.position.y=-.68;
    const table=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,.02,8),M(0xcffafe,{emissive:0x67e8f9,emissiveIntensity:.5,roughness:.05}));
    table.position.y=.55;
    g.add(top,bottom,table);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(bottom.geometry),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.55}));
    edges.position.copy(bottom.position);
    g.add(edges);
    g.position.y=.2;
  }

  else if(name==="crown"){
    const gold=M(0xFFC933,{metalness:.45,roughness:.3,emissive:0xB8860B,emissiveIntensity:.55});
    const bandMat=gold.clone();bandMat.side=THREE.DoubleSide;
    const band=new THREE.Mesh(new THREE.CylinderGeometry(1.1,.92,.8,40,1,true),bandMat);
    band.position.y=-.02;
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.92,.08,12,56),gold);
    rim.rotation.x=Math.PI/2;rim.position.y=-.42;
    const rim2=rim.clone();rim2.scale.set(1.2,1.2,1);rim2.position.y=.38;
    g.add(band,rim,rim2);
    const gems=[0xef4444,0x3b82f6,0x10b981,0xa855f7,0xf59e0b];
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      const x=Math.cos(a)*1.0,z=Math.sin(a)*1.0;
      const cone=new THREE.Mesh(new THREE.ConeGeometry(.3,.95,12),gold);
      cone.position.set(x*1.05,.86,z*1.05);
      const ball=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),M(gems[i],{emissive:gems[i],emissiveIntensity:.5,roughness:.15}));
      ball.position.set(x*1.05,1.42,z*1.05);
      g.add(cone,ball);
    }
    g.position.y=-.6;
  }

  else if(name==="pumpkin"){
    const orange=M(0xF97316,{roughness:.55});
    const body=new THREE.Mesh(new THREE.SphereGeometry(.8,32,24),orange);
    body.scale.set(1.15,.9,1.15);
    g.add(body);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const lobe=new THREE.Mesh(new THREE.SphereGeometry(.55,20,16),orange);
      lobe.scale.set(.62,.95,.62);
      lobe.position.set(Math.cos(a)*.62,0,Math.sin(a)*.62);
      g.add(lobe);
    }
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.1,.17,.45,10),M(0x4d7c0f,{roughness:.8}));
    stem.position.set(0,.88,0);stem.rotation.z=.25;
    g.add(stem);
    const glow=new THREE.MeshBasicMaterial({color:0xFFD54A,side:THREE.DoubleSide});
    const tri=(x,y,s)=>{
      const sh=new THREE.Shape();sh.moveTo(0,s);sh.lineTo(-s*.9,-s*.7);sh.lineTo(s*.9,-s*.7);sh.closePath();
      const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),glow);m.position.set(x,y,.99);return m;
    };
    g.add(tri(-.36,.22,.17),tri(.36,.22,.17),tri(0,-.02,.1));
    const mouth=new THREE.Shape();
    mouth.moveTo(-.48,-.12);mouth.lineTo(.48,-.12);mouth.lineTo(.34,-.34);mouth.lineTo(.17,-.2);mouth.lineTo(0,-.38);mouth.lineTo(-.17,-.2);mouth.lineTo(-.34,-.34);mouth.closePath();
    const mm=new THREE.Mesh(new THREE.ShapeGeometry(mouth),glow);mm.position.z=.96;
    g.add(mm);
    const pl=new THREE.PointLight(0xffa33a,1.2,5);pl.position.set(0,0,1.8);g.add(pl);
    g.position.y=-.1;
  }

  else if(name==="krathong"){
    g.userData.cam=[0,2.6,4.9];
    g.userData.look=[0,.1,0];
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.25,.34,48),M(0x84cc16,{roughness:.85}));
    base.position.y=-.45;g.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.27,.09,10,56),M(0x4d7c0f,{roughness:.8}));
    ring.rotation.x=Math.PI/2;ring.position.y=-.27;g.add(ring);
    const petalGeo=new THREE.SphereGeometry(.5,18,14);
    const addPetals=(n,rad,tilt,y,color,len)=>{
      for(let i=0;i<n;i++){
        const pivot=new THREE.Group();pivot.rotation.y=i/n*Math.PI*2+(rad<.4?.3:0);
        const p=new THREE.Mesh(petalGeo,M(color,{roughness:.55,emissive:color,emissiveIntensity:.28,side:THREE.DoubleSide}));
        p.scale.set(.46,len,.14);
        p.position.set(rad,y,0);
        p.rotation.z=-tilt;
        pivot.add(p);g.add(pivot);
      }
    };
    addPetals(10,.85,1.0,.05,0xF472B6,.95);
    addPetals(8,.6,.65,.2,0xF9A8D4,.9);
    addPetals(6,.34,.3,.32,0xFCE7F3,.75);
    const gold=[0xF59E0B,0xFB923C];
    for(let i=0;i<14;i++){
      const a=i/14*Math.PI*2;
      const f=new THREE.Mesh(new THREE.SphereGeometry(.13,12,10),M(gold[i%2],{roughness:.6}));
      f.scale.set(1,.7,1);
      f.position.set(Math.cos(a)*1.12,-.2,Math.sin(a)*1.12);g.add(f);
    }
    const candle=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.95,16),M(0xFEF3C7,{roughness:.6}));
    candle.position.y=.55;g.add(candle);
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),new THREE.MeshBasicMaterial({color:0xFDE047}));
    flame.scale.set(.6,1.5,.6);flame.position.y=1.2;g.add(flame);
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,1.0,6),M(0x7c2d12));
      s.position.set(.22+i*.06,.7,-.12+i*.12);s.rotation.z=-.18-i*.05;g.add(s);
    }
    const light=new THREE.PointLight(0xffa94d,1.4,6);light.position.set(0,1.3,0);g.add(light);
    g.userData.update=t=>{flame.scale.set(.6+Math.sin(t*9)*.05,1.5+Math.sin(t*13)*.18,.6);light.intensity=1.3+Math.sin(t*11)*.25;};
    g.userData.noBob=true;
    g.position.y=-.2;
  }

  else if(name==="firework"){
    g.userData.cam=[0,0,5.6];
    const N=280;
    const pos=new Float32Array(N*3),col=new Float32Array(N*3),dir=new Float32Array(N*3),sp=new Float32Array(N);
    const pal=[0xf43f5e,0xfbbf24,0x22d3ee,0xa78bfa,0x34d399,0xffffff].map(c=>new THREE.Color(c));
    for(let i=0;i<N;i++){
      const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u);
      dir[i*3]=r*Math.cos(a);dir[i*3+1]=u;dir[i*3+2]=r*Math.sin(a);
      sp[i]=.7+Math.random()*.9;
      const c=pal[i%3===0?(i%pal.length):Math.floor(i/(N/3))%pal.length];
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    geo.setAttribute("color",new THREE.BufferAttribute(col,3));
    const mat=new THREE.PointsMaterial({size:.16,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    if(typeof document!=="undefined"){
      const cv=document.createElement("canvas");cv.width=cv.height=32;
      const cx=cv.getContext("2d");
      const gr=cx.createRadialGradient(16,16,0,16,16,16);
      gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.5,"rgba(255,255,255,.6)");gr.addColorStop(1,"rgba(255,255,255,0)");
      cx.fillStyle=gr;cx.fillRect(0,0,32,32);
      mat.map=new THREE.CanvasTexture(cv);
    }
    g.add(new THREE.Points(geo,mat));
    g.userData.update=t=>{
      const ph=(t%2.6)/2.6,e=1-Math.pow(1-Math.min(ph*1.25,1),3);
      for(let i=0;i<N;i++){
        pos[i*3]=dir[i*3]*sp[i]*e*1.3;
        pos[i*3+1]=dir[i*3+1]*sp[i]*e*1.3-ph*ph*.9;
        pos[i*3+2]=dir[i*3+2]*sp[i]*e*1.3;
      }
      mat.opacity=ph<.7?1:Math.max(0,(1-ph)/.3);
      geo.attributes.position.needsUpdate=true;
    };
    g.userData.noBob=true;g.userData.noSpin=true;
  }

  else if(name==="supercar"){
    g.userData.cam=[3.8,1.9,8.6];g.userData.look=[0,.3,0];g.userData.spin=.75;g.userData.noBob=true;
    const paint=M(0xe11d48,{metalness:.65,roughness:.2,emissive:0x500724,emissiveIntensity:.4});
    const glass=M(0x0b1020,{metalness:.9,roughness:.08});
    const chrome=M(0xe5e7eb,{metalness:.95,roughness:.15});
    const ex=(shape,depth,mat,bev=.07)=>{
      const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bev,bevelThickness:bev,bevelSegments:3,curveSegments:14});
      geo.translate(0,0,-depth/2);return new THREE.Mesh(geo,mat);
    };
    // ตัวถัง (โปรไฟล์ด้านข้าง) — หัวรถอยู่ทาง +x
    const side=new THREE.Shape();
    side.moveTo(-1.8,.34);side.lineTo(-1.85,.62);
    side.quadraticCurveTo(-1.7,.82,-1.15,.84);side.lineTo(.1,.8);
    side.quadraticCurveTo(1.2,.72,1.9,.46);side.lineTo(1.95,.32);
    side.quadraticCurveTo(1.8,.26,1.55,.28);side.lineTo(-1.7,.28);side.closePath();
    g.add(ex(side,1.3,paint));
    const cab=new THREE.Shape();
    cab.moveTo(-.8,.8);cab.lineTo(-.4,1.12);cab.quadraticCurveTo(.2,1.18,.4,1.1);cab.lineTo(1.0,.74);cab.closePath();
    g.add(ex(cab,1.04,glass,.03));
    // ล้อ
    const wheels=[];
    const tire=M(0x0f172a,{roughness:.85}),rimM=chrome;
    [[-1.15,.78],[-1.15,-.78],[1.2,.78],[1.2,-.78]].forEach(([x,z])=>{
      const w=new THREE.Group();
      const tr=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.3,30),tire);tr.rotation.x=Math.PI/2;
      const rm=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.32,22),rimM);rm.rotation.x=Math.PI/2;
      w.add(tr,rm);
      for(let i=0;i<5;i++){const sp=new THREE.Mesh(new THREE.BoxGeometry(.07,.52,.34),M(0x94a3b8,{metalness:.9,roughness:.2}));sp.rotation.z=i/5*Math.PI;w.add(sp);}
      w.position.set(x,.42,z);g.add(w);wheels.push(w);
    });
    const axleF=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.6,8),tire);axleF.rotation.x=Math.PI/2;axleF.position.set(1.2,.42,0);
    const axleR=axleF.clone();axleR.position.x=-1.15;g.add(axleF,axleR);
    // ไฟหน้า + แสงไฟ
    const lamp=new THREE.MeshBasicMaterial({color:0xe0f2fe});
    const beamMat=new THREE.MeshBasicMaterial({color:0xbae6fd,transparent:true,opacity:.16,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    [.48,-.48].forEach(z=>{
      const l=new THREE.Mesh(new THREE.SphereGeometry(.1,12,10),lamp);l.scale.set(1.5,.7,1);l.position.set(1.9,.5,z);g.add(l);
      const b=new THREE.Mesh(new THREE.ConeGeometry(.55,2.6,18,1,true),beamMat);b.rotation.z=Math.PI/2;b.position.set(3.2,.46,z);g.add(b);
    });
    const tail=new THREE.Mesh(new THREE.BoxGeometry(.06,.1,1.1),new THREE.MeshBasicMaterial({color:0xff2a4d}));tail.position.set(-1.9,.66,0);g.add(tail);
    // ปีกหลัง
    const wing=new THREE.Mesh(new THREE.BoxGeometry(.5,.06,1.5),paint);wing.position.set(-1.7,1.05,0);g.add(wing);
    [.5,-.5].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.08,.3,.06),glass);p.position.set(-1.65,.9,z);g.add(p);});
    // ไฟใต้ท้องรถ + แท่นโชว์
    const glowM=new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending});
    const under=new THREE.Mesh(new THREE.CircleGeometry(1,40),glowM);under.scale.set(2.4,1.2,1);under.rotation.x=-Math.PI/2;under.position.y=.04;g.add(under);
    const plat=new THREE.Mesh(new THREE.CylinderGeometry(2.9,3,.1,48),M(0x111827,{metalness:.8,roughness:.3}));plat.position.y=-.06;g.add(plat);
    const prim=new THREE.Mesh(new THREE.TorusGeometry(2.9,.04,8,64),new THREE.MeshBasicMaterial({color:0xa78bfa}));prim.rotation.x=Math.PI/2;prim.position.y=0;g.add(prim);
    // เปลวท่อไอเสีย
    const fl=[.3,-.3].map(z=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.12,.7,10),new THREE.MeshBasicMaterial({color:0xfb923c,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));f.rotation.z=Math.PI/2;f.position.set(-2.2,.42,z);g.add(f);return f;});
    g.userData.update=t=>{
      wheels.forEach(w=>{w.rotation.z=-t*14;});
      fl.forEach((f,i)=>{const k=1+Math.sin(t*38+i*2)*.35+Math.random()*.25;f.scale.set(k,1,1);});
      glowM.opacity=.4+.25*Math.sin(t*3);glowM.color.setHSL((.55+.2*Math.sin(t*.8))%1,.9,.55);
    };
    g.position.y=-.35;
  }

  else if(name==="castle"){
    g.userData.cam=[0,3.2,10.8];g.userData.look=[0,1.1,0];g.userData.spin=.5;g.userData.noBob=true;
    const stone=M(0xd6d3d1,{roughness:.8}),dark=M(0x9ca3af,{roughness:.85}),roof=M(0xdc2626,{roughness:.5,emissive:0x450a0a,emissiveIntensity:.3}),gold=M(0xfbbf24,{metalness:.7,roughness:.25,emissive:0xb45309,emissiveIntensity:.5});
    const win=new THREE.MeshBasicMaterial({color:0xffd54a});
    const hill=new THREE.Mesh(new THREE.CylinderGeometry(2.7,3.1,.35,40),M(0x16a34a,{roughness:.9}));hill.position.y=-.2;g.add(hill);
    // กำแพง 4 ด้าน + หอคอยมุม
    const wallH=.95,wallT=.24,half=1.55;
    [[0,half,0],[0,-half,0],[half,0,1],[-half,0,1]].forEach(([x,z,rot])=>{
      const w=new THREE.Mesh(new THREE.BoxGeometry(half*2,wallH,wallT),stone);
      w.position.set(rot?x:0,wallH/2,rot?0:z);if(rot)w.rotation.y=Math.PI/2;g.add(w);
      for(let i=0;i<7;i++){
        const c=new THREE.Mesh(new THREE.BoxGeometry(.22,.2,wallT+.02),dark);
        const off=-half+.2+i*((half*2-.4)/6);
        if(rot){c.rotation.y=Math.PI/2;c.position.set(x,wallH+.1,off);}else c.position.set(off,wallH+.1,z);
        g.add(c);
      }
    });
    const flags=[];
    const tower=(x,z,h,r)=>{
      const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.08,h,20),stone);t.position.set(x,h/2,z);g.add(t);
      const band=new THREE.Mesh(new THREE.TorusGeometry(r*1.04,.04,8,24),dark);band.rotation.x=Math.PI/2;band.position.set(x,h*.72,z);g.add(band);
      const cone=new THREE.Mesh(new THREE.ConeGeometry(r*1.35,h*.55,20),roof);cone.position.set(x,h+h*.275,z);g.add(cone);
      const w=new THREE.Mesh(new THREE.PlaneGeometry(.1,.17),win);w.position.set(x,h*.55,z+r*1.02);g.add(w);
      const w2=w.clone();w2.position.set(x+r*1.02,h*.55,z);w2.rotation.y=Math.PI/2;g.add(w2);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.5,6),gold);pole.position.set(x,h+h*.55+.2,z);g.add(pole);
      const fs=new THREE.Shape();fs.moveTo(0,0);fs.lineTo(.42,.1);fs.lineTo(0,.22);fs.closePath();
      const flag=new THREE.Mesh(new THREE.ShapeGeometry(fs),new THREE.MeshBasicMaterial({color:x*z>0?0xf43f5e:0xfbbf24,side:THREE.DoubleSide}));
      const fg=new THREE.Group();fg.add(flag);fg.position.set(x,h+h*.55+.38,z);g.add(fg);flags.push(fg);
    };
    [[1.55,1.55],[-1.55,1.55],[1.55,-1.55],[-1.55,-1.55]].forEach(([x,z])=>tower(x,z,1.7,.36));
    // ปราสาทหลัก (keep) + หอคอยกลาง
    const keep=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.5,1.4),stone);keep.position.y=.75;g.add(keep);
    tower(0,0,2.9,.5);
    // ประตู
    const gate=new THREE.Mesh(new THREE.BoxGeometry(.6,.7,.1),M(0x3b2a1a,{roughness:.9}));gate.position.set(0,.35,half+.08);g.add(gate);
    const arch=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.1,20,1,false,0,Math.PI),M(0x3b2a1a,{roughness:.9}));arch.rotation.x=Math.PI/2;arch.rotation.z=Math.PI/2;arch.position.set(0,.7,half+.08);g.add(arch);
    const arch2=new THREE.Mesh(new THREE.TorusGeometry(.33,.035,8,20,Math.PI),gold);arch2.position.set(0,.7,half+.14);g.add(arch2);
    // ประกายรอบปราสาท
    const N=90,pos=new Float32Array(N*3),seed=[];
    for(let i=0;i<N;i++){seed.push([Math.random()*6.28,1.2+Math.random()*2.2,Math.random()*3.2,.5+Math.random()*1.5]);}
    const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(pos,3));
    const pm=new THREE.PointsMaterial({size:.14,color:0xfde68a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    if(typeof document!=="undefined")pm.map=glowTexture(THREE);
    const sparks=new THREE.Points(pg,pm);sparks.frustumCulled=false;g.add(sparks);
    const pl=new THREE.PointLight(0xffc266,1.4,9);pl.position.set(0,2.2,2.2);g.add(pl);
    g.userData.update=t=>{
      flags.forEach((f,i)=>{f.rotation.y=Math.sin(t*5+i)*.5;});
      for(let i=0;i<N;i++){const s=seed[i],a=s[0]+t*.3*s[3];pos[i*3]=Math.cos(a)*s[1];pos[i*3+1]=(s[2]+t*.35*s[3])%3.6;pos[i*3+2]=Math.sin(a)*s[1];}
      pg.attributes.position.needsUpdate=true;pm.opacity=.7+.3*Math.sin(t*4);
    };
    g.position.y=-.9;g.scale.setScalar(.95);
  }

  else if(name==="galaxy"){
    g.userData.cam=[0,4.6,6.4];g.userData.look=[0,0,0];g.userData.noBob=true;g.userData.noSpin=true;
    const tex=typeof document!=="undefined"?glowTexture(THREE):null;
    const N=4200,pos=new Float32Array(N*3),col=new Float32Array(N*3);
    const inner=new THREE.Color(0xfff1c2),mid=new THREE.Color(0xf472b6),outer=new THREE.Color(0x60a5fa);
    for(let i=0;i<N;i++){
      const arm=i%3,r=Math.pow(Math.random(),.62)*2.6,ang=arm/3*Math.PI*2+r*1.9+(Math.random()-.5)*.55*(1+r*.25);
      pos[i*3]=Math.cos(ang)*r;pos[i*3+1]=(Math.random()-.5)*.22*(1.2-r/3);pos[i*3+2]=Math.sin(ang)*r;
      const c=new THREE.Color();const k=r/2.6;
      if(k<.35)c.copy(inner).lerp(mid,k/.35);else c.copy(mid).lerp(outer,(k-.35)/.65);
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
    const mat=new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    if(tex)mat.map=tex;
    const disc=new THREE.Group();disc.add(new THREE.Points(geo,mat));disc.children[0].frustumCulled=false;
    const core=new THREE.Mesh(new THREE.SphereGeometry(.34,24,18),new THREE.MeshBasicMaterial({color:0xfff7d6}));
    const halo=new THREE.Mesh(new THREE.SphereGeometry(.75,24,18),new THREE.MeshBasicMaterial({color:0xfbbf24,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));
    disc.add(core,halo);
    // ดาวเคราะห์มีวง + ดวงจันทร์
    const planet=new THREE.Group();
    const pb=new THREE.Mesh(new THREE.SphereGeometry(.18,24,18),M(0x38bdf8,{roughness:.5,emissive:0x0c4a6e,emissiveIntensity:.5}));
    const ring=new THREE.Mesh(new THREE.RingGeometry(.27,.42,40),new THREE.MeshBasicMaterial({color:0xfde68a,side:THREE.DoubleSide,transparent:true,opacity:.7}));ring.rotation.x=Math.PI/2.4;
    planet.add(pb,ring);disc.add(planet);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),M(0xfb923c,{emissive:0x7c2d12,emissiveIntensity:.5}));disc.add(moon);
    // ดาวพื้นหลัง + ดาวตก
    const S=260,sp=new Float32Array(S*3);
    for(let i=0;i<S;i++){const u=Math.random()*2-1,a=Math.random()*6.28,r=Math.sqrt(1-u*u),R=3.2+Math.random()*1.6;sp[i*3]=r*Math.cos(a)*R;sp[i*3+1]=u*R;sp[i*3+2]=r*Math.sin(a)*R;}
    const sg=new THREE.BufferGeometry();sg.setAttribute("position",new THREE.BufferAttribute(sp,3));
    const sm=new THREE.PointsMaterial({size:.07,color:0xffffff,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});if(tex)sm.map=tex;
    const bg=new THREE.Points(sg,sm);bg.frustumCulled=false;g.add(bg);
    const meteor=new THREE.Mesh(new THREE.CylinderGeometry(.012,.05,1.2,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));g.add(meteor);
    disc.rotation.x=.38;g.add(disc);
    g.userData.update=t=>{
      disc.rotation.y=t*.55;
      planet.position.set(Math.cos(t*1.1)*1.75,.05,Math.sin(t*1.1)*1.75);planet.rotation.y=t;
      moon.position.set(Math.cos(t*2.3+2)*1.15,.1,Math.sin(t*2.3+2)*1.15);
      halo.scale.setScalar(1+.12*Math.sin(t*3));
      bg.rotation.y=-t*.08;
      const m=(t*.6)%1.8;meteor.visible=m<1;
      meteor.position.set(3.2-m*5.5,2.4-m*3.4,-.5);meteor.rotation.z=.9;
    };
  }

  return g;
}

function glowTexture(THREE){
  const cv=document.createElement("canvas");cv.width=cv.height=64;
  const cx=cv.getContext("2d"),gr=cx.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,"rgba(255,255,255,1)");gr.addColorStop(.35,"rgba(255,255,255,.55)");gr.addColorStop(1,"rgba(255,255,255,0)");
  cx.fillStyle=gr;cx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(cv);
}
function mkPoints(THREE,n,size,tex){
  const pos=new Float32Array(n*3),col=new Float32Array(n*3),geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  const mat=new THREE.PointsMaterial({size,map:tex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const obj=new THREE.Points(geo,mat);obj.frustumCulled=false;
  return{obj,pos,col,geo,mat};
}
// ฉาก 3 มิติเต็มห้องสำหรับเอฟเฟกต์เข้าห้องพรีเมียม: คืน {group,update(t),cam:[x,y,z,lookY],light}
function build3DEntrance(THREE,kind,durSec){
  const g=new THREE.Group(),tex=glowTexture(THREE),fades=[];
  let F=1,upd=()=>{},cam=[0,0,8,0],light=0xa78bfa;
  const reg=(m,o)=>{m.transparent=true;m.depthWrite=false;m.blending=THREE.AdditiveBlending;m.opacity=o;fades.push([m,o]);return m;};
  const AB=(c,o)=>reg(new THREE.MeshBasicMaterial({color:c}),o);
  const SPR=(c,o,s)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:c}));reg(sp.material,o);sp.scale.set(s,s,1);return sp;};
  const cl=x=>Math.min(Math.max(x,0),1);
  const ease=x=>1-Math.pow(1-cl(x),3);
  const back=x=>{x=cl(x);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);};
  const rnd=(()=>{let s=11;return()=>{s=(s*16807)%2147483647;return s/2147483647;};})();
  // อนุภาคพุ่งกระจาย (พลุ/ประกาย) ยิงได้ด้วย fire(เวลา,x,y,z)
  const burst=(n,color,size,speed=1)=>{
    const P=mkPoints(THREE,n,size,tex),dir=[],sp=[],c=new THREE.Color(color);
    for(let i=0;i<n;i++){const u=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-u*u);dir.push([r*Math.cos(a),u,r*Math.sin(a)]);sp.push((1.2+rnd()*2.2)*speed);P.col[i*3]=c.r;P.col[i*3+1]=c.g;P.col[i*3+2]=c.b;}
    P.mat.transparent=true;P.mat.opacity=0;P.obj.visible=false;g.add(P.obj);
    const B={t0:null,o:[0,0,0],fire(t0,x,y,z){B.t0=t0;B.o=[x,y,z];},
      tick(t,life=1.6){
        if(B.t0===null)return;const k=t-B.t0;
        if(k<0||k>life){P.obj.visible=false;return;}
        P.obj.visible=true;const e=ease(k/life*1.15);
        for(let i=0;i<n;i++){P.pos[i*3]=B.o[0]+dir[i][0]*sp[i]*e;P.pos[i*3+1]=B.o[1]+dir[i][1]*sp[i]*e-k*k*.6;P.pos[i*3+2]=B.o[2]+dir[i][2]*sp[i]*e;}
        P.geo.attributes.position.needsUpdate=true;P.mat.opacity=Math.max(0,1-k/life)*F;
      }};
    return B;
  };

  if(kind==="mist"){
    cam=[0,0,8.4,0];light=0xc084fc;
    const rings=[[1.9,.05,0xc084fc],[1.5,.05,0xf0abfc],[1.1,.06,0x67e8f9]].map(([r,tb,c])=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,tb,10,96),AB(c,.95));g.add(m);return m;});
    const halo=SPR(0x9333ea,.6,6.5);g.add(halo);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.5,24,18),AB(0xf5d0fe,.95));g.add(orb);
    const orbGlow=SPR(0xe9d5ff,.8,2.2);g.add(orbGlow);
    const N=1200,V=mkPoints(THREE,N,.13,tex);reg(V.mat,.95);g.add(V.obj);
    const ang=[],rad=[],hgt=[],spd=[],pal=[0xc084fc,0xf0abfc,0x93c5fd,0xffffff].map(c=>new THREE.Color(c));
    for(let i=0;i<N;i++){ang.push(rnd()*6.283);rad.push(.3+rnd()*2.4);hgt.push((rnd()-.5)*1.3);spd.push(.8+rnd()*1.4);const c=pal[i%4];V.col[i*3]=c.r;V.col[i*3+1]=c.g;V.col[i*3+2]=c.b;}
    const fog=[];
    for(let i=0;i<9;i++){const s=SPR(i%2?0x7c3aed:0xc026d3,.18,3.5+rnd()*3);s.userData={a:rnd()*6.28,r:1+rnd()*2,y:(rnd()-.5)*3};g.add(s);fog.push(s);}
    const b1=burst(180,0xf5d0fe,.17),b2=burst(120,0x93c5fd,.15,.8);
    upd=t=>{
      g.scale.setScalar(Math.max(.001,back(t/.9)));
      rings.forEach((m,i)=>{m.rotation.x=Math.sin(t*.8+i)*.5+.35*i;m.rotation.y=t*(.9+i*.4);m.rotation.z=t*.5*(i%2?-1:1);});
      orb.scale.setScalar(.7+ease(t)*.5+Math.sin(t*6)*.05);orbGlow.scale.setScalar(2+Math.sin(t*5)*.25);
      for(let i=0;i<N;i++){const r=rad[i]*(1-.25*Math.sin(t*1.2+i)),a=ang[i]+t*spd[i]/(.4+rad[i]*.5);V.pos[i*3]=Math.cos(a)*r;V.pos[i*3+1]=hgt[i]+Math.sin(t*2+i)*.2+Math.sin(a*2)*.3;V.pos[i*3+2]=Math.sin(a)*r*.5;}
      V.geo.attributes.position.needsUpdate=true;
      fog.forEach(s=>{const a=s.userData.a+t*.35;s.position.set(Math.cos(a)*s.userData.r,s.userData.y+Math.sin(t+a)*.3,Math.sin(a)*s.userData.r*.6-1);});
      if(b1.t0===null){b1.fire(1.2,0,0,.2);b2.fire(2.0,0,0,.2);}
      b1.tick(t,1.7);b2.tick(t,1.7);
    };
  }

  else if(kind==="thunder"){
    cam=[0,.3,8.4,0];light=0x60a5fa;
    const hit=new THREE.Vector3(0,-1.5,0);
    const mkBolt=(x0,w)=>{
      const grp=new THREE.Group(),segs=14,pts=[];let x=x0,y=3.8;
      for(let i=0;i<=segs;i++){pts.push(new THREE.Vector3(x,y,0));y-=(3.8-hit.y)/segs;x+=(rnd()-.5)*.95*(1-i/segs*.5)+(hit.x-x)*(i/segs)*.3;}
      pts[segs].set(hit.x,hit.y,0);
      const add=(a,b,ww)=>{
        const d=b.clone().sub(a),len=d.length(),th=Math.atan2(-d.x,d.y);
        const core=new THREE.Mesh(new THREE.BoxGeometry(ww,len,ww),AB(0xffffff,1)),gl=new THREE.Mesh(new THREE.BoxGeometry(ww*4.5,len,ww),AB(0x60a5fa,.5));
        [core,gl].forEach(m=>{m.position.copy(a).addScaledVector(d,.5);m.rotation.z=th;grp.add(m);});
      };
      for(let i=0;i<segs;i++)add(pts[i],pts[i+1],w);
      [3,6,9].forEach(k=>{if(rnd()<.8){let p=pts[k].clone();const dir=rnd()<.5?-1:1;for(let j=0;j<4;j++){const n=p.clone().add(new THREE.Vector3(dir*(.35+rnd()*.3),-.4-rnd()*.3,0));add(p,n,w*.6);p=n;}}});
      grp.visible=false;g.add(grp);return grp;
    };
    const strikes=[[.25,-1.9,.05],[.6,1.7,.05],[1.0,.5,.07],[1.45,0,.12]].map(([ts,x,w])=>({ts,grp:mkBolt(x,w)}));
    const glow=SPR(0x93c5fd,.0,3);glow.position.copy(hit);g.add(glow);glow.material.userData={};fades.pop();
    const ring1=new THREE.Mesh(new THREE.TorusGeometry(1,.07,8,72),AB(0x93c5fd,.9)),ring2=new THREE.Mesh(new THREE.TorusGeometry(1,.04,8,72),AB(0xffffff,.8));
    [ring1,ring2].forEach(r=>{r.rotation.x=Math.PI/2;r.position.copy(hit);r.visible=false;g.add(r);});
    const orbs=[0,1,2].map(i=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.16,14,10),AB(0x7dd3fc,1));const s=SPR(0x38bdf8,.9,.9);m.add(s);g.add(m);m.visible=false;return m;});
    const R=300,rain=mkPoints(THREE,R,.07,tex);reg(rain.mat,.55);g.add(rain.obj);
    const rx=[],rz=[],rs=[];for(let i=0;i<R;i++){rx.push((rnd()-.5)*9);rz.push((rnd()-.5)*3);rs.push(4+rnd()*3);rain.col[i*3]=.7;rain.col[i*3+1]=.85;rain.col[i*3+2]=1;}
    const clouds=[-3,-1,1,3].map((x,i)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0x334155,transparent:true,opacity:.7,depthWrite:false}));s.scale.set(4.2,2.4,1);s.position.set(x,3.6,-1+i%2*.5);g.add(s);return s;});
    const sparks=burst(160,0x93c5fd,.15,1.1),sp2=burst(100,0xffffff,.12,.8);
    upd=t=>{
      let flash=0;
      strikes.forEach(s=>{const k=t-s.ts;const on=k>=0&&k<.34&&((Math.floor(k*40))%3!==2);s.grp.visible=on;if(on)flash=Math.max(flash,1-k/.34);});
      clouds.forEach((c,i)=>{c.material.color.setRGB(.2+flash*.5,.33+flash*.5,.41+flash*.55);c.position.x+=Math.sin(t+i)*.002;});
      glow.material.opacity=Math.min(1,flash*.9)*F;glow.scale.setScalar(3+flash*3);
      const k=t-1.45;
      if(k>=0){
        [ring1,ring2].forEach((r,i)=>{const kk=k-i*.18;r.visible=kk>0&&kk<1.3;if(r.visible){const e=ease(kk/1.2);r.scale.setScalar(.2+e*(i?5.4:4.2));r.material.opacity=(1-kk/1.3)*(i?.8:.9)*F;}});
        orbs.forEach((o,i)=>{o.visible=true;const a=t*3.2+i*2.094,e=ease(k/.6);o.position.set(hit.x+Math.cos(a)*1.25*e,hit.y+.55+Math.sin(t*4+i)*.25,Math.sin(a)*.6*e);o.scale.setScalar(.4+e*.8);});
        if(sparks.t0===null){sparks.fire(1.45,hit.x,hit.y,0);sp2.fire(1.45,hit.x,hit.y+.4,0);}
      }
      sparks.tick(t,1.5);sp2.tick(t,1.2);
      for(let i=0;i<R;i++){const y=3.8-((t*rs[i]+i*.37)%7.4);rain.pos[i*3]=rx[i];rain.pos[i*3+1]=y;rain.pos[i*3+2]=rz[i];}
      rain.geo.attributes.position.needsUpdate=true;
    };
  }

  else if(kind==="dragon"){
    cam=[0,.1,9.4,0];light=0xff8a3d;
    const red=new THREE.MeshStandardMaterial({color:0xdc2626,roughness:.4,metalness:.3,emissive:0x7f1d1d,emissiveIntensity:.55});
    const gold=new THREE.MeshStandardMaterial({color:0xfbbf24,roughness:.3,metalness:.6,emissive:0xb45309,emissiveIntensity:.55});
    const belly=new THREE.MeshStandardMaterial({color:0xfde68a,roughness:.5,emissive:0x92400e,emissiveIntensity:.3});
    const M=38,segs=[];
    for(let i=0;i<M;i++){
      const s=i/(M-1),r=.44*(1-s*.8)+(i<7?.05:0);
      const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),red);
      const sp=new THREE.Mesh(new THREE.ConeGeometry(r*.38,r*1.15,6),gold);sp.position.y=r*.95;m.add(sp);
      const bl=new THREE.Mesh(new THREE.SphereGeometry(r*.72,10,8),belly);bl.scale.set(1,.55,1);bl.position.y=-r*.55;m.add(bl);
      m.visible=false;g.add(m);segs.push(m);
    }
    const head=new THREE.Group();
    const sk=new THREE.Mesh(new THREE.SphereGeometry(.5,18,14),red);sk.scale.set(1,.82,1.1);
    const sn=new THREE.Mesh(new THREE.BoxGeometry(.46,.24,.7),red);sn.position.set(0,-.06,.62);
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(.4,.1,.58),red);jaw.position.set(0,-.24,.55);
    head.add(sk,sn,jaw);
    [.24,-.24].forEach(x=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:0xfef08a}));eye.position.set(x,.15,.34);head.add(eye);
      const horn=new THREE.Mesh(new THREE.ConeGeometry(.1,.6,8),gold);horn.position.set(x*1.1,.38,-.15);horn.rotation.x=-.9;head.add(horn);
      const nos=new THREE.Mesh(new THREE.SphereGeometry(.035,6,6),new THREE.MeshBasicMaterial({color:0xff9a3d}));nos.position.set(x*.4,0,.95);head.add(nos);
    });
    const mouth=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));mouth.position.set(0,-.12,.96);head.add(mouth);
    g.add(head);head.visible=false;
    const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.lineTo(.7,.9);wingShape.lineTo(2.1,.8);wingShape.lineTo(1.7,.25);wingShape.lineTo(2.0,-.3);wingShape.lineTo(1.0,-.05);wingShape.lineTo(.6,-.55);wingShape.closePath();
    const wingGeo=new THREE.ShapeGeometry(wingShape);wingGeo.rotateX(-Math.PI/2);
    const wingMat=new THREE.MeshStandardMaterial({color:0xef4444,side:THREE.DoubleSide,roughness:.5,emissive:0x991b1b,emissiveIntensity:.6,transparent:true,opacity:.92});
    const wingG=new THREE.Group(),wl=new THREE.Mesh(wingGeo,wingMat),wr=new THREE.Mesh(wingGeo,wingMat);wr.scale.x=-1;
    wingG.add(wl,wr);wingG.visible=false;g.add(wingG);
    const pl=new THREE.PointLight(0xff7a1a,2.4,10);g.add(pl);
    const NF=260,fire=mkPoints(THREE,NF,.34,tex);reg(fire.mat,1);g.add(fire.obj);
    const fv=[],fl=[],fa=[];for(let i=0;i<NF;i++){fv.push([0,0,0]);fl.push(1);fa.push(9);}
    let fi=0,lastT=0;
    const NE=140,em=mkPoints(THREE,NE,.1,tex);reg(em.mat,.8);g.add(em.obj);
    const es=[];for(let i=0;i<NE;i++){es.push([(rnd()-.5)*8,rnd()*7,rnd()*6.28,.4+rnd()*.8]);em.col[i*3]=1;em.col[i*3+1]=.55+rnd()*.3;em.col[i*3+2]=.2;}
    const P=(a,o)=>o.set(Math.sin(a)*2.7,Math.sin(a*2+.6)*1.15+.15,Math.cos(a)*1.9-.5);
    const tmp=[...Array(M)].map(()=>new THREE.Vector3()),la=new THREE.Vector3(),fwd=new THREE.Vector3();
    const c0=new THREE.Color(0xffe08a),c1=new THREE.Color(0xdc2626),cc=new THREE.Color();
    upd=t=>{
      const dt=Math.min(.05,Math.max(0,t-lastT));lastT=t;
      const ah=1.15*t+.4;
      for(let i=0;i<M;i++)P(ah-i*.105,tmp[i]);
      const end=cl((durSec-t)/.6);
      segs.forEach((m,i)=>{const sc=ease((t-i*.035)/.25)*end;m.visible=sc>.01;m.scale.setScalar(Math.max(.001,sc));m.position.copy(tmp[i]);
        if(i>0){la.copy(tmp[i-1]);m.lookAt(la);}});
      head.visible=t>.05;head.position.copy(tmp[0]);fwd.copy(tmp[0]).sub(tmp[1]);const fl0=fwd.length()||1;fwd.multiplyScalar(1/fl0);
      la.copy(tmp[0]).add(fwd);head.lookAt(la);head.scale.setScalar(Math.max(.001,ease(t/.3)*end));
      jaw.rotation.x=.12+Math.abs(Math.sin(t*3.2))*.3;
      wingG.visible=t>.3;wingG.position.copy(tmp[5]);la.copy(tmp[5]).add(fwd);wingG.lookAt(la);
      const fp=Math.sin(t*8)*.75;wl.rotation.z=fp;wr.rotation.z=-fp;wingG.scale.setScalar(Math.max(.001,ease((t-.3)/.4)*end));
      pl.position.copy(tmp[0]);pl.intensity=2.2+Math.sin(t*20)*.4;
      // ไฟพ่น
      const breathing=t>.9&&t<durSec-1.1;
      if(breathing)for(let k=0;k<7;k++){
        const i=fi++%NF;fa[i]=0;fl[i]=.65+rnd()*.55;
        fire.pos[i*3]=tmp[0].x+fwd.x*.95;fire.pos[i*3+1]=tmp[0].y+fwd.y*.95-.1;fire.pos[i*3+2]=tmp[0].z+fwd.z*.95;
        const sp=3+rnd()*1.8;fv[i]=[fwd.x*sp+(rnd()-.5)*.8,fwd.y*sp+(rnd()-.5)*.8+.15,fwd.z*sp+(rnd()-.5)*.8];
      }
      for(let i=0;i<NF;i++){
        if(fa[i]>=fl[i]||fa[i]>8){fire.pos[i*3+1]=-99;continue;}
        fa[i]+=dt;fire.pos[i*3]+=fv[i][0]*dt;fire.pos[i*3+1]+=fv[i][1]*dt+dt*.6;fire.pos[i*3+2]+=fv[i][2]*dt;
        cc.copy(c0).lerp(c1,cl(fa[i]/fl[i]));fire.col[i*3]=cc.r;fire.col[i*3+1]=cc.g;fire.col[i*3+2]=cc.b;
      }
      fire.geo.attributes.position.needsUpdate=true;fire.geo.attributes.color.needsUpdate=true;
      for(let i=0;i<NE;i++){const e=es[i];em.pos[i*3]=e[0]+Math.sin(t*e[3]+e[2])*.4;em.pos[i*3+1]=-3.6+((e[1]+t*e[3]*1.2)%7.4);em.pos[i*3+2]=Math.sin(e[2])*2;}
      em.geo.attributes.position.needsUpdate=true;
    };
  }

  else if(kind==="emperor"){
    cam=[0,.7,8.6,.2];light=0xfbbf24;
    const crown=build3DModel(THREE,"crown"),holder=new THREE.Group();crown.scale.setScalar(1.55);holder.add(crown);g.add(holder);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,2,7.5,32,1,true),AB(0xfde68a,.16));beam.material.side=THREE.DoubleSide;beam.position.y=.9;g.add(beam);
    const pillars=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2,p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,9,8),AB(0xfbbf24,.4));p.position.set(Math.cos(a)*3,.5,Math.sin(a)*1.2-1);g.add(p);pillars.push(p);}
    const rings=[2.0,2.45,2.9].map((r,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.035,8,90),AB(0xfde68a,.85));m.rotation.x=1.2+i*.12;g.add(m);return m;});
    const sh1=new THREE.Mesh(new THREE.TorusGeometry(1,.09,8,80),AB(0xfff3b0,.95)),sh2=new THREE.Mesh(new THREE.TorusGeometry(1,.05,8,80),AB(0xffffff,.8));
    [sh1,sh2].forEach(r=>{r.rotation.x=Math.PI/2;r.position.y=-.9;r.visible=false;g.add(r);});
    const N=520,C=mkPoints(THREE,N,.11,tex);reg(C.mat,.95);g.add(C.obj);
    const ca=[],cr=[],cp=[],cs=[],pal=[0xfde68a,0xfbbf24,0xfff7d6].map(c=>new THREE.Color(c));
    for(let i=0;i<N;i++){ca.push(rnd()*6.28);cr.push(.4+rnd()*1.6);cp.push(rnd()*6);cs.push(.6+rnd()*1.1);const c=pal[i%3];C.col[i*3]=c.r;C.col[i*3+1]=c.g;C.col[i*3+2]=c.b;}
    const goldM=new THREE.MeshStandardMaterial({color:0xfbbf24,metalness:.8,roughness:.25,emissive:0xb45309,emissiveIntensity:.5});
    const coins=[];for(let i=0;i<34;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.035,16),goldM);c.userData={x:(rnd()-.5)*6.4,z:(rnd()-.5)*2.4,s:1.4+rnd()*1.6,p:rnd()*6,sp:3+rnd()*5};c.visible=false;g.add(c);coins.push(c);}
    const bs=[[2,-2.5,2.3,0xfbbf24],[2.7,2.5,2.7,0xf472b6],[3.4,0,3.1,0xffffff],[4.1,-1.2,1.6,0x93c5fd],[4.6,1.5,2,0xfde68a]].map(([t0,x,y,c])=>({t0,x,y,B:burst(150,c,.16)}));
    const pl=new THREE.PointLight(0xffd36b,2.2,14);pl.position.set(0,2.5,3);g.add(pl);
    upd=t=>{
      const k=t/1.3,drop=ease(k);
      const y=4.6-4.4*drop+(k>1?Math.sin((t-1.3)*2.4)*.07+Math.max(0,.25*Math.exp(-(t-1.3)*5)*Math.abs(Math.sin((t-1.3)*9))):0);
      holder.position.y=y;holder.rotation.y=t*(k<1?4*(1-drop)+1.1:1.1);
      holder.scale.setScalar(Math.max(.001,cl((durSec-t)/.5)));
      beam.scale.set(1+Math.sin(t*3)*.06,1,1+Math.sin(t*3)*.06);
      pillars.forEach((p,i)=>{p.material.opacity=(.25+.2*Math.sin(t*3+i))*F*cl(t/.6);});
      rings.forEach((r,i)=>{r.rotation.z=t*(.7+i*.3)*(i%2?-1:1);r.rotation.y=Math.sin(t*.6+i)*.4;r.scale.setScalar(cl((t-.5)/.5)+.001);});
      const kk=t-1.3;
      [sh1,sh2].forEach((r,i)=>{const q=kk-i*.2;r.visible=q>0&&q<1.5;if(r.visible){r.scale.setScalar(.2+ease(q/1.3)*(i?7:6));r.material.opacity=(1-q/1.5)*.9*F;}});
      for(let i=0;i<N;i++){const a=ca[i]+t*cs[i]*1.2;C.pos[i*3]=Math.cos(a)*cr[i]*(1+Math.sin(t+i)*.1);C.pos[i*3+1]=-2.8+((cp[i]+t*cs[i])%6);C.pos[i*3+2]=Math.sin(a)*cr[i]*.7;}
      C.geo.attributes.position.needsUpdate=true;
      coins.forEach(c=>{const u=c.userData,tt=t-1.2;c.visible=tt>0;if(c.visible){c.position.set(u.x,5-((tt*u.s+u.p)%8.5),u.z);c.rotation.x=t*u.sp;c.rotation.z=t*u.sp*.6;}});
      bs.forEach(b=>{if(t>=b.t0&&b.B.t0===null)b.B.fire(b.t0,b.x,b.y,0);b.B.tick(t,1.7);});
      pl.intensity=2+Math.sin(t*5)*.5;
    };
  }

  return{group:g,cam,light,update(t){F=cl(t/.25)*cl((durSec-t)/.7);fades.forEach(([m,o])=>{m.opacity=o*F;});upd(t);}};
}

// </3D-MODELS>

function Model3D({model,size=200}){
  const ref=useRef();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let stop=false,cleanup=()=>{};
    setFailed(false);
    import("three").then(THREE=>{
      if(stop||!ref.current)return;
      let renderer;
      try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
      catch(e){setFailed(true);return;}
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      renderer.setSize(size,size);
      ref.current.appendChild(renderer.domElement);
      const scene=new THREE.Scene();
      const cam=new THREE.PerspectiveCamera(40,1,.1,100);
      scene.add(new THREE.AmbientLight(0xffffff,.75));
      const dl=new THREE.DirectionalLight(0xffffff,1.1);dl.position.set(3,5,4);scene.add(dl);
      const pl=new THREE.PointLight(0xa78bfa,.8,20);pl.position.set(-3,2,3);scene.add(pl);
      const obj=build3DModel(THREE,model);
      scene.add(obj);
      const c=obj.userData.cam||[0,1.1,5.4],l=obj.userData.look||[0,0,0];
      cam.position.set(c[0],c[1],c[2]);cam.lookAt(l[0],l[1],l[2]);
      const baseY=obj.position.y;
      let raf;const t0=performance.now();
      const loop=()=>{
        const t=(performance.now()-t0)/1000;
        if(!obj.userData.noSpin)obj.rotation.y=t*(obj.userData.spin||1.1);
        if(!obj.userData.noBob)obj.position.y=baseY+Math.sin(t*2)*.1;
        if(obj.userData.update)obj.userData.update(t);
        renderer.render(scene,cam);
        raf=requestAnimationFrame(loop);
      };
      loop();
      cleanup=()=>{
        cancelAnimationFrame(raf);
        scene.traverse(o=>{
          if(o.geometry)o.geometry.dispose();
          if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});
        });
        renderer.dispose();
        try{renderer.forceContextLoss();}catch(e){}
        if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    }).catch(e=>{console.error("3d",e);setFailed(true);});
    return()=>{stop=true;cleanup();};
  },[model,size]);
  if(failed){
    const g=GIFTS.find(x=>x.model===model);
    return<div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.5}}>{g?g.emoji:"🎁"}</div>;
  }
  return<div ref={ref} style={{width:size,height:size}}/>;
}

// ฉาก 3 มิติเต็มห้องของเอฟเฟกต์เข้าห้อง (วาดบนแคนวาสโปร่งใสเต็มพื้นที่ ถ้า WebGL ใช้ไม่ได้จะแสดง fallback)
function EntranceScene3D({kind,dur,fallback}){
  const ref=useRef();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let stop=false,cleanup=()=>{};
    import("three").then(THREE=>{
      if(stop||!ref.current)return;
      let renderer;
      try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
      catch(e){setFailed(true);return;}
      const el=ref.current,w=el.clientWidth||420,h=el.clientHeight||430;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.setSize(w,h);
      renderer.domElement.style.cssText="position:absolute;left:0;top:0;width:100%;height:100%";
      el.appendChild(renderer.domElement);
      const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(48,w/h,.1,100);
      scene.add(new THREE.AmbientLight(0xffffff,.7));
      const dl=new THREE.DirectionalLight(0xffffff,1.1);dl.position.set(3,5,6);scene.add(dl);
      const S=build3DEntrance(THREE,kind,dur/1000);
      const pl=new THREE.PointLight(S.light,1.2,30);pl.position.set(-3,2,5);scene.add(pl);
      scene.add(S.group);
      const fit=Math.max(1,.95/(w/h));
      cam.position.set(S.cam[0],S.cam[1],S.cam[2]*fit);cam.lookAt(0,S.cam[3]||0,0);
      let raf;const t0=performance.now();
      const loop=()=>{S.update((performance.now()-t0)/1000);renderer.render(scene,cam);raf=requestAnimationFrame(loop);};
      loop();
      cleanup=()=>{
        cancelAnimationFrame(raf);
        scene.traverse(o=>{
          if(o.geometry)o.geometry.dispose();
          if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});
        });
        renderer.dispose();
        try{renderer.forceContextLoss();}catch(e){}
        if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    }).catch(e=>{console.error("3d entrance",e);setFailed(true);});
    return()=>{stop=true;cleanup();};
  },[kind,dur]);
  if(failed)return fallback||null;
  return<div ref={ref} style={{position:"absolute",inset:0}}/>;
}

// <FX-ENGINE>
// ── เอฟเฟกต์ของขวัญ/ไอเทมพรีเมียม: ภาพ + เสียง (ใช้ CSS transform/opacity ล้วน ๆ และ WebAudio สังเคราะห์เสียง ไม่มีไฟล์ภายนอก) ──
const FX_CSS=`
@keyframes wmSpin{to{transform:rotate(360deg)}}
@keyframes wmGlow{0%,100%{box-shadow:0 0 6px var(--g)}50%{box-shadow:0 0 20px var(--g)}}
@keyframes wmFloat{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-3px)}}
@keyframes wmTwinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}
@keyframes wmShimmer{0%{background-position:0% 0}100%{background-position:200% 0}}
@keyframes wmNeon{0%,100%{text-shadow:0 0 4px #22D3EE,0 0 10px #22D3EE}50%{text-shadow:0 0 8px #67E8F9,0 0 22px #06B6D4,0 0 34px #06B6D4}}
@keyframes wmShine{0%{transform:translateX(-130%)}60%,100%{transform:translateX(260%)}}
@keyframes wmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes wmM_rise{0%{transform:translateY(70px) scale(.4);opacity:0}20%{transform:translateY(0) scale(1.15);opacity:1}75%{transform:translateY(-30px) scale(1);opacity:1}100%{transform:translateY(-90px) scale(.9);opacity:0}}
@keyframes wmM_bounce{0%{transform:scale(.2);opacity:0}18%{transform:scale(1.3);opacity:1}30%{transform:scale(.9)}42%{transform:scale(1.12)}55%{transform:scale(1)}85%{transform:scale(1);opacity:1}100%{transform:scale(.8) translateY(-40px);opacity:0}}
@keyframes wmM_drop{0%{transform:translateY(-220px);opacity:0}25%{transform:translateY(0) scale(1.1);opacity:1}35%{transform:translateY(-26px)}45%{transform:translateY(0)}55%{transform:translateY(-10px)}65%{transform:translateY(0)}88%{opacity:1}100%{transform:translateY(30px) scale(.8);opacity:0}}
@keyframes wmM_spin{0%{transform:scale(.2) rotate(-360deg);opacity:0}30%{transform:scale(1.2) rotate(0);opacity:1}80%{transform:scale(1);opacity:1}100%{transform:scale(.8) rotate(20deg);opacity:0}}
@keyframes wmM_fly{0%{transform:translate(-160px,160px) scale(.5);opacity:0}25%{opacity:1}60%{transform:translate(0,0) scale(1.2)}100%{transform:translate(200px,-240px) scale(.7);opacity:0}}
@keyframes wmM_zoom{0%{transform:scale(.1);opacity:0}25%{transform:scale(1.35);opacity:1}40%{transform:scale(1)}85%{transform:scale(1.06);opacity:1}100%{transform:scale(1.5);opacity:0}}
@keyframes wmM_drive{0%{transform:translateX(-300px) scale(.9);opacity:0}25%{transform:translateX(0) scale(1.15);opacity:1}70%{transform:translateX(0) scale(1.15);opacity:1}100%{transform:translateX(320px);opacity:0}}
@keyframes wmBurst{0%{transform:translate(-50%,-50%) scale(.3) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1) rotate(var(--rot));opacity:0}}
@keyframes wmFall{0%{transform:translate(0,-20px) rotate(0);opacity:0}10%{opacity:1}85%{opacity:1}100%{transform:translate(var(--dx),var(--h)) rotate(var(--rot));opacity:0}}
@keyframes wmRays{to{transform:rotate(360deg)}}
@keyframes wmRing{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}
@keyframes wmVig{0%{opacity:0}12%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes wmShake{0%,100%{transform:translate(0,0)}10%{transform:translate(-4px,3px)}20%{transform:translate(5px,-3px)}30%{transform:translate(-5px,-2px)}40%{transform:translate(4px,3px)}50%{transform:translate(-3px,2px)}60%{transform:translate(3px,-2px)}70%{transform:translate(0,0)}}
@keyframes wmBannerPop{0%{transform:translateY(-30px) scale(.7);opacity:0}12%{transform:translateY(0) scale(1.06);opacity:1}20%{transform:scale(1)}88%{opacity:1}100%{transform:translateY(-10px) scale(.95);opacity:0}}
@keyframes wmFlash1{0%{opacity:0}12%{opacity:.85}100%{opacity:0}}
@keyframes wmFlash{0%,100%{opacity:0}4%{opacity:.9}8%{opacity:0}14%{opacity:.75}20%{opacity:0}}
@keyframes wmSweep{0%{transform:translateX(-130%) scale(.8);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(130%) scale(1.1);opacity:0}}
@keyframes wmFog{0%{transform:translate(-8%,4%) scale(.9);opacity:0}30%{opacity:.85}100%{transform:translate(8%,-6%) scale(1.25);opacity:0}}
@keyframes wmBolt{0%,100%{opacity:0;transform:scale(.6)}6%,16%{opacity:1;transform:scale(1.15)}11%{opacity:.2}}
@keyframes wmCrown{0%{transform:translateY(-240px) scale(.6) rotate(-20deg);opacity:0}30%{transform:translateY(0) scale(1.2) rotate(0);opacity:1}42%{transform:translateY(-18px)}52%{transform:translateY(0)}90%{opacity:1}100%{transform:scale(1.05);opacity:0}}
`;
if(typeof document!=="undefined"&&!document.getElementById("wm-fx-css")){
  const s=document.createElement("style");s.id="wm-fx-css";s.textContent=FX_CSS;document.head.appendChild(s);
}
const FX_LITE=typeof window!=="undefined"&&(((window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches))||((navigator.hardwareConcurrency||8)<=2));
const CONF=["#F43F5E","#FBBF24","#34D399","#38BDF8","#A78BFA","#F472B6"];

// ── เสียง: WebAudio สังเคราะห์สด (เสียงยิ่งใหญ่ตามระดับ) เปิด/ปิดได้ จำค่าไว้ในเครื่อง ─────────
const sfx=(()=>{
  let ctx=null,master=null,fmaster=null;
  const isOn=()=>ls.get("sfx",true)!==false;
  const nt=s=>261.63*Math.pow(2,s/12);
  function ensure(){
    if(!isOn())return null;
    try{
      if(!ctx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)return null;
        ctx=new AC();
        master=ctx.createGain();master.gain.value=.2;
        const comp=ctx.createDynamicsCompressor();
        master.connect(comp);comp.connect(ctx.destination);
        fmaster=ctx.createGain();fmaster.gain.value=.55;fmaster.connect(comp); // ไฟล์เสียงจริงเข้าทางนี้
      }
      if(ctx.state==="suspended")ctx.resume();
      return ctx;
    }catch(e){return null;}
  }
  // โน้ตเดี่ยว: slide = ตัวคูณความถี่ปลายทาง, att = เวลาไล่เสียงขึ้น, vib = [ความลึกHz, ความเร็วHz]
  function tone(f,t0,dur,o={}){
    const{type="sine",vol=.5,slide=0,lp=0,att=.02,vib=null}=o,c=ctx,t=c.currentTime+t0;
    const osc=c.createOscillator(),g=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(f,t);
    if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+dur);
    if(vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=vib[1];lg.gain.value=vib[0];l.connect(lg);lg.connect(osc.frequency);l.start(t);l.stop(t+dur+.05);}
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+att);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    if(lp){const fl=c.createBiquadFilter();fl.type="lowpass";fl.frequency.value=lp;osc.connect(fl);fl.connect(g);}else osc.connect(g);
    g.connect(master);osc.start(t);osc.stop(t+dur+.05);
  }
  function noise(t0,dur,o={}){
    const{vol=.4,from=4000,to=200,hp=0}=o,c=ctx,t=c.currentTime+t0;
    const len=Math.max(1,Math.floor(c.sampleRate*dur)),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const s=c.createBufferSource();s.buffer=buf;
    const fl=c.createBiquadFilter();fl.type="lowpass";
    fl.frequency.setValueAtTime(from,t);fl.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+dur);
    const g=c.createGain();g.gain.value=vol;
    s.connect(fl);
    if(hp){const h=c.createBiquadFilter();h.type="highpass";h.frequency.value=hp;fl.connect(h);h.connect(g);}else fl.connect(g);
    g.connect(master);s.start(t);
  }
  const arp=(steps,t0,gap,o)=>steps.forEach((s,i)=>tone(nt(s),t0+i*gap,o.dur||.25,{type:o.type||"triangle",vol:o.vol||.4,lp:o.lp||0}));
  // ระฆัง/กระดิ่งแก้ว (โอเวอร์โทนไม่เป็นจำนวนเต็ม)
  const bell=(f,t0,vol=.3,dur=1.4)=>[[1,1],[2.76,.5],[5.4,.28],[8.93,.14]].forEach(([r,a])=>tone(f*r,t0,dur/r**.35,{vol:vol*a,att:.005}));
  const pluck=(f,t0,vol=.35)=>tone(f,t0,.55,{type:"triangle",vol,att:.004,lp:3200});
  const thump=(t0,vol=.7,f=80)=>tone(f,t0,.28,{vol,slide:.45,att:.004});
  const brass=(s,t0,dur,vol=.28)=>tone(nt(s),t0,dur,{type:"sawtooth",vol,lp:2200,att:.05,vib:[3,5.5]});
  const pad=(steps,t0,dur,vol=.14,lp=1800)=>steps.forEach(s=>{tone(nt(s),t0,dur,{type:"sawtooth",vol,lp,att:dur*.45});tone(nt(s)*1.007,t0,dur,{type:"sawtooth",vol:vol*.8,lp,att:dur*.45});});
  function run(fn){try{if(ensure())fn();}catch(e){}}

  // ── ไฟล์เสียงจริง: วางไว้ที่ public/sounds/gift-<ไอดีของขวัญ>.mp3 และ entrance-<ชื่อเอฟเฟกต์>.mp3 ──
  // ถ้ามีไฟล์ จะเล่นไฟล์จริง (ปรับความดังอัตโนมัติ) ถ้าไม่มีหรือโหลดไม่ได้ จะใช้เสียงสังเคราะห์สำรองด้านล่าง
  const files=new Map(); // key -> {buf,norm} | null (ไม่มีไฟล์) | "loading"
  async function loadFile(key){
    if(files.has(key)||!ctx)return;
    files.set(key,"loading");
    try{
      const r=await fetch("/sounds/"+key+".mp3");
      if(!r.ok||!/audio|octet-stream|mpeg|ogg|wav/i.test(r.headers.get("content-type")||""))throw new Error("no file");
      const ab=await r.arrayBuffer();
      const buf=await new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);});
      let pk=0;
      for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<d.length;i+=5){const a=Math.abs(d[i]);if(a>pk)pk=a;}}
      files.set(key,{buf,norm:pk>0?Math.min(12,.9/pk):1});
    }catch(e){files.set(key,null);}
  }
  function playFile(f,tier,maxSec){
    const c=ctx,t=c.currentTime,s=c.createBufferSource(),g=c.createGain();
    s.buffer=f.buf;
    const dur=Math.min(f.buf.duration,maxSec||6);
    const vol=f.norm*[0,.6,.7,.8,.9,1][Math.min(5,Math.max(1,tier||3))];
    g.gain.setValueAtTime(vol,t);
    if(dur<f.buf.duration){g.gain.setValueAtTime(vol,t+Math.max(0,dur-.4));g.gain.linearRampToValueAtTime(0,t+dur);}
    s.connect(g);g.connect(fmaster);s.start(t);s.stop(t+dur+.05);
  }
  function playKey(key,tier,maxSec,fallback){
    const f=files.get(key);
    if(f&&f!=="loading"){playFile(f,tier,maxSec);return;}
    if(f===undefined)loadFile(key); // ครั้งแรกที่ยังไม่ได้โหลด: ใช้เสียงสังเคราะห์ไปก่อน แล้วโหลดไว้ใช้ครั้งต่อไป
    fallback();
  }

  // ── เสียงเฉพาะของของขวัญแต่ละชิ้น (ใส่เสียงใหม่ = เพิ่มคีย์ตามไอดีของขวัญ) ──
  const GIFT={
    heart(){thump(0,.55,70);thump(.17,.45,62);bell(nt(19),.3,.22,.9);bell(nt(23),.42,.18,.9);},
    rose(){[0,2,4,7,9,12,14].forEach((s,i)=>pluck(nt(s+12),i*.06,.3));bell(nt(31),.5,.2,1.2);},
    coffee(){noise(0,.55,{vol:.14,from:2200,to:900});[0,.18,.34].forEach((d,i)=>tone(300+i*80,.45+d,.12,{vol:.25,slide:2}));bell(nt(33),1.0,.22,.5);bell(nt(36),1.06,.16,.5);},
    bear(){tone(520,0,.1,{type:"square",vol:.2,slide:2.1,lp:2500});tone(1000,.12,.1,{type:"square",vol:.2,slide:.6,lp:2500});tone(220,.3,.35,{vol:.4,slide:3.6,vib:[25,14]});},
    cake(){[[0,.17],[0,.17],[2,.34],[0,.34],[5,.34],[4,.7]].reduce((t,[s,d])=>{tone(nt(s+12),t,d*1.1,{type:"triangle",vol:.35});bell(nt(s+24),t,.12,.5);return t+d;},0);noise(1.95,.12,{vol:.35,from:9000,to:2500});[28,31,36].forEach((s,i)=>bell(nt(s),2.0+i*.05,.15,.8));},
    star(){[24,28,31,36,40,43].forEach((s,i)=>bell(nt(s),i*.07,.22,1.1));noise(0,.6,{vol:.08,from:9000,to:5000,hp:3000});},
    rocket(){[0,.15,.3].forEach(t=>tone(880,t,.09,{vol:.25}));noise(.5,.6,{vol:.45,from:700,to:200});tone(90,.5,1.3,{type:"sawtooth",vol:.4,slide:10,lp:1400});noise(.8,1.1,{vol:.55,from:300,to:7000});},
    crown(){[0,7,12,16].forEach((s,i)=>brass(s,i*.14,.18,.26));arp([12,16,19,24],.62,0,{dur:.9,vol:.2,type:"triangle"});bell(nt(31),.7,.18,1.1);},
    diamond(){[28,31,35,40,43].forEach((s,i)=>bell(nt(s),i*.1,.26,1.6));noise(.2,.9,{vol:.07,from:9500,to:6000,hp:4000});tone(4200,.45,.5,{vol:.08,att:.05});},
    crown3d(){for(let i=0;i<6;i++)thump(i*.09,.45,78);[0,0,7,12,16].forEach((s,i)=>brass(s,.5+i*.15,i===4?1.1:.2,.28));arp([12,16,19,24],1.3,0,{dur:1.2,vol:.22});noise(1.3,1.3,{vol:.25,from:9000,to:2000,hp:2500});bell(nt(24),1.35,.2,1.6);},
    pumpkin(){tone(nt(-12),0,.9,{type:"sawtooth",vol:.3,lp:500,vib:[2,5]});tone(620,.1,.9,{vol:.22,slide:.55,vib:[18,6]});[.5,.62,.74].forEach(t=>tone(3200,t,.07,{vol:.12,slide:1.4}));[7,5,3,0].forEach((s,i)=>tone(nt(s-12)*2,1.0+i*.14,.11,{type:"sawtooth",vol:.26,lp:900}));},
    krathong(){[0,.2,.45,.62,.9].forEach(t=>tone(1200,t,.14,{vol:.2,slide:.35}));bell(nt(-5),.1,.3,2);[0,2,4,7,4,2].forEach((s,i)=>tone(nt(s+12),.5+i*.24,.34,{vol:.2,vib:[4,5],att:.06}));},
    firework(){tone(600,0,.75,{vol:.22,slide:5});thump(.75,.9,60);noise(.75,.95,{vol:.8,from:2600,to:80});tone(nt(-36),.75,1,{vol:.7,slide:.5});for(let i=0;i<9;i++)noise(.95+i*.09,.05,{vol:.25,from:9000,to:3500,hp:2500});[31,36,40].forEach((s,i)=>bell(nt(s),1.0+i*.08,.14,1));},
    supercar(){
      // เครื่องยนต์ V8 สังเคราะห์: ความถี่ไต่ตามรอบเครื่อง + จังหวะจุดระเบิด + เปลี่ยนเกียร์ + ท่อแตก
      const c=ctx,t=c.currentTime;
      const A=(p,pts)=>{p.setValueAtTime(pts[0][1],t+pts[0][0]);for(let i=1;i<pts.length;i++)p.linearRampToValueAtTime(pts[i][1],t+pts[i][0]);};
      const rpm=[[0,34],[.15,46],[.9,138],[1.0,142],[1.08,84],[1.2,92],[1.9,188],[2.05,190],[2.4,70],[2.8,52]];
      const bus=c.createGain();
      [["sawtooth",1,.5],["sawtooth",2.01,.28],["square",.5,.4],["sawtooth",3.02,.12]].forEach(([ty,m,v])=>{
        const o=c.createOscillator(),g=c.createGain();o.type=ty;A(o.frequency,rpm.map(([x,f])=>[x,f*m]));g.gain.value=v;o.connect(g);g.connect(bus);o.start(t);o.stop(t+2.9);
      });
      const am=c.createGain();am.gain.value=.6;
      const lfo=c.createOscillator(),lg=c.createGain();A(lfo.frequency,rpm.map(([x,f])=>[x,f*.5]));lg.gain.value=.35;lfo.connect(lg);lg.connect(am.gain);lfo.start(t);lfo.stop(t+2.9);
      const lp=c.createBiquadFilter();lp.type="lowpass";lp.Q.value=2;A(lp.frequency,rpm.map(([x,f])=>[x,300+f*9]));
      const env=c.createGain();env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(1.4,t+.12);env.gain.setValueAtTime(1.4,t+2.4);env.gain.exponentialRampToValueAtTime(.0001,t+2.9);
      bus.connect(am);am.connect(lp);lp.connect(env);env.connect(master);
      noise(0,2.4,{vol:.14,from:1500,to:900});
      noise(1.0,.4,{vol:.22,from:6000,to:1800,hp:2500});
      [2.45,2.52,2.6,2.67,2.76].forEach((d,i)=>noise(d,.07,{vol:.5-i*.07,from:2600,to:300}));
    },
    castle(){[0,.6,1.2].forEach(t=>bell(nt(-12),t,.35,2));for(let i=0;i<8;i++)thump(i*.07,.4,85);[0,7,12].forEach((s,i)=>brass(s,.3+i*.35,.6,.3));[0,4,7,12].forEach(s=>brass(s,1.5,1.5,.2));noise(1.4,1.5,{vol:.25,from:9000,to:2000,hp:2500});arp([12,16,19,24,28],1.7,.1,{dur:.5,vol:.18});},
    galaxy(){pad([-12,-5,0,4,7],0,2.4,.12,2600);noise(0,2.6,{vol:.08,from:300,to:3000});tone(2000,.4,.45,{vol:.14,slide:.1});tone(1600,.9,.45,{vol:.12,slide:.1});[36,31,28,24,19,16,12].forEach((s,i)=>bell(nt(s),.7+i*.13,.16,1.6));tone(nt(-36),.2,2.2,{vol:.5,slide:.7,att:.8});},
  };
  // ── เสียงเอฟเฟกต์เข้าห้องพรีเมียม ──
  const ENT={
    mist(){pad([0,7,12,16],0,2.6,.13,2200);noise(0,2.8,{vol:.1,from:400,to:2800});tone(200,.1,.7,{vol:.25,slide:6});[24,28,31,36].forEach((s,i)=>bell(nt(s),.5+i*.2,.2,1.4));},
    thunder(){
      noise(0,3.6,{vol:.07,from:6000,to:3000});
      [[.25,.6],[.6,.7],[1.0,.8],[1.45,1]].forEach(([t,v],i)=>{noise(t,.22,{vol:.7*v,from:9000,to:700});tone(3000,t,.18,{type:"sawtooth",vol:.14*v,slide:.07,lp:5000});noise(t+.08,1.2+i*.3,{vol:.55*v,from:500,to:45});});
      thump(1.45,1,70);tone(nt(-30),1.45,1.4,{vol:.7,slide:.55});arp([0,7,12],2,.16,{dur:.5,vol:.26,type:"sawtooth",lp:2400});
    },
    dragon(){
      tone(140,0,1.4,{type:"sawtooth",vol:.5,slide:.5,lp:950,vib:[10,34]});tone(210,0,1.3,{type:"square",vol:.18,slide:.42,lp:1300,vib:[8,30]});noise(0,1.5,{vol:.5,from:3500,to:300});
      [.5,.95,1.4,1.85,2.3,2.75].forEach(t=>noise(t,.25,{vol:.35,from:600,to:90}));
      noise(1.5,1.8,{vol:.55,from:5200,to:600});tone(nt(-24),1.5,1.8,{vol:.55,slide:.6,att:.3});
      [0,3,7,10].forEach((s,i)=>brass(s,1.6+i*.2,.6,.24));
      tone(100,3.1,1.5,{type:"sawtooth",vol:.45,slide:.45,lp:800,vib:[9,30]});noise(3.1,1.5,{vol:.4,from:3000,to:250});
    },
    emperor(){
      for(let i=0;i<14;i++)thump(i*(.16-i*.007),.2+i*.04,i%2?72:88);
      noise(1.15,2.2,{vol:.45,from:9500,to:1400,hp:2000});bell(nt(-12),1.15,.5,3);tone(nt(-36),1.15,1.6,{vol:.8,slide:.5});
      [0,0,7,12,16,19,24].forEach((s,i)=>brass(s,1.2+i*.2,i===6?2.2:.3,.28));
      [0,4,7,12,16,19].forEach(s=>{tone(nt(s),2.6,3.2,{type:"triangle",vol:.22,att:.5});tone(nt(s)*1.006,2.6,3.2,{type:"triangle",vol:.18,att:.5});});
      for(let i=0;i<16;i++)bell(nt(30+(i*5)%14),2.4+i*.22,.1,.7);
      arp([24,28,31,36,40],3.6,.1,{dur:.5,vol:.2});
    },
  };
  const tierFallback=tier=>{
    if(tier<=1){tone(nt(12),0,.12,{vol:.3});tone(nt(19),.07,.14,{vol:.3});}
    else if(tier===2){arp([12,16,19,24],0,.07,{dur:.22,vol:.35});}
    else if(tier===3){arp([0,4,7,12,16,19],0,.07,{dur:.3,vol:.38});noise(0,.7,{vol:.12,from:700,to:6000});}
    else if(tier===4){thump(0,.7,70);arp([0,4,7,12,16,19,24],.05,.075,{dur:.35,vol:.4});[0,4,7,12].forEach(s=>tone(nt(s),.6,1,{type:"triangle",vol:.3}));noise(.5,.9,{vol:.15,from:900,to:7000});}
    else{noise(0,1,{vol:.7,from:700,to:60});tone(nt(-36),0,1.2,{vol:.8,slide:.5});[0,0,0,5,7,12].forEach((s,i)=>tone(nt(s),.15+i*.17,i===5?1.8:.3,{type:"sawtooth",vol:.28,lp:2400}));noise(1.1,1.6,{vol:.3,from:9000,to:1500});}
  };
  return{
    isOn,
    set(v){ls.set("sfx",!!v);},
    has:id=>!!GIFT[id],
    ids:()=>Object.keys(GIFT),
    entranceIds:()=>Object.keys(ENT),
    // ถ้าของขวัญมีเสียงเฉพาะตัวจะใช้เสียงนั้น ไม่มีก็ใช้เสียงตามระดับ
    gift(tier,id,maxSec){run(()=>playKey("gift-"+id,tier,maxSec||5,()=>(GIFT[id]||(()=>tierFallback(tier)))()));},
    entrance(kind,maxSec){run(()=>playKey("entrance-"+kind,4,maxSec||7,()=>{if(ENT[kind])ENT[kind]();}));},
    preload(){if(!ensure())return;Object.keys(GIFT).forEach(i=>loadFile("gift-"+i));Object.keys(ENT).forEach(k=>loadFile("entrance-"+k));},
    source(key){const f=files.get(key);return f&&f!=="loading"?"file":(f==="loading"?"loading":"synth");},
    buy(){run(()=>{arp([12,16,19,24],0,.08,{dur:.3,vol:.35});});},
  };
})();

// ── ตัวช่วยสุ่มแบบกำหนดเมล็ด (เพื่อให้อนุภาคไม่สลับตำแหน่งเมื่อหน้าจอรีเรนเดอร์) ──
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function buildParticles(fx){
  const r=rng(Math.floor(fx.id*1000)),t=fx.tier,pool=fx.p&&fx.p.length?fx.p:["✨"],lite=FX_LITE?.6:1,colors=fx.colors||CONF;
  const nb=Math.floor([0,0,10,16,16,22][t]*lite),nc=Math.floor([0,0,0,0,18,34][t]*lite);
  const out=[];
  for(let i=0;i<nb;i++){
    const ang=r()*Math.PI*2,dist=(t>=4?120:90)+r()*(t>=4?150:80);
    out.push({k:"b",ox:50,oy:50,ch:pool[Math.floor(r()*pool.length)],dx:Math.cos(ang)*dist,dy:Math.sin(ang)*dist,rot:r()*360-180,sz:16+r()*(10+t*3),delay:.15+r()*.5,dur:1.2+r()*.8});
  }
  if(t>=5){
    [[22,30,.7],[78,26,1.3],[50,16,2]].forEach(([ox,oy,d0])=>{
      for(let i=0;i<(FX_LITE?6:10);i++){const ang=i/(FX_LITE?6:10)*Math.PI*2,dist=70+r()*40;
        out.push({k:"b",ox,oy,ch:["✨","💥","⭐","🎆"][i%4],dx:Math.cos(ang)*dist,dy:Math.sin(ang)*dist,rot:0,sz:18,delay:d0+r()*.15,dur:1.1});}
    });
  }
  for(let i=0;i<nc;i++){
    out.push({k:"c",x:r()*100,dx:(r()-.5)*80,h:320+r()*160,rot:360+r()*720,color:colors[Math.floor(r()*colors.length)],w:5+r()*5,hh:8+r()*8,delay:r()*1.2,dur:2+r()*1.4});
  }
  return out;
}
function Particles({parts}){
  return parts.map((p,i)=>p.k==="b"
    ?<span key={i} style={{position:"absolute",left:p.ox+"%",top:p.oy+"%",fontSize:p.sz,lineHeight:1,"--dx":p.dx+"px","--dy":p.dy+"px","--rot":p.rot+"deg",animation:"wmBurst "+p.dur+"s ease-out "+p.delay+"s both",willChange:"transform,opacity"}}>{p.ch}</span>
    :<span key={i} style={{position:"absolute",left:p.x+"%",top:0,width:p.w,height:p.hh,background:p.color,borderRadius:2,"--dx":p.dx+"px","--h":p.h+"px","--rot":p.rot+"deg",animation:"wmFall "+p.dur+"s ease-in "+p.delay+"s both",willChange:"transform,opacity"}}/>);
}
function Rays({tint,dur}){
  return<div style={{position:"absolute",left:"50%",top:"50%",width:560,height:560,marginLeft:-280,marginTop:-280,borderRadius:"50%",background:"repeating-conic-gradient("+tint+"55 0 7deg,transparent 7deg 22deg)",WebkitMaskImage:"radial-gradient(circle,#000 0,transparent 68%)",maskImage:"radial-gradient(circle,#000 0,transparent 68%)",animation:"wmRays 8s linear infinite, wmVig "+dur+"s ease-out forwards"}}/>;
}
function Vignette({tint,dark,dur}){
  return<div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 50%,"+tint+"33 0,rgba(0,0,0,"+dark+") 100%)",animation:"wmVig "+dur+"s ease-out forwards"}}/>;
}
function FxBanner({tint,dur,top,big,children,shake}){
  return(
    <div style={{position:"absolute",top,left:0,right:0,display:"flex",justifyContent:"center",padding:"0 10px"}}>
      <div style={{animation:"wmBannerPop "+dur+"s ease-out forwards"}}>
        <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(90deg,#1a1033,"+tint+"66,#1a1033)",border:"1.5px solid "+tint,boxShadow:"0 0 "+(big?26:16)+"px "+tint+"99",color:"#fff",padding:big?"9px 20px":"7px 16px",borderRadius:22,fontWeight:800,fontSize:big?15:13,textAlign:"center",display:"flex",alignItems:"center",gap:8,animation:shake?"wmShake .6s ease-in-out .3s 2":undefined}}>
          {children}
          {big&&<span style={{position:"absolute",top:0,bottom:0,width:"35%",background:"linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent)",animation:"wmShine 2.2s ease-in-out infinite"}}/>}
        </div>
      </div>
    </div>
  );
}

// ── ข้อมูลเอฟเฟกต์ของขวัญหนึ่งครั้ง (ระดับ/ท่า/อนุภาค/ความยาว) ──
function makeFx(giftId,d){
  const g=GIFT_BY_ID[giftId];
  if(!g)return null;
  const tier=giftTier(g),meta=TIER_META[tier],f=GIFT_FX[g.id]||{};
  return{
    id:Date.now()+Math.random(),gift:g.id,emoji:g.emoji,model:g.model||null,tier,
    motion:f.motion||"rise",p:f.p||[g.emoji,"✨"],tint:f.tint||meta.color,
    dur:meta.dur+(g.model?500:0),
    text:d&&d.author?(d.author+" "+(d.text||"")):"",
  };
}
// เล่นทันที (ใช้ในแชทส่วนตัว/กลุ่ม) — ในห้องเสียงใช้ useGiftStage เพื่อต่อคิว
function triggerGiftFx(giftId,setFx,d){
  const fx=makeFx(giftId,d);
  if(!fx)return;
  setFx(fx);
  sfx.gift(fx.tier,fx.gift,fx.dur/1000);
  setTimeout(()=>setFx(f=>(f&&f.id===fx.id?null:f)),fx.dur);
}
// คิวเอฟเฟกต์ในห้องเสียง: เล่นทีละชิ้นไม่ซ้อนกันจนหน่วง, ของเล็กถูกข้ามเมื่อคิวยาว, ของใหญ่แซงคิวของเล็ก
function useGiftStage(){
  const [fx,setFx]=useState(null);
  const q=useRef([]),busy=useRef(false),timer=useRef(null),alive=useRef(true);
  const next=useCallback(()=>{
    if(busy.current||!alive.current)return;
    const it=q.current.shift();
    if(!it)return;
    busy.current=true;
    const fast=q.current.length>=2&&it.tier<=3;
    it.dur=fast?Math.round(it.dur*.6):it.dur;
    setFx(it);
    sfx.gift(it.tier,it.gift,it.dur/1000);
    timer.current=setTimeout(()=>{busy.current=false;setFx(null);next();},it.dur);
  },[]);
  const push=useCallback((gid,d)=>{
    const it=makeFx(gid,d);
    if(!it)return;
    const L=q.current;
    if(it.tier<=2&&L.length>=3)return;            // คิวยาว: ข้ามของเล็ก (ยังเห็นในแชท)
    if(L.length>=6){const i=L.findIndex(x=>x.tier<=2);L.splice(i>=0?i:0,1);}
    if(it.tier>=4){const i=L.findIndex(x=>x.tier<=2);i>=0?L.splice(i,0,it):L.push(it);}   // ของใหญ่แซงของเล็ก
    else L.push(it);
    next();
  },[next]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(timer.current);q.current=[];busy.current=false;};},[]);
  return[fx,push];
}

function GiftFx({fx}){
  const parts=useMemo(()=>fx?buildParticles(fx):[],[fx&&fx.id]); // eslint-disable-line
  if(!fx)return null;
  const t=fx.tier,tint=fx.tint,dur=fx.dur/1000;
  const size=[0,72,96,120,150,190][t];
  const hero=fx.model
    ?<Model3D model={fx.model} size={t>=5?340:t>=4?280:260}/>
    :<div style={{fontSize:size,lineHeight:1,filter:t>=3?"drop-shadow(0 0 "+(8+t*4)+"px "+tint+")":undefined}}>{fx.emoji}</div>;
  return(
    <div key={fx.id} style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:20,contain:"layout paint"}}>
      {t>=4&&<Vignette tint={tint} dark={t>=5?.62:.42} dur={dur}/>}
      {t>=4&&<Rays tint={tint} dur={dur}/>}
      <div style={{position:"absolute",inset:0,animation:t>=5?"wmShake .7s ease-in-out .6s 2":undefined}}>
        {t>=3&&[0,.35,.7].slice(0,t>=5?3:2).map(d=><div key={d} style={{position:"absolute",left:"50%",top:"50%",width:200,height:200,borderRadius:"50%",border:"3px solid "+tint,animation:"wmRing 1.4s ease-out "+d+"s both"}}/>)}
        <Particles parts={parts}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{animation:"wmM_"+fx.motion+" "+dur+"s ease-out forwards"}}>{hero}</div>
        </div>
      </div>
      {t>=3&&fx.text&&(
        <FxBanner tint={tint} dur={dur} top={56} big={t>=5}>{t>=4&&<span>✨</span>}<span>{fx.text}</span>{t>=4&&<span>✨</span>}</FxBanner>
      )}
    </div>
  );
}

// ── เอฟเฟกต์ตอนเข้าห้องแบบพรีเมียม (ภาพเต็มห้อง + แบนเนอร์) — เสียงเล่นแยกด้วย sfx.entrance ──
function EntranceFx({fx}){
  const e=fx.e,t=e.tier,dur=(e.dur||4000)/1000,tint=TIER_META[t].color;
  const parts=useMemo(()=>{
    if(e.fx==="dragon"){
      const r=rng(Math.floor(fx.id*1000)),out=[];
      for(let i=0;i<(FX_LITE?10:18);i++)out.push({k:"b",ox:10+r()*80,oy:60+r()*25,ch:["🔥","✨","💨"][i%3],dx:(r()-.5)*60,dy:-(80+r()*170),rot:r()*60-30,sz:20+r()*16,delay:.3+r()*1.6,dur:1.4+r()*.8});
      return out;
    }
    const pool={mist:["✨","🔮","💜"],thunder:["⚡","✨","💙"],emperor:["✨","👑","💛","⭐"]}[e.fx]||["✨"];
    const colors={emperor:["#FBBF24","#FDE68A","#F59E0B","#FFF7D6"]}[e.fx];
    return buildParticles({id:fx.id,tier:Math.max(3,t),p:pool,colors});
  },[fx.id]); // eslint-disable-line
  const title=fx.name+" "+e.text;
  return(
    <div key={fx.id} style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:21,contain:"layout paint"}}>
      {t>=3&&<Vignette tint={e.fx==="dragon"?"#F97316":tint} dark={t>=5?.6:.4} dur={dur}/>}
      {t>=5&&<Rays tint="#FBBF24" dur={dur}/>}
      {e.fx==="mist"&&[0,1,2].map(i=><div key={i} style={{position:"absolute",left:(i*30-10)+"%",bottom:"-10%",width:"70%",height:"70%",borderRadius:"50%",background:"radial-gradient(circle,rgba(168,85,247,.6),transparent 65%)",animation:"wmFog "+dur+"s ease-in-out "+(i*.3)+"s both"}}/>)}
      <EntranceScene3D kind={e.fx} dur={e.dur||4000} fallback={
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:170,lineHeight:1,filter:"drop-shadow(0 0 24px "+tint+")",animation:({thunder:"wmBolt 1.3s ease-out both",dragon:"wmSweep "+(dur*.75)+"s ease-in-out .2s both",emperor:"wmCrown "+(dur*.8)+"s ease-out both"})[e.fx]}}>{e.emoji}</div>
        </div>}/>
      {e.fx==="thunder"&&[.25,.6,1,1.45].map(d=><div key={d} style={{position:"absolute",inset:0,background:"#DBEAFE",animation:"wmFlash1 .4s ease-out "+d+"s both"}}/>)}
      <Particles parts={parts}/>
      <FxBanner tint={tint} dur={dur} top={10} big={t>=4} shake={e.fx==="thunder"}>
        <span style={{fontSize:t>=4?24:20}}>{e.emoji}</span><span>{title}</span><span style={{fontSize:t>=4?24:20}}>{e.emoji}</span>
      </FxBanner>
    </div>
  );
}

// ── กรอบโปรไฟล์เคลื่อนไหว (พรีเมียม) ──
function AnimFrame({frame,size,children}){
  const pad=Math.max(2,Math.round(size*.07));
  const sp=Math.max(8,Math.round(size*.22));
  return(
    <div style={{position:"relative",padding:pad,borderRadius:"50%",display:"inline-block",lineHeight:0,boxShadow:frame.glow,"--g":frame.glowColor||"rgba(167,139,250,.7)",animation:frame.pulse?"wmGlow 2s ease-in-out infinite":undefined}}>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",overflow:"hidden"}}>
        <div style={{position:"absolute",left:"-30%",top:"-30%",width:"160%",height:"160%",background:"conic-gradient("+frame.conic+")",animation:"wmSpin "+(frame.speed||3)+"s linear infinite",willChange:"transform"}}/>
      </div>
      <div style={{position:"relative"}}>{children}</div>
      {frame.crown&&<span style={{position:"absolute",left:"50%",top:-Math.round(size*.3),fontSize:Math.max(12,Math.round(size*.38)),lineHeight:1,animation:"wmFloat 2s ease-in-out infinite"}}>👑</span>}
      {frame.sparkle&&[["-8%","10%",0],["86%","0%",.6],["80%","80%",1.2]].map(([l,tp,d],i)=><span key={i} style={{position:"absolute",left:l,top:tp,fontSize:sp,lineHeight:1,animation:"wmTwinkle 1.8s ease-in-out "+d+"s infinite"}}>✨</span>)}
    </div>
  );
}
// ── ป้ายพรีเมียม ──
function BadgePill({b,style}){
  return(
    <span style={{position:"relative",overflow:"hidden",display:"inline-flex",alignItems:"center",gap:3,marginLeft:4,padding:"1px 7px",borderRadius:20,background:b.bg,backgroundSize:b.anim?"200% 100%":undefined,animation:b.anim?"wmShimmer 3s linear infinite":undefined,boxShadow:b.glow,fontSize:10,fontWeight:800,letterSpacing:.5,color:"#fff",verticalAlign:"middle",lineHeight:1.5,textShadow:"0 1px 2px rgba(0,0,0,.45)",WebkitTextFillColor:"#fff",...style}}>
      <span style={{fontSize:11}}>{b.emoji}</span>{b.label}
      {b.shine&&<span style={{position:"absolute",top:0,bottom:0,width:"40%",background:"linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent)",animation:"wmShine 2.4s ease-in-out infinite"}}/>}
    </span>
  );
}
// ไอคอนเหรียญม่วง
function PCoin({size=14}){
  return<span style={{display:"inline-block",width:size,height:size,borderRadius:"50%",background:"radial-gradient(circle at 30% 30%,#F3E8FF,#A855F7 55%,#6B21A8)",boxShadow:"0 0 6px rgba(168,85,247,.7),inset 0 0 0 1.5px rgba(255,255,255,.35)",verticalAlign:"-2px"}}/>;
}
// </FX-ENGINE>

// ── เลือกของขวัญ (แตะเพื่อดูตัวอย่าง แล้วกดส่ง) ────────────────
function GiftPicker({user,to,onClose,onSent,ctx}){
  const users=useContext(UsersCtx);
  const coins=(users[getUid()]&&users[getUid()].coins)||0;
  const [sel,setSel]=useState(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const [pv,setPv]=useState(null);
  const [,setTick]=useState(0);
  useEffect(()=>{sfx.preload();const tm=setTimeout(()=>setTick(1),1800);return()=>clearTimeout(tm);},[]);
  async function send(){
    if(!sel||busy)return;
    setBusy(true);setMsg("");
    try{
      await sendGiftLogged(sel,user,to.uid,to.name,ctx);
      onSent&&onSent(sel);
      onClose();
      return;
    }catch(e){
      setMsg(e.message==="เหรียญไม่พอ"?"เหรียญไม่พอ — รับเหรียญฟรีรายวันได้ที่ปุ่ม 🪙 มุมขวาบน":"ส่งไม่ได้: "+(e.code||e.message));
    }
    setBusy(false);
  }
  const ok=sel?giftAvailable(sel):false;
  return(
    <div onClick={e=>{e.stopPropagation();onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:70,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",background:T.card,borderTop:"1px solid "+T.borderHi,borderRadius:"20px 20px 0 0",padding:"16px 16px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:800,color:T.text}}>🎁 ส่งของขวัญให้ {to.name}</div>
          <div style={{fontSize:13,color:T.yellow,fontWeight:700}}>🪙 {coins}</div>
        </div>
        {sel&&(
          <div style={{textAlign:"center",background:T.surface,border:"1px solid "+T.border,borderRadius:16,padding:"10px 10px 14px",marginBottom:12}}>
            {sel.model
              ? <div style={{display:"flex",justifyContent:"center"}}><Model3D model={sel.model} size={170}/></div>
              : <div style={{fontSize:64,padding:"12px 0"}}>{sel.emoji}</div>}
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{sel.name}</div>
            <div style={{fontSize:11,color:TIER_META[giftTier(sel)].color,fontWeight:700,marginTop:2}}>ระดับ {TIER_META[giftTier(sel)].name}</div>
            <div style={{fontSize:10,color:T.muted,marginTop:2}}>🔊 เสียง: {sfx.source("gift-"+sel.id)==="file"?"ไฟล์จริง":"สังเคราะห์ (ยังไม่มีไฟล์ gift-"+sel.id+".mp3)"}</div>
            {sel.event&&<div style={{fontSize:11,color:ok?T.green:T.yellow,marginTop:3}}>{ok?"🎉 เทศกาล"+sel.event.label+" เปิดอยู่ถึง "+fmtD(sel.event.to):"🔒 เปิดช่วงเทศกาล"+sel.event.label+" ("+fmtD(sel.event.from)+" – "+fmtD(sel.event.to)+")"}</div>}
            <div style={{marginTop:10,display:"flex",gap:8,justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
              <Btn onClick={()=>triggerGiftFx(sel.id,setPv)} v="outline" sz="md">▶ ดูแอนิเมชัน</Btn>
              {ok
                ? <Btn onClick={send} v="primary" sz="md">{busy?"กำลังส่ง...":"ส่ง 🪙 "+sel.price}</Btn>
                : <div style={{fontSize:12,color:T.muted}}>ยังส่งไม่ได้ในตอนนี้</div>}
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {GIFTS.map(g=>{
            const av=giftAvailable(g);
            return(
              <button key={g.id} onClick={()=>{setSel(g);setMsg("");}} style={{position:"relative",background:sel&&sel.id===g.id?T.brand+"33":T.surface,border:"1px solid "+(sel&&sel.id===g.id?T.borderHi:(coins>=g.price?T.border:"rgba(244,63,94,.3)")),borderRadius:14,padding:"10px 2px",cursor:"pointer",opacity:av&&coins>=g.price?1:.55,fontFamily:"inherit"}}>
                {g.model&&<span style={{position:"absolute",top:3,right:4,fontSize:9,fontWeight:800,color:T.brand2,background:T.brand+"33",borderRadius:6,padding:"0 4px"}}>3D</span>}
                <span style={{position:"absolute",left:10,right:10,bottom:3,height:2,borderRadius:2,background:TIER_META[giftTier(g)].color}}/>
                <div style={{fontSize:30}}>{g.emoji}</div>
                <div style={{fontSize:11,color:T.text,marginTop:2}}>{g.name}</div>
                <div style={{fontSize:11,color:av?T.yellow:T.muted,fontWeight:700}}>{av?"🪙 "+g.price:"🔒 "+g.event.label}</div>
              </button>
            );
          })}
        </div>
        {msg&&<div style={{fontSize:12,color:T.red,marginTop:10,textAlign:"center"}}>{msg}</div>}
        <div style={{marginTop:12,textAlign:"center"}}><Btn onClick={onClose} v="ghost" sz="sm">ปิด</Btn></div>
      </div>
      {pv&&<div style={{position:"fixed",inset:0,zIndex:80,pointerEvents:"none"}}><GiftFx fx={pv}/></div>}
    </div>
  );
}

// ── หน้าจอฝั่งเหรียญม่วง: พรีเมียม + กระเป๋า/แลก/ประวัติ ────────────────
function useRun(){
  const [msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const run=async(fn,okMsg)=>{
    if(busy)return;
    setBusy(true);setMsg("");
    try{const r=await fn();setMsg(typeof okMsg==="function"?okMsg(r):okMsg||"");}
    catch(e){setMsg("⚠️ "+(e.message||e.code));}
    setBusy(false);
  };
  return[msg,busy,run];
}
function useLedger(){
  const [rows,setRows]=useState(null);
  useEffect(()=>{
    const q=query(collection(db,"ledger"),where("uid","==",getUid()),limit(300));
    return onSnapshot(q,sn=>{
      const a=sn.docs.map(d=>({id:d.id,...d.data({serverTimestamps:"estimate"})}));
      const ms=x=>x.t&&x.t.toMillis?x.t.toMillis():0;
      a.sort((x,y)=>ms(y)-ms(x));
      setRows(a);
    },e=>{console.warn("ledger",e);setRows([]);});
  },[]);
  return rows;
}
const LEDGER_ICON={buy_aura:"✨",welcome:"👋",daily:"🎁",buy_gold:"🛍️",gift_sent:"📤",exchange:"🔁",buy_premium:"💜",reward:"🏆",purchase:"💳",refund:"↩️"};
function fmtT(ts){
  const ms=ts&&ts.toMillis?ts.toMillis():Date.now();
  return new Date(ms).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}

function PremiumTab({me,user}){
  const [msg,busy,run]=useRun();
  useEffect(()=>{sfx.preload();},[]);
  const inv=Array.isArray(me.inventory)?me.inventory:[];
  const [pv,setPv]=useState(null);
  const groups=[["frame","🖼️ กรอบโปรไฟล์เคลื่อนไหว"],["nameColor","🎨 สีชื่อพิเศษ (ไหลสี/เรืองแสง)"],["badge","🏅 ป้ายพิเศษตามระดับ"],["entrance","✨ เอฟเฟกต์เข้าห้อง (ภาพ + เสียง)"]];
  function playPreview(i){
    const e=ENTRANCES[i.key],id=Date.now()+Math.random();
    setPv({id,name:user.name||"คุณ",e});
    sfx.entrance(e.fx,(e.dur||4000)/1000);
    setTimeout(()=>setPv(f=>(f&&f.id===id?null:f)),e.dur||4000);
  }
  function preview(i){
    const box={width:62,display:"flex",justifyContent:"center",alignItems:"center",flexShrink:0};
    if(i.type==="frame")return<div style={box}><AnimFrame frame={FRAMES[i.key]} size={38}><div style={{width:38,height:38,borderRadius:"50%",background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:T.brand2,fontWeight:700}}>{user.init}</div></AnimFrame></div>;
    if(i.type==="nameColor")return<div style={{...box,fontSize:15,fontWeight:800}}><span style={NAME_COLORS[i.key]}>ชื่อ</span></div>;
    if(i.type==="badge")return<div style={box}><BadgePill b={PREMIUM_BADGES[i.key]} style={{marginLeft:0}}/></div>;
    return<div style={{...box,fontSize:30}}>{ENTRANCES[i.key].emoji}</div>;
  }
  return(
    <div style={{padding:"10px 14px 16px"}}>
      <div style={{fontSize:12,color:T.sub,lineHeight:1.6}}>ไอเทมพรีเมียมซื้อด้วย <PCoin/> เหรียญม่วง (แลกจากเหรียญทอง {PURPLE_RATE} = 1 ม่วง ที่แท็บ "กระเป๋า") ซื้อแล้วเป็นของคุณถาวร กดใส่/ถอดได้ — ยิ่งระดับสูง ยิ่งอลังการ</div>
      {msg&&<div style={{fontSize:12,color:msg.startsWith("⚠️")?T.red:T.green,margin:"8px 0 0",lineHeight:1.5}}>{msg}</div>}
      {groups.map(([ty,label])=>(
        <div key={ty} style={{marginTop:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.text,marginBottom:2}}>{label}</div>
          {PURPLE_ITEMS.filter(i=>i.type===ty).map(i=>{
            const owned=inv.includes(i.id),on=me[i.type]===i.key,tm=TIER_META[i.tier];
            return(
              <div key={i.id} style={{display:"flex",alignItems:"center",gap:10,padding:"16px 2px 10px",borderBottom:"1px solid "+T.border}}>
                {preview(i)}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{i.name}<span style={{fontSize:10,marginLeft:6,background:tm.color+"22",color:tm.color,borderRadius:20,padding:"1px 7px",fontWeight:800}}>{tm.name}</span></div>
                  <div style={{fontSize:11,color:"#C084FC",marginTop:2,display:"flex",alignItems:"center",gap:4}}><PCoin size={12}/> {i.price}</div>
                </div>
                {ty==="entrance"&&<Btn onClick={()=>playPreview(i)} v="ghost" sz="sm">▶ ดู</Btn>}
                {owned
                  ? <Btn onClick={()=>run(()=>equipItem(i,!on),on?"ถอดแล้ว":"ใส่แล้ว ✨")} v={on?"outline":"primary"} sz="sm">{on?"ถอด":"ใส่"}</Btn>
                  : <Btn onClick={()=>run(async()=>{await buyPremium(i);sfx.buy();},"ซื้อแล้ว! กด ใส่ ได้เลย ✨")} v="ghost" sz="sm">{busy?"...":"ซื้อ"}</Btn>}
              </div>
            );
          })}
        </div>
      ))}
      {pv&&<div style={{position:"fixed",inset:0,zIndex:95,pointerEvents:"none"}}><EntranceFx fx={pv}/></div>}
    </div>
  );
}

function WalletTab({me}){
  const [msg,busy,run]=useRun();
  const [n,setN]=useState(1);
  const rows=useLedger();
  const gold=me.coins||0,pe=me.purple||0,pb=me.purpleBought||0;
  const used=me.purpleEx&&me.purpleEx.day===todayBkk()?(me.purpleEx.n||0):0;
  const left=Math.max(0,PURPLE_DAILY_LIMIT-used);
  const nn=Math.max(1,Math.min(n,left||1));
  const value=me.giftValue||0;
  const claimable=Math.floor(value/RECEIVE_REWARD_PER)-(me.purpleRecvClaimed||0);
  const card={flex:1,background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:"10px 8px",textAlign:"center",minWidth:0};
  const sec={marginTop:14,background:T.surface,border:"1px solid "+T.border,borderRadius:14,padding:"12px 12px"};
  return(
    <div style={{padding:"12px 14px 16px"}}>
      <div style={{display:"flex",gap:8}}>
        <div style={card}><div style={{fontSize:10,color:T.muted}}>เหรียญทอง</div><div style={{fontSize:18,fontWeight:800,color:T.yellow}}>🪙 {gold}</div></div>
        <div style={card}><div style={{fontSize:10,color:T.muted}}>ม่วง (แลก/รางวัล)</div><div style={{fontSize:18,fontWeight:800,color:"#C084FC",display:"flex",justifyContent:"center",alignItems:"center",gap:5}}><PCoin size={16}/>{pe}</div></div>
        <div style={card}><div style={{fontSize:10,color:T.muted}}>ม่วง (ซื้อเงินจริง)</div><div style={{fontSize:18,fontWeight:800,color:"#C084FC",display:"flex",justifyContent:"center",alignItems:"center",gap:5}}><PCoin size={16}/>{pb}</div></div>
      </div>

      <div style={sec}>
        <div style={{fontSize:14,fontWeight:800,color:T.text}}>🔁 แลกเหรียญทองเป็นเหรียญม่วง</div>
        <div style={{fontSize:11,color:T.muted,marginTop:3,lineHeight:1.6}}>อัตรา 🪙 {PURPLE_RATE} = <PCoin size={12}/> 1 • แลกได้วันละไม่เกิน {PURPLE_DAILY_LIMIT} เหรียญม่วง (วันนี้แลกแล้ว {used}) • สำหรับบัญชี Google</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Btn onClick={()=>setN(Math.max(1,nn-1))} v="ghost" sz="sm">−</Btn>
            <div style={{fontSize:16,fontWeight:800,color:"#C084FC",minWidth:50,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><PCoin size={15}/>{nn}</div>
            <Btn onClick={()=>setN(Math.min(Math.max(1,left),nn+1))} v="ghost" sz="sm">+</Btn>
          </div>
          <Btn onClick={()=>run(()=>exchangeGoldToPurple(nn),r=>"แลกสำเร็จ! 🪙 -"+(-r.gold)+" → ม่วง +"+r.purple)} v="primary" sz="sm">{busy?"กำลังแลก...":"แลก (ใช้ 🪙 "+(nn*PURPLE_RATE)+")"}</Btn>
        </div>
      </div>

      <div style={sec}>
        <div style={{fontSize:14,fontWeight:800,color:T.text}}>🏆 รางวัลจากของขวัญที่ได้รับ</div>
        <div style={{fontSize:11,color:T.muted,marginTop:3,lineHeight:1.6}}>มูลค่าของขวัญที่คุณได้รับรวม 🪙 {value} — ทุก {RECEIVE_REWARD_PER} เหรียญทอง ได้เหรียญม่วง 1</div>
        <div style={{marginTop:10}}>
          <Btn onClick={()=>run(claimReceiveReward,r=>"รับรางวัลแล้ว! ม่วง +"+r.purple)} v={claimable>=1?"primary":"ghost"} sz="sm">{claimable>=1?"รับรางวัล ม่วง +"+claimable:"ยังไม่ถึงเกณฑ์"}</Btn>
        </div>
      </div>

      <div style={{...sec,opacity:.85}}>
        <div style={{fontSize:14,fontWeight:800,color:T.text}}>💳 ซื้อเหรียญม่วงด้วยเงินจริง <span style={{fontSize:10,background:T.yellow+"22",color:T.yellow,borderRadius:20,padding:"1px 8px"}}>เร็วๆ นี้</span></div>
        <div style={{fontSize:11,color:T.muted,marginTop:3,lineHeight:1.6}}>เหรียญม่วงที่ซื้อจะถูกเก็บแยกจากเหรียญม่วงที่ได้จากการแลก/รางวัล เพื่อให้กำหนดเงื่อนไขการใช้งานและการคืนเงินได้ชัดเจน</div>
      </div>

      {msg&&<div style={{fontSize:12,color:msg.startsWith("⚠️")?T.red:T.green,marginTop:10,lineHeight:1.5}}>{msg}</div>}

      <div style={{marginTop:16,fontSize:14,fontWeight:800,color:T.text}}>📜 ประวัติธุรกรรม</div>
      {rows===null&&<div style={{fontSize:12,color:T.muted,padding:"10px 0"}}>กำลังโหลด...</div>}
      {rows&&rows.length===0&&<div style={{fontSize:12,color:T.muted,padding:"10px 0"}}>ยังไม่มีรายการ</div>}
      {rows&&rows.slice(0,40).map(r=>(
        <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 2px",borderBottom:"1px solid "+T.border}}>
          <div style={{fontSize:20,width:28,textAlign:"center"}}>{LEDGER_ICON[r.kind]||"•"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label||r.kind}</div>
            <div style={{fontSize:10,color:T.muted}}>{fmtT(r.t)}{r.after?" • คงเหลือ 🪙 "+r.after.gold+" / ม่วง "+(r.after.purple+r.after.purpleBought):""}</div>
          </div>
          <div style={{textAlign:"right",fontSize:12,fontWeight:800,lineHeight:1.5}}>
            {!!r.gold&&<div style={{color:r.gold>0?T.green:T.red}}>🪙 {r.gold>0?"+":""}{r.gold}</div>}
            {!!r.purple&&<div style={{color:r.purple>0?T.green:T.red}}>ม่วง {r.purple>0?"+":""}{r.purple}</div>}
            {!!r.purpleBought&&<div style={{color:r.purpleBought>0?T.green:T.red}}>ม่วง(ซื้อ) {r.purpleBought>0?"+":""}{r.purpleBought}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ร้านค้า + กระเป๋าเหรียญ + รับเหรียญรายวัน ────────────────
function ShopModal({user,onClose}){
  const users=useContext(UsersCtx);
  const me=users[getUid()]||{};
  const coins=me.coins||0;
  const inv=Array.isArray(me.inventory)?me.inventory:[];
  const [tab,setTab]=useState("frame");
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const claimed=me.lastDaily===todayBkk();

  async function run(fn,okMsg){
    if(busy)return;
    setBusy(true);setMsg("");
    try{const r=await fn();setMsg(typeof okMsg==="function"?okMsg(r):okMsg||"");}
    catch(e){setMsg("⚠️ "+(e.message||e.code));}
    setBusy(false);
  }

  const tabs=[["frame","🖼️ กรอบ"],["nameColor","🎨 สีชื่อ"],["badge","🏅 ป้าย"],["entrance","✨ เข้าห้อง"],["premium","💜 พรีเมียม"],["wallet","📜 กระเป๋า"]];
  const list=ITEMS.filter(i=>i.type===tab);

  function preview(i){
    if(i.type==="frame")return<div style={{width:44,height:44,borderRadius:"50%",padding:4,background:FRAMES[i.key].bg,boxShadow:FRAMES[i.key].glow}}><div style={{width:"100%",height:"100%",borderRadius:"50%",background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.brand2,fontWeight:700}}>{user.init}</div></div>;
    if(i.type==="nameColor")return<div style={{fontSize:14,fontWeight:800,width:44,textAlign:"center"}}><span style={NAME_COLORS[i.key]}>ชื่อ</span></div>;
    if(i.type==="entrance")return<div style={{fontSize:30,width:44,textAlign:"center"}}>{ENTRANCES[i.key].emoji}</div>;
    return<div style={{fontSize:30,width:44,textAlign:"center"}}>{BADGES[i.key]}</div>;
  }

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 12px"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,background:T.card,border:"1px solid "+T.borderHi,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"16px 16px 12px",background:"linear-gradient(135deg,"+T.brand+"33,"+T.card+")"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:17,fontWeight:800,color:T.text}}>🛍️ ร้านค้า</div>
            <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"rgba(0,0,0,.4)",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:14,flexWrap:"wrap"}}>
              <div style={{fontSize:24,fontWeight:800,color:T.yellow}}>🪙 {coins}</div>
              <div style={{fontSize:20,fontWeight:800,color:"#C084FC",display:"flex",alignItems:"center",gap:6}}><PCoin size={18}/>{(me.purple||0)+(me.purpleBought||0)}</div>
            </div>
            <Btn onClick={()=>run(claimDailyLogged,r=>"🎉 ได้ +"+r.bonus+" เหรียญ (ติดต่อกัน "+r.streak+" วัน)"+(r.unlocked?" ปลดล็อกไอเทมพิเศษ 🔥 กรอบและป้ายเปลวไฟ!":""))} v={claimed?"ghost":"primary"} sz="sm">{claimed?"รับแล้ววันนี้ ✓ (ติดต่อกัน "+(me.streak||1)+" วัน)":"🎁 รับเหรียญรายวัน +"+DAILY_COINS}</Btn>
          </div>
          <div style={{fontSize:11,color:T.muted,marginTop:8}}>กลับมารับทุกวัน ครบ 7 วันติดกันได้โบนัส +50 และไอเทมสุดพิเศษ 🔥</div>
          {msg&&<div style={{fontSize:12,color:msg.startsWith("⚠️")?T.red:T.green,marginTop:8,lineHeight:1.5}}>{msg}</div>}
        </div>
        <div style={{display:"flex",overflowX:"auto",borderTop:"1px solid "+T.border,borderBottom:"1px solid "+T.border}}>
          {tabs.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:"1 0 auto",padding:"10px 10px",border:"none",borderBottom:"2px solid "+(tab===k?T.brand:"transparent"),background:"transparent",color:tab===k?T.brand2:T.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        {tab==="premium"&&<PremiumTab me={me} user={user}/>}
        {tab==="wallet"&&<WalletTab me={me}/>}
        {tab!=="premium"&&tab!=="wallet"&&<div style={{padding:"10px 14px 16px"}}>
          {list.map(i=>{
            const owned=inv.includes(i.id);
            const on=me[i.type]===i.key;
            return(
              <div key={i.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 4px",borderBottom:"1px solid "+T.border}}>
                {preview(i)}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.text}}>{i.name}{i.special&&<span style={{fontSize:10,marginLeft:6,background:T.yellow+"22",color:T.yellow,borderRadius:20,padding:"1px 7px"}}>สุดพิเศษ</span>}</div>
                  <div style={{fontSize:11,color:T.muted}}>{i.special?("ปลดล็อก: "+i.special):("🪙 "+i.price)}</div>
                </div>
                {owned
                  ? <Btn onClick={()=>run(()=>equipItem(i,!on),on?"ถอดแล้ว":"ใส่แล้ว ✨")} v={on?"outline":"primary"} sz="sm">{on?"ถอด":"ใส่"}</Btn>
                  : i.special
                    ? <span style={{fontSize:11,color:T.muted}}>🔒</span>
                    : <Btn onClick={()=>run(()=>buyItemLogged(i),"ซื้อแล้ว! กด ใส่ ได้เลย")} v="ghost" sz="sm">ซื้อ</Btn>}
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}

// ── ตั้งชื่อครั้งแรกหลังล็อกอิน Google ───────────────────
function NamePrompt({user,onDone}){
  const [name,setName]=useState(user.name||"");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  async function ok(){
    const n=name.trim().slice(0,30);
    if(!n){setErr("ใส่ชื่อก่อนนะ");return;}
    setBusy(true);
    const init=n.slice(0,2).toUpperCase();
    try{
      await saveMyProfile({name:n,init,isGuest:false,photo:user.photo||"",nameSet:true});
      onDone({...user,name:n,init,needName:false});
    }catch(e){
      console.error(e);
      setErr("บันทึกไม่ได้ ("+(e.code||e.message)+")");
      setBusy(false);
    }
  }
  return(
    <div style={{minHeight:"100dvh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <div style={{width:"100%",maxWidth:360,background:T.surface,border:"1px solid "+T.borderHi,borderRadius:20,padding:"26px 22px",textAlign:"center"}}>
        <div style={{fontSize:34,marginBottom:8}}>👋</div>
        <div style={{fontSize:18,fontWeight:800,color:T.text}}>ตั้งชื่อที่ใช้แสดง</div>
        <div style={{fontSize:13,color:T.sub,marginTop:8,lineHeight:1.6}}>โปรไฟล์ของคุณผูกกับบัญชี<br/><b style={{color:T.brand2}}>{user.email}</b><br/>ส่วนชื่อที่คนอื่นเห็น ตั้งเองได้ (แก้ภายหลังได้)</div>
        <div style={{marginTop:16}}>
          <Input value={name} onChange={e=>{setName(e.target.value);setErr("");}} placeholder="ชื่อที่ต้องการแสดง..." onKeyDown={e=>e.key==="Enter"&&ok()}/>
        </div>
        {err&&<div style={{fontSize:12,color:T.red,marginTop:8}}>{err}</div>}
        <div style={{marginTop:14}}><Btn onClick={ok} v="primary" sz="md" full>{busy?"กำลังบันทึก...":"ตกลง ✨"}</Btn></div>
      </div>
    </div>
  );
}

// ── ดูโปรไฟล์คนอื่น (รูปปก รูปโปรไฟล์ โพสต์) ───────────────
function ProfileModal({uid,posts,user,onClose,onChat}){
  const users=useContext(UsersCtx);
  const u=users[uid]||{};
  const [cover,setCover]=useState("");
  const [giftOpen,setGiftOpen]=useState(false);
  const [note,setNote]=useState("");
  useEffect(()=>{
    setCover("");
    return onSnapshot(doc(db,"covers",uid),sn=>{setCover(sn.exists()?(sn.data().cover||""):"");},()=>{});
  },[uid]);
  const list=posts.filter(p=>p.authorUid===uid&&(p.privacy||"public")==="public");
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 12px"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,background:T.card,border:"1px solid "+T.borderHi,borderRadius:20,overflow:"hidden"}}>
        <div style={{height:120,background:cover?`url(${cover}) center/cover`:T.brandGrad,position:"relative"}}>
          <button onClick={onClose} style={{position:"absolute",top:10,right:10,width:30,height:30,borderRadius:"50%",border:"none",background:"rgba(0,0,0,.5)",color:"#fff",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>✕</button>
        </div>
        <div style={{padding:"0 18px 18px",position:"relative"}}>
          <div style={{position:"absolute",top:-34,left:18,border:"4px solid "+T.card,borderRadius:"50%",background:T.card}}>
            <Av uid={uid} init={u.init||"??"} bg={T.surface} tc={T.brand2} size={64}/>
          </div>
          <div style={{paddingTop:40}}>
            <div style={{fontSize:19,fontWeight:800,color:T.text}}><Nm uid={uid} name={u.name}/>
              {u.isGuest&&<span style={{fontSize:11,marginLeft:8,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"2px 8px",fontWeight:600}}>👋 Guest</span>}
            </div>
            <div style={{fontSize:13,color:T.sub,marginTop:5,lineHeight:1.6}}>{u.bio||"ชอบคุยเล่น • ฟังเพื่อนใหม่ 💜"}</div>
            {u.mood&&<div style={{marginTop:8}}><span style={{background:T.brand+"22",color:T.brand2,borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,border:"1px solid "+T.borderHi}}>✦ {u.mood}</span></div>}
            <div style={{marginTop:10,fontSize:12,color:T.muted}}>🎁 ได้รับของขวัญ {u.giftCount||0} ชิ้น</div>
            {uid!==getUid()&&<div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn onClick={()=>onChat(uid)} v="primary" sz="sm">💬 แชทส่วนตัว</Btn>
              {!user.isGuest&&<Btn onClick={()=>{setNote("");setGiftOpen(true);}} v="outline" sz="sm">🎁 ส่งของขวัญ</Btn>}
            </div>}
            {note&&<div style={{marginTop:8,fontSize:12,color:T.green}}>{note}</div>}
            {giftOpen&&<GiftPicker user={user} to={{uid,name:u.name||"เพื่อน"}} onClose={()=>setGiftOpen(false)} onSent={g=>setNote("ส่ง "+g.emoji+" "+g.name+" ให้แล้ว ✅ (ไปดูในแชทส่วนตัว)")}/>}
          </div>
          <div style={{marginTop:16,paddingTop:12,borderTop:"1px solid "+T.border}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:10}}>โพสต์ ({list.length})</div>
            {list.length===0&&<div style={{fontSize:13,color:T.muted,textAlign:"center",padding:"10px 0"}}>ยังไม่มีโพสต์สาธารณะ</div>}
            {list.map(pp=>(
              <div key={pp.id} style={{borderBottom:"1px solid "+T.border,paddingBottom:10,marginBottom:10}}>
                {pp.images?.length>0&&<div style={{display:"flex",gap:5,marginBottom:6,flexWrap:"wrap"}}>{pp.images.slice(0,4).map((src,i)=>(pp.mediaTypes&&pp.mediaTypes[i]==="video")?null:<img key={i} src={src} alt="" style={{width:56,height:56,borderRadius:10,objectFit:"cover",border:"1px solid "+T.border}}/>)}</div>}
                {pp.content&&<div style={{fontSize:13,color:T.sub,lineHeight:1.6}}>{pp.content}</div>}
                <div style={{fontSize:11,color:T.muted,marginTop:4}}>{pp.createdAt?timeAgo(pp.createdAt):"เมื่อกี้"} • ❤️{pp.likes||0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Privacy ───────────────────────────────────────────────
function PrivacyPage(){
  const [s,setS]=useState({postDef:"public",whoSee:"public",whoCmt:"everyone",whoMsg:"everyone",showMood:true,showOnline:true,showLast:true,friendList:"friends"});
  const set=(k,v)=>setS(p=>({...p,[k]:v}));
  const pv=[{v:"public",l:"🌐 สาธารณะ"},{v:"friends",l:"👥 เพื่อนเท่านั้น"},{v:"only_me",l:"🔒 ฉันเท่านั้น"}];
  const ev=[{v:"everyone",l:"ทุกคน"},{v:"friends",l:"เพื่อนเท่านั้น"},{v:"none",l:"ไม่มีใคร"}];
  const Row=({label,desc,k,type,opts})=>(
    <div style={{padding:"13px 0",borderBottom:"1px solid "+T.border,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div><div style={{fontSize:14,color:T.text,fontWeight:500}}>{label}</div>{desc&&<div style={{fontSize:12,color:T.muted,marginTop:2}}>{desc}</div>}</div>
      {type==="toggle"
        ?<div onClick={()=>set(k,!s[k])} style={{width:46,height:26,borderRadius:13,cursor:"pointer",background:s[k]?T.brand:"#333",position:"relative",transition:"background .2s",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:s[k]?23:3,transition:"left .22s",boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/></div>
        :<select value={s[k]} onChange={e=>set(k,e.target.value)} style={{padding:"7px 10px",borderRadius:10,border:"1px solid "+T.border,background:T.surface,color:T.sub,fontSize:13,outline:"none",flexShrink:0,fontFamily:"inherit",cursor:"pointer"}}>{opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
      }
    </div>
  );
  const Sec=({title,children})=><Card style={{marginBottom:12}}><div style={{padding:"4px 18px"}}><div style={{fontSize:11,fontWeight:700,color:T.muted,padding:"12px 0 4px",textTransform:"uppercase",letterSpacing:1.2}}>{title}</div>{children}</div></Card>;
  return(
    <div>
      <Card style={{marginBottom:14}}><div style={{padding:"18px 20px"}}><div style={{fontSize:17,fontWeight:800,color:T.text}}>ความเป็นส่วนตัว 🔒</div><div style={{fontSize:13,color:T.muted,marginTop:4}}>ปรับว่าใครเห็นอะไรได้บ้าง</div></div></Card>
      <Sec title="โพสต์"><Row label="โพสต์เริ่มต้น" desc="ค่าเริ่มต้น" k="postDef" type="select" opts={pv}/><Row label="ใครเห็นโพสต์" k="whoSee" type="select" opts={pv}/><Row label="ใครเม้นได้" k="whoCmt" type="select" opts={ev}/></Sec>
      <Sec title="โปรไฟล์"><Row label="แสดง Mood" k="showMood" type="toggle"/><Row label="แสดงสถานะออนไลน์" k="showOnline" type="toggle"/><Row label="แสดงเวลาออนไลน์ล่าสุด" k="showLast" type="toggle"/><Row label="ใครเห็นรายชื่อเพื่อน" k="friendList" type="select" opts={pv}/></Sec>
      <Sec title="ข้อความ"><Row label="ใครส่งข้อความได้" k="whoMsg" type="select" opts={ev}/></Sec>
      <Card><div style={{padding:"18px 20px"}}><div style={{fontSize:14,fontWeight:700,color:T.red,marginBottom:10}}>โซนอันตราย ⚠️</div><Btn v="danger" sz="md" full>ปิดบัญชีชั่วคราว</Btn></div></Card>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────
const TABS=[{key:"feed",icon:"🏠",label:"ฟีด"},{key:"chat",icon:"💬",label:"แชท"},{key:"voice",icon:"🎙️",label:"เสียง"},{key:"profile",icon:"👤",label:"โปรไฟล์"},{key:"privacy",icon:"🔒",label:"ส่วนตัว"}];

export default function App(){
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  const [page,setPage]=useState("feed");
  const [posts,setPosts]=useState([]);
  const [users,setUsers]=useState({});
  const [viewUid,setViewUid]=useState(null);
  const [dmTarget,setDmTarget]=useState(null);
  const [shopOpen,setShopOpen]=useState(false);

  // ติดตามสถานะล็อกอิน Google จริง (Firebase Auth) + ผู้เยี่ยมชม
  useEffect(()=>{
    return onAuthStateChanged(auth,async fb=>{
      if(fb){
        ls.set("uid",fb.uid);
        let saved={};
        try{const sn=await getDoc(doc(db,"users",fb.uid));if(sn.exists())saved=sn.data();}catch(e){console.error("load profile",e);}
        const name=(saved.name&&String(saved.name).trim())||fb.displayName||(fb.email?fb.email.split("@")[0]:"ผู้ใช้");
        let cv="";
        try{const cs=await getDoc(doc(db,"covers",fb.uid));if(cs.exists())cv=cs.data().cover||"";}catch(e){}
        ls.set("coverImg",cv);
        ls.set("avatarImg",saved.avatar||"");
        ls.set("bio",saved.bio||"ชอบคุยเล่น • ฟังเพื่อนใหม่ 💜");
        ls.set("mood",saved.mood||"สบายดี 😊");
        const u={name,email:fb.email||"",isGuest:false,init:name.slice(0,2).toUpperCase(),provider:"google",uid:fb.uid,photo:fb.photoURL||"",needName:!saved.nameSet};
        ls.set("user",u);
        setUser(u);
      }else{
        const l=ls.get("user",null);
        setUser(l&&l.isGuest?l:null);
      }
      setAuthReady(true);
    });
  },[]);

  // บันทึกโปรไฟล์สาธารณะ (ชื่อ/รูป) ให้คนอื่นเห็น
  useEffect(()=>{
    if(!user||user.needName)return;
    saveMyProfile({name:user.name,init:user.init,isGuest:!!user.isGuest,photo:user.photo||""}).catch(e=>console.error("saveProfile",e));
  },[user&&user.name,user&&user.isGuest,user&&user.needName]); // eslint-disable-line

  // เหรียญต้อนรับสำหรับผู้ใช้ Google
  useEffect(()=>{
    if(!user||user.isGuest||user.needName)return;
    ensureWallet().then(g=>{if(g)logLedger({kind:"welcome",label:"เหรียญต้อนรับ",gold:WELCOME_COINS});}).catch(e=>console.error("wallet",e));
  },[user&&user.isGuest,user&&user.needName,user&&user.uid]); // eslint-disable-line

  useEffect(()=>{
    if(!user)return;
    return onSnapshot(collection(db,"users"),snap=>{
      const m={};snap.docs.forEach(d=>{m[d.id]=d.data();});setUsers(m);
    },e=>console.error("users",e));
  },[user&&user.name]); // eslint-disable-line

  useEffect(()=>{
    if(!user)return;
    const q=query(collection(db,"posts"),orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>{setPosts(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return unsub;
  },[user&&user.name]); // eslint-disable-line

  async function handleLogout(){
    const uid=getUid();
    const wasGoogle=user&&!user.isGuest;
    // ปิดห้องที่ตัวเองเป็น host
    try {
      const snap = await getDocs(collection(db,"voiceRooms"));
      const myRooms = snap.docs.filter(d=>{const x=d.data();return x.hostUid?x.hostUid===uid:x.hostInit===user.init;});
      for(const r of myRooms){ await deleteDoc(doc(db,"voiceRooms",r.id)); }
    } catch(e){}
    ls.del("user");
    if(wasGoogle){
      ["uid","avatarImg","bio","mood","coverImg"].forEach(k=>ls.del(k));
      try{await signOut(auth);}catch(e){}
    }
    setUser(null);setPage("feed");
  }

  if(!authReady)return<div style={{minHeight:"100dvh",background:T.bg,color:T.sub,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>💜 กำลังโหลด...</div>;
  if(!user)return<AuthPage onLogin={setUser}/>;
  if(user.needName)return<NamePrompt user={user} onDone={u=>{ls.set("user",u);setUser(u);}}/>;
  const openProfile=uid=>{ if(!uid)return; if(uid===getUid()){setPage("profile");return;} setViewUid(uid); };

  return(
    <UsersCtx.Provider value={users}>
    <ProfileCtx.Provider value={openProfile}>
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100dvh",background:T.bg,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{background:${T.bg};margin:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}input,textarea,select{color-scheme:dark}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes mic-wave{0%{height:3px}100%{height:14px}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes giftfly{0%{transform:scale(.3) translateY(60px);opacity:0}25%{transform:scale(1.25) translateY(0);opacity:1}75%{transform:scale(1) translateY(-20px);opacity:1}100%{transform:scale(.9) translateY(-130px);opacity:0}}@keyframes giftpop{0%{transform:scale(.2);opacity:0}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}@keyframes entryslide{0%{transform:translateY(-34px) scale(.8);opacity:0}14%{transform:translateY(0) scale(1.08);opacity:1}22%{transform:scale(1)}85%{opacity:1}100%{transform:translateY(-8px);opacity:0}}`}</style>
      <div style={{background:T.glass,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid "+T.border,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:30}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,borderRadius:9,background:T.brandGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💜</div>
          <span style={{fontSize:18,fontWeight:800,background:T.brandGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-.5}}>Warmly</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          {!user.isGuest&&<button onClick={()=>setShopOpen(true)} style={{border:"1px solid rgba(245,158,11,.4)",background:"rgba(245,158,11,.12)",color:T.yellow,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🪙 {(users[getUid()]&&users[getUid()].coins)||0}<span style={{marginLeft:7,color:"#C084FC",display:"inline-flex",alignItems:"center",gap:3}}><PCoin size={11}/>{((users[getUid()]||{}).purple||0)+((users[getUid()]||{}).purpleBought||0)}</span></button>}
          <Nm uid={getUid()} name={user.name} own style={{fontSize:13,color:T.sub,fontWeight:500}}/>
          {user.isGuest&&<span style={{fontSize:10,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"2px 7px",fontWeight:700}}>Guest</span>}
          <button onClick={handleLogout} style={{border:"1px solid "+T.border,borderRadius:9,background:"transparent",color:T.muted,cursor:"pointer",padding:"4px 9px",fontSize:11,fontFamily:"inherit"}}>ออก</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:page==="chat"?"hidden":"auto",display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,padding:page==="chat"?"0":"14px 12px 80px"}}>
          {page==="feed"    &&<FeedPage user={user}/>}
          {page==="chat"    &&<ChatPage user={user} openPeer={dmTarget} onPeerOpened={()=>setDmTarget(null)}/>}
          <div style={{display:page==="voice"?"block":"none"}}><VoiceErrorBoundary><VoiceRoomsPage user={user}/></VoiceErrorBoundary></div>
          {page==="profile" &&<ProfilePage user={user} posts={posts} onUpdateName={n=>{const u={...user,name:n,init:n.slice(0,2).toUpperCase()};ls.set("user",u);setUser(u);}}/>}
          {page==="privacy" &&<PrivacyPage/>}
        </div>
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.glass,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:"1px solid "+T.border,display:"flex",zIndex:30,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setPage(t.key)} style={{flex:1,padding:"10px 4px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
            <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:page===t.key?700:400,color:page===t.key?T.brand2:T.muted}}>{t.label}</span>
            {page===t.key&&<div style={{width:16,height:2,borderRadius:2,background:T.brandGrad,marginTop:2}}/>}
          </button>
        ))}
      </div>
    {shopOpen&&!user.isGuest&&<ShopModal user={user} onClose={()=>setShopOpen(false)}/>}
    {viewUid&&<ProfileModal uid={viewUid} posts={posts} user={user} onClose={()=>setViewUid(null)} onChat={id=>{setViewUid(null);setDmTarget(id);setPage("chat");}}/>}
    </div>
    </ProfileCtx.Provider>
    </UsersCtx.Provider>
  );
}
