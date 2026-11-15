// Gift Show — เอฟเฟกต์เข้าห้อง "มังกรไฟ" ที่ใช้ตัวมังกรของของขวัญ (giftsPlus/dragon.js ไม่ถูกแก้เลย — ที่นี่แค่พาบิน)
// เสียงและความยาวเหมือนเดิม: public/sounds/entrance-dragon.mp3 · 5.2 วิ
//
// การบินแบบใหม่ (ปรับให้เป็นธรรมชาติและน่าเกรงขาม):
//   0–1.5   โผล่จากที่ไกลด้านบนซ้าย ร่อนลงเข้าหาจอ ลำตัวขนานกับทิศที่บิน กระพือปีกหนัก ๆ
//   1.5–3.3 โฉบผ่านหน้าจอแล้ววนโค้งกว้างกลับมา เห็นด้านข้างเต็มตัว ตัวเอียงเข้าโค้ง ปีกร่อน (กระพือช้าลง)
//   3.3–3.6 บินตรงเข้าหาจอ ค่อย ๆ เชิดตัวยืนผงาด               ← เสียงคำรามเริ่ม (3.3)
//   3.6–4.35 ยืนผงาดกลางจอ พุ่งเข้ามาพ่นไฟใส่จอ จอสั่น        ← เสียงคำรามพีค · ไฟแรงสุดที่ 3.8 วิ
//   4.35–5.2 ทะยานขึ้นบินข้ามหัวผู้ชมออกด้านบนจอ (ไม่ต้องหันหลังกลับ)
//
// แก้จากรุ่นก่อน: (1) โมเดลมีการส่ายตัวเอง ±14° สำหรับโชว์ของขวัญ → ตัดทิ้งตอนบิน (เคยบินเฉียงเหมือนปู)
//   (2) ท่าเดิมเงยตัว ~40° ตลอด → ตอนบินก้มลำตัวให้ขนานทิศบิน เงยเฉพาะตอนยืนผงาดพ่นไฟ
//   (3) เส้นทางเป็นเส้นโค้งต่อเนื่อง (ไม่วนเป็นวงกลม) ทิศหัวตามทิศบินจริง เอียงตัวเข้าหาโค้งตามความเร็วการเลี้ยว
// คืนค่ารูปแบบเดียวกับ build3DEntrance เดิมทุกอย่าง: { group, cam, light, update(t) }

const BASE_DUR = 5.2;                   // ความยาวที่ออกแบบไว้ (ถ้าจริงต่างไป จะยืด/หดให้เองตามสัดส่วน)
export const FACE_CAM = -Math.PI / 2;   // หัวมังกรอยู่ทาง +X ของโมเดล · หมุนรอบแกน Y −90° = หันเข้ากล้อง (+Z)
const T_TURN = 3.2, T_SETTLE = 3.6, T_FIRE = 3.8, T_LEAVE = 4.35, T_GONE = 4.75;
const ROAR_A = 3.3, ROAR_B = 4.35;   // ช่วงเสียงคำรามในไฟล์เสียง
const CRUISE_PITCH = -0.52;             // ก้มลำตัวให้ขนานทิศบิน (ท่าโมเดลเดิมเงยราว 30°)
const BANK_GAIN = 0.3, BANK_MAX = 0.75; // เอียงเข้าโค้งตามความเร็วการเลี้ยว

// ช่วงวนกลับ: ส่วนโค้งของวงกลมจริง (ศูนย์กลาง ARC_C รัศมี ARC_R) หมุนด้วยความเร็วคงที่ → เลี้ยวนุ่มสม่ำเสมอแบบสัตว์ตัวใหญ่
//   เข้าโค้งที่มุม 135° (ทิศของวงตรงกับทิศที่บินเข้ามาพอดี → ไม่หักหัว) โฉบผ่านหน้าจอไปทางขวา วนไปด้านหลัง
//   แล้วออกจากโค้งที่ −180° โดยหันหน้าเข้าหาจอพอดี · รวม 315° ใน 1.5 วิ = เลี้ยว 210°/วิ สม่ำเสมอ
const ARC_C = [1.6, -2.6], ARC_R = 2.5, ARC_T0 = 1.85, ARC_T1 = 3.35, ARC_A0 = 135, ARC_A1 = -180;
const arcKeys = () => {
  const out = [], n = 10;
  for (let i = 0; i <= n; i++) {
    const t = ARC_T0 + (ARC_T1 - ARC_T0) * i / n, th = (ARC_A0 + (ARC_A1 - ARC_A0) * i / n) * Math.PI / 180;
    const y = 1.25 + 0.75 * Math.sin(Math.PI * i / n);                       // ไต่ขึ้นเล็กน้อยตอนอยู่ด้านหลัง
    out.push([+t.toFixed(3), ARC_C[0] + ARC_R * Math.cos(th), y, ARC_C[1] + ARC_R * Math.sin(th)]);
  }
  return out;
};
// จุดผ่าน [เวลา, x, y, z] — กล้องอยู่ที่ z≈+10.6 มองไปทาง −Z
export const KEYS = [
  [0.0, -10.0, 5.5, -26.0],
  [0.8, -6.6, 3.4, -14.0],
  [1.5, -2.6, 1.9, -4.0],
  ...arcKeys(),              // 1.85–3.35 โฉบผ่านหน้าจอ แล้ววนโค้งกว้างกลับมา
  [3.8, 0.0, 0.95, 1.0],     // บินตรงเข้าหาจอ แล้วพุ่งเข้าใกล้ขณะพ่นไฟ
  [4.35, 0.1, 1.2, 0.3],
  [4.8, 0.05, 3.4, 3.6],     // ทะยานขึ้นข้ามหัวผู้ชม
  [5.2, 0.0, 6.8, 6.6],
];

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
const wrap = d => { d %= Math.PI * 2; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const mixAngle = (a, b, k) => a + wrap(b - a) * k;

// ความชันของแต่ละจุด (Catmull-Rom แบบเวลาไม่เท่ากัน) → ความเร็วต่อเนื่อง ไม่กระตุกที่จุดผ่าน
// จุดเข้าโค้งใช้ทิศสัมผัสของวงกลมจริง → ทางบินเลี้ยวทางเดียวต่อเนื่อง ไม่ส่ายเป็นตัว S ก่อนเข้าโค้ง
const ARC_I0 = 3, ARC_W = (ARC_A1 - ARC_A0) * Math.PI / 180 / (ARC_T1 - ARC_T0);
const TAN = KEYS.map((k, i) => {
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[Math.min(KEYS.length - 1, i + 1)], dt = b[0] - a[0] || 1;
  const t = [1, 2, 3].map(j => (b[j] - a[j]) / dt);
  if (i === ARC_I0) { const th = ARC_A0 * Math.PI / 180; t[0] = -ARC_R * ARC_W * Math.sin(th); t[2] = ARC_R * ARC_W * Math.cos(th); }
  return t;
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
// ทิศหัวตาม "ทิศบินเฉลี่ย" ช่วง ±0.3 วิ (ถ่วงน้ำหนักแบบระฆัง) → หัวหมุนเนียนต่อเนื่อง ไม่หักตามมุมของเส้นทาง
const SM_OFF = [-0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
const SM_W = SM_OFF.map(d => Math.exp(-0.5 * (d / 0.13) * (d / 0.13)));
const pathYaw = ts => {
  let x = 0, z = 0;
  SM_OFF.forEach((d, i) => { const { v } = pathAt(Math.min(Math.max(ts + d, 0), BASE_DUR)); x += v[0] * SM_W[i]; z += v[2] * SM_W[i]; });
  return Math.atan2(-z, x);
};

// น้ำหนัก "หันหน้าเข้าจอ" 0..1
export const faceWeight = ts => (ts < T_TURN ? 0 : ts < T_SETTLE ? smooth((ts - T_TURN) / (T_SETTLE - T_TURN)) : ts < T_LEAVE ? 1 : 1 - smooth((ts - T_LEAVE) / (T_GONE - T_LEAVE)));

// เวลาของตัวโมเดล (คุมความถี่กระพือปีก/จังหวะพ่นไฟ): ร่อนช่วงโฉบ = กระพือช้า · ยืนพ่นไฟ = กระพือแรง
//   ไฟของโมเดลแรงสุดเมื่อ sin(τ·1.9 − 1) = 1 → τ = 1.3527 + 3.3069k → ตั้งให้ τ(3.8 วิ) ตกที่ยอดถัดไป (4.66)
const RATE = [[0, 1.15], [1.6, 1.15], [1.9, 0.6], [2.6, 0.6], [2.95, 1.3], [5.2, 1.3]];
const rateAt = ts => { for (let i = 0; i < RATE.length - 1; i++) { const [a, ra] = RATE[i], [b, rb] = RATE[i + 1]; if (ts <= b) return mix(ra, rb, smooth((ts - a) / (b - a))); } return RATE[RATE.length - 1][1]; };
const integ = ts => { let s = 0; const n = Math.max(1, Math.ceil(ts / 0.01)), d = ts / n; for (let i = 0; i < n; i++) s += rateAt((i + .5) * d) * d; return s; };
const FIRE_PEAK_TAU = (Math.PI / 2 + 1) / 1.9 + (2 * Math.PI / 1.9);   // ≈ 4.66
const TAU0 = FIRE_PEAK_TAU - integ(T_FIRE);
const TAU_TABLE = Array.from({ length: Math.round(BASE_DUR / 0.02) + 1 }, (_, i) => TAU0 + integ(i * 0.02));
export const modelTime = ts => { const x = Math.min(Math.max(ts, 0), BASE_DUR) / 0.02, i = Math.floor(x), f = x - i; return i >= TAU_TABLE.length - 1 ? TAU_TABLE[TAU_TABLE.length - 1] : mix(TAU_TABLE[i], TAU_TABLE[i + 1], f); };
export const breathAt = ts => 0.5 + 0.5 * Math.sin(modelTime(ts) * 1.9 - 1.0);

// ท่าทั้งหมด ณ เวลา ts: ตำแหน่ง · หัน (yaw) · ก้ม/เงย (pitch) · เอียง (bank)
export function flightAt(ts) {
  const { p, v } = pathAt(ts), F = faceWeight(ts);
  const yaw = mixAngle(pathYaw(ts), FACE_CAM, F);
  const hs = Math.hypot(v[0], v[2]);
  const climb = Math.max(-0.45, Math.min(0.45, Math.atan2(v[1], Math.max(hs, 0.5)) * 0.7));
  const lunge = Math.exp(-Math.pow((ts - T_FIRE) / 0.22, 2));          // โน้มตัวไปข้างหน้าตอนพ่นไฟ
  const pitch = mix(CRUISE_PITCH + climb, 0.06 - 0.18 * lunge, F);       // ยืนผงาด = ท่าเงยของโมเดลเดิม
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

  const update = t => {
    const ts = Math.min(t / k, BASE_DUR), f = flightAt(ts);
    yawG.position.set(f.p[0], f.p[1], f.p[2]);
    yawG.rotation.y = f.yaw;
    pitchG.rotation.z = f.pitch;
    bankG.rotation.x = f.bank;
    if (model.userData.update) model.userData.update(modelTime(ts));
    model.rotation.y = 0;                                  // ตัดการส่ายตัวเองของโมเดล (มีไว้สำหรับโชว์ของขวัญ)
    // คำรามพ่นไฟ: จอสั่นเล็กน้อย + แสงส้มวูบตามไฟ
    const roar = ts > ROAR_A && ts < ROAR_B ? Math.sin(Math.PI * (ts - ROAR_A) / (ROAR_B - ROAR_A)) : 0;
    const shake = 0.07 * roar * breathAt(ts);
    g.position.set(Math.sin(t * 47) * shake, Math.sin(t * 61 + 1.3) * shake * 0.7, 0);
    warm.position.set(f.p[0], f.p[1] + .6, f.p[2] + 1.6);
    warm.intensity = 1.0 + 3.2 * breathAt(ts) * (0.35 + 0.65 * f.face);
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
