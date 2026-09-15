/**
 * ============================================================
 *  api.js — ตัวช่วยกลางสำหรับเรียก Apps Script Backend เป็น JSON API
 *  ใช้ร่วมกันทุกหน้า (index.html, rider.html, booking.html ฯลฯ)
 * ============================================================
 *
 *  ⚠️ แก้ API_URL ด้านล่างให้เป็น Web App URL ของ Apps Script ที่ deploy ไว้
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbyrqSO6l5CNmj_BuyKv7XCCOI4eNHoxNvcxzcSdA7FP3eu1pJ7QuHpWwEhW0kcIH6o0/exec';

async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_URL}?${query}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}
