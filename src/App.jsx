import { useState, useRef, useEffect, useCallback, Component, createContext, useContext } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, doc, updateDoc, increment, serverTimestamp, deleteDoc, getDocs, setDoc, getDoc, where, limit } from "firebase/firestore";

// ── Firebase Config ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBlruTPdcfWPMgJkQufyhtZnPsT_mbDvKs",
  authDomain: "warmly-app-9e8d6.firebaseapp.com",
  projectId: "warmly-app-9e8d6",
  storageBucket: "warmly-app-9e8d6.firebasestorage.app",
  messagingSenderId: "340884704147",
  appId: "1:340884704147:web:86ab4e1a8aceab0daeb666"
};

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
  // ถ้าเป็น avatar ของตัวเอง (isSelf) ให้ดึงรูปจาก localStorage
  const selfImg = (_u&&(_u.avatar||_u.photo)) || (isSelf ? ls.get("avatarImg","") : "");
  return(<div style={{position:"relative",flexShrink:0}}>
    {selfImg
      ? <img src={selfImg} alt={init} referrerPolicy="no-referrer" style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:"2px solid "+(grad?T.brand:T.border)}}/>
      : <div style={{width:size,height:size,borderRadius:"50%",background:grad?T.brandGrad:(bg||T.card),color:grad?"#fff":(tc||T.brand2),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.32,fontWeight:700,boxShadow:grad?"0 0 16px rgba(124,92,252,.5)":"none"}}>{init}</div>
    }
    {online&&<div style={{position:"absolute",bottom:1,right:1,width:Math.max(8,size*.2),height:Math.max(8,size*.2),borderRadius:"50%",background:T.green,border:"2px solid "+T.bg}}/>}
  </div>);
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

function ImgGrid({images,mediaTypes}){
  if(!images?.length)return null;
  const n=images.length;
  return(<div style={{display:"grid",gap:2,margin:"10px 0",borderRadius:14,overflow:"hidden",gridTemplateColumns:n===1?"1fr":"1fr 1fr",maxHeight:n===1?380:260}}>
    {images.slice(0,4).map((src,i)=>{
      const isVid=mediaTypes?.[i]==="video"||src?.startsWith("data:video");
      return(
        <div key={i} style={{overflow:"hidden",position:"relative",gridColumn:n===3&&i===0?"1/3":undefined,background:"#000",minHeight:130}}>
          {isVid
            ? <video src={src} controls style={{width:"100%",height:"100%",objectFit:"cover",display:"block",minHeight:130}} preload="metadata"/>
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
function RoomChat({roomId,user}){
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const endRef=useRef();

  useEffect(()=>{
    if(!roomId)return;
    const q=query(collection(db,"voiceRooms",roomId,"chat"),orderBy("t","asc"));
    const unsub=onSnapshot(q,
      snap=>setMsgs(snap.docs.map(d=>({id:d.id,...d.data()}))),
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
        {msgs.map(m=>(
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
  const [loading,setLoading]=useState(true);

  const myUid=getUid();
  const seenRef=useRef(false);
  const voice=useVoice();
  const {connected,micOn,speaking,mics,needAudio,error:voiceError,toggleMic,enableAudio}=voice;

  const inRoom=rooms.find(r=>r.id===inRoomId);
  const memberList=inRoom&&Array.isArray(inRoom.members)?inRoom.members:[];
  const isMeM=m=>m.uid?m.uid===myUid:m.init===user.init;
  const me=memberList.find(isMeM);
  const isHost=!!inRoom&&(inRoom.hostUid?inRoom.hostUid===myUid:inRoom.hostInit===user.init);

  // ถูกเตะ / ห้องถูกปิด → ออกจากห้องฝั่งเรา
  useEffect(()=>{
    if(!inRoomId||loading)return;
    if(me){seenRef.current=true;return;}
    if(seenRef.current){
      seenRef.current=false;
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
    const members=memberList.filter(m=>(m.uid||m.init)!==key);
    await updateDoc(doc(db,"voiceRooms",inRoomId),{members});
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
        <Card style={{marginBottom:16,border:"1px solid "+T.borderHi}}>
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
                      <div style={{position:"absolute",top:-6,right:-4,display:"flex",gap:2,zIndex:2}}>
                        <button onClick={()=>hostToggleMic(key)} style={{width:16,height:16,borderRadius:"50%",background:m.mic!==false?"#1A3A2A":"#2A2A1A",border:"1px solid "+T.border,cursor:"pointer",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>{m.mic!==false?"🎙":"🔇"}</button>
                        <button onClick={()=>kick(key)} style={{width:16,height:16,borderRadius:"50%",background:T.redBg,border:"1px solid rgba(244,63,94,.3)",cursor:"pointer",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",color:T.red,fontFamily:"inherit"}}>✕</button>
                      </div>
                    )}
                    <div style={{padding:3,borderRadius:"50%",
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
          <div style={{padding:"0 16px 16px",borderTop:"1px solid "+T.border}}><RoomChat roomId={inRoomId} user={user}/></div>
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
          <Av uid={p.authorUid} init={p.authorInit||p.author?.slice(0,2)||"??"} bg={T.card} tc={T.brand2} size={42}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>{(p.authorUid&&users[p.authorUid]&&users[p.authorUid].name)||p.author}</div>
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
  const fileRef=useRef();

  function handleFiles(e){
    Array.from(e.target.files).forEach(f=>{
      if(f.type.startsWith("video/")){
        // ตรวจสอบขนาดไฟล์วิดีโอ (สูงสุด 30MB สำหรับ 30 วินาที)
        if(f.size > 30*1024*1024){setErr("วิดีโอใหญ่เกิน 30MB กรุณาบีบอัดก่อน");return;}
        const vid=document.createElement("video");
        vid.preload="metadata";
        vid.onloadedmetadata=()=>{
          URL.revokeObjectURL(vid.src);
          if(vid.duration>30){setErr("วิดีโอต้องไม่เกิน 30 วินาที (ของคุณ: "+Math.round(vid.duration)+"วิ)");return;}
          const r=new FileReader();
          r.onload=ev=>setImages(p=>[...p,{src:ev.target.result,name:f.name,isVideo:true,duration:Math.round(vid.duration)}]);
          r.readAsDataURL(f);
        };
        vid.src=URL.createObjectURL(f);
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
    setPosting(true);
    try{
      const postName = user.name;
      const postInit = postName.slice(0,2).toUpperCase();
      await addDoc(collection(db,"posts"),{
        author:postName, authorInit:postInit,
        authorUid:getUid(),
        content:text.trim(), mood, privacy,
        images:images.map(i=>i.src),
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
          <Btn onClick={submit} v="primary" sz="sm" style={{marginLeft:"auto"}} disabled={posting}>{posting?"กำลังโพสต์...":"โพสต์"}</Btn>
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
function BubbleChat({path,user,showNames,placeholder="พิมพ์ข้อความ...",onSent}){
  const users=useContext(UsersCtx);
  const myUid=getUid();
  const pathKey=path.join("/");
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState("");
  const [img,setImg]=useState(null);
  const [err,setErr]=useState("");
  const fileRef=useRef();const endRef=useRef();

  useEffect(()=>{
    setMsgs([]);setErr("");
    const q=query(collection(db,...path),orderBy("t","desc"),limit(150));
    return onSnapshot(q,snap=>{
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
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 12px",display:"flex",flexDirection:"column",gap:6}}>
        {msgs.length===0&&!err&&<div style={{textAlign:"center",color:T.muted,fontSize:13,padding:"30px 0"}}>ยังไม่มีข้อความ — ทักทายกันได้เลย 👋</div>}
        {msgs.map((m,i)=>{
          const me=m.uid===myUid;
          const prev=msgs[i-1];
          const head=!me&&showNames&&(!prev||prev.uid!==m.uid);
          const nm=(m.uid&&users[m.uid]&&users[m.uid].name)||m.author||"ผู้ใช้";
          const ms=m.t&&m.t.toMillis?m.t.toMillis():0;
          return(
            <div key={m.id} style={{display:"flex",gap:8,alignItems:"flex-end",flexDirection:me?"row-reverse":"row"}}>
              {!me&&<Av uid={m.uid} init={(m.init||"??").slice(0,2)} bg={T.card} tc={T.brand2} size={28}/>}
              <div style={{maxWidth:"74%",display:"flex",flexDirection:"column",alignItems:me?"flex-end":"flex-start"}}>
                {head&&<div style={{fontSize:11,fontWeight:700,color:T.brand2,margin:"0 0 3px 4px"}}>{nm}</div>}
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
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={placeholder}
            style={{flex:1,minWidth:0,border:"1px solid "+T.border,borderRadius:20,padding:"9px 16px",fontSize:14,color:T.text,background:T.card,outline:"none",fontFamily:"inherit"}}
            onFocus={e=>e.target.style.borderColor=T.borderHi} onBlur={e=>e.target.style.borderColor=T.border}/>
          <button onClick={send} style={{width:38,height:38,borderRadius:"50%",background:T.brandGrad,border:"none",cursor:"pointer",color:"#fff",flexShrink:0,fontSize:17,fontFamily:"inherit"}}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── Chat: ห้องรวม + แชทส่วนตัว ────────────────────────────
function ChatPage({user}){
  const users=useContext(UsersCtx);
  const myUid=getUid();
  const [tab,setTab]=useState("group");
  const [peer,setPeer]=useState(null);
  const [convs,setConvs]=useState([]);
  const [search,setSearch]=useState("");

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
            🌐 ห้องแชทรวมของทุกคนใน Warmly • สมาชิก {memberCount} คน
          </div>
          <BubbleChat path={["groupChat"]} user={user} showNames placeholder="คุยกับทุกคน..."/>
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
          <BubbleChat path={["dms",pairId(peer),"messages"]} user={user} placeholder={"ข้อความถึง "+(pu.name||"เพื่อน")+"..."} onSent={onDmSent}/>
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
  const myPosts=posts.filter(p=>p.authorUid?p.authorUid===getUid():(p.author===user.name||p.author===displayName));
  const saveBio=()=>{setBio(bioInput);ls.set("bio",bioInput);saveMyProfile({bio:bioInput}).catch(()=>{});setEditing(false);};
  const saveMood=m=>{setMood(m);ls.set("mood",m);saveMyProfile({mood:m}).catch(()=>{});setShowMP(false);};
  const saveCover=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setCoverImg(ev.target.result);ls.set("coverImg",ev.target.result);};r.readAsDataURL(f);e.target.value="";};
  const saveAvatar=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;compressImage(f,160,0.72).then(src=>{setAvatarImg(src);ls.set("avatarImg",src);return saveMyProfile({avatar:src});}).catch(err=>console.error("avatar",err));};
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
                  :<div style={{fontSize:19,fontWeight:800,color:T.text,display:"flex",alignItems:"center",gap:8}}>{displayName}{!user.isGuest&&<span onClick={()=>{setEditName(true);setNameInput(displayName);}} style={{fontSize:13,cursor:"pointer",color:T.muted}}>✏️</span>}</div>
                }
                {user.isGuest&&<span style={{fontSize:11,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"2px 8px",fontWeight:600}}>👋 Guest</span>}
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
              {[["48","เพื่อน"],[String(myPosts.length),"โพสต์"],["—","เข้าชม"]].map(([n,l])=>(
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

  // ติดตามสถานะล็อกอิน Google จริง (Firebase Auth) + ผู้เยี่ยมชม
  useEffect(()=>{
    return onAuthStateChanged(auth,async fb=>{
      if(fb){
        ls.set("uid",fb.uid);
        let saved={};
        try{const sn=await getDoc(doc(db,"users",fb.uid));if(sn.exists())saved=sn.data();}catch(e){console.error("load profile",e);}
        const name=(saved.name&&String(saved.name).trim())||fb.displayName||(fb.email?fb.email.split("@")[0]:"ผู้ใช้");
        ls.set("avatarImg",saved.avatar||"");
        ls.set("bio",saved.bio||"ชอบคุยเล่น • ฟังเพื่อนใหม่ 💜");
        ls.set("mood",saved.mood||"สบายดี 😊");
        const u={name,email:fb.email||"",isGuest:false,init:name.slice(0,2).toUpperCase(),provider:"google",uid:fb.uid,photo:fb.photoURL||""};
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
    if(!user)return;
    saveMyProfile({name:user.name,init:user.init,isGuest:!!user.isGuest,photo:user.photo||""}).catch(e=>console.error("saveProfile",e));
  },[user&&user.name,user&&user.isGuest]); // eslint-disable-line

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

  return(
    <UsersCtx.Provider value={users}>
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",minHeight:"100dvh",background:T.bg,display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}body{background:${T.bg};margin:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}input,textarea,select{color-scheme:dark}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes mic-wave{0%{height:3px}100%{height:14px}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{background:T.glass,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid "+T.border,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:30}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:30,height:30,borderRadius:9,background:T.brandGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💜</div>
          <span style={{fontSize:18,fontWeight:800,background:T.brandGrad,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-.5}}>Warmly</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:13,color:T.sub,fontWeight:500}}>{user.name}</span>
          {user.isGuest&&<span style={{fontSize:10,background:"rgba(245,158,11,.15)",color:T.yellow,borderRadius:20,padding:"2px 7px",fontWeight:700}}>Guest</span>}
          <button onClick={handleLogout} style={{border:"1px solid "+T.border,borderRadius:9,background:"transparent",color:T.muted,cursor:"pointer",padding:"4px 9px",fontSize:11,fontFamily:"inherit"}}>ออก</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:page==="chat"?"hidden":"auto",display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,padding:page==="chat"?"0":"14px 12px 80px"}}>
          {page==="feed"    &&<FeedPage user={user}/>}
          {page==="chat"    &&<ChatPage user={user}/>}
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
    </div>
    </UsersCtx.Provider>
  );
}
