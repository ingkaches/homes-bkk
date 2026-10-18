# ระบบรับฟอร์ม HOMES/BKK (Google Apps Script)

รับข้อมูลจาก 2 ฟอร์มบนเว็บ แล้วเก็บลง Google Sheet พร้อมส่งอีเมลแจ้งเตือน
- **Submissions** คือฟอร์ม "ลงประกาศบ้าน" (`the-home-edit.html`)
- **Viewing requests** คือฟอร์ม "ขอนัดชม" (`book-viewing.html`)

ค่าเริ่มต้นของเว็บคือ **โหมดต้นแบบ** (ไม่ส่งอะไรไปไหน) จนกว่าจะใส่ URL ใน `config.js`

## ติดตั้ง (ประมาณ 10 นาที)

1. สร้าง Google Sheet ใหม่ ตั้งชื่อ "HOMES/BKK intake"
2. เมนู Extensions > Apps Script แล้ววางโค้ดจาก `Code.gs` ทั้งไฟล์ และสร้างไฟล์ที่สองชื่อ `Portal` (+ เครื่องหมายข้าง Files > Script) แล้ววางโค้ดจาก `Portal.gs` (ระบบลิสติ้ง ดู `SYSTEM-DESIGN-TH.md`)
3. (ไม่บังคับ) Project Settings > ติ๊ก "Show appsscript.json" แล้ววางเนื้อหาจาก `appsscript.json`
4. เลือกฟังก์ชัน `setup` แล้วกด Run ครั้งเดียว กดอนุญาตสิทธิ์
   - สร้างชีต 4 แผ่น (Submissions, Viewing requests, Users, Listings) พร้อมหัวตาราง สร้างโฟลเดอร์รูปใน Google Drive ชื่อ "HOMES-BKK photos" สร้างกุญแจลับสำหรับล็อกอิน ตั้งตัวตั้งเวลารายวัน และใส่คุณเป็น admin คนแรก
   - (ขั้นตอนเดิม) ชีตฟอร์ม และ dropdown สถานะ (new / contacted / viewing set / closed / spam)
   - ตั้งอีเมลแจ้งเตือนเป็นอีเมลของคุณ เปลี่ยนได้ที่ Project Settings > Script properties > `NOTIFY_EMAIL`
5. Deploy > New deployment > ประเภท Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - คัดลอก URL ที่ลงท้ายด้วย `/exec`
6. เปิด `config.js` ในเว็บ แล้วใส่ URL:
   ```js
   window.HB_CONFIG = { endpoint: 'https://script.google.com/macros/s/xxxxxxxx/exec' };
   ```
7. อัปโหลดเว็บใหม่ ฟอร์มจะเปลี่ยนเป็นโหมดจริงเอง ข้อความ "Prototype / ไม่มีการส่งข้อมูล" หายไป และปุ่มเปลี่ยนเป็น "Send my submission"

## ระบบลิสติ้ง (portal) — ติดตั้งเพิ่ม

หลังทำขั้นตอนข้างบนแล้ว:

1. Project Settings > Script properties > เพิ่ม `SITE_URL` = ที่อยู่เว็บจริงของคุณ เช่น `https://homesbkk.com` (ใช้ในลิงก์ในอีเมลเชิญ/แจ้งผล)
2. ถ้าเคย deploy ไปแล้ว: Run `setup` ใหม่หนึ่งครั้ง (กดอนุญาตสิทธิ์ Drive เพิ่ม) แล้ว Deploy > Manage deployments > Edit > Version: New version
3. `config.js` ใส่ `endpoint` เหมือนเดิม พอร์ทัลอยู่ที่ `portal.html` จะเปลี่ยนจากโหมดเดโมเป็นโหมดจริงเอง
4. เปิด `portal.html` ใส่อีเมลของคุณ รับรหัสทางอีเมล เข้าไปที่แท็บ Team แล้วเชิญเพื่อน/พาร์ทเนอร์
5. ทดลองครบวงจรหนึ่งรอบด้วยอีเมลอื่น: เชิญ > ล็อกอิน > ลงประกาศ + รูป > ส่ง > อนุมัติ > ดูที่ `map.html` และ `homes.html`
6. แผนที่: `config.js` ใช้ OpenStreetMap เป็นพื้นหลังชั่วคราว ก่อนเปิดจริงให้เปลี่ยน `mapTiles` เป็นผู้ให้บริการแบบเสียเงิน

ค่าที่ปรับได้อยู่ในตัวแปร `P` ที่หัว `Portal.gs` (เตือนยืนยันกี่วัน, จำนวนรูปขั้นต่ำ ฯลฯ)

### ความปลอดภัยที่ต้องรู้
- ใครแก้ชีต/สคริปต์ได้ = เห็นข้อมูลทั้งหมด แชร์เฉพาะ admin
- ตัวแปร `TOKEN_SECRET` ใน Script properties ห้ามแชร์ ถ้าสงสัยว่ารั่ว ลบค่านั้นแล้วรัน `setup` ใหม่ (ทุกคนต้องล็อกอินใหม่)
- ขอนัดชมของประกาศในพอร์ทัลจะส่งอีเมลหาเจ้าของประกาศด้วย (ปิดได้โดยตั้ง Script property `VIEWING_TO_OWNER` = `no`)

### รันเทสต์
```bash
cd backend
node test.js           # ฟอร์มเดิม 28 เคส
node test-portal.js    # ระบบลิสติ้ง 102 เคส (ล็อกอิน, สิทธิ์, อนุมัติ, รูป, ข้อมูลลับไม่หลุด, แจ้งเตือนประกาศค้าง ฯลฯ)
```

## ทดสอบว่าใช้ได้

```bash
curl -L -X POST 'https://script.google.com/macros/s/xxxxxxxx/exec' \
  -H 'Content-Type: text/plain' \
  -d '{"kind":"viewing","data":{"home":"Test","date":"Thursday 22 October","time":"13:00","format":"Meet at the building","name":"Test","phone":"TEST-PHONE","consent":true}}'
```
ควรได้ `{"ok":true,"ref":"HB-V-..."}` และมีแถวใหม่ในชีต (ลบแถวทดสอบทิ้งหลังลอง)

## แก้โค้ดภายหลัง

แก้ `Code.gs` แล้ว Deploy > Manage deployments > ไอคอนดินสอ > Version: New version > Deploy
URL เดิมใช้ต่อได้ ถ้าสร้าง "New deployment" ใหม่ URL จะเปลี่ยน

## ความปลอดภัยและข้อจำกัด

- เว็บส่งเป็น `text/plain` เพื่อไม่ให้เบราว์เซอร์ทำ CORS preflight (Apps Script ตอบ preflight ไม่ได้)
- ตรวจข้อมูลฝั่งเซิร์ฟเวอร์ จำกัดความยาว ลบตัวอักษรควบคุม และกันสูตร Sheets (ค่าที่ขึ้นต้นด้วย `= + - @` จะถูกใส่ `'` นำหน้า เบอร์ `+66…` จึงแสดงเป็นข้อความ)
- Honeypot: ช่อง `website` ที่คนมองไม่เห็น ถ้ามีค่า ระบบทิ้งเงียบๆ
- จำกัดอัตรา: ผู้ติดต่อคนเดียวกันส่งได้ 5 ครั้งต่อชั่วโมง และทั้งเว็บ 60 ครั้งต่อชั่วโมง ปรับได้ที่ `HB.RATE_PER_HOUR` ใน `Code.gs`
- ถ้าส่งอีเมลไม่สำเร็จ ข้อมูลยังถูกบันทึก (ดูบันทึกใน Apps Script > Executions)
- ลิมิต MailApp ของบัญชี Gmail ทั่วไปประมาณ 100 อีเมลต่อวัน
- **ข้อมูลส่วนบุคคล**: ตอนนี้เก็บชื่อ เบอร์/Line และอีเมล ก่อนเปิดจริงควรมีหน้านโยบายความเป็นส่วนตัว (PDPA) และกำหนดว่าใครเข้าถึงชีตได้ ผมไม่ได้เป็นทนาย โปรดให้ผู้เชี่ยวชาญตรวจ
- ภาพถ่ายยังไม่ถูกอัปโหลดผ่านฟอร์ม เจ้าของส่งภาพทาง Line หรืออีเมลหลังเราตอบกลับ

## รันชุดทดสอบบนเครื่อง (ไม่ต้องมี Google)

```bash
cd backend
node test.js        # 28 เคส: ตรวจข้อมูล, honeypot, formula injection, rate limit, อีเมลล้ม ฯลฯ
```
`mocks.js` จำลอง SpreadsheetApp, MailApp ฯลฯ ในหน่วยความจำ ไม่ได้ถูก deploy ไปกับ Apps Script
