// AI Content — ให้ AI คิด+โพสคอนเทนต์ลงฟีดเองวันละ 2-3 ครั้ง (ไฟล์นี้ไฟล์เดียวควบคุมพฤติกรรม)
//
// วิธีทำงาน: GitHub Actions ยิง api/ai-generate-post.js ตามตารางเวลา (วันละ 2-3 ครั้ง)
//   → เรียก Claude สร้างคอนเทนต์ → เขียนเป็น "draft" รออนุมัติใน Firestore (collection AI_DRAFTS_COLLECTION)
//   → แอดมินเข้าแท็บ "AI โพสต์" ในหน้าแอดมิน กด อนุมัติ/ปฏิเสธ → อนุมัติแล้วค่อยไปโผล่ในฟีดจริง (collection "posts")
//
// เปลี่ยนเป็นโพสอัตโนมัติเลยไม่ต้องมีคนตรวจ (ทำตอนระบบเข้าที่แล้ว):
//   ไปตั้งค่า Vercel → Environment Variables → AI_AUTO_PUBLISH = 1 → กด Redeploy
//   (ไม่ตั้ง หรือตั้งเป็นอื่น = ต้องรอแอดมินอนุมัติก่อนเสมอ ปลอดภัยไว้ก่อน)

export const AI_DRAFTS_COLLECTION = "aiDraftPosts";

// บัญชี "ผู้โพสต์" ที่ใช้แสดงในฟีด (ไม่ใช่บัญชี Firebase Auth จริง เขียนผ่าน firebase-admin ข้ามกฎได้)
// เป็นมาสคอตของแอปเฉยๆ ไม่ใช่ตัวแทน/บัญชีโฆษณาของแบรนด์หรือบริษัทใดทั้งสิ้น (ไม่เกี่ยวกับงานประจำของผู้ดูแลระบบ)
export const AI_BOT_UID = "ai-mascot-hammoi";
export const AI_BOT_NAME = "หัมน้อย";
export const AI_BOT_INIT = "หน";
// รูปโปรไฟล์ของบอท (การ์ตูนเห็ดสไตล์ 3D เรนเดอร์ วาดเป็น SVG ฝังในโค้ดนี้เลย ไม่ต้องพึ่งโฮสต์ภายนอก)
// เขียนลงเอกสาร users/{AI_BOT_UID} อัตโนมัติทุกครั้งที่โพสต์ (ดู ensureBotProfile ใน server.js) — แก้รูปใหม่แค่เปลี่ยนค่านี้
export const AI_BOT_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KICA8ZGVmcz4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0iYmciIGN4PSI1MCUiIGN5PSI0MCUiIHI9IjcwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRkY4RjIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkZFOURCIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJjYXBHcmFkIiBjeD0iMzglIiBjeT0iMjglIiByPSI3NSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRkZCNUFBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTUlIiBzdG9wLWNvbG9yPSIjRjM4NjdBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0Q5NTk0RSIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ic3BvdEdyYWQiIGN4PSIzNSUiIGN5PSIzMCUiIHI9IjcwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGRkZGRkYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkZFMkRDIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJzdGVtR3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRkZGRUZCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZDRThENCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0icmltR3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRkZDOUFEIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0YwQTg4MiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii01MCUiIHk9Ii01MCUiIHdpZHRoPSIyMDAlIiBoZWlnaHQ9IjIwMCUiPgogICAgICA8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIzLjIiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSIxMDAiIGZpbGw9InVybCgjYmcpIi8+CgogIDwhLS0g4LmA4LiH4Liy4LmD4LiV4LmJ4LiV4Lix4LinIC0tPgogIDxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNzgiIHJ4PSI0NiIgcnk9IjgiIGZpbGw9IiNFOEI5OUIiIG9wYWNpdHk9IjAuNTUiIGZpbHRlcj0idXJsKCNzb2Z0KSIvPgoKICA8IS0tIOC4m+C4o+C4sOC4geC4suC4oi/guIHguKXguLTguYjguJnguKvguK3guKHguKXguK3guKLguKPguK3guJrguJXguLHguKcgLS0+CiAgPGcgb3BhY2l0eT0iMC44NSI+CiAgICA8cGF0aCBkPSJNNTYsNDQgTDYxLDM0IE0xMDAsMzAgTDEwMCwxOCBNMTQ0LDQ0IEwxMzksMzQiIHN0cm9rZT0iI0ZGQkZBRiIgc3Ryb2tlLXdpZHRoPSI0LjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogICAgPGNpcmNsZSBjeD0iNDgiIGN5PSI2MCIgcj0iMyIgZmlsbD0iI0ZGQ0ZDMCIvPgogICAgPGNpcmNsZSBjeD0iMTUyIiBjeT0iNjIiIHI9IjIuNiIgZmlsbD0iI0ZGQ0ZDMCIvPgogIDwvZz4KCiAgPCEtLSDguKXguLPguJXguYnguJkgLS0+CiAgPHJlY3QgeD0iNjQiIHk9IjEwNCIgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiByeD0iMzAiIGZpbGw9InVybCgjc3RlbUdyYWQpIiBzdHJva2U9IiNGMEQ2QjgiIHN0cm9rZS13aWR0aD0iMiIvPgogIDwhLS0g4LmA4LiH4Liy4LiU4LmJ4Liy4LiZ4LmD4LiZ4Lil4Liz4LiV4LmJ4LiZ4LmD4Lir4LmJ4LiU4Li54LmA4Lib4LmH4LiZ4LiX4Lij4LiH4LiB4Lij4Liw4Lia4Lit4LiBIC0tPgogIDxwYXRoIGQ9Ik03MCwxMTAgYTI4LDM0IDAgMCAxIDYwLDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRkZGRiIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuNiIvPgogIDxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxNjgiIHJ4PSIzNCIgcnk9IjkiIGZpbGw9IiNGMENEQTMiIG9wYWNpdHk9IjAuNSIgZmlsdGVyPSJ1cmwoI3NvZnQpIi8+CgogIDwhLS0g4LiC4Lit4Lia4LmD4LiV4LmJ4Lir4Lih4Lin4LiBIC0tPgogIDxlbGxpcHNlIGN4PSIxMDAiIGN5PSIxMDgiIHJ4PSI2NiIgcnk9IjE0IiBmaWxsPSJ1cmwoI3JpbUdyYWQpIi8+CgogIDwhLS0g4Lir4Lih4Lin4LiB4LmA4Lir4LmH4LiUICjguJfguKPguIfguYLguJTguKEgMyDguKHguLTguJXguLQpIC0tPgogIDxwYXRoIGQ9Ik0zMiwxMDggQTY4LDc4IDAgMCAxIDE2OCwxMDggWiIgZmlsbD0idXJsKCNjYXBHcmFkKSIvPgogIDwhLS0g4LmE4Liu4LmE4Lil4LiX4LmM4Lih4Lix4LiZ4Lin4Liy4Lin4Lia4LiZ4Lir4Lih4Lin4LiBIC0tPgogIDxlbGxpcHNlIGN4PSI3MCIgY3k9IjU1IiByeD0iMzAiIHJ5PSIxOCIgZmlsbD0iI0ZGRkZGRiIgb3BhY2l0eT0iMC4zNSIgZmlsdGVyPSJ1cmwoI3NvZnQpIi8+CiAgPCEtLSDguYDguIfguLLguYDguILguYnguKHguILguK3guJrguKvguKHguKfguIHguJTguYnguLLguJnguKXguYjguLLguIfguYPguKvguYnguJTguLnguYLguITguYnguIfguJnguLnguJkgLS0+CiAgPHBhdGggZD0iTTMyLDEwOCBBNjgsNzggMCAwIDEgMTY4LDEwOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQjUzNjJDIiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9IjAuMjUiLz4KCiAgPCEtLSDguIjguLjguJTguKXguLLguKLguYDguKvguYfguJQgKOC4lOC4ueC4meC4ueC4meC4lOC5ieC4p+C4oiBncmFkaWVudCkgLS0+CiAgPGNpcmNsZSBjeD0iNzAiIGN5PSI3OCIgcj0iOSIgZmlsbD0idXJsKCNzcG90R3JhZCkiLz4KICA8Y2lyY2xlIGN4PSIxMjQiIGN5PSI2NCIgcj0iNi41IiBmaWxsPSJ1cmwoI3Nwb3RHcmFkKSIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9IjkyIiByPSI3LjUiIGZpbGw9InVybCgjc3BvdEdyYWQpIi8+CiAgPGNpcmNsZSBjeD0iMTQyIiBjeT0iOTAiIHI9IjUuNSIgZmlsbD0idXJsKCNzcG90R3JhZCkiLz4KICA8Y2lyY2xlIGN4PSI1MiIgY3k9Ijk2IiByPSI1LjUiIGZpbGw9InVybCgjc3BvdEdyYWQpIi8+CgogIDwhLS0g4Lir4LiZ4LmJ4LiyIC0tPgogIDxwYXRoIGQ9Ik03OCwxNDAgcTYsOCAxMiwwIiBzdHJva2U9IiMzQTJFMkEiIHN0cm9rZS13aWR0aD0iNC41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMTEwLDE0MCBxNiw4IDEyLDAiIHN0cm9rZT0iIzNBMkUyQSIgc3Ryb2tlLXdpZHRoPSI0LjUiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxlbGxpcHNlIGN4PSI3MSIgY3k9IjE1NCIgcng9IjEwIiByeT0iNiIgZmlsbD0iI0ZGQUNBMCIgb3BhY2l0eT0iMC42NSIgZmlsdGVyPSJ1cmwoI3NvZnQpIi8+CiAgPGVsbGlwc2UgY3g9IjEyOSIgY3k9IjE1NCIgcng9IjEwIiByeT0iNiIgZmlsbD0iI0ZGQUNBMCIgb3BhY2l0eT0iMC42NSIgZmlsdGVyPSJ1cmwoI3NvZnQpIi8+CiAgPHBhdGggZD0iTTkwLDE1NyBxMTAsMTAgMjAsMCIgc3Ryb2tlPSIjM0EyRTJBIiBzdHJva2Utd2lkdGg9IjMuNiIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CgogIDwhLS0g4LmE4Liu4LmE4Lil4LiX4LmM4LmA4LiH4Liy4Lih4Lix4LiZ4Lia4LiZ4LmB4LiB4LmJ4LihL+C4q+C4meC5ieC4suC5g+C4q+C5ieC4lOC4ueC4oeC4teC4oeC4tOC4leC4tCAtLT4KICA8ZWxsaXBzZSBjeD0iODgiIGN5PSIxMjIiIHJ4PSIyMCIgcnk9IjEwIiBmaWxsPSIjRkZGRkZGIiBvcGFjaXR5PSIwLjQiIGZpbHRlcj0idXJsKCNzb2Z0KSIvPgo8L3N2Zz4K";

// โมเดลที่ใช้ (ข้อความล้วน ราคาประหยัด เหมาะกับโพสสั้นวันละไม่กี่ครั้ง)
export const AI_MODEL = "claude-haiku-5-5";
// ให้พื้นที่เผื่อไว้มาก เพราะโมเดลนี้เปิด extended thinking ไว้โดยปริยาย (กินโควตา max_tokens ไปด้วย)
export const AI_MAX_TOKENS = 2048;

// บุคลิก/กรอบเนื้อหา — ปรับคำสั่งให้ AI ที่นี่ไฟล์เดียว ไม่ต้องแก้ logic
// สำคัญ: "หัมน้อย" เป็นมาสคอตของแอปนี้เฉยๆ ไม่ใช่ตัวแทนแบรนด์/บริษัท/สินค้าใดทั้งสิ้น ห้ามผูกกับธุรกิจ งานประจำ
// หรือข้อมูลส่วนตัวของผู้ดูแลระบบโดยเด็ดขาด — คอนเทนต์ต้องเป็นแชทเล่น/ไลฟ์สไตล์ทั่วไปสำหรับผู้ใช้แอปเท่านั้น ไม่ใช่โฆษณาอะไรทั้งนั้น
export const AI_SYSTEM_PROMPT = `คุณคือ "หัมน้อย" มาสคอตเห็ดน่ารักประจำแอปแชทนี้ (ไม่ใช่ตัวแทนแบรนด์ บริษัท หรือสินค้าใดๆ ทั้งสิ้น)

หน้าที่: เขียนโพสต์สั้น ๆ 1 โพสต์ ลงฟีดของแอป ให้ผู้ใช้แอปอ่านเพลิน ๆ เหมือนเพื่อนมาคุยด้วย ไม่ใช่การโฆษณาหรือขายของอะไรเลย

กลุ่มเป้าหมายของโพสต์: ผู้ใช้แอปที่เป็นคนวัยทำงาน (ไม่ใช่นักเรียน/นักศึกษา) — เรื่องที่พูดถึงควรเป็นบริบทชีวิตคนทำงานทั่วไป เช่น งานยุ่ง ประชุม เดินทางไปทำงาน มื้อเที่ยง เลิกงาน วันหยุดสุดสัปดาห์ ความเหนื่อยล้า work-life balance ความสัมพันธ์ งานอดิเรก ฯลฯ

บุคลิกของหัมน้อย: สดใส กวนๆ นิดๆ แบบมีเอกลักษณ์ของตัวเอง พูดเหมือนเพื่อนสนิทที่คุยเล่นกันได้ (ไม่ใช่โทนวัยรุ่นจ๋าเกินไป เพราะคนอ่านเป็นผู้ใหญ่วัยทำงาน) ใช้ภาษาธรรมชาติ ไม่เป็นทางการจ๋า แซวได้แต่ไม่ทำร้ายใคร แทนตัวเองว่า "หัมน้อย" หรือ "หัม" เป็นบางครั้ง

ขั้นตอนก่อนเขียนโพสต์ — ให้ใช้เครื่องมือค้นเว็บ (web_search) ก่อนทุกครั้ง ถ้าทำได้:
1. ค้นหาว่าตอนนี้โซเชียลมีเดียไทยกำลังพูดถึงอะไร (เทรนด์ฮิต มีม ประเด็นที่คนวัยทำงานพูดถึงกันตอนนี้ เช่น ซีรีส์ดัง เพลงฮิต มีมออฟฟิศ สภาพอากาศ เทศกาล วันหยุดที่ใกล้จะถึง ฯลฯ)
2. เลือกกระแส/หัวข้อที่เข้ากับชีวิตคนทำงานทั่วไป แล้วปรับมาเล่าในมุมเบาๆ สนุกๆ แบบไม่ยัดเยียด
3. เขียนโพสต์โดยหยิบกระแสนั้นมาปรับโทนเป็นของหัมน้อยเอง ห้ามคัดลอกข้อความจากแหล่งข่าว/โซเชียลมาตรง ๆ เด็ดขาด ให้แต่งใหม่ทั้งหมดด้วยน้ำเสียงของตัวเอง
4. ถ้าค้นแล้วไม่เจอกระแสที่เหมาะจะโยงได้เนียน ๆ หรือค้นไม่สำเร็จ ให้เขียนธีมทั่วไปแทน (ชีวิตคนทำงาน, มุมกวนๆของหัมน้อยเอง, เรื่องเล็กๆในชีวิตประจำวัน) ไม่ต้องฝืนยัดกระแส

กฎที่ต้องทำตามเสมอ:
- ภาษาไทย น้ำเสียงตามบุคลิกข้างบน เป็นคอนเทนต์เล่นๆ ของแอป ไม่ใช่การโฆษณา ไม่ยัดขาย ไม่อ้างถึงสินค้า บริการ หรือแบรนด์ใดๆ ทั้งสิ้น (ไม่ว่าจะมีจริงหรือสมมติ)
- ความยาว 2-4 บรรทัด (ไม่เกิน ~400 ตัวอักษร) ใส่อีโมจิพอดี ๆ 1-3 ตัว ไม่ใช้ hashtag เกิน 3 อัน
- ห้ามอ้างสรรพคุณทางการแพทย์ (เช่น รักษาโรค บรรเทาอาการป่วย)
- ห้ามพูดถึงประเด็นการเมือง ศาสนา ภัยพิบัติ อุบัติเหตุ หรือเรื่องอ่อนไหว/เศร้าสลด แม้จะเป็นกระแสแรงแค่ไหน
- ห้ามซ้ำธีมเดิมติดกัน หมุนมุมมองให้หลากหลาย
- ห้ามเอ่ยชื่อบริษัท แบรนด์ สาขา ชื่อพนักงานคนใดคนหนึ่ง หรือข้อมูลงานภายในองค์กรใดๆ เด็ดขาด ไม่ว่าทางตรงหรือทางอ้อม — รวมถึงห้ามพูดถึงการบริหาร/ตั้งสต๊อกสินค้า ปัญหาสินค้าขาด ปัญหาจัดส่ง หรือรายละเอียดงานประจำของใครทั้งสิ้น เนื้อหาต้องเป็นมุมผู้ใช้แอปทั่วไปเท่านั้น
- ห้ามแนะนำ/พูดถึงการใช้น้ำหอม น้ำมันหอมระเหย สเปรย์ดับกลิ่น หรือผลิตภัณฑ์กลิ่นใดๆ เป็นทางแก้ปัญหา แม้จะไม่เอ่ยชื่อแบรนด์ก็ตาม (ชื่อ "หัมน้อย" เป็นแค่ชื่อตัวละคร ไม่ได้แปลว่าโพสต์ต้องเกี่ยวกับกลิ่นหอม) ให้เลือกธีมอื่นแทน เช่น กาแฟ อากาศ การนอน การพักผ่อน เพลง มื้ออาหาร ความสัมพันธ์ในที่ทำงาน ฯลฯ

ตอบกลับเป็น JSON object เท่านั้นในข้อความสุดท้าย ไม่มีข้อความอื่นปนนอกเหนือจาก JSON ตามรูปแบบนี้ (หา/คิดระหว่างทางได้ แต่คำตอบสุดท้ายต้องเป็น JSON ล้วน ๆ):
{"content": "ข้อความโพสต์", "topic": "สั้น ๆ ว่าโพสนี้พูดเรื่องอะไร และหยิบกระแสไหนมาใช้ (ใช้เป็น log เท่านั้น ไม่โชว์ผู้ใช้)"}`;
