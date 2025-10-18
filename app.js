/* ============================================================
 * Nachat POS — App core (offline-first)
 * ============================================================
 * - State เก็บใน localStorage ('POS_STATE')
 * - เมนู: เพิ่ม/ลบ, แสดงตามหมวด
 * - ตะกร้า -> บิล (เปิด/เพิ่ม/ปิด/ดู)
 * - รายงาน: วันนี้ / เดือนนี้
 * - ไม่ใช้ $ เพื่อไม่ชนกับไฟล์อื่น (ใช้ qs/qsa แทน)
 * ============================================================
 */

/* ---------- Utils ---------- */
const qs  = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const money = (n) => '฿'+ Number(n||0).toLocaleString('th-TH');
const uid = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

/* ---------- State ---------- */
function getState(){
  try{ return JSON.parse(localStorage.getItem('POS_STATE')||'{}'); }
  catch(e){ return {}; }
}
function setState(st){
  localStorage.setItem('POS_STATE', JSON.stringify(st));
}

/* default categories */
const CATS = [
  {id:'SET', name:'ชุดหมูกระทะ'},
  {id:'AD',  name:'Add-on'},
  {id:'DW',  name:'เครื่องดื่ม'},
  {id:'PR',  name:'โปรโมชันเครื่องดื่ม'},
];

/* สร้าง state เริ่มต้น (เฉพาะครั้งแรก) */
(function bootstrap(){
  const st = getState();
  if(!st.menu){
    st.menu = [
      {id:uid(), code:'Z299A', name:'ชุดรวมหมูสุดคุ้ม', price:299, cat:'SET'},
      {id:uid(), code:'Z299B', name:'ชุดหมูอูมามิ',     price:299, cat:'SET'},
      {id:uid(), code:'P050A', name:'สันคอหมูสไลซ์ (ถาด)', price:50, cat:'AD'},
      {id:uid(), code:'P050B', name:'เบคอนรมควัน (ถาด)',  price:50, cat:'AD'},
      {id:uid(), code:'DW015', name:'น้ำเปล่า (ขวด)',   price:15, cat:'DW'},
      {id:uid(), code:'ICE030', name:'น้ำแข็งถัง',       price:30, cat:'DW'},
      {id:uid(), code:'PR210', name:'โปรเบียร์ 3 ขวด',  price:210, cat:'PR'},
      {id:uid(), code:'PR410', name:'โปรเบียร์ 6 ขวด',  price:410, cat:'PR'},
    ];
  }
  if(!st.cart)  st.cart  = [];               // [{code,name,price,qty}]
  if(!st.bills) st.bills = [];               // [{id,table,staff,status,items,openedAt,...}]
  if(!st.currentBillId) st.currentBillId = '';// id บิลปัจจุบัน (ถ้าอยากใช้)
  setState(st);
})();

/* ---------- Menu (POS) ---------- */
function groupByCat(items){
  const map = {};
  for(const c of CATS) map[c.id] = {cat:c, items:[]};
  for(const it of items){
    if(!map[it.cat]) map[it.cat] = {cat:{id:it.cat, name:it.cat}, items:[]};
    map[it.cat].items.push(it);
  }
  return Object.values(map).filter(g=>g.items.length);
}

function renderMenuPanels(){
  const box = qs('#menuPanels');
  if(!box) return;
  const st = getState();
  const groups = groupByCat(st.menu||[]);
  if(!groups.length){ box.innerHTML = `<div class="muted">ยังไม่มีเมนู – เพิ่มจากแท็บ “ตั้งค่าเมนู”</div>`; return; }

  box.innerHTML = groups.map(g=>{
    const head = `${g.cat.name} <span class="mini muted">${g.items.length} รายการ</span>`;
    const list = g.items.map(it=>`
      <button class="card" data-addcode="${it.code}" style="text-align:left">
        <div class="row" style="gap:8px;align-items:center">
          <div style="flex:1">${it.name}</div>
          <div class="pill">${money(it.price)}</div>
        </div>
      </button>
    `).join('');
    return `
      <div class="card">
        <h3>${head}</h3>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          ${list}
        </div>
      </div>
    `;
  }).join('');
}

/* เพิ่มสินค้าเข้าตะกร้า */
qs('#menuPanels')?.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-addcode]');
  if(!btn) return;
  const code = btn.dataset.addcode;
  const st = getState();
  const item = (st.menu||[]).find(m=>m.code===code);
  if(!item) return;
  const i = (st.cart||[]).findIndex(c=>c.code===code);
  if(i<0) st.cart.push({code:item.code, name:item.name, price:Number(item.price||0), qty:1});
  else    st.cart[i].qty += 1;
  setState(st);
  renderCart();
});

/* ---------- Cart ---------- */
function renderCart(){
  const list = qs('#cartList');
  const sumEl = qs('#cartTotal');
  if(!list || !sumEl) return;

  const st = getState();
  const cart = st.cart||[];
  if(!cart.length){
    list.innerHTML = 'ยังไม่มีรายการ';
    sumEl.textContent = '0';
    return;
  }
  const rows = cart.map(c=>`• ${c.name} x${c.qty} = ${money(c.qty*c.price)}`).join('<br/>');
  const total = cart.reduce((s,it)=> s + it.qty*it.price, 0);
  list.innerHTML = rows;
  sumEl.textContent = total.toLocaleString('th-TH');
}

qs('#btnClearCart')?.addEventListener('click', ()=>{
  const st = getState();
  st.cart = [];
  setState(st);
  renderCart();
});

qs('#btnAddToBill')?.addEventListener('click', ()=>{
  const st = getState();
  if(!(st.cart||[]).length){ alert('ยังไม่มีรายการในตะกร้า'); return; }

  // หากยังไม่มีบิลปัจจุบัน ให้บังคับเปิดก่อน
  let bill = st.bills.find(b=>b.id===st.currentBillId && (b.status||'open')==='open');
  if(!bill){
    const table = (qs('#inpTable')?.value||'').trim();
    const staff = (qs('#inpStaff')?.value||'').trim();
    if(!table){ alert('กรุณาระบุโต๊ะก่อน'); return; }
    bill = {
      id: uid(),
      table, staff,
      status:'open',
      items:[],
      openedAt: Date.now()
    };
    st.bills.push(bill);
    st.currentBillId = bill.id;
  }

  // ย้าย cart เข้า bill
  const map = new Map();
  (bill.items||[]).forEach(x=> map.set(x.code, {...x}));
  for(const c of st.cart){
    const k = c.code;
    if(!map.has(k)) map.set(k,{code:c.code,name:c.name,price:c.price,qty:0});
    const x = map.get(k);
    x.qty += c.qty;
    map.set(k,x);
  }
  bill.items = Array.from(map.values());
  st.cart = [];
  setState(st);
  renderCart();
  alert('เพิ่มลงบิลแล้ว');
  renderOpenBills();
});

/* ---------- Open Bill ---------- */
qs('#btnOpenBill')?.addEventListener('click', ()=>{
  const table = (qs('#inpTable')?.value||'').trim();
  const staff = (qs('#inpStaff')?.value||'').trim();
  if(!table){ alert('กรุณาระบุโต๊ะ'); return; }

  const st = getState();
  // ถ้ามีบิลโต๊ะเดียวกันที่ยังเปิดอยู่ไม่ให้ซ้ำ
  const dup = (st.bills||[]).find(b=> (b.status||'open')==='open' && (b.table||'')===table);
  if(dup){ alert(`โต๊ะ ${table} มีบิลเปิดค้างอยู่แล้ว`); return; }

  const b = {
    id: uid(),
    table, staff,
    status:'open',
    items:[],
    openedAt: Date.now()
  };
  st.bills.push(b);
  st.currentBillId = b.id;
  setState(st);
  alert(`เปิดบิลโต๊ะ ${table} แล้ว`);
  renderOpenBills();
});

function sumBill(bill){
  if (Array.isArray(bill.items) && bill.items.length){
    return bill.items.reduce((s,it)=> s + (Number(it.qty||0)*Number(it.price||0)), 0);
  }
  return Number(bill.total||0);
}

function viewBill(billId){
  const st = getState();
  const b = (st.bills||[]).find(x=>x.id===billId);
  if(!b){ alert('ไม่พบบิล'); return; }
  const lines = (b.items||[]).map(it=>`• ${it.name} x${it.qty} = ${money(it.qty*it.price)}`).join('\n');
  alert(`โต๊ะ ${b.table||'-'} · ${b.staff||'-'}\n\n${lines||'(ยังไม่มีรายการ)'}\n\nรวม ${money(sumBill(b))}`);
}

function closeBill(billId){
  const st = getState();
  const idx = (st.bills||[]).findIndex(x=>x.id===billId);
  if(idx<0){ alert('ไม่พบบิล'); return; }
  const b = st.bills[idx];
  const total = sumBill(b);

  let method = prompt('วิธีชำระ (CASH / TRANSFER / QR / CARD):', 'CASH');
  if(!method) return;
  method = method.toUpperCase();

  let received = total;
  if(method==='CASH'){
    const raw = prompt(`รับเงินมาเท่าไหร่? (รวม ${money(total)})`, String(total));
    if(raw===null) return;
    received = Number(raw||0);
    if(isNaN(received) || received<total){ alert('รับเงินน้อยกว่ายอดรวม'); return; }
  }
  const change = Math.max(0, received-total);

  st.bills[idx] = {
    ...b,
    status:'closed',
    pay_method:method,
    received, change,
    total,
    closedAt: Date.now()
  };

  // ถ้ามีระบบ sync คิว -> push เข้า QUEUE ที่นี่ได้ (ปล่อยว่างเพื่อไม่ชนกับไฟล์ sync.js)
  setState(st);
  alert(`ปิดบิลสำเร็จ\nวิธีชำระ: ${method}\nรวม: ${money(total)}\nรับมา: ${money(received)}\nทอน: ${money(change)}`);
  renderOpenBills();
  renderReports();
}

function renderOpenBills(){
  const box = qs('#openBills');
  if(!box) return;
  const st = getState();
  const bills = (st.bills||[]).filter(b => (b.status||'open')==='open');

  if(!bills.length){ box.innerHTML = `<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>`; return; }

  box.innerHTML = bills.map(b=>{
    const title = `โต๊ะ ${b.table||'-'} • ${b.staff||'-'}`;
    return `
      <div class="card" style="margin-bottom:10px">
        <div class="row" style="gap:10px;align-items:center">
          <div class="pill">${title}</div>
          <div class="pill" style="margin-left:auto">รวม ${money(sumBill(b))}</div>
          <button class="btn" data-action="view" data-id="${b.id}">ดูรายการ</button>
          <button class="btn primary" data-action="pay" data-id="${b.id}">ปิดบิล</button>
        </div>
      </div>
    `;
  }).join('');
}

qs('#openBills')?.addEventListener('click',(e)=>{
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const id = btn.dataset.id;
  if(btn.dataset.action==='view') viewBill(id);
  if(btn.dataset.action==='pay')  closeBill(id);
});

/* ---------- Settings: Menu ---------- */
function renderMenuTable(){
  const box = qs('#menuTableBox');
  if(!box) return;

  const st = getState();
  const q = (qs('#menuSearch')?.value||'').trim().toLowerCase();
  const f = (qs('#menuFilter')?.value||'').trim();

  let rows = st.menu||[];
  if(f) rows = rows.filter(x=>x.cat===f);
  if(q) rows = rows.filter(x=> (x.name||'').toLowerCase().includes(q) || (x.code||'').toLowerCase().includes(q));

  if(!rows.length){ box.innerHTML = `<div class="muted">ไม่พบเมนูที่ตรงเงื่อนไข</div>`; return; }

  const head = `
    <table>
      <thead>
        <tr>
          <th>ชื่อเมนู</th>
          <th class="col-code">รหัส</th>
          <th class="col-price">ราคา</th>
          <th>หมวด</th>
          <th style="width:100px"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(x=>`
          <tr>
            <td>${x.name}</td>
            <td>${x.code}</td>
            <td>${money(x.price)}</td>
            <td>${(CATS.find(c=>c.id===x.cat)?.name)||x.cat}</td>
            <td class="actions">
              <button class="btn danger" data-del="${x.id}">ลบ</button>
            </td>
          </tr>
       
