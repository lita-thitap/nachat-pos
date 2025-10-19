/* =========================
   Nachat – POS (offline-first)
   ========================= */

/* ---------- CONFIG ---------- */
// ข้อความ/เลขพร้อมเพย์ที่ใช้ทำ QR สแกนจ่าย (แก้ตามจริง)
const POS_QR_TEXT = "พร้อมเพย์ 08x-xxx-xxxx | Nachat BBQ";

// ตัวอย่างเมนูเริ่มต้น
const DEFAULT_MENU = [
  { id:"SET1",  name:"ชุดรวมหมูชุด A",  price:299, cat:"SET" },
  { id:"SET2",  name:"ชุดหมูยกทะเล",   price:299, cat:"SET" },
  { id:"AD01",  name:"สันคอหมูสไลซ์ (ถาด)", price:50,  cat:"AD"  },
  { id:"AD02",  name:"เบคอนรมควัน (ถาด)",  price:50,  cat:"AD"  },
  { id:"DW01",  name:"น้ำเปล่า (ขวด)",   price:15,  cat:"DW"  },
  { id:"DW02",  name:"น้ำแข็งถัง",      price:30,  cat:"DW"  },
  { id:"PR03",  name:"เบียร์ซิกส์ (ขวด)", price:110, cat:"PR"  },
  { id:"PR06",  name:"โปรเบียร์ทั้ง 6 ขวด", price:410, cat:"PR" },
];

/* ---------- Storage keys ---------- */
const KEY_MENU   = "pos_menu_v1";
const KEY_CART   = "pos_cart_v1";
const KEY_BILLS  = "pos_bills_v1";
const KEY_SALES  = "pos_sales_v1";
const KEY_VOIDS  = "pos_voids_v1"; // บิลที่ยกเลิก

/* ---------- Helpers ---------- */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => (Number(n)||0).toLocaleString('th-TH');

/* ---------- State ---------- */
let PAY_BILL = null;  // เก็บบิลที่กำลังปิดใน modal

/* ---------- Menu & Storage ---------- */
function ensureMenu(){
  if(!localStorage.getItem(KEY_MENU)){
    localStorage.setItem(KEY_MENU, JSON.stringify(DEFAULT_MENU));
  }
}
const getMenu   = ()=> JSON.parse(localStorage.getItem(KEY_MENU)||"[]");
const setMenu   = m  => localStorage.setItem(KEY_MENU, JSON.stringify(m||[]));

const getCart   = ()=> JSON.parse(localStorage.getItem(KEY_CART)||"[]");
const setCart   = a  => { localStorage.setItem(KEY_CART, JSON.stringify(a||[])); renderCart(); };

const getBills  = ()=> JSON.parse(localStorage.getItem(KEY_BILLS)||"[]");
const setBills  = a  => { localStorage.setItem(KEY_BILLS, JSON.stringify(a||[])); renderOpenBills(); };

const getSales  = ()=> JSON.parse(localStorage.getItem(KEY_SALES)||"[]");
const setSales  = a  => localStorage.setItem(KEY_SALES, JSON.stringify(a||[]));

const getVoids  = ()=> JSON.parse(localStorage.getItem(KEY_VOIDS)||"[]");
const setVoids  = a  => localStorage.setItem(KEY_VOIDS, JSON.stringify(a||[]));

const sumCart = cart => cart.reduce((s,i)=>s + i.price*i.qty, 0);

/* ---------- Render: Menu ---------- */
function renderMenu(){
  const byCat = {};
  getMenu().forEach(m => (byCat[m.cat] ??= []).push(m));

  const box = $("#menuPanels");
  box.innerHTML = Object.keys(byCat).map(cat=>{
    const items = byCat[cat].map(i=>(
      `<button class="menu-btn" data-id="${i.id}">
        <span class="name">${i.name}</span>
        <span class="price">฿${fmt(i.price)}</span>
      </button>`
    )).join("");
    const title = ({SET:"ชุดหมูกระทะ", AD:"Add-on", DW:"เครื่องดื่ม", PR:"โปรเครื่องดื่ม"})[cat] || cat;
    return `<div class="card"><h3>${title}</h3>${items}</div>`;
  }).join("");

  // add to cart
  $$("#menuPanels .menu-btn").forEach(btn=>{
    btn.addEventListener('click',()=>{
      const m = getMenu().find(x=>x.id===btn.dataset.id);
      if(!m) return;
      const cart = getCart();
      const exist = cart.find(x=>x.id===m.id);
      if(exist) exist.qty += 1;
      else cart.push({ id:m.id, name:m.name, price:m.price, qty:1 });
      setCart(cart);
    });
  });
}

/* ---------- Render: Cart ---------- */
function renderCart(){
  const cart = getCart();
  const list = $("#cartList");
  if(cart.length===0){
    list.textContent = "ยังไม่มีรายการ";
  }else{
    list.innerHTML = cart.map(i=>(
      `<div class="row" style="justify-content:space-between">
        <div>${i.name} <span class="hint">× ${i.qty}</span></div>
        <div>฿${fmt(i.qty*i.price)}</div>
      </div>`
    )).join("");
  }
  $("#cartTotal").textContent = fmt(sumCart(cart));
}

/* ---------- Render: Open Bills ---------- */
function renderOpenBills(){
  const box = $("#openBills"); if(!box) return;
  const bills = getBills();
  if(bills.length===0){ box.innerHTML = `<div class="hint">ยังไม่มีบิล</div>`; return; }

  box.innerHTML = bills.map(b=>(
    `<div class="bill-row">
      <div class="bill-title">โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <div class="bill-actions">
        <button class="btn" data-view="${b.id}">ดูรายการ</button>
        <button class="btn primary" data-pay="${b.id}">ปิดบิล</button>
        <button class="btn danger" data-cancel="${b.id}">ยกเลิกบิล</button>
      </div>
    </div>`
  )).join("");

  // actions
  $$("#openBills [data-view]").forEach(btn=>{
    btn.addEventListener('click',()=>{
      const b = getBills().find(x=>x.id===btn.dataset.view);
      if(!b) return alert("ไม่พบบิล");
      const rows = b.items.map(i=>`${i.name} × ${i.qty} = ฿${fmt(i.qty*i.price)}`).join("\n");
      alert(`โต๊ะ ${b.table}\nพนักงาน: ${b.staff}\n\n${rows}\n\nรวม: ฿${fmt(b.total)}`);
    });
  });
  $$("#openBills [data-pay]").forEach(btn=>{
    btn.addEventListener('click',()=> openPayModal(btn.dataset.pay));
  });
  $$("#openBills [data-cancel]").forEach(btn=>{
    btn.addEventListener('click',()=> cancelBill(btn.dataset.cancel));
  });
}

/* ---------- Actions: POS ---------- */
$("#btnOpenBill")?.addEventListener("click", ()=>{
  const table = $("#inpTable").value.trim();
  const staff = $("#inpStaff").value.trim();
  if(!table) return alert("กรุณาใส่หมายเลขโต๊ะ");
  if(!staff) return alert("กรุณาใส่ชื่อพนักงาน");

  const bills = getBills();
  const id = Date.now().toString(36);
  bills.push({ id, table, staff, items:[], total:0, createdAt: Date.now() });
  setBills(bills);
  alert(`เปิดบิลสำหรับโต๊ะ ${table} เรียบร้อย`);
});

$("#btnClearCart")?.addEventListener("click", ()=> setCart([]));

$("#btnAddToBill")?.addEventListener("click", ()=>{
  const cart = getCart();
  if(cart.length===0) return alert("ตะกร้าว่าง");
  const bills = getBills();
  if(bills.length===0) return alert("ยังไม่มีบิลเปิดอยู่ - กด 'เปิดบิล' ก่อน");

  // เพิ่มลงบิลล่าสุด
  const b = bills[bills.length-1];
  cart.forEach(c=>{
    const ex = b.items.find(x=>x.id===c.id);
    if(ex) ex.qty += c.qty;
    else b.items.push({...c});
  });
  b.total = b.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills);
  setCart([]);
  alert("เพิ่มลงบิลแล้ว");
});

/* ---------- Void Bill ---------- */
function cancelBill(billId){
  const bills = getBills();
  const b = bills.find(x=>x.id===billId);
  if(!b){ alert('ไม่พบบิล'); return; }

  if(!confirm(`ยกเลิกบิลโต๊ะ ${b.table}?`)) return;
  const reason = prompt('เหตุผลการยกเลิก', 'ลูกค้ายกเลิก/สั่งผิด');

  // เก็บหลักฐาน void
  const voids = getVoids();
  voids.push({
    id:'V'+Date.now(),
    table:b.table, staff:b.staff, items:b.items, total:b.total,
    reason: reason||'',
    canceledAt: Date.now()
  });
  setVoids(voids);

  // ลบออกจากรายการบิลเปิดอยู่
  const idx = bills.findIndex(x=>x.id===billId);
  if(idx>-1) bills.splice(idx,1);
  setBills(bills);

  alert('ยกเลิกบิลเรียบร้อย');
}

/* ---------- Pay modal ---------- */
let PAY_BILL = null;

function openPayModal(billId){
  const bills = getBills();
  const b = bills.find(x=>x.id===billId);
  if(!b){ alert('ไม่พบบิล'); return; }

  const modal = $("#payModal");
  if(!modal){ alert('ไม่พบ payModal ใน index.html'); return; }

  $("#payTable")?.setAttribute("value", b.table);
  $("#payStaff")?.setAttribute("value", b.staff);
  $("#payTotal")?.setAttribute("value", `฿${fmt(b.total)}`);
  $("#payReceived")?.setAttribute("value", b.total);
  $("#payChange")?.setAttribute("value", "฿0");
  $("#payMethod")?.value = "cash";

  const tb = $("#payItems");
  if(tb){
    const rows = b.items.map(i=>(
      `<tr><td>${i.name}</td><td style="width:70px;text-align:right">× ${i.qty}</td><td style="width:110px;text-align:right">฿${fmt(i.qty*i.price)}</td></tr>`
    )).join("");
    tb.innerHTML = `
      <thead><tr><th>รายการ</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ยอด</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2" style="text-align:right">รวม</td><td style="text-align:right">฿${fmt(b.total)}</td></tr></tfoot>
    `;
  }

  $("#qrZone")?.setAttribute("hidden","hidden");
  const qi = $("#qrImg"); if(qi) qi.src = "";
  const qn = $("#qrNote"); if(qn) qn.textContent = "";

  PAY_BILL = b;
  modal.showModal();
}

$("#payReceived")?.addEventListener("input", ()=>{
  const t = PAY_BILL?.total || 0;
  const r = Number($("#payReceived").value || 0);
  $("#payChange")?.setAttribute("value", `฿${fmt(Math.max(0, r - t))}`);
});

$("#payMethod")?.addEventListener("change", ()=>{
  const m = $("#payMethod").value;
  if(m==='scan'){ showQR(); }
  else{
    $("#qrZone")?.setAttribute("hidden","hidden");
    const qi = $("#qrImg"); if(qi) qi.src = "";
    const qn = $("#qrNote"); if(qn) qn.textContent = "";
  }
});

function showQR(){
  const qrZone = $("#qrZone");
  const qrImg  = $("#qrImg");
  const qrNote = $("#qrNote");
  if(!qrZone || !qrImg || !qrNote){
    alert('ไม่พบส่วน QR ใน modal');
    $("#payMethod").value = 'cash';
    return;
  }
  const base = (POS_QR_TEXT||"").trim();
  if(!base){
    alert('ยังไม่ได้ตั้งข้อความ/เลขพร้อมเพย์สำหรับ QR (แก้ตัวแปร POS_QR_TEXT ใน app.js)');
    $("#payMethod").value = 'cash';
    qrZone.hidden = true;
    return;
  }
  const amt  = PAY_BILL?.total || 0;
  const text = `PAY TO: ${base}\nAMOUNT: ${amt} THB\nTABLE: ${PAY_BILL.table}`;
  const url  = `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(text)}`;
  qrImg.src = url;
  qrNote.textContent = `ยอดชำระ ฿${fmt(amt)}  |  ${base}`;
  qrZone.removeAttribute("hidden");
}

// ยืนยันปิดบิล → บันทึกเป็น sales
$("#btnConfirmPay")?.addEventListener("click", (ev)=>{
  ev.preventDefault();

  const r = Number($("#payReceived").value || 0);
  const m = $("#payMethod").value;
  const b = PAY_BILL;
  if(!b){ alert('ไม่พบบิล'); return; }

  if(m==='cash' && r < b.total){
    alert('เงินไม่พอสำหรับชำระ');
    return;
  }

  // ลบบิลจาก open bills
  const bills = getBills();
  const idx = bills.findIndex(x=>x.id===b.id);
  if(idx>-1) bills.splice(idx,1);
  setBills(bills);

  // เพิ่มเป็นยอดขาย
  const sales = getSales();
  sales.push({
    id: 'S'+Date.now(),
    table: b.table, staff: b.staff,
    items: b.items, total: b.total,
    pay_method: m, received: r, change: Math.max(0,r-b.total),
    createdAt: Date.now()
  });
  setSales(sales);

  $("#payModal")?.close();
  alert('ปิดบิลเรียบร้อย');
});

/* ---------- Reports (ง่าย) ---------- */
$("#btnToday")?.addEventListener("click", ()=>{
  const s = getSales();
  const v = getVoids();
  const start = new Date(); start.setHours(0,0,0,0);
  const sold  = s.filter(x=>x.createdAt>=start.getTime());
  const voids = v.filter(x=>x.canceledAt>=start.getTime());
  const sum   = sold.reduce((a,c)=>a+c.total,0);
  const vSum  = voids.reduce((a,c)=>a+c.total,0);

  $("#reportBox").innerHTML = `
    <div>ยอดขายวันนี้: <b>฿${fmt(sum)}</b> (${sold.length} บิล)</div>
    <div>ยกเลิกบิลวันนี้: <b>฿${fmt(vSum)}</b> (${voids.length} บิล)</div>
  `;
});
$("#btnMonth")?.addEventListener("click", ()=>{
  const s = getSales();
  const v = getVoids();
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

  const sold  = s.filter(x=>x.createdAt>=start);
  const voids = v.filter(x=>x.canceledAt>=start);

  const sum   = sold.reduce((a,c)=>a+c.total,0);
  const vSum  = voids.reduce((a,c)=>a+c.total,0);

  $("#reportBox").innerHTML = `
    <div>ยอดขายเดือนนี้: <b>฿${fmt(sum)}</b> (${sold.length} บิล)</div>
    <div>ยกเลิกบิลเดือนนี้: <b>฿${fmt(vSum)}</b> (${voids.length} บิล)</div>
  `;
});
$("#btnPullNow")?.addEventListener("click", ()=>{
  alert('เดโม: ยังไม่ได้ต่อ Google Sheets ในไฟล์นี้');
});

/* ---------- Boot ---------- */
ensureMenu();
renderMenu();
renderCart();
renderOpenBills();
