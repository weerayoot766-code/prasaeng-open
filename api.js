/**
 * ============================================================
 *  api.js — ตัวช่วยกลางสำหรับเรียก Apps Script Backend เป็น JSON API
 *  ใช้ร่วมกันทุกหน้า (index.html, rider.html, booking.html ฯลฯ)
 *  แนวทางเดียวกับที่ใช้ได้จริงแล้วในโปรเจกต์ PPMS (ปรุงยาเภสัช)
 * ============================================================
 *
 *  ⚠️ แก้ API_URL ด้านล่างให้เป็น Web App URL ของ Apps Script ที่ deploy ไว้
 *  (Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone)
 */

const API_URL = 'วาง_WEB_APP_URL_ของคุณตรงนี้'; // เช่น https://script.google.com/macros/s/AKfycbx.../exec

/** เรียกแบบ GET — ใช้กับฟังก์ชันที่แค่ "อ่าน" ข้อมูล พารามิเตอร์เป็นข้อความ/ตัวเลขสั้นๆ เท่านั้น */
async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_URL}?${query}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

/**
 * เรียกแบบ POST — ใช้กับฟังก์ชันที่ "เขียน" ข้อมูล หรือมีพารามิเตอร์เป็น object/array/รูปภาพ base64
 *
 * ⚠️ สำคัญมาก: จงใจ "ไม่ตั้ง Content-Type" ในนี้ — ปล่อยให้ browser ใส่ text/plain ให้อัตโนมัติ
 * เพราะถ้าตั้งเป็น application/json เอง จะทำให้ browser ส่ง CORS preflight (OPTIONS request)
 * ไปก่อน ซึ่ง Apps Script ตอบ OPTIONS ไม่ได้เลย จะทำให้ทุก POST พังทันที (นี่คือกับดักที่พบบ่อยที่สุด)
 */
async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}
