// Feed Video — จำว่าผู้ใช้เคยกดเปิดเสียงแล้ว (คลิปถัดไปจะเล่นพร้อมเสียงถ้าเบราว์เซอร์อนุญาต)
import { SOUND_KEY } from "./config.js";
let mem = false;
export function getSoundOn() { try { const v = window.localStorage.getItem(SOUND_KEY); if (v != null) return v === "1"; } catch (e) { /* ใช้ค่าในหน่วยความจำ */ } return mem; }
export function setSoundOn(on) { mem = !!on; try { window.localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ } }
