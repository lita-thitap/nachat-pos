/* Nachat POS - minimal working cart/bill logic
   Drop-in replacement for your current app.js
   - Click menu item -> add to CART
   - Open bill -> Add cart to current bill
   - Persist to localStorage
*/

const LS_MENU   = 'NACHAT_MENU_V1';
const LS_CART   = 'NACHAT_CART_V1';
const LS_BILLS  = 'NACHAT_BILLS_V1';
const LS_STATE  = 'NACHAT_STATE_V1'; // openBillId, staff, table

const $ = (sel, el=document)=>el.querySelector(sel);
const $$ = (sel, el=document)=>[...el.querySelectorAll(sel)];

// ---------- State ----------
let MENU  = load(LS_MENU)  || [];        // [{code,name,price,cat}]
let CART  = load(LS_CART)  || [];        // [{code,name,price,qty}]
let BILLS = load(LS_BILLS) || [];        // [{id,table,staff,status,items,total,createdAt,updatedAt}]
let STATE = load(LS_STATE) || { openBillId:null, staff:'', table:'' };

// ---------- Utils ----------
function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } }
function money(n){ return Number(n||0).toLocaleString('th-TH'); }
function nowISO(){ return new Date().toISOString(); }
function uid(){ return Math.random().toString(36).slice(2,10); }

// ---------- Seed example menu if empty ----------
if (MENU.length===0) {
  MENU = [
    // SET
    { code:'SET01', name:'ชุดหมูกระทะ (2–3 คน)', price:299, cat:'SET' },
    { code:'SET02', name:'ชุดหมูกระทะ (4 คน)',   price:499, cat:'SET' },
    // AD
    { code:'AD01',  name:'สันคอหมูสไลซ์ (ถาด)',  price:79,  cat:'AD'  },
    { code:'AD02',  name:'เบคอนรมควัน (ถาด)',    price:89,  cat:'AD'  },
    { code:'AD03',  name:'กุ้ง (ถาด)',            price:99,  cat:'AD'  },
    // DW
    { code:'DW01',  name:'น้ำเปล่า (ขวด)',        price:15,  cat:'DW'  },
    { code:'DW02',  name:'น้ำแข็งถัง',            price:30,  cat:'DW'  },
    // PR
    { code:'PR01',  name:'โปรเบียร์ 3 ขวด',      price:210, cat:'PR'  },
    { code:'PR02',  name:'โปรเบียร์ 6 ขวด',      price:410, cat:'PR'  },
  ];
  save(LS_MENU, MENU);
}

// ---------- Render Menu (panel by category) ----------
function groupBy(arr, key){ return arr.reduce((m,x)=>((m[x[key]]??=[]).push(x),m),{}); }

function renderMenu(){
  const panels = $('#menuPanels');
  if (!panels) return;
  const groups = groupBy(MENU, 'cat');
  const order = ['SET','AD','DW','PR'];
  panels.innerHTML = '';

  order.forEach(cat=>{
    const items = groups[cat]||[];
    if (!items.length) return;

    const card = document.createElement('div');
    card.className = 'card';
    const h3 = document.createElement('h3');
    h3.textContent = catName(cat) + `  ${items.length} รายการ`;
    card.appendChild(h3);

    const box = document.createElement('div');
    box.style.display = 'grid';
    box.style.gap = '8px';

    items.forEach(it=>{
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.justifyContent = 'space-between';
      btn.style.display = 'flex';
      btn.style.width = '100%';
      btn.innerHTML = `<span>${escapeHTML(it.name)}</span><span class="pill">฿${money(it.price)}</span>`;
      btn.addEventListener('click', ()=> addToCart(it));
      box.appendChild(btn);
    });

    card.appendChild(box);
    panels.appendChild(card);
  });
}

function catName(c){
  return ({SET:'ชุดหมูกระทะ', AD:'Add-on', DW:'เครื่องดื่ม', PR:'โปรเครื่องดื่ม'})[c] || c;
}
function escapeHTML(s){ return s?.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// ---------- Cart ----------
function addToCart(item){
  const row = CART.find(x=>x.code===item.code);
  if (row) row.qty += 1;
  else CART.push({ code:item.code, name:item.name, price:item.price, qty:1 });
  save(LS_CART, CART);
  renderCart();
}

function clearCart(){
  CART = [];
  save(LS_CART, CART);
  renderCart();
}

function cartTotal(){
  return CART.reduce((s,x)=>s + x.price*x.qty, 0);
}

function renderCart(){
  const list = $('#cartList');
  const total = $('#cartTotal');
  if (!list) return;

  if (CART.length===0){
    list.textContent = 'ยังไม่มีรายการ';
  }else{
    const table = document.createElement('table');
    table.innerHTML = `
      <thead><tr><th>รายการ</th><th>จำนวน</th><th>ราคา</th></tr></thead>
      <tbody></tbody>
    `;
    const tb = $('tbody', table);
    CART.forEach((x,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(x.name)}</td>
        <td>
          <button class="pill" data-a="dec">-</button>
          <span style="padding:0 8px">${x.qty}</span>
          <button class="pill" data-a="inc">+</button>
          <button class="pill" data-a="del" style="margin-left:6px">ลบ</button>
        </td>
        <td>฿${money(x.price*x.qty)}</td>
      `;
      tb.appendChild(tr);
      tr.querySelector('[data-a="inc"]').onclick = ()=>{ x.qty++; save(LS_CART,CART); renderCart(); };
      tr.querySelector('[data-a="dec"]').onclick = ()=>{ x.qty=Math.max(1,x.qty-1); save(LS_CART,CART); renderCart(); };
      tr.querySelector('[data-a="del"]').onclick = ()=>{ CART.splice(i,1); save(LS_CART,CART); renderCart(); };
    });
    list.innerHTML = '';
    list.appendChild(table);
  }
  if (total) total.textContent = money(cartTotal());
}

// ---------- Bills ----------
function openBill(){
  const table = $('#inpTable')?.value?.trim();
  const staff = $('#inpStaff')?.value?.trim();
  if (!table){ alert('กรุณากรอกหมายเลขโต๊ะ'); return; }
  if (!staff){ alert('กรุณากรอกชื่อพนักงาน'); return; }

  const id = uid();
  const bill = {
    id, table, staff,
    status:'open',
    items:[],
    total:0,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  BILLS.push(bill);
  STATE.openBillId = id;
  STATE.table = table; STATE.staff = staff;
  save(LS_BILLS,BILLS); save(LS_STATE,STATE);
  renderOpenBills();
  alert('เปิดบิลโต๊ะ '+table+' เรียบร้อย');
}

function addCartToCurrentBill(){
  if (CART.length===0){ alert('ตะกร้าว่าง'); return; }
  const bill = BILLS.find(b=>b.id===STATE.openBillId && b.status==='open');
  if (!bill){ alert('กรุณา “เปิดบิล” ก่อน'); return; }

  // merge
  CART.forEach(x=>{
    const row = bill.items.find(i=>i.code===x.code);
    if (row) row.qty += x.qty;
    else bill.items.push({ code:x.code, name:x.name, price:x.price, qty:x.qty });
  });
  bill.total = bill.items.reduce((s,x)=>s+x.price*x.qty,0);
  bill.updatedAt = nowISO();

  clearCart();
  save(LS_BILLS,BILLS);
  renderOpenBills();
  alert('เพิ่มลงบิลโต๊ะ '+bill.table+' เรียบร้อย');
}

function renderOpenBills(){
  const box = $('#openBills');
  if (!box) return;
  const open = BILLS.filter(b=>b.status==='open');
  if (open.length===0){ box.textContent = 'ยังไม่มีบิลที่เปิดอยู่'; return; }

  box.innerHTML = '';
  open.forEach(b=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div><b>โต๊ะ ${escapeHTML(b.table)}</b> • ${escapeHTML(b.staff)}</div>
        <div class="pill">รวม ฿${money(b.total)}</div>
      </div>
    `;
    box.appendChild(div);
  });
}

// ---------- Wire UI ----------
function initButtons(){
  $('#btnOpenBill')?.addEventListener('click', openBill);
  $('#btnAddToBill')?.addEventListener('click', addCartToCurrentBill);
  $('#btnClearCart')?.addEventListener('click', clearCart);
  $('#btnToday')?.addEventListener('click', ()=>alert('สรุปรายวัน: ยังไม่ทำในตัวอย่างนี้'));
  $('#btnMonth')?.addEventListener('click', ()=>alert('สรุปรายเดือน: ยังไม่ทำในตัวอย่างนี้'));
  $('#btnPullNow')?.addEventListener('click', ()=>alert('ดึงข้อมูลคลาวด์: โปรดตั้งค่าใน sync.js'));
}

// ---------- Start ----------
renderMenu();
renderCart();
renderOpenBills();
initButtons();
