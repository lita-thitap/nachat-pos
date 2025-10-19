/* ===============================
   Nachat POS (Offline-first)
   Version: 2025-10-19
   Features: Open bill, Add items,
             Close bill (cash / QR),
             View & Print Slip,
             Cancel bill, Sync to Sheets
================================= */

/* ===== Utilities ===== */
const $ = (s, el=document) => el.querySelector(s);
const money = n => '฿' + (+n||0).toLocaleString('th-TH');
const nowISO = () => new Date().toISOString();

/* ===== Storage Keys ===== */
const LS = {
  MENU: 'POS_MENU',
  BILLS: 'POS_BILLS',
  SHOP: 'POS_SHOPINFO'
};

/* ===== Storage Helpers ===== */
const DB = {
  load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch(e){ return fallback } },
  save(key, val){ localStorage.setItem(key, JSON.stringify(val)) }
};

/* ===== Shop Info ===== */
const Shop = {
  get(){ return DB.load(LS.SHOP, {name:'Nachat | POS', bankLine:'', ppId:'', gsUrl:''}); },
  set(v){ DB.save(LS.SHOP, v); }
};

/* ===== Menu ===== */
const Menu = {
  get(){ return DB.load(LS.MENU, []); },
  set(v){ DB.save(LS.MENU, v); }
};

/* ===== Bills ===== */
const Bills = {
  get(){ return DB.load(LS.BILLS, []); },
  set(v){ DB.save(LS.BILLS, v); },
  byId(id){ return Bills.get().find(b=>b.id===id) },
  remove(id){ Bills.set(Bills.get().filter(b=>b.id!==id)); }
};

/* ===== Sample menu seed ===== */
(function seedMenu(){
  if(Menu.get().length) return;
  Menu.set([
    {id:'SET1', name:'ชุดหมูกระทะ (2-3 คน)', price:299},
    {id:'SET2', name:'ชุดหมูกระทะทะเล', price:299},
    {id:'ADD1', name:'สันคอหมูสไลซ์ (ถาด)', price:50},
    {id:'ADD2', name:'เบคอนรมควัน (ถาด)', price:50},
    {id:'DW1', name:'น้ำเปล่า (ขวด)', price:15},
    {id:'DW2', name:'เบียร์ช้าง (ขวด)', price:110}
  ]);
})();

/* ===== Global Cart ===== */
let CART = [];

/* ===== Menu Render ===== */
function renderMenu(){
  const list = $('#menuList');
  const items = Menu.get();
  list.innerHTML = items.map(m=>`
    <button class="btn" data-add="${m.id}" style="margin:6px">
      ${m.name} <span class="pill">${money(m.price)}</span>
    </button>
  `).join('');
  list.onclick = e=>{
    const id = e.target.closest('[data-add]')?.dataset.add;
    if(!id) return;
    const it = items.find(x=>x.id===id);
    const ex = CART.find(c=>c.id===id);
    if(ex) ex.qty++; else CART.push({...it, qty:1});
    renderCart();
  };
}

/* ===== Cart Render ===== */
function renderCart(){
  const box = $('#cartList');
  if(!CART.length){ box.textContent='ยังไม่มีรายการ'; $('#cartTotal').textContent='0'; return; }
  box.innerHTML = CART.map(x=>`
    <div class="row" style="margin:4px 0">
      <div>${x.name}</div>
      <div style="max-width:100px" class="row">
        <button class="btn" data-dec="${x.id}">-</button>
        <input value="${x.qty}" disabled style="text-align:center;width:40px">
        <button class="btn" data-inc="${x.id}">+</button>
      </div>
      <div style="flex:0;text-align:right">${money(x.qty*x.price)}</div>
    </div>
  `).join('');
  $('#cartTotal').textContent = CART.reduce((s,x)=>s+x.qty*x.price,0);
  box.onclick = e=>{
    const dec = e.target.closest('[data-dec]')?.dataset.dec;
    const inc = e.target.closest('[data-inc]')?.dataset.inc;
    if(dec){ const it=CART.find(i=>i.id===dec); if(it){ it.qty--; if(it.qty<=0) CART=CART.filter(i=>i.id!==dec);} }
    if(inc){ const it=CART.find(i=>i.id===inc); if(it) it.qty++; }
    renderCart();
  };
}

$('#btnClearCart').onclick = ()=>{ CART=[]; renderCart(); };

/* ===== Open Bill ===== */
$('#btnOpenBill').onclick = ()=>{
  const table = $('#inpTable').value.trim()||'โต๊ะ?';
  const staff = $('#inpStaff').value.trim()||'พนักงาน';
  if(!CART.length) return alert('ตะกร้าว่าง');
  const total = CART.reduce((s,x)=>s+x.qty*x.price,0);
  const bill = {
    id: Math.random().toString(36).slice(2,8),
    createdAt: nowISO(),
    table, staff,
    items: CART.map(x=>({...x})),
    discount:0, status:'open'
  };
  const all = Bills.get(); all.push(bill); Bills.set(all);
  CART=[]; renderCart(); renderBills();
};

/* ===== Render Bills ===== */
function renderBills(){
  const box = $('#openBills');
  const list = Bills.get().filter(b=>b.status==='open');
  if(!list.length){ box.innerHTML='<div style="color:#777">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }
  box.innerHTML = list.map(b=>`
    <div class="card" style="margin:6px 0">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><b>${b.table}</b> • ${b.staff}</div>
        <div>${money(sumBill(b))}</div>
        <button class="btn primary" data-pay="${b.id}">ชำระเงิน</button>
      </div>
    </div>
  `).join('');
}

/* ===== Helper ===== */
function sumBill(b){ return (b.items||[]).reduce((s,x)=>s+x.qty*x.price,0)-(b.discount||0); }

/* ===== Payment Modal UI ===== */
const POS_UI = {
  modal: $('#pos-pay-modal'),
  table: $('#pos-pay-table'),
  staff: $('#pos-pay-staff'),
  total: $('#pos-pay-total'),
  itemsBody: $('#pos-pay-items tbody'),
  method: $('#pos-pay-method'),
  receive: $('#pos-pay-receive'),
  change: $('#pos-pay-change'),
  qrWrap: $('#pos-qr-wrap'),
  qrImg: $('#pos-qr-img'),
  btnPay: $('#pos-btn-pay'),
  btnVoid: $('#pos-btn-void'),
  btnSlip: $('#pos-btn-view-slip'),
  btnClose: $('#pos-pay-close'),
};
let POS_CURRENT = null;

/* ===== Open Modal ===== */
function openPayModal(id){
  const b = Bills.byId(id); if(!b) return;
  POS_CURRENT = b;
  POS_UI.table.value = b.table;
  POS_UI.staff.value = b.staff;
  POS_UI.total.value = money(sumBill(b));
  POS_UI.itemsBody.innerHTML = b.items.map(x=>`
    <tr><td>${x.name}</td><td style="text-align:center">×${x.qty}</td><td style="text-align:right">${money(x.qty*x.price)}</td></tr>
  `).join('');
  POS_UI.method.value='cash';
  POS_UI.receive.value=sumBill(b);
  POS_UI.change.value='฿0';
  POS_UI.qrWrap.style.display='none';
  POS_UI.modal.style.display='grid';
  POS_UI.modal.classList.add('show');
}

/* ===== Close Modal ===== */
function closePayModal(){
  POS_UI.modal.classList.remove('show');
  POS_UI.modal.style.display='none';
  POS_CURRENT = null;
}
POS_UI.btnClose.onclick = closePayModal;

/* ===== Update Change ===== */
POS_UI.receive.oninput = ()=>{
  if(!POS_CURRENT) return;
  const get = +POS_UI.receive.value||0;
  const need = sumBill(POS_CURRENT);
  POS_UI.change.value = money(Math.max(0,get-need));
};

/* ===== Switch QR ===== */
POS_UI.method.onchange = ()=>{
  const shop = Shop.get();
  if(POS_UI.method.value==='transfer' && shop.ppId){
    const amt = sumBill(POS_CURRENT).toFixed(2);
    POS_UI.qrImg.src = `https://promptpay.io/${encodeURIComponent(shop.ppId)}/${amt}.png`;
    POS_UI.qrWrap.style.display='block';
  } else {
    POS_UI.qrWrap.style.display='none';
  }
};

/* ===== Print Slip ===== */
POS_UI.btnSlip.onclick = ()=>{
  if(!POS_CURRENT) return;
  const b = POS_CURRENT;
  const shop = Shop.get();
  const amt = sumBill(b).toFixed(2);
  const qr = shop.ppId ? `https://promptpay.io/${encodeURIComponent(shop.ppId)}/${amt}.png` : '';
  const win = window.open('','_blank');
  win.document.write(`
    <html><head><meta charset="utf-8"><title>ใบเสร็จ</title>
    <style>
      body{font:14px/1.6 ui-sans-serif,system-ui;background:#eef0f2;margin:0;padding:24px}
      .paper{width:420px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:12px;padding:18px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:7px;border-bottom:1px dashed #eee;text-align:left}
      .center{text-align:center}
      @media print {.no-print{display:none}}
    </style></head><body>
    <div class="paper">
      <h3>${shop.name||'Nachat POS'}</h3>
      <div>${shop.bankLine||''}<br/>พร้อมเพย์: ${shop.ppId||''}</div>
      ${qr?`<div class="center" style="margin:10px 0"><img src="${qr}" width="180"></div>`:''}
      <table>
        <tr><td>เลขที่บิล</td><td>${b.id}</td></tr>
        <tr><td>โต๊ะ</td><td>${b.table}</td></tr>
        <tr><td>วันที่</td><td>${new Date(b.createdAt).toLocaleString('th-TH')}</td></tr>
        <tr><td>ยอดรวม</td><td>${money(sumBill(b))}</td></tr>
      </table>
      <table>
        <thead><tr><th>สินค้า</th><th class="center">จำนวน</th><th style="text-align:right">รวม</th></tr></thead>
        <tbody>
          ${b.items.map(x=>`<tr><td>${x.name}</td><td class="center">×${x.qty}</td><td style="text-align:right">${money(x.qty*x.price)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="center no-print" style="margin-top:16px">
        <button onclick="window.print()">พิมพ์</button>
        <button onclick="window.close()">ปิด</button>
      </div>
    </div></body></html>
  `);
  win.document.close();
};

/* ===== Confirm Pay ===== */
POS_UI.btnPay.onclick = async ()=>{
  if(!POS_CURRENT) return;
  const b = POS_CURRENT;
  const method = POS_UI.method.value;
  const recv = +POS_UI.receive.value||0;
  const need = sumBill(b);
  if(method==='cash' && recv<need) return alert('รับเงินไม่พอ');
  b.status='paid';
  b.pay_method=method;
  b.received=recv;
  b.change=Math.max(0,recv-need);
  b.updatedAt=nowISO();
  const all = Bills.get().map(x=>x.id===b.id?b:x); Bills.set(all);
  closePayModal(); renderBills(); alert('ปิดบิลแล้ว');

  const shop = Shop.get();
  if(shop.gsUrl){
    try{
      await fetch(shop.gsUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({op:'push',bill:{
          id:b.id,createdAt:b.createdAt,table:b.table,staff:b.staff,
          items:b.items,total:sumBill(b),pay_method:b.pay_method,received:b.received,change:b.change
        }})
      });
    }catch(e){console.warn('Sync fail',e);}
  }
};

/* ===== Void Bill ===== */
POS_UI.btnVoid.onclick = ()=>{
  if(!POS_CURRENT) return;
  if(!confirm('ยกเลิกบิลนี้ใช่ไหม?')) return;
  Bills.remove(POS_CURRENT.id);
  closePayModal(); renderBills();
};

/* ===== Click to pay ===== */
document.addEventListener('click',e=>{
  const btn = e.target.closest('[data-pay]');
  if(!btn) return;
  openPayModal(btn.dataset.pay);
});

/* ===== Init ===== */
renderMenu(); renderCart(); renderBills();
