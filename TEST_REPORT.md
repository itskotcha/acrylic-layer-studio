# รายงานผลทดสอบ Acrylic Layer Studio v2

วันที่: 28 กันยายน 2026 · รุ่น 2.0.0

## สภาพแวดล้อม

- Linux, Node.js 24.19.0, npm 11.9.0
- Chromium 153.0.8010.0 แบบ headless ผ่าน Playwright และ SwiftShader สำหรับ WebGL
- Desktop viewport 1440 × 1000 และ mobile viewport 390 × 844
- ใช้ชุด dependencies ตาม package-lock.json ไม่ใช้ backend หรือบริการภาพภายนอก
- ในสภาพแวดล้อมนี้เรียก Chromium ผ่าน `QA_CHROMIUM_PATH` เพราะใช้ executable ที่เตรียมแยกจาก Playwright download; วิธีปกติบนเครื่องผู้ใช้คือ `npx playwright install chromium`

## ผลที่ทดสอบแล้วผ่าน

| ชุดตรวจ                 | ผล                                                         |
| ----------------------- | ---------------------------------------------------------- |
| `npm run build`         | ผ่าน TypeScript และ Vite production build                  |
| `npm test`              | ผ่าน 9 unit tests                                          |
| `npm run test:browser`  | ผ่าน 11 browser integration tests                          |
| package.json / lockfile | version 2.0.0 และ dependency declarations ตรงกัน           |
| ภาพหน้าจอ               | ตรวจ light/dark บน desktop และ mobile viewport ด้วยภาพจริง |

### หน่วย ขนาด และ migration

- 100 × 100 → 2048 × 2048 ทดสอบด้วย canvas จริง; ส่งออก PNG 4K และอ่าน PNG header ได้ 4096 × 4096
- 100 × 150 → 1365 × 2048 และสัดส่วนอื่นตรวจด้วย unit tests
- ZIP ภาพแยกชั้นอ่านกลับและตรวจขนาด 1K ของแต่ละ PNG
- เปิดไฟล์ v1 ตัวอย่าง เปลี่ยนเป็น schema v2/75 × 100 และคง 3 depth layers
- Unit test ตรวจ world position ของเส้นเก่าที่หมุนและมีจุดติดลบหลัง migration พร้อมตรวจว่าข้อมูลเดิมไม่เปลี่ยน
- รักษาไฟล์ v1 ตัวอย่างแบบ byte-for-byte ใน examples
- งานว่างส่งออก alpha = 0 ไม่มีพื้นโต๊ะหรือ selection UI ติดไปด้วย

### แปรง ยางลบ และข้อความ

- วาดทั้ง 6 หัวผ่าน pointer flow จริงใน Chromium ตรวจชนิดวัตถุและผล raster ของแต่ละหัวว่าแตกต่างและมีพิกเซลเส้น
- Seed เดิมให้ bitmap เดิม ไฮไลต์ไม่มีพิกเซลทึบ 255 จากการทับภายในเส้นเดียว
- ลากยางลบบางส่วนตัดหลายเส้น ตรวจภาพและข้อความในชั้นเดียวกันว่ายังเหมือนเดิม
- Undo/Redo การวาดและการลบบางส่วน; unit test ตรวจ scale ของ geometry/rอยลบ/ความหนา
- บันทึกและเปิด brush project กลับ ให้ PNG เหมือนเดิม
- แก้การวัดข้อความเมื่อ fontSize เป็นหน่วยเล็ก: ใช้ฐาน 64 px พร้อม inverse transform ร่วมกันทั้ง editor และ export ไม่ขยาย bitmap ตัวอักษร 100 px
- โหลดฟอนต์ก่อนวัด/วาดใหม่ แก้กรณี glyph/ระยะตัวอักษรไม่อัปเดตหลังโหลดฟอนต์

### ฟอนต์และโปรเจกต์

- เพิ่ม/แก้ข้อความไทย นำเข้า Mali WOFF2 และใช้ font family ID ภายใน
- เก็บฟอนต์ผ่าน autosave และ reload
- บันทึก ZIP พร้อมฟอนต์ เปิดใน **browser context ใหม่** และตรวจภาพ PNG ให้ตรงกัน
- ZIP ไม่ฝังฟอนต์มีหน้าต่างแก้ฟอนต์ขาด ก่อนแทนที่งานเดิม; เลือก Mali แทนได้
- ไฟล์ WOFF2 เสียถูกปฏิเสธ ไม่เพิ่มลง project fonts
- ฟอนต์ subset ที่ใช้ทดสอบมีขอบเขต glyph จำกัด ข้อความไทย/อังกฤษที่ต้อง fallback ยังคงเปิด/export ได้ ไม่อ้างว่าครอบคลุมทุกภาษา
- Roundtrip project, autosave, ป้องกัน schema เสียก่อนแทนที่งานปัจจุบัน

### Import และเมนูวัตถุ

- นำเข้าภาพผ่าน file picker รวมหลายไฟล์และวิธีตามภาพแรก
- Drag/drop ด้วย DataTransfer ที่สร้างใน test
- Paste event พร้อมไฟล์ภาพจาก DataTransfer **เป็นข้อมูลจำลอง ไม่ใช่ OS clipboard จริง**
- ปุ่ม clipboard บน mobile viewport ทดสอบข้อมูลภาพและการปฏิเสธสิทธิ์ด้วย mocked navigator.clipboard.read
- ไม่เพิ่มภาพจาก paste ขณะโฟกัส textarea
- ล็อกวัตถุแล้วปุ่มลบใช้ไม่ได้ ปลดล็อก ทำสำเนาแล้วเลือกสำเนา ลบและ Undo โดยคงเลเยอร์
- ตรวจเมนูมือถืออยู่ในขอบ viewport และมีปุ่มสัมผัส

### พื้นหลัง ธีม gesture และ 3D

- เพิ่มแผ่นพื้นหลัง ไล่สี ปรับ HEX และมุม; กดเพิ่มอีกไม่สร้างวัตถุซ้ำ
- เปรียบเทียบ PNG ก่อน/หลังเปลี่ยนธีม ได้ข้อมูลภาพเหมือนกัน
- ธีมจดจำหลัง reload และตามระบบตอบสนองต่อ colorScheme emulation
- Snapping ผ่านการลากจริงที่สองระดับ zoom
- Hand pan ไม่สร้างวัตถุ; two-pointer events จำลองยกเลิกเส้นที่กำลังวาดก่อน pinch
- ตรวจ WebGL หมุน มุมหน้า แยกชั้น และส่งออก PNG 2K ที่มีเนื้อหาภาพจริง
- ตรวจ camera position/quaternion/zoom, ขนาด drawing buffer และ pixel ratio ก่อน/หลังส่งออก 3D ว่าไม่เปลี่ยน
- ตรวจ JavaScript page errors ใน flow หลัก และตรวจ console TypeError/ข้อผิดพลาด Konva ในชุด v2

## ปัญหาที่พบและแก้ก่อนส่งมอบ

- Canvas ว่างจาก whitespace text child ใน Konva: เอา text child ออก เพิ่มการตรวจ console error และตรวจภาพหน้าจอ
- Stroke เก่าที่มีจุดติดลบถูกตัดเมื่อแปลง renderer: normalize ขอบพร้อมชดเชยตำแหน่ง/มุมหมุน
- ข้อความหน่วยเล็กเกิด spacing ผิด และฟอนต์แสดง fallback ค้าง: ปรับวิธีวัดข้อความและวาดใหม่หลัง font load
- Dark theme อยู่ระหว่าง CSS transition ทำให้ภาพทดสอบเหมือนปุ่มซีด: รอ transition จบก่อน capture และตรวจ contrast จากภาพสุดท้าย
- หนึ่งรอบทดสอบเปิด browser ไม่ได้เพราะ executable ชั่วคราวหายหลังเปลี่ยน runtime: เตรียม executable ใหม่และรันชุดทดสอบซ้ำจนผ่าน ไม่ใช่ข้อผิดพลาดของ source app

## ข้อจำกัดที่พบ / ต้องทราบ

- Vite แจ้ง bundle บางส่วนเกิน 500 kB (editor ประมาณ 746 kB และ 3D ประมาณ 982 kB ก่อน gzip) เป็นคำเตือนด้านขนาด ไม่ใช่ build error; 3D แยก lazy-load แล้ว
- Clipboard ขึ้นกับ HTTPS/localhost, browser support และสิทธิ์ผู้ใช้ ไม่มี fallback ดึง URL ผ่าน proxy
- 3D เป็นภาพจำลองวัสดุ ไม่ใช่ physically accurate refraction หรือไฟล์สั่งผลิต
- Text rendering ระหว่าง OS/GPU อาจต่างกันในรายละเอียด antialias และ system font fallback
- ไม่รับรองภาพ screenshot 3D ก่อน/หลัง export ว่าตรงกันทุกไบต์ เพราะ render/antialias timing อาจต่าง แต่ตรวจค่ากล้องและ renderer แล้วว่าคืนเดิม
- ภาพเล็กไม่เกิดรายละเอียดใหม่เมื่อเพิ่ม export pixels และ 4K หลายชั้นใช้ RAM/GPU มาก

## ยังไม่ได้ทดสอบ

- iPhone, iPad, Android และ stylus บนอุปกรณ์จริง; mobile viewport และ PointerEvent emulation ไม่ใช่การทดสอบฮาร์ดแวร์จริง
- Safari, Firefox, Windows/macOS browser จริง และการคัดลอกรูปข้ามแอปผ่าน system clipboard จริง
- Performance/stress เต็มขีดจำกัด 24 เลเยอร์ × assets ขนาดใหญ่ หรือการส่งออก 4K บนโทรศัพท์หน่วยความจำต่ำ
- ไฟล์ฟอนต์ทุกชนิด/ทุกผู้ผลิต รวม variable font axes ที่แอปไม่มีตัวปรับแยก
- Browser storage quota เต็มจริงและ WebGL context loss บน GPU จริง มี error handling แต่ไม่ได้จำลองครบทุกระบบ

## หลักฐานและการรันซ้ำ

`docs/` มี editor desktop, brush gallery, light/dark, mobile object menu, mobile dark, preview/front/back/exploded จาก browser test จริง ดูคำสั่งติดตั้งและรัน tests ใน README_TH.md

ซอร์สใน ZIP เป็นชุดเดียวกับที่ผ่านการทดสอบ; ไฟล์ manifest.sha256 ใช้ตรวจ checksum ของไฟล์ที่ส่งมอบ ไม่รวม node_modules, dist, test-results หรือ browser binaries
