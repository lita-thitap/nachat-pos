/* ========== Nachat POS (Frontend) – full ========== */
/* STORAGE KEYS */
const K = {
  MENU: 'pos_menu',
  CART: 'pos_cart',
  BILLS: 'pos_bills',
  SALES: 'pos_sales'
};

/* Helpers */
const $  = sel => document.querySelector(sel);
const fmt = n => Number(n||0).toLocaleString('th-TH');

/* Seed menu ครั้งแรก */
function seedMenu(){
  if(localStorage.getItem(K.MENU)) return;
  const menu = [
    {id:'Z99',name:'ชุดรวมหมูถาด',cat:'SET',price:299},
    {id:'Z98',name:'ชุดหมูทะเล',cat:'SET',price:299},
    {id:'A10',name:'สันคอหมูสไลซ์ (ถาด)',cat:'AD',price:50},
    {id:'A20',name:'เบคอนรมควัน (ถาด)',cat:'AD',price:50},
    {id:'A30',name:'กุ้ง (ถาด)',cat:'AD',price:50},
    {id:'D10',name:'น้ำเปล่า (ขวด)',cat:'DW',price:15},
    {id:'D20',name:'น้ำแข็งถัง',cat:'DW',price:30},
    {id:'P30',name:'โปรเบียร์ชิงฟัง 3 ขวด',cat:'PR',price:210},
    {id:'P60',name:'โปรเบียร์ชิงฟัง 6 ขวด',cat:'PR',price:410},
  ];
  localStorage.setItem(K.MENU, JSON.stringify(menu));
}
seedMenu();

/* State accessors */
const getMenu  = () => JSON.parse(localStorage.getItem(K.MENU)||'[]');
const setMenu  = v => localStorage.setItem(K.MENU, JSON.stringify(v));
const getCart  = () => JSON.parse(localStorage.getItem(K.CART)||'[]');
const setCart  = v => localStorage.setItem(K.CART, JSON.stringify(v));
const getBills = () => JSON.parse(localStorage.getItem(K.BILLS)||'[]');
const setBills = v => localStorage.setItem(K.BILLS, JSON.stringify(v));
const getSales = () => JSON.parse(localStorage.getItem(K.SALES)||'[]');
const setSales = v => localStorage.setItem(K.SALES, JSON.stringify(v));

/* ---------- Render Menu (POS) ---------- */
function groupByCat(arr){
  const m = new Map();
  for(const it of arr){
    if(!m.has(it.cat)) m.set(it.cat, []);
    m.get(it.cat).push(it);
  }
  return m;
}
function renderMenu(){
  const wrap = $('#menuPanels'); wrap.innerHTML = '';
  const menu = getMenu();
  const bycat = groupByCat(menu);
  const CAT_NAMES = {SET:'ชุดหมูกระทะ', AD:'Add-on', DW:'เครื่องดื่ม', PR:'โปรเครื่องดื่ม'};

  for(const [cat, items] of bycat){
    const col = document.createElement('div');
    col.className='card menu-column';
    col.innerHTML = `<h3>${CAT_NAMES[cat]||cat} <span class="muted">${items.length} รายการ</span></h3>`;
    for(const it of items){
      const btn = document.createElement('div');
      btn.className='item';
      btn.innerHTML = `${it.name} <span class="price">฿${fmt(it.price)}</span>`;
      btn.addEventListener('click', ()=>{
        const cart = getCart(); cart.push({id:it.id,name:it.name,price:it.price,qty:1});
        setCart(cart); renderCart();
      });
      col.appendChild(btn);
    }
    wrap.appendChild(col);
  }
}

/* ---------- Cart ---------- */
function renderCart(){
  const list = $('#cartList'); const totalEl = $('#cartTotal');
  const cart = getCart();
  if(!cart.length){ list.textContent = 'ยังไม่มีรายการ'; totalEl.textContent='0'; return; }

  list.innerHTML = '';
  let sum = 0;
  for(let i=0;i<cart.length;i++){
    const it = cart[i]; sum += it.price*it.qty;
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div>${it.name}</div>
      <div style="max-width:120px"><input type="number" min="1" value="${it.qty}" /></div>
      <div style="max-width:120px"><input type="number" min="0" value="${it.price}" /></div>
      <div style="max-width:100px" class="pill">฿${fmt(it.qty*it.price)}</div>
      <div style="max-width:120px"><button class="btn ghost">ลบ</button></div>
    `;
    const qtyInput = row.querySelector('input[type=number]');
    const priceInput = row.querySelectorAll('input[type=number]')[1];
    qtyInput.addEventListener('input',()=>{ it.qty=Math.max(1,Number(qtyInput.value||1)); setCart(cart); renderCart(); });
    priceInput.addEventListener('input',()=>{ it.price=Math.max(0,Number(priceInput.value||0)); setCart(cart); renderCart(); });
    row.querySelector('button').addEventListener('click',()=>{ cart.splice(i,1); setCart(cart); renderCart(); });
    list.appendChild(row);
  }
  totalEl.textContent = fmt(sum);
}

$('#btnClearCart')?.addEventListener('click', ()=>{ setCart([]); renderCart(); });

/* ---------- Open/Append Bill ---------- */
$('#btnOpenBill')?.addEventListener('click', ()=>{
  const table = $('#inpTable').value.trim()||'โต๊ะ?';
  const staff = $('#inpStaff').value.trim()||'พนักงาน';
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');

  const total = cart.reduce((a,b)=>a+b.qty*b.price,0);
  const bill = { id: Date.now(), table, staff, items:cart, createdAt:new Date().toISOString(), total };
  const bills=getBills(); bills.push(bill); setBills(bills);
  setCart([]); renderCart();
  alert(`เปิดบิล โต๊ะ ${table} แล้ว`);
  renderOpenBills();
});

$('#btnAddToBill')?.addEventListener('click', ()=>{
  const table = $('#inpTable').value.trim();
  if(!table) return alert('กรอกโต๊ะก่อน');
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const bills=getBills();
  let bill = bills.find(b=>b.table===table);
  if(!bill){ bill={id:Date.now(),table,staff:$('#inpStaff').value.trim()||'พนักงาน',items:[],createdAt:new Date().toISOString(),total:0}; bills.push(bill); }
  bill.items.push(...cart); bill.total = bill.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* ---------- Pay modal (with QR + print option) ---------- */
let PAY_BILL = null;

function openPayModal(billId){
  const b = getBills().find(x=>x.id===billId); if(!b) return;
  PAY_BILL = b;

  $('#payTable').value = b.table;
  $('#payStaff').value = b.staff;
  $('#payTotal').value = `฿${fmt(b.total)}`;
  $('#payReceived').value = b.total;
  $('#payChange').value = '฿0';
  $('#payMethod').value = 'cash';
  $('#qrBox').hidden = true;
  $('#qrImg').src = '';
  $('#qrNote').textContent = '';
  $('#chkPrint').checked = false;

  $('#payModal').showModal();
}

$('#payMethod')?.addEventListener('change', (e)=>{
  const m = e.target.value;
  $('#qrBox').hidden = (m!=='scan');
  if(m==='scan') showQRPreview();
});
function showQRPreview(){
  if(!PAY_BILL) return;
  // ใช้รูป qrcode.png (สามารถเปลี่ยนเป็น DataURL ของ PromptPay ได้)
  const QR_URL = 'qrcode.png';
  $('#qrImg').src = QR_URL;
  $('#qrNote').textContent = `ยอดที่ต้องโอน ฿${fmt(PAY_BILL.total)}`;
}

$('#payReceived')?.addEventListener('input', ()=>{
  const t = PAY_BILL?.total||0;
  const r = Number($('#payReceived').value||0);
  $('#payChange').value = `฿${fmt(Math.max(0,r-t))}`;
});

$('#btnConfirmPay')?.addEventListener('click', (ev)=>{
  ev.preventDefault();
  if(!PAY_BILL) return;

  const method = $('#payMethod').value;
  const received = Number($('#payReceived').value||0);
  const total = PAY_BILL.total;

  if(method==='cash' && received < total){
    alert('จำนวนเงินไม่พอ (เงินสด)'); return;
  }

  const change = Math.max(0, received-total);

  // สร้าง sale
  const sale = {
    id: 'S'+Date.now(),
    table: PAY_BILL.table,
    staff: PAY_BILL.staff,
    items: PAY_BILL.items,
    total,
    createdAt: new Date().toISOString(),
    payment: { method, received, change }
  };
  const sales = getSales(); sales.push(sale); setSales(sales);

  // ส่งไปคิว Google Sheets ถ้ามี sync.js
  if(typeof enqueueSale==='function') enqueueSale(sale);

  // ลบบิลที่จ่ายเสร็จ
  let bills = getBills().filter(x=>x.id!==PAY_BILL.id); setBills(bills);
  $('#payModal').close();
  renderOpenBills();

  // เลือกพิมพ์บิล
  if($('#chkPrint').checked){ printBill(sale); }

  PAY_BILL=null;
  alert('ปิดบิลสำเร็จ');
});

/* ---------- Edit / Void Bill ---------- */
let EDIT_BILL = null;

function renderOpenBills(){
  const box = $('#openBills'); const bills = getBills(); box.innerHTML = '';
  if(!bills.length){ box.innerHTML='<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }

  for(const b of bills){
    const row = document.createElement('div');
    row.className='card bill-row';
    row.innerHTML = `
      <div>โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <button class="btn" data-edit="${b.id}">แก้ไข</button>
      <button class="btn ghost" data-void="${b.id}">ยกเลิก</button>
      <button class="btn primary" data-pay="${b.id}">ปิดบิล</button>
    `;
    row.querySelector('[data-edit]')?.addEventListener('click',()=>openEditModal(b.id));
    row.querySelector('[data-void]')?.addEventListener('click',()=>voidBill(b.id));
    row.querySelector('[data-pay]')?.addEventListener('click',()=>openPayModal(b.id));
    box.appendChild(row);
  }
}

function voidBill(billId){
  if(!confirm('ยืนยันยกเลิกบิลนี้?')) return;
  const rest = getBills().filter(b=>b.id!==billId);
  setBills(rest);
  renderOpenBills();
  alert('ยกเลิกบิลแล้ว');
}

function openEditModal(billId){
  const b = getBills().find(x=>x.id===billId); if(!b) return;
  EDIT_BILL = structuredClone(b);

  $('#editTable').value = EDIT_BILL.table;
  $('#editStaff').value = EDIT_BILL.staff;

  const wrap = $('#editItems'); wrap.innerHTML='';
  EDIT_BILL.items.forEach((it,idx)=>{
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div style="flex:2">${it.name}</div>
      <div style="max-width:120px"><input type="number" min="1" value="${it.qty}" /></div>
      <div style="max-width:120px"><input type="number" min="0" value="${it.price}" /></div>
      <div style="max-width:80px" class="pill">฿${fmt(it.qty*it.price)}</div>
      <div style="max-width:120px"><button class="btn ghost">ลบ</button></div>
    `;
    const qty = row.querySelectorAll('input')[0];
    const price = row.querySelectorAll('input')[1];
    qty.addEventListener('input',()=>{ it.qty=Math.max(1,Number(qty.value||1)); updateEditTotal(); row.querySelector('.pill').textContent='฿'+fmt(it.qty*it.price);});
    price.addEventListener('input',()=>{ it.price=Math.max(0,Number(price.value||0)); updateEditTotal(); row.querySelector('.pill').textContent='฿'+fmt(it.qty*it.price);});
    row.querySelector('button').addEventListener('click',()=>{ EDIT_BILL.items.splice(idx,1); openEditModal(billId); });
    wrap.appendChild(row);
  });

  updateEditTotal();
  $('#editModal').showModal();
}

function updateEditTotal(){
  if(!EDIT_BILL) return;
  const sum = EDIT_BILL.items.reduce((s,i)=>s+i.qty*i.price,0);
  EDIT_BILL.total = sum;
  $('#editTotal').innerHTML = '฿'+fmt(sum);
}

$('#btnSaveEdit')?.addEventListener('click',(e)=>{
  e.preventDefault();
  if(!EDIT_BILL) return;

  EDIT_BILL.table = $('#editTable').value.trim()||EDIT_BILL.table;
  EDIT_BILL.staff = $('#editStaff').value.trim()||EDIT_BILL.staff;

  const bills = getBills().map(b=> b.id===EDIT_BILL.id ? EDIT_BILL : b);
  setBills(bills);

  $('#editModal').close();
  EDIT_BILL=null;
  renderOpenBills();
  alert('บันทึกการแก้ไขแล้ว');
});

/* ---------- Print bill ---------- */
function printBill(sale){
  const w = window.open('','_blank','width=380,height=600');
  const lines = sale.items.map(i=>`
    <tr>
      <td>${i.name}</td>
      <td style="text-align:right">${i.qty}</td>
      <td style="text-align:right">฿${fmt(i.price)}</td>
      <td style="text-align:right">฿${fmt(i.qty*i.price)}</td>
    </tr>`).join('');

  const html = `
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>ใบเสร็จ</title>
    <style>
      body{font:14px/1.4 ui-sans-serif,system-ui;padding:12px}
      h3{margin:0 0 6px 0;text-align:center}
      table{width:100%;border-collapse:collapse}
      th,td{padding:6px 4px;border-bottom:1px dashed #ccc}
      .right{display:flex;justify-content:flex-end}
    </style>
  </head>
  <body>
    <h3>ใบเสร็จรับเงิน</h3>
    โต๊ะ: ${sale.table} • ${sale.staff}<br/>
    เวลา: ${new Date(sale.createdAt).toLocaleString('th-TH')}<br/><br/>

    <table>
      <thead><tr><th>รายการ</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ราคา</th><th style="text-align:right">รวม</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right"><b>รวม</b></td><td style="text-align:right"><b>฿${fmt(sale.total)}</b></td></tr>
        <tr><td colspan="3" style="text-align:right">จ่ายด้วย</td><td style="text-align:right">${sale.payment.method.toUpperCase()}</td></tr>
      </tfoot>
    </table>

    <div class="right" style="margin-top:8px">ขอบคุณที่อุดหนุน</div>
    <script>window.onload=()=>window.print();</script>
  </body>
  </html>`;
  w.document.write(html);
  w.document.close();
}

/* ---------- Reports (ง่ายๆ) ---------- */
$('#btnToday')?.addEventListener('click', ()=>{
  const sales = getSales().filter(s=> new Date(s.createdAt).toDateString() === new Date().toDateString());
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  $('#reportBox').textContent=`วันนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});
$('#btnMonth')?.addEventListener('click', ()=>{
  const now=new Date(); const m=now.getMonth(), y=now.getFullYear();
  const sales = getSales().filter(s=>{const d=new Date(s.createdAt);return d.getMonth()===m && d.getFullYear()===y});
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  $('#reportBox').textContent=`เดือนนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});

/* ---------- Settings: menu add / list ---------- */
function renderMenuTable(){
  const box = $('#menuTableBox');
  const menu = getMenu();
  if(!menu.length){ box.textContent='ยังไม่มีเมนู — เพิ่มด้านบนได้เลย'; return; }
  const CAT = {SET:'ชุดหมูกระทะ',AD:'Add-on',DW:'เครื่องดื่ม',PR:'โปรเครื่องดื่ม'};
  const rows = menu.map(m=>`
    <tr>
      <td>${m.id}</td>
      <td>${m.name}</td>
      <td>${CAT[m.cat]||m.cat}</td>
      <td style="text-align:right">฿${fmt(m.price)}</td>
      <td style="text-align:right"><button data-del="${m.id}" class="btn ghost">ลบ</button></td>
    </tr>`).join('');
  box.innerHTML = `
    <table>
      <thead><tr><th>รหัส</th><th>ชื่อ</th><th>หมวด</th><th style="text-align:right">ราคา</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  box.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id=btn.dataset.del;
      const menu = getMenu().filter(x=>x.id!==id);
      setMenu(menu); renderMenuTable(); renderMenu();
    });
  });
}
$('#btnAddMenu')?.addEventListener('click', ()=>{
  const name=$('#newName').value.trim();
  const price=Number($('#newPrice').value||0);
  const cat=$('#newCat').value;
  const code=($('#newCode').value.trim()||'X'+Math.random().toString(36).slice(2,6)).toUpperCase();
  if(!name||price<=0) return alert('กรอกชื่อ/ราคาให้ถูกต้อง');
  const menu = getMenu(); menu.push({id:code,name,cat,price}); setMenu(menu);
  $('#newName').value=''; $('#newPrice').value=''; $('#newCode').value='';
  renderMenuTable(); renderMenu();
});

/* ---------- Boot ---------- */
window.addEventListener('load', ()=>{
  renderMenu(); renderCart(); renderOpenBills(); renderMenuTable();
});
