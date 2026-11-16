// Scale/ผู้ใช้ — ส่งฟังก์ชัน seed (ใส่ข้อมูลผู้ใช้ลงแคช) ให้หน้าที่ต้องใช้ โดยไม่ต้องส่งผ่านหลายชั้น
import { createContext } from "react";
export const UsersApiCtx = createContext({ seed: null });
