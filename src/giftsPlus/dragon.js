// Gifts Plus — 🐉 มังกรไฟ (แบบมังกรตะวันตก สร้างด้วยโค้ด ไม่ใช้ไฟล์โมเดล)
// โครงสร้าง: ลำตัว/คอ/หางเป็นท่อเดียวที่โค้งตามเส้นกระดูกสันหลัง (คำนวณใหม่ทุกเฟรม) มีเกล็ดซ้อน สีไล่หลังเข้ม→ท้องทอง
//   · หัว: กะโหลก จมูก ขากรรไกรล่างอ้า-หุบ ฟัน เขาโค้ง ตาเรืองมีรูม่านตาแนวตั้ง
//   · ปีกค้างคาว: กระดูกแขน/นิ้ว 4 นิ้ว แผ่นเยื่อขอบหยัก กระพือพร้อมพับนิ้วตอนยกปีกขึ้น
//   · ขาหน้า/ขาหลังมีกรงเล็บ · หนามสันหลัง · ปลายหางรูปใบหอก · พ่นไฟเป็นกลุ่มอนุภาคร้อนไล่สี
// ไม่มี DOM ก็สร้างได้ (เทสต์ใน Node): ลายเกล็ดจะข้ามไป แต่สี/รูปทรงเหมือนเดิม

import { mat, sph, rng, fract, cloud, halo } from "./kit.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

// ลายเกล็ดซ้อน (โทนเทา คูณกับสีของจุดยอดอีกที)
function scaleTexture(T) {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const cx = cv.getContext("2d"); if (!cx) return null;
  cx.fillStyle = "#7a7a7a"; cx.fillRect(0, 0, 256, 256);
  const C = 16;
  for (let row = -1; row < 17; row++) for (let col = -1; col < 17; col++) {
    const x = col * C + (row % 2 ? C / 2 : 0), y = row * C * .78;
    const gr = cx.createRadialGradient(x, y - 3, 1, x, y, C * .72);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(.6, "#cfcfcf"); gr.addColorStop(1, "#8a8a8a");
    cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, C * .62, 0, 6.2832); cx.fill();
    cx.strokeStyle = "rgba(0,0,0,.45)"; cx.lineWidth = 1.2; cx.stroke();
  }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping;
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

// ท่อเรียวคงที่ตามเส้นโค้ง (เขา)
function taperTube(T, pts, r0, r1, seg = 10, rad = 7) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])));
  const pos = [], idx = [], P = new T.Vector3(), Tn = new T.Vector3(), n = new T.Vector3(), b = new T.Vector3(), h = new T.Vector3(0, 0, 1);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg; curve.getPoint(u, P); curve.getTangent(u, Tn);
    if (Math.abs(Tn.dot(h)) > .95) h.set(0, 1, 0);
    n.crossVectors(Tn, h).normalize(); b.crossVectors(Tn, n).normalize();
    const r = lerp(r0, r1, Math.pow(u, .8));
    for (let j = 0; j < rad; j++) { const a = j / rad * Math.PI * 2; pos.push(P.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r, P.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r, P.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b2 = i * rad + (j + 1) % rad, c = a + rad, d = b2 + rad; idx.push(a, b2, c, b2, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function dragon(T) {
  const g = new T.Group();
  g.userData.cam = [0, .35, 10.4]; g.userData.look = [.05, .1, 0]; g.userData.noSpin = true; g.userData.noBob = true;
  const R = rng(7);

  // ── วัสดุ ──
  const scaleTex = scaleTexture(T);
  const bodyMat = new T.MeshStandardMaterial({ vertexColors: true, map: scaleTex, roughness: .5, metalness: .2, emissive: 0x2a0606, emissiveIntensity: .6 });
  const redM = mat(T, 0x8f1414, { roughness: .5, metalness: .2, emissive: 0x2a0606, emissiveIntensity: .6 });
  const goldM = mat(T, 0xe9bf6a, { roughness: .5, metalness: .15, emissive: 0x6b3b06, emissiveIntensity: .35 });
  const boneM = mat(T, 0xefe3c2, { roughness: .45, metalness: .1, emissive: 0x3a2a0a, emissiveIntensity: .25 });
  const clawM = mat(T, 0x3b2a1a, { roughness: .4, metalness: .35 });
  const eyeM = mat(T, 0xffb020, { emissive: 0xff8a00, emissiveIntensity: 1.6, roughness: .2 });
  const pupM = new T.MeshBasicMaterial({ color: 0x0b0505 });
  const armM = mat(T, 0x7a1414, { roughness: .6, metalness: .1, emissive: 0x1a0404, emissiveIntensity: .6 });
  const memM = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: .75, metalness: 0, emissive: 0x3a0707, emissiveIntensity: .75, transparent: true, opacity: .96 });

  // ── ลำตัว: ท่อตามเส้นสันหลัง ──
  const NR = 60, NS = 16, LEN = 6.4;
  const keys = [[0, .02], [.1, .06], [.24, .16], [.38, .34], [.48, .46], [.58, .46], [.68, .34], [.78, .24], [.92, .2], [1, .19]];
  const rad = u => { for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], smooth((u - a[0]) / (b[0] - a[0]))); } return keys[keys.length - 1][1]; };
  const bpos = new Float32Array(NR * (NS + 1) * 3), bcol = new Float32Array(NR * (NS + 1) * 3), buv = new Float32Array(NR * (NS + 1) * 2);
  const idx = [];
  for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + 1, c = a + NS + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const bgeo = new T.BufferGeometry();
  bgeo.setAttribute("position", new T.BufferAttribute(bpos, 3)); bgeo.setAttribute("color", new T.BufferAttribute(bcol, 3)); bgeo.setAttribute("uv", new T.BufferAttribute(buv, 2)); bgeo.setIndex(idx);
  const cDor = [.4, .05, .05], cSide = [.66, .11, .07], cBel = [.95, .76, .4];
  for (let i = 0; i < NR; i++) for (let j = 0; j <= NS; j++) {
    const k = i * (NS + 1) + j, th = j / NS * Math.PI * 2, c = Math.cos(th), u = i / (NR - 1);
    const t1 = smooth((c + .55) / .6), t2 = smooth((c - .2) / .7); // ท้อง→ข้าง→หลัง
    const band = .92 + .08 * Math.sin(i * 2.3);
    for (let q = 0; q < 3; q++) { const side = lerp(cBel[q] * band, cSide[q], t1); bcol[k * 3 + q] = lerp(side, cDor[q], t2); }
    buv[k * 2] = u * LEN / 1.5; buv[k * 2 + 1] = j / NS * 2;
  }
  const body = new T.Mesh(bgeo, bodyMat); body.frustumCulled = false; g.add(body);

  // กรอบอ้างอิงต่อวงแหวนแต่ละวง
  const RP = [], RT = [], RN = [], RB = [];
  for (let i = 0; i < NR; i++) { RP.push(new T.Vector3()); RT.push(new T.Vector3()); RN.push(new T.Vector3()); RB.push(new T.Vector3(0, 0, 1)); }
  const ctrl = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => new T.Vector3());
  const curve = new T.CatmullRomCurve3(ctrl, false, "catmullrom", .5);
  const Zv = new T.Vector3(0, 0, 1), tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3();
  const idxAt = u => Math.round(clamp(u, 0, 1) * (NR - 1));
  // แปลงพิกัดท้องถิ่น (หน้า, บน, ข้าง) ของวงที่ i → พิกัดโลก (ใน g)
  const loc = (out, i, lx, ly, lz) => out.copy(RP[i]).addScaledVector(RT[i], lx).addScaledVector(RN[i], ly).addScaledVector(RB[i], lz);

  // ── หนามสันหลัง ──
  const spikeGeo = new T.ConeGeometry(.06, .3, 6); spikeGeo.translate(0, .15, 0);
  const spikes = [];
  [[.04, .3, 6], [.3, .62, 9], [.7, .96, 7]].forEach(([u0, u1, n]) => {
    for (let k = 0; k < n; k++) {
      const u = lerp(u0, u1, k / (n - 1)), m = new T.Mesh(spikeGeo, boneM); const s = .45 + 1.1 * Math.min(1, rad(u) / .4);
      m.scale.set(s, s, s); g.add(m); spikes.push({ m, i: idxAt(u), u, s });
    }
  });
  // ใบหอกปลายหาง
  const spadeGeo = new T.SphereGeometry(.16, 12, 8); spadeGeo.scale(1.7, .22, .85);
  const spade = new T.Mesh(spadeGeo, armM); g.add(spade);

  // ── หัว ──
  const head = new T.Group(); g.add(head);
  const skull = sph(T, .3, redM, 20, 14); skull.scale.set(1.25, .95, .95); head.add(skull);
  const snout = sph(T, .2, redM, 18, 12); snout.scale.set(2.0, .62, .82); snout.position.set(.5, -.03, 0); head.add(snout);
  const nose = sph(T, .1, redM, 12, 8); nose.scale.set(1.1, .8, 1.15); nose.position.set(.84, .0, 0); head.add(nose);
  [1, -1].forEach(z => {
    const brow = sph(T, .1, armM, 10, 8); brow.scale.set(1.5, .5, .9); brow.position.set(.16, .18, z * .17); brow.rotation.y = z * .25; head.add(brow);
    const eye = sph(T, .07, eyeM, 12, 10); eye.position.set(.2, .1, z * .2); head.add(eye);
    const pup = sph(T, .04, pupM, 8, 8); pup.scale.set(.3, 1, .4); pup.position.set(.25, .105, z * .235); head.add(pup);
    const nos = sph(T, .028, pupM, 6, 5); nos.position.set(.9, .045, z * .07); head.add(nos);
    const horn = new T.Mesh(taperTube(T, [[-.02, .2, z * .11], [-.2, .34, z * .17], [-.5, .4, z * .24], [-.82, .28, z * .27]], .065, .006), boneM); head.add(horn);
    const cheek = new T.Mesh(new T.ConeGeometry(.045, .26, 6), boneM); cheek.position.set(-.16, -.03, z * .27); cheek.rotation.set(z * -1.2, 0, 1.45); head.add(cheek);
    const cheek2 = new T.Mesh(new T.ConeGeometry(.035, .18, 6), boneM); cheek2.position.set(-.04, -.14, z * .22); cheek2.rotation.set(z * -.9, 0, 1.7); head.add(cheek2);
  });
  const tGeo = new T.ConeGeometry(.02, .1, 5);
  for (let k = 0; k < 4; k++) [1, -1].forEach(z => { const t = new T.Mesh(tGeo, boneM); t.position.set(.42 + k * .1, -.115, z * (.1 - k * .01)); t.rotation.z = Math.PI; head.add(t); });
  const jaw = new T.Group(); jaw.position.set(.1, -.1, 0); head.add(jaw);
  const jm = sph(T, .17, goldM, 14, 8); jm.scale.set(2.15, .4, .72); jm.position.set(.4, -.03, 0); jaw.add(jm);
  const chin = new T.Mesh(new T.ConeGeometry(.04, .2, 6), boneM); chin.position.set(.52, -.1, 0); chin.rotation.z = Math.PI + .5; jaw.add(chin);
  for (let k = 0; k < 4; k++) [1, -1].forEach(z => { const t = new T.Mesh(tGeo, boneM); t.position.set(.44 + k * .1, .02, z * (.1 - k * .012)); jaw.add(t); });
  const tongue = sph(T, .06, mat(T, 0xff5a3c, { emissive: 0xff3a1a, emissiveIntensity: .8 }), 8, 6); tongue.scale.set(2.6, .35, .9); tongue.position.set(.38, 0, 0); jaw.add(tongue);
  const MOUTH = new T.Vector3(.95, -.03, 0);

  // ── ปีกค้างคาว ──
  const WSC = .74; // ขนาดปีกเทียบลำตัว
  const WP = { S: [0, 0, 0], E: [1.0, .3, -.3], W: [1.95, .62, .1], F: [[3.9, 1.05, .25], [3.75, .2, -.85], [3.05, -.4, -1.65], [2.05, -.75, -2.2]], H: [.15, -.5, -1.95] };
  const wingFor = side => {
    const pts = Array.from({ length: 12 }, () => new T.Vector3()); // S E W F1..F4 M12 M23 M34 M4H H
    const mpos = new Float32Array(pts.length * 3), mcol = new Float32Array(pts.length * 3);
    const cols = { S: [.4, .07, .06], E: [.5, .08, .07], W: [.35, .05, .05], F: [.55, .1, .08], M: [.86, .26, .14], H: [.5, .09, .07] };
    const order = ["S", "E", "W", "F", "F", "F", "F", "M", "M", "M", "M", "H"];
    order.forEach((k, i) => cols[k].forEach((v, q) => { mcol[i * 3 + q] = v; }));
    const mg = new T.BufferGeometry(); mg.setAttribute("position", new T.BufferAttribute(mpos, 3)); mg.setAttribute("color", new T.BufferAttribute(mcol, 3));
    // ดัชนี: 0 S,1 E,2 W,3-6 F1..F4,7 M12,8 M23,9 M34,10 M4H,11 H
    mg.setIndex([2, 3, 7, 2, 7, 4, 2, 4, 8, 2, 8, 5, 2, 5, 9, 2, 9, 6, 2, 6, 10, 2, 10, 11, 2, 11, 0, 2, 0, 1]);
    const mem = new T.Mesh(mg, memM); mem.frustumCulled = false; g.add(mem);
    const bone = (r0, r1) => { const geo = new T.CylinderGeometry(r1, r0, 1, 6); geo.translate(0, .5, 0); const m = new T.Mesh(geo, armM); m.frustumCulled = false; g.add(m); return m; };
    const bones = [[0, 1, .07, .055], [1, 2, .055, .04], [2, 3, .04, .014], [2, 4, .04, .014], [2, 5, .04, .014], [2, 6, .035, .012]].map(([a, b, r0, r1]) => ({ a, b, m: bone(r0, r1) }));
    const thumb = new T.Mesh(new T.ConeGeometry(.035, .22, 6), clawM); g.add(thumb);
    return { side, pts, mpos, mg, mem, bones, thumb };
  };
  const wings = [wingFor(1), wingFor(-1)];
  const Yv = new T.Vector3(0, 1, 0), dirv = new T.Vector3(), qq = new T.Quaternion();
  const place = (m, A, B) => { dirv.subVectors(B, A); const L = dirv.length(); if (L < 1e-6) { m.visible = false; return; } m.visible = true; m.position.copy(A); m.quaternion.setFromUnitVectors(Yv, dirv.multiplyScalar(1 / L)); m.scale.set(1, L, 1); };

  // ── ขา ──
  const clawGeo = new T.ConeGeometry(.026, .17, 5); clawGeo.translate(0, .085, 0);
  const mkLimb = (r0, r1) => { const g2 = new T.CylinderGeometry(r1, r0, 1, 7); g2.translate(0, .5, 0); const m = new T.Mesh(g2, armM); m.frustumCulled = false; g.add(m); return m; };
  const legs = [
    // ขาหน้า (หนีบอก) — ข้อต่อ: หน้า, บน, ข้าง จากจุดยึด
    { u: .64, side: 1, a: [.05, -.3, .26], J: [[.28, -.56, .3], [.62, -.64, .24]], r: [.1, .075, .045], hind: false },
    { u: .64, side: -1, a: [.05, -.3, .26], J: [[.28, -.56, .3], [.62, -.64, .24]], r: [.1, .075, .045], hind: false },
    // ขาหลัง (พับห้อยไปด้านหลัง)
    { u: .36, side: 1, a: [-.05, -.2, .34], J: [[.1, -.62, .42], [-.38, -.9, .36], [-.12, -1.2, .34]], r: [.17, .12, .07, .045], hind: true },
    { u: .36, side: -1, a: [-.05, -.2, .34], J: [[.1, -.62, .42], [-.38, -.9, .36], [-.12, -1.2, .34]], r: [.17, .12, .07, .045], hind: true },
  ].map(d => {
    const n = d.J.length;
    const thigh = d.hind ? sph(T, .27, redM, 12, 9) : null; if (thigh) { thigh.scale.set(1, 1.15, .85); g.add(thigh); }
    const segsM = d.J.map((_, k) => mkLimb(d.r[k], d.r[k + 1]));
    const claws = [-1, 0, 1].map(o => { const c = new T.Mesh(clawGeo, clawM); g.add(c); return { c, o }; });
    return { ...d, thigh, segsM, claws, pts: [new T.Vector3(), ...d.J.map(() => new T.Vector3())], n };
  });

  // ── ไฟ ──
  const NF = 150, fire = cloud(T, NF, .42, 0xffffff, { vertexColors: true });
  g.add(fire.pts);
  const fs = Array.from({ length: NF }, () => ({ a: R() * 6.283, rr: Math.sqrt(R()), sp: .75 + R() * .7, ph: R(), rise: .1 + R() * .35 }));
  const mouthGlow = halo(T, 0xff9a3c, 1.7, .55); g.add(mouthGlow);
  const mouthLight = new T.PointLight(0xff8a2b, 2.4, 7); g.add(mouthLight);

  // ───────────── ขยับทุกเฟรม ─────────────
  const hq = new T.Quaternion(), hm = new T.Matrix4(), tiltQ = new T.Quaternion(), headPos = new T.Vector3(), mouthW = new T.Vector3();
  const Dh = new T.Vector3(), Uh = new T.Vector3(), Vh = new T.Vector3();
  g.userData.update = t => {
    const phi = t * 3.3, fl = Math.sin(phi), flap = fl * .62 + .22;
    const lift = Math.sin(phi - .6) * .1;
    g.rotation.y = .38 + Math.sin(t * .55) * .24; g.position.y = lift * .5;
    const w = (i, x, y, z) => ctrl[i].set(x, y, z);
    w(0, -2.75 + Math.sin(t * 2.3) * .1, -1.62 + Math.sin(t * 1.8) * .16, .35 * Math.sin(t * 1.9));
    w(1, -2.0, -1.55 + Math.sin(t * 1.8 + .7) * .12, -.3 + .2 * Math.sin(t * 2.1 + .5));
    w(2, -1.3, -1.02 + Math.sin(t * 1.8 + 1.4) * .08 + lift, .12 * Math.sin(t * 1.6));
    w(3, -.68, -.38 + lift, 0);
    w(4, -.02, -.12 + lift * 1.2, 0);
    w(5, .55, .12 + lift * 1.2, 0);
    w(6, .98 + Math.sin(t * 1.3) * .05, .62, .08 * Math.sin(t * 1.5));
    w(7, 1.12 + Math.sin(t * 1.3 + .4) * .06, 1.22, -.06 * Math.sin(t * 1.4));
    w(8, 1.45, 1.6 + Math.sin(t * 1.7) * .05, 0);
    for (let i = 0; i < NR; i++) {
      const u = i / (NR - 1);
      curve.getPoint(u, RP[i]); curve.getTangent(u, RT[i]); RT[i].normalize();
      RN[i].crossVectors(Zv, RT[i]).normalize();
      const r = rad(u);
      for (let j = 0; j <= NS; j++) {
        const th = j / NS * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), k = (i * (NS + 1) + j) * 3;
        const ry = c < 0 ? r * .82 : r, rx = r * 1.02;
        bpos[k] = RP[i].x + RN[i].x * c * ry + Zv.x * s * rx; bpos[k + 1] = RP[i].y + RN[i].y * c * ry + Zv.y * s * rx; bpos[k + 2] = RP[i].z + RN[i].z * c * ry + Zv.z * s * rx;
      }
    }
    bgeo.attributes.position.needsUpdate = true; bgeo.computeVertexNormals();
    // หนามสันหลัง (ด้านบนของลำตัว เอนไปด้านหลัง)
    spikes.forEach(o => { const i = o.i; tmp.copy(RP[i]).addScaledVector(RN[i], rad(o.u) * .92); o.m.position.copy(tmp); tmp2.copy(RN[i]).addScaledVector(RT[i], -.45).normalize(); o.m.quaternion.setFromUnitVectors(Yv, tmp2); });
    // ใบหอกปลายหาง
    spade.position.copy(RP[0]); tmp.copy(RT[0]).negate(); spade.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), tmp); spade.position.addScaledVector(tmp, .22);
    // หัว: ตามทิศคอ ก้มลงเล็กน้อย อ้าปากตามจังหวะพ่นไฟ
    const ie = NR - 1, breath = .5 + .5 * Math.sin(t * 1.9 - 1.0);
    hm.makeBasis(RT[ie], RN[ie], RB[ie]); hq.setFromRotationMatrix(hm);
    tiltQ.setFromAxisAngle(Zv, -.62 + Math.sin(t * 1.1) * .06 - breath * .1); hq.multiply(tiltQ);
    headPos.copy(RP[ie]).addScaledVector(RT[ie], .05); head.position.copy(headPos); head.quaternion.copy(hq);
    jaw.rotation.z = -(.12 + .42 * breath);
    mouthW.copy(MOUTH).applyQuaternion(hq).add(headPos);
    Dh.set(1, 0, 0).applyQuaternion(hq); Uh.set(0, 1, 0).applyQuaternion(hq); Vh.set(0, 0, 1).applyQuaternion(hq);
    // ปีก
    const fold = .8 + .22 * (.5 - .5 * Math.cos(phi)), ca = Math.cos(flap), sa = Math.sin(flap);
    const ib = idxAt(.58);
    wings.forEach(wg => {
      const sd = wg.side, P = wg.pts;
      const toW = (out, src, fk) => { // ท้องถิ่นปีก (ออกนอก, บน, หน้า) → หมุนกระพือ → โลก
        let x = src[0] * WSC, y = src[1] * WSC, z = src[2] * WSC;
        const x2 = x * ca - y * sa, y2 = x * sa + y * ca;
        return out.copy(RP[ib]).addScaledVector(RB[ib], sd * (x2 + .3)).addScaledVector(RN[ib], y2 + rad(.58) * .8).addScaledVector(RT[ib], z + .25 + (fk || 0));
      };
      const tip = new Array(4), Wl = WP.W;
      for (let k = 0; k < 4; k++) { const f = WP.F[k]; tip[k] = [Wl[0] + (f[0] - Wl[0]) * fold, Wl[1] + (f[1] - Wl[1]) * fold + (1 - fold) * 1.2, Wl[2] + (f[2] - Wl[2]) * fold]; }
      toW(P[0], WP.S); toW(P[1], WP.E); toW(P[2], Wl);
      for (let k = 0; k < 4; k++) toW(P[3 + k], tip[k]);
      const mid = (a, b2, out) => { tmp3.copy(a).add(b2).multiplyScalar(.5); out.copy(tmp3).lerp(P[2], .2); };
      mid(P[3], P[4], P[7]); mid(P[4], P[5], P[8]); mid(P[5], P[6], P[9]); mid(P[6], toW(P[11], WP.H), P[10]);
      P.forEach((p, i) => { wg.mpos[i * 3] = p.x; wg.mpos[i * 3 + 1] = p.y; wg.mpos[i * 3 + 2] = p.z; });
      wg.mg.attributes.position.needsUpdate = true; wg.mg.computeVertexNormals();
      wg.bones.forEach(b => place(b.m, P[b.a], P[b.b]));
      wg.thumb.position.copy(P[2]); tmp.subVectors(P[2], P[1]).normalize(); wg.thumb.quaternion.setFromUnitVectors(Yv, tmp.add(Yv.clone().multiplyScalar(.6)).normalize());
    });
    // ขา
    legs.forEach((lg, li) => {
      const i = idxAt(lg.u), sw = Math.sin(t * 1.8 + li) * .05;
      loc(lg.pts[0], i, lg.a[0], lg.a[1], lg.side * lg.a[2]);
      lg.J.forEach((j, k) => loc(lg.pts[k + 1], i, j[0] + sw * (lg.hind ? -1 : 1), j[1] + sw, lg.side * j[2]));
      if (lg.thigh) { lg.thigh.position.copy(lg.pts[0]); lg.thigh.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), RT[i]); }
      lg.segsM.forEach((m, k) => place(m, lg.pts[k], lg.pts[k + 1]));
      const last = lg.pts[lg.n], prev = lg.pts[lg.n - 1]; tmp.subVectors(last, prev).normalize();
      lg.claws.forEach(c => { c.c.position.copy(last).addScaledVector(RB[i], c.o * .07 * lg.side); qq.setFromUnitVectors(Yv, tmp2.copy(tmp).addScaledVector(RB[i], c.o * .35 * lg.side).addScaledVector(RN[i], -.1).normalize()); c.c.quaternion.copy(qq); });
    });
    // ไฟ
    const reach = 1.0 + 1.3 * breath;
    for (let i = 0; i < NF; i++) {
      const f = fs[i], s = fract(t * 1.05 * f.sp + f.ph), spread = (.05 + .5 * s * s + .1 * s) * f.rr;
      const d = s * reach, ca2 = Math.cos(f.a), sa2 = Math.sin(f.a);
      fire.pos[i * 3] = mouthW.x + Dh.x * d + (Uh.x * ca2 + Vh.x * sa2) * spread;
      fire.pos[i * 3 + 1] = mouthW.y + Dh.y * d + (Uh.y * ca2 + Vh.y * sa2) * spread + s * s * f.rise;
      fire.pos[i * 3 + 2] = mouthW.z + Dh.z * d + (Uh.z * ca2 + Vh.z * sa2) * spread;
      const heat = 1 - s, a = Math.pow(1 - s, .8) * (.25 + .75 * breath) * clamp(s * 9, 0, 1);
      fire.col[i * 3] = a; fire.col[i * 3 + 1] = a * (.3 + .6 * heat * heat); fire.col[i * 3 + 2] = a * (.04 + .45 * heat * heat * heat);
    }
    fire.geo.attributes.position.needsUpdate = true; fire.geo.attributes.color.needsUpdate = true;
    mouthGlow.position.copy(mouthW).addScaledVector(Dh, .25); const gs = 1.2 + 1.1 * breath; mouthGlow.scale.set(gs, gs, 1); mouthGlow.material.opacity = .25 + .5 * breath;
    mouthLight.position.copy(mouthW).addScaledVector(Dh, .8); mouthLight.intensity = 1 + 2.2 * breath;
  };
  g.userData.update(0);
  return g;
}
