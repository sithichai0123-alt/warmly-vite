import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // หน้าแอดมิน (admin.html) เป็นหน้าแยกคนละไฟล์กับแอปหลัก — เพิ่มเข้ามาเฉยๆ ไม่กระทบ index.html
  build: {
    rollupOptions: {
      input: { main: "index.html", admin: "admin.html" },
    },
  },
});
