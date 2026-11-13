// Gifts Plus — เสียงสังเคราะห์ของของขวัญชุดใหม่ (ไม่ต้องมีไฟล์เสียง; ถ้าวางไฟล์ gift-<id>.mp3 ใน public/sounds ระบบเดิมจะใช้ไฟล์ก่อน)
// ออกแบบให้ "เสียงเหมือนของที่ส่ง": มังกร=คำราม+ไฟพ่น · เรือ=หวูด+คลื่น+นกนางนวล · เครื่องบิน=เครื่องยนต์+ฉิว+ปิ๊งในห้องโดยสาร ฯลฯ
// รับตัวช่วยจาก sfx ใน App.jsx: h = {tone, noise, arp, bell, pluck, thump, brass, nt, ac, out}
//   ac()/out() = AudioContext และ master gain — ถ้าไม่มี (หรือสร้างเสียงแบบใหม่พลาด) จะใช้สูตรเดิมแบบง่ายแทน เสียงจึงไม่หายแน่นอน
// ทุกเสียงยาวไม่เกิน ~4.2 วินาที และไม่ดังเกินระดับของขวัญเดิม (ทุกเลเยอร์ ≤ 0.9 ผ่านคอมเพรสเซอร์ของ sfx)

// ───────── ตัวสร้างเสียงแบบละเอียด (ใช้เฉพาะเมื่อมี AudioContext) ─────────
const NOISE = new WeakMap(); // บัฟเฟอร์นอยส์ 2 วินาที สร้างครั้งเดียวต่อ AudioContext
function engine(c, master, trim = 1) {
  const MAXV = .9;
  const out = c.createGain(); out.gain.value = trim; out.connect(master); // ปรับความดังของทั้งเสียงนี้ (ไม่ให้ชิ้นใหญ่ดังกว่าของเดิมเกินไป)
  const noiseBuf = () => {
    let b = NOISE.get(c); if (b) return b;
    const len = Math.floor(c.sampleRate * 2); b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    NOISE.set(c, b); return b;
  };
  // pts = [[วินาทีจากจุดเริ่ม, ค่า], …] ไล่ค่าต่อเนื่อง (exp = ไล่แบบเอ็กซ์โพเนนเชียล สำหรับความถี่)
  const auto = (p, t, pts, exp) => {
    p.setValueAtTime(exp ? Math.max(1, pts[0][1]) : pts[0][1], t + pts[0][0]);
    for (let i = 1; i < pts.length; i++) { const v = exp ? Math.max(1, pts[i][1]) : pts[i][1]; if (exp) p.exponentialRampToValueAtTime(v, t + pts[i][0]); else p.linearRampToValueAtTime(v, t + pts[i][0]); }
  };
  const env = (t, dur, vol) => {
    const g = c.createGain(); const pts = Array.isArray(vol) ? vol : [[0, 0], [.02, vol], [dur, 0]];
    auto(g.gain, t, pts.map(([x, v]) => [x, Math.min(MAXV, v)]), false); g.connect(out); return g;
  };
  const am = (t, dur, a, from) => { // สั่นระดับเสียง (ทำเสียงกระพือ/คำราม)
    const g = c.createGain(); g.gain.value = 1 - a[1] / 2; const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = a[0]; lg.gain.value = a[1] / 2; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(t + dur + .1); from.connect(g); return g;
  };
  const bp = (f, q, type = "bandpass") => { const b = c.createBiquadFilter(); b.type = type; b.Q.value = q; b.frequency.value = Array.isArray(f) ? f[0][1] : f; return b; };
  // นอยส์ที่ผ่านฟิลเตอร์แคบมีพลังงานต่ำมาก → ชดเชยความดังตามความกว้างของแถบความถี่ (ไม่ให้เบากว่าเสียงโทนที่ตั้งค่าไว้เท่ากัน)
  const boost = o => { const fc = Array.isArray(o.f) ? o.f[0][1] : (o.f || 1500), q = o.q || 1, type = o.type || "bandpass"; const bw = type === "bandpass" ? fc / q : fc; return Math.min(4, Math.max(1, Math.sqrt(9000 / Math.max(200, bw)))); };
  const scaleVol = (v, k) => Array.isArray(v) ? v.map(([x, y]) => [x, y * k]) : v * k;
  // เสียงลม/น้ำ/ไฟ: นอยส์ผ่านฟิลเตอร์ที่กวาดความถี่ได้
  function noise(t0, dur, o = {}) {
    const t = c.currentTime + t0, s = c.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
    const f = bp(o.f || 1500, o.q || 1, o.type || "bandpass"); if (Array.isArray(o.f)) auto(f.frequency, t, o.f, true);
    s.connect(f); let n = f;
    if (o.hp) { const h = bp(o.hp, .7, "highpass"); n.connect(h); n = h; }
    if (o.am) n = am(t, dur, o.am, n);
    n.connect(env(t, dur, scaleVol(o.vol == null ? .3 : o.vol, boost(o)))); s.start(t, Math.random()); s.stop(t + dur + .1);
  }
  // เสียงที่มีระดับเสียง: ไล่ความถี่ได้, ฟอร์มันต์ (รูปปาก/คอ), สั่นระดับเสียง, สั่นความถี่
  function osc(t0, dur, o = {}) {
    const t = c.currentTime + t0, s = c.createOscillator(); s.type = o.type || "sine";
    auto(s.frequency, t, Array.isArray(o.f) ? o.f : [[0, o.f]], true); if (o.detune) s.detune.value = o.detune;
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib[1]; lg.gain.value = o.vib[0]; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur + .1); }
    let n = s;
    if (o.form) { const mix = c.createGain(); o.form.forEach(pts => { const b = bp(pts, o.q || 5); auto(b.frequency, t, pts, true); s.connect(b); b.connect(mix); }); n = mix; }
    else if (o.lp) { const l = bp(o.lp, .8, "lowpass"); if (Array.isArray(o.lp)) auto(l.frequency, t, o.lp, true); n.connect(l); n = l; }
    if (o.am) n = am(t, dur, o.am, n);
    n.connect(env(t, dur, o.vol == null ? .3 : o.vol)); s.start(t); s.stop(t + dur + .1);
  }
  return { noise, osc };
}

// สุ่มแบบกำหนดผลได้ (จังหวะเสียงเหมือนกันทุกครั้ง)
function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function makeGiftSounds(h) {
  const { tone, noise, arp, bell, pluck, thump, brass, nt } = h;

  // ───────── สูตรเดิมแบบง่าย (สำรอง) ─────────
  const basic = {
    icecream() { arp([12, 16, 19, 16, 12, 16, 19, 24], 0, .11, { dur: .22, vol: .3 }); bell(nt(36), .9, .2, .9); },
    balloon() { tone(300, 0, .38, { vol: .3, slide: 2.4, vib: [10, 8] }); noise(.4, .09, { vol: .5, from: 6000, to: 800 }); bell(nt(28), .48, .2, .7); bell(nt(33), .56, .16, .7); },
    chocolate() { arp([0, 4, 7, 12, 16, 12, 7, 4], 0, .14, { dur: .4, vol: .28, type: "triangle", lp: 2600 }); bell(nt(24), 1.1, .2, 1.2); },
    unicorn() { arp([12, 14, 16, 19, 21, 24, 28, 31], 0, .07, { dur: .3, vol: .3 }); bell(nt(36), .62, .22, 1.2); bell(nt(38), .72, .16, 1.2); noise(.1, .7, { vol: .06, from: 9000, to: 5000, hp: 3500 }); },
    guitar() { [-12, -8, -5, 0, 4].forEach((s, i) => pluck(nt(s), i * .05, .32)); [-10, -5, -1, 2, 7].forEach((s, i) => pluck(nt(s), .7 + i * .045, .3)); pluck(nt(12), 1.4, .3); },
    champagne() { thump(0, .6, 120); noise(0, .28, { vol: .7, from: 5000, to: 600 }); noise(.22, 1.2, { vol: .12, from: 9000, to: 5000, hp: 4000 }); bell(nt(31), .32, .2, 1); bell(nt(36), .5, .15, 1); },
    dragon() { tone(nt(-31), 0, 1.7, { type: "sawtooth", vol: .42, lp: 600, slide: .5, vib: [10, 9] }); noise(.1, 1.4, { vol: .5, from: 1800, to: 150 }); thump(.2, .7, 60); thump(.95, .6, 55); [0, 7, 12].forEach((s, i) => brass(s - 12, 1.1 + i * .12, 1.1, .26)); },
    yacht() { tone(nt(-24), 0, .9, { type: "sawtooth", vol: .3, lp: 700 }); tone(nt(-17), 0, .9, { type: "sawtooth", vol: .24, lp: 700 }); noise(.2, 2.2, { vol: .14, from: 1200, to: 300 }); arp([12, 16, 19, 24], 1.2, .16, { dur: .5, vol: .28 }); bell(nt(31), 1.9, .18, 1.2); },
    jet() { noise(0, 2.3, { vol: .45, from: 500, to: 9000 }); tone(120, 0, 2.1, { type: "sawtooth", vol: .3, slide: 8, lp: 1500 }); arp([12, 19, 24], 2, .12, { dur: .6, vol: .3 }); bell(nt(36), 2.4, .18, 1.2); },
    island() { noise(0, 2.2, { vol: .16, from: 1500, to: 400 }); [0, 4, 7, 12, 7, 4, 0, 7].forEach((s, i) => bell(nt(s + 12), .2 + i * .22, .2, .8)); noise(1.8, 1.4, { vol: .12, from: 1200, to: 300 }); },
    crystal() { [24, 28, 31, 36].forEach((s, i) => bell(nt(s), i * .18, .22, 1.8)); tone(nt(-12), 0, 1.5, { vol: .22, vib: [5, 4], att: .3 }); noise(.4, 1, { vol: .06, from: 9000, to: 5000, hp: 4000 }); },
    butterfly() { arp([28, 31, 35, 38, 43, 38, 35, 31], 0, .09, { dur: .3, vol: .26 }); bell(nt(36), .8, .2, 1.4); noise(0, .9, { vol: .05, from: 9500, to: 6000, hp: 5000 }); },
    comet() { noise(0, 1, { vol: .5, from: 9000, to: 400 }); tone(2000, 0, 1, { vol: .22, slide: .1 }); thump(1, .7, 70); [0, 4, 7, 12].forEach((s, i) => bell(nt(s + 24), 1.05 + i * .1, .22, 1.5)); },
    genie() { tone(nt(-12), 0, 1.4, { type: "sawtooth", vol: .3, lp: 500, vib: [6, 4], att: .3 }); arp([0, 3, 7, 10, 12, 15, 19], .3, .16, { dur: .6, vol: .26 }); brass(0, 1.5, 1.2, .26); brass(7, 1.5, 1.2, .22); bell(nt(36), 1.7, .22, 1.8); noise(1.5, 1.4, { vol: .1, from: 9000, to: 3000, hp: 3500 }); },
    meteor() { for (let i = 0; i < 12; i++) bell(nt(12 + [0, 2, 4, 7, 9][i % 5] + (i > 6 ? 12 : 0)), i * .13, .17, .8); noise(0, 1.8, { vol: .08, from: 9000, to: 3000, hp: 4500 }); thump(1.6, .5, 65); bell(nt(36), 1.65, .24, 1.8); },
  };

  // ───────── สูตรแบบเหมือนของจริง ─────────
  const rich = E => {
    const { noise: N, osc: O } = E, hz = nt;
    return {
      // 🍦 รถไอศกรีม: กล่องดนตรีทำนองสั้นๆ + กระดิ่งจักรยานปิ๊งๆ
      icecream() {
        [0, 4, 7, 12, 7, 4, 0, -5, 0, 4, 7].forEach((s, i) => { const t = i * .17; O(t, .32, { type: "triangle", f: hz(s + 12), vol: .22, lp: 3200 }); O(t, .22, { f: hz(s + 24), vol: .1 }); });
        bell(hz(31), 1.95, .2, .8); bell(hz(31), 2.15, .2, .9); noise(1.9, .25, { vol: .05, from: 9000, to: 5000, hp: 4000 });
      },
      // 🎈 ลูกโป่ง: เป่าลมเป็นจังหวะ → ยางเสียดสีเสียงแหลม → ปุ๊! → ประกายเบาๆ
      balloon() {
        N(0, .95, { f: [[0, 1500], [.95, 3600]], q: .9, am: [7, .85], vol: .3 });
        O(.15, .75, { f: [[0, 520], [.2, 900], [.4, 760], [.75, 1500]], vib: [30, 11], type: "triangle", vol: .16 });
        N(1.1, .12, { f: 4500, q: .5, hp: 1200, vol: .6 }); thump(1.1, .45, 140);
        bell(hz(33), 1.28, .2, .8); bell(hz(40), 1.4, .15, .8);
      },
      // 🍫 ช็อกโกแลต: ห่อฟอยล์ยับ → หักแท่ง "แกร๊บ" → เมโลดี้นุ่มละมุน
      chocolate() {
        const r = lcg(5); for (let i = 0; i < 16; i++) N(i * .04 + r() * .02, .05 + r() * .04, { f: 4200 + r() * 3000, q: 3, vol: .1 + r() * .14 });
        N(.78, .05, { f: 2600, q: .8, hp: 1500, vol: .6 }); thump(.78, .4, 170);
        [0, 4, 7, 12, 16, 12, 7, 4].forEach((s, i) => O(.95 + i * .2, .55, { type: "triangle", f: hz(s), vol: .2, lp: 1600 }));
        bell(hz(24), 1.1, .16, 1.1);
      },
      // 🦄 ยูนิคอร์น: พิณไล่เสียงขึ้น → เสียงร้องฮี้ของม้า → ประกายเวทมนตร์
      unicorn() {
        [12, 14, 16, 19, 21, 24, 28, 31, 36].forEach((s, i) => { pluck(hz(s), i * .06, .25); });
        O(.62, .85, { type: "sawtooth", f: [[0, 620], [.12, 1250], [.3, 1050], [.55, 900], [.85, 480]], vib: [32, 24], form: [[[0, 900], [.85, 1500]], [[0, 2300], [.85, 2900]]], q: 6, vol: .55 });
        N(.62, .5, { f: 3000, q: .6, hp: 1500, vol: .06 });
        N(1.5, 1.3, { f: 9000, q: .6, hp: 5000, vol: .06, am: [14, .7] }); bell(hz(40), 1.55, .2, 1.4); bell(hz(43), 1.7, .16, 1.4);
      },
      // 🎸 กีตาร์: สตรัมคอร์ดเต็มเสียง + เสียงนิ้วสไลด์สาย + ตัวกีตาร์กังวาน
      guitar() {
        [-12, -8, -5, 0, 4].forEach((s, i) => { pluck(hz(s), i * .045, .3); pluck(hz(s + 12), i * .045 + .01, .08); });
        N(0, .12, { f: 3200, q: 2, vol: .08 }); thump(0, .3, 105);
        [-10, -5, -1, 2, 7].forEach((s, i) => pluck(hz(s), .85 + i * .04, .28));
        N(.85, .35, { f: [[0, 1800], [.35, 4500]], q: 4, vol: .04 }); pluck(hz(12), 1.6, .24); pluck(hz(16), 1.75, .2);
      },
      // 🍾 แชมเปญ: จุกเด้ง "ป๊อก!" → ฟองซ่าลากยาว → แก้วชนกัน "กริ๊ง"
      champagne() {
        N(0, .09, { f: 3800, q: .5, hp: 900, vol: .75 }); thump(0, .7, 150); thump(.04, .4, 95);
        N(.1, 1.7, { f: 6500, q: .5, hp: 2800, vol: .22, am: [28, .6] });
        const r = lcg(11); for (let i = 0; i < 22; i++) O(.2 + r() * 1.5, .03 + r() * .03, { f: 2200 + r() * 3800, vol: .07 });
        bell(hz(41), 1.35, .22, 1.2); bell(hz(45), 1.5, .2, 1.2); bell(hz(48), 1.62, .12, 1.2);
      },
      // 🐉 มังกร: กระพือปีก → คำรามฟอร์มันต์ต่ำกระด้าง → ไฟพ่นฟู่ๆ + เปรี๊ยะ → ครืนท้ายเสียง
      dragon() {
        thump(0, .55, 66); thump(.36, .55, 60); thump(.72, .5, 58);
        O(.35, 1.85, { type: "sawtooth", f: [[0, 72], [.28, 155], [.9, 118], [1.85, 52]], am: [38, .75], form: [[[0, 520], [.45, 950], [1.0, 720], [1.85, 330]], [[0, 1150], [.5, 1750], [1.85, 800]]], q: 5, vol: .7 });
        O(.35, 1.85, { type: "sawtooth", f: [[0, 108], [.28, 230], [.9, 175], [1.85, 80]], detune: 18, am: [34, .6], lp: [[0, 700], [1.85, 300]], vol: .3 });
        N(.35, 1.5, { f: [[0, 800], [.6, 1200], [1.5, 350]], q: 1.2, vol: .38 });
        N(1.65, 1.9, { f: [[0, 450], [.45, 1900], [1.9, 650]], q: .8, vol: .55 });
        const r = lcg(3); for (let i = 0; i < 14; i++) N(1.8 + r() * 1.5, .04 + r() * .05, { f: 2800 + r() * 2500, q: 2, hp: 1800, vol: .3 });
        thump(1.7, .6, 56); O(1.7, 1.7, { f: [[0, 60], [1.7, 36]], vol: .5, lp: 200 });
      },
      // ⛵ เรือยอชต์: หวูดเรือ (คอร์ดต่ำ) → คลื่นซัดสาด → นกนางนวลร้อง → กระดิ่งเรือ
      yacht() {
        const horn = (t, d) => { O(t, d, { type: "sawtooth", f: hz(-26), vol: [[0, 0], [.07, .42], [d - .15, .4], [d, 0]], lp: 800 }); O(t, d, { type: "sawtooth", f: hz(-21), vol: [[0, 0], [.07, .32], [d - .15, .3], [d, 0]], lp: 800, detune: 6 }); };
        horn(0, 1.15); horn(1.35, .5);
        N(.1, 2.2, { f: [[0, 350], [1.0, 950], [2.2, 380]], q: .5, type: "lowpass", vol: [[0, 0], [1, .32], [2.2, 0]] });
        N(1.9, 1.9, { f: [[0, 320], [.9, 900], [1.9, 350]], q: .5, type: "lowpass", vol: [[0, 0], [.9, .28], [1.9, 0]] });
        N(.5, 2.4, { f: 3200, q: .5, hp: 2200, vol: .035, am: [.6, .8] });
        const gull = t => { O(t, .55, { type: "triangle", f: [[0, 1650], [.1, 2500], [.28, 1950], [.5, 1400]], vib: [45, 26], vol: .2, form: [[[0, 2000], [.5, 1700]]], q: 1.5 }); };
        gull(1.0); gull(1.25); gull(2.7);
        bell(hz(33), 3.05, .22, 1.1); bell(hz(33), 3.35, .2, 1.1);
      },
      // ✈️ เครื่องบินเจ็ต: เครื่องยนต์ไต่รอบ + เสียงหวีด → ฉิวผ่านหูแบบดอปเปลอร์ → ปิ๊ง-ป่องในห้องโดยสาร
      jet() {
        O(0, 3.0, { type: "sawtooth", f: [[0, 70], [1.5, 430], [2.2, 380], [3.0, 120]], lp: [[0, 300], [1.5, 3600], [3.0, 500]], vol: [[0, 0], [.25, .38], [1.5, .5], [3.0, 0]] });
        O(0, 2.6, { f: [[0, 520], [1.5, 2700], [2.6, 1500]], vol: [[0, 0], [.4, .08], [1.6, .14], [2.6, 0]] });
        N(0, 3.0, { f: [[0, 400], [1.5, 2600], [3.0, 600]], q: .5, vol: [[0, 0], [.35, .3], [1.6, .72], [3.0, 0]] });
        N(1.3, 1.9, { f: [[0, 3400], [.8, 1900], [1.9, 450]], q: .7, vol: [[0, 0], [.2, .45], [1.9, 0]] });
        O(1.3, 1.6, { f: [[0, 1700], [1.6, 640]], vol: [[0, 0], [.1, .1], [1.6, 0]] });
        bell(hz(33), 3.0, .22, 1.2); bell(hz(26), 3.3, .22, 1.3);
      },
      // 🏝️ เกาะส่วนตัว: คลื่นซัดฝั่ง → อูคูเลเล่เพนทาโทนิก + กลองสตีล → นกนางนวล → ไม้มะพร้าวกระทบ
      island() {
        N(0, 2.4, { f: [[0, 360], [1.1, 1000], [2.4, 400]], q: .5, type: "lowpass", vol: [[0, 0], [1.1, .3], [2.4, 0]] });
        N(1.9, 2.2, { f: [[0, 330], [1.0, 900], [2.2, 380]], q: .5, type: "lowpass", vol: [[0, 0], [1.0, .26], [2.2, 0]] });
        N(.3, 3.6, { f: 3500, q: .5, hp: 2400, vol: .03, am: [.45, .8] });
        [0, 4, 7, 9, 7, 4, 2, 0, 4, 7].forEach((s, i) => { const t = .35 + i * .22; pluck(hz(s + 12), t, .3); O(t, .35, { f: hz(s + 24), vol: .1 }); });
        O(2.3, .5, { type: "triangle", f: [[0, 1700], [.1, 2400], [.28, 1900], [.5, 1450]], vib: [40, 24], vol: .17 });
        [2.9, 3.12, 3.45].forEach((t, i) => { O(t, .09, { type: "square", f: [[0, 760 - i * 60], [.09, 420]], vol: .22, lp: 1800 }); });
      },
      // 💎 คริสตัล: ระฆังแก้วเรียงเสียงสูง + ฮาร์โมนิกขอบแก้ว + ประกายแตกกระจาย
      crystal() {
        [36, 40, 43, 48, 52].forEach((s, i) => bell(hz(s), i * .16, .2, 2.2));
        O(0, 2.8, { f: hz(24), vol: [[0, 0], [.9, .13], [2.8, 0]], vib: [3, 5] }); O(0, 2.8, { f: hz(24) * 1.5, vol: [[0, 0], [1.1, .09], [2.8, 0]], vib: [3, 5.5] });
        N(.3, 2.2, { f: 8000, q: .7, hp: 5000, vol: .06, am: [11, .8] });
        const r = lcg(9); for (let i = 0; i < 8; i++) O(1 + r() * 1.8, .06, { f: 5500 + r() * 3500, vol: .08 });
      },
      // 🦋 ผีเสื้อ: ปีกกระพือเป็นจังหวะเบาๆ + เซเลสตาใสๆ ลอยขึ้น
      butterfly() {
        N(0, .8, { f: 1900, q: 1.2, am: [15, .95], vol: .2 }); N(.95, .75, { f: 2300, q: 1.2, am: [17, .95], vol: .16 });
        [28, 31, 35, 38, 43, 38, 35, 31, 35, 40].forEach((s, i) => { const t = .15 + i * .16; O(t, .4, { f: hz(s), vol: .15 }); O(t, .25, { f: hz(s + 12), vol: .05 }); });
        bell(hz(47), 1.8, .16, 1.4); N(1.6, 1.3, { f: 8500, q: .6, hp: 5000, vol: .04 });
      },
      // ☄️ ดาวหาง: ฉึ่บพุ่งผ่านหู (ดอปเปลอร์) + เสียงไหม้ซ่า → ตูมกระแทก → ประกายหางดาว
      comet() {
        N(0, 2.0, { f: [[0, 6200], [.9, 1600], [2.0, 300]], q: .7, vol: [[0, 0], [.15, .7], [1.2, .35], [2.0, 0]] });
        O(0, 1.5, { f: [[0, 2600], [1.4, 280]], vol: [[0, 0], [.1, .14], [1.5, 0]] });
        N(.1, 1.5, { f: 6500, q: .6, hp: 4500, vol: .18, am: [42, .8] });
        thump(1.3, .8, 62); N(1.3, 1.3, { f: [[0, 500], [1.3, 70]], type: "lowpass", q: .6, vol: .6 }); O(1.3, 1.4, { f: [[0, 70], [1.4, 38]], vol: .5, lp: 180 });
        [24, 28, 31, 36].forEach((s, i) => bell(hz(s + 12), 1.7 + i * .12, .2, 1.4));
      },
      // 🧞 จินนี่: ควันม้วนขึ้น → เสียง "อู้วว" ลึกลับ → ทำนองสเกลอาหรับ (ฟรีเจียนโดมิแนนต์) + กังวานนิ้ว
      genie() {
        N(0, 1.5, { f: [[0, 320], [.8, 2300], [1.5, 1200]], q: 1.4, vol: [[0, 0], [.7, .36], [1.5, 0]] });
        O(.25, 1.6, { type: "sawtooth", f: [[0, 118], [.9, 96], [1.6, 82]], vib: [4, 5], form: [[[0, 360], [1.6, 300]], [[0, 850], [1.6, 640]]], q: 4, vol: [[0, 0], [.3, .45], [1.2, .38], [1.6, 0]] });
        [0, 1, 4, 5, 7, 5, 4, 1, 0, 4].forEach((s, i) => { const t = .75 + i * .23; O(t, .42, { type: "sawtooth", f: hz(s + 12), vib: [6, 5.5], lp: 2000, vol: [[0, 0], [.04, .2], [.42, 0]] }); });
        bell(hz(41), 1.0, .14, 1.0); bell(hz(41), 2.0, .14, 1.2); bell(hz(36), 3.05, .22, 1.5); N(2.9, 1.2, { f: 9000, q: .6, hp: 4000, vol: .07, am: [13, .8] });
      },
      // 🌠 ฝนดาวตก: เสียงหวีดดาวร่วงไล่ลง (หลายดวงซ้อน) + ไหม้เปรี๊ยะ → ตกกระแทก ก้อนหินกระเด็น → ประกายท้ายเสียง
      meteor() {
        [[0, 3600], [.28, 3000], [.52, 3900], [.85, 2800], [1.15, 3300], [1.35, 3700]].forEach(([t, f0]) => { O(t, .65, { f: [[0, f0], [.65, f0 * .2]], vol: [[0, 0], [.04, .17], [.65, 0]] }); N(t, .5, { f: [[0, f0 * .7], [.5, f0 * .2]], q: 1.5, vol: .06 }); });
        N(.1, 1.7, { f: 5200, q: .6, hp: 3200, vol: .12, am: [34, .8] });
        thump(1.7, .8, 60); N(1.7, 1.4, { f: [[0, 520], [1.4, 60]], type: "lowpass", q: .6, vol: .6 }); O(1.7, 1.5, { f: [[0, 64], [1.5, 36]], vol: .5, lp: 160 });
        const r = lcg(21); for (let i = 0; i < 9; i++) N(1.85 + r() * 1.2, .05, { f: 1500 + r() * 2500, q: 3, vol: .22 });
        bell(hz(36), 2.1, .2, 1.8); bell(hz(43), 2.25, .16, 1.8);
      },
    };
  };

  // ───────── เลือกแบบ: ถ้ามี AudioContext ใช้แบบเหมือนของจริง ไม่งั้น/พลาดก็ใช้แบบง่าย ─────────
  const TRIM = { icecream: .55, balloon: .6, chocolate: .55, unicorn: .7, guitar: 1, champagne: .8, dragon: .4, yacht: .28, jet: .27, island: .6, crystal: .75, butterfly: .6, comet: .45, genie: .65, meteor: .45 };
  const getRich = id => {
    try {
      const c = h.ac && h.ac(), out = h.out && h.out();
      if (!c || !out || typeof c.createBufferSource !== "function") return null;
      return rich(engine(c, out, TRIM[id] || 1));
    } catch { return null; }
  };
  const result = {};
  Object.keys(basic).forEach(id => {
    result[id] = () => {
      const R = getRich(id);
      if (R && R[id]) { try { R[id](); return; } catch { /* ใช้แบบง่ายต่อ */ } }
      basic[id]();
    };
  });
  return result;
}
