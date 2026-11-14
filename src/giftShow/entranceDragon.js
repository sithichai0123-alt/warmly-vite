// Gift Show — เอฟเฟกต์เข้าห้อง "มังกรไฟ" ที่ใช้ตัวมังกรของของขวัญแทนตัวเดิม
// ตัวมังกรมาจาก giftsPlus/dragon.js ตรงๆ (ไม่แก้โค้ดโมเดลเลย) — ที่นี่แค่ห่อไว้ในกลุ่มชั้นนอก
// แล้วพาบินตามเส้นทาง ให้จังหวะตรงกับไฟล์เสียง public/sounds/entrance-dragon.mp3
//
// เส้นทางบิน 4 ช่วง:
//   0–1.1   บินตรงเข้าหาจอ หน้าหันเข้ากล้อง (ตัวเล็กไปใหญ่)
//   1.1–3.0 บินวน 1 รอบ เอียงตัวเข้าโค้ง กระพือปีก
//   3.0–4.2 หันหน้าเข้ากล้องอีกครั้ง พุ่งเข้าพ่นไฟ  ← ตรงกับจังหวะที่ไฟล์เสียงพีค (3.3–4.35 ของไฟล์)
//   4.2–5.2 บินจากไป
// จังหวะไฟล์เสียง (วัดจากคลื่นเสียงจริง): ดังเต็มที่ 0–2.7 · เบาลง 2.85–3.15 · พีคอีกครั้ง 3.3–4.35 · จบ 4.4–5.2
// คืนค่ารูปแบบเดียวกับ build3DEntrance เดิมทุกอย่าง: { group, cam, light, update(t) }

const BASE_DUR = 5.2;                 // ความยาวที่ออกแบบไว้ (ถ้าจริงต่างไป จะยืด/หดให้เองตามสัดส่วน)
const NOSE_FIX = -0.38;               // โมเดลหันหัวไปทาง +X แล้วหมุนเองอีก +0.38 เรเดียน — หักออกตรงนี้
const FACE_CAM = -Math.PI / 2 + NOSE_FIX;   // ค่าหันหน้าเข้ากล้องพอดี
const MODEL_SPEED = 1.5;              // เร่งเวลาของโมเดล → กระพือปีกถี่ขึ้น (รอบละ ~1.3 วิ แทน ~1.9 วิ)
const MODEL_T0 = 2.794;               // เลื่อนเวลาให้ "พ่นไฟแรงสุด" ของโมเดลไปตกที่ 1.25 วิ และ 3.45 วิ (ทั้งคู่ตรงกับเสียงดัง)

// วงที่ใช้บินวน
const C = [0, .95, -5.2], RX = 4.3, RZ = 3.0;
const P_FAR = [.4, 2.1, -13.5], P_NEAR = [0, .95, -2.2], P_CHARGE = [0, .3, 1.5], P_OUT = [-5.6, 2.7, -12.5];
const T_IN = 1.1, T_ORBIT = 3.0, T_FIRE = 3.45, T_OUT = 4.2;

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
// ไล่มุมทางใกล้ที่สุด (กันหมุนกลับหลังรอบใหญ่)
const mixAngle = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

// ตำแหน่ง + ทิศหัว + ความเอียง ณ เวลา ts (วินาทีในสเกล 0–5.2)
export function flightAt(ts) {
  let p, v, face;                                   // v = ทิศที่กำลังมุ่งไป (ใช้คำนวณทิศหัว) · face = 0 หันตามทางบิน / 1 หันเข้ากล้อง
  if (ts < T_IN) {                                  // ① บินตรงเข้าหาจอ
    p = mix3(P_FAR, P_NEAR, smooth(ts / T_IN));
    v = [P_NEAR[0] - P_FAR[0], 0, P_NEAR[2] - P_FAR[2]];
    face = 1;
  } else if (ts < T_ORBIT) {                        // ② บินวน 1 รอบ
    const a = (ts - T_IN) / (T_ORBIT - T_IN) * Math.PI * 2;
    p = [C[0] + Math.sin(a) * RX, C[1] + Math.sin(a * 2) * .45, C[2] + Math.cos(a) * RZ];
    v = [Math.cos(a) * RX, 0, -Math.sin(a) * RZ];
    face = 1 - smooth((ts - T_IN) / .45);           // ช่วงแรกยังหันหน้าเข้ากล้อง แล้วค่อยหันตามทางบิน
    face = Math.max(face, smooth((ts - (T_ORBIT - .3)) / .3)); // ท้ายรอบหันกลับมาหากล้อง
  } else if (ts < T_OUT) {                          // ③ พุ่งเข้าพ่นไฟใส่กล้อง
    const k = ts < T_FIRE ? smooth((ts - T_ORBIT) / (T_FIRE - T_ORBIT)) : 1;
    p = mix3(P_NEAR, P_CHARGE, k);
    if (ts > T_FIRE) { const b = (ts - T_FIRE) / (T_OUT - T_FIRE); p[1] += b * .25; p[2] -= b * .9; }
    v = [0, 0, 1];
    face = 1;
  } else {                                          // ④ บินจากไป
    const k = smooth((ts - T_OUT) / (BASE_DUR - T_OUT));
    p = mix3([P_CHARGE[0], P_CHARGE[1] + .25, P_CHARGE[2] - .9], P_OUT, k);
    v = [P_OUT[0] - P_CHARGE[0], 0, P_OUT[2] - P_CHARGE[2]];
    face = 1 - smooth((ts - T_OUT) / .45);
  }
  const yawPath = Math.atan2(-v[2], v[0]) + NOSE_FIX;
  return { p, yaw: mixAngle(yawPath, FACE_CAM, clamp01(face)), face: clamp01(face) };
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
  const yawG = new T.Group(); g.add(yawG);          // ตำแหน่ง + ทิศหัว
  const bankG = new T.Group(); yawG.add(bankG);     // เอียงตัวเข้าโค้ง (แกนลำตัว = X ของชั้นนี้)
  const model = buildDragon(T); bankG.add(model);

  // ถ่านไฟลอยขึ้นเป็นฉากหลัง (ของเดิมก็มี — คงบรรยากาศเดียวกันไว้)
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

  let lastYaw = null;
  const update = t => {
    const ts = Math.min(t / k, BASE_DUR), f = flightAt(ts);
    yawG.position.set(f.p[0], f.p[1], f.p[2]);
    yawG.rotation.y = f.yaw;
    // เอียงตัวเข้าโค้งตามอัตราการเลี้ยว (ไม่เอียงตอนหันหน้าเข้ากล้อง)
    let turn = 0;
    if (lastYaw !== null) { let d = (f.yaw - lastYaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; turn = d; }
    lastYaw = f.yaw;
    const bank = Math.max(-.75, Math.min(.75, turn * 9)) * (1 - f.face);
    bankG.rotation.x += (bank - bankG.rotation.x) * .12;                 // ค่อยๆ เอียง ไม่กระตุก
    bankG.rotation.z = -.06 + Math.sin(ts * 1.4) * .05;                  // ก้ม/เงยเล็กน้อย
    // ตัวใหญ่ขึ้นตอนเข้าใกล้ (เสริมจากระยะกล้อง) และย่อหายไปตอนจบ
    const s = (ts < T_IN ? mix(.72, 1, smooth(ts / T_IN)) : ts < T_OUT ? 1 : mix(1, .45, smooth((ts - T_OUT) / (BASE_DUR - T_OUT))));
    yawG.scale.setScalar(Math.max(.001, s));

    if (model.userData.update) model.userData.update(MODEL_T0 + ts * MODEL_SPEED);
    warm.position.set(f.p[0], f.p[1] + .4, f.p[2] + 1.4);
    warm.intensity = 1.2 + 2.4 * Math.max(0, Math.sin((MODEL_T0 + ts * MODEL_SPEED) * 1.9 - 1));
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
