import { useState, useRef, useEffect, useCallback, Component, createContext, useContext } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, doc, updateDoc, increment, serverTimestamp, deleteDoc, getDocs, setDoc, getDoc, where, limit, arrayUnion, runTransaction } from "firebase/firestore";

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
];
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
};
const NAME_COLORS={
  gold:{color:"#FBBF24"},
  pink:{color:"#F472B6"},
  cyan:{color:"#22D3EE"},
  rainbow:{background:"linear-gradient(90deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent"},
};
const BADGES={star:"🌟",dj:"🎧",crown:"👑",fire:"🔥"};
const ENTRANCES={
  sparkle:{emoji:"✨",text:"เข้าห้องมาแล้ว",bg:"linear-gradient(90deg,#7C5CFC,#EC4899)"},
  rainbow:{emoji:"🌈",text:"มาพร้อมสายรุ้ง",bg:"linear-gradient(90deg,#f43f5e,#f59e0b,#10b981,#3b82f6,#a855f7)"},
  royal:{emoji:"👑",text:"เสด็จเข้าห้อง",bg:"linear-gradient(90deg,#B45309,#FBBF24,#B45309)"},
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

function todayBkk(offsetDays=0){
  return new Date(Date.now()+7*3600*1000+offsetDays*86400000).toISOString().slice(0,10);
}

// เหรียญต้อนรับ (ครั้งแรก)
async function ensureWallet(){
  const ref=doc(db,"users",getUid());
  await runTransaction(db,async tx=>{
    const sn=await tx.get(ref);
    if(!sn.exists()||sn.data().coins===undefined){
      tx.set(ref,{coins:WELCOME_COINS,inventory:[],giftCount:0},{merge:true});
    }
  });
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
    tx.set(toRef,{giftCount:increment(1)},{merge:true});
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
      ? <div style={{padding:Math.max(2,Math.round(size*.07)),borderRadius:"50%",background:frame.bg,boxShadow:frame.glow,display:"inline-block",lineHeight:0}}>{core}</div>
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
  return <span style={style}><span style={col||undefined}>{nm||"ผู้ใช้"}</span>{badge&&<span style={{marginLeft:4}}>{badge}</span>}</span>;
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
            if(ch.type==="added"){const d=ch.doc.data();if(d.gift)onGift(d.gift);}
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
          <div key={m.id} style={{textAlign:"center",fontSize:12,color:T.sub,padding:"4px 0"}}><span style={{fontSize:20}}>{(GIFT_BY_ID[m.gift]||{}).emoji||"🎁"}</span> <Nm uid={m.uid} name={m.author}/> {m.text}</div>
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
  const [roomFx,setRoomFx]=useState(null);
  const [loading,setLoading]=useState(true);

  const myUid=getUid();
  const _users=useContext(UsersCtx);
  const [entryFx,setEntryFx]=useState(null);
  const prevKeysRef=useRef(null);
  const seenRef=useRef(false);
  const voice=useVoice();
  const {connected,micOn,speaking,mics,needAudio,error:voiceError,toggleMic,enableAudio}=voice;

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
      if(prevKeysRef.current.includes(k)||isMeM(m))return;
      const u=m.uid?_users[m.uid]:null;
      const e=u&&u.entrance&&ENTRANCES[u.entrance];
      if(e){
        const id=Date.now()+Math.random();
        setEntryFx({id,name:m.name,e});
        setTimeout(()=>setEntryFx(f=>(f&&f.id===id?null:f)),3300);
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
      {inRoom&&(
        <Card style={{marginBottom:16,border:"1px solid "+T.borderHi,position:"relative"}}>
          <GiftFx fx={roomFx}/>
          {entryFx&&(
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
                return(
                  <div key={key+i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,position:"relative"}}>
                    {isHost&&!isMe&&(
                      <div style={{position:"absolute",top:-10,right:-12,display:"flex",gap:3,zIndex:2}}>
                        <button onClick={()=>hostToggleMic(key)} style={{width:26,height:26,borderRadius:"50%",background:m.mic!==false?"#1A3A2A":"#2A2A1A",border:"1px solid "+T.border,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>{m.mic!==false?"🎙":"🔇"}</button>
                        <button onClick={()=>kick(key)} style={{width:26,height:26,borderRadius:"50%",background:T.redBg,border:"1px solid rgba(244,63,94,.5)",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",color:T.red,fontFamily:"inherit"}}>🚫</button>
                      </div>
                    )}
                    <div onClick={()=>{if(!isMe&&!user.isGuest&&m.uid)setGiftTo({uid:m.uid,name:m.name});}} style={{cursor:(!isMe&&!user.isGuest&&m.uid)?"pointer":"default",padding:3,borderRadius:"50%",
                      border:"2.5px solid "+(isSpeaking?T.green:T.border),
                      boxShadow:isSpeaking?"0 0 16px rgba(16,185,129,.5)":"none",
                      transition:"all .2s"}}>
                      <Av uid={m.uid} init={m.init} bg={T.card} tc={T.brand2} grad={isMe} isSelf={isMe} size={48}/>
                    </div>
                    <div style={{fontSize:11,color:T.brand2,fontWeight:700,maxWidth:56,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isMe?"คุณ":m.name}</div>
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
          <div style={{padding:"0 16px 16px",borderTop:"1px solid "+T.border}}><RoomChat roomId={inRoomId} user={user} onGift={gid=>triggerGiftFx(gid,setRoomFx)}/></div>
        </Card>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:800,color:T.text}}>ห้องเสียง 🎙️</div>
        {!user.isGuest&&<Btn onClick={()=>setCreating(!creating)} v={creating?"primary":"outline"} sz="sm">+ ห้องใหม่</Btn>}
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
            if(d.gift)triggerGiftFx(d.gift,setFx);
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

  return g;
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
        if(!obj.userData.noSpin)obj.rotation.y=t*1.1;
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

// เอฟเฟกต์ของขวัญลอยขึ้นจอ (อีโมจิ หรือโมเดล 3 มิติ)
function triggerGiftFx(giftId,setFx){
  const g=GIFT_BY_ID[giftId];
  if(!g)return;
  const id=Date.now()+Math.random();
  setFx({id,emoji:g.emoji,model:g.model||null});
  setTimeout(()=>setFx(f=>(f&&f.id===id?null:f)),g.model?3200:2400);
}
function GiftFx({fx}){
  if(!fx)return null;
  return(
    <div key={fx.id} style={{position:"absolute",inset:0,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",zIndex:20}}>
      <div style={{animation:"giftfly "+(fx.model?"3s":"2.2s")+" ease-out forwards"}}>
        {fx.model?<Model3D model={fx.model} size={260}/>:<div style={{fontSize:110}}>{fx.emoji}</div>}
      </div>
    </div>
  );
}

// ── เลือกของขวัญ (แตะเพื่อดูตัวอย่าง แล้วกดส่ง) ────────────────
function GiftPicker({user,to,onClose,onSent,ctx}){
  const users=useContext(UsersCtx);
  const coins=(users[getUid()]&&users[getUid()].coins)||0;
  const [sel,setSel]=useState(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  async function send(){
    if(!sel||busy)return;
    setBusy(true);setMsg("");
    try{
      await sendGift(sel,user,to.uid,to.name,ctx);
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
            {sel.event&&<div style={{fontSize:11,color:ok?T.green:T.yellow,marginTop:3}}>{ok?"🎉 เทศกาล"+sel.event.label+" เปิดอยู่ถึง "+fmtD(sel.event.to):"🔒 เปิดช่วงเทศกาล"+sel.event.label+" ("+fmtD(sel.event.from)+" – "+fmtD(sel.event.to)+")"}</div>}
            <div style={{marginTop:10}}>
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

  const tabs=[["frame","🖼️ กรอบ"],["nameColor","🎨 สีชื่อ"],["badge","🏅 ป้าย"],["entrance","✨ เข้าห้อง"]];
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
            <div style={{fontSize:24,fontWeight:800,color:T.yellow}}>🪙 {coins}</div>
            <Btn onClick={()=>run(claimDaily,r=>"🎉 ได้ +"+r.bonus+" เหรียญ (ติดต่อกัน "+r.streak+" วัน)"+(r.unlocked?" ปลดล็อกไอเทมพิเศษ 🔥 กรอบและป้ายเปลวไฟ!":""))} v={claimed?"ghost":"primary"} sz="sm">{claimed?"รับแล้ววันนี้ ✓ (ติดต่อกัน "+(me.streak||1)+" วัน)":"🎁 รับเหรียญรายวัน +"+DAILY_COINS}</Btn>
          </div>
          <div style={{fontSize:11,color:T.muted,marginTop:8}}>กลับมารับทุกวัน ครบ 7 วันติดกันได้โบนัส +50 และไอเทมสุดพิเศษ 🔥</div>
          {msg&&<div style={{fontSize:12,color:msg.startsWith("⚠️")?T.red:T.green,marginTop:8,lineHeight:1.5}}>{msg}</div>}
        </div>
        <div style={{display:"flex",borderTop:"1px solid "+T.border,borderBottom:"1px solid "+T.border}}>
          {tabs.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"10px 4px",border:"none",borderBottom:"2px solid "+(tab===k?T.brand:"transparent"),background:"transparent",color:tab===k?T.brand2:T.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>
        <div style={{padding:"10px 14px 16px"}}>
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
                    : <Btn onClick={()=>run(()=>buyItem(i),"ซื้อแล้ว! กด ใส่ ได้เลย")} v="ghost" sz="sm">ซื้อ</Btn>}
              </div>
            );
          })}
        </div>
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
    ensureWallet().catch(e=>console.error("wallet",e));
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
          {!user.isGuest&&<button onClick={()=>setShopOpen(true)} style={{border:"1px solid rgba(245,158,11,.4)",background:"rgba(245,158,11,.12)",color:T.yellow,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🪙 {(users[getUid()]&&users[getUid()].coins)||0}</button>}
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
