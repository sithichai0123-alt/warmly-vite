// Gifts Plus — เสียงสังเคราะห์เฉพาะตัวของของขวัญชุดใหม่ (ไม่ต้องมีไฟล์เสียง; ถ้าวางไฟล์ gift-<id>.mp3 ใน public/sounds ระบบเดิมจะใช้ไฟล์ก่อน)
// รับตัวช่วยเสียงจาก sfx ใน App.jsx (h = {tone, noise, arp, bell, pluck, thump, brass, nt}) แล้วคืน {รหัสของขวัญ: ฟังก์ชันเล่นเสียง}
// ทุกเสียงยาวไม่เกิน ~4 วินาที และไม่เสียงดังเกินระดับของขวัญเดิม
export function makeGiftSounds(h) {
  const { tone, noise, arp, bell, pluck, thump, brass, nt } = h;
  return {
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
}
