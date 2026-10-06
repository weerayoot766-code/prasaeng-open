/**
 * chat.js — แชทสด (polling) ใช้ร่วมกันทุกหน้า
 * ใช้: ChatUI.open({ role:'customer'|'rider'|'admin', orderId, channel:'admin'|'rider', phone, pin, title })
 * ต้องโหลด api.js ก่อนไฟล์นี้
 */
(function(){
  var POLL_MS = 4000;
  var timer = null, since = 0, cur = null, sending = false, seen = {};

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function timeStr(ts){
    var d = new Date(Number(ts));
    if(isNaN(d.getTime())) return "";
    return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);
  }

  function injectStyle(){
    if(document.getElementById("chatuiStyle")) return;
    var st = document.createElement("style");
    st.id = "chatuiStyle";
    st.textContent =
      "#chatuiOverlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:flex-end;justify-content:center;font-family:inherit}"+
      "#chatuiBox{background:#fff;width:100%;max-width:520px;height:88vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}"+
      "#chatuiHead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#ff2d87;color:#fff;font-weight:800;font-size:16px}"+
      "#chatuiHead small{display:block;font-weight:400;font-size:12px;opacity:.9}"+
      "#chatuiClose{background:rgba(255,255,255,.25);border:none;color:#fff;border-radius:50%;width:32px!important;height:32px;min-width:32px;padding:0!important;margin:0!important;font-size:18px;cursor:pointer;flex:0 0 32px}"+
      "#chatuiMsgs{flex:1;overflow-y:auto;padding:12px;background:#f6f6f8;display:flex;flex-direction:column;gap:8px}"+
      ".chatuiRow{display:flex;flex-direction:column;max-width:80%}"+
      ".chatuiRow.me{align-self:flex-end;align-items:flex-end}"+
      ".chatuiRow.other{align-self:flex-start;align-items:flex-start}"+
      ".chatuiBubble{padding:8px 12px;border-radius:14px;font-size:15px;line-height:1.4;white-space:pre-wrap;word-break:break-word}"+
      ".chatuiRow.me .chatuiBubble{background:#ff2d87;color:#fff;border-bottom-right-radius:4px}"+
      ".chatuiRow.other .chatuiBubble{background:#fff;color:#222;border:1px solid #e3e3e8;border-bottom-left-radius:4px}"+
      ".chatuiMeta{font-size:11px;color:#999;margin-top:2px}"+
      "#chatuiEmpty{text-align:center;color:#999;font-size:14px;margin:auto}"+
      "#chatuiForm{display:flex;align-items:flex-end;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff;box-sizing:border-box;width:100%}"+
      "#chatuiInput{flex:1 1 auto;width:auto!important;min-width:0;box-sizing:border-box;margin:0!important;border:1px solid #ddd;border-radius:20px;padding:10px 14px;font-size:16px;resize:none;max-height:90px;font-family:inherit;background:#fff;color:#222}"+
      "#chatuiSend{flex:0 0 auto;width:auto!important;min-width:64px;margin:0!important;border:none;background:#ff2d87;color:#fff;border-radius:20px;padding:10px 18px!important;font-weight:800;font-size:15px;cursor:pointer}"+
      "#chatuiSend:disabled{opacity:.5}"+
      "#chatuiErr{color:#d00;font-size:12px;padding:4px 12px;background:#fff;display:none}";
    document.head.appendChild(st);
  }

  function senderLabel(s){
    return s === "admin" ? "แอดมิน" : s === "rider" ? "ไรเดอร์" : "ลูกค้า";
  }

  function params(extra){
    var p = { role: cur.role, orderId: cur.orderId, channel: cur.channel };
    if(cur.phone) p.phone = cur.phone;
    if(cur.pin) p.pin = cur.pin;
    for(var k in extra) p[k] = extra[k];
    return p;
  }

  function showErr(msg){
    var e = document.getElementById("chatuiErr");
    if(!e) return;
    e.textContent = msg || "";
    e.style.display = msg ? "block" : "none";
  }

  function addMessages(list){
    var box = document.getElementById("chatuiMsgs");
    if(!box || !list || !list.length) return;
    var empty = document.getElementById("chatuiEmpty");
    if(empty) empty.remove();
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    list.forEach(function(m){
      if(seen[m.id]) return;
      seen[m.id] = true;
      if(Number(m.ts) > since) since = Number(m.ts);
      var me = m.sender === cur.role;
      var row = document.createElement("div");
      row.className = "chatuiRow " + (me ? "me" : "other");
      row.innerHTML = '<div class="chatuiBubble">' + esc(m.text) + '</div>' +
        '<div class="chatuiMeta">' + (me ? "" : senderLabel(m.sender) + " · ") + timeStr(m.ts) + '</div>';
      box.appendChild(row);
    });
    if(nearBottom || Object.keys(seen).length <= list.length) box.scrollTop = box.scrollHeight;
  }

  async function poll(){
    if(!cur) return;
    try{
      var data = await apiGet("chatGet", params({ since: since }));
      showErr("");
      addMessages(data.messages);
    }catch(err){
      showErr("โหลดข้อความไม่สำเร็จ: " + (err && err.message ? err.message : err));
    }
  }

  function close(){
    if(timer){ clearInterval(timer); timer = null; }
    var o = document.getElementById("chatuiOverlay");
    if(o) o.remove();
    cur = null; since = 0; seen = {}; sending = false;
    if(typeof window.onChatClosed === "function") window.onChatClosed();
  }

  async function send(){
    if(sending || !cur) return;
    var input = document.getElementById("chatuiInput");
    var btn = document.getElementById("chatuiSend");
    var text = input.value.trim();
    if(!text) return;
    sending = true; btn.disabled = true; btn.textContent = "...";
    try{
      await apiPost("chatSend", params({ text: text }));
      input.value = "";
      showErr("");
      await poll();
    }catch(err){
      showErr("ส่งไม่สำเร็จ: " + (err && err.message ? err.message : err));
    }finally{
      sending = false; btn.disabled = false; btn.textContent = "ส่ง";
      input.focus();
    }
  }

  function open(opts){
    if(!opts || !opts.orderId){ alert("ยังไม่มีออเดอร์ให้แชท"); return; }
    if(opts.role === "customer" && !opts.phone){
      var ph = prompt("กรอกเบอร์โทรที่ใช้สั่งออเดอร์นี้ เพื่อยืนยันตัวตน");
      if(!ph) return;
      opts.phone = ph.trim();
      try{ localStorage.setItem("pd_currentOrderPhone", opts.phone); }catch(e){}
    }
    close();
    injectStyle();
    cur = { role: opts.role, orderId: opts.orderId, channel: opts.channel, phone: opts.phone || "", pin: opts.pin || "" };
    since = 0; seen = {};
    var overlay = document.createElement("div");
    overlay.id = "chatuiOverlay";
    overlay.innerHTML =
      '<div id="chatuiBox">' +
        '<div id="chatuiHead"><div>' + esc(opts.title || "แชท") + '<small>ออเดอร์ ' + esc(opts.orderId) + '</small></div>' +
        '<button id="chatuiClose" aria-label="ปิด">✕</button></div>' +
        '<div id="chatuiMsgs"><div id="chatuiEmpty">ยังไม่มีข้อความ — พิมพ์ทักได้เลย 👋</div></div>' +
        '<div id="chatuiErr"></div>' +
        '<div id="chatuiForm"><textarea id="chatuiInput" rows="1" maxlength="500" placeholder="พิมพ์ข้อความ..."></textarea>' +
        '<button id="chatuiSend">ส่ง</button></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("chatuiClose").onclick = close;
    document.getElementById("chatuiSend").onclick = send;
    document.getElementById("chatuiInput").addEventListener("keydown", function(e){
      if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); }
    });
    poll();
    timer = setInterval(function(){ if(!document.hidden) poll(); }, POLL_MS);
  }

  window.ChatUI = { open: open, close: close };
})();
