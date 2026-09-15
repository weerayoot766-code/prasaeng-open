# พระแสงเดลิเวอรี่ — เวอร์ชัน PPMS-style (Apps Script = API เท่านั้น)

โครงสร้างนี้เลิกใช้ Apps Script เสิร์ฟหน้าเว็บ (HtmlService) แล้ว
Apps Script ทำหน้าที่แค่เป็น **JSON API** ผ่าน ContentService เท่านั้น
ส่วนหน้าเว็บทั้งหมดเป็นไฟล์ static ธรรมดา (host ที่ไหนก็ได้ เช่น GitHub Pages)

วิธีนี้แก้ปัญหา error `document.write` / `userHtmlFrame` ที่เจอมาได้เด็ดขาด
เพราะ error นั้นเกิดจาก HtmlService sandbox เท่านั้น — ถ้าไม่ใช้เลย ปัญหาจะไม่มีทางเกิดได้อีก

---

## ไฟล์ทั้งหมดในชุดนี้

| ไฟล์ | ใช้ที่ไหน |
|---|---|
| `Code.gs` | วางในโปรเจกต์ Apps Script (backend เท่านั้น) |
| `api.js` | ตัวช่วยเรียก API กลาง (ทุกหน้า HTML include ไฟล์นี้) |
| `style.css` | สไตล์ของหน้าแรก |
| `app.js` | ตรรกะของหน้าแรก (index.html) |
| `index.html` | หน้าแรก |
| `shop.html`, `rider.html`, `booking.html`, `rental.html`, `sale.html`, `car.html`, `jobs.html`, `flash.html`, `ads.html` | หน้าอื่นๆ ทั้งหมด |

---

## ขั้นตอนที่ 1 — ตั้งค่า Apps Script (Backend)

1. เข้า [script.google.com](https://script.google.com) → **+ New project**
2. ลบเนื้อหา `Code.gs` เริ่มต้นทิ้ง แล้ววางเนื้อหาจากไฟล์ `Code.gs` ที่ให้มาแทน
3. กด **Deploy > New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. กด **Deploy** จะได้ URL ประมาณนี้:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
5. **คัดลอก URL นี้เก็บไว้** จะใช้ในขั้นตอนถัดไป

### ตั้งค่า Telegram Webhook ใหม่ (สำคัญ — ต้องทำใหม่ครั้งเดียว)

เนื่องจากได้ URL ใหม่ ต้องบอก Telegram ให้ส่ง webhook มาที่ URL ใหม่นี้แทนของเดิม
เปิดเบราว์เซอร์แล้ววาง URL นี้ (แก้ `<BOT_TOKEN>` และ `<WEB_APP_URL>` ให้ตรงของจริง):

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WEB_APP_URL>
```

ถ้าเห็น `{"ok":true,"result":true,...}` แปลว่าเชื่อมสำเร็จ

---

## ขั้นตอนที่ 2 — ตั้งค่า API_URL ในหน้าเว็บ

เปิดไฟล์ **`api.js`** แก้บรรทัดนี้:

```js
const API_URL = 'วาง_WEB_APP_URL_ของคุณตรงนี้';
```

เป็น URL ที่ได้จากขั้นตอนที่ 1 เช่น:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
```

**แก้แค่ไฟล์เดียวนี้พอ** เพราะทุกหน้า HTML include `api.js` ร่วมกัน

---

## ขั้นตอนที่ 3 — อัปโหลดขึ้น GitHub Pages

1. สร้าง repository ใหม่ใน GitHub (หรือใช้ของเดิมที่มีอยู่)
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้น `Code.gs` และไฟล์นี้) ขึ้นไปที่ root ของ repo:
   - `index.html`, `style.css`, `app.js`, `api.js`
   - `shop.html`, `rider.html`, `booking.html`, `rental.html`, `sale.html`, `car.html`, `jobs.html`, `flash.html`, `ads.html`
3. ไปที่ repo **Settings > Pages**
4. เลือก Branch ที่อัปโหลดไฟล์ไว้ (เช่น `main`) และ folder `/ (root)`
5. กด **Save** — GitHub จะให้ URL แบบ:
   ```
   https://<username>.github.io/<repo-name>/
   ```
6. เปิด URL นี้ทดสอบได้เลย

---

## ทดสอบว่าทำงานถูกต้อง

1. เปิดหน้าแรก → รอ "ร้านค้าขายดี" โหลดขึ้น (เดิมค้างตรงนี้ ตอนนี้ควรขึ้นปกติ)
2. ลองสั่งของ 1 ออเดอร์ดู เช็คว่า Telegram แจ้งเตือนเข้ามาไหม
3. ลองเปิด `rider.html` สมัครไรเดอร์ทดสอบ
4. ลองเปิด `shop.html` เข้าสู่ระบบร้านค้าทดสอบ

---

## หมายเหตุสำคัญ

- **ไม่ต้องกังวลเรื่อง CORS** — `api.js` ถูกออกแบบให้ไม่ตั้ง `Content-Type` เอง (ให้ browser ใส่ `text/plain` อัตโนมัติ) ซึ่งเป็นเทคนิคเดียวกับที่ใช้ได้จริงแล้วในโปรเจกต์ PPMS
- **ห้ามแก้ Content-Type ในฟังก์ชัน `apiPost`** ใน `api.js` เด็ดขาด ไม่งั้นจะเกิด CORS preflight ที่ Apps Script ตอบไม่ได้ ทำให้ทุก POST พังทันที
- ถ้าจะเพิ่มฟีเจอร์ใหม่ (เช่น โลโก้ร้าน, ปุ่มจัดการร้านค้าที่หน้าแรก) ทำได้ตามปกติ เพิ่ม action ใหม่ใน `Code.gs` (ใน `handleRequest`) แล้วเรียกจากหน้าเว็บด้วย `apiGet`/`apiPost` ได้เลย
- ข้อมูลทั้งหมดยังอยู่ใน Google Sheet เดิม (SHEET_ID เดิม) ไม่มีอะไรเปลี่ยน ไม่ต้องย้ายข้อมูล
- โปรเจกต์ Apps Script เดิม (ที่มีปัญหา) **ยังอยู่เหมือนเดิม ไม่ถูกลบ** เก็บไว้เป็น backup ได้ ถ้าจะทดสอบเวอร์ชันนี้แยกไปเลย แนะนำสร้างโปรเจกต์ Apps Script ใหม่แยกต่างหาก (Code.gs ใหม่ยังเชื่อม Sheet เดิมได้ปกติ)
