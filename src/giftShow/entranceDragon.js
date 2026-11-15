// Gift Show — เอฟเฟกต์เข้าห้อง "มังกรไฟ" ที่ใช้ตัวมังกรของของขวัญ (giftsPlus/dragon.js)
// เสียงและความยาวเหมือนเดิม: public/sounds/entrance-dragon.mp3 · 5.2 วิ
//
// ท่าใหม่: มังกรกระพือปีกบินตรงเข้าหาจอคนดู → เบรกลอยตัวหน้าจอ อ้าปาก → พ่นไฟใส่จอ → ทะยานขึ้นข้ามหัวออกไป
//   0–2.7    โผล่จากที่ไกล กระพือปีกหนัก ๆ บินเข้าหาจอ ส่ายซ้ายขวาเป็นคลื่นเล็กน้อย (ตัวเอียงตามโค้ง)
//            ← เสียงช่วงแรกดังต่อเนื่อง พีคราว 2.2–2.55 วิ
//   2.7–3.3  เบรก ลอยตัวกลางจอ กระพือถี่ เงยหัวสูดลม ค่อย ๆ อ้าปาก (ยังไม่มีไฟ)   ← เสียงเบาลง (2.85–3.3)
//   3.3–4.35 อ้าปากกว้าง พ่นไฟพุ่งใส่จอ โน้มตัวไปข้างหน้า จอสั่น               ← เสียงคำราม (3.35–4.35)
//   4.35–5.2 หุบปาก ทะยานขึ้นบินข้ามหัวผู้ชมออกด้านบนจอ
//
// คืนค่ารูปแบบเดียวกับเดิมทุกอย่าง: { group, cam, light, update(t) } → App.jsx ไม่ต้องแก้

const BASE_DUR = 5.2;                   // ความยาวที่ออกแบบไว้ (ถ้าจริงต่างไป จะยืด/หดให้เองตามสัดส่วน)
export const FACE_CAM = -Math.PI / 2;   // หัวมังกรอยู่ทาง +X ของโมเดล · หมุนรอบแกน Y −90° = หันเข้ากล้อง (+Z)
const T_TURN = 2.55, T_SETTLE = 2.95, T_LEAVE = 4.35, T_GONE = 4.75;   // ช่วง "หันหน้าเข้าจอเต็มที่"
export const T_OPEN = 2.85, T_FIRE_ON = 3.3, T_FIRE_FULL = 3.45, T_FIRE_OFF = 4.3, T_FIRE_END = 4.6;
const CRUISE_PITCH = -0.52;             // ก้มลำตัวให้ขนานทิศบิน (ท่าโมเดลเดิมเงยราว 30°)
const BANK_GAIN = 0.3, BANK_MAX = 0.75; // เอียงเข้าโค้งตามความเร็วการเลี้ยว
const DRAGON_SIZE = 1.5;                // ขยายตัวมังกร (1 = ขนาดเท่าโชว์ของขวัญ)
const DESK_CAM = [0, 0.9, 10.6], MOUTH_H = 1.4;   // กล้องมาตรฐาน (จอคอม) · ความสูงปากโดยประมาณตอนยืนผงาด

// จุดผ่าน [เวลา, x, y, z] — กล้องอยู่ที่ z≈+10.6 มองไปทาง −Z
export const KEYS = [
  [0.0, -2.5, 4.5, -32.0],   // จุดเล็ก ๆ ไกลลิบ
  [1.0, 1.8, 3.4, -19.0],    // ส่ายเป็นคลื่นช้า ๆ ขณะบินเข้ามา
  [2.0, -0.9, 2.0, -7.5],
  [2.7, 0.0, 1.25, -0.8],    // เข้ามาใกล้จอ เริ่มเบรก
  [3.3, 0.0, 1.05, 0.6],     // ลอยตัวหน้าจอ
  [3.8, 0.0, 0.95, 2.0],     // โน้มเข้ามาพ่นไฟใส่จอ
  [4.35, 0.0, 1.1, 1.7],
  [4.8, 0.05, 3.4, 4.2],     // ทะยานขึ้นข้ามหัวผู้ชม
  [5.2, 0.0, 6.8, 7.0],
];

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
const ramp = (ts, a, b) => smooth((ts - a) / (b - a));
const wrap = d => { d %= Math.PI * 2; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const mixAngle = (a, b, k) => a + wrap(b - a) * k;

// ความชันของแต่ละจุด (Catmull-Rom แบบเวลาไม่เท่ากัน) → ความเร็วต่อเนื่อง ไม่กระตุกที่จุดผ่าน
const TAN = KEYS.map((k, i) => {
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.min(KEYS.length - 1, i + 1)], dt = b[0] - a[0] || 1;
  return [1, 2, 3].map(j => (b[j] - a[j]) / dt);
});
// ตำแหน่ง + ความเร็ว ณ เวลา ts (Hermite)
export function pathAt(ts) {
  ts = Math.min(Math.max(ts, 0), BASE_DUR);
  let i = 0;
  while (i < KEYS.length - 2 && ts > KEYS[i + 1][0]) i++;
  const A = KEYS[i], B = KEYS[i + 1], h = B[0] - A[0], u = (ts - A[0]) / h;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  const p = [], v = [];
  for (let j = 0; j < 3; j++) {
    const a = A[j + 1], b = B[j + 1], ma = TAN[i][j] * h, mb = TAN[i + 1][j] * h;
    p.push(h00 * a + h10 * ma + h01 * b + h11 * mb);
    v.push((d00 * a + d10 * ma + d01 * b + d11 * mb) / h);
  }
  return { p, v };
}
// ทิศหัวตาม "ทิศบินเฉลี่ย" ช่วง ±0.3 วิ (ถ่วงน้ำหนักแบบระฆัง) → หัวหมุนเนียนต่อเนื่อง
const SM_OFF = [-0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const SM_W = SM_OFF.map(d => Math.exp(-0.5 * (d / 0.13) * (d / 0.13)));
const pathYaw = ts => {
  let x = 0, z = 0;
  SM_OFF.forEach((d, i) => { const { v } = pathAt(Math.min(Math.max(ts + d, 0), BASE_DUR)); x += v[0] * SM_W[i]; z += v[2] * SM_W[i]; });
  return Math.atan2(-z, x);
};

// น้ำหนัก "หันหน้าเข้าจอ" 0..1
export const faceWeight = ts => (ts < T_TURN ? 0 : ts < T_SETTLE ? ramp(ts, T_TURN, T_SETTLE) : ts < T_LEAVE ? 1 : 1 - ramp(ts, T_LEAVE, T_GONE));

// ปาก: ปิดตอนบินเข้ามา → ค่อย ๆ อ้า (สูดลม) → อ้ากว้างสุดตอนพ่นไฟ (สั่นนิด ๆ ตามแรงคำราม) → หุบ
export const breathAt = ts => {
  const open = 0.55 * ramp(ts, T_OPEN, T_FIRE_ON) + 0.7 * ramp(ts, T_FIRE_ON - 0.05, T_FIRE_FULL);
  const flicker = 0.08 * Math.sin(ts * 23) * ramp(ts, T_FIRE_ON, T_FIRE_FULL);
  return (open + flicker) * (1 - ramp(ts, T_FIRE_OFF, T_FIRE_END));
};
// ความแรงของไฟ 0..1: ไม่มีไฟเลยตอนบินเข้ามา · เต็มที่ช่วงเสียงคำราม
export const fireAt = ts => ramp(ts, T_FIRE_ON - 0.02, T_FIRE_FULL) * (1 - ramp(ts, T_FIRE_OFF, T_FIRE_END));

// ปีก: จังหวะกระพือ (เรเดียน/วิ) · บินเข้ามา = หนักและช้า (≈1 ครั้ง/วิ) · เบรกลอยตัว = ถี่ขึ้น · พ่นไฟ = กางค้างกระพือเบา
const FLAP = [[0, 6.2, 0.78], [2.5, 6.2, 0.78], [2.9, 8.6, 0.85], [3.3, 8.6, 0.85], [3.5, 6.0, 0.5], [4.3, 6.0, 0.5], [4.6, 8.4, 0.9], [5.2, 8.4, 0.9]];
const flapAt = (ts, j) => { for (let i = 0; i < FLAP.length - 1; i++) { const a = FLAP[i], b = FLAP[i + 1]; if (ts <= b[0]) return mix(a[j], b[j], smooth((ts - a[0]) / (b[0] - a[0]))); } return FLAP[FLAP.length - 1][j]; };
const PHI_DT = 0.01, PHI_TABLE = [0];
for (let i = 1; i <= Math.round(BASE_DUR / PHI_DT) + 1; i++) PHI_TABLE.push(PHI_TABLE[i - 1] + flapAt((i - .5) * PHI_DT, 1) * PHI_DT);
const PHI0 = 1.2;                       // เริ่มที่ปีกกำลังยกขึ้น
export const flapPhase = ts => { const x = Math.min(Math.max(ts, 0), BASE_DUR) / PHI_DT, i = Math.floor(x); return PHI0 + mix(PHI_TABLE[i], PHI_TABLE[i + 1], x - i); };
export const flapAmp = ts => flapAt(Math.min(Math.max(ts, 0), BASE_DUR), 2);

// ท่าทั้งหมด ณ เวลา ts: ตำแหน่ง · หัน (yaw) · ก้ม/เงย (pitch) · เอียง (bank)
export function flightAt(ts) {
  const { p, v } = pathAt(ts), F = faceWeight(ts);
  const yaw = mixAngle(pathYaw(ts), FACE_CAM, F);
  const hs = Math.hypot(v[0], v[2]);
  const climb = Math.max(-0.45, Math.min(0.45, Math.atan2(v[1], Math.max(hs, 0.5)) * 0.7));
  // ลอยตัวหน้าจอ: เงยหัวสูดลมก่อนพ่น (inhale) แล้วโน้มตัวพุ่งไปข้างหน้าตอนพ่นไฟ (lunge)
  const inhale = ramp(ts, T_OPEN - 0.1, T_FIRE_ON - 0.05) * (1 - ramp(ts, T_FIRE_ON - 0.05, T_FIRE_FULL + 0.05));
  const lunge = fireAt(ts);
  const pitch = mix(CRUISE_PITCH + climb, 0.06 + 0.2 * inhale - 0.47 * lunge, F);   // พ่นไฟ = ก้มหัวเล็งตรงเข้ากล้อง
  // เอียงเข้าโค้ง: เลี้ยวซ้าย (yaw เพิ่ม) → ปีกซ้ายลง (bank ติดลบ) · เฉลี่ยช่วง ±0.12 วิ ให้นุ่ม
  const rate = wrap(pathYaw(Math.min(ts + 0.12, BASE_DUR)) - pathYaw(Math.max(ts - 0.12, 0))) / 0.24;
  const bank = Math.max(-BANK_MAX, Math.min(BANK_MAX, -rate * BANK_GAIN)) * (1 - F);
  return { p, v, yaw, pitch, bank, face: F };
}

function emberTexture(T) {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas"); cv.width = cv.height = 32;
  const cx = cv.getContext("2d"); if (!cx) return null;
  const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.45, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  return new T.CanvasTexture(cv);
}

export function entranceDragonScene(T, durSec, buildDragon) {
  const dur = durSec > 0 ? durSec : BASE_DUR, k = dur / BASE_DUR;
  const g = new T.Group();
  const yawG = new T.Group(); g.add(yawG);          // ตำแหน่ง + หัน
  const pitchG = new T.Group(); yawG.add(pitchG);   // ก้ม/เงย (หมุนรอบแกนขวางลำตัว)
  const bankG = new T.Group(); pitchG.add(bankG);   // เอียงเข้าโค้ง (หมุนรอบแกนลำตัว)
  const model = buildDragon(T); bankG.add(model);
  bankG.scale.setScalar(DRAGON_SIZE);                // ตัวใหญ่กว่าโชว์ของขวัญ

  // ถ่านไฟลอยขึ้นเป็นฉากหลัง (บรรยากาศเดิม)
  const NE = 110, pos = new Float32Array(NE * 3), col = new Float32Array(NE * 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("color", new T.BufferAttribute(col, 3));
  const emMat = new T.PointsMaterial({ size: .13, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, map: emberTexture(T), opacity: .85 });
  const em = new T.Points(geo, emMat); em.frustumCulled = false; g.add(em);
  let sd = 7; const rnd = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const es = [];
  for (let i = 0; i < NE; i++) {
    es.push([(rnd() - .5) * 11, rnd() * 9, rnd() * 6.28, .35 + rnd() * .85, (rnd() - .5) * 5]);
    col[i * 3] = 1; col[i * 3 + 1] = .5 + rnd() * .35; col[i * 3 + 2] = .15;
  }
  const warm = new T.PointLight(0xff7a1a, 1.6, 26); g.add(warm);

  // สายไฟพุ่งจากปากมาถึงหน้าจอ แผ่กว้างจนเต็มจอ (ไฟของตัวโมเดลสั้น มองตรง ๆ จะเห็นเป็นแท่งเล็ก)
  // สี 4 ช่อง (RGBA): เปลวไฟจางหายด้วยความโปร่งใส ไม่ใช่สีมืดลง → บนผืนจอโปร่งใสของแอปจะไม่เห็นเป็นจุดดำ
  const NS = 520, spos = new Float32Array(NS * 3), scol = new Float32Array(NS * 4);
  const sgeo = new T.BufferGeometry();
  sgeo.setAttribute("position", new T.BufferAttribute(spos, 3));
  sgeo.setAttribute("color", new T.BufferAttribute(scol, 4));
  // ชั้นเนื้อไฟ (ผสมแบบปกติ → เห็นสีส้มเหลืองชัดทั้งบนพื้นสว่างและมืด) + ชั้นแสงเรือง (ผสมแบบบวกแสง เฉพาะส่วนที่ร้อน)
  const sMat = new T.PointsMaterial({ size: .5, transparent: true, depthWrite: false, blending: T.NormalBlending, vertexColors: true, map: emberTexture(T) });
  const stream = new T.Points(sgeo, sMat); stream.frustumCulled = false; g.add(stream);
  const gcol = new Float32Array(NS * 4), ggeo = new T.BufferGeometry();
  ggeo.setAttribute("position", sgeo.attributes.position);
  ggeo.setAttribute("color", new T.BufferAttribute(gcol, 4));
  const gMat = new T.PointsMaterial({ size: .8, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true, map: emberTexture(T) });
  const glowPts = new T.Points(ggeo, gMat); glowPts.frustumCulled = false; g.add(glowPts);
  const ss = Array.from({ length: NS }, () => ({ a: rnd() * 6.283, rr: Math.sqrt(rnd()), sp: .8 + rnd() * .5, ph: rnd(), rise: rnd() * .5 }));
  const TARGET = new T.Vector3(...DESK_CAM), STREAM_RATE = 1.5;
  // เล็งไปที่กล้องจริง (จอมือถือแนวตั้ง กล้องถอยไปไกลกว่าบนคอม) — อ่านตำแหน่งกล้องตอนวาดจากถ่านไฟที่แสดงตลอด
  em.onBeforeRender = (r, sc, camera) => { if (camera && camera.position) { TARGET.copy(camera.position); g.worldToLocal(TARGET); } };
  const M = new T.Vector3(), D = new T.Vector3(), U = new T.Vector3(), V = new T.Vector3(), Yup = new T.Vector3(0, 1, 0);

  const update = t => {
    const ts = Math.min(t / k, BASE_DUR), f = flightAt(ts);
    yawG.position.set(f.p[0], f.p[1], f.p[2]);
    yawG.rotation.y = f.yaw;
    // เล็งหัวตามกล้องจริง: ค่าพื้นฐานตั้งไว้สำหรับกล้องบนคอม · จอมือถือแนวตั้งกล้องถอยไกลกว่า → มุมก้มต่างไป ชดเชยตามส่วนต่างมุม
    const mouthY = f.p[1] + MOUTH_H * DRAGON_SIZE;
    const aimAdj = Math.atan2(TARGET.y - mouthY, TARGET.z - f.p[2]) - Math.atan2(DESK_CAM[1] - mouthY, DESK_CAM[2] - f.p[2]);
    pitchG.rotation.z = f.pitch + aimAdj * f.face;
    bankG.rotation.x = f.bank;
    const fire = fireAt(ts);
    if (model.userData.update) model.userData.update(ts + 2, { phi: flapPhase(ts), flapAmp: flapAmp(ts), breath: breathAt(ts), fire, ownFire: false });
    model.rotation.y = 0;                                  // ตัดการส่ายตัวเองของโมเดล (มีไว้สำหรับโชว์ของขวัญ)
    // สายไฟ: ออกจากปาก เล็งไปทางกล้อง แต่ละอนุภาคแสดงตามความแรงไฟ "ตอนที่มันถูกพ่นออกมา" → หัวไฟวิ่งเข้าหาจอ หางไฟตามไปเมื่อหยุดพ่น
    const live = fire > 0 || ts < T_FIRE_END + 1 / STREAM_RATE;
    stream.visible = glowPts.visible = live && ts > T_FIRE_ON - 0.05;
    if (stream.visible && model.userData.mouth) {
      g.updateMatrixWorld(true);
      M.copy(model.userData.mouth); model.localToWorld(M); g.worldToLocal(M);
      D.copy(TARGET).sub(M); const L = Math.max(1, D.length() - 1.4); D.normalize();
      U.crossVectors(D, Yup).normalize(); V.crossVectors(U, D).normalize();
      for (let i = 0; i < NS; i++) {
        const q = ss[i], rate = STREAM_RATE * q.sp, s = ((ts * rate + q.ph) % 1 + 1) % 1;
        const born = fireAt(ts - s / rate), spread = q.rr * (0.06 + 2.6 * Math.pow(s, 1.6));
        const ca = Math.cos(q.a + s * 2.2), sa = Math.sin(q.a + s * 2.2), d = s * L;
        spos[i * 3] = M.x + D.x * d + (U.x * ca + V.x * sa) * spread;
        spos[i * 3 + 1] = M.y + D.y * d + (U.y * ca + V.y * sa) * spread + s * s * q.rise;
        spos[i * 3 + 2] = M.z + D.z * d + (U.z * ca + V.z * sa) * spread;
        // สีเปลวไฟ: แกนขาวอมเหลือง → ส้ม → แดงอมส้ม แล้วโปร่งใสหายไป (ใกล้กล้องมากจางเร็วขึ้น ไม่บังจอเป็นก้อน)
        const heat = 1 - s, near = 1 - Math.max(0, (s - 0.72) / 0.28);
        const al = born * Math.pow(heat, .55) * Math.min(1, s * 14) * near * .9;
        const k4 = i * 4;
        scol[k4] = 1; scol[k4 + 1] = .3 + .62 * heat * heat; scol[k4 + 2] = .04 + .5 * heat * heat * heat; scol[k4 + 3] = al;
        const hot = al * heat * heat * .55;                       // แสงเรืองเฉพาะช่วงต้นที่ร้อนจัด
        gcol[k4] = 1; gcol[k4 + 1] = .7; gcol[k4 + 2] = .3; gcol[k4 + 3] = hot;
      }
      sgeo.attributes.position.needsUpdate = true; sgeo.attributes.color.needsUpdate = true; ggeo.attributes.color.needsUpdate = true;
    }
    // คำรามพ่นไฟ: จอสั่นเล็กน้อย + แสงส้มวูบตามไฟ
    const shake = 0.07 * fire;
    g.position.set(Math.sin(t * 47) * shake, Math.sin(t * 61 + 1.3) * shake * 0.7, 0);
    warm.position.set(f.p[0], f.p[1] + .6, f.p[2] + 1.6);
    warm.intensity = 1.0 + 3.2 * fire * (0.35 + 0.65 * f.face);
    for (let i = 0; i < NE; i++) {
      const e = es[i];
      pos[i * 3] = e[0] + Math.sin(t * e[3] + e[2]) * .5;
      pos[i * 3 + 1] = -4.2 + ((e[1] + t * e[3] * 1.3) % 9.4);
      pos[i * 3 + 2] = e[4];
    }
    geo.attributes.position.needsUpdate = true;
    emMat.opacity = .85 * Math.min(1, t / .4) * Math.min(1, Math.max(0, (dur - t) / .7));
  };
  update(0);
  return { group: g, cam: [0, .9, 10.6, .5], light: 0xff8a3d, update };
}
