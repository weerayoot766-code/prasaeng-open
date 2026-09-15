const BOT_TOKEN = "8933010524:AAEWtEwhZS1wbmoeeptZIYyq-zAkXiFV1gY";
const CHAT_ID = "-5204820069";
const IMGBB_API_KEY = "332aa05a626f1592a6e5e7c96d1e723f";
const SHEET_ID = "15Q03N5k0TPRALdSPNE2vRTnGN4pTF8TfqZ7sn-gyrSg";

const ADMIN_SECRET_ = "7K3mQ9xV2wR8pL5nZ1yT6bH4cF0jD-prsg-2026";

function requireAdminSecret_(secret){
  if(secret !== ADMIN_SECRET_){
    throw new Error("ไม่ได้รับอนุญาตให้ทำรายการนี้");
  }
}

function sendTelegram(message) {
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  const payload = { chat_id: CHAT_ID, text: message };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}

function submitOrder(data) {
  const orderId = getNextOrderId();
  const now = new Date();
  const orderDate = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy");
  const orderTime = Utilities.formatDate(now, "Asia/Bangkok", "HH:mm");

  data.orderId = orderId;
  data.orderDate = orderDate;
  data.orderTime = orderTime;

  const message =
  "🔔 ออเดอร์ใหม่\n\n" +
  "หมายเลขออเดอร์: " + data.orderId + "\n" +
  "วันที่: " + data.orderDate + "\n" +
  "เวลา: " + data.orderTime + " น.\n\n" +
  "ลูกค้า: " + data.name + "\n" +
  "เบอร์: " + data.phone + "\n" +
  "ที่อยู่: " + (data.address || "-") + "\n\n" +
  "🏪 ร้านค้า: " + data.shopName + "\n" +
  "📞 เบอร์ร้าน: " + data.shopPhone + "\n" +
  "📍 แผนที่ร้าน:\n" +
  "https://maps.google.com/?q=" + data.shopLat + "," + data.shopLng + "\n\n" +
  "📍 ระยะทาง: " + data.distance + " กิโลเมตร\n" +
  "🚚 ค่าส่ง: " + data.delivery + " บาท\n\n" +
  "--------------------\n\n" +
  "สินค้า:\n\n" +
  data.items + "\n\n" +
  "--------------------\n\n" +
  "ค่าสินค้า: " + data.productTotal + " บาท\n" +
  "ค่าส่ง: " + data.delivery + " บาท\n" +
  "💰 รวมทั้งหมด: " + data.total + " บาท\n\n" +
  "สถานะ: รอชำระเงิน\n\n" +
  "🏠 แผนที่ลูกค้า:\n" +
  "https://maps.google.com/?q=" + data.lat + "," + data.lng;

  sendTelegram(message + "\n\n⚠️ รอตรวจสลิปก่อน ยังไม่ให้ไรเดอร์รับงาน");
  saveOrderToSheet(data);

  return { status: "success", orderId: data.orderId };
}

function getNextOrderId() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const lastRow = sheet.getLastRow();
  const nextNumber = lastRow;
  return "PS-" + String(nextNumber).padStart(4, "0");
}

function saveOrderToSheet(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const mapUrl = "https://maps.google.com/?q=" + data.lat + "," + data.lng;

  sheet.appendRow([
    data.orderId, data.orderDate, data.orderTime, data.name, data.phone,
    data.items, data.productTotal, data.delivery, data.total, data.distance,
    mapUrl, "รอชำระเงิน", "", "", "", "", "", "", "",
    data.paymentSlip || "", "pending", "",
    data.shopName || "", data.address || ""
  ]);
}

function getMemberOrderedShops(phone){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const orderSheet = ss.getSheets()[0];
  const orderData = orderSheet.getDataRange().getValues();

  const shopNames = [];
  for(let i = orderData.length - 1; i >= 1; i--){
    const rowPhone = orderData[i][4];
    const shopName = orderData[i][22];
    if(sameId(rowPhone, phone) && shopName && shopNames.indexOf(shopName) === -1){
      shopNames.push(shopName);
    }
  }

  const storeSheet = ss.getSheetByName("Stores");
  const storeData = storeSheet.getDataRange().getValues();
  const logoMap = {};
  for(let i = 1; i < storeData.length; i++){
    logoMap[storeData[i][1]] = storeData[i][10] || "";
  }

  return shopNames.map(function(name){
    return { name: name, logo: logoMap[name] || "" };
  });
}

function getRiderOrders() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const orders = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = row[11];
    const paymentStatus = row[20];
    if (String(paymentStatus).includes("paid") && status !== "ส่งสำเร็จ" && status !== "ยกเลิก") {
      orders.push({
        orderId: row[0], name: row[3], phone: row[4], items: row[5],
        total: row[8], distance: row[9], mapUrl: row[10], status: row[11]
      });
    }
  }
  return orders.reverse();
}

function updateOrderStatus(orderId,status,rider){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();

  for(let i=1;i<data.length;i++){
    if(data[i][0] == orderId){
      const currentStatus = data[i][11];
      if(status === "กำลังซื้อ" && currentStatus !== "รอชำระเงิน"){
        return false;
      }
      sheet.getRange(i+1,12).setValue(status);
      if(status == "กำลังซื้อ" || status == "กำลังส่ง"){
        sheet.getRange(i+1,13).setValue(rider ? rider.name : "");
        sheet.getRange(i+1,14).setValue(rider ? rider.phone : "");
      }
      if(status === "ส่งสำเร็จ"){
        if(data[i][17] !== ""){ return true; }
        const productCost = Number(data[i][6]);
        const riderFee = 30;
        const payoutAmount = productCost + riderFee;
        sheet.getRange(i+1,18).setValue("pending = รอโอน");
        sheet.getRange(i+1,19).setValue(payoutAmount);
        sheet.getRange(i+1,20).setValue(new Date());
        sendPayoutButton(
          orderId,
          "✅ ส่งสำเร็จแล้ว\n\n" +
          "Order: " + orderId + "\n" +
          "ไรเดอร์: " + data[i][12] + "\n" +
          "เบอร์ไรเดอร์: " + data[i][13] + "\n\n" +
          "ค่าสินค้า: " + productCost + " บาท\n" +
          "ค่าแรงไรเดอร์: " + riderFee + " บาท\n" +
          "ยอดโอนคืนไรเดอร์: " + payoutAmount + " บาท\n\n" +
          "สถานะโอนคืน: pending"
        );
      }
      break;
    }
  }
  return true;
}

function getOrderStatus(orderId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] == orderId){
      return {
        orderId: data[i][0], status: data[i][11],
        riderName: data[i][12] || "", riderPhone: data[i][13] || ""
      };
    }
  }
  return null;
}

function uploadSlipToTelegram(orderId, fileName, base64){
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", orderId + "_" + fileName);
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto";
  const payload = {
    chat_id: CHAT_ID,
    caption: "📸 สลิปใหม่\n\nOrder: " + orderId,
    photo: blob,
    reply_markup: JSON.stringify({
      inline_keyboard: [[
        { text: "✅ สลิปผ่าน", callback_data: "slip|" + orderId + "|paid" },
        { text: "❌ สลิปไม่ผ่าน", callback_data: "slip|" + orderId + "|reject" }
      ]]
    })
  };
  UrlFetchApp.fetch(url, { method: "post", payload: payload });

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] == orderId){
      sheet.getRange(i+1,21).setValue("ส่งสลิปแล้ว");
      sheet.getRange(i+1,22).setValue("pending = รอตรวจสลิป");
      break;
    }
  }
  return true;
}

function getProducts(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const productSheet = ss.getSheetByName("products");
  const storeSheet = ss.getSheetByName("Stores");
  const productData = productSheet.getDataRange().getValues();
  const storeData = storeSheet.getDataRange().getValues();

  const approvedStores = {};
  for(let i = 1; i < storeData.length; i++){
    if(storeData[i][6] === "approved"){ approvedStores[storeData[i][1]] = true; }
  }

  const products = [];
  for(let i = 1; i < productData.length; i++){
    const shop = productData[i][0];
    const status = productData[i][6] || "approved";
    if(approvedStores[shop] === true && status === "approved"){
      products.push({
        shop: shop, category: productData[i][1], name: productData[i][2],
        price: productData[i][3], image: productData[i][4], description: productData[i][5]
      });
    }
  }
  return products;
}

function registerStore(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Stores");
  const storeId = String(new Date().getTime()).slice(-8);
  const pin = Math.floor(1000 + Math.random() * 9000).toString();

  sheet.appendRow([
    storeId, data.name, data.phone, data.category, data.lat, data.lng,
    "pending", new Date(), pin, data.storeAddress
  ]);

  sendTelegram(
    "🏪 ใบสมัครร้านค้าใหม่\n\n" +
    "รหัสร้าน: " + storeId + "\n" +
    "ชื่อร้าน: " + data.name + "\n" +
    "เบอร์: " + data.phone + "\n" +
    "หมวด: " + data.category + "\n" +
    "ที่อยู่: " + data.storeAddress + "\n" +
    "แผนที่ร้าน:\nhttps://maps.google.com/?q=" + data.lat + "," + data.lng
  );
  sendTelegram("👉 อนุมัติร้านค้า " + storeId + " โดยเข้าไปแก้สถานะในชีต Stores คอลัมน์ G เป็น approved ครับ");

  return { success: true, storeId: storeId, pin: pin };
}

function getApprovedStores(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Stores");
  const data = sheet.getDataRange().getValues();
  const stores = [];
  const today = new Date();

  for(let i = 1; i < data.length; i++){
    if(data[i][6] === "approved"){
      const featuredUntil = data[i][12];
      const isFeatured = (featuredUntil instanceof Date) && featuredUntil >= today;
      stores.push({
        name: data[i][1], category: data[i][3], logo: data[i][10] || "",
        isOpen: data[i][11] !== "closed", isFeatured: isFeatured
      });
    }
  }
  return stores;
}

function getActiveAds(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Ads");

  if(!sheet){
    sheet = ss.insertSheet("Ads");
    sheet.appendRow(["adId", "imageUrl", "linkShopName", "startDate", "expiryDate"]);
    const farFuture = new Date("2099-12-31");
    const today = new Date();
    sheet.appendRow(["AD001", "https://i.postimg.cc/25y9xL1b/faelch-nir-ans-ppe-xr-th-wen-t.jpg", "__แฟลช__", today, farFuture]);
    sheet.appendRow(["AD002", "https://i.postimg.cc/wxmFHsKv/Chat-GPT-Image-15-s-kh-2569-09-29-24.png", "ปรุงยาเภสัช", today, farFuture]);
    sheet.appendRow(["AD003", "https://i.postimg.cc/1t6HWGsS/lng-khos'na-k-brea.jpg", "__ลงโฆษณา__", today, farFuture]);
  }

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const ads = [];
  for(let i = 1; i < data.length; i++){
    const imageUrl = data[i][1];
    const expiryDate = data[i][4];
    if(imageUrl && expiryDate instanceof Date && expiryDate >= today){
      ads.push({ imageUrl: imageUrl, linkShopName: data[i][2] || "" });
    }
  }
  return ads;
}

function submitProduct(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("products");
  const imageUrl = saveProductImageToDrive(data.image, "product_" + data.shop + "_" + new Date().getTime());
  sheet.appendRow([data.shop, data.category || "", data.name, data.price, imageUrl, data.description, "pending"]);
  return true;
}

function getStoreInfo(shopName){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Stores");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    const name = String(data[i][1] || "").trim();
    if(name === shopName){
      return { name: name, phone: String(data[i][2]), category: data[i][3], lat: data[i][4], lng: data[i][5] };
    }
  }
  return null;
}

function completeDelivery(orderId, proofImageUrl) {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const orderIdCol = headers.indexOf("orderId");
  const statusCol = headers.indexOf("status");
  const proofCol = headers.indexOf("proofImage");
  const payoutCol = headers.indexOf("payoutStatus");
  const deliveredCol = headers.indexOf("deliveredAt");

  for (let i = 1; i < data.length; i++) {
    if (data[i][orderIdCol] == orderId) {
      sh.getRange(i + 1, statusCol + 1).setValue("ส่งสำเร็จ");
      sh.getRange(i + 1, proofCol + 1).setValue(proofImageUrl);
      sh.getRange(i + 1, payoutCol + 1).setValue("pending");
      sh.getRange(i + 1, deliveredCol + 1).setValue(new Date());
      sendTelegram("✅ ส่งสำเร็จแล้ว\n\nOrder: " + orderId + "\nสถานะโอนคืนไรเดอร์: pending\nรูปหลักฐาน:\n" + proofImageUrl);
      return { success: true, message: "บันทึกส่งสำเร็จแล้ว" };
    }
  }
  return { success: false, message: "ไม่พบ Order ID" };
}

function markPayoutPaid(orderId, secret){
  requireAdminSecret_(secret);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0] == orderId){
      sheet.getRange(i+1,18).setValue("paid = โอนแล้ว");
      sendTelegram("💸 โอนคืนไรเดอร์แล้ว\n\nOrder: " + orderId + "\nไรเดอร์: " + data[i][12] + "\nยอดโอน: " + data[i][18] + " บาท");
      return true;
    }
  }
  return false;
}

function sendTelegramOrderWithButtons(orderId, text){
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: CHAT_ID, text: text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [
      [{ text: "✅ รับงาน", callback_data: "accept|"+orderId }],
      [{ text: "🛒 กำลังซื้อ", callback_data: "status|"+orderId+"|กำลังซื้อ" },
       { text: "🏍️ กำลังส่ง", callback_data: "status|"+orderId+"|กำลังส่ง" }],
      [{ text: "✅ ส่งสำเร็จ", callback_data: "status|"+orderId+"|ส่งสำเร็จ" }]
    ]}
  };
  UrlFetchApp.fetch(url,{ method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
}

/**
 * ============================================================
 * Telegram Webhook Handler (เปลี่ยนชื่อจาก doPost เดิม)
 * ยังใช้รับ update จาก Telegram bot เหมือนเดิมทุกอย่าง — ดู doPost(e) ใหม่ด้านล่าง
 * ที่จะเช็คก่อนว่า POST ที่เข้ามาเป็น "คำสั่งจาก Telegram" หรือ "คำขอ API จากหน้าเว็บของเรา"
 * ============================================================
 */
function handleTelegramWebhook_(e){
  try {
    const update = JSON.parse(e.postData.contents);
    const dedupCache = CacheService.getScriptCache();
    const dedupKey = "tg_update_" + update.update_id;
    if(dedupCache.get(dedupKey)){
      return ContentService.createTextOutput("ok");
    }
    dedupCache.put(dedupKey, "1", 21600);

    if(update.message && update.message.photo){
      const cache = CacheService.getScriptCache();
      const pendingOrderId = cache.get("waiting_slip_for");
      if(pendingOrderId){
        const photoArray = update.message.photo;
        const fileId = photoArray[photoArray.length - 1].file_id;
        const slipUrl = savePhotoFromTelegramToDrive(fileId, "payout_slip_" + pendingOrderId + ".jpg");
        savePayoutSlip(pendingOrderId, slipUrl);
        cache.remove("waiting_slip_for");
        sendTelegram("✅ บันทึกสลิปโอนไรเดอร์แล้ว สำหรับ Order: " + pendingOrderId);
      }
      return ContentService.createTextOutput("ok");
    }

    if(update.message && update.message.text && update.message.text.indexOf("/start") === 0){
      const parts = update.message.text.split(" ");
      const param = parts[1];
      const chatId = update.message.chat.id;

      if(param && param.indexOf("bkshop_") === 0){
        const shopId = param.replace("bkshop_", "");
        const shopName = linkBookingShopTelegram(shopId, chatId);
        if(shopName){
          sendTelegramToChat(chatId, "✅ เชื่อมต่อสำเร็จ!\n\nร้าน: " + shopName + "\nมีคนจองคิวใหม่จะแจ้งเตือนที่แชทนี้ครับ");
        } else {
          sendTelegramToChat(chatId, "❌ ไม่พบรหัสร้านนี้ กรุณาตรวจสอบรหัสอีกครั้ง");
        }
        return ContentService.createTextOutput("ok");
      }

      if(param){
        const linked = linkRiderTelegram(param, chatId);
        if(linked){
          sendTelegramToChat(chatId, "เชื่อมต่อสำเร็จ ✅\nรหัสไรเดอร์: " + param + "\nมีงานใหม่จะแจ้งเตือนที่แชทนี้ครับ");
        } else {
          sendTelegramToChat(chatId, "ไม่พบรหัสไรเดอร์นี้ครับ กรุณาตรวจสอบรหัสอีกครั้ง");
        }
      }
      return ContentService.createTextOutput("ok");
    }

    if(!update.callback_query){
      return ContentService.createTextOutput("ok");
    }

    const callbackQuery = update.callback_query;
    const callbackId = callbackQuery.id;
    const data = callbackQuery.data;
    Logger.log("CALLBACK DATA = " + data);
    const telegramId = callbackQuery.from.id;

    answerCallbackQuery(callbackId, "รับคำสั่งแล้ว");

    if(data.indexOf("payout_paid_") === 0){
      const orderId = data.replace("payout_paid_", "");
      markPayoutPaid(orderId, ADMIN_SECRET_);
      const cache = CacheService.getScriptCache();
      cache.put("waiting_slip_for", orderId, 600);
      answerCallbackQuery(callbackId, "บันทึกว่าโอนคืนไรเดอร์แล้ว");
      sendTelegram("📸 ส่งรูปสลิปโอนเงินเข้ามาได้เลยครับ สำหรับ Order: " + orderId);
      return ContentService.createTextOutput("ok");
    }

    const parts = data.split("|");
    const action = parts[0];
    const orderId = parts[1];
    const status = parts[2];

    if(action === "riderApprove"){
      updateRiderStatus(orderId, "active", ADMIN_SECRET_);
      answerCallbackQuery(callbackId, "อนุมัติไรเดอร์แล้ว");
      return ContentService.createTextOutput("ok");
    }
    if(action === "riderReject"){
      updateRiderStatus(orderId, "rejected", ADMIN_SECRET_);
      answerCallbackQuery(callbackId, "ปฏิเสธไรเดอร์แล้ว");
      return ContentService.createTextOutput("ok");
    }
    if(action === "accept"){
      const rider = getRiderByTelegramId(telegramId);
      const result = acceptOrderByRider(orderId, rider);
      if(result === false){
        answerCallbackQuery(callbackId, "งานนี้มีคนรับแล้ว");
        return ContentService.createTextOutput("ok");
      }
      answerCallbackQuery(callbackId, "รับงานสำเร็จ");
      notifyOtherRidersJobTaken(orderId, telegramId, rider.name);
      return ContentService.createTextOutput("ok");
    }
    if(action === "status"){
      const rider = getRiderByTelegramId(telegramId);
      const result = updateOrderStatus(orderId, status, rider);
      if(result === false){
        answerCallbackQuery(callbackId, "อัปเดตไม่ได้");
        return ContentService.createTextOutput("ok");
      }
      answerCallbackQuery(callbackId, "อัปเดตสถานะ: " + status);
      return ContentService.createTextOutput("ok");
    }
    if(action === "slip"){
      Logger.log("SLIP ACTION orderId=" + orderId + " status=" + status);
      if(status === "paid"){
        const row = updatePaymentStatus(orderId, "paid");
        Logger.log("UPDATE RESULT = " + JSON.stringify(row));
        notifyRiderAfterPaid(orderId);
        answerCallbackQuery(callbackId, "อนุมัติสลิปแล้ว");
      }
      if(status === "reject"){
        updatePaymentStatus(orderId, "reject");
        answerCallbackQuery(callbackId, "ปฏิเสธสลิปแล้ว");
      }
      return ContentService.createTextOutput("ok");
    }

    return ContentService.createTextOutput("ok");

  } catch(error) {
    Logger.log(error);
    Logger.log(error.stack);
    sendTelegram("⚠️ doPost error:\n" + error.toString() + "\n\n" + error.stack);
    throw error;
  }
}

function answerCallbackQuery(callbackId,message){
  try {
    const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/answerCallbackQuery";
    const payload = { callback_query_id: callbackId, text: message, show_alert: false };
    UrlFetchApp.fetch(url,{ method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
  } catch(e) {
    Logger.log("answerCallbackQuery ล้มเหลว (ไม่กระทบงานหลัก): " + e);
  }
}

function getRiderByTelegramId(telegramId){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Riders");
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(String(data[i][0]) === String(telegramId) && data[i][3] === "active"){
      return { name: data[i][1], phone: data[i][2] };
    }
  }
  return null;
}

function updatePaymentStatus(orderId, paymentStatus){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] == orderId){
      if(paymentStatus === "paid"){ sheet.getRange(i+1,22).setValue("paid = ชำระแล้ว"); }
      if(paymentStatus === "reject"){ sheet.getRange(i+1,22).setValue("reject = สลิปไม่ผ่าน"); }
      return data[i];
    }
  }
  return null;
}

function notifyRiderAfterPaid(orderId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] == orderId){
      const message =
        "📦 งานใหม่พร้อมรับ\n\n" +
        "Order: " + data[i][0] + "\n" +
        "ลูกค้า: " + data[i][3] + "\n" +
        "โทร: " + data[i][4] + "\n\n" +
        "สินค้า:\n" + data[i][5] + "\n\n" +
        "ค่าสินค้า: " + data[i][6] + " บาท\n" +
        "ค่าส่ง: " + data[i][7] + " บาท\n" +
        "รวม: " + data[i][8] + " บาท\n\n" +
        "แผนที่ลูกค้า:\n" + data[i][10];
      broadcastOrderToRiders(orderId, message);
      return true;
    }
  }
  return false;
}

function verifyStore(storeId,pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Stores");
  const data = sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][0]) === String(storeId) && String(data[i][8]) === String(pin) && data[i][6] === "approved"){
      return { success:true, storeName:data[i][1] };
    }
  }
  return { success:false };
}

function getStoreById(storeId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Stores");
  const data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(String(data[i][0]) === String(storeId)){
      return { success: true, storeId: data[i][0], storeName: data[i][1], status: data[i][6] };
    }
  }
  return { success: false };
}

function sendPayoutButton(orderId, text){
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: CHAT_ID, text: text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "💸 โอนให้ไรเดอร์แล้ว", callback_data: "payout_paid_" + orderId }]] }
  };
  UrlFetchApp.fetch(url,{ method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
}

function acceptOrderByRider(orderId, rider){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(data[i][0] == orderId){
      if(!rider){ return false; }
      const currentRider = data[i][12];
      if(currentRider){ return false; }
      sheet.getRange(i + 1, 13).setValue(rider.name);
      sheet.getRange(i + 1, 14).setValue(rider.phone);
      sheet.getRange(i + 1, 15).setValue(new Date());
      return true;
    }
  }
  return false;
}

function getNextRiderId(){
  return String(new Date().getTime()).slice(-8);
}

function registerRider(data){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Riders");
  const riderId = getNextRiderId();
  const registerDate = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  const faceUrl = saveImageToDrive(data.faceWithPlateImage, "face_" + riderId + ".jpg");
  const licenseUrl = saveImageToDrive(data.driverLicenseImage, "license_" + riderId + ".jpg");
  const idUrl = saveImageToDrive(data.idCardImage, "idcard_" + riderId + ".jpg");

  sheet.appendRow([
    "", data.riderName, data.riderPhone, "pending", riderId,
    data.line || "", data.facebook || "", data.bank || "", data.vehicle || "", data.plate || "",
    registerDate, faceUrl, licenseUrl, idUrl
  ]);

  sendRiderPhotosForReview(riderId, data);
  return { success: true, riderId: riderId };
}

function sendPhotoToTelegram(base64Image, caption){
  if(!base64Image) return;
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Image), "image/jpeg", "rider.jpg");
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto", {
    method: "post", payload: { chat_id: CHAT_ID, caption: caption, photo: blob }
  });
}

function sendRiderPhotosForReview(riderId, data){
  const info =
    "🛵 ใบสมัครไรเดอร์ใหม่\n\n" +
    "รหัสไรเดอร์: " + riderId + "\n" +
    "ชื่อ: " + data.riderName + "\n" +
    "เบอร์: " + data.riderPhone + "\n" +
    "Line: " + (data.line || "-") + "\n" +
    "Facebook: " + (data.facebook || "-") + "\n" +
    "ธนาคาร: " + (data.bank || "-") + "\n" +
    "พาหนะ: " + (data.vehicle || "-") + "\n" +
    "ทะเบียน: " + (data.plate || "-");

  sendPhotoToTelegram(data.faceWithPlateImage, info + "\n\n📸 หน้าคู่ทะเบียนรถ");
  sendPhotoToTelegram(data.driverLicenseImage, "🪪 ใบขับขี่ (รหัส " + riderId + ")");

  const blob = Utilities.newBlob(Utilities.base64Decode(data.idCardImage), "image/jpeg", "id.jpg");
  UrlFetchApp.fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto", {
    method: "post",
    payload: {
      chat_id: CHAT_ID,
      caption: "🆔 บัตรประชาชน (รหัส " + riderId + ") — กดอนุมัติ/ปฏิเสธด้านล่าง",
      photo: blob,
      reply_markup: JSON.stringify({
        inline_keyboard: [[
          { text: "✅ อนุมัติไรเดอร์", callback_data: "riderApprove|" + riderId },
          { text: "❌ ปฏิเสธ", callback_data: "riderReject|" + riderId }
        ]]
      })
    }
  });
}

function updateRiderStatus(riderId, status, secret){
  requireAdminSecret_(secret);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Riders");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][4]) === String(riderId)){
      sheet.getRange(i+1, 4).setValue(status);
      return true;
    }
  }
  return false;
}

function saveImageToDrive(base64Image, fileName){
  if(!base64Image) return "";
  const url = "https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY;
  try {
    const response = UrlFetchApp.fetch(url, { method: "post", payload: { image: base64Image }, muteHttpExceptions: true });
    const result = JSON.parse(response.getContentText());
    if(result.success){ return result.data.url; }
    Logger.log("imgbb upload failed: " + response.getContentText());
    return "";
  } catch(error) {
    Logger.log("imgbb upload error: " + error.toString());
    return "";
  }
}

function saveProductImageToDrive(dataUrl, fileNamePrefix){
  if(!dataUrl) return "";
  if(dataUrl.indexOf("data:") !== 0){ return dataUrl; }
  const commaIndex = dataUrl.indexOf(",");
  const base64Data = dataUrl.substring(commaIndex + 1);
  const url = "https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY;
  try {
    const response = UrlFetchApp.fetch(url, { method: "post", payload: { image: base64Data }, muteHttpExceptions: true });
    const result = JSON.parse(response.getContentText());
    if(result.success){ return result.data.url; }
    Logger.log("imgbb upload failed: " + response.getContentText());
    return "";
  } catch(error) {
    Logger.log("imgbb upload error: " + error.toString());
    return "";
  }
}

function savePhotoFromTelegramToDrive(fileId, fileName){
  const getFileUrl = "https://api.telegram.org/bot" + BOT_TOKEN + "/getFile?file_id=" + fileId;
  const fileInfo = JSON.parse(UrlFetchApp.fetch(getFileUrl).getContentText());
  const filePath = fileInfo.result.file_path;
  const downloadUrl = "https://api.telegram.org/file/bot" + BOT_TOKEN + "/" + filePath;
  const response = UrlFetchApp.fetch(downloadUrl);
  const blob = response.getBlob().setName(fileName);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function savePayoutSlip(orderId, slipUrl){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(data[i][0] == orderId){
      sheet.getRange(i + 1, 16).setValue(slipUrl);
      return true;
    }
  }
  return false;
}

function sendTelegramToChat(chatId, message){
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify({ chat_id: chatId, text: message }) });
}

function linkRiderTelegram(riderId, chatId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Riders");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][4]) === String(riderId)){
      sheet.getRange(i+1, 1).setValue(String(chatId));
      return true;
    }
  }
  return false;
}

function linkBookingShopTelegram(shopId, chatId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], shopId)){
      sheet.getRange(i+1, 12).setValue(String(chatId));
      return data[i][1];
    }
  }
  return null;
}

function notifyBookingShopPersonal(shopId, message){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], shopId)){
      const telegramId = data[i][11];
      if(telegramId){ sendTelegramToChat(telegramId, message); }
      return;
    }
  }
}

function sendTelegramOrderWithButtonsToChat(chatId, orderId, text){
  const url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  const payload = {
    chat_id: chatId, text: text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [
      [{ text: "✅ รับงาน", callback_data: "accept|"+orderId }],
      [{ text: "🛒 กำลังซื้อ", callback_data: "status|"+orderId+"|กำลังซื้อ" },
       { text: "🏍️ กำลังส่ง", callback_data: "status|"+orderId+"|กำลังส่ง" }],
      [{ text: "✅ ส่งสำเร็จ", callback_data: "status|"+orderId+"|ส่งสำเร็จ" }]
    ]}
  };
  UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload) });
}

function broadcastOrderToRiders(orderId, message){
  const riderSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Riders");
  const riders = riderSheet.getDataRange().getValues();
  const notifiedChatIds = [];
  for(let i = 1; i < riders.length; i++){
    const telegramId = riders[i][0];
    const status = riders[i][3];
    if(status === "active" && telegramId){
      sendTelegramOrderWithButtonsToChat(telegramId, orderId, message);
      notifiedChatIds.push(String(telegramId));
    }
  }
  CacheService.getScriptCache().put("broadcast_" + orderId, JSON.stringify(notifiedChatIds), 21600);
  sendTelegram("📦 (สำเนา track) ส่งงาน " + orderId + " ให้ไรเดอร์แล้ว " + notifiedChatIds.length + " คน\n\n" + message);
}

function notifyOtherRidersJobTaken(orderId, acceptedTelegramId, riderName){
  const stored = CacheService.getScriptCache().get("broadcast_" + orderId);
  if(!stored) return;
  const chatIds = JSON.parse(stored);
  chatIds.forEach(function(chatId){
    if(String(chatId) !== String(acceptedTelegramId)){
      sendTelegramToChat(chatId, "งานหมายเลข " + orderId + " มีไรเดอร์ (" + riderName + ") รับไปแล้วครับ ขอบคุณที่สนใจนะครับ 🙏");
    }
  });
}

function getProductsByStore(storeId, pin){
  const result = verifyStore(storeId, pin);
  if(!result.success){ return { success: false }; }
  const shopName = result.storeName;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("products");
  const data = sheet.getDataRange().getValues();

  const products = [];
  for(let i = 1; i < data.length; i++){
    if(data[i][0] === shopName){
      products.push({
        rowIndex: i + 1, shop: data[i][0], category: data[i][1], name: data[i][2],
        price: data[i][3], image: data[i][4], description: data[i][5], status: data[i][6]
      });
    }
  }

  let isOpen = true;
  const storeSheet = ss.getSheetByName("Stores");
  const storeData = storeSheet.getDataRange().getValues();
  for(let i = 1; i < storeData.length; i++){
    if(String(storeData[i][0]) === String(storeId)){
      isOpen = storeData[i][11] !== "closed";
      break;
    }
  }

  return { success: true, storeName: shopName, products: products, isOpen: isOpen };
}

function updateProduct(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("products");
  const row = data.rowIndex;
  const rowData = sheet.getRange(row, 1, 1, 7).getValues()[0];

  if(rowData[0] !== data.shop){
    return { success: false, message: "แถวข้อมูลเปลี่ยนไป กรุณาโหลดรายการใหม่อีกครั้ง" };
  }

  sheet.getRange(row, 2).setValue(data.category || "");
  sheet.getRange(row, 3).setValue(data.name);
  sheet.getRange(row, 4).setValue(data.price);

  if(data.image){
    const imageUrl = saveProductImageToDrive(data.image, "product_edit_" + row + "_" + new Date().getTime());
    sheet.getRange(row, 5).setValue(imageUrl);
  }
  sheet.getRange(row, 6).setValue(data.description || "");
  return { success: true };
}

function setStoreOpenStatus(storeId, pin, isOpen){
  const result = verifyStore(storeId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Stores");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(storeId)){
      sheet.getRange(i + 1, 12).setValue(isOpen ? "open" : "closed");
      return { success: true, isOpen: isOpen };
    }
  }
  return { success: false };
}

function getNextMemberId(){
  return String(new Date().getTime()).slice(-8);
}

function registerMember(data){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Members");
  const values = sheet.getDataRange().getValues();
  for(let i = 1; i < values.length; i++){
    if(String(values[i][2]) === String(data.phone)){
      return { success: false, message: "เบอร์นี้เคยสมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ" };
    }
  }
  const memberId = getNextMemberId();
  const registerDate = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
  sheet.appendRow([memberId, data.name, data.phone, data.pin, registerDate, data.address || "", data.lat || "", data.lng || ""]);
  return { success: true, name: data.name, phone: data.phone, address: data.address || "", lat: data.lat || "", lng: data.lng || "" };
}

function loginMember(phone, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Members");
  const values = sheet.getDataRange().getValues();
  for(let i = 1; i < values.length; i++){
    if(String(values[i][2]) === String(phone) && String(values[i][3]) === String(pin)){
      return {
        success: true, name: values[i][1], phone: values[i][2], address: values[i][5] || "",
        lat: values[i][6] || "", lng: values[i][7] || ""
      };
    }
  }
  return { success: false, message: "เบอร์หรือ PIN ไม่ถูกต้อง" };
}

function getNextBookingShopId(){
  return String(new Date().getTime()).slice(-8);
}

function registerBookingShop(data){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const shopId = getNextBookingShopId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const registerDate = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  sheet.appendRow([shopId, data.name, data.phone, data.category, data.address, "pending", pin, "09:00", "18:00", 30, registerDate, ""]);

  sendTelegram(
    "📅 ใบสมัครร้านจองคิวใหม่\n\n" +
    "รหัสร้าน: " + shopId + "\n" +
    "ชื่อร้าน: " + data.name + "\n" +
    "เบอร์: " + data.phone + "\n" +
    "หมวด: " + data.category + "\n" +
    "ที่อยู่: " + data.address
  );
  sendTelegram(
    "👉 อนุมัติร้านจองคิว " + shopId + " พิมพ์: approve\n" +
    "(หรือเข้าไปแก้สถานะในชีต BookingShops คอลัมน์ F เป็น approved ได้เลยครับ)"
  );

  return { success: true, shopId: shopId, pin: pin };
}

function getApprovedBookingShops(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  const shops = [];
  for(let i = 1; i < data.length; i++){
    if(String(data[i][5]).trim() === "approved"){
      shops.push({
        shopId: data[i][0], name: data[i][1], phone: data[i][2], category: data[i][3], address: data[i][4],
        openTime: safeTimeString(data[i][7]), closeTime: safeTimeString(data[i][8]), slotMinutes: Number(data[i][9])
      });
    }
  }
  return shops;
}

function verifyBookingShop(shopId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(shopId) && String(data[i][6]) === String(pin) && data[i][5] === "approved"){
      return {
        success: true, shopName: data[i][1],
        openTime: safeTimeString(data[i][7]), closeTime: safeTimeString(data[i][8]), slotMinutes: Number(data[i][9])
      };
    }
  }
  return { success: false };
}

function setBookingShopHours(shopId, pin, openTime, closeTime, slotMinutes){
  const result = verifyBookingShop(shopId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(shopId)){
      sheet.getRange(i+1, 8).setValue(openTime);
      sheet.getRange(i+1, 9).setValue(closeTime);
      sheet.getRange(i+1, 10).setValue(Number(slotMinutes));
      return { success: true };
    }
  }
  return { success: false };
}

function generateTimeSlots(openTime, closeTime, slotMinutes){
  const slots = [];
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while(current < end){
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0"));
    current += Number(slotMinutes);
  }
  return slots;
}

function getBookingSlots(shopId, date){
  const shopSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const shopData = shopSheet.getDataRange().getValues();

  let openTime = "09:00", closeTime = "18:00", slotMinutes = 30, found = false;
  for(let i = 1; i < shopData.length; i++){
    if(String(shopData[i][0]) === String(shopId) && shopData[i][5] === "approved"){
      openTime = safeTimeString(shopData[i][7]);
      closeTime = safeTimeString(shopData[i][8]);
      slotMinutes = Number(shopData[i][9]);
      found = true;
      break;
    }
  }
  if(!found){ return { success: false }; }

  const allSlots = generateTimeSlots(openTime, closeTime, slotMinutes);
  const bookingSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Bookings");
  const bookingData = bookingSheet.getDataRange().getValues();
  const bookedTimes = [];
  for(let i = 1; i < bookingData.length; i++){
    if(sameId(bookingData[i][1], shopId) && safeDateString(bookingData[i][3]) === String(date) && bookingData[i][7] === "active"){
      bookedTimes.push(safeTimeString(bookingData[i][4]));
    }
  }
  const slots = allSlots.map(function(time){ return { time: time, booked: bookedTimes.indexOf(time) !== -1 }; });
  return { success: true, slots: slots };
}

function getNextBookingId(){
  return "BK-" + String(new Date().getTime()).slice(-8);
}

function createBooking(data){
  const bookingSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Bookings");
  const bookingData = bookingSheet.getDataRange().getValues();
  for(let i = 1; i < bookingData.length; i++){
    if(sameId(bookingData[i][1], data.shopId) && safeDateString(bookingData[i][3]) === String(data.date) &&
       safeTimeString(bookingData[i][4]) === data.time && bookingData[i][7] === "active"){
      return { success: false, message: "ช่วงเวลานี้มีคนจองแล้ว กรุณาเลือกเวลาอื่น" };
    }
  }

  const bookingId = getNextBookingId();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
  bookingSheet.appendRow([bookingId, data.shopId, data.shopName, data.date, data.time, data.customerName, data.customerPhone, "active", createdAt]);

  const bookingMessage =
    "📅 มีคนจองคิวใหม่\n\n" +
    "หมายเลขคิว: " + bookingId + "\n" +
    "ร้าน: " + data.shopName + "\n" +
    "วันที่: " + data.date + "\n" +
    "เวลา: " + data.time + "\n\n" +
    "ลูกค้า: " + data.customerName + "\n" +
    "เบอร์: " + data.customerPhone;

  sendTelegram(bookingMessage);
  notifyBookingShopPersonal(data.shopId, bookingMessage);

  return { success: true, bookingId: bookingId };
}

function getShopBookingsByDate(shopId, pin, date){
  const result = verifyBookingShop(shopId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Bookings");
  const data = sheet.getDataRange().getValues();
  const bookings = [];
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][1], shopId) && safeDateString(data[i][3]) === String(date) && data[i][7] === "active"){
      bookings.push({ bookingId: data[i][0], time: safeTimeString(data[i][4]), customerName: data[i][5], customerPhone: data[i][6] });
    }
  }
  bookings.sort(function(a,b){ return a.time.localeCompare(b.time); });
  return { success: true, bookings: bookings };
}

function cancelBookingByShop(bookingId, shopId, pin){
  const result = verifyBookingShop(shopId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Bookings");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(bookingId) && sameId(data[i][1], shopId)){
      sheet.getRange(i+1, 8).setValue("cancelled");
      return { success: true };
    }
  }
  return { success: false };
}

function approveBookingShop(shopId, secret){
  requireAdminSecret_(secret);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("BookingShops");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(shopId)){
      sheet.getRange(i+1, 6).setValue("approved");
      return true;
    }
  }
  return false;
}

function safeTimeString(value){
  if(value instanceof Date){ return Utilities.formatDate(value, "Asia/Bangkok", "HH:mm"); }
  return String(value);
}
function safeDateString(value){
  if(value instanceof Date){ return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd"); }
  return String(value);
}
function sameId(a, b){
  return String(a).replace(/^0+/, "") === String(b).replace(/^0+/, "");
}

function getNextRentalId(){ return String(new Date().getTime()).slice(-8); }

function registerRental(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Rentals");
  const rentalId = getNextRentalId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  const image1Url = data.image1 ? saveImageToDrive(data.image1, "rental_" + rentalId + "_1.jpg") : "";
  const image2Url = data.image2 ? saveImageToDrive(data.image2, "rental_" + rentalId + "_2.jpg") : "";
  const image3Url = data.image3 ? saveImageToDrive(data.image3, "rental_" + rentalId + "_3.jpg") : "";

  sheet.appendRow([
    rentalId, data.ownerName, data.ownerPhone, data.title, data.price,
    data.address, data.lat, data.lng, data.roomSize, (data.facilities || []).join(", "),
    image1Url, image2Url, image3Url, "pending", pin, "available", createdAt
  ]);

  sendTelegram(
    "🏠 ใบสมัครลงประกาศบ้านเช่าใหม่\n\n" +
    "รหัสประกาศ: " + rentalId + "\n" +
    "ชื่อประกาศ: " + data.title + "\n" +
    "เจ้าของ: " + data.ownerName + "\n" +
    "เบอร์: " + data.ownerPhone + "\n" +
    "ราคา: " + data.price + " บาท/เดือน\n" +
    "ขนาดห้อง: " + data.roomSize + "\n" +
    "สิ่งอำนวยความสะดวก: " + (data.facilities || []).join(", ") + "\n" +
    "ที่อยู่: " + data.address
  );
  sendTelegram("👉 อนุมัติประกาศ " + rentalId + " โดยเข้าไปแก้สถานะในชีต Rentals คอลัมน์ N เป็น approved ครับ");

  return { success: true, rentalId: rentalId, pin: pin };
}

function getApprovedRentals(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Rentals");
  const data = sheet.getDataRange().getValues();
  const rentals = [];
  for(let i = 1; i < data.length; i++){
    if(String(data[i][13]).trim() === "approved"){
      rentals.push({
        rentalId: data[i][0], title: data[i][3], price: data[i][4], address: data[i][5],
        lat: data[i][6], lng: data[i][7], roomSize: data[i][8], facilities: data[i][9],
        image1: data[i][10], availability: data[i][15] || "available"
      });
    }
  }
  return rentals;
}

function getRentalDetail(rentalId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Rentals");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(rentalId)){
      return {
        rentalId: data[i][0], ownerName: data[i][1], ownerPhone: data[i][2], title: data[i][3],
        price: data[i][4], address: data[i][5], lat: data[i][6], lng: data[i][7],
        roomSize: data[i][8], facilities: data[i][9], image1: data[i][10], image2: data[i][11], image3: data[i][12],
        availability: data[i][15] || "available"
      };
    }
  }
  return null;
}

function verifyRentalOwner(rentalId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Rentals");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], rentalId) && String(data[i][14]) === String(pin)){
      return { success: true, title: data[i][3] };
    }
  }
  return { success: false };
}

function setRentalAvailability(rentalId, pin, availability){
  const result = verifyRentalOwner(rentalId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Rentals");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], rentalId)){
      sheet.getRange(i+1, 16).setValue(availability);
      return { success: true, availability: availability };
    }
  }
  return { success: false };
}

function getNextSaleId(){ return String(new Date().getTime()).slice(-8); }

function registerSale(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Sales");
  const saleId = getNextSaleId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  const image1Url = data.image1 ? saveImageToDrive(data.image1, "sale_" + saleId + "_1.jpg") : "";
  const image2Url = data.image2 ? saveImageToDrive(data.image2, "sale_" + saleId + "_2.jpg") : "";
  const image3Url = data.image3 ? saveImageToDrive(data.image3, "sale_" + saleId + "_3.jpg") : "";

  sheet.appendRow([
    saleId, data.ownerName, data.ownerPhone, data.propertyType, data.title, data.price,
    data.address, data.lat, data.lng, data.landSize || "", data.deedType || "",
    data.houseDetails || "", (data.facilities || []).join(", "),
    image1Url, image2Url, image3Url, "pending", pin, "available", createdAt
  ]);

  sendTelegram(
    "🏡 ใบสมัครลงประกาศขายบ้าน/ที่ดินใหม่\n\n" +
    "รหัสประกาศ: " + saleId + "\n" +
    "ประเภท: " + data.propertyType + "\n" +
    "ชื่อประกาศ: " + data.title + "\n" +
    "เจ้าของ: " + data.ownerName + "\n" +
    "เบอร์: " + data.ownerPhone + "\n" +
    "ราคา: " + data.price + " บาท\n" +
    "ขนาดที่ดิน: " + (data.landSize || "-") + "\n" +
    "ประเภทโฉนด: " + (data.deedType || "-") + "\n" +
    "ที่อยู่: " + data.address
  );
  sendTelegram("👉 อนุมัติประกาศ " + saleId + " โดยเข้าไปแก้สถานะในชีต Sales คอลัมน์ Q เป็น approved ครับ");

  return { success: true, saleId: saleId, pin: pin };
}

function getApprovedSales(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Sales");
  const data = sheet.getDataRange().getValues();
  const sales = [];
  for(let i = 1; i < data.length; i++){
    if(String(data[i][16]).trim() === "approved"){
      sales.push({
        saleId: data[i][0], propertyType: data[i][3], title: data[i][4], price: data[i][5],
        address: data[i][6], lat: data[i][7], lng: data[i][8], landSize: data[i][9], deedType: data[i][10],
        image1: data[i][13], availability: data[i][18] || "available"
      });
    }
  }
  return sales;
}

function getSaleDetail(saleId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Sales");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(saleId)){
      return {
        saleId: data[i][0], ownerName: data[i][1], ownerPhone: data[i][2], propertyType: data[i][3],
        title: data[i][4], price: data[i][5], address: data[i][6], lat: data[i][7], lng: data[i][8],
        landSize: data[i][9], deedType: data[i][10], houseDetails: data[i][11], facilities: data[i][12],
        image1: data[i][13], image2: data[i][14], image3: data[i][15], availability: data[i][18] || "available"
      };
    }
  }
  return null;
}

function verifySaleOwner(saleId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Sales");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], saleId) && String(data[i][17]) === String(pin)){
      return { success: true, title: data[i][4] };
    }
  }
  return { success: false };
}

function setSaleAvailability(saleId, pin, availability){
  const result = verifySaleOwner(saleId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Sales");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(sameId(data[i][0], saleId)){
      sheet.getRange(i+1, 19).setValue(availability);
      return { success: true, availability: availability };
    }
  }
  return { success: false };
}

const CARS_MAX_SLOTS_PER_DEALER_ = 10;
const CARS_LISTING_DAYS_ = 30;

function getNextCarId(){ return String(new Date().getTime()).slice(-8); }

function registerCar(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Cars");
  if(!sheet){
    sheet = ss.insertSheet("Cars");
    sheet.appendRow(["carId","sellerType","dealerId","ownerName","ownerPhone","brand","model","year","mileage","transmission","fuelType","price","description","address","lat","lng","image1","image2","image3","status","pin","availability","createdAt","expiryDate"]);
  }

  const carId = getNextCarId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CARS_LISTING_DAYS_);

  const image1Url = data.image1 ? saveImageToDrive(data.image1, "car_" + carId + "_1.jpg") : "";
  const image2Url = data.image2 ? saveImageToDrive(data.image2, "car_" + carId + "_2.jpg") : "";
  const image3Url = data.image3 ? saveImageToDrive(data.image3, "car_" + carId + "_3.jpg") : "";

  sheet.appendRow([
    carId, "individual", "", data.ownerName, data.ownerPhone,
    data.brand, data.model, data.year, data.mileage, data.transmission, data.fuelType,
    data.price, data.description, data.address, data.lat, data.lng,
    image1Url, image2Url, image3Url, "pending", pin, "available", createdAt, expiryDate
  ]);

  sendTelegram(
    "🚗 ใบสมัครลงประกาศขายรถใหม่ (เจ้าของขายเอง)\n\n" +
    "รหัสประกาศ: " + carId + "\n" +
    "รถ: " + data.brand + " " + data.model + " ปี " + data.year + "\n" +
    "เจ้าของ: " + data.ownerName + "\n" +
    "เบอร์: " + data.ownerPhone + "\n" +
    "ราคา: " + data.price + " บาท\n" +
    "เลขไมล์: " + (data.mileage || "-") + " กม.\n\n" +
    "👉 อนุมัติโดยเข้าไปแก้สถานะในชีต Cars คอลัมน์ T (status) เป็น approved ครับ"
  );

  return { success: true, carId: carId, pin: pin };
}

function registerCarDealer(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Dealers");
  if(!sheet){
    sheet = ss.insertSheet("Dealers");
    sheet.appendRow(["dealerId","dealerName","dealerPhone","pin","status","packageStartDate","packageExpiryDate","maxSlots","createdAt"]);
  }

  const dealerId = String(new Date().getTime()).slice(-8);
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CARS_LISTING_DAYS_);
  const createdAt = Utilities.formatDate(now, "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  sheet.appendRow([dealerId, data.dealerName, data.dealerPhone, pin, "pending", now, expiryDate, CARS_MAX_SLOTS_PER_DEALER_, createdAt]);

  sendTelegram(
    "🚗🏢 ใบสมัครเต็นท์/นายหน้ารถใหม่\n\n" +
    "รหัสเต็นท์: " + dealerId + "\n" +
    "ชื่อ: " + data.dealerName + "\n" +
    "เบอร์: " + data.dealerPhone + "\n\n" +
    "👉 อนุมัติโดยเข้าไปแก้สถานะในชีต Dealers คอลัมน์ E (status) เป็น approved ครับ\n" +
    "(แพ็กจะเริ่มนับ 30 วันจากตอนนี้ ถ้าลูกค้าจ่ายเงินช้ากว่าที่สมัคร ให้ไปแก้วันที่ในคอลัมน์ F ให้ตรงกับวันที่จ่ายจริงด้วย)"
  );

  return { success: true, dealerId: dealerId, pin: pin };
}

function verifyCarDealer(dealerId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Dealers");
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(dealerId) && String(data[i][3]) === String(pin) && data[i][4] === "approved"){
      const expiryDate = data[i][6];
      const isExpired = (expiryDate instanceof Date) && expiryDate < today;
      return {
        success: true, dealerName: data[i][1],
        maxSlots: Number(data[i][7]) || CARS_MAX_SLOTS_PER_DEALER_,
        packageExpiryDate: expiryDate, isExpired: isExpired
      };
    }
  }
  return { success: false };
}

function addCarByDealer(data){
  const dealer = verifyCarDealer(data.dealerId, data.pin);
  if(!dealer.success){ return { success: false, message: "รหัสเต็นท์หรือ PIN ไม่ถูกต้อง หรือยังไม่ได้รับการอนุมัติ" }; }
  if(dealer.isExpired){ return { success: false, message: "แพ็กของเต็นท์หมดอายุแล้ว กรุณาต่ออายุก่อนเพิ่มรถใหม่" }; }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Cars");
  if(!sheet){
    sheet = ss.insertSheet("Cars");
    sheet.appendRow(["carId","sellerType","dealerId","ownerName","ownerPhone","brand","model","year","mileage","transmission","fuelType","price","description","address","lat","lng","image1","image2","image3","status","pin","availability","createdAt","expiryDate"]);
  }

  const existing = sheet.getDataRange().getValues();
  let activeCount = 0;
  for(let i = 1; i < existing.length; i++){
    if(String(existing[i][2]) === String(data.dealerId) && existing[i][21] === "available"){ activeCount++; }
  }
  if(activeCount >= dealer.maxSlots){
    return { success: false, message: "ลงรถครบโควตา " + dealer.maxSlots + " คันของแพ็กแล้ว กรุณาปิดคันที่ขายได้แล้วก่อน ถึงจะลงคันใหม่ได้" };
  }

  const carId = getNextCarId();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");

  const image1Url = data.image1 ? saveImageToDrive(data.image1, "car_" + carId + "_1.jpg") : "";
  const image2Url = data.image2 ? saveImageToDrive(data.image2, "car_" + carId + "_2.jpg") : "";
  const image3Url = data.image3 ? saveImageToDrive(data.image3, "car_" + carId + "_3.jpg") : "";

  sheet.appendRow([
    carId, "dealer", data.dealerId, dealer.dealerName, data.contactPhone || "",
    data.brand, data.model, data.year, data.mileage, data.transmission, data.fuelType,
    data.price, data.description, data.address, data.lat, data.lng,
    image1Url, image2Url, image3Url, "approved", "", "available", createdAt, dealer.packageExpiryDate
  ]);

  return { success: true, carId: carId, slotsUsed: activeCount + 1, maxSlots: dealer.maxSlots };
}

function getDealerCars(dealerId, pin){
  const dealer = verifyCarDealer(dealerId, pin);
  if(!dealer.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  if(!sheet) return { success: true, cars: [], maxSlots: dealer.maxSlots };
  const data = sheet.getDataRange().getValues();
  const cars = [];
  for(let i = 1; i < data.length; i++){
    if(String(data[i][2]) === String(dealerId)){
      cars.push({ carId: data[i][0], brand: data[i][5], model: data[i][6], year: data[i][7], price: data[i][11], availability: data[i][21] });
    }
  }
  return { success: true, cars: cars, maxSlots: dealer.maxSlots };
}

function setDealerCarAvailability(carId, dealerId, pin, availability){
  const dealer = verifyCarDealer(dealerId, pin);
  if(!dealer.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(carId) && String(data[i][2]) === String(dealerId)){
      sheet.getRange(i+1, 22).setValue(availability);
      return { success: true };
    }
  }
  return { success: false };
}

function getApprovedCars(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const cars = [];
  for(let i = 1; i < data.length; i++){
    const status = data[i][19];
    const expiryDate = data[i][23];
    const notExpired = !(expiryDate instanceof Date) || expiryDate >= today;
    if(status === "approved" && notExpired){
      cars.push({
        carId: data[i][0], sellerType: data[i][1], brand: data[i][5], model: data[i][6], year: data[i][7],
        mileage: data[i][8], price: data[i][11], image1: data[i][16], availability: data[i][21] || "available"
      });
    }
  }
  return cars;
}

function getCarDetail(carId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(carId)){
      return {
        carId: data[i][0], sellerType: data[i][1], ownerName: data[i][3], ownerPhone: data[i][4],
        brand: data[i][5], model: data[i][6], year: data[i][7], mileage: data[i][8],
        transmission: data[i][9], fuelType: data[i][10], price: data[i][11], description: data[i][12],
        address: data[i][13], lat: data[i][14], lng: data[i][15], image1: data[i][16], image2: data[i][17], image3: data[i][18],
        availability: data[i][21] || "available"
      };
    }
  }
  return null;
}

function verifyCarOwner(carId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  if(!sheet) return { success: false };
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(carId) && String(data[i][20]) === String(pin) && data[i][1] === "individual"){
      return { success: true };
    }
  }
  return { success: false };
}

function setCarAvailability(carId, pin, availability){
  const result = verifyCarOwner(carId, pin);
  if(!result.success){ return { success: false }; }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Cars");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(carId)){
      sheet.getRange(i+1, 22).setValue(availability);
      return { success: true, availability: availability };
    }
  }
  return { success: false };
}

const JOBS_LISTING_DAYS_ = 30;

function getNextJobId(){ return "JB-" + String(new Date().getTime()).slice(-8); }

function registerJob(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("Jobs");
  if(!sheet){
    sheet = ss.insertSheet("Jobs");
    sheet.appendRow(["jobId","employerName","employerPhone","position","jobType","salary","requirements","description","address","urgent","status","pin","availability","createdAt","expiryDate"]);
  }

  const jobId = getNextJobId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + JOBS_LISTING_DAYS_);

  sheet.appendRow([
    jobId, data.employerName, data.employerPhone, data.position, data.jobType,
    data.salary, data.requirements, data.description, data.address,
    data.urgent ? "Y" : "N", "pending", pin, "open", createdAt, expiryDate
  ]);

  sendTelegram(
    "💼 ใบประกาศรับสมัครงานใหม่\n\n" +
    "รหัสประกาศ: " + jobId + "\n" +
    "ตำแหน่ง: " + data.position + "\n" +
    "ร้าน/นายจ้าง: " + data.employerName + "\n" +
    "เบอร์: " + data.employerPhone + "\n" +
    "ค่าจ้าง: " + data.salary + "\n\n" +
    "👉 อนุมัติโดยเข้าไปแก้สถานะในชีต Jobs คอลัมน์ K (status) เป็น approved ครับ"
  );

  return { success: true, jobId: jobId, pin: pin };
}

function getApprovedJobs(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Jobs");
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const jobs = [];
  for(let i = 1; i < data.length; i++){
    const status = data[i][10];
    const expiryDate = data[i][14];
    const notExpired = !(expiryDate instanceof Date) || expiryDate >= today;
    if(status === "approved" && notExpired){
      jobs.push({
        jobId: data[i][0], employerName: data[i][1], position: data[i][3],
        jobType: data[i][4], salary: data[i][5], urgent: data[i][9] === "Y", availability: data[i][12] || "open"
      });
    }
  }
  jobs.sort(function(a, b){ return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0); });
  return jobs;
}

function getJobDetail(jobId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Jobs");
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(jobId)){
      return {
        jobId: data[i][0], employerName: data[i][1], employerPhone: data[i][2],
        position: data[i][3], jobType: data[i][4], salary: data[i][5],
        requirements: data[i][6], description: data[i][7], address: data[i][8],
        urgent: data[i][9] === "Y", availability: data[i][12] || "open"
      };
    }
  }
  return null;
}

function verifyJobOwner(jobId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Jobs");
  if(!sheet) return { success: false };
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(jobId) && String(data[i][11]) === String(pin)){
      return { success: true };
    }
  }
  return { success: false };
}

function setJobAvailability(jobId, pin, availability){
  const result = verifyJobOwner(jobId, pin);
  if(!result.success) return { success: false };
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Jobs");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(jobId)){
      sheet.getRange(i+1, 13).setValue(availability);
      return { success: true, availability: availability };
    }
  }
  return { success: false };
}

function getNextSeekerId(){ return "SK-" + String(new Date().getTime()).slice(-8); }

function registerJobSeeker(data){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("JobSeekers");
  if(!sheet){
    sheet = ss.insertSheet("JobSeekers");
    sheet.appendRow(["seekerId","name","phone","desiredPosition","skills","availableTime","description","status","pin","availability","createdAt","expiryDate"]);
  }

  const seekerId = getNextSeekerId();
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const createdAt = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm");
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + JOBS_LISTING_DAYS_);

  sheet.appendRow([
    seekerId, data.name, data.phone, data.desiredPosition, data.skills,
    data.availableTime, data.description, "pending", pin, "looking", createdAt, expiryDate
  ]);

  sendTelegram(
    "🙋 ใบประกาศหางานใหม่\n\n" +
    "รหัสประกาศ: " + seekerId + "\n" +
    "ชื่อ: " + data.name + "\n" +
    "ตำแหน่งที่อยากทำ: " + data.desiredPosition + "\n" +
    "เบอร์: " + data.phone + "\n\n" +
    "👉 อนุมัติโดยเข้าไปแก้สถานะในชีต JobSeekers คอลัมน์ H (status) เป็น approved ครับ"
  );

  return { success: true, seekerId: seekerId, pin: pin };
}

function getApprovedJobSeekers(){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("JobSeekers");
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const seekers = [];
  for(let i = 1; i < data.length; i++){
    const status = data[i][7];
    const expiryDate = data[i][11];
    const notExpired = !(expiryDate instanceof Date) || expiryDate >= today;
    if(status === "approved" && notExpired){
      seekers.push({
        seekerId: data[i][0], name: data[i][1], desiredPosition: data[i][3],
        skills: data[i][4], availableTime: data[i][5], availability: data[i][9] || "looking"
      });
    }
  }
  return seekers;
}

function getJobSeekerDetail(seekerId){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("JobSeekers");
  if(!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(seekerId)){
      return {
        seekerId: data[i][0], name: data[i][1], phone: data[i][2],
        desiredPosition: data[i][3], skills: data[i][4], availableTime: data[i][5],
        description: data[i][6], availability: data[i][9] || "looking"
      };
    }
  }
  return null;
}

function verifySeekerOwner(seekerId, pin){
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("JobSeekers");
  if(!sheet) return { success: false };
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(seekerId) && String(data[i][8]) === String(pin)){
      return { success: true };
    }
  }
  return { success: false };
}

function setSeekerAvailability(seekerId, pin, availability){
  const result = verifySeekerOwner(seekerId, pin);
  if(!result.success) return { success: false };
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("JobSeekers");
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][0]) === String(seekerId)){
      sheet.getRange(i+1, 10).setValue(availability);
      return { success: true, availability: availability };
    }
  }
  return { success: false };
}

// ============================================================
// ============================================================
//  🆕 JSON API Layer (แบบเดียวกับ PPMS) — ทำให้หน้าเว็บที่โฮสต์แยกที่ไหนก็ได้
//  (เช่น GitHub Pages) เรียกใช้ Code.gs นี้เป็น backend ผ่าน fetch() ได้
//
//  - GET  ?action=xxx&param1=..&param2=..   → ใช้กับฟังก์ชันที่แค่ "อ่าน" ข้อมูล พารามิเตอร์เป็นข้อความสั้นๆ
//  - POST body เป็น JSON { action: "xxx", ...ฟิลด์อื่นๆ }  → ใช้กับฟังก์ชันที่ "เขียน" ข้อมูล
//    หรือมีพารามิเตอร์เป็น object/array/รูปภาพ base64 (query string ยาวเกินไปไม่พอ)
//
//  ⚠️ สำคัญมาก ฝั่ง frontend ที่เรียก POST ต้อง "ไม่ตั้ง Content-Type" ใน fetch() เอง
//  (ปล่อยให้ browser ใส่ text/plain ให้อัตโนมัติ) ไม่งั้นจะเกิด CORS preflight (OPTIONS)
//  ซึ่ง Apps Script ตอบไม่ได้ จะทำให้ทุก POST พังทันที — ดูตัวอย่างที่ถูกต้องใน README
//
//  ตัว doPost(e) ด้านล่างจะ "แยกแยะ" เองว่า POST ที่เข้ามาเป็นคำสั่งจาก Telegram Bot
//  (จะมี field "update_id" เสมอ) หรือเป็นคำขอ API จากหน้าเว็บของเรา (จะมี field "action")
//  เพื่อให้ 1 ตัว doPost นี้ ใช้งานได้ทั้งสองแบบพร้อมกันโดยไม่ชนกัน
// ============================================================
// ============================================================

function jsonResponse(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e){
  return handleRequest(e);
}

function doPost(e){
  try {
    // เช็คก่อนว่า POST นี้มาจาก Telegram Bot หรือมาจากหน้าเว็บของเรา
    if(e.postData && e.postData.contents){
      let body = {};
      try { body = JSON.parse(e.postData.contents); } catch(err){ body = {}; }

      // Telegram ส่ง update มาเสมอพร้อม field "update_id" — ถ้าเจอ ให้ส่งต่อไปที่ตัวจัดการ Telegram เดิม
      if(body && body.update_id !== undefined){
        return handleTelegramWebhook_(e);
      }
    }
  } catch(err){
    // ถ้าตรวจสอบพลาดด้วยเหตุผลใดก็ตาม ให้ลองส่งไปที่ Telegram handler เป็นค่าเริ่มต้น (ปลอดภัยกว่า)
    return handleTelegramWebhook_(e);
  }

  // ไม่ใช่ Telegram → เป็นคำขอ API จากหน้าเว็บของเรา
  return handleRequest(e);
}

/**
 * Router กลาง: รับได้ทั้ง GET (query string ผ่าน e.parameter) และ POST (JSON body)
 * เพิ่ม action ใหม่ได้เรื่อยๆ ในอนาคตโดยแค่เพิ่ม case ใหม่ในนี้ ไม่ต้องแก้ไฟล์อื่นเลย
 */
function handleRequest(e){
  try {
    let params = e.parameter || {};
    if(e.postData && e.postData.contents){
      const body = JSON.parse(e.postData.contents);
      params = Object.assign({}, params, body);
    }

    const action = params.action;
    if(!action) throw new Error("ไม่ได้ระบุ action");

    let result;
    switch(action){
      // ---------- สั่งซื้อ / ออเดอร์ ----------
      case "submitOrder":            result = submitOrder(params.data); break;
      case "getOrderStatus":         result = getOrderStatus(params.orderId); break;
      case "uploadSlipToTelegram":   result = uploadSlipToTelegram(params.orderId, params.fileName, params.base64); break;

      // ---------- สินค้า / ร้านค้า ----------
      case "getProducts":            result = getProducts(); break;
      case "registerStore":          result = registerStore(params.data); break;
      case "getApprovedStores":      result = getApprovedStores(); break;
      case "submitProduct":          result = submitProduct(params.data); break;
      case "getStoreInfo":           result = getStoreInfo(params.shopName); break;
      case "getMemberOrderedShops":  result = getMemberOrderedShops(params.phone); break;
      case "getProductsByStore":     result = getProductsByStore(params.storeId, params.pin); break;
      case "updateProduct":          result = updateProduct(params.data); break;
      case "setStoreOpenStatus":     result = setStoreOpenStatus(params.storeId, params.pin, params.isOpen === true || params.isOpen === "true"); break;
      case "verifyStore":            result = verifyStore(params.storeId, params.pin); break;
      case "getStoreById":           result = getStoreById(params.storeId); break;
      case "getActiveAds":           result = getActiveAds(); break;

      // ---------- สมาชิก ----------
      case "registerMember":         result = registerMember(params.data); break;
      case "loginMember":            result = loginMember(params.phone, params.pin); break;

      // ---------- ไรเดอร์ ----------
      case "registerRider":          result = registerRider(params.data); break;
      case "getRiderOrders":         result = getRiderOrders(); break;

      // ---------- จองคิว ----------
      case "registerBookingShop":    result = registerBookingShop(params.data); break;
      case "getApprovedBookingShops":result = getApprovedBookingShops(); break;
      case "setBookingShopHours":    result = setBookingShopHours(params.shopId, params.pin, params.openTime, params.closeTime, params.slotMinutes); break;
      case "getBookingSlots":        result = getBookingSlots(params.shopId, params.date); break;
      case "createBooking":          result = createBooking(params.data); break;
      case "getShopBookingsByDate":  result = getShopBookingsByDate(params.shopId, params.pin, params.date); break;
      case "cancelBookingByShop":    result = cancelBookingByShop(params.bookingId, params.shopId, params.pin); break;

      // ---------- บ้านเช่า ----------
      case "registerRental":         result = registerRental(params.data); break;
      case "getApprovedRentals":     result = getApprovedRentals(); break;
      case "getRentalDetail":        result = getRentalDetail(params.rentalId); break;
      case "setRentalAvailability":  result = setRentalAvailability(params.rentalId, params.pin, params.availability); break;

      // ---------- ขายบ้าน/ที่ดิน ----------
      case "registerSale":           result = registerSale(params.data); break;
      case "getApprovedSales":       result = getApprovedSales(); break;
      case "getSaleDetail":          result = getSaleDetail(params.saleId); break;
      case "setSaleAvailability":    result = setSaleAvailability(params.saleId, params.pin, params.availability); break;

      // ---------- ขายรถ ----------
      case "registerCar":            result = registerCar(params.data); break;
      case "registerCarDealer":      result = registerCarDealer(params.data); break;
      case "addCarByDealer":         result = addCarByDealer(params.data); break;
      case "getDealerCars":          result = getDealerCars(params.dealerId, params.pin); break;
      case "setDealerCarAvailability": result = setDealerCarAvailability(params.carId, params.dealerId, params.pin, params.availability); break;
      case "getApprovedCars":        result = getApprovedCars(); break;
      case "getCarDetail":           result = getCarDetail(params.carId); break;
      case "setCarAvailability":     result = setCarAvailability(params.carId, params.pin, params.availability); break;

      // ---------- หางาน/รับสมัครงาน ----------
      case "registerJob":            result = registerJob(params.data); break;
      case "getApprovedJobs":        result = getApprovedJobs(); break;
      case "getJobDetail":           result = getJobDetail(params.jobId); break;
      case "setJobAvailability":     result = setJobAvailability(params.jobId, params.pin, params.availability); break;
      case "registerJobSeeker":      result = registerJobSeeker(params.data); break;
      case "getApprovedJobSeekers":  result = getApprovedJobSeekers(); break;
      case "getJobSeekerDetail":     result = getJobSeekerDetail(params.seekerId); break;
      case "setSeekerAvailability":  result = setSeekerAvailability(params.seekerId, params.pin, params.availability); break;

      default:
        throw new Error("ไม่รู้จัก action: " + action);
    }

    return jsonResponse({ ok: true, data: result });

  } catch(err){
    Logger.log(err);
    return jsonResponse({ ok: false, error: err.message });
  }
}
