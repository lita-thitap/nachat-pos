/* ========== Nachat POS (Frontend) — cash/scan + QR ========== */
/* STORAGE KEYS */
const K = {
  MENU: 'pos_menu',
  CART: 'pos_cart',
  BILLS: 'pos_bills',
  SALES: 'pos_sales',
  QR_TEXT: 'pos_qr_text'
};

/* Helpers */
const $ = sel => document.querySelector(sel);
const fmt = n => Number(n||0).toLocaleString('th-TH');

/* Menu seed */
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
const getMenu = () => JSON.parse(localStorage.getItem(K.MENU)||'[]');
const setMenu = v => localStorage.setItem(K.MENU, JSON.stringify(v));

const getCart = () => JSON.parse(localStorage.getItem(K.CART)||'[]');
const setCart = v => localStorage.setItem(K.CART, JSON.stringify(v));

const getBills= () => JSON.parse(localStorage.getItem(K.BILLS)||'[]');
const setBills= v => localStorage.setItem(K.BILLS, JSON.stringify(v));

const getSales= () => JSON.parse(localStorage.getItem(K.SALES)||'[]');
const setSales= v => localStorage.setItem(K.SALES, JSON.stringify(v));

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
    qtyInput.addEventListener('change',()=>{ it.qty=Math.max(1,Number(qtyInput.value||1)); setCart(cart); renderCart(); });
    priceInput.addEventListener('change',()=>{ it.price=Math.max(0,Number(priceInput.value||0)); setCart(cart); renderCart(); });
    row.querySelector('button').addEventListener('click',()=>{ cart.splice(i,1); setCart(cart); renderCart(); });
    list.appendChild(row);
  }
  totalEl.textContent = fmt(sum);
}

$('#btnClearCart')?.addEventListener('click', ()=>{ setCart([]); renderCart(); });

/* ---------- Open Bill ---------- */
$('#btnOpenBill')?.addEventListener('click', ()=>{
  const table = $('#inpTable').value.trim()||'N?';
  const staff = $('#inpStaff').value.trim()||'staff';
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');

  const total = cart.reduce((a,b)=>a+b.qty*b.price,0);
  const bill = { id: Date.now(), table, staff, items:cart, createdAt:new Date().toISOString(), total };
  const bills=getBills(); bills.push(bill); setBills(bills);
  setCart([]); renderCart();
  alert(`เปิดบิล โต๊ะ ${table} เรียบร้อย`);
  renderOpenBills();
});

$('#btnAddToBill')?.addEventListener('click', ()=>{
  const table = $('#inpTable').value.trim();
  if(!table) return alert('กรอกโต๊ะก่อน');
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const bills=getBills();
  let bill = bills.find(b=>b.table===table);
  if(!bill){ bill={id:Date.now(),table,staff:$('#inpStaff').value.trim()||'staff',items:[],createdAt:new Date().toISOString(),total:0}; bills.push(bill); }
  bill.items.push(...cart); bill.total = bill.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* bill list + pay modal */
function renderOpenBills(){
  const box = $('#openBills'); const bills = getBills(); box.innerHTML = '';
  if(!bills.length){ box.innerHTML='<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }

  for(const b of bills){
    const row = document.createElement('div');
    row.className='card bill-row';
    row.innerHTML = `
      <div>โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <button class="btn" data-view="${b.id}">ดูรายการ</button>
      <button class="btn primary" data-pay="${b.id}">ปิดบิล</button>
    `;
    row.querySelector('[data-view]')?.addEventListener('click',()=>{
      const lines = b.items.map(i=>`• ${i.name} × ${i.qty} = ฿${fmt(i.qty*i.price)}`).join('\n');
      alert(`รายการของโต๊ะ ${b.table}\n\n${lines}\n\nรวม ฿${fmt(b.total)}`);
    });
    row.querySelector('[data-pay]')?.addEventListener('click',()=>openPayModal(b.id));
    box.appendChild(row);
  }
}

/* Payment modal with items + QR */
let PAY_BILL=null;
function openPayModal(billId){
  const b = getBills().find(x=>x.id===billId); if(!b) return;
  PAY_BILL = b;

  // Fill basic
  $('#payTable').value = b.table;
  $('#payStaff').value = b.staff;
  $('#payTotal').value = `฿${fmt(b.total)}`;
  $('#payReceived').value = b.total;
  $('#payChange').value = '฿0';
  $('#payMethod').value = 'cash';

  // Items list
  const tb = $('#payItems');
  const rows = b.items.map(i=>`<tr><td>${i.name}</td><td style="width:70px;text-align:right">× ${i.qty}</td><td style="width:110px;text-align:right">฿${fmt(i.qty*i.price)}</td></tr>`).join('');
  tb.innerHTML = `
    <thead><tr><th>รายการ</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ยอด</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2" style="text-align:right">รวม</td><td style="text-align:right">฿${fmt(b.total)}</td></tr></tfoot>
  `;

  // Hide QR by default
  $('#qrZone').hidden = true;
  $('#qrImg').src=''; $('#qrNote').textContent='';

  $('#payModal').showModal();
}

// change received => change field
$('#payReceived')?.addEventListener('input', ()=>{
  const t = PAY_BILL?.total||0;
  const r = Number($('#payReceived').value||0);
  $('#payChange').value = `฿${fmt(Math.max(0,r-t))}`;
});

// change method => toggle QR
$('#payMethod')?.addEventListener('change', ()=>{
  const m = $('#payMethod').value;
  if(m==='scan'){
    showQR();
  }else{
    $('#qrZone').hidden = true;
    $('#qrImg').src=''; $('#qrNote').textContent='';
  }
});

function showQR(){
  const textBase = (localStorage.getItem(K.QR_TEXT)||'').trim();
  if(!textBase){
    alert('ยังไม่ได้ตั้งค่าข้อความ/เลขพร้อมเพย์สำหรับ QR (ไปที่ ตั้งค่าร้าน > ตั้งค่าการชำระเงิน)');
    $('#payMethod').value='cash';
    $('#qrZone').hidden = true;
    return;
  }
  const amt = PAY_BILL?.total || 0;
  // สร้างข้อความที่ใส่ใน QR
  const payload = `PAY TO: ${textBase}\nAMOUNT: ${amt} THB\nTABLE: ${PAY_BILL.table}`;
  // ใช้ Google Chart API ทำ QR
  const url = `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(payload)}`;
  $('#qrImg').src = url;
  $('#qrNote').textContent = `ยอดชำระ ฿${fmt(amt)}  |  ${textBase}`;
  $('#qrZone').hidden = false;
}

/* confirm pay */
$('#btnConfirmPay')?.addEventListener('click', (ev)=>{
  ev.preventDefault();
  if(!PAY_BILL) return;

  const method = $('#payMethod').value;
  const received = Number($('#payReceived').value||0);
  const total = PAY_BILL.total;

  if(method==='cash' && received < total){
    return alert('จำนวนเงินไม่พอ (เงินสด)');
  }

  const change = Math.max(0, received-total);

  // create sale payload
  const sale = {
    id: 'S'+Date.now(),
    table: PAY_BILL.table,
    staff: PAY_BILL.staff,
    items: PAY_BILL.items,
    total,
    createdAt: new Date().toISOString(),
    payment: { method, received, change, qrText: method==='scan' ? (localStorage.getItem(K.QR_TEXT)||'') : '' }
  };
  const sales = JSON.parse(localStorage.getItem(K.SALES)||'[]'); sales.push(sale);
  localStorage.setItem(K.SALES, JSON.stringify(sales));
  if(typeof enqueueSale==='function') enqueueSale(sale); // ให้ sync.js ยิงขึ้น Sheets

  let bills = getBills(); bills = bills.filter(x=>x.id!==PAY_BILL.id); setBills(bills);
  PAY_BILL=null;
  $('#payModal').close();
  alert('ปิดบิลสำเร็จ');
  renderOpenBills();
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
    <table style="width:100%;border-collapse:collapse">
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

/* ---------- Settings: QR text ---------- */
$('#btnSaveQR')?.addEventListener('click', ()=>{
  const t = ($('#qrText').value||'').trim();
  localStorage.setItem(K.QR_TEXT, t);
  alert('บันทึกข้อความ QR แล้ว');
});
window.addEventListener('load', ()=>{
  $('#qrText') && ($('#qrText').value = localStorage.getItem(K.QR_TEXT)||'');
});

/* ---------- Reports ---------- */
$('#btnToday')?.addEventListener('click', ()=>{
  const sales = JSON.parse(localStorage.getItem(K.SALES)||'[]')
    .filter(s=> new Date(s.createdAt).toDateString() === new Date().toDateString());
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  $('#reportBox').textContent=`วันนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});
$('#btnMonth')?.addEventListener('click', ()=>{
  const now=new Date(); const m=now.getMonth(), y=now.getFullYear();
  const sales = JSON.parse(localStorage.getItem(K.SALES)||'[]')
    .filter(s=>{const d=new Date(s.createdAt);return d.getMonth()===m && d.getFullYear()===y});
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  $('#reportBox').textContent=`เดือนนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});

/* ---------- Boot ---------- */
window.addEventListener('load', ()=>{
  renderMenu(); renderCart(); renderOpenBills(); renderMenuTable();
});
