// Gift Show — เอฟเฟกต์เข้าห้อง "มังกรไฟ" ที่ใช้ตัวมังกรของของขวัญแทนตัวเดิม
// ตัวมังกรมาจาก giftsPlus/dragon.js ตรงๆ (ไม่แก้โค้ดโมเดลเลย) — ที่นี่แค่ห่อไว้ในกลุ่มชั้นนอก
// แล้วพาบินตามเส้นทาง ให้จังหวะตรงกับไฟล์เสียง public/sounds/entrance-dragon.mp3
//
// จังหวะของไฟล์เสียง (วิเคราะห์จากคลื่นเสียงจริง): ดังเต็มที่ 0–2.7 · เบาลง 2.85–3.15 · พีคอีกครั้ง 3.3–4.35 · ค่อยๆ จบ 4.4–5.2
// คืนค่ารูปแบบเดียวกับ build3DEntrance เดิมทุกอย่าง: { group, cam, light, update(t) }

import { sampleTrack, OBJ0 } from "./shows.js";

// ช่วงเวลาอ้างอิงที่ออกแบบไว้ (วินาที) — ถ้าความยาวจริงต่างไป จะยืด/หดให้เองตามสัดส่วน
const BASE_DUR = 5.2;

// เส้นทางบิน: x,y,z = ตำแหน่ง · rx,ry,rz = หมุน · s = ขนาด
const FLIGHT = [
  [0, { x: 6.5, y: 2.4, z: -11, ry: -1.0, rz: .3, s: .4 }],
  [.55, { x: 3.2, y: 1.3, z: -5.5, ry: -.7, rz: .26, s: .72 }, "out"],   // โผล่มาพร้อมไฟชุดแรก (เสียงดังเต็ม)
  [1.3, { x: -.5, y: .5, z: -1.6, ry: -.28, rz: -.12, s: .96 }],
  [2.1, { x: -2.8, y: 1.1, z: -3.2, ry: .45, rz: .22, s: .86 }],         // วนกลับ
  [2.95, { x: -.5, y: 1.6, z: -4.6, ry: .12, rz: 0, rx: -.2, s: .8 }],   // ชะงัก เงยหัวสูดลม (ตรงจังหวะเสียงเบาลง)
  [3.45, { x: 0, y: .1, z: 1.3, ry: 0, rz: 0, rx: .12, s: 1.3 }, "in"],  // พุ่งเข้าหากล้องพ่นไฟ (ตรงจังหวะเสียงพีค)
  [4.05, { x: .15, y: .05, z: .5, ry: .08, rz: -.05, rx: .04, s: 1.2 }],
  [4.55, { x: -1.4, y: .9, z: -2.8, ry: -.5, rz: .2, s: .82 }],
  [5.2, { x: -6.5, y: 2.8, z: -13, ry: -1.2, rz: .38, s: .2 }],
];

// เลื่อนเวลาของโมเดล เพื่อให้จังหวะ "พ่นไฟแรงสุด" ของตัวมังกรเอง (รอบ ~3.31 วิ) ไปตกตรงเสียงพีค
const MODEL_T_OFFSET = .86;

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
  const dur = durSec > 0 ? durSec : BASE_DUR, k = dur / BASE_DUR; // ยืด/หดเส้นทางตามความยาวจริง
  const g = new T.Group();
  const holder = new T.Group(); g.add(holder);
  const model = buildDragon(T);
  holder.add(model);

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

  const update = t => {
    const f = sampleTrack(FLIGHT, t / k, OBJ0);          // t/k = เวลาตามสเกลที่ออกแบบไว้
    holder.position.set(f.x, f.y, f.z);
    holder.rotation.set(f.rx, f.ry, f.rz);
    holder.scale.setScalar(Math.max(.001, f.s));
    if (model.userData.update) model.userData.update(t + MODEL_T_OFFSET);
    warm.position.set(f.x, f.y + .4, f.z + 1.2);
    warm.intensity = 1.2 + 2.2 * Math.max(0, Math.sin((t + MODEL_T_OFFSET) * 1.9 - 1));
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
  return { group: g, cam: [0, .5, 10.2, .3], light: 0xff8a3d, update };
}
