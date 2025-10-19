/* ====== Local Storage Keys ====== */
const LS = {
  MENU: 'POS_MENU',
  BILLS: 'POS_BILLS',
  STATE: 'POS_STATE',
  SHOP:  'POS_SHOPINFO',   // {name, bankLine, ppId, gsUrl}
};

/* ====== Utilities ====== */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const nowISO = () => new Date().toISOString();
const money = n => '฿' + (+n||0).toLocaleString('th-TH');

/* ====== Data layer ====== */
const DB = {
  load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch(e){ return fallback } },
  save(key, val){ localStorage.setItem(key, JSON.stringify(val)) },
};
const Shop = {
  get(){ return DB.load(LS.SHOP, {name:'ณฉัตร | Nachat', bankLine:'', ppId:'', gsUrl:''}); },
  set(v){ DB.save(LS.SHOP, v); },
};
const Menu = {
  get(){ return DB.load(LS.MENU, []); },
  set(v){ DB.save(LS.MENU, v); },
};
const Bills = {
  get(){ return DB.load(LS.BILLS, []); },
  set(v){ DB.save(LS.BILLS, v); },
  byId(id){ return Bills.get().find(b=>b.id===id) },
};

/* ====== Sample menu if empty ====== */
(function seedMenu(){
  if (Menu.get().length) return;
  Menu.set([
    {id:'SET299', name:'ชุดหมูกระทะ (2–3 คน)', price:299, cat:'SET'},
    {id:'AD_PORKSLICE', name:'สันคอหมูสไลซ์ (ถาด)', price:50, cat:'AD'},
    {id:'AD_BACON', name:'เบคอนรมควัน (ถาด)', price:89, cat:'AD'},
    {id:'DW_WATER', name:'น้ำเปล่า (ขวด)', price:15, cat:'DW'},
    {id:'PR_BEER3', name:'โปรเบียร์ถัง 3 ขวด', price:210, cat:'PR'},
  ]);
})();

/* ====== Simple cart in memory ====== */
let CART = [];
function renderMenu(){
  const list = $('#menuList');
  const items = Menu.get();
  list.innerHTML = items.map(m=>(
    `<button class="btn" style="margin:6px" data-add="${m.id}">
      ${m.name} <span class="pill">${money(m.price)}</span>
    </button>`
  )).join('') || '<div style="color:#777">ยังไม่มีเมนู</div>';
  list.onclick = e=>{
    const id = e.target.closest('[data-add]')?.dataset.add;
    if(!id) return;
    const it = items.find(x=>x.id===id); if(!it) return;
    const exist = CART.find(x=>x.id===id);
    if(exist) exist.qty+=1; else CART.push({id:it.id,name:it.name,price:it.price,qty:1});
    renderCart();
  };
}
function renderCart(){
  const list = $('#cartList');
  if(!CART.length){ list.textContent='ยังไม่มีรายการ'; $('#cartTotal').textContent='0'; return; }
  list.innerHTML = CART.map(x=>
    `<div class="row" style="margin:4px 0">
      <div>${x.name}</div>
      <div style="max-width:110px" class="row">
        <button class="btn" data-dec="${x.id}">–</button>
        <input value="${x.qty}" style="text-align:center" disabled/>
        <button class="btn" data-inc="${x.id}">+</button>
      </div>
      <div style="max-width:120px;text-align:right">${money(x.qty*x.price)}</div>
    </div>`
  ).join('');
  $('#cartTotal').textContent = CART.reduce((s,x)=>s+x.qty*x.price,0);
  list.onclick = e=>{
    const dec = e.target.closest('[data-dec]')?.dataset.dec;
    const inc = e.target.closest('[data-inc]')?.dataset.inc;
    if(dec){ const it=CART.find(i=>i.id===dec); if(it){ it.qty--; if(it.qty<=0) CART=CART.filter(i=>i.id!==dec)} }
    if(inc){ const it=CART.find(i=>i.id===inc); if(it){ it.qty++; } }
    renderCart();
  };
}
$('#btnClearCart').onclick = ()=>{ CART=[]; renderCart(); }

/* ====== Bills ====== */
function openBill(){
  const table = $('#inpTable').value.trim() || 'N/A';
  const staff = $('#inpStaff').value.trim() || 'staff';
  if(!CART.length) return alert('ตะกร้าว่าง');
  const total = CART.reduce((s,x)=>s+x.qty*x.price,0);
  const bill = {
    id: Math.random().toString(36).slice(2,9),
    createdAt: nowISO(),
    table, staff,
    items: CART.map(x=>({id:x.id,name:x.name,price:x.price,qty:x.qty})),
    discount:0,
    total,
    status:'open',
  };
  const all = Bills.get(); all.push(bill); Bills.set(all);
  CART=[]; renderCart(); renderOpenBills();
}
$('#btnOpenBill').onclick = openBill;

function renderOpenBills(){
  const box = $('#openBills');
  const bills = Bills.get().filter(b=>b.status==='open');
  if(!bills.length){ box.innerHTML='<div style="color:#777">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }
  box.innerHTML = bills.map(b=>`
    <div class="card" style="margin:8px 0">
      <div class="row">
        <div><b>โต๊ะ</b> ${b.table} • ${b.staff}</div>
        <div class="pill">รวม ${money(sumBill(b))}</div>
        <div style="flex:0">
          <button class="btn primary" data-pay="${b.id}">ชำระเงิน</button>
        </div>
      </div>
    </div>`).join('');
  box.onclick = e=>{
    const id = e.target.closest('[data-pay]')?.dataset.pay;
    if(id) openPayModal(id);
  };
}
function sumBill(b){ return (b.items||[]).reduce((s,x)=>s+x.qty*x.price,0) - (b.discount||0); }

/* ====== Payment Modal ====== */
const PayUI = {
  el: $('#payModal'),
  table: $('#payTable'),
  staff: $('#payStaff'),
  total: $('#payTotal'),
  itemsBody: $('#payItems tbody'),
  method: $('#payMethod'),
  receive: $('#payReceive'),
  change: $('#payChange'),
  qrBox: $('#qrBox'),
  qrImg: $('#qrImg'),
  btnConfirm: $('#btnPayConfirm'),
  btnVoid: $('#btnVoidBill'),
  btnPrint: $('#btnViewSlip'),
};
let PAY_BILL_ID = null;

function openPayModal(billId){
  const b = Bills.byId(billId); if(!b) return;
  PAY_BILL_ID = billId;

  PayUI.table.value = b.table;
  PayUI.staff.value = b.staff;
  PayUI.total.value = money(sumBill(b));
  PayUI.itemsBody.innerHTML = b.items.map(x=>`
    <tr><td>${x.name}</td><td style="text-align:center">× ${x.qty}</td><td style="text-align:right">${money(x.qty*x.price)}</td></tr>
  `).join('');
  PayUI.receive.value = sumBill(b);
  updateChange();

  // default method
  PayUI.method.value = 'cash';
  PayUI.qrBox.style.display='none';
  PayUI.qrImg.src='';

  PayUI.el.classList.add('show');
  PayUI.el.removeAttribute('aria-hidden');
}

function closePayModal(){
  PayUI.el.classList.remove('show');
  PayUI.el.setAttribute('aria-hidden','true');
  PAY_BILL_ID = null;
}
$('#payClose').onclick = closePayModal;

function updateChange(){
  const b = Bills.byId(PAY_BILL_ID); if(!b) return;
  const received = +PayUI.receive.value||0;
  const change = Math.max(0, received - sumBill(b));
  PayUI.change.value = money(change);
}
PayUI.receive.oninput = updateChange;

PayUI.method.onchange = ()=>{
  const b = Bills.byId(PAY_BILL_ID); if(!b) return;
  const shop = Shop.get();
  if(PayUI.method.value==='transfer' && shop.ppId){
    const amt = sumBill(b).toFixed(2);
    PayUI.qrImg.src = `https://promptpay.io/${encodeURIComponent(shop.ppId)}/${amt}.png`;
    PayUI.qrBox.style.display='block';
  }else{
    PayUI.qrBox.style.display='none';
    PayUI.qrImg.src='';
  }
};

/* View slip / print (open a new tab) */
PayUI.btnPrint.onclick = ()=>{
  const b = Bills.byId(PAY_BILL_ID); if(!b) return;
  const shop = Shop.get();
  const amt = sumBill(b).toFixed(2);
  const qr = shop.ppId ? `https://promptpay.io/${encodeURIComponent(shop.ppId)}/${amt}.png` : '';
  const win = window.open('','_blank');
  win.document.write(`
    <html><head><meta charset="utf-8">
    <title>สลิปโอน/ใบแจ้งชำระ</title>
    <style>
      body{font:14px/1.6 ui-sans-serif,system-ui;background:#eef0f2;margin:0;padding:24px}
      .paper{width:420px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:12px;padding:18px}
      .title{font-size:18px;font-weight:800}
      .muted{color:#666}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{padding:7px;border-bottom:1px dashed #e5e5e5;text-align:left}
      .center{text-align:center}
      .big{font-size:24px;font-weight:800}
      .btn{padding:10px 14px;border-radius:10px;border:1px solid #111;background:#fff;cursor:pointer}
      .btn.primary{background:#0f62fe;color:#fff;border-color:#0f62fe}
      @media print { .no-print{display:none} body{background:#fff} .paper{border:none} }
    </style>
    </head><body>
      <div class="paper">
        <div class="title">${shop.name || 'Nachat'}</div>
        <div class="muted">${shop.bankLine || ''}<br/>พร้อมเพย์: ${shop.ppId || '-'}</div>
        ${qr ? `<div class="center" style="margin:12px 0"><img src="${qr}" style="width:180px;height:180px;border:1px solid #eee;border-radius:8px"/></div>`:''}
        <table>
          <tr><td class="muted">เลขที่บิล</td><td>${b.id}</td></tr>
          <tr><td class="muted">โต๊ะ</td><td>${b.table}</td></tr>
          <tr><td class="muted">วันที่</td><td>${new Date(b.createdAt).toLocaleString('th-TH')}</td></tr>
          <tr><td class="muted">ยอดสุทธิ</td><td class="big">฿${sumBill(b).toLocaleString('th-TH')}</td></tr>
        </table>
        <div style="height:10px"></div>
        <table>
          <thead><tr><th>สินค้า</th><th class="center" style="width:70px">จำนวน</th><th style="width:90px;text-align:right">รวม</th></tr></thead>
          <tbody>
            ${b.items.map(x=>`<tr><td>${x.name}</td><td class="center">× ${x.qty}</td><td style="text-align:right">${money(x.qty*x.price)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td>ยอดที่ต้องโอน</td><td></td><td style="text-align:right">${money(sumBill(b))}</td></tr></tfoot>
        </table>
        <div class="center no-print" style="margin-top:16px">
          <button class="btn primary" onclick="window.print()">พิมพ์</button>
          <button class="btn" onclick="window.close()">ปิด</button>
        </div>
      </div>
    </body></html>
  `);
  win.document.close();
};

/* Confirm payment (close bill) */
PayUI.btnConfirm.onclick = ()=>{
  const b = Bills.byId(PAY_BILL_ID); if(!b) return;
  const method = PayUI.method.value;
  const received = +PayUI.receive.value || 0;
  const need = sumBill(b);
  if(method==='cash' && received<need) return alert('รับเงินไม่พอ');
  // mark paid
  b.status = 'paid';
  b.pay_method = method;
  b.received = received;
  b.change = Math.max(0, received-need);
  b.updatedAt = nowISO();

  const all = Bills.get().map(x=>x.id===b.id?b:x); Bills.set(all);
  closePayModal();
  renderOpenBills();
  // push to Google Sheets if configured
  pushToSheets(b);
  alert('ปิดบิลแล้ว');
};

/* Void bill */
PayUI.btnVoid.onclick = ()=>{
  const b = Bills.byId(PAY_BILL_ID); if(!b) return;
  if(!confirm('ยกเลิกบิลนี้ใช่ไหม?')) return;
  const all = Bills.get().filter(x=>x.id!==b.id); Bills.set(all);
  closePayModal(); renderOpenBills();
};

/* ====== Reports (mock local) ====== */
$('#btnToday').onclick = ()=>{ renderReport(d=> new Date(d).toDateString() === new Date().toDateString()); };
$('#btnMonth').onclick = ()=>{ const m=new Date().getMonth(); const y=new Date().getFullYear(); renderReport(d=>{const dt=new Date(d); return dt.getMonth()===m&&dt.getFullYear()===y;}); };
$('#btnPullNow').onclick = ()=>alert('ดึงข้อมูลจาก Sheets: (demo) ใช้ไฟล์ sync.js ที่คุณตั้งค่า');

function renderReport(filterFn){
  const paid = Bills.get().filter(b=>b.status==='paid' && filterFn(b.updatedAt||b.createdAt));
  const sum = paid.reduce((s,b)=>s+sumBill(b),0);
  $('#reportBox').innerHTML = `
    <div>จำนวนบิล: <b>${paid.length}</b> ใบ</div>
    <div>ยอดรวม: <b>${money(sum)}</b></div>
  `;
}

/* ====== Settings ====== */
(function loadSettings(){
  const s = Shop.get();
  $('#shopName').value = s.name || '';
  $('#bankLine').value = s.bankLine || '';
  $('#ppId').value = s.ppId || '';
  $('#gsUrl').value = s.gsUrl || '';
})();
$('#btnSaveSettings').onclick = ()=>{
  Shop.set({
    name: $('#shopName').value.trim(),
    bankLine: $('#bankLine').value.trim(),
    ppId: $('#ppId').value.trim(),
    gsUrl: $('#gsUrl').value.trim(),
  });
  alert('บันทึกแล้ว');
};

/* ====== Google Sheets push (via Apps Script) ====== */
async function pushToSheets(bill){
  const { gsUrl } = Shop.get();
  if(!gsUrl) return; // not configured
  try{
    await fetch(gsUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        op:'push',
        bill: {
          id: bill.id,
          createdAt: bill.createdAt,
          table: bill.table,
          staff: bill.staff,
          items: bill.items,
          discount: bill.discount||0,
          total: sumBill(bill),
          pay_method: bill.pay_method,
          received: bill.received||0,
          change: bill.change||0,
        }
      })
    });
  }catch(e){ console.warn('push sheets error', e); }
}

/* ====== Boot ====== */
renderMenu();
renderCart();
renderOpenBills();
