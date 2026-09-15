let cart = [];
let lat = "";
let lng = "";
let selectedShopName = "";
let selectedShopPhone = "";
let selectedShopLat = "";
let selectedShopLng = "";
const shopLat = 8.5737747;
const shopLng = 99.2393303;
let deliveryFee = 0;
let distanceKm = 0;
let currentOrderId = "";
const promptPayId = "0932945790";

// ---------- สลับแท็บด้านล่าง ----------
function switchTab(tabName){
  document.querySelectorAll(".tab-page").forEach(function(el){
    el.classList.toggle("active", el.id === "tabpage-" + tabName);
  });
  document.querySelectorAll(".nav-item").forEach(function(el){
    el.classList.toggle("active", el.dataset.tab === tabName);
  });
  window.scrollTo(0, 0);
}

document.addEventListener("click", function(e){
  if(e.target.classList.contains("add-btn")){
    const index = Number(e.target.dataset.index);
    openQtyModal(index);
  }
});

let pendingProductIndex = null;
let pendingQty = 1;

function openQtyModal(index){
  const product = window.productsData[index];
  pendingProductIndex = index;
  pendingQty = 1;

  document.getElementById("qtyModalImg").src = product.image || "";
  document.getElementById("qtyModalImg").style.display = product.image ? "block" : "none";
  document.getElementById("qtyModalName").innerText = product.name;
  document.getElementById("qtyModalPrice").innerText = Number(product.price) + " บาท / รายการ";
  document.getElementById("qtyModalDesc").innerText = product.description || "";
  document.getElementById("qtyModalCount").innerText = pendingQty;
  document.getElementById("qtyModalOverlay").style.display = "flex";
}

function closeQtyModal(){
  document.getElementById("qtyModalOverlay").style.display = "none";
}

function changeQty(delta){
  pendingQty = Math.max(1, pendingQty + delta);
  document.getElementById("qtyModalCount").innerText = pendingQty;
}

function confirmAddToCart(){
  const product = window.productsData[pendingProductIndex];
  const existing = cart.find(function(item){
    return item.name === product.name && Number(item.price) === Number(product.price);
  });
  if(existing){
    existing.qty += pendingQty;
  } else {
    cart.push({ name: product.name, price: Number(product.price), qty: pendingQty });
  }
  closeQtyModal();
  window.renderCart();
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ============================================================
// 🆕 โหลดสินค้า + ร้านค้า ผ่าน API (แทน google.script.run เดิม)
// ============================================================
async function loadProducts(){
  try {
    window.productsData = await apiGet('getProducts') || [];
  } catch(error){
    window.productsData = [];
    const box = document.getElementById("productList");
    if(box){ box.innerHTML = "โหลดสินค้าไม่สำเร็จ: " + error.message; }
  }

  try {
    window.storesData = await apiGet('getApprovedStores') || [];
  } catch(error){
    window.storesData = [];
  }

  restoreViewOrHome();
  renderHomeShopGrid();
}

async function showStoreHome(){
  cart = [];
  localStorage.removeItem("pd_currentShop");
  localStorage.removeItem("pd_cart");
  window.renderCart();

  const savedPhone = localStorage.getItem("pd_memberPhone");
  if(savedPhone){
    try {
      const orderedShops = await apiGet('getMemberOrderedShops', { phone: savedPhone });
      renderStoreHomeHtml(orderedShops || []);
    } catch(error){
      renderStoreHomeHtml([]);
    }
  } else {
    renderStoreHomeHtml([]);
  }
}

function restoreViewOrHome(){
  const savedShop = localStorage.getItem("pd_currentShop");
  if(savedShop){
    showProductsByShop(savedShop, true);
  } else {
    showStoreHome();
  }
}

function renderStoreHomeHtml(orderedShops){
  let shops = [];
  window.productsData.forEach(function(product){
    const shop = String(product.shop || "ไม่ระบุร้าน");
    if(!shops.includes(shop)){ shops.push(shop); }
  });

  let html = "";

  const validOrderedShops = orderedShops.filter(function(s){
    return shops.indexOf(s.name) !== -1;
  });

  if(validOrderedShops.length > 0){
    html += '<h2>🕑 ร้านที่คุณเคยสั่ง</h2><div class="shop-scroll-row">';
    validOrderedShops.forEach(function(s){
      const storeInfo = (window.storesData || []).find(function(st){ return st.name === s.name; });
      const isOpen = !storeInfo || storeInfo.isOpen !== false;
      const clickAction = isOpen
        ? "showProductsByShop('" + escapeHtml(s.name) + "')"
        : "alert('ร้านนี้ปิดให้บริการชั่วคราวครับ')";

      html += '<div class="shop-tile' + (isOpen ? '' : ' shop-closed') + '" onclick="' + clickAction + '">';
      if(s.logo){
        html += '<img class="shop-tile-img" src="' + escapeHtml(s.logo) + '">';
      } else {
        html += '<div class="shop-tile-icon">🏪</div>';
      }
      html += '<span class="shop-tile-name">' + escapeHtml(s.name) + '</span>';
      if(!isOpen){ html += '<span class="shop-closed-badge">ปิดอยู่</span>'; }
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<h2>เลือกร้านโดยไม่เป็นสมาชิก</h2><div class="shop-grid">';

  shops.forEach(function(shop){
    const shopProducts = window.productsData.filter(function(p){
      return String(p.shop || "ไม่ระบุร้าน") === shop;
    });

    let shopImage = "";
    const storeInfo = (window.storesData || []).find(function(s){ return s.name === shop; });
    if(storeInfo && storeInfo.logo){
      shopImage = storeInfo.logo;
    } else {
      for(let i = 0; i < shopProducts.length; i++){
        if(shopProducts[i].image){ shopImage = shopProducts[i].image; break; }
      }
    }

    const isOpen = !storeInfo || storeInfo.isOpen !== false;
    const clickAction = isOpen
      ? "showProductsByShop('" + escapeHtml(shop) + "')"
      : "alert('ร้านนี้ปิดให้บริการชั่วคราวครับ')";

    html += '<div class="shop-tile' + (isOpen ? '' : ' shop-closed') + '" onclick="' + clickAction + '">';
    if(shopImage !== ""){
      html += '<img class="shop-tile-img" src="' + escapeHtml(shopImage) + '">';
    } else {
      html += '<div class="shop-tile-icon">🏪</div>';
    }
    html += '<span class="shop-tile-name">' + escapeHtml(shop) + '</span>';
    if(!isOpen){ html += '<span class="shop-closed-badge">ปิดอยู่</span>'; }
    html += '</div>';
  });

  html += "</div>";

  document.getElementById("productList").innerHTML = html || "ยังไม่มีร้านค้า";
}

function renderHomeShopGrid(){
  const box = document.getElementById("homeShopGrid");
  if(!box) return;

  const featuredShops = (window.storesData || [])
    .filter(function(s){ return s.isFeatured; })
    .map(function(s){ return s.name; });

  if(featuredShops.length === 0){
    box.innerHTML = "<p style='text-align:center;color:#999;'>ยังไม่มีร้านค้าขายดีตอนนี้</p>";
    return;
  }

  let html = '<div class="shop-grid">';

  featuredShops.forEach(function(shop){
    const storeInfo = (window.storesData || []).find(function(s){ return s.name === shop; });

    let shopImage = "";
    if(storeInfo && storeInfo.logo){
      shopImage = storeInfo.logo;
    } else {
      const shopProducts = (window.productsData || []).filter(function(p){
        return String(p.shop || "ไม่ระบุร้าน") === shop;
      });
      for(let i = 0; i < shopProducts.length; i++){
        if(shopProducts[i].image){ shopImage = shopProducts[i].image; break; }
      }
    }

    const isOpen = !storeInfo || storeInfo.isOpen !== false;
    const clickAction = isOpen
      ? "goToShopFromAd('" + escapeHtml(shop) + "')"
      : "alert('ร้านนี้ปิดให้บริการชั่วคราวครับ')";

    html += '<div class="shop-tile' + (isOpen ? '' : ' shop-closed') + '" onclick="' + clickAction + '">';
    if(shopImage !== ""){
      html += '<img class="shop-tile-img" src="' + escapeHtml(shopImage) + '">';
    } else {
      html += '<div class="shop-tile-icon">🏪</div>';
    }
    html += '<span class="shop-tile-name">' + escapeHtml(shop) + '</span>';
    if(!isOpen){ html += '<span class="shop-closed-badge">ปิดอยู่</span>'; }
    html += '</div>';
  });

  html += '</div>';
  box.innerHTML = html;
}

function showProductsByShop(shopName, isRestore){
  selectedShopName = shopName;
  localStorage.setItem("pd_currentShop", shopName);

  apiGet('getStoreInfo', { shopName: shopName }).then(function(store){
    if(store){
      selectedShopPhone = store.phone;
      selectedShopLat = store.lat;
      selectedShopLng = store.lng;
    }
  }).catch(function(){ /* ไม่กระทบการแสดงสินค้า ถ้าไม่พบข้อมูลร้าน */ });

  if(isRestore){
    const savedCart = localStorage.getItem("pd_cart");
    cart = savedCart ? JSON.parse(savedCart) : [];
  } else {
    cart = [];
    localStorage.removeItem("pd_cart");
  }
  window.renderCart();

  let html = `
    <button onclick="showStoreHome()" style="margin-bottom:15px; background:#555;">
      ← กลับไปเลือกร้าน
    </button>
    <div class="card">
      <h2>${escapeHtml(shopName)}</h2>
  `;
  html += '<div class="products-grid">';

  window.productsData.forEach(function(product, index){
    const shop = String(product.shop || "ไม่ระบุร้าน");
    if(shop !== shopName){ return; }

    const name = String(product.name || "");
    const price = Number(product.price || 0);
    const image = String(product.image || "");
    const description = String(product.description || "");

    html += '<div class="product-card" onclick="openQtyModal(' + index + ')">';
    if(image !== ""){
      html += '<img class="product-img" src="' + escapeHtml(image) + '">';
    }
    html += '<h3>' + escapeHtml(name) + '</h3>';
    html += '<p class="product-desc">🍴 ' + escapeHtml(description) + '</p>';
    html += '<p><b>' + price + ' บาท</b></p>';
    html += '<button type="button" class="add-btn" data-index="' + index + '" onclick="event.stopPropagation(); openQtyModal(' + index + ')">';
    html += 'เพิ่มสินค้าลงตะกร้า';
    html += '</button>';
    html += '</div>';
  });

  html += "</div>";
  document.getElementById("productList").innerHTML = html;
}

window.renderCart = function(){
  let html = "";
  let total = 0;

  cart.forEach(function(item,index){
    const qty = item.qty || 1;
    const lineTotal = Number(item.price) * qty;
    html += `
      <p>
        ${index+1}. ${escapeHtml(item.name)}
        x${qty} - ${lineTotal} บาท
        <button style="width:auto;margin-left:10px;padding:5px 10px;background:red;" onclick='window.removeItem(${index})'>ลบ</button>
      </p>
    `;
    total += lineTotal;
  });

  document.getElementById("cart").innerHTML = html || "ยังไม่มีสินค้า";
  document.getElementById("total").innerHTML =
    "ค่าสินค้า " + total + " บาท<br>" +
    "ค่าส่ง " + deliveryFee + " บาท<br>" +
    "รวม " + (total + deliveryFee) + " บาท";

  localStorage.setItem("pd_cart", JSON.stringify(cart));
};

window.removeItem = function(index){
  cart.splice(index,1);
  window.renderCart();
};

function goToShopFromAd(shopName){
  switchTab("order");
  showProductsByShop(shopName);
  window.scrollTo(0, 0);
}

// 🆕 เปลี่ยนจากลิงก์ ?page=xxx ของ Apps Script เป็นไฟล์ static ตรงๆ (GitHub Pages)
function goToFlashPage(){
  window.location.href = "flash.html";
}
function goToAdsPage(){
  window.location.href = "ads.html";
}

function calculateDistance(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI / 180;
  const dLon = (lon2-lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getDeliveryFee(distance){
  if(distance <= 5){ return 40; }
  else if(distance <= 10){ return 60; }
  else{ return 80; }
}

function applyLocation(newLat, newLng, sourceNote){
  lat = newLat;
  lng = newLng;
  distanceKm = calculateDistance(shopLat, shopLng, lat, lng);
  deliveryFee = getDeliveryFee(distanceKm);
  document.getElementById("locationStatus").innerHTML =
    "ปักหมุดแล้ว ✅" + (sourceNote ? " (" + sourceNote + ")" : "") +
    " ระยะทางประมาณ " + distanceKm.toFixed(2) + " กม. ค่าส่ง " + deliveryFee + " บาท";
  window.renderCart();
}

function getLocation(){
  navigator.geolocation.getCurrentPosition(
    function(position){ applyLocation(position.coords.latitude, position.coords.longitude); },
    function(){ alert("กรุณาเปิดสิทธิ์ตำแหน่ง GPS ก่อน"); }
  );
}

function showPaymentQR(amount){
  const qrUrl = "https://promptpay.io/" + promptPayId + "/" + amount.toFixed(2) + ".png";
  document.getElementById("qrImage").src = qrUrl;
  document.getElementById("payAmount").innerHTML = "ยอดชำระ " + amount + " บาท";
  document.getElementById("paymentBox").style.display = "block";
}

// ============================================================
// 🆕 ยืนยันออเดอร์ ผ่าน apiPost (แทน google.script.run)
// ============================================================
async function confirmOrder(){
  if(cart.length===0){ alert("ยังไม่มีสินค้า"); return; }

  let name = document.getElementById("customerName").value;
  let phone = document.getElementById("customerPhone").value;
  let address = document.getElementById("customerAddress").value.trim();

  if(name==""){ alert("กรุณากรอกชื่อ"); return; }
  if(phone==""){ alert("กรุณากรอกเบอร์"); return; }
  if(lat=="" || lng==""){ alert("กรุณาปักหมุดตำแหน่งก่อน"); return; }

  let itemsText = cart.map(function(item, index) {
    const qty = item.qty || 1;
    return (index + 1) + ". " + item.name + " x" + qty + " - " + (Number(item.price) * qty) + " บาท";
  }).join("\n");

  let productTotal = cart.reduce(function(sum, item){
    return sum + Number(item.price) * (item.qty || 1);
  }, 0);

  let totalAmount = productTotal + deliveryFee;

  try {
    const result = await apiPost('submitOrder', { data: {
      name: name, phone: phone, address: address,
      shopName: selectedShopName, shopPhone: selectedShopPhone,
      shopLat: selectedShopLat, shopLng: selectedShopLng,
      items: itemsText, productTotal: productTotal, delivery: deliveryFee,
      distance: distanceKm.toFixed(2), total: totalAmount, lat: lat, lng: lng
    }});

    alert("ส่งออเดอร์เข้า Telegram แล้ว ✅");
    localStorage.removeItem("pd_currentShop");
    localStorage.removeItem("pd_cart");
    currentOrderId = result.orderId;
    showPaymentQR(totalAmount);
    document.getElementById("statusBox").style.display = "block";
    document.getElementById("trackEmptyState").style.display = "none";
    document.getElementById("orderIdText").innerHTML = "หมายเลขออเดอร์: " + currentOrderId;
    switchTab("track");
    checkOrderStatus();
  } catch(error){
    alert("ส่งออเดอร์ไม่สำเร็จ: " + error.message);
  }
}

async function checkOrderStatus(){
  if(currentOrderId == ""){ alert("ยังไม่มีหมายเลขออเดอร์"); return; }

  try {
    const data = await apiGet('getOrderStatus', { orderId: currentOrderId });
    if(data == null){ alert("ไม่พบออเดอร์"); return; }

    document.getElementById("statusText").innerHTML = "สถานะ: " + data.status;

    if(data.status == "ส่งสำเร็จ"){
      document.getElementById("paymentBox").style.display = "none";
      document.getElementById("riderText").innerHTML = "✅ ส่งสำเร็จแล้ว ขอบคุณที่ใช้บริการครับ";
      return;
    }

    if(data.riderName != ""){
      document.getElementById("riderText").innerHTML =
        "🛵 ไรเดอร์: " + data.riderName +
        "<br>📞 " + data.riderPhone +
        "<br><br>" +
        "<a href='tel:" + String(data.riderPhone).replace(/-/g,"") + "'>" +
        "<button>โทรหาไรเดอร์</button></a>" +
        "<br><br>" +
        "<button onclick=\"copyPhone('" + String(data.riderPhone).replace(/-/g,"") + "')\">📋 คัดลอกเบอร์</button>";
    } else {
      document.getElementById("riderText").innerHTML = "ยังไม่มีไรเดอร์รับงาน";
    }
  } catch(error){
    alert("เช็กสถานะไม่สำเร็จ: " + error.message);
  }
}

setInterval(function(){
  if(currentOrderId != ""){ checkOrderStatus(); }
},5000);

function copyPhone(phone){
  navigator.clipboard.writeText(phone).then(function(){
    alert("คัดลอกเบอร์แล้ว: " + phone);
  }).catch(function(){
    alert("เบอร์ไรเดอร์: " + phone);
  });
}

function uploadSlip(){
  const file = document.getElementById("slipFile").files[0];

  if(!currentOrderId){ alert("ยังไม่มีหมายเลขออเดอร์"); return; }
  if(!file){ alert("กรุณาเลือกสลิปก่อน"); return; }

  const reader = new FileReader();
  reader.onload = async function(e){
    const base64 = e.target.result.split(",")[1];
    try {
      await apiPost('uploadSlipToTelegram', { orderId: currentOrderId, fileName: file.name, base64: base64 });
      alert("ส่งสลิปเรียบร้อย ✅");
      document.getElementById("slipFile").value = "";
    } catch(error){
      alert("ส่งสลิปไม่สำเร็จ: " + error.message);
    }
  };
  reader.readAsDataURL(file);
}

function newOrder(){
  cart = [];
  lat = "";
  lng = "";
  deliveryFee = 0;
  distanceKm = 0;
  currentOrderId = "";

  document.getElementById("cart").innerHTML = "ยังไม่มีสินค้า";
  document.getElementById("total").innerHTML = "รวม 0 บาท";
  document.getElementById("customerName").value = "";
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerAddress").value = "";
  document.getElementById("locationStatus").innerHTML = "ยังไม่ได้ปักหมุด";
  document.getElementById("paymentBox").style.display = "none";
  document.getElementById("statusBox").style.display = "none";
  document.getElementById("trackEmptyState").style.display = "block";

  if(document.getElementById("slipFile")){
    document.getElementById("slipFile").value = "";
  }

  window.scrollTo(0,0);
  switchTab("order");
}

function showCustomerHome(){
  loadProducts();
}

function showMerchantPage(){
  document.getElementById("productList").innerHTML = `

    <button onclick="showCustomerHome()" style="background:#555; margin-bottom:15px;">
    &larr; กลับหน้าสั่งสินค้า
    </button>

    <div class="form-grid">
      <h2>&#127970; สมัครร้านค้า</h2>

      <input id="shopName" placeholder="ชื่อร้าน เช่น ร้านป้าสมใจ">
      <br><br>
      <input id="shopPhone" placeholder="เบอร์โทรร้าน">
      <br><br>

      <input id="storeAddress"class="form-full" placeholder="ที่อยู่ร้านค้า" />

      <select id="shopCategory">
        <option value="">-- เลือกหมวดร้าน --</option>
        <option value="อาหาร">อาหาร</option>
        <option value="กาแฟ/เครื่องดื่ม">กาแฟ/เครื่องดื่ม</option>
        <option value="ของชำ">ของชำ</option>
        <option value="ร้านยา">ร้านยา</option>
        <option value="เบเกอรี่">เบเกอรี่</option>
        <option value="ผลไม้">ผลไม้</option>
        <option value="อื่นๆ">อื่นๆ</option>
      </select>

      <br><br>

      <button onclick="getShopLocation()">ปักหมุดร้าน</button>
      <p id="shopLocationText">ยังไม่ได้ปักหมุดร้าน</p>

      <button class="form-full" onclick="submitShopRegister()">ส่งใบสมัครร้านค้า</button>
    </div>

    <div class="card">
      <h2>➕ เพิ่มเมนูสินค้า</h2>

      <input id="storeId" placeholder="รหัสร้าน 8 หลัก">
      <br><br>
      <button onclick="checkStoreForProduct()">🔍 ตรวจสอบร้าน</button>

      <div id="myStoreBox" style="margin:15px 0; font-weight:bold;"></div>

      <input id="storePin" type="text" placeholder="PIN 4 หลัก">
      <br><br>

      <select id="productCategory">
        <option value="">-- เลือกหมวดสินค้า --</option>
        <option value="อาหาร">อาหาร</option>
        <option value="เครื่องดื่ม">เครื่องดื่ม</option>
        <option value="ของใช้ในบ้าน">ของใช้ในบ้าน</option>
        <option value="ยาและสุขภาพ">ยาและสุขภาพ</option>
        <option value="ขนม">ขนม</option>
        <option value="อื่นๆ">อื่นๆ</option>
      </select>

      <br><br>

      <input id="productName" placeholder="ชื่อสินค้า เช่น ข้าวกะเพราไก่">
      <br><br>

      <input id="productPrice" placeholder="ราคา เช่น 50" type="number">
      <br><br>

      <input type="file" id="productImageFile" accept="image/*">
      <br><br>

      <input id="productDescription" placeholder="รายละเอียดสินค้า">
      <br><br>

      <button onclick="submitNewProduct()">ส่งเมนูให้แอดมินตรวจ</button>
    </div>

    <div class="card">
      <h2>📋 สินค้าของร้านฉัน</h2>
      <button onclick="loadMyProducts()">🔍 ดูสินค้าของร้าน(ปุ่มเปิด-ปิดร้าน/แก้ไขสินค้า)</button>
      <div id="storeOpenToggleBox" style="margin-top:15px;"></div>
      <div id="myProductList" style="margin-top:15px;"></div>
    </div>

  `;

  loadApprovedStoresForProduct();
}

function loadApprovedStoresForProduct(){
  apiGet('getApprovedStores').then(function(stores){
    let html = '<option value="">-- เลือกร้านของคุณ --</option>';
    stores.forEach(function(store){
      html += '<option value="' + escapeHtml(store.name) + '">' + escapeHtml(store.name) + '</option>';
    });
    const el = document.getElementById("productShop");
    if(el){ el.innerHTML = html; }
  }).catch(function(error){
    console.error("โหลดร้านไม่สำเร็จ:", error.message);
  });
}

// ============================================================
// 🆕 ส่งเมนูสินค้าใหม่: ตรวจร้านก่อน (verifyStore) แล้วค่อยส่งเมนู (submitProduct)
// ============================================================
function submitNewProduct(){
  const storeId = document.getElementById("storeId").value;
  const pin = document.getElementById("storePin").value;
  const category = document.getElementById("productCategory").value;
  const name = document.getElementById("productName").value;
  const price = document.getElementById("productPrice").value;
  const file = document.getElementById("productImageFile").files[0];
  const description = document.getElementById("productDescription").value;

  if(storeId === ""){ alert("กรุณากรอกรหัสร้าน"); return; }
  if(pin === ""){ alert("กรุณากรอก PIN"); return; }
  if(name === ""){ alert("กรุณากรอกชื่อสินค้า"); return; }
  if(price === ""){ alert("กรุณากรอกราคา"); return; }
  if(!file){ alert("กรุณาเลือกรูปสินค้า"); return; }

  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = async function(){
      const canvas = document.createElement("canvas");
      const maxWidth = 600;
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.6);

      try {
        const result = await apiGet('verifyStore', { storeId: storeId, pin: pin });
        if(!result.success){
          alert("รหัสร้านหรือ PIN ไม่ถูกต้อง");
          return;
        }
        const shop = result.storeName;

        await apiPost('submitProduct', {
          data: { shop: shop, category: category, name: name, price: price, image: image, description: description }
        });

        alert("ส่งเมนูแล้ว ✅ รอแอดมินอนุมัติ");
        document.getElementById("productName").value = "";
        document.getElementById("productPrice").value = "";
        document.getElementById("productImageFile").value = "";
        document.getElementById("productDescription").value = "";
      } catch(error){
        alert("ส่งเมนูไม่สำเร็จ: " + error.message);
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

let registerShopLat = "";
let registerShopLng = "";

async function loadMyProducts(){
  const storeId = document.getElementById("storeId").value;
  const pin = document.getElementById("storePin").value;

  if(storeId === "" || pin === ""){ alert("กรุณากรอกรหัสร้านและ PIN ก่อน"); return; }

  document.getElementById("myProductList").innerHTML = "กำลังโหลด...";

  try {
    const result = await apiGet('getProductsByStore', { storeId: storeId, pin: pin });
    if(!result.success){
      document.getElementById("myProductList").innerHTML = "<p style='color:red;'>รหัสร้านหรือ PIN ไม่ถูกต้อง</p>";
      document.getElementById("storeOpenToggleBox").innerHTML = "";
      return;
    }
    renderStoreOpenToggle(result.isOpen);
    renderMyProducts(result.products);
  } catch(error){
    alert("โหลดรายการสินค้าไม่สำเร็จ: " + error.message);
  }
}

function renderStoreOpenToggle(isOpen){
  window.currentStoreIsOpen = isOpen;
  const box = document.getElementById("storeOpenToggleBox");
  box.innerHTML =
    '<div class="store-toggle-card ' + (isOpen ? 'is-open' : 'is-closed') + '" onclick="toggleStoreOpen()">' +
      (isOpen ? '🟢 ร้านเปิดอยู่ — กดเพื่อปิดร้าน' : '🔴 ร้านปิดอยู่ — กดเพื่อเปิดร้าน') +
    '</div>';
}

async function toggleStoreOpen(){
  const storeId = document.getElementById("storeId").value;
  const pin = document.getElementById("storePin").value;
  const newStatus = !window.currentStoreIsOpen;

  try {
    const result = await apiPost('setStoreOpenStatus', { storeId: storeId, pin: pin, isOpen: newStatus });
    if(!result.success){ alert("เปลี่ยนสถานะไม่สำเร็จ"); return; }
    renderStoreOpenToggle(result.isOpen);
  } catch(error){
    alert("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
  }
}

function renderMyProducts(products){
  const box = document.getElementById("myProductList");
  window.myProductsCache = {};
  products.forEach(function(p){ window.myProductsCache[p.rowIndex] = p; });

  if(products.length === 0){
    box.innerHTML = "<p>ยังไม่มีสินค้าในร้าน</p>";
    return;
  }

  let html = "";
  products.forEach(function(p){
    html +=
      '<div id="prodRow_' + p.rowIndex + '" style="border:1px solid #eee;border-radius:12px;padding:10px;margin-bottom:10px;display:flex;gap:10px;align-items:center;">' +
        '<img src="' + escapeHtml(p.image || "") + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;background:#f5f5f5;">' +
        '<div style="flex:1;">' +
          '<b>' + escapeHtml(p.name) + '</b><br>' +
          '<span>' + Number(p.price) + ' บาท | ' + escapeHtml(p.category || "") + '</span><br>' +
          '<span style="color:#888;font-size:13px;">สถานะ: ' + escapeHtml(p.status || "") + '</span>' +
        '</div>' +
        '<button onclick="startEditProduct(' + p.rowIndex + ')" style="width:auto;background:#ff9900;">✏️ แก้ไขสินค้า</button>' +
      '</div>';
  });
  box.innerHTML = html;
}

function startEditProduct(rowIndex){
  const p = window.myProductsCache[rowIndex];
  const card = document.getElementById("prodRow_" + rowIndex);

  card.innerHTML =
    '<div style="width:100%;">' +
      '<input id="editName_' + rowIndex + '" value="' + escapeHtml(p.name) + '" placeholder="ชื่อสินค้า"><br><br>' +
      '<input id="editPrice_' + rowIndex + '" type="number" value="' + Number(p.price) + '" placeholder="ราคา"><br><br>' +
      '<select id="editCategory_' + rowIndex + '">' +
        '<option value="อาหาร">อาหาร</option>' +
        '<option value="เครื่องดื่ม">เครื่องดื่ม</option>' +
        '<option value="ของใช้ในบ้าน">ของใช้ในบ้าน</option>' +
        '<option value="ยาและสุขภาพ">ยาและสุขภาพ</option>' +
        '<option value="ขนม">ขนม</option>' +
        '<option value="อื่นๆ">อื่นๆ</option>' +
      '</select><br><br>' +
      '<input id="editDescription_' + rowIndex + '" value="' + escapeHtml(p.description || "") + '" placeholder="รายละเอียดสินค้า"><br><br>' +
      '<input type="file" id="editImageFile_' + rowIndex + '" accept="image/*">' +
      '<p style="font-size:12px;color:#888;">(ไม่เลือกไฟล์ = ใช้รูปเดิม)</p>' +
      '<button onclick="saveEditedProduct(' + rowIndex + ')" style="background:#2ecc71;">💾 บันทึกสินค้า</button>' +
      '<button onclick="renderMyProducts(Object.values(window.myProductsCache))" style="background:#999;">ยกเลิก</button>' +
    '</div>';

  document.getElementById("editCategory_" + rowIndex).value = p.category || "";
}

function saveEditedProduct(rowIndex){
  const p = window.myProductsCache[rowIndex];
  const name = document.getElementById("editName_" + rowIndex).value;
  const price = document.getElementById("editPrice_" + rowIndex).value;
  const category = document.getElementById("editCategory_" + rowIndex).value;
  const description = document.getElementById("editDescription_" + rowIndex).value;
  const file = document.getElementById("editImageFile_" + rowIndex).files[0];

  if(name === "" || price === ""){ alert("กรุณากรอกชื่อสินค้าและราคา"); return; }

  async function doSave(imageBase64){
    try {
      const result = await apiPost('updateProduct', { data: {
        rowIndex: rowIndex, shop: p.shop, category: category, name: name, price: price,
        description: description, image: imageBase64 || ""
      }});
      if(!result.success){ alert(result.message || "บันทึกไม่สำเร็จ"); return; }
      alert("บันทึกสินค้าแล้ว ✅");
      loadMyProducts();
    } catch(error){
      alert("บันทึกไม่สำเร็จ: " + error.message);
    }
  }

  if(file){
    const reader = new FileReader();
    reader.onload = function(e){
      const img = new Image();
      img.onload = function(){
        const canvas = document.createElement("canvas");
        const maxWidth = 600;
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        doSave(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    doSave("");
  }
}

function getShopLocation(){
  navigator.geolocation.getCurrentPosition(
    function(position){
      registerShopLat = position.coords.latitude;
      registerShopLng = position.coords.longitude;
      document.getElementById("shopLocationText").innerHTML =
        "ปักหมุดร้านแล้ว ✅<br>Lat: " + registerShopLat + "<br>Lng: " + registerShopLng;
    },
    function(){ alert("กรุณาเปิด GPS ก่อน"); }
  );
}

async function submitShopRegister(){
  const name = document.getElementById("shopName").value;
  const phone = document.getElementById("shopPhone").value;
  const storeAddress = document.getElementById("storeAddress").value.trim();
  const category = document.getElementById("shopCategory").value;

  if(name === ""){ alert("กรุณากรอกชื่อร้าน"); return; }
  if(phone === ""){ alert("กรุณากรอกเบอร์ร้าน"); return; }
  if (!name || !phone || !storeAddress || !category) { alert("กรุณากรอกข้อมูลร้านค้าให้ครบ"); return; }
  if(category === ""){ alert("กรุณากรอกหมวดร้าน"); return; }
  if(registerShopLat === "" || registerShopLng === ""){ alert("กรุณาปักหมุดร้านก่อน"); return; }

  try {
    const result = await apiPost('registerStore', { data: {
      name: name, phone: phone, category: category, storeAddress: storeAddress,
      lat: registerShopLat, lng: registerShopLng
    }});
    alert(
      "ส่งใบสมัครร้านค้าแล้ว ✅\n\n" +
      "รหัสร้าน: " + result.storeId + "\n" +
      "PIN: " + result.pin + "\n\n" +
      "กรุณาเก็บไว้ใช้เพิ่มสินค้า\nและรอแอดมินอนุมัติ"
    );
    showCustomerHome();
  } catch(error){
    alert("สมัครร้านไม่สำเร็จ: " + error.message);
  }
}

async function checkStoreForProduct(){
  const storeId = document.getElementById("storeId").value.trim();
  if(storeId === ""){ alert("กรุณากรอกรหัสร้าน"); return; }

  try {
    const result = await apiGet('getStoreById', { storeId: storeId });
    if(!result.success){
      document.getElementById("myStoreBox").innerHTML = "❌ ไม่พบรหัสร้านนี้";
      return;
    }
    document.getElementById("myStoreBox").innerHTML =
      "🏪 ร้านของคุณ: " + result.storeName + "<br>" +
      "🆔 รหัสร้าน: " + result.storeId + "<br>" +
      "สถานะ: " + result.status;
  } catch(error){
    document.getElementById("myStoreBox").innerHTML = "❌ เชื่อมต่อไม่สำเร็จ: " + error.message;
  }
}

window.addEventListener("load", function(){
  loadProducts();
  renderMemberBadge();
  loadAdSlider();
});

function renderMemberBadge(){
  const name = localStorage.getItem("pd_memberName");
  const box = document.getElementById("memberBadge");
  if(name){
    box.innerHTML = "👤 เข้าสู่ระบบแล้ว: " + escapeHtml(name) +
      " | <a href=\"javascript:void(0)\" onclick=\"logoutMember()\">ออกจากระบบ</a>";
  } else {
    box.innerHTML = "";
  }
}

function logoutMember(){
  localStorage.removeItem("pd_memberName");
  localStorage.removeItem("pd_memberPhone");
  localStorage.removeItem("pd_memberAddress");
  localStorage.removeItem("pd_memberLat");
  localStorage.removeItem("pd_memberLng");
  renderMemberBadge();
  alert("ออกจากระบบแล้ว");
}

function showMemberGate(){
  const savedName = localStorage.getItem("pd_memberName");
  const savedPhone = localStorage.getItem("pd_memberPhone");
  const savedAddress = localStorage.getItem("pd_memberAddress");
  const savedLat = localStorage.getItem("pd_memberLat");
  const savedLng = localStorage.getItem("pd_memberLng");

  if(savedName && savedPhone){
    enterMemberOrder(savedName, savedPhone, savedAddress, savedLat, savedLng);
    return;
  }
  renderMemberForms("login");
}

function renderMemberForms(tab){
  document.getElementById("productList").innerHTML = `

    <button onclick="showCustomerHome()" style="background:#555; margin-bottom:15px;">
      &larr; กลับหน้าแรก
    </button>

    <div class="card">
      <h2>👤 ระบบสมาชิก</h2>

      <div class="member-tabs">
        <button class="member-tab-btn ${tab === "login" ? "active" : ""}" onclick="renderMemberForms('login')">เข้าสู่ระบบ</button>
        <button class="member-tab-btn ${tab === "register" ? "active" : ""}" onclick="renderMemberForms('register')">สมัครสมาชิก</button>
      </div>

      <div id="memberFormBox"></div>
    </div>
  `;

  if(tab === "login"){
    document.getElementById("memberFormBox").innerHTML = `
      <input id="loginPhone" placeholder="เบอร์โทร"><br><br>
      <input id="loginPin" type="text" placeholder="PIN 4 หลัก"><br><br>
      <button onclick="memberLogin()" style="background:#2ecc71;">เข้าสู่ระบบ</button>
    `;
  } else {
    document.getElementById("memberFormBox").innerHTML = `
      <input id="registerName" placeholder="ชื่อของคุณ"><br><br>
      <input id="registerPhone" placeholder="เบอร์โทร"><br><br>
      <input id="registerAddress" placeholder="ที่อยู่ เช่น 99/1 ม.2 ต.พระแสง"><br><br>
      <input id="registerPin" type="text" placeholder="ตั้ง PIN 4 หลัก"><br><br>
      <button onclick="getMemberRegisterLocation()" style="background:#7c3aed;">📍 ปักหมุดที่อยู่ (แนะนำ ไม่ต้องปักหมุดใหม่ทุกครั้งที่สั่ง)</button>
      <p id="memberRegisterLocationText" style="font-size:13px;color:#666;text-align:center;margin:8px 0 0;">ยังไม่ได้ปักหมุด (ข้ามได้ ไปปักหมุดตอนสั่งทีหลังก็ได้)</p>
      <br>
      <button onclick="memberRegister()" style="background:#2ecc71;">สมัครสมาชิก</button>
    `;
  }
}

let regMemberLat = "";
let regMemberLng = "";

function getMemberRegisterLocation(){
  navigator.geolocation.getCurrentPosition(
    function(position){
      regMemberLat = position.coords.latitude;
      regMemberLng = position.coords.longitude;
      document.getElementById("memberRegisterLocationText").innerHTML = "ปักหมุดแล้ว ✅";
    },
    function(){ alert("กรุณาเปิดสิทธิ์ตำแหน่ง GPS ก่อน"); }
  );
}

async function memberLogin(){
  const phone = document.getElementById("loginPhone").value.trim();
  const pin = document.getElementById("loginPin").value.trim();

  if(phone === "" || pin === ""){ alert("กรุณากรอกเบอร์และ PIN"); return; }

  try {
    const result = await apiGet('loginMember', { phone: phone, pin: pin });
    if(!result.success){ alert(result.message || "เข้าสู่ระบบไม่สำเร็จ"); return; }

    localStorage.setItem("pd_memberName", result.name);
    localStorage.setItem("pd_memberPhone", result.phone);
    localStorage.setItem("pd_memberAddress", result.address || "");
    localStorage.setItem("pd_memberLat", result.lat || "");
    localStorage.setItem("pd_memberLng", result.lng || "");
    enterMemberOrder(result.name, result.phone, result.address, result.lat, result.lng);
  } catch(error){
    alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
  }
}

async function memberRegister(){
  const name = document.getElementById("registerName").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const address = document.getElementById("registerAddress").value.trim();
  const pin = document.getElementById("registerPin").value.trim();

  if(name === "" || phone === "" || pin === ""){ alert("กรุณากรอกข้อมูลให้ครบ"); return; }

  try {
    const result = await apiPost('registerMember', { data: {
      name: name, phone: phone, pin: pin, address: address, lat: regMemberLat, lng: regMemberLng
    }});
    if(!result.success){ alert(result.message || "สมัครสมาชิกไม่สำเร็จ"); return; }

    localStorage.setItem("pd_memberName", result.name);
    localStorage.setItem("pd_memberPhone", result.phone);
    localStorage.setItem("pd_memberAddress", result.address || "");
    localStorage.setItem("pd_memberLat", result.lat || "");
    localStorage.setItem("pd_memberLng", result.lng || "");
    alert("สมัครสมาชิกสำเร็จ ✅");
    enterMemberOrder(result.name, result.phone, result.address, result.lat, result.lng);
  } catch(error){
    alert("สมัครสมาชิกไม่สำเร็จ: " + error.message);
  }
}

function enterMemberOrder(name, phone, address, memberLat, memberLng){
  showCustomerHome();
  renderMemberBadge();

  document.getElementById("customerName").value = name;
  document.getElementById("customerPhone").value = phone;
  if(address){ document.getElementById("customerAddress").value = address; }
  if(memberLat && memberLng){
    applyLocation(memberLat, memberLng, "จากที่อยู่สมาชิก — ปักหมุดใหม่ได้ถ้าสั่งจากที่อื่น");
  }
}

async function loadAdSlider(){
  try {
    const ads = await apiGet('getActiveAds');
    renderAdSlider(ads || []);
  } catch(error){
    renderAdSlider([]);
  }
}

function adClickHandler(linkShopName){
  if(linkShopName === "__แฟลช__"){ goToFlashPage(); return; }
  if(linkShopName === "__ลงโฆษณา__"){ goToAdsPage(); return; }
  if(linkShopName){ goToShopFromAd(linkShopName); }
}

function renderAdSlider(ads){
  const track = document.getElementById("adTrack");
  if(!track) return;

  if(ads.length === 0){
    track.closest(".ad-slider").style.display = "none";
    return;
  }

  const allAds = ads.concat([ads[0]]);

  track.innerHTML = allAds.map(function(ad){
    const clickable = ad.linkShopName ? 'style="cursor:pointer;" onclick="adClickHandler(\'' + escapeHtml(ad.linkShopName) + '\')"' : '';
    return '<img src="' + escapeHtml(ad.imageUrl) + '" ' + clickable + '>';
  }).join('');

  const imageWidth = 330;
  let currentIndex = 0;

  setInterval(function(){
    currentIndex++;
    track.style.transition = "transform 0.6s ease";
    track.style.transform = "translateX(-" + (currentIndex * imageWidth) + "px)";

    if(currentIndex === ads.length){
      setTimeout(function(){
        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        currentIndex = 0;
      }, 600);
    }
  }, 3000);
}
