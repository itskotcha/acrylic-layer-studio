# ผลการทดสอบ Acrylic Layer Studio 1.0.0

วันที่: 28 กันยายน 2026 (Asia/Bangkok)

## สภาพแวดล้อม

- Linux, Node.js 24.19.0, npm 11.9.0
- React 19.3.0, Vite 7.3.6, TypeScript 5.9.3
- Three.js 0.180.0, React Three Fiber 9.8.1, Drei 10.7.9
- Konva 10.7.0, react-konva 19.3.0
- Vitest 3.2.7, Playwright 1.63.0
- Chromium 153.0.8010.0 แบบ headless ใช้ software WebGL
- Desktop viewport 1440 × 1000 และ mobile viewport 390 × 844

Chromium สำหรับ QA ใช้ binary ในสภาพแวดล้อมทดสอบผ่าน QA_CHROMIUM_PATH เนื่องจาก browser download ปกติคืน archive ไม่สมบูรณ์ ไม่ได้แก้พฤติกรรมแอปเพื่อผ่านการทดสอบ ผู้ใช้ทั่วไปติดตั้ง Chromium ด้วย `npx playwright install chromium` ได้ตาม README

## ผลที่รันจริง

### Production build: ผ่าน

`npm run build` ทำ TypeScript check และ Vite production bundle สำเร็จหลังแก้โค้ดชุดสุดท้าย

มีคำเตือนขนาด JavaScript chunk เกิน 500 kB: initial chunk ประมาณ 709 kB / gzip 221 kB และ lazy 3D chunk ประมาณ 979 kB / gzip 270 kB ไม่ใช่ build error พรีวิว 3D โหลดเมื่อเปิดแท็บ

### Unit tests: 5/5 ผ่าน

- จำกัดความลึก รักษาลำดับชั้นและตำแหน่งภายในก้อนเมื่อเปลี่ยนความหนา
- ปฏิเสธ asset ที่หายและ ID ซ้ำ
- Fit/Fill รักษาสัดส่วนภาพ
- Undo/Redo และตัด redo branch หลังแก้ใหม่
- ไม่อนุญาต patch วัตถุในชั้นล็อก

### Browser integration: 3/3 ผ่าน

1. **Editor / persistence / export / WebGL / mobile**
   - เปิดตัวอย่าง แสดง Canvas
   - เพิ่มและแก้ข้อความภาษาไทย
   - ดาวน์โหลด `.acrylic.zip` แล้วเปิดกลับ คืนข้อความเดิม
   - รอ autosave แล้ว reload คืนชื่อโปรเจกต์
   - ดาวน์โหลด PNG 2D และ PNG จาก 3D จริง
   - สลับ assembled/exploded กลับมุมหน้า และลากหมุน
   - เปิดหน้าจอ 390 px ไม่มี document horizontal overflow เปิดแผงเครื่องมือได้
   - ไม่พบ JavaScript pageerror ใน flow นี้
2. **New project / image import / drawing**
   - สร้างด้วยสัดส่วน 1:1
   - สร้างตามภาพแรก 600 × 800 และตรวจขนาด
   - นำเข้า PNG โปร่งใสรวมสามภาพและตรวจจำนวนชั้น
   - ลากวาดหนึ่งเส้น ตรวจ Undo/Redo คืนจำนวน stroke
   - ดาวน์โหลด ZIP ภาพแยกชั้น
3. **Layer controls / invalid archive**
   - ทำสำเนาชั้น ซ่อน/แสดง ล็อก/ปลดล็อก
   - การเพิ่มข้อความลงชั้นล็อกถูกป้องกัน
   - เรียงชั้นและ Undo
   - ตั้งความหนา 0.1
   - เปิด ZIP schema ผิดแล้วแจ้งข้อผิดพลาดและคงงานเดิม

Browser tests รันหลังแก้ logic ชุดสุดท้าย ก่อนจัดรูปแบบ source ด้วย Prettier; หลังจัดรูปแบบรัน production build และ unit tests ผ่านอีกครั้ง

## การตรวจภาพ

เปิดตรวจ screenshot desktop editor, acrylic preview, มุมหลัง และ mobile จริง พบว่าภาพอยู่ในกรอบและ UI ไม่มีข้อความซ้อนใน viewport ที่ตรวจ

ระหว่างตรวจได้ปรับขอบก้อนให้มองเห็นความหนาชัดขึ้น ใช้กล้อง orthographic สำหรับหน้าตรง และเปลี่ยนเงาจากวงแข็งเป็น gradient นุ่ม จากนั้นรัน browser tests ซ้ำผ่าน

ภาพหลักฐานอยู่ใน `docs/` ภาพบางภาพมีชื่อ “QA project” และข้อความทดสอบภาษาไทย ซึ่งมาจาก flow ทดสอบ ไม่ใช่งานเริ่มต้นของผู้ใช้

## สิ่งที่ยังไม่ได้ยืนยัน

- ไม่ได้ทดสอบกับ Windows/macOS จริง, Safari, Firefox, โทรศัพท์จริง หรือ stylus จริง
- ไม่ได้ benchmark FPS/RAM บนเครื่องสเปกต่ำ หรือทดสอบทุกค่าที่ขีดจำกัด 4096 px/24 ชั้น
- ไม่ได้จำลอง disk quota เต็มและ GPU context loss แบบอัตโนมัติ แม้มีเส้นทางแจ้งข้อผิดพลาด
- ไม่ได้ตรวจความเที่ยงตรงสีสำหรับงานพิมพ์ หรือ optical refraction ทางฟิสิกส์
- การหมุน/alpha ตรวจด้วย flow และภาพหน้าจอ ไม่ใช่ pixel-perfect golden comparison ทุกองศา

## ข้อจำกัดที่ส่งมอบ

วัสดุใสใช้ MeshPhysicalMaterial แบบ alpha blending ร่วมผิวขอบ เพื่อคงภาพโปร่งใสด้านใน ไม่ใช่ transmission/refraction เต็มรูปแบบ; เงาเป็นแบบประมาณค่า

ยางลบลบทั้ง stroke ไม่ใช่การตัดบางส่วน ไม่มี pressure-sensitive brush, GLB/video export, AI ลบพื้นหลัง หรือระบบ cloud
