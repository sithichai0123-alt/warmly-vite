// Gifts Plus — โมเดล 3 มิติของของขวัญชุดใหม่ (สร้างแบบโปรซีเดอรัลด้วย three.js ไม่ต้องมีไฟล์โมเดล)
// รับ THREE จาก App.jsx (โหลดเมื่อต้องใช้เท่านั้น) แล้วคืน THREE.Group ในรูปแบบเดียวกับ build3DModel เดิม:
//   userData.cam=[x,y,z] ตำแหน่งกล้อง · look=[x,y,z] จุดที่มอง · update(t) ขยับทุกเฟรม (t วินาที)
//   noSpin / noBob = ไม่ให้ตัวเล่นหมุน/ลอยซ้ำ (โมเดลที่ขยับเองทั้งหมด) · spin = ความเร็วหมุน
// ทองที่ราคา > 120: dragon, yacht, jet, island   ม่วง: crystal, butterfly, comet, genie, meteor
// งบประมาณ: ทุกโมเดลรวมไม่เกิน ~25,000 สามเหลี่ยมและ ≤ 400 จุดอนุภาค เพื่อให้ลื่นบนมือถือ (มีเทสต์ตรวจ)

import { mat, glow, sph, clamp01, fract, rng, cloud, halo, ringMesh } from "./kit.js";
import { dragon } from "./dragon.js";

// ───────────────────────── ทอง > 120 ─────────────────────────

function yacht(T) {
  const g = new T.Group(); g.userData.cam = [0, 2.0, 8.9]; g.userData.look = [0, .15, 0]; g.userData.spin = .55; g.userData.noBob = true;
  const white = mat(T, 0xf8fafc, { roughness: .3, metalness: .15 }), blue = mat(T, 0x1d4ed8, { roughness: .35, emissive: 0x1e3a8a, emissiveIntensity: .25 });
  const glass = mat(T, 0x7dd3fc, { emissive: 0x38bdf8, emissiveIntensity: .75, roughness: .1, metalness: .3 });
  const boat = new T.Group(); g.add(boat);
  const sh = new T.Shape(); sh.moveTo(-1.65, .22); sh.lineTo(-1.5, -.24); sh.lineTo(1.0, -.26); sh.quadraticCurveTo(1.65, -.12, 2.0, .3); sh.lineTo(-1.65, .3); sh.closePath();
  const hull = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: .88, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2, curveSegments: 10 }), white); hull.geometry.translate(0, 0, -.44); boat.add(hull);
  [1, -1].forEach(z => { const st = new T.Mesh(new T.BoxGeometry(2.9, .08, .02), blue); st.position.set(-.2, .02, z * .515); boat.add(st); });
  const deck = new T.Mesh(new T.BoxGeometry(3.6, .04, .86), mat(T, 0xd6b98c, { roughness: .8 })); deck.position.set(.1, .335, 0); boat.add(deck);
  const cab1 = new T.Mesh(new T.BoxGeometry(1.75, .42, .72), white); cab1.position.set(-.45, .56, 0); boat.add(cab1);
  const cab2 = new T.Mesh(new T.BoxGeometry(1.2, .34, .62), white); cab2.position.set(-.6, .94, 0); boat.add(cab2);
  const roof = new T.Mesh(new T.BoxGeometry(1.35, .06, .72), blue); roof.position.set(-.6, 1.14, 0); boat.add(roof);
  [1, -1].forEach(z => {
    const w1 = new T.Mesh(new T.BoxGeometry(1.5, .13, .02), glass); w1.position.set(-.45, .6, z * .365); boat.add(w1);
    const w2 = new T.Mesh(new T.BoxGeometry(1.0, .12, .02), glass); w2.position.set(-.6, .97, z * .315); boat.add(w2);
  });
  const ws = new T.Mesh(new T.BoxGeometry(.04, .2, .56), glass); ws.position.set(.17, .64, 0); ws.rotation.z = -.5; boat.add(ws);
  const mast = new T.Mesh(new T.CylinderGeometry(.025, .03, .55, 8), white); mast.position.set(-.65, 1.45, 0); boat.add(mast);
  const radar = new T.Mesh(new T.BoxGeometry(.5, .04, .1), mat(T, 0x94a3b8, { metalness: .8, roughness: .3 })); radar.position.set(-.65, 1.74, 0); boat.add(radar);
  const flag = new T.Mesh(new T.PlaneGeometry(.34, .2), mat(T, 0xef4444, { side: T.DoubleSide })); flag.position.set(-.82, 1.5, 0); boat.add(flag);
  const sofa = new T.Mesh(new T.BoxGeometry(.6, .12, .5), mat(T, 0x1e293b)); sofa.position.set(.95, .43, 0); boat.add(sofa);
  const lounge = new T.Mesh(new T.BoxGeometry(.2, .22, .5), mat(T, 0x1e293b)); lounge.position.set(1.2, .5, 0); boat.add(lounge);
  const water = new T.Mesh(new T.CircleGeometry(2.9, 56), mat(T, 0x0ea5e9, { emissive: 0x0369a1, emissiveIntensity: .55, transparent: true, opacity: .72, roughness: .15, side: T.DoubleSide }));
  water.rotation.x = -Math.PI / 2; water.position.y = -.3; g.add(water);
  const rings = [0, 1, 2].map(i => { const r = ringMesh(T, .94, 1, 0xe0f2fe, .5); r.position.y = -.28; g.add(r); return r; });
  g.userData.update = t => {
    boat.position.y = Math.sin(t * 1.8) * .06; boat.rotation.z = Math.sin(t * 1.5) * .035; boat.rotation.x = Math.sin(t * 1.2 + 1) * .03;
    flag.rotation.y = Math.sin(t * 7) * .35; flag.scale.x = 1 + Math.sin(t * 9) * .08;
    rings.forEach((r, i) => { const ph = fract(t * .35 + i / 3); r.scale.setScalar(1.3 + ph * 1.5); r.material.opacity = .5 * (1 - ph); });
  };
  return g;
}

// ✈️ เครื่องบินส่วนตัว: ลำตัวขาว หางม่วง-ทอง เครื่องยนต์เรืองแสง บินเอียงตัวเหนือก้อนเมฆที่ไหลผ่าน
function jet(T) {
  const g = new T.Group(); g.userData.cam = [0, 1.2, 8.2]; g.userData.look = [0, -.15, 0]; g.userData.noSpin = true; g.userData.noBob = true;
  const white = mat(T, 0xf8fafc, { roughness: .28, metalness: .35 }), gold = mat(T, 0xfbbf24, { roughness: .3, metalness: .7, emissive: 0x92400e, emissiveIntensity: .25 });
  const purple = mat(T, 0x7c3aed, { roughness: .35, metalness: .3, emissive: 0x4c1d95, emissiveIntensity: .35 });
  const glass = mat(T, 0x0f172a, { emissive: 0x38bdf8, emissiveIntensity: .35, roughness: .1, metalness: .5 });
  const plane = new T.Group(); g.add(plane);
  const fus = new T.Mesh(new T.CylinderGeometry(.27, .27, 2.4, 24), white); fus.rotation.z = Math.PI / 2; plane.add(fus);
  const nose = new T.Mesh(new T.ConeGeometry(.27, .85, 24), white); nose.rotation.z = -Math.PI / 2; nose.position.x = 1.62; plane.add(nose);
  const tail = new T.Mesh(new T.ConeGeometry(.27, 1.05, 24), white); tail.rotation.z = Math.PI / 2; tail.position.set(-1.72, .06, 0); tail.scale.set(1, 1, 1); plane.add(tail);
  const cock = new T.Mesh(new T.SphereGeometry(.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass); cock.scale.set(1.5, .7, .9); cock.position.set(1.15, .17, 0); cock.rotation.z = -.3; plane.add(cock);
  const band = new T.Mesh(new T.CylinderGeometry(.28, .28, .12, 24), gold); band.rotation.z = Math.PI / 2; band.position.x = .75; plane.add(band);
  const wsh = new T.Shape(); wsh.moveTo(.55, 0); wsh.lineTo(-.45, 1.75); wsh.lineTo(-.85, 1.75); wsh.lineTo(-.35, 0); wsh.closePath();
  const wgeo = new T.ExtrudeGeometry(wsh, { depth: .06, bevelEnabled: false }); wgeo.rotateX(Math.PI / 2);
  [1, -1].forEach(z => { const w = new T.Mesh(wgeo, white); w.scale.z = z; w.position.set(.1, -.1, 0); plane.add(w); const tip = new T.Mesh(new T.BoxGeometry(.35, .05, .06), gold); tip.position.set(-.65, -.1, z * 1.75); plane.add(tip); });
  const fsh = new T.Shape(); fsh.moveTo(-1.05, .2); fsh.lineTo(-1.5, .2); fsh.lineTo(-1.78, 1.0); fsh.lineTo(-1.45, 1.0); fsh.closePath();
  const fin = new T.Mesh(new T.ExtrudeGeometry(fsh, { depth: .05, bevelEnabled: false }), purple); fin.geometry.translate(0, 0, -.025); plane.add(fin);
  const stab = new T.ExtrudeGeometry((() => { const s = new T.Shape(); s.moveTo(.2, 0); s.lineTo(-.25, .6); s.lineTo(-.5, .6); s.lineTo(-.15, 0); s.closePath(); return s; })(), { depth: .04, bevelEnabled: false }); stab.rotateX(Math.PI / 2);
  [1, -1].forEach(z => { const s = new T.Mesh(stab, white); s.scale.z = z; s.position.set(-1.45, .05, 0); plane.add(s); });
  const exh = [];
  [1, -1].forEach(z => {
    const eng = new T.Mesh(new T.CylinderGeometry(.13, .15, .62, 14), mat(T, 0x94a3b8, { metalness: .8, roughness: .25 })); eng.rotation.z = Math.PI / 2; eng.position.set(-1.0, .12, z * .4); plane.add(eng);
    const fl = new T.Mesh(new T.ConeGeometry(.11, .8, 12, 1, true), glow(T, 0x38bdf8, { opacity: .7, side: T.DoubleSide })); fl.rotation.z = Math.PI / 2; fl.position.set(-1.7, .12, z * .4); plane.add(fl); exh.push(fl);
    for (let i = 0; i < 6; i++) { const w = sph(T, .036, glass, 8, 6); w.scale.set(1, 1.3, .5); w.position.set(.1 + i * .22, .08, z * .262); plane.add(w); }
  });
  const R = rng(5), clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new T.Group(); const k = .45 + R() * .4;
    for (let j = 0; j < 3; j++) { const b = sph(T, k * (.55 + R() * .4), mat(T, 0xffffff, { emissive: 0xe0e7ff, emissiveIntensity: .75, roughness: 1, metalness: 0, transparent: true, opacity: .92 }), 12, 8); b.position.set((j - 1) * k * .7, R() * .1, (R() - .5) * .2); c.add(b); }
    c.userData = { x0: R() * 7 - 3.5, y: -1.15 - R() * .5, z: (R() - .5) * 3.2, sp: .9 + R() * .6, ambient: true }; // เมฆเลื่อนผ่านขอบจอโดยตั้งใจ
    g.add(c); clouds.push(c);
  }
  const strk = [0, 1, 2, 3].map(i => { const s = new T.Mesh(new T.BoxGeometry(1.4, .015, .015), glow(T, 0xffffff, { opacity: .35 })); s.position.set(-2.5, -.45 + i * .3, (i % 2 ? 1 : -1) * .9); s.userData.ambient = true; g.add(s); return s; });
  g.userData.update = t => {
    plane.rotation.x = Math.sin(t * 1.1) * .2; plane.rotation.z = Math.sin(t * 1.6) * .05; plane.rotation.y = .55 + Math.sin(t * .5) * .3; plane.position.y = Math.sin(t * 1.9) * .06;
    exh.forEach((f, i) => { f.scale.set(1 + .25 * Math.sin(t * 20 + i), 1, 1); });
    clouds.forEach(c => { const u = c.userData; c.position.set(((u.x0 - t * u.sp + 12.25) % 7) - 3.5, u.y, u.z); });
    strk.forEach((s, i) => { const ph = fract(t * .9 + i * .27); s.position.x = -1.5 - ph * 2.6; s.material.opacity = .35 * Math.sin(ph * Math.PI); });
  };
  return g;
}

// 🏝️ เกาะส่วนตัว: เกาะทราย มะพร้าว 2 ต้นโยกตามลม ร่มชายหาด น้ำใสมีระลอก
function island(T) {
  const g = new T.Group(); g.userData.cam = [0, 2.9, 9.4]; g.userData.look = [0, .55, 0]; g.userData.spin = .5; g.userData.noBob = true;
  const sand = mat(T, 0xfde68a, { roughness: .9, metalness: 0 });
  const dome = new T.Mesh(new T.SphereGeometry(1.7, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), sand); dome.scale.set(1, .32, 1); g.add(dome);
  const under = new T.Mesh(new T.CylinderGeometry(1.7, .9, .7, 28), mat(T, 0xb45309, { roughness: .95, metalness: 0 })); under.position.y = -.35; g.add(under);
  const grass = new T.Mesh(new T.CylinderGeometry(.9, 1.0, .08, 20), mat(T, 0x65a30d, { roughness: .9, metalness: 0 })); grass.position.set(-.35, .5, -.1); g.add(grass);
  const water = new T.Mesh(new T.CircleGeometry(2.9, 56), mat(T, 0x22d3ee, { emissive: 0x0891b2, emissiveIntensity: .5, transparent: true, opacity: .62, roughness: .1, side: T.DoubleSide }));
  water.rotation.x = -Math.PI / 2; water.position.y = -.04; g.add(water);
  const rings = [0, 1, 2].map(() => { const r = ringMesh(T, .96, 1, 0xffffff, .45); r.position.y = -.02; g.add(r); return r; });
  const leafM = mat(T, 0x16a34a, { emissive: 0x14532d, emissiveIntensity: .3, roughness: .6, side: T.DoubleSide }), trunkM = mat(T, 0x92400e, { roughness: .85, metalness: 0 });
  const palms = [];
  [[-.5, .42, 0, 1.45, .26], [.35, .36, .25, 1.1, -.2]].forEach(([x, y, z, h, lean]) => {
    const pg = new T.Group(); pg.position.set(x, y, z);
    const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(lean * .35, h * .35, 0), new T.Vector3(lean * .8, h * .7, 0), new T.Vector3(lean * 1.2, h, 0)]);
    pg.add(new T.Mesh(new T.TubeGeometry(curve, 12, .07, 8), trunkM));
    const top = new T.Group(); top.position.set(lean * 1.2, h, 0); pg.add(top);
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const piv = new T.Group(); piv.rotation.y = i / 7 * Math.PI * 2;
      const lf = sph(T, .5, leafM, 10, 6); lf.scale.set(1.35, .06, .32); lf.position.x = .62; piv.add(lf); piv.rotation.z = 0; piv.userData.lf = lf;
      const holder = new T.Group(); holder.add(piv); holder.rotation.z = -.35; top.add(holder); leaves.push(holder);
    }
    [0, 1, 2].forEach(i => { const c = sph(T, .09, mat(T, 0x78350f, { roughness: .8, metalness: 0 }), 10, 8); c.position.set(Math.cos(i * 2.1) * .12, -.1, Math.sin(i * 2.1) * .12); top.add(c); });
    g.add(pg); palms.push({ pg, leaves, ph: x });
  });
  const um = new T.Group(); um.position.set(.75, .3, -.45);
  const pole = new T.Mesh(new T.CylinderGeometry(.025, .025, 1.0, 8), mat(T, 0xf5f5f4)); pole.position.y = .5; um.add(pole);
  const can = new T.Mesh(new T.ConeGeometry(.6, .3, 10, 1, true), mat(T, 0xef4444, { side: T.DoubleSide, roughness: .7, metalness: 0 })); can.position.y = 1.0; um.add(can);
  const stripe = new T.Mesh(new T.ConeGeometry(.42, .22, 10, 1, true), mat(T, 0xffffff, { side: T.DoubleSide, roughness: .7, metalness: 0 })); stripe.position.y = 1.04; um.add(stripe);
  const tip = sph(T, .04, mat(T, 0xfbbf24), 8, 6); tip.position.y = 1.17; um.add(tip); um.rotation.z = .12; g.add(um);
  const towel = new T.Mesh(new T.BoxGeometry(.7, .02, .35), mat(T, 0x38bdf8, { roughness: .9, metalness: 0 })); towel.position.set(.45, .42, .35); towel.rotation.y = -.5; g.add(towel);
  const shell = new T.Mesh(new T.ConeGeometry(.08, .16, 6), mat(T, 0xfb7185)); shell.position.set(-.1, .46, .75); shell.rotation.z = 1.2; g.add(shell);
  g.userData.update = t => {
    palms.forEach(({ leaves, pg, ph }) => { pg.rotation.z = Math.sin(t * 1.2 + ph) * .03; leaves.forEach((h, i) => { h.rotation.z = -.35 + Math.sin(t * 1.9 + i * .9 + ph) * .1; }); });
    rings.forEach((r, i) => { const p = fract(t * .3 + i / 3); r.scale.setScalar(1.7 + p * 1.1); r.material.opacity = .45 * (1 - p); });
    towel.position.y = .42;
  };
  return g;
}

// ───────────────────────── ม่วง ─────────────────────────

// 🔮 ลูกแก้ววิเศษ: ลูกแก้วใสบนฐานทอง มีหมอกควันม่วงวนข้างใน ผลึกลอย และประกายโคจรรอบ
function crystal(T) {
  const g = new T.Group(); g.userData.cam = [0, 1.3, 5.4]; g.userData.look = [0, .72, 0]; g.userData.spin = .6; g.userData.noBob = true;
  const gold = mat(T, 0xfbbf24, { metalness: .85, roughness: .25, emissive: 0x78350f, emissiveIntensity: .3 });
  const base = new T.Mesh(new T.CylinderGeometry(.62, .85, .22, 28), gold); base.position.y = -.2; g.add(base);
  const foot = new T.Mesh(new T.TorusGeometry(.78, .07, 10, 40), gold); foot.rotation.x = Math.PI / 2; foot.position.y = -.08; g.add(foot);
  const cup = new T.Mesh(new T.TorusGeometry(.55, .09, 10, 36), gold); cup.rotation.x = Math.PI / 2; cup.position.y = .02; g.add(cup);
  [0, 1, 2].forEach(i => { const a = i * 2.094; const lg = new T.Mesh(new T.ConeGeometry(.07, .3, 8), gold); lg.position.set(Math.cos(a) * .72, -.38, Math.sin(a) * .72); lg.rotation.set(Math.sin(a) * .35, 0, -Math.cos(a) * .35); g.add(lg); });
  const ball = new T.Mesh(new T.SphereGeometry(.98, 40, 28), mat(T, 0xc084fc, { transparent: true, opacity: .34, roughness: .04, metalness: .1, emissive: 0x6d28d9, emissiveIntensity: .4, depthWrite: false }));
  ball.position.y = 1.0; g.add(ball);
  const core = new T.Mesh(new T.IcosahedronGeometry(.3, 1), mat(T, 0xf5d0fe, { emissive: 0xe879f9, emissiveIntensity: 1, flatShading: true, roughness: .2 })); core.position.y = 1.0; g.add(core);
  const halo = new T.Mesh(new T.SphereGeometry(.55, 20, 14), glow(T, 0xd946ef, { opacity: .22 })); halo.position.y = 1.0; g.add(halo);
  const pl = new T.PointLight(0xc084fc, 1.6, 5); pl.position.set(0, 1.0, 0); g.add(pl);
  const R = rng(3), mist = cloud(T, 110, .16, 0xe9d5ff), seeds = Array.from({ length: mist.n }, () => ({ r: .2 + R() * .55, a: R() * 6.28, b: R() * 6.28, s: .5 + R() * 1.1 }));
  g.add(mist.pts); mist.pts.position.y = 1.0;
  const sp = cloud(T, 40, .12, 0xfef08a), sd = Array.from({ length: sp.n }, () => ({ a: R() * 6.28, y: R() * 2.4 - .6, s: .35 + R() * .6, r: 1.15 + R() * .35 }));
  g.add(sp.pts);
  g.userData.update = t => {
    core.rotation.set(t * .9, t * 1.3, 0); core.position.y = 1.0 + Math.sin(t * 1.7) * .08;
    const k = 1 + Math.sin(t * 2.4) * .08; halo.scale.setScalar(k); pl.intensity = 1.5 + Math.sin(t * 2.4) * .5;
    for (let i = 0; i < mist.n; i++) {
      const s = seeds[i], a = s.a + t * s.s, b = s.b + t * s.s * .6;
      mist.pos[i * 3] = Math.cos(a) * Math.cos(b) * s.r; mist.pos[i * 3 + 1] = Math.sin(b) * s.r * .9; mist.pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s.r;
    }
    mist.geo.attributes.position.needsUpdate = true;
    for (let i = 0; i < sp.n; i++) { const s = sd[i], a = s.a + t * s.s; sp.pos[i * 3] = Math.cos(a) * s.r; sp.pos[i * 3 + 1] = 1.0 + ((s.y + t * .15) % 2.4) - .6 + Math.sin(a * 2) * .08; sp.pos[i * 3 + 2] = Math.sin(a) * s.r; }
    sp.m.opacity = .6 + Math.sin(t * 5) * .3; sp.geo.attributes.position.needsUpdate = true;
  };
  return g;
}

// 🦋 ผีเสื้อแสง: ปีกม่วง-ชมพู-ฟ้าไล่สี มีลายจุดเรืองแสง กระพือปีกและโปรยฝุ่นประกาย
function butterfly(T) {
  const g = new T.Group(); g.userData.cam = [0, .35, 7.8]; g.userData.look = [0, .05, 0]; g.userData.noSpin = true; g.userData.noBob = true;
  const grad = (geo, c0, c1, c2) => {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new T.Color(c0), b = new T.Color(c1), c = new T.Color(c2), tmp = new T.Color();
    for (let i = 0; i < p.count; i++) { const d = clamp01(Math.hypot(p.getX(i), p.getY(i)) / 2.1); if (d < .5) tmp.copy(a).lerp(b, d * 2); else tmp.copy(b).lerp(c, (d - .5) * 2); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
    geo.setAttribute("color", new T.BufferAttribute(col, 3)); return geo;
  };
  const up = new T.Shape(); up.moveTo(0, .05); up.bezierCurveTo(.35, 1.0, 1.5, 1.65, 2.0, .9); up.bezierCurveTo(2.1, .3, 1.3, -.05, 0, -.05); up.closePath();
  const lo = new T.Shape(); lo.moveTo(0, -.05); lo.bezierCurveTo(1.15, -.1, 1.75, -.65, 1.25, -1.4); lo.bezierCurveTo(.8, -1.8, .15, -1.25, 0, -.05); lo.closePath();
  const wm = () => new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, emissive: 0x7c3aed, emissiveIntensity: .55, roughness: .55, metalness: 0 });
  const edge = new T.LineBasicMaterial({ color: 0x3b0764 });
  const mkWing = () => {
    const w = new T.Group();
    w.add(new T.Mesh(grad(new T.ShapeGeometry(up, 24), 0x7c3aed, 0xe879f9, 0x67e8f9), wm()));
    w.add(new T.Mesh(grad(new T.ShapeGeometry(lo, 24), 0x6d28d9, 0xf472b6, 0x38bdf8), wm()));
    w.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(up.getPoints(20)), edge)); w.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(lo.getPoints(20)), edge));
    [[1.4, .78, .17], [1.0, .45, .1], [1.1, -.85, .13], [.85, -.5, .08]].forEach(([x, y, r]) => { const s = new T.Mesh(new T.CircleGeometry(r, 16), new T.MeshBasicMaterial({ color: 0xfdf4ff })); s.position.set(x, y, .01); w.add(s); const s2 = s.clone(); s2.position.z = -.01; w.add(s2); });
    return w;
  };
  const wr = new T.Group(), wl = new T.Group(); wr.add(mkWing()); wl.add(mkWing()); wl.scale.x = -1; g.add(wr); g.add(wl);
  const bodyM = mat(T, 0x312e81, { roughness: .5, emissive: 0x4c1d95, emissiveIntensity: .4 });
  const body = new T.Mesh(new T.CylinderGeometry(.075, .06, 1.35, 12), bodyM); body.position.y = -.1; g.add(body);
  const head = sph(T, .14, bodyM, 14, 10); head.position.y = .66; g.add(head);
  const eyeM = new T.MeshBasicMaterial({ color: 0xfef08a });
  [1, -1].forEach(s => {
    const e = sph(T, .04, eyeM, 8, 6); e.position.set(s * .07, .7, .1); g.add(e);
    const an = new T.Mesh(new T.CylinderGeometry(.01, .01, .55, 5), bodyM); an.position.set(s * .2, 1.0, 0); an.rotation.z = -s * .45; g.add(an);
    const tip = sph(T, .04, new T.MeshBasicMaterial({ color: 0xf0abfc }), 8, 6); tip.position.set(s * .33, 1.24, 0); g.add(tip);
  });
  const dust = cloud(T, 60, .13, 0xf5d0fe), R = rng(9), ds = Array.from({ length: dust.n }, () => ({ s: R(), x: (R() - .5) * 3.2, z: (R() - .5) * .8 }));
  g.add(dust.pts);
  g.userData.update = t => {
    const a = Math.sin(t * 6.5) * .78 + .1;
    wr.rotation.y = -a; wl.rotation.y = -a;
    g.rotation.y = Math.sin(t * .8) * .55; g.rotation.x = .28 + Math.sin(t * 1.3) * .06; g.rotation.z = Math.sin(t * .9) * .08; g.position.y = Math.sin(t * 2) * .14;
    for (let i = 0; i < dust.n; i++) { const life = fract(t * .5 + ds[i].s); dust.pos[i * 3] = ds[i].x * (.4 + life * .6); dust.pos[i * 3 + 1] = -.3 - life * 1.8; dust.pos[i * 3 + 2] = ds[i].z; }
    dust.m.opacity = .85; dust.geo.attributes.position.needsUpdate = true;
  };
  return g;
}

// ☄️ ดาวหาง: หัวน้ำแข็งเรืองแสง หางอนุภาคไหลยาว ดวงดาวพราวพื้นหลัง
function comet(T) {
  const g = new T.Group(); g.userData.cam = [0, 0, 6.4]; g.userData.look = [0, 0, 0]; g.userData.noSpin = true; g.userData.noBob = true;
  const geo = new T.IcosahedronGeometry(.42, 1), P = geo.attributes.position, R = rng(21);
  for (let i = 0; i < P.count; i++) { const k = .88 + R() * .24; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k); }
  geo.computeVertexNormals();
  const head = new T.Group(); head.position.set(1.15, .6, 0);
  const rock = new T.Mesh(geo, mat(T, 0xc4b5fd, { emissive: 0x8b5cf6, emissiveIntensity: .9, flatShading: true, roughness: .35 })); head.add(rock);
  const aura = halo(T, 0xc4b5fd, 2.1, .85); head.add(aura);
  const aura2 = halo(T, 0x8b5cf6, 3.4, .4); head.add(aura2);
  g.add(head);
  const dir = new T.Vector3(-.9, -.45, 0).normalize(), perp1 = new T.Vector3(.45, -.9, 0).normalize(), perp2 = new T.Vector3(0, 0, 1);
  const tail = new T.Mesh(new T.ConeGeometry(.55, 3.0, 24, 1, true), glow(T, 0xa78bfa, { opacity: .1, side: T.DoubleSide })); tail.position.copy(head.position).addScaledVector(dir, 1.5); tail.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir.clone().negate()); g.add(tail);
  const N = 240, tp = cloud(T, N, .22, 0xffffff, { vertexColors: true }), seed = Array.from({ length: N }, () => ({ s: R(), a: R() - .5, b: R() - .5 }));
  g.add(tp.pts);
  const st = cloud(T, 70, .09, 0xffffff), sp = Array.from({ length: st.n }, () => ({ x: (R() - .5) * 6, y: (R() - .5) * 4, z: -1 - R() * 1.5, ph: R() * 6 }));
  g.add(st.pts);
  const c0 = new T.Color(0xffffff), c1 = new T.Color(0xc084fc), c2 = new T.Color(0x4c1d95), tmp = new T.Color();
  g.userData.update = t => {
    g.rotation.y = Math.sin(t * .7) * .5; head.rotation.set(t * .8, t * 1.1, 0); head.position.set(1.15 + Math.sin(t * 1.3) * .08, .6 + Math.cos(t * 1.1) * .06, 0);
    tail.position.copy(head.position).addScaledVector(dir, 1.5);
    for (let i = 0; i < N; i++) {
      const s = seed[i], life = fract(t * .6 + s.s), spread = life * .55 * (.3 + life);
      const L = life * 3.1;
      tp.pos[i * 3] = head.position.x + dir.x * L + perp1.x * s.a * spread + perp2.x * s.b * spread;
      tp.pos[i * 3 + 1] = head.position.y + dir.y * L + perp1.y * s.a * spread + perp2.y * s.b * spread;
      tp.pos[i * 3 + 2] = head.position.z + dir.z * L + perp1.z * s.a * spread + perp2.z * s.b * spread;
      if (life < .35) tmp.copy(c0).lerp(c1, life / .35); else tmp.copy(c1).lerp(c2, (life - .35) / .65);
      const f = 1 - life * life; tp.col[i * 3] = tmp.r * f; tp.col[i * 3 + 1] = tmp.g * f; tp.col[i * 3 + 2] = tmp.b * f;
    }
    tp.geo.attributes.position.needsUpdate = true; tp.geo.attributes.color.needsUpdate = true;
    for (let i = 0; i < st.n; i++) { st.pos[i * 3] = sp[i].x; st.pos[i * 3 + 1] = sp[i].y; st.pos[i * 3 + 2] = sp[i].z; }
    st.m.opacity = .6 + Math.sin(t * 3) * .25; st.geo.attributes.position.needsUpdate = true;
    { const k = 2.1 * (1 + Math.sin(t * 4) * .07); aura.scale.set(k, k, 1); }
  };
  return g;
}

// 🧞 จินนี่ผู้ให้พร: จินนี่สีฟ้าลอยขึ้นจากตะเกียงทอง ผ้าโพกหัวม่วง กอดอก พร้อมประกายพร
function genie(T) {
  const g = new T.Group(); g.userData.cam = [0, .55, 7.1]; g.userData.look = [0, .3, 0]; g.userData.spin = .75; g.userData.noBob = true;
  const gold = mat(T, 0xfbbf24, { metalness: .85, roughness: .25, emissive: 0x78350f, emissiveIntensity: .35 });
  const skin = mat(T, 0x60a5fa, { roughness: .55, metalness: 0, emissive: 0x1d4ed8, emissiveIntensity: .35 });
  const smokeM = mat(T, 0x818cf8, { roughness: .6, metalness: 0, emissive: 0x4f46e5, emissiveIntensity: .55, transparent: true, opacity: .88 });
  const purple = mat(T, 0x7c3aed, { roughness: .5, metalness: 0, emissive: 0x4c1d95, emissiveIntensity: .35 });
  // ตะเกียง
  const lamp = new T.Group(); lamp.position.y = -1.45; g.add(lamp);
  const lb = sph(T, .62, gold, 24, 16); lb.scale.set(1.15, .46, .7); lamp.add(lb);
  const ft = new T.Mesh(new T.CylinderGeometry(.22, .3, .14, 14), gold); ft.position.y = -.26; lamp.add(ft);
  const sp = new T.Mesh(new T.CylinderGeometry(.05, .13, .8, 10), gold); sp.position.set(.82, .1, 0); sp.rotation.z = -1.0; lamp.add(sp);
  const hd = new T.Mesh(new T.TorusGeometry(.3, .05, 8, 20, Math.PI * 1.2), gold); hd.position.set(-.68, .08, 0); hd.rotation.z = Math.PI * .4; lamp.add(hd);
  const lid = sph(T, .15, gold, 12, 8); lid.position.y = .26; lamp.add(lid);
  const gem = sph(T, .09, mat(T, 0xf472b6, { emissive: 0xf472b6, emissiveIntensity: 1 }), 10, 8); gem.position.set(0, 0, .42); lamp.add(gem);
  // หางควัน
  const tailN = 9, tails = [];
  for (let i = 0; i < tailN; i++) { const r = .1 + (i / (tailN - 1)) * .26, m = sph(T, r, smokeM, 14, 10); g.add(m); tails.push(m); }
  const torso = new T.Group(); g.add(torso);
  const ch = sph(T, .5, skin, 20, 14); ch.scale.set(1, 1.1, .78); torso.add(ch);
  const sash = new T.Mesh(new T.TorusGeometry(.46, .045, 8, 28), gold); sash.rotation.x = Math.PI / 2; sash.position.y = -.28; sash.scale.set(1, .8, 1); torso.add(sash);
  const medal = sph(T, .08, mat(T, 0xf472b6, { emissive: 0xf472b6, emissiveIntensity: .9 }), 10, 8); medal.position.set(0, .12, .4); torso.add(medal);
  [1, -1].forEach(s => {
    const sh = sph(T, .17, skin, 12, 10); sh.position.set(s * .5, .28, 0); torso.add(sh);
    const fa = new T.Mesh(new T.CylinderGeometry(.115, .1, .78, 12), skin); fa.rotation.z = Math.PI / 2; fa.position.set(0, .0 + s * .05, .36 + s * .02); fa.rotation.y = s * .12; torso.add(fa);
    const hand = sph(T, .13, skin, 10, 8); hand.position.set(-s * .36, s * .05, .38 + s * .02); torso.add(hand);
    const br = new T.Mesh(new T.TorusGeometry(.115, .03, 6, 14), gold); br.position.set(s * .27, s * .05, .36 + s * .02); br.rotation.y = Math.PI / 2; torso.add(br);
  });
  const head = new T.Group(); head.position.y = .85; torso.add(head);
  head.add(sph(T, .34, skin, 20, 14));
  const eyeW = new T.MeshBasicMaterial({ color: 0xffffff }), eyeB = new T.MeshBasicMaterial({ color: 0x111827 });
  [1, -1].forEach(s => {
    const e = sph(T, .065, eyeW, 10, 8); e.position.set(s * .12, .03, .29); e.scale.set(1, 1.15, .6); head.add(e);
    const p = sph(T, .032, eyeB, 8, 6); p.position.set(s * .12, .03, .33); head.add(p);
    const br = new T.Mesh(new T.BoxGeometry(.13, .026, .03), mat(T, 0x1e293b)); br.position.set(s * .12, .13, .3); br.rotation.z = -s * .22; head.add(br);
  });
  const sm = new T.Mesh(new T.TorusGeometry(.09, .016, 6, 14, Math.PI), mat(T, 0x1e293b)); sm.position.set(0, -.08, .32); sm.rotation.z = Math.PI; head.add(sm);
  const goat = new T.Mesh(new T.ConeGeometry(.07, .22, 8), mat(T, 0x1e293b)); goat.position.set(0, -.27, .22); goat.rotation.x = Math.PI + .35; head.add(goat);
  const nose = sph(T, .045, skin, 8, 6); nose.position.set(0, -.02, .34); head.add(nose);
  const tb = sph(T, .38, purple, 18, 12); tb.scale.set(1.12, .82, 1.12); tb.position.y = .27; head.add(tb);
  const band = new T.Mesh(new T.TorusGeometry(.37, .05, 8, 28), gold); band.rotation.x = Math.PI / 2; band.position.y = .14; head.add(band);
  const jewel = sph(T, .07, mat(T, 0xf472b6, { emissive: 0xf472b6, emissiveIntensity: 1.1 }), 10, 8); jewel.position.set(0, .2, .38); head.add(jewel);
  const feather = new T.Mesh(new T.ConeGeometry(.07, .5, 8), mat(T, 0xfde68a, { emissive: 0xf59e0b, emissiveIntensity: .5 })); feather.position.set(0, .62, .02); feather.rotation.z = -.35; head.add(feather);
  const R = rng(17), sk = cloud(T, 50, .13, 0xfef08a), ss = Array.from({ length: sk.n }, () => ({ a: R() * 6.28, y: R() * 3.4 - 1.4, s: .4 + R() * .7, r: .95 + R() * .55 }));
  g.add(sk.pts);
  g.userData.update = t => {
    const hover = Math.sin(t * 1.6) * .08;
    torso.position.set(Math.sin(t * 1.1) * .05, .6 + hover, 0); torso.rotation.y = Math.sin(t * .9) * .15; head.rotation.z = Math.sin(t * 1.3) * .06; head.rotation.y = Math.sin(t * .7) * .15;
    for (let i = 0; i < tailN; i++) { const u = i / (tailN - 1); tails[i].position.set(Math.sin(t * 2.4 - i * .7) * .17 * u + Math.sin(t * 1.1) * .05 * u, -1.25 + u * 1.55 + hover * u, Math.cos(t * 2.1 - i * .6) * .07 * u); }
    gem.scale.setScalar(1 + Math.sin(t * 5) * .2); jewel.scale.setScalar(1 + Math.sin(t * 4 + 1) * .2);
    for (let i = 0; i < sk.n; i++) { const s = ss[i], a = s.a + t * s.s; sk.pos[i * 3] = Math.cos(a) * s.r; sk.pos[i * 3 + 1] = -1.3 + ((s.y + 1.4 + t * .35) % 3.5); sk.pos[i * 3 + 2] = Math.sin(a) * s.r; }
    sk.m.opacity = .65 + Math.sin(t * 6) * .3; sk.geo.attributes.position.needsUpdate = true;
  };
  return g;
}

// 🌠 ฝนดาวตก: ดาวทองสุกใสหมุนกลางจอ รายล้อมด้วยดาวตกพุ่งผ่านเป็นสาย บนท้องฟ้ายามค่ำ
function meteor(T) {
  const g = new T.Group(); g.userData.cam = [0, 0, 6.6]; g.userData.look = [0, 0, 0]; g.userData.noSpin = true; g.userData.noBob = true;
  const R0 = .95, R1 = .44, sh = new T.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R1 : R0, x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
  sh.closePath();
  const geo = new T.ExtrudeGeometry(sh, { depth: .2, bevelEnabled: true, bevelSize: .04, bevelThickness: .06, bevelSegments: 3 }); geo.translate(0, 0, -.1);
  const star = new T.Mesh(geo, mat(T, 0xfde047, { metalness: .5, roughness: .25, emissive: 0xf59e0b, emissiveIntensity: .75 })); g.add(star);
  const h1 = halo(T, 0xfbbf24, 4.2, .75); h1.position.z = -.4; g.add(h1);
  const h2 = halo(T, 0xc084fc, 6.2, .3); h2.position.z = -.5; g.add(h2);
  const pl = new T.PointLight(0xfde047, 1.4, 6); pl.position.set(0, 0, 1.5); g.add(pl);
  const dir = new T.Vector3(-1, -.58, 0).normalize(), R = rng(31), K = 11, shots = [];
  for (let i = 0; i < K; i++) {
    const s = new T.Group(), head = sph(T, .075 + R() * .03, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true }), 10, 8);
    const tail = new T.Mesh(new T.ConeGeometry(.07, 1.1 + R() * .9, 8, 1, true), glow(T, i % 2 ? 0xe9d5ff : 0xfef3c7, { opacity: .6, side: T.DoubleSide }));
    tail.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().negate()); tail.position.copy(dir).multiplyScalar(-tail.geometry.parameters.height / 2);
    s.userData.ambient = true; s.add(head); s.add(tail); g.add(s); // ดาวตกพุ่งผ่านขอบจอโดยตั้งใจ
    shots.push({ s, head, tail, ph: i / K + R() * .05, ox: (R() - .3) * 3.6, oy: (R() - .2) * 2.6, z: -.8 + R() * 1.6, sp: .32 + R() * .22 });
  }
  const sky = cloud(T, 90, .1, 0xffffff), sd = Array.from({ length: sky.n }, () => ({ x: (R() - .5) * 7, y: (R() - .5) * 4.6, z: -1.2 - R() * 1.2, ph: R() * 6 }));
  g.add(sky.pts);
  g.userData.update = t => {
    star.rotation.y = Math.sin(t * 1.3) * .85; star.rotation.x = Math.sin(t * .9) * .18; star.rotation.z = Math.sin(t * 1.1) * .12; star.scale.setScalar(1 + Math.sin(t * 3) * .04);
    h1.scale.setScalar(4.2 * (1 + Math.sin(t * 3) * .06));
    shots.forEach(o => {
      const life = fract(t * o.sp + o.ph), fade = Math.sin(life * Math.PI);
      o.s.position.set(2.3 + o.ox * .5 + dir.x * life * 6.4, 1.8 + o.oy * .4 + dir.y * life * 6.4, o.z);
      o.head.material.opacity = fade; o.tail.material.opacity = .6 * fade;
    });
    for (let i = 0; i < sky.n; i++) { sky.pos[i * 3] = sd[i].x; sky.pos[i * 3 + 1] = sd[i].y; sky.pos[i * 3 + 2] = sd[i].z; }
    sky.m.opacity = .6 + Math.sin(t * 2.5) * .25; sky.geo.attributes.position.needsUpdate = true;
  };
  return g;
}

export const PLUS_MODELS = { dragon, yacht, jet, island, crystal, butterfly, comet, genie, meteor };
export const PLUS_MODEL_IDS = Object.keys(PLUS_MODELS);
