/* ========== Nachat POS (Frontend) ========== */
/* STORAGE KEYS */
const K = {
  MENU: 'pos_menu',
  CART: 'pos_cart',
  BILLS: 'pos_bills',
  SALES: 'pos_sales',
  EMP: 'pos_emp',
  WEBAPP: 'POS_WEBAPP_URL',
  QR_URL: 'POS_QR_URL',
  PAY_NOTE: 'POS_PAY_NOTE',
};

/* Helpers */
function $(sel){ return document.querySelector(sel); }
function on(sel, evt, fn){ const el=$(sel); if(el) el.addEventListener(evt,fn); }
function fmt(n){ return Number(n||0).toLocaleString('th-TH'); }

/* Menu seed (ครั้งแรก) */
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
const setMenu  = (v) => localStorage.setItem(K.MENU, JSON.stringify(v));
const getCart  = () => JSON.parse(localStorage.getItem(K.CART)||'[]');
const setCart  = (v) => localStorage.setItem(K.CART, JSON.stringify(v));
const getBills = () => JSON.parse(localStorage.getItem(K.BILLS)||'[]');
const setBills = (v) => localStorage.setItem(K.BILLS, JSON.stringify(v));
const getSales = () => JSON.parse(localStorage.getItem(K.SALES)||'[]');
const setSales = (v) => localStorage.setItem(K.SALES, JSON.stringify(v));

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
  const wrap = $('#menuPanels'); if(!wrap) return; wrap.innerHTML = '';
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
  const list = $('#cartList'), totalEl = $('#cartTotal'); if(!list||!totalEl) return;
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
    const nInputs = row.querySelectorAll('input[type=number]');
    const qtyInput = nInputs[0];
    const priceInput = nInputs[1];

    qtyInput.addEventListener('change',()=>{ it.qty=Math.max(1,Number(qtyInput.value||1)); setCart(cart); renderCart(); });
    priceInput.addEventListener('change',()=>{ it.price=Math.max(0,Number(priceInput.value||0)); setCart(cart); renderCart(); });
    row.querySelector('button').addEventListener('click',()=>{ cart.splice(i,1); setCart(cart); renderCart(); });
    list.appendChild(row);
  }
  totalEl.textContent = fmt(sum);
}

on('#btnClearCart','click', ()=>{ setCart([]); renderCart(); });

/* ---------- Open Bill ---------- */
on('#btnOpenBill','click', ()=>{
  const tableEl=$('#inpTable'), staffEl=$('#inpStaff');
  const table = tableEl? tableEl.value.trim() : 'N?';
  const staff = staffEl? staffEl.value.trim() : 'staff';
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');

  const total = cart.reduce((a,b)=>a+b.qty*b.price,0);
  const bill = { id: Date.now(), table, staff, items:cart, createdAt:new Date().toISOString(), total };
  const bills=getBills(); bills.push(bill); setBills(bills);
  setCart([]); renderCart();
  alert(`เปิดบิล โต๊ะ ${table} เรียบร้อย`);
  renderOpenBills();
});

on('#btnAddToBill','click', ()=>{
  const tableEl=$('#inpTable'); const table = tableEl? tableEl.value.trim() : '';
  if(!table) return alert('กรอกโต๊ะก่อน');
  const cart = getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const bills=getBills();
  let bill = bills.find(b=>b.table===table);
  if(!bill){ bill={id:Date.now(),table,staff:($('#inpStaff')? $('#inpStaff').value.trim():'staff')||'staff',items:[],createdAt:new Date().toISOString(),total:0}; bills.push(bill); }
  bill.items.push(...cart); bill.total = bill.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* bill list + pay modal */
function renderOpenBills(){
  const box = $('#openBills'); if(!box) return; const bills = getBills(); box.innerHTML = '';
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
    row.querySelector('[data-view]').addEventListener('click',()=>{
      const lines = b.items.map(i=>`• ${i.name} × ${i.qty} = ฿${fmt(i.qty*i.price)}`).join('\n');
      alert(`รายการของโต๊ะ ${b.table}\n\n${lines}\n\nรวม ฿${fmt(b.total)}`);
    });
    row.querySelector('[data-pay]').addEventListener('click',()=>openPayModal(b.id));
    box.appendChild(row);
  }
}

/* Payment modal */
let PAY_BILL=null;
function openPayModal(billId){
  const b = getBills().find(x=>x.id===billId); if(!b) return;

  PAY_BILL = b;
  const tEl=$('#payTable'), sEl=$('#payStaff'), totEl=$('#payTotal'),
        rEl=$('#payReceived'), cEl=$('#payChange'), mEl=$('#payMethod'),
        qrBox=$('#qrBox'), qrImg=$('#qrImg'), qrNote=$('#qrNote'), dlg=$('#payModal');

  if(tEl)   tEl.value   = b.table;
  if(sEl)   sEl.value   = b.staff;
  if(totEl) totEl.value = `฿${fmt(b.total)}`;
  if(rEl)   rEl.value   = b.total;
  if(cEl)   cEl.value   = '฿0';
  if(mEl)   mEl.value   = 'cash';

  // โหลด QR ตั้งค่าจาก localStorage
  const qrUrl  = localStorage.getItem(K.QR_URL)   || '';
  const qrText = localStorage.getItem(K.PAY_NOTE) || '';
  if(qrImg)  qrImg.src = qrUrl;
  if(qrNote) qrNote.textContent = qrText;

  if(qrBox) qrBox.hidden = true; // โชว์เมื่อเลือก scan

  if(dlg && dlg.showModal) dlg.showModal(); else if(dlg){ dlg.setAttribute('open',''); dlg.style.display='block'; }
}

on('#payMethod','change',(e)=>{
  const m = e && e.target ? e.target.value : 'cash';
  const qrBox = $('#qrBox'); if(qrBox) qrBox.hidden = (m!=='scan');
});
on('#payReceived','input',()=>{
  const t = PAY_BILL ? PAY_BILL.total : 0;
  const r = $('#payReceived') ? Number($('#payReceived').value||0) : 0;
  const cEl = $('#payChange'); if(cEl) cEl.value = `฿${fmt(Math.max(0,r-t))}`;
});

on('#btnConfirmPay','click',(ev)=>{
  ev.preventDefault();
  if(!PAY_BILL) return;

  const method   = $('#payMethod')   ? $('#payMethod').value : 'cash';
  const received = $('#payReceived') ? Number($('#payReceived').value||0) : 0;
  const total    = PAY_BILL.total;

  if(method==='cash' && received < total){
    return alert('จำนวนเงินไม่พอ (เงินสด)');
  }

  const change = Math.max(0, received-total);

  // บันทึกการขาย
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

  // ถ้ามี sync.js ให้ต่อคิวส่ง
  if(typeof enqueueSale==='function') enqueueSale(sale);

  // ลบบิลที่ปิดไป
  let bills = getBills();
  bills = bills.filter(x=>x.id!==PAY_BILL.id);
  setBills(bills);

  const dlg=$('#payModal');
  if(dlg && dlg.close) dlg.close(); else if(dlg){ dlg.removeAttribute('open'); dlg.style.display='none'; }
  PAY_BILL=null;
  alert('ปิดบิลสำเร็จ');
  renderOpenBills();
});

/* ---------- Settings: menu add / list ---------- */
function renderMenuTable(){
  const box = $('#menuTableBox'); if(!box) return;
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
on('#btnAddMenu','click', ()=>{
  const nameEl=$('#newName'), priceEl=$('#newPrice'), catEl=$('#newCat'), codeEl=$('#newCode');
  const name=nameEl?nameEl.value.trim():'';
  const price=priceEl?Number(priceEl.value||0):0;
  const cat=catEl?catEl.value:'SET';
  const code=(codeEl?codeEl.value.trim():'')||('X'+Math.random().toString(36).slice(2,6)).toUpperCase();
  if(!name||price<=0) return alert('กรอกชื่อ/ราคาให้ถูกต้อง');
  const menu = getMenu(); menu.push({id:code,name,cat,price}); setMenu(menu);
  if(nameEl) nameEl.value=''; if(priceEl) priceEl.value=''; if(codeEl) codeEl.value='';
  renderMenuTable(); renderMenu();
});

/* ---------- Settings: Cloud & QR ---------- */
on('#btnSaveUrl','click', ()=>{
  const urlEl=$('#inpWebAppUrl'); const url=urlEl?urlEl.value.trim():'';
  if(!url) return alert('วาง Web App URL ก่อน');
  localStorage.setItem(K.WEBAPP,url);
  alert('บันทึกแล้ว');
});
on('#btnTest','click', async ()=>{
  const url = localStorage.getItem(K.WEBAPP)||'';
  if(!url) return alert('ยังไม่ตั้งค่า URL');
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ping:true})});
    alert('ส่งคำขอเรียบร้อย: '+res.status);
  }catch(e){ alert('เชื่อมต่อไม่สำเร็จ'); }
});
on('#btnClearLocal','click', ()=>{
  if(confirm('ล้างข้อมูลในเครื่องนี้ทั้งหมด?')){ localStorage.clear(); location.reload(); }
});

// QR settings
function hydrateQrSettingsPreview(){
  const qr = localStorage.getItem(K.QR_URL)||'';
  const note = localStorage.getItem(K.PAY_NOTE)||'';
  const qe = $('#qrPreviewSetting'), ne = $('#qrNoteSetting');
  if(qe) qe.src = qr || '';
  if(ne) ne.textContent = note || '';
  const iq = $('#inpQrUrl'), ip = $('#inpPayNote');
  if(iq) iq.value = qr; if(ip) ip.value = note;
}
on('#btnSaveQr','click', ()=>{
  const url = $('#inpQrUrl')? $('#inpQrUrl').value.trim() : '';
  const note= $('#inpPayNote')? $('#inpPayNote').value.trim(): '';
  localStorage.setItem(K.QR_URL,url);
  localStorage.setItem(K.PAY_NOTE,note);
  hydrateQrSettingsPreview();
  alert('บันทึก QR แล้ว');
});

/* ---------- Reports (simple) ---------- */
on('#btnToday','click', ()=>{
  const sales = getSales().filter(s=> new Date(s.createdAt).toDateString() === new Date().toDateString());
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  const box=$('#reportBox'); if(box) box.textContent=`วันนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});
on('#btnMonth','click', ()=>{
  const now=new Date(); const m=now.getMonth(), y=now.getFullYear();
  const sales = getSales().filter(s=>{const d=new Date(s.createdAt);return d.getMonth()===m && d.getFullYear()===y});
  const sum   = sales.reduce((a,b)=>a+b.total,0);
  const box=$('#reportBox'); if(box) box.textContent=`เดือนนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});

/* ---------- Boot ---------- */
window.addEventListener('load', ()=>{
  renderMenu(); renderCart(); renderOpenBills(); renderMenuTable();
  hydrateQrSettingsPreview();
});
