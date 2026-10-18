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
const promptPayId = "0932945790";

// 🆕 ระบบคูปอง
let selectedCouponId = "";
let memberCouponsCache = [];

// ---------- สลับแท็บด้านล่าง ----------
function switchTab(tabName){
  document.querySelectorAll(".tab-page").forEach(function(el){
    el.classList.toggle("active", el.id === "tabpage-" + tabName);
  });
  document.querySelectorAll(".nav-item").forEach(function(el){
    el.classList.toggle("active", el.dataset.tab === tabName);
  });
  window.scrollTo(0, 0);

  if(tabName === "track"){ renderOrders_(false); refreshOrders_(); }
  if(tabName === "cart"){ loadMemberCoupons(); } // 🆕 เข้าตะกร้าทีไร เช็คคูปองที่มีทุกครั้ง
}

// 🆕 โหลดคูปองที่ใช้ได้ของสมาชิก (ต้องล็อกอินสมาชิกไว้ก่อน) มาให้เลือกใช้ตอนสั่งของ
async function loadMemberCoupons(){
  const box = document.getElementById("couponBox");
  const select = document.getElementById("couponSelect");
  if(!box || !select) return;

  const phone = localStorage.getItem("pd_memberPhone");
  if(!phone){ box.style.display = "none"; return; }

  try {
    const coupons = await apiGet('getMemberCoupons', { phone: phone });
    memberCouponsCache = coupons || [];
  } catch(error){
    memberCouponsCache = [];
  }

  if(memberCouponsCache.length === 0){ box.style.display = "none"; return; }

  // 🆕 ถ้ามากดปุ่ม "ใช้คูปองนี้" มาจากหน้าสมาชิก (member.html) ให้เลือกคูปองนั้นไว้ให้อัตโนมัติ
  const pendingCoupon = localStorage.getItem("pd_selectedCouponId");
  if(pendingCoupon){
    selectedCouponId = pendingCoupon;
    localStorage.removeItem("pd_selectedCouponId");
  }

  let html = '<option value="">ไม่ใช้คูปอง</option>';
  memberCouponsCache.forEach(function(c){
    const label = c.description + " (หมดอายุ " + c.expiryDate + ")";
    html += '<option value="' + c.couponId + '">' + escapeHtml(label) + '</option>';
  });
  select.innerHTML = html;
  box.style.display = "block";

  // ถ้าเคยเลือกคูปองนี้ไว้แล้วแต่หมดไปจากลิสต์ (ใช้ไปแล้ว/หมดอายุ) ให้ล้างค่า
  if(selectedCouponId && !memberCouponsCache.some(function(c){ return c.couponId === selectedCouponId; })){
    selectedCouponId = "";
  }
  select.value = selectedCouponId;
  window.renderCart();
}

// 🆕 เมื่อลูกค้าเลือก/ยกเลิกคูปองในตะกร้า
window.onCouponSelected = function(){
  const select = document.getElementById("couponSelect");
  selectedCouponId = select ? select.value : "";
  window.renderCart();
};

// 🆕 คำนวณส่วนลดที่ "คาดว่าจะได้" ไว้โชว์ในตะกร้า (ยอดจริงคำนวณซ้ำฝั่งเซิร์ฟเวอร์ตอนยืนยันออเดอร์เสมอ)
function getEstimatedCouponDiscount(){
  if(!selectedCouponId) return 0;
  const coupon = memberCouponsCache.find(function(c){ return c.couponId === selectedCouponId; });
  if(!coupon || coupon.appliesTo !== "delivery") return 0;
  if(coupon.discountType === "percent"){
    return Math.round(deliveryFee * (Number(coupon.discountValue) / 100));
  }
  return Math.min(Number(coupon.discountValue), deliveryFee);
}

document.addEventListener("click", function(e){
  if(e.target.classList.contains("add-btn")){
    const index = Number(e.target.dataset.index);
    openQtyModal(index);
  }
});

let pendingProductIndex = null;
let pendingQty = 1;
let pendingSweetness = "100%"; // 🆕
let pendingWaterStyle = "ผสมเลย"; // 🆕
const DEFAULT_BLUE_CARD_ = "0932945790"; // 🆕 ถ้าลูกค้าไม่ระบุ ใช้เบอร์นี้แทน

function openQtyModal(index){
  const product = window.productsData[index];
  if(product.inStock === false){ alert("สินค้านี้หมดชั่วคราว ขออภัยครับ"); return; }
  pendingProductIndex = index;
  pendingQty = 1;

  document.getElementById("qtyModalImg").src = product.image || "";
  document.getElementById("qtyModalImg").style.display = product.image ? "block" : "none";
  document.getElementById("qtyModalName").innerText = product.name;
  document.getElementById("qtyModalPrice").innerText = Number(product.price) + " บาท / รายการ";
  document.getElementById("qtyModalDesc").innerText = product.description || "";
  document.getElementById("qtyModalCount").innerText = pendingQty;
  document.getElementById("itemNoteInput").value = ""; // 🆕 โน้ตถึงร้าน ล้างทุกครั้งที่เปิดเมนูใหม่

  // 🆕 เฉพาะหมวด "เครื่องดื่ม" เท่านั้น ที่โชว์ตัวเลือกหวาน/แยกน้ำ/Blue Card
  const isDrink = product.category === "เครื่องดื่ม";
  const drinkBox = document.getElementById("qtyModalDrinkOptions");
  if(isDrink){
    pendingSweetness = "100%";
    pendingWaterStyle = "ผสมเลย";
    drinkBox.style.display = "block";
    renderSweetnessOptions();
    renderWaterStyleOptions();
    document.getElementById("blueCardInput").value = "";
  } else {
    drinkBox.style.display = "none";
  }

  document.getElementById("qtyModalOverlay").style.display = "flex";
}

function renderSweetnessOptions(){
  const options = ["25%","50%","75%","100%"];
  document.getElementById("sweetnessOptions").innerHTML = options.map(function(o){
    return '<button type="button" class="option-pill' + (o === pendingSweetness ? ' active' : '') + '" onclick="selectSweetness(\'' + o + '\')">' + o + '</button>';
  }).join('');
}
function selectSweetness(value){
  pendingSweetness = value;
  renderSweetnessOptions();
}

function renderWaterStyleOptions(){
  const options = ["ผสมเลย","แยกน้ำ"];
  document.getElementById("waterStyleOptions").innerHTML = options.map(function(o){
    return '<button type="button" class="option-pill' + (o === pendingWaterStyle ? ' active' : '') + '" onclick="selectWaterStyle(\'' + o + '\')">' + o + '</button>';
  }).join('');
}
function selectWaterStyle(value){
  pendingWaterStyle = value;
  renderWaterStyleOptions();
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
  const isDrink = product.category === "เครื่องดื่ม";

  // 🆕 เก็บตัวเลือกที่เลือกไว้ (ถ้าเป็นเครื่องดื่ม) — ถ้าไม่ระบุ Blue Card ใช้เบอร์ร้านแทนอัตโนมัติ
  const options = isDrink ? {
    sweetness: pendingSweetness,
    waterStyle: pendingWaterStyle,
    blueCard: (document.getElementById("blueCardInput").value.trim() || DEFAULT_BLUE_CARD_)
  } : null;

  // 🆕 โน้ตถึงร้าน (ทุกหมวด) — ตัดบรรทัดใหม่ให้เป็นบรรทัดเดียว จำกัด 120 ตัวอักษร
  const note = (document.getElementById("itemNoteInput").value || "").replace(/\s+/g, " ").trim().slice(0, 120);

  // 🆕 รวมรายการซ้ำได้เฉพาะที่ตัวเลือกและโน้ตตรงกันทุกอย่างเป๊ะๆ เท่านั้น (หวานคนละระดับ/โน้ตต่างกัน = แยกรายการ)
  const existing = cart.find(function(item){
    return item.name === product.name &&
      Number(item.price) === Number(product.price) &&
      JSON.stringify(item.options || null) === JSON.stringify(options) &&
      (item.note || "") === note;
  });

  if(existing){
    existing.qty += pendingQty;
  } else {
    cart.push({ name: product.name, price: Number(product.price), qty: pendingQty, options: options, note: note });
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
  // 🆕 โหลดแบบ "โชว์ของเก่าก่อน แล้วอัปเดตเบื้องหลัง" — เปิดแอปครั้งที่สองเป็นต้นไป ร้าน/สินค้าขึ้นทันที
  // ไม่ต้องรอ Apps Script ตอบ (ซึ่งช้าได้หลายวินาที) แล้วค่อยเอาข้อมูลล่าสุดมาแทนเมื่อโหลดเสร็จ
  const CACHE_KEY = "pd_catalogCache";
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  let cached = null;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if(raw && Array.isArray(raw.products) && Array.isArray(raw.stores) && raw.products.length > 0 &&
       (Date.now() - Number(raw.ts || 0)) < CACHE_MAX_AGE_MS){
      cached = raw;
    }
  } catch(e){ cached = null; }

  // ยิงทั้งสองคำขอพร้อมกันเลย (ไม่รอตัวแรกเสร็จก่อน) ลดเวลารวมจาก "บวกกัน" เหลือแค่ "เท่าตัวที่ช้าที่สุด"
  let productsFailed = false;
  const productsPromise = apiGet('getProducts').catch(function(error){
    productsFailed = true;
    if(!cached){
      const box = document.getElementById("productList");
      if(box){ box.innerHTML = "โหลดสินค้าไม่สำเร็จ: " + error.message; }
    }
    return [];
  });
  let storesFailed = false;
  const storesPromise = apiGet('getApprovedStores').catch(function(){
    storesFailed = true;
    return [];
  });
  const freshPromise = Promise.all([productsPromise, storesPromise]);

  // 🆕 รายการร้าน (เล็ก/เร็ว) ไม่ต้องรอสินค้า (ก้อนใหญ่) — ร้านมาถึงเมื่อไรก็วาดบล็อก "ร้านแนะนำ/ร้านขายดี" ทันที
  if(!cached){
    storesPromise.then(function(stores){
      if(storesFailed || !Array.isArray(stores) || stores.length === 0) return;
      window.storesData = stores;
      renderHomeRecommendedGrid();
      renderHomeShopGrid();
    });
  }

  if(cached){
    // 1) โชว์ข้อมูลที่เคยโหลดไว้ทันที
    window.productsData = cached.products;
    window.storesData = cached.stores;
    restoreViewOrHome();
    renderHomeRecommendedGrid();
    renderHomeShopGrid();
  }

  const results = await freshPromise;
  const freshProducts = results[0] || [];
  const freshStores = results[1] || [];
  const loadedOk = !productsFailed && !storesFailed;

  // เก็บข้อมูลล่าสุดไว้ใช้ครั้งหน้า (เก็บเฉพาะตอนโหลดสำเร็จครบทั้งสองอย่าง)
  if(loadedOk && freshProducts.length > 0){
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), products: freshProducts, stores: freshStores }));
    } catch(e){ /* เต็ม/ใช้ไม่ได้ ก็ข้ามไป */ }
  }

  if(!cached){
    // ไม่เคยมีข้อมูลเก่า = โหลดครั้งแรก ใช้ข้อมูลใหม่ตามปกติ
    window.productsData = freshProducts;
    window.storesData = freshStores;
    restoreViewOrHome();
    renderHomeRecommendedGrid();
    renderHomeShopGrid();
    return;
  }

  // มีของเก่าโชว์ไปแล้ว → สลับเป็นของใหม่ "เฉพาะเมื่อปลอดภัย" และข้อมูลเปลี่ยนจริง
  if(!loadedOk) return;
  if(JSON.stringify(freshProducts) === JSON.stringify(cached.products) &&
     JSON.stringify(freshStores) === JSON.stringify(cached.stores)) return;

  const modal = document.getElementById("qtyModalOverlay");
  const modalOpen = modal && modal.style.display === "flex";
  const searchBox = document.getElementById("searchBox");
  const searching = searchBox && searchBox.value.trim() !== "";
  // ถ้าลูกค้าเริ่มใส่ของในตะกร้า/เปิดหน้าต่างเลือกเมนู/กำลังค้นหาอยู่ ห้ามวาดหน้าใหม่ทับ (ปุ่มเมนูอ้างอิงลำดับในรายการเดิม)
  // ข้อมูลใหม่ถูกเก็บไว้แล้ว จะขึ้นในการเปิดแอปครั้งถัดไป
  if(cart.length > 0 || modalOpen || searching) return;

  window.productsData = freshProducts;
  window.storesData = freshStores;
  restoreViewOrHome();
  renderHomeRecommendedGrid();
  renderHomeShopGrid();
}

async function showStoreHome(){
  cart = [];
  localStorage.removeItem("pd_currentShop");
  localStorage.removeItem("pd_cart");
  window.renderCart();

  const searchBoxEl = document.getElementById("searchBox"); // 🆕 เคลียร์ช่องค้นหาทุกครั้งที่กลับหน้าแรก
  if(searchBoxEl){ searchBoxEl.value = ""; }

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

/**
 * 🆕 ค้นหาร้านค้า + สินค้าพร้อมกัน — พิมพ์คำอะไรก็ได้ในช่องค้นหาด้านบน
 * ถ้าลบข้อความจนว่าง จะกลับไปหน้าเดิม (หน้าแรกหรือหน้าร้านที่เปิดค้างไว้) อัตโนมัติ
 */
function renderSearchResults(query){
  const q = query.trim().toLowerCase();
  if(q === ""){
    restoreViewOrHome();
    return;
  }

  const allShops = [];
  (window.productsData || []).forEach(function(p){
    const shop = String(p.shop || "ไม่ระบุร้าน");
    if(!allShops.includes(shop)){ allShops.push(shop); }
  });
  const matchedShops = allShops.filter(function(shop){
    return shop.toLowerCase().includes(q);
  });

  const matchedProducts = [];
  (window.productsData || []).forEach(function(p, idx){
    if(String(p.name || "").toLowerCase().includes(q)){
      matchedProducts.push({ product: p, index: idx });
    }
  });

  let html = '<div class="card"><h2>🔍 ผลการค้นหา: "' + escapeHtml(query) + '"</h2>';

  if(matchedShops.length === 0 && matchedProducts.length === 0){
    html += '<p style="text-align:center;color:#999;padding:20px 0;">ไม่พบร้านหรือสินค้าที่ตรงกับคำค้นหา</p>';
  }

  if(matchedShops.length > 0){
    html += '<h3 style="margin:10px 0;">🏪 ร้านค้า</h3><div class="shop-grid">';
    matchedShops.forEach(function(shop){
      const storeInfo = (window.storesData || []).find(function(s){ return s.name === shop; });
      const shopImage = storeInfo && storeInfo.logo ? storeInfo.logo : "";
      html += '<div class="shop-tile" onclick="showProductsByShop(\'' + escapeHtml(shop) + '\')">';
      if(shopImage){
        html += '<img class="shop-tile-img" src="' + escapeHtml(shopImage) + '">';
      } else {
        html += '<div class="shop-tile-icon">🏪</div>';
      }
      html += '<span class="shop-tile-name">' + escapeHtml(shop) + '</span></div>';
    });
    html += '</div>';
  }

  if(matchedProducts.length > 0){
    html += '<h3 style="margin:16px 0 10px;">🛍️ สินค้า</h3><div class="products-grid">';
    matchedProducts.forEach(function(item){
      const p = item.product;
      const inStock = p.inStock !== false;
      html += '<div class="product-card' + (inStock ? '' : ' out-of-stock') + '" onclick="' + (inStock ? "openSearchProduct(" + item.index + ")" : "") + '">';
      if(p.image){ html += '<img class="product-img" src="' + escapeHtml(p.image) + '">'; }
      if(!inStock){ html += '<span class="out-of-stock-badge">หมดชั่วคราว</span>'; }
      html += '<h3>' + escapeHtml(p.name) + '</h3>';
      html += '<p class="product-desc" style="font-size:11px;">🏪 ' + escapeHtml(p.shop) + '</p>';
      html += '<p><b>' + Number(p.price) + ' บาท</b></p>';
      if(inStock){
        html += '<button type="button" onclick="event.stopPropagation(); openSearchProduct(' + item.index + ')">เพิ่มสินค้าลงตะกร้า</button>';
      } else {
        html += '<button type="button" disabled>สินค้าหมดชั่วคราว</button>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  document.getElementById("productList").innerHTML = html;
}

/** 🆕 กดสินค้าจากผลค้นหา — สลับไปหน้าร้านนั้นให้ครบก่อน (ตั้งเบอร์/พิกัดร้าน + เคลียร์ตะกร้าถ้าคนละร้าน) แล้วค่อยเปิดหน้าต่างเลือกจำนวน */
function openSearchProduct(index){
  const product = window.productsData[index];
  if(!product) return;
  showProductsByShop(product.shop, product.shop === selectedShopName);
  openQtyModal(index);
}

// 🆕 ลำดับ+ไอคอนของหมวดร้านค้า อ้างอิงจากตัวเลือกจริงใน dropdown "shopCategory" ตอนร้านสมัคร
const CATEGORY_DISPLAY_ORDER = [
  { key: "อาหาร", icon: "🍗" },
  { key: "กาแฟ/เครื่องดื่ม", icon: "☕" },
  { key: "อาหารสด", icon: "🥬" },
  { key: "ของชำ", icon: "🛒" },
  { key: "ร้านยา", icon: "💊" },
  { key: "เบเกอรี่", icon: "🥐" },
  { key: "ผลไม้", icon: "🍑" },
  { key: "เสื้อผ้า", icon: "👗" },
  { key: "ของใช้ในบ้าน", icon: "🏠" },
  { key: "เครื่องสำอาง", icon: "💄" },
  { key: "อุปกรณ์ไอที", icon: "💻" },
  { key: "อุปกรณ์การเรียน", icon: "✏️" },
  { key: "อื่นๆ", icon: "🧩" }
];

/** 🆕 สร้าง tile ร้านค้า 1 อัน ใช้ร่วมกันทั้งแถว "เคยสั่ง" / กริดตามหมวด */
function buildShopTileHtml(shopName){
  const shopProducts = window.productsData.filter(function(p){
    return String(p.shop || "ไม่ระบุร้าน") === shopName;
  });

  const storeInfo = (window.storesData || []).find(function(s){ return s.name === shopName; });

  let shopImage = "";
  if(storeInfo && storeInfo.logo){
    shopImage = storeInfo.logo;
  } else {
    for(let i = 0; i < shopProducts.length; i++){
      if(shopProducts[i].image){ shopImage = shopProducts[i].image; break; }
    }
  }

  const isOpen = !storeInfo || storeInfo.isOpen !== false;
  const clickAction = isOpen
    ? "showProductsByShop('" + escapeHtml(shopName) + "')"
    : "alert('ร้านนี้ปิดให้บริการชั่วคราวครับ')";

  let html = '<div class="shop-tile' + (isOpen ? '' : ' shop-closed') + '" onclick="' + clickAction + '">';
  if(shopImage !== ""){
    html += '<img class="shop-tile-img" src="' + escapeHtml(shopImage) + '">';
  } else {
    html += '<div class="shop-tile-icon">🏪</div>';
  }
  html += '<span class="shop-tile-name">' + escapeHtml(shopName) + '</span>';
  if(!isOpen){ html += '<span class="shop-closed-badge">ปิดอยู่</span>'; }
  html += '</div>';
  return html;
}

/** 🆕 จัดกลุ่มรายชื่อร้าน (ที่มีสินค้าอยู่จริง) ตามหมวดจริงจากชีท เรียงตามลำดับมาตรฐาน */
function groupShopsByCategory(shops){
  const byCategory = {};
  shops.forEach(function(shop){
    const storeInfo = (window.storesData || []).find(function(s){ return s.name === shop; });
    let category = storeInfo && storeInfo.category ? String(storeInfo.category).trim() : "";
    if(category === ""){ category = "อื่นๆ"; }
    if(!byCategory[category]){ byCategory[category] = []; }
    byCategory[category].push(shop);
  });

  const ordered = [];
  CATEGORY_DISPLAY_ORDER.forEach(function(c){
    if(byCategory[c.key] && byCategory[c.key].length > 0){
      ordered.push({ key: c.key, icon: c.icon, shops: byCategory[c.key] });
      delete byCategory[c.key];
    }
  });
  // หมวดอื่นที่ไม่ตรงกับลิสต์มาตรฐาน (เผื่อแอดมินพิมพ์เพิ่มเอง) ต่อท้ายให้ด้วย
  Object.keys(byCategory).forEach(function(key){
    ordered.push({ key: key, icon: "🧩", shops: byCategory[key] });
  });

  return ordered;
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
      html += buildShopTileHtml(s.name);
    });
    html += '</div>';
  }

  const categoryGroups = groupShopsByCategory(shops);

  if(categoryGroups.length === 0){
    document.getElementById("productList").innerHTML = html || "ยังไม่มีร้านค้า";
    return;
  }

  // ---------- แถวปุ่มหมวด (กดแล้วเลื่อนไปหาหมวดนั้น) ----------
  html += '<div class="category-pill-row">';
  categoryGroups.forEach(function(cat, idx){
    html += '<a class="category-pill" onclick="document.getElementById(\'cat-sec-' + idx + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'});">'
      + '<span>' + cat.icon + '</span><span>' + escapeHtml(cat.key) + '</span></a>';
  });
  html += '</div>';

  // ---------- โซนตามหมวด — โชว์ร้านครบทุกร้าน กริด 4 ช่องพอดีหน้าจอ ไม่ต้องเลื่อน ----------
  categoryGroups.forEach(function(cat, idx){
    html += '<div id="cat-sec-' + idx + '" class="category-zone' + (idx % 2 === 1 ? ' category-zone-alt' : '') + '">';
    html += '<div class="category-section-head">';
    html += '<div class="category-section-icon">' + cat.icon + '</div>';
    html += '<div class="category-section-title"><h3>' + escapeHtml(cat.key) + '</h3><span>' + cat.shops.length + ' ร้าน</span></div>';
    html += '</div>';
    html += '<div class="shop-grid">';
    cat.shops.forEach(function(shop){ html += buildShopTileHtml(shop); });
    html += '</div></div>';
  });

  document.getElementById("productList").innerHTML = html;
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

/** 🆕 ร้านแนะนำวันนี้ — เรียงแนวนอน จำกัดโชว์ 3 ร้านตามแพ็กที่ขาย */
function renderHomeRecommendedGrid(){
  const box = document.getElementById("homeRecommendedGrid");
  if(!box) return;

  const recommendedShops = (window.storesData || [])
    .filter(function(s){ return s.isRecommended; })
    .slice(0, 3); // จำกัดแค่ 3 ร้านตามแพ็ก แม้แอดมินจะตั้งไว้เกินก็โชว์แค่ 3 แรก

  if(recommendedShops.length === 0){
    box.innerHTML = "<p style='text-align:center;color:#999;font-size:13px;'>ยังไม่มีร้านแนะนำวันนี้</p>";
    return;
  }

  let html = '<div class="recommended-row">';

  recommendedShops.forEach(function(s){
    const isOpen = s.isOpen !== false;
    const clickAction = isOpen
      ? "goToShopFromAd('" + escapeHtml(s.name) + "')"
      : "alert('ร้านนี้ปิดให้บริการชั่วคราวครับ')";

    html += '<div class="recommended-card" onclick="' + clickAction + '">';
    html += '<span class="recommended-badge">🏆 ร้านแนะนำ</span><br>';
    if(s.logo){
      html += '<img class="recommended-card-img" src="' + escapeHtml(s.logo) + '">';
    } else {
      html += '<div class="recommended-card-icon">🏪</div>';
    }
    html += '<span class="recommended-card-name">' + escapeHtml(s.name) + '</span>';
    html += '<span class="recommended-card-category">' + escapeHtml(s.category || "") + '</span>';
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

  const searchBoxEl = document.getElementById("searchBox"); // 🆕 เคลียร์ช่องค้นหาตอนเข้าดูร้านแบบปกติ
  if(searchBoxEl){ searchBoxEl.value = ""; }

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
    const inStock = product.inStock !== false; // 🆕 ค่าเริ่มต้น = มีสินค้า

    html += '<div class="product-card' + (inStock ? '' : ' out-of-stock') + '" onclick="' + (inStock ? "openQtyModal(" + index + ")" : "") + '">';
    if(image !== ""){
      html += '<img class="product-img" src="' + escapeHtml(image) + '">';
    }
    if(!inStock){ html += '<span class="out-of-stock-badge">หมดชั่วคราว</span>'; }
    html += '<h3>' + escapeHtml(name) + '</h3>';
    html += '<p class="product-desc">🍴 ' + escapeHtml(description) + '</p>';
    html += '<p><b>' + price + ' บาท</b></p>';
    if(inStock){
      html += '<button type="button" class="add-btn" data-index="' + index + '" onclick="event.stopPropagation(); openQtyModal(' + index + ')">';
      html += 'เพิ่มสินค้าลงตะกร้า';
      html += '</button>';
    } else {
      html += '<button type="button" disabled>สินค้าหมดชั่วคราว</button>';
    }
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
    let optionsLine = ""; // 🆕
    if(item.options){
      optionsLine = '<div class="cart-item-options">🍬 หวาน ' + escapeHtml(item.options.sweetness) +
        ' · 🧊 ' + escapeHtml(item.options.waterStyle) +
        ' · 💳 ' + escapeHtml(item.options.blueCard) + '</div>';
    }
    if(item.note){ // 🆕 โน้ตถึงร้าน
      optionsLine += '<div class="cart-item-options">📝 ' + escapeHtml(item.note) + '</div>';
    }
    html += `
      <div class="cart-item">
        <div class="cart-item-index">${index+1}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-meta">x${qty} · ${lineTotal.toLocaleString()} บาท</div>
          ${optionsLine}
        </div>
        <button class="cart-remove-btn" onclick="window.removeItem(${index})" title="ลบรายการนี้">🗑️</button>
      </div>
    `;
    total += lineTotal;
  });

  document.getElementById("cart").innerHTML =
    html || '<div class="cart-empty">ยังไม่มีสินค้าในตะกร้า</div>';

  const estDiscount = getEstimatedCouponDiscount(); // 🆕
  const discountRow = document.getElementById("sumDiscountRow");

  document.getElementById("sumProduct").innerText = total.toLocaleString() + " บาท";
  document.getElementById("sumDelivery").innerText = deliveryFee.toLocaleString() + " บาท";
  if(estDiscount > 0){
    document.getElementById("sumDiscount").innerText = "-" + estDiscount.toLocaleString() + " บาท";
    if(discountRow) discountRow.style.display = "flex";
  } else if(discountRow){
    discountRow.style.display = "none";
  }
  document.getElementById("sumTotal").innerText = (total + deliveryFee - estDiscount).toLocaleString() + " บาท";

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

// 🆕 ปักหมุดแบบทนทาน: ลองแม่นยำสูง → ลองซ้ำแบบประหยัด → ถ้าไม่ได้ เปิดแผนที่ให้ลูกค้าเลื่อนปักเอง
function getLocation(){
  const st = document.getElementById("locationStatus");
  if(!navigator.geolocation){ openOrderMapPicker_("อุปกรณ์นี้ไม่รองรับ GPS"); return; }
  if(st) st.innerHTML = "📡 กำลังค้นหาตำแหน่ง...";
  function ok(p){ applyLocation(p.coords.latitude, p.coords.longitude); }
  function fail(err){
    let why = "หาตำแหน่งไม่สำเร็จ";
    if(err && err.code === 1) why = "ยังไม่ได้อนุญาตตำแหน่ง (หรือปิด GPS ในมือถือ)";
    else if(err && err.code === 2) why = "สัญญาณ GPS อ่อน หาตำแหน่งไม่เจอ";
    else if(err && err.code === 3) why = "หาตำแหน่งนานเกินไป";
    openOrderMapPicker_(why);
  }
  navigator.geolocation.getCurrentPosition(ok, function(err){
    if(err && err.code === 1){ fail(err); return; }
    // ลองซ้ำแบบประหยัด (ใช้ Wi-Fi/เสา) เหมาะกับมือถือ GPS ช้า
    navigator.geolocation.getCurrentPosition(ok, fail,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

let orderPickMap_ = null;
let orderPickStart_ = null;
let orderPickMoved_ = false;
function openOrderMapPicker_(why){
  const st = document.getElementById("locationStatus");
  if(st) st.innerHTML = "ยังไม่ได้ปักหมุด";
  if(typeof L === "undefined"){
    alert(why + "\n\nกรุณาเปิดตำแหน่ง (GPS) ในมือถือ แล้วอนุญาตให้เบราว์เซอร์ใช้ตำแหน่ง จากนั้นกดปักหมุดใหม่");
    return;
  }
  let ov = document.getElementById("orderMapOverlay");
  if(!ov){
    ov = document.createElement("div");
    ov.id = "orderMapOverlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;";
    ov.innerHTML =
      '<div id="orderMapWhy" style="padding:10px 12px;background:#fff3cd;font-size:14px;"></div>' +
      '<div id="orderMapInfo" style="padding:6px 12px;font-size:14px;color:#555;">👆 เลื่อนแผนที่ให้ <b>หมุดตรงกลาง</b> อยู่ที่บ้าน/จุดรับของ แล้วกดยืนยัน</div>' +
      '<div style="position:relative;flex:1;"><div id="orderMapBox" style="position:absolute;inset:0;"></div>' +
      '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);font-size:34px;z-index:1000;pointer-events:none;">📍</div></div>' +
      '<div style="display:flex;gap:8px;padding:10px;">' +
      '<button id="orderMapCancel" style="flex:1;padding:12px;border:0;border-radius:10px;background:#ddd;">ยกเลิก</button>' +
      '<button id="orderMapOk" style="flex:2;padding:12px;border:0;border-radius:10px;background:#d6336c;color:#fff;font-weight:bold;">✅ ยืนยันตำแหน่งนี้</button></div>';
    document.body.appendChild(ov);
    document.getElementById("orderMapCancel").onclick = function(){ ov.style.display = "none"; };
    document.getElementById("orderMapOk").onclick = function(){
      if(!orderPickMoved_){ alert("กรุณาเลื่อนแผนที่ให้หมุด 📍 อยู่ตรงบ้าน/จุดรับของก่อน แล้วค่อยกดยืนยัน"); return; }
      const c = orderPickMap_.getCenter();
      ov.style.display = "none";
      applyLocation(c.lat, c.lng, "เลือกบนแผนที่");
    };
  }
  document.getElementById("orderMapWhy").textContent = "⚠️ " + why + " — เลือกตำแหน่งบนแผนที่แทนได้เลย";
  ov.style.display = "flex";
  const start = (lat && lng) ? [Number(lat), Number(lng)] : [shopLat, shopLng];
  orderPickStart_ = start;
  orderPickMoved_ = false;
  const okBtn = document.getElementById("orderMapOk");
  okBtn.style.opacity = "0.45";
  document.getElementById("orderMapInfo").innerHTML = "👆 เลื่อนแผนที่ให้ <b>หมุดตรงกลาง</b> อยู่ที่บ้าน/จุดรับของ แล้วกดยืนยัน";
  if(!orderPickMap_){
    orderPickMap_ = L.map("orderMapBox").setView(start, 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(orderPickMap_);
  } else {
    orderPickMap_.setView(start, 16);
  }
  if(!orderPickMap_._pdBound){
    orderPickMap_._pdBound = true;
    orderPickMap_.on("moveend", function(){
      const c = orderPickMap_.getCenter();
      const s0 = orderPickStart_;
      if(s0 && calculateDistance(s0[0], s0[1], c.lat, c.lng) > 0.02){
        orderPickMoved_ = true;
        document.getElementById("orderMapOk").style.opacity = "1";
      }
      if(orderPickMoved_){
        const d = calculateDistance(shopLat, shopLng, c.lat, c.lng);
        document.getElementById("orderMapInfo").innerHTML = "ระยะประมาณ <b>" + d.toFixed(2) + " กม.</b> · ค่าส่ง <b>" + getDeliveryFee(d) + " บาท</b>";
      }
    });
  }
  setTimeout(function(){ orderPickMap_.invalidateSize(); }, 150);
}

// ============================================================
// 🆕 QR ชำระเงิน PromptPay — สร้างในเครื่องลูกค้าเอง (ไม่พึ่ง promptpay.io ที่ล่ม/ช้าได้)
// ถ้าสร้างในเครื่องไม่สำเร็จ จะถอยไปใช้ promptpay.io เป็นตัวสำรอง
// ============================================================
function ppField_(id, val){ return id + ("0" + val.length).slice(-2) + val; }
function ppCrc16_(s){
  let crc = 0xFFFF;
  for(let i = 0; i < s.length; i++){
    crc ^= s.charCodeAt(i) << 8;
    for(let j = 0; j < 8; j++){ crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1); crc &= 0xFFFF; }
  }
  return ("0000" + crc.toString(16).toUpperCase()).slice(-4);
}
function buildPromptPayPayload(phone, amount){
  let digits = String(phone).replace(/\D/g, "");
  if(digits.length === 10 && digits.charAt(0) === "0"){ digits = "66" + digits.substring(1); }
  const target = ("0000000000000" + digits).slice(-13);
  const amt = Number(amount);
  const hasAmt = isFinite(amt) && amt > 0;
  const data = [
    ppField_("00", "01"),
    ppField_("01", hasAmt ? "12" : "11"),
    ppField_("29", ppField_("00", "A000000677010111") + ppField_("01", target)),
    ppField_("58", "TH"),
    ppField_("53", "764")
  ];
  if(hasAmt){ data.push(ppField_("54", amt.toFixed(2))); }
  const body = data.join("") + "6304";
  return body + ppCrc16_(body);
}

let qrLibPromise_ = null;
function loadQrLib_(){
  if(window.qrcode){ return Promise.resolve(); }
  if(!qrLibPromise_){
    qrLibPromise_ = new Promise(function(resolve, reject){
      const s = document.createElement("script");
      s.src = "qrcode.min.js";
      s.onload = resolve;
      s.onerror = function(){ qrLibPromise_ = null; reject(new Error("โหลดตัวสร้าง QR ไม่สำเร็จ")); };
      document.head.appendChild(s);
    });
  }
  return qrLibPromise_;
}


// ============================================================
// 🆕 ยืนยันออเดอร์ ผ่าน apiPost (แทน google.script.run)
// ============================================================
let isSubmittingOrder = false; // 🆕 กันลูกค้ากดปุ่มซ้ำรัวๆ ตอนรอ server ตอบ (เน็ตช้า) ทำให้ออเดอร์ซ้ำ

async function confirmOrder(){
  if(isSubmittingOrder){ return; } // 🆕 กำลังส่งอยู่แล้ว ไม่ต้องทำซ้ำแม้กดซ้ำมากี่ครั้งก็ตาม
  if(cart.length===0){ alert("ยังไม่มีสินค้า"); return; }

  let name = document.getElementById("customerName").value;
  let phone = document.getElementById("customerPhone").value;
  let address = document.getElementById("customerAddress").value.trim();

  if(name==""){ alert("กรุณากรอกชื่อ"); return; }
  if(phone==""){ alert("กรุณากรอกเบอร์"); return; }
  if(lat=="" || lng==""){ alert("กรุณาปักหมุดตำแหน่งก่อน"); return; }

  // 🆕 ล็อกปุ่มทันที — ปิดการกดซ้ำ + เปลี่ยนข้อความให้ลูกค้ารู้ว่ากำลังส่งอยู่ ไม่ต้องกดย้ำ
  isSubmittingOrder = true;
  loadQrLib_().catch(function(){}); // 🆕 โหลดตัวสร้าง QR ล่วงหน้าระหว่างรอส่งออเดอร์ จะได้ขึ้น QR ทันที
  const btn = document.getElementById("confirmOrderBtn");
  let originalBtnText = "✅ ยืนยันออเดอร์";
  if(btn){
    originalBtnText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ กำลังส่งออเดอร์...";
  }

  let itemsText = cart.map(function(item, index) {
    const qty = item.qty || 1;
    let line = (index + 1) + ". " + item.name + " x" + qty + " - " + (Number(item.price) * qty) + " บาท";
    if(item.options){ // 🆕 แนบตัวเลือกที่ลูกค้าเลือกไว้ ให้ร้านชงถูก
      line += "\n    🍬 หวาน " + item.options.sweetness + " | 🧊 " + item.options.waterStyle + " | 💳 Blue Card: " + item.options.blueCard;
    }
    if(item.note){ // 🆕 โน้ตจากลูกค้าถึงร้าน
      line += "\n    📝 โน้ต: " + item.note;
    }
    return line;
  }).join("\n");

  let productTotal = cart.reduce(function(sum, item){
    return sum + Number(item.price) * (item.qty || 1);
  }, 0);

  let totalAmount = productTotal + deliveryFee; // ⚠️ ยอดที่โชว์เบื้องต้นเท่านั้น ยอดจริงคำนวณ+ยืนยันจากเซิร์ฟเวอร์เสมอ

  try {
    const result = await apiPost('submitOrder', { data: {
      name: name, phone: phone, address: address,
      shopName: selectedShopName, shopPhone: selectedShopPhone,
      shopLat: selectedShopLat, shopLng: selectedShopLng,
      items: itemsText, productTotal: productTotal, delivery: deliveryFee,
      distance: distanceKm.toFixed(2), total: totalAmount, lat: lat, lng: lng,
      couponId: selectedCouponId || "" // 🆕 ส่งแค่ "รหัสคูปอง" เท่านั้น ส่วนลด/ยอดจริงคำนวณฝั่งเซิร์ฟเวอร์
    }});

    // 🆕 ใช้ยอดที่เซิร์ฟเวอร์คำนวณ+ยืนยันกลับมาจริงๆ เสมอ (กันไม่ให้แก้ค่าฝั่ง client แล้วได้ราคาผิด)
    const finalAmount = result.finalTotal != null ? result.finalTotal : totalAmount;
    if(result.discountAmount > 0){
      alert("ส่งออเดอร์เข้า Telegram แล้ว ✅\nใช้คูปองส่วนลดค่าส่งสำเร็จ! ลดไป " + result.discountAmount + " บาท 🎉");
    } else {
      alert("ส่งออเดอร์เข้า Telegram แล้ว ✅");
    }
    selectedCouponId = ""; // 🆕 เคลียร์คูปองที่เลือกไว้ (ถูกใช้ไปแล้ว)
    localStorage.removeItem("pd_currentShop");
    localStorage.removeItem("pd_cart");

    // 🆕 จดออเดอร์นี้เข้ารายการติดตาม (ก่อนเคลียร์ตะกร้า) — 1 ออเดอร์ = 1 การ์ด ลูกค้าสั่งต่อได้อีกหลายร้านโดยไม่หลุดการติดตามใบเดิม
    const itemsShort = cart.map(function(item){
      return item.name + " x" + (item.qty || 1);
    }).join("\n");
    myOrders.unshift({
      id: result.orderId, shop: selectedShopName, items: itemsShort,
      productTotal: productTotal, delivery: Math.max(0, Number(finalAmount) - Number(productTotal)), total: Number(finalAmount),
      phone: phone, lat: lat, lng: lng, createdAt: Date.now(),
      status: "รอชำระเงิน", riderName: "", riderPhone: "", done: false, proof: ""
    });
    delete orderExpanded_[result.orderId];
    saveMyOrders_();

    // เคลียร์ตะกร้า + หมุด (กันกดยืนยันซ้ำเป็นออเดอร์ใหม่) — แต่เก็บ "ชื่อ/เบอร์/ที่อยู่" ไว้ ลูกค้าจะสั่งร้านที่สองต่อได้ไม่ต้องพิมพ์ใหม่
    cart = [];
    lat = "";
    lng = "";
    deliveryFee = 0;
    distanceKm = 0;
    document.getElementById("locationStatus").innerHTML = "ยังไม่ได้ปักหมุด";
    window.renderCart();

    renderOrders_(true);
    switchTab("track");
    refreshOrders_();
    // 🆕 สำเร็จแล้ว ปลดล็อกปุ่มคืนด้วย เผื่อลูกค้ากดย้อนกลับมาที่แท็บ "ตะกร้าที่สั่ง" อีกรอบ
    // (เดิมปล่อยปุ่มค้างเป็น "⏳ กำลังส่งออเดอร์..." ตลอดไป ทำให้ดูเหมือนระบบค้าง/พัง ทั้งที่ออเดอร์ส่งสำเร็จแล้ว)
    isSubmittingOrder = false;
    if(btn){
      btn.disabled = false;
      btn.textContent = originalBtnText;
    }
  } catch(error){
    // 🆕 ส่งไม่สำเร็จ (เช่นเน็ตหลุด) ปลดล็อกปุ่มคืนให้กดส่งใหม่ได้
    isSubmittingOrder = false;
    if(btn){
      btn.disabled = false;
      btn.textContent = originalBtnText;
    }
    alert("ส่งออเดอร์ไม่สำเร็จ: " + error.message);
  }
}

// 🆕 ตัวแปรเก็บ instance แผนที่/หมุด ไว้ใช้ซ้ำ (ไม่สร้างแผนที่ใหม่ทุกครั้งที่ poll)





// ============================================================
// 🧾 ติดตามหลายออเดอร์พร้อมกัน — 1 ออเดอร์ = 1 การ์ด (สถานะ/ไรเดอร์/สลิป/แชท/แผนที่ แยกกัน)
// เก็บรายการออเดอร์ไว้ในเครื่องลูกค้า (localStorage "pd_orders") แล้วถามสถานะรวดเดียวจาก getOrdersStatus
// ============================================================
let myOrders = [];
const orderExpanded_ = {};   // id -> true/false (ลูกค้ากดกาง/ย่อเอง)
const orderMapOpen_ = {};    // id -> true ถ้าเปิดแผนที่ไว้
const orderMaps_ = {};       // id -> { map, rider, cust }
const uploadingSlip_ = {};   // id -> true ระหว่างส่งสลิป
let refreshingOrders_ = false;

function loadMyOrders_(){
  try {
    const arr = JSON.parse(localStorage.getItem("pd_orders") || "[]");
    myOrders = Array.isArray(arr) ? arr : [];
  } catch(e){ myOrders = []; }
  // รองรับลูกค้าที่มีออเดอร์เดียวค้างจากแอปเวอร์ชันเก่า
  const legacy = localStorage.getItem("pd_currentOrderId");
  if(legacy && !myOrders.some(function(o){ return o.id === legacy; })){
    myOrders.unshift({ id: legacy, shop: "", items: "", total: 0, productTotal: 0, delivery: 0,
      phone: localStorage.getItem("pd_currentOrderPhone") || "", lat: "", lng: "",
      createdAt: Date.now(), status: "กำลังตรวจสอบ", riderName: "", riderPhone: "", done: false, proof: "" });
  }
  localStorage.removeItem("pd_currentOrderId");
  localStorage.removeItem("pd_currentOrderPhone");
}

function saveMyOrders_(){
  // เก็บออเดอร์ที่ยังไม่จบทั้งหมด + ที่จบแล้วล่าสุดไม่เกิน 5 ใบ (และไม่เกิน 24 ชม.)
  const now = Date.now();
  const active = myOrders.filter(function(o){ return !o.done; });
  const done = myOrders.filter(function(o){ return o.done && (now - (o.doneAt || o.createdAt || now)) < 24*3600*1000; }).slice(0, 5);
  myOrders = active.concat(done).sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
  try { localStorage.setItem("pd_orders", JSON.stringify(myOrders)); } catch(e){}
}

function findMyOrder_(id){ return myOrders.find(function(o){ return o.id === id; }); }

/** จำนวนจุดที่เต็มในแถบความคืบหน้า (0-6) + ป้ายสถานะ */
function orderStage_(o){
  const s = String(o.status || "");
  if(o.done || s === "ส่งสำเร็จ") return { n: 6, cls: "g", text: "✅ ส่งสำเร็จ", unpaid: false, waitSlip: false };
  if(s === "กำลังส่ง") return { n: 5, cls: "b", text: "🏍️ กำลังส่ง", unpaid: false, waitSlip: false };
  if(s === "กำลังซื้อ") return { n: 4, cls: "b", text: "🛒 กำลังซื้อของ", unpaid: false, waitSlip: false };
  if(s.indexOf("ไรเดอร์รับงาน") === 0) return { n: 3, cls: "g", text: "🟢 ไรเดอร์รับงานแล้ว", unpaid: false, waitSlip: false };
  if(s.indexOf("ชำระเงินแล้ว") === 0) return { n: 1, cls: "b", text: "🔎 กำลังหาไรเดอร์", unpaid: false, waitSlip: false };
  if(s === "รอตรวจสอบสลิป") return { n: 0, cls: "o", text: "🟡 รอตรวจสลิป", unpaid: false, waitSlip: true };
  if(s.indexOf("สลิปไม่ผ่าน") === 0) return { n: 0, cls: "r", text: "🔴 สลิปไม่ผ่าน ส่งใหม่", unpaid: true, waitSlip: false };
  if(s === "รอชำระเงิน") return { n: 0, cls: "o", text: "🟠 รอชำระเงิน", unpaid: true, waitSlip: false };
  return { n: 0, cls: "o", text: "⏳ " + (s || "กำลังตรวจสอบ"), unpaid: false, waitSlip: false };
}

function orderIsExpanded_(o){
  if(orderExpanded_.hasOwnProperty(o.id)) return orderExpanded_[o.id];
  if(o.done) return false;
  const active = myOrders.filter(function(x){ return !x.done; });
  if(active.length <= 1) return true;
  return orderStage_(o).unpaid; // มีหลายใบ: ใบที่ยังต้องจ่ายเงินกางไว้ก่อน ใบอื่นย่อ
}

function toggleOrderCard(id){
  const o = findMyOrder_(id); if(!o) return;
  orderExpanded_[id] = !orderIsExpanded_(o);
  renderOrders_(true);
}

function orderStepsHtml_(n){
  const labs = ["ชำระเงิน","รอไรเดอร์","รับงาน","กำลังซื้อ","กำลังส่ง","สำเร็จ"];
  let h = '<div class="osteps">';
  for(let i = 0; i < 6; i++){
    h += '<span class="odot' + (i < n ? ' on' : '') + '"></span>';
    if(i < 5){ h += '<span class="oln' + (i < n - 1 ? ' on' : '') + '"></span>'; }
  }
  h += '</div><div class="ostl">' + labs.map(function(l){ return "<span>" + l + "</span>"; }).join("") + "</div>";
  return h;
}

function orderCardHtml_(o){
  const st = orderStage_(o);
  const expanded = orderIsExpanded_(o);
  const id = escapeHtml(o.id);
  const hasRider = !!o.riderName && !o.done;
  let h = '<div class="oc-head" onclick="toggleOrderCard(\'' + id + '\')">' +
    '<div><div class="oc-id">🧾 ' + id + '</div>' +
    (o.shop ? '<div class="oc-shop">🏪 ' + escapeHtml(o.shop) + '</div>' : '') + '</div>' +
    '<div class="oc-pill ' + st.cls + '">' + escapeHtml(st.text) + '</div></div>';

  if(!expanded){
    h += '<div class="oc-mini"><span>' + (hasRider ? '🛵 ' + escapeHtml(o.riderName) + ' · 📞 ' + escapeHtml(o.riderPhone) : escapeHtml(o.items || "")) +
      '</span><span class="oc-more">กาง ›</span></div>' + orderStepsHtml_(st.n);
    return h;
  }

  if(o.items){ h += '<div class="oc-items">' + escapeHtml(o.items).replace(/\n/g, "<br>") + '</div>'; }
  if(o.total){
    h += '<div class="oc-sum"><span>ค่าสินค้า ' + Number(o.productTotal || 0) + ' + ส่ง ' + Number(o.delivery || 0) + ' บาท</span>' +
      '<span>รวม <b>' + Number(o.total) + ' บาท</b></span></div>';
  }
  h += orderStepsHtml_(st.n);

  if(st.unpaid){
    h += '<div class="oc-pay">' +
      (st.cls === "r" ? '<div class="oc-warn">สลิปไม่ผ่าน กรุณาโอนให้ตรงยอดแล้วส่งสลิปใหม่</div>' : '') +
      '<div class="oc-qrrow"><img id="qr-' + id + '" class="oc-qr" alt="QR ชำระเงิน"><div>สแกน QR โอน <b>' + Number(o.total) + ' บาท</b><br>แล้วแนบสลิป <b>ของออเดอร์ ' + id + '</b></div></div>' +
      '<input type="file" id="slip-' + id + '" accept="image/*" onchange="onSlipPick_(\'' + id + '\')">' +
      '<button class="oc-btn" id="slipbtn-' + id + '" onclick="uploadSlipFor(\'' + id + '\')" disabled>📎 เลือกไฟล์สลิปก่อน แล้วกดส่งตรงนี้</button></div>';
  } else if(st.waitSlip){
    h += '<div class="oc-note">ส่งสลิปแล้ว รอแอดมินตรวจสอบสักครู่ครับ</div>';
  }

  if(hasRider){
    const tel = String(o.riderPhone).replace(/-/g, "");
    h += '<div class="oc-rider"><div class="oc-av">🛵</div><div><div class="oc-rn">' + escapeHtml(o.riderName) + '</div><div>📞 ' + escapeHtml(o.riderPhone) + '</div></div></div>' +
      '<div class="oc-btns"><a class="oc-btn" href="tel:' + escapeHtml(tel) + '">📞 โทร</a>' +
      '<button class="oc-btn t" onclick="openOrderChat(\'rider\',\'' + id + '\')">💬 แชท</button>' +
      '<button class="oc-btn w" onclick="toggleOrderMap(\'' + id + '\')">🗺️ แผนที่</button></div>' +
      '<div id="omapbox-' + id + '" style="display:' + (orderMapOpen_[o.id] ? 'block' : 'none') + ';margin-top:10px;">' +
      '<div id="omap-' + id + '" class="oc-map"></div><p id="omapt-' + id + '" class="oc-maptxt"></p></div>';
  } else if(!o.done && !st.unpaid && !st.waitSlip){
    h += '<div class="oc-note">ยังไม่มีไรเดอร์รับงาน</div>';
  }

  if(o.done){
    h += '<div class="oc-note ok">✅ ส่งสำเร็จแล้ว ขอบคุณที่ใช้บริการครับ</div>';
    if(o.proof){ h += '<img src="' + escapeHtml(o.proof) + '" class="oc-proof" alt="รูปยืนยันการส่งของ">'; }
  }

  h += '<div class="oc-btns" style="margin-top:12px;"><button class="oc-btn" onclick="openOrderChat(\'admin\',\'' + id + '\')">💬 แชทหาแอดมิน</button></div>';
  return h;
}

function fillOrderQr_(id, amount){
  const img = document.getElementById("qr-" + id);
  if(!img) return;
  const fallback = function(){ img.src = "https://promptpay.io/" + promptPayId + "/" + Number(amount).toFixed(2) + ".png"; };
  loadQrLib_().then(function(){
    const qr = window.qrcode(0, "M");
    qr.addData(buildPromptPayPayload(promptPayId, amount));
    qr.make();
    img.src = qr.createDataURL(8, 3);
  }).catch(fallback);
}

/** วาดรายการการ์ดทั้งหมด — แก้เฉพาะการ์ดที่ข้อมูลเปลี่ยนจริง (ไม่ล้างไฟล์สลิปที่เพิ่งเลือก) */
function renderOrders_(force){
  const list = document.getElementById("ordersList");
  const empty = document.getElementById("trackEmptyState");
  if(!list) return;
  if(myOrders.length === 0){
    list.innerHTML = "";
    if(empty){ empty.style.display = "block"; }
    return;
  }
  if(empty){ empty.style.display = "none"; }

  const active = myOrders.filter(function(o){ return !o.done; });
  let head = document.getElementById("ordersHead");
  if(!head){
    head = document.createElement("div");
    head.id = "ordersHead";
    list.parentNode.insertBefore(head, list);
  }
  head.innerHTML = '<div class="oc-top"><span>🛵 ติดตามออเดอร์</span>' +
    (active.length ? '<span class="oc-badge">' + active.length + ' ออเดอร์</span>' : '') + '</div>';

  const keep = {};
  let prevEl = null;
  myOrders.forEach(function(o){
    keep["oc-" + o.id] = true;
    const sig = [o.status, o.riderName, o.riderPhone, o.done ? 1 : 0, o.proof, o.total, orderIsExpanded_(o) ? 1 : 0].join("|");
    let el = document.getElementById("oc-" + o.id);
    if(!el){
      el = document.createElement("div");
      el.id = "oc-" + o.id;
      el.className = "oc-card";
    }
    // ใส่เข้าหน้าก่อน (ให้ getElementById หาเจอ) แล้วค่อยเติมเนื้อหา — ขยับเฉพาะเมื่อผิดตำแหน่ง (ไม่รบกวนการ์ดที่ไม่เปลี่ยน)
    const expectedNext = prevEl ? prevEl.nextSibling : list.firstChild;
    if(el !== expectedNext){ list.insertBefore(el, expectedNext); }
    prevEl = el;
    if(force || el.dataset.sig !== sig){
      el.dataset.sig = sig;
      el.innerHTML = orderCardHtml_(o);
      const st = orderStage_(o);
      if(orderIsExpanded_(o) && st.unpaid){ fillOrderQr_(o.id, o.total); }
      if(orderMapOpen_[o.id] && orderIsExpanded_(o) && o.riderName && !o.done){ openOrderMap_(o.id); }
    }
  });
  Array.prototype.slice.call(list.children).forEach(function(el){
    if(!keep[el.id]){
      const oid = el.id.replace(/^oc-/, "");
      if(orderMaps_[oid]){ try { orderMaps_[oid].map.remove(); } catch(e){} delete orderMaps_[oid]; }
      list.removeChild(el);
    }
  });

  let foot = document.getElementById("ordersFoot");
  if(!foot){
    foot = document.createElement("div");
    foot.id = "ordersFoot";
    list.parentNode.appendChild(foot);
  }
  foot.innerHTML = '<div class="oc-add" onclick="startAnotherOrder()">➕ สั่งเพิ่มจากอีกร้าน</div>';
}

function startAnotherOrder(){
  switchTab("order");
  if(typeof showStoreHome === "function"){ try { showStoreHome(); } catch(e){} }
}

/** ถามสถานะทุกออเดอร์ที่ยังไม่จบ ในคำขอเดียว */
async function refreshOrders_(){
  if(refreshingOrders_) return;
  const ids = myOrders.filter(function(o){ return !o.done; }).map(function(o){ return o.id; });
  if(ids.length === 0) return;
  refreshingOrders_ = true;
  try {
    const rows = await apiGet('getOrdersStatus', { ids: ids.join(",") });
    if(Array.isArray(rows)){
      rows.forEach(function(r){
        if(!r) return;
        const o = findMyOrder_(r.orderId);
        if(!o) return;
        o.status = r.status || o.status;
        o.riderName = r.riderName || "";
        o.riderPhone = r.riderPhone || "";
        if(r.proofImageUrl){ o.proof = r.proofImageUrl; }
        if(r.status === "ส่งสำเร็จ" && !o.done){ o.done = true; o.doneAt = Date.now(); }
      });
      saveMyOrders_();
    }
    renderOrders_(false);
    myOrders.forEach(function(o){
      if(orderMapOpen_[o.id] && o.riderName && !o.done){ updateOrderMap_(o.id, o.riderPhone); }
    });
  } catch(e){ /* เงียบไว้ ไม่เด้งเตือนทุก 5 วินาทีตอนเน็ตสะดุด */ }
  refreshingOrders_ = false;
}
function checkOrderStatus(){ return refreshOrders_(); }

setInterval(function(){
  if(myOrders.some(function(o){ return !o.done; })){ refreshOrders_(); }
}, 5000);

// ---------- แผนที่ไรเดอร์ แยกต่อออเดอร์ ----------
function toggleOrderMap(id){
  orderMapOpen_[id] = !orderMapOpen_[id];
  const box = document.getElementById("omapbox-" + id);
  if(box){ box.style.display = orderMapOpen_[id] ? "block" : "none"; }
  if(orderMapOpen_[id]){ openOrderMap_(id); }
}

function openOrderMap_(id){
  const o = findMyOrder_(id);
  const box = document.getElementById("omapbox-" + id);
  if(!o || !box) return;
  box.style.display = "block";
  if(typeof L === "undefined"){
    document.getElementById("omapt-" + id).textContent = "โหลดแผนที่ไม่สำเร็จ";
    return;
  }
  if(!orderMaps_[id] || orderMaps_[id].el !== document.getElementById("omap-" + id)){
    if(orderMaps_[id]){ try { orderMaps_[id].map.remove(); } catch(e){} }
    const el = document.getElementById("omap-" + id);
    const map = L.map(el);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    orderMaps_[id] = { map: map, el: el, rider: null, cust: null };
    map.setView([shopLat, shopLng], 14);
  }
  setTimeout(function(){ if(orderMaps_[id]){ orderMaps_[id].map.invalidateSize(); } }, 200);
  updateOrderMap_(id, o.riderPhone);
}

async function updateOrderMap_(id, riderPhone){
  const m = orderMaps_[id];
  const o = findMyOrder_(id);
  if(!m || !o) return;
  const txt = document.getElementById("omapt-" + id);
  try {
    const loc = await apiGet('getRiderLocation', { phone: riderPhone });
    if(!loc || !loc.success){
      if(txt){ txt.textContent = "ไรเดอร์ยังไม่ได้เปิดแชร์ตำแหน่ง หรือยังไม่มีพิกัดล่าสุด"; }
      return;
    }
    const rl = [loc.lat, loc.lng];
    if(!m.rider){
      m.rider = L.marker(rl, { icon: L.divIcon({ html: "🛵", className: "rider-map-icon", iconSize: [32,32] }) }).addTo(m.map).bindPopup("ไรเดอร์");
    } else { m.rider.setLatLng(rl); }
    if(o.lat && o.lng){
      const cl = [Number(o.lat), Number(o.lng)];
      if(!m.cust){
        m.cust = L.marker(cl, { icon: L.divIcon({ html: "🏠", className: "rider-map-icon", iconSize: [32,32] }) }).addTo(m.map).bindPopup("ที่อยู่คุณ");
      }
      m.map.fitBounds([rl, cl], { padding: [30,30] });
    } else { m.map.setView(rl, 15); }
    if(txt && loc.updatedAt){ txt.textContent = "อัปเดตล่าสุด " + new Date(loc.updatedAt).toLocaleTimeString("th-TH"); }
  } catch(e){
    if(txt){ txt.textContent = "โหลดตำแหน่งไรเดอร์ไม่สำเร็จ"; }
  }
}

// ---------- ส่งสลิป แยกต่อออเดอร์ ----------
function onSlipPick_(id){
  const inp = document.getElementById("slip-" + id);
  const btn = document.getElementById("slipbtn-" + id);
  if(!inp || !btn) return;
  const has = !!(inp.files && inp.files[0]);
  btn.disabled = !has;
  btn.textContent = has ? "📤 ส่งสลิป " + id : "📎 เลือกไฟล์สลิปก่อน แล้วกดส่งตรงนี้";
}

function uploadSlipFor(id){
  if(uploadingSlip_[id]) return;
  const inp = document.getElementById("slip-" + id);
  const btn = document.getElementById("slipbtn-" + id);
  const file = inp && inp.files && inp.files[0];
  if(!file){ alert("กรุณาเลือกสลิปก่อน"); return; }

  uploadingSlip_[id] = true;
  if(btn){ btn.disabled = true; btn.textContent = "⏳ กำลังส่งสลิป..."; }

  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = async function(){
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 800 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
      try {
        await apiPost('uploadSlipToTelegram', { orderId: id, fileName: file.name, base64: base64 });
        alert("ส่งสลิปเรียบร้อย ✅ (ออเดอร์ " + id + ")");
        const o = findMyOrder_(id);
        if(o){ o.status = "รอตรวจสอบสลิป"; saveMyOrders_(); }
        uploadingSlip_[id] = false;
        renderOrders_(true);
      } catch(error){
        uploadingSlip_[id] = false;
        if(btn){ btn.disabled = false; btn.textContent = "📤 ส่งสลิป " + id; }
        alert("ส่งสลิปไม่สำเร็จ: " + error.message + "\n\nลองเช็คสัญญาณเน็ตแล้วกดส่งใหม่อีกครั้งได้เลยครับ (ยังไม่ถูกส่งซ้ำ ไม่ต้องกังวล)");
      }
    };
    img.onerror = function(){ uploadingSlip_[id] = false; if(btn){ btn.disabled = false; } alert("เปิดไฟล์รูปไม่ได้ กรุณาเลือกรูปสลิปใหม่"); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// 💬 แชทสด: เปิดห้องแชทของ "ออเดอร์ที่เลือก" (channel = 'admin' | 'rider')
function openOrderChat(channel, orderId){
  const o = findMyOrder_(orderId);
  if(!o){ alert("ยังไม่มีออเดอร์ให้แชท"); return; }
  ChatUI.open({
    role: "customer",
    orderId: o.id,
    channel: channel,
    phone: o.phone || "",
    title: channel === "admin" ? "💬 แชทกับแอดมิน " + o.id : "💬 แชทกับไรเดอร์ " + o.id
  });
}

/** เปิดแอปครั้งใหม่ → กู้รายการออเดอร์ที่ยังติดตามอยู่ */
function restoreTrackedOrder(){
  loadMyOrders_();
  saveMyOrders_();
  renderOrders_(true);
  refreshOrders_();
}

function copyPhone(phone){
  navigator.clipboard.writeText(phone).then(function(){
    alert("คัดลอกเบอร์แล้ว: " + phone);
  }).catch(function(){
    alert("เบอร์ไรเดอร์: " + phone);
  });
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

      <label style="display:block;font-size:14px;font-weight:bold;margin-top:6px;">โลโก้ร้าน (ไม่บังคับ ใส่ทีหลังก็ได้)</label>
      <input type="file" id="shopLogoFile" accept="image/*">

      <select id="shopCategory">
        <option value="">-- เลือกหมวดร้าน --</option>
        <option value="อาหาร">อาหาร</option>
        <option value="กาแฟ/เครื่องดื่ม">กาแฟ/เครื่องดื่ม</option>
        <option value="ของชำ">ของชำ</option>
        <option value="ร้านยา">ร้านยา</option>
        <option value="เบเกอรี่">เบเกอรี่</option>
        <option value="ผลไม้">ผลไม้</option>
        <option value="อุปกรณ์ไอที">อุปกรณ์ไอที</option>
        <option value="อาหารสด">อาหารสด</option>
        <option value="เสื้อผ้า">เสื้อผ้า</option>
        <option value="ของใช้ในบ้าน">ของใช้ในบ้าน</option>
        <option value="เครื่องสำอาง">เครื่องสำอาง</option>
        <option value="อุปกรณ์การเรียน">อุปกรณ์การเรียน</option>
        <option value="อื่นๆ">อื่นๆ</option>
      </select>

      <br><br>

      <button onclick="getShopLocation()">ปักหมุดร้าน</button>
      <p id="shopLocationText">ยังไม่ได้ปักหมุดร้าน</p>

      <button id="submitShopRegisterBtn" class="form-full" onclick="submitShopRegister()">ส่งใบสมัครร้านค้า</button>
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
        <option value="อาหารสด">อาหารสด</option>
        <option value="ไข่ไก่">ไข่ไก่</option>
        <option value="อุปกรณ์ไอที">อุปกรณ์ไอที</option>
        <option value="เครื่องสำอาง">เครื่องสำอาง</option>
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

        const sp = await apiPost('submitProduct', {
          data: { shop: shop, category: category, name: name, price: price, image: image, description: description }
        });

        if(sp && sp.imageOk === false){
          alert("บันทึกเมนูแล้ว ⚠️ แต่รูปอัปโหลดไม่สำเร็จ\nกรุณาเข้า 'จัดการร้านค้า' กด ✏️ แก้ไข แล้วอัปรูปใหม่อีกครั้ง");
        } else {
          alert("ส่งเมนูแล้ว ✅ รอแอดมินอนุมัติ");
        }
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
        '<option value="อาหารสด">อาหารสด</option>' +
        '<option value="ไข่ไก่">ไข่ไก่</option>' +
        '<option value="อุปกรณ์ไอที">อุปกรณ์ไอที</option>' +
        '<option value="เครื่องสำอาง">เครื่องสำอาง</option>' +
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

let isSubmittingShopRegister = false; // 🆕 กันกดปุ่ม "ส่งใบสมัครร้านค้า" ซ้ำรัวๆ ตอนรอ server ตอบ (เน็ตช้า/รอบีบอัดโลโก้)

async function submitShopRegister(){
  if(isSubmittingShopRegister){ return; } // 🆕 กำลังส่งอยู่แล้ว ไม่ต้องทำซ้ำแม้กดซ้ำมากี่ครั้งก็ตาม

  const name = document.getElementById("shopName").value;
  const phone = document.getElementById("shopPhone").value;
  const storeAddress = document.getElementById("storeAddress").value.trim();
  const category = document.getElementById("shopCategory").value;
  const logoFile = document.getElementById("shopLogoFile") ? document.getElementById("shopLogoFile").files[0] : null;

  if(name === ""){ alert("กรุณากรอกชื่อร้าน"); return; }
  if(phone === ""){ alert("กรุณากรอกเบอร์ร้าน"); return; }
  if (!name || !phone || !storeAddress || !category) { alert("กรุณากรอกข้อมูลร้านค้าให้ครบ"); return; }
  if(category === ""){ alert("กรุณากรอกหมวดร้าน"); return; }
  if(registerShopLat === "" || registerShopLng === ""){ alert("กรุณาปักหมุดร้านก่อน"); return; }

  // 🆕 ล็อกปุ่มทันที — ปิดการกดซ้ำ + เปลี่ยนข้อความให้รู้ว่ากำลังส่งอยู่ (ครอบคลุมช่วงบีบอัดโลโก้ด้วย ไม่ใช่แค่ตอนยิง API)
  isSubmittingShopRegister = true;
  const shopRegisterBtn = document.getElementById("submitShopRegisterBtn");
  let originalShopRegisterBtnText = "ส่งใบสมัครร้านค้า";
  if(shopRegisterBtn){
    originalShopRegisterBtnText = shopRegisterBtn.textContent;
    shopRegisterBtn.disabled = true;
    shopRegisterBtn.textContent = "⏳ กำลังส่งใบสมัคร...";
  }

  // 🆕 ฟังก์ชันย่อยสำหรับยิงข้อมูลไปหลังบ้าน (แยกไว้เผื่อต้องรอบีบอัดโลโก้ก่อน)
  async function doRegister(logoBase64){
    try {
      const result = await apiPost('registerStore', { data: {
        name: name, phone: phone, category: category, storeAddress: storeAddress,
        lat: registerShopLat, lng: registerShopLng,
        logo: logoBase64 || ""   // 🆕 ส่งโลโก้ (ถ้ามี) ไปพร้อมกันเลย
      }});
      alert(
        "ส่งใบสมัครร้านค้าแล้ว ✅\n\n" +
        "รหัสร้าน: " + result.storeId + "\n" +
        "PIN: " + result.pin + "\n\n" +
        "กรุณาเก็บไว้ใช้เพิ่มสินค้า\nและรอแอดมินอนุมัติ"
      );
      // 🆕 สมัครสำเร็จแล้ว ไม่ต้องปลดล็อกปุ่มคืน เพราะหน้าจะเปลี่ยนไปหน้าอื่นอยู่แล้ว (showCustomerHome ด้านล่าง)
      showCustomerHome();
    } catch(error){
      // 🆕 ส่งไม่สำเร็จ (เช่นเน็ตหลุด) ปลดล็อกปุ่มคืนให้กดส่งใหม่ได้
      isSubmittingShopRegister = false;
      if(shopRegisterBtn){
        shopRegisterBtn.disabled = false;
        shopRegisterBtn.textContent = originalShopRegisterBtnText;
      }
      alert("สมัครร้านไม่สำเร็จ: " + error.message);
    }
  }

  // 🆕 ถ้าเลือกไฟล์โลโก้มา ให้บีบอัดก่อนแล้วค่อยส่ง ไม่งั้นส่งแบบไม่มีโลโก้ไปเลย
  if(logoFile){
    const reader = new FileReader();
    reader.onload = function(e){
      const img = new Image();
      img.onload = function(){
        const canvas = document.createElement("canvas");
        const maxWidth = 400;
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        doRegister(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(logoFile);
  } else {
    doRegister("");
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
  restoreTrackedOrder(); // 🆕 กันรีเฟรชแล้วหลุดการติดตามออเดอร์ที่สั่งไปแล้ว

  // 🆕 กดปุ่ม "ใช้คูปองนี้" มาจากหน้าสมาชิก (member.html) — พาลูกค้าไปเลือกร้าน/สั่งของทันที
  // (คูปองผูกกับ "ค่าส่ง" ไม่ใช่ร้านใดร้านหนึ่ง เลยยังต้องเลือกร้านเองอยู่ดี แต่ข้ามหน้าแรกไปเลย)
  if(localStorage.getItem("pd_selectedCouponId")){
    switchTab("order");
    setTimeout(function(){
      alert("🎟️ เลือกคูปองไว้แล้ว! เลือกร้าน สั่งของ แล้วส่วนลดค่าส่งจะเข้าอัตโนมัติตอนไปที่ตะกร้า");
    }, 300);
  }
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
    // 🆕 โชว์โฆษณาชุดเดียวกัน ทั้งหน้าแรก และด้านบนหน้า "สั่งของ" (ยิง API แค่ครั้งเดียว ไม่เพิ่มโหลด)
    renderAdSlider(ads || [], "adTrack");
    renderAdSlider(ads || [], "adTrackOrder");
  } catch(error){
    renderAdSlider([], "adTrack");
    renderAdSlider([], "adTrackOrder");
  }
}

function adClickHandler(linkShopName){
  if(linkShopName === "__แฟลช__"){ goToFlashPage(); return; }
  if(linkShopName === "__ลงโฆษณา__"){ goToAdsPage(); return; }
  if(linkShopName){ goToShopFromAd(linkShopName); }
}

function renderAdSlider(ads, trackId){
  const track = document.getElementById(trackId || "adTrack");
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





/** 📊 โชว์ "วันนี้มีคนเปิดใช้งานแล้ว X ครั้ง" บนหน้าแรก — เซิร์ฟเวอร์ส่งตัวเลขมาเฉพาะเมื่อเกิน 20 */
async function showVisitBadge(){
  try {
    const data = await apiGet('getVisitStats', {});
    const el = document.getElementById("visitBadge");
    if(el && data && data.today){
      el.textContent = "🔥 วันนี้มีคนเปิดใช้งานแล้ว " + Number(data.today).toLocaleString("th-TH") + " ครั้ง";
      el.style.display = "block";
    }
  } catch(e){ /* ไม่โชว์ถ้าโหลดไม่ได้ ไม่กระทบแอป */ }
}
// เลื่อนไปโหลดทีหลัง ให้ร้าน/สินค้าขึ้นก่อน
setTimeout(showVisitBadge, 5000);
