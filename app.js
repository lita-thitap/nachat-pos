/* ========== Nachat POS (Frontend) ========== */
/* STORAGE KEYS */
const K = {
  MENU: 'pos_menu',
  CART: 'pos_cart',
  BILLS: 'pos_bills',
  SALES: 'pos_sales',
  EMP: 'pos_emp'
};

/* Helpers */
const $   = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n || 0).toLocaleString('th-TH');

// helper ผูก event แบบปลอดภัย (เลี่ยง ?. )
function on(sel, type, handler) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (el) el.addEventListener(type, handler);
  return el;
}

/* Menu seed (ครั้งแรก) */
function seedMenu() {
  if (localStorage.getItem(K.MENU)) return;
  const menu = [
    { id: 'Z99', name: 'ชุดรวมหมูถาด', cat: 'SET', price: 299 },
    { id: 'Z98', name: 'ชุดหมูทะเล', cat: 'SET', price: 299 },
    { id: 'A10', name: 'สันคอหมูสไลซ์ (ถาด)', cat: 'AD', price: 50 },
    { id: 'A20', name: 'เบคอนรมควัน (ถาด)', cat: 'AD', price: 50 },
    { id: 'A30', name: 'กุ้ง (ถาด)', cat: 'AD', price: 50 },
    { id: 'D10', name: 'น้ำเปล่า (ขวด)', cat: 'DW', price: 15 },
    { id: 'D20', name: 'น้ำแข็งถัง', cat: 'DW', price: 30 },
    { id: 'P30', name: 'โปรเบียร์ชิงฟัง 3 ขวด', cat: 'PR', price: 210 },
    { id: 'P60', name: 'โปรเบียร์ชิงฟัง 6 ขวด', cat: 'PR', price: 410 }
  ];
  localStorage.setItem(K.MENU, JSON.stringify(menu));
}
seedMenu();

/* State accessors */
const getMenu  = () => JSON.parse(localStorage.getItem(K.MENU)  || '[]');
const setMenu  = (v) => localStorage.setItem(K.MENU,  JSON.stringify(v));
const getCart  = () => JSON.parse(localStorage.getItem(K.CART)  || '[]');
const setCart  = (v) => localStorage.setItem(K.CART,  JSON.stringify(v));
const getBills = () => JSON.parse(localStorage.getItem(K.BILLS) || '[]');
const setBills = (v) => localStorage.setItem(K.BILLS, JSON.stringify(v));
const getSales = () => JSON.parse(localStorage.getItem(K.SALES) || '[]');
const setSales = (v) => localStorage.setItem(K.SALES, JSON.stringify(v));

/* ---------- Render Menu (POS) ---------- */
function groupByCat(arr) {
  const m = new Map();
  for (const it of arr) {
    if (!m.has(it.cat)) m.set(it.cat, []);
    m.get(it.cat).push(it);
  }
  return m;
}
function renderMenu() {
  const wrap = $('#menuPanels');
  if (!wrap) return;
  wrap.innerHTML = '';

  const menu  = getMenu();
  const bycat = groupByCat(menu);
  const CAT_NAMES = { SET: 'ชุดหมูกระทะ', AD: 'Add-on', DW: 'เครื่องดื่ม', PR: 'โปรเครื่องดื่ม' };

  for (const [cat, items] of bycat) {
    const col = document.createElement('div');
    col.className = 'card menu-column';
    col.innerHTML = `<h3>${CAT_NAMES[cat] || cat} <span class="muted">${items.length} รายการ</span></h3>`;

    for (const it of items) {
      const btn = document.createElement('div');
      btn.className = 'item';
      btn.innerHTML = `${it.name} <span class="price">฿${fmt(it.price)}</span>`;
      btn.addEventListener('click', () => {
        const cart = getCart();
        cart.push({ id: it.id, name: it.name, price: it.price, qty: 1 });
        setCart(cart);
        renderCart();
      });
      col.appendChild(btn);
    }
    wrap.appendChild(col);
  }
}

/* ---------- Cart ---------- */
function renderCart() {
  const list    = $('#cartList');
  const totalEl = $('#cartTotal');
  if (!list || !totalEl) return;

  const cart = getCart();
  if (!cart.length) {
    list.textContent = 'ยังไม่มีรายการ';
    totalEl.textContent = '0';
    return;
  }

  list.innerHTML = '';
  let sum = 0;
  for (let i = 0; i < cart.length; i++) {
    const it = cart[i];
    sum += it.price * it.qty;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div>${it.name}</div>
      <div style="max-width:120px"><input class="q" type="number" min="1" value="${it.qty}" /></div>
      <div style="max-width:120px"><input class="p" type="number" min="0" value="${it.price}" /></div>
      <div style="max-width:100px" class="pill">฿${fmt(it.qty * it.price)}</div>
      <div style="max-width:120px"><button class="btn ghost del">ลบ</button></div>
    `;

    const qtyInput   = row.querySelector('input.q');
    const priceInput = row.querySelector('input.p');
    const delBtn     = row.querySelector('button.del');

    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        it.qty = Math.max(1, Number(qtyInput.value || 1));
        setCart(cart);
        renderCart();
      });
    }
    if (priceInput) {
      priceInput.addEventListener('change', () => {
        it.price = Math.max(0, Number(priceInput.value || 0));
        setCart(cart);
        renderCart();
      });
    }
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        cart.splice(i, 1);
        setCart(cart);
        renderCart();
      });
    }
    list.appendChild(row);
  }
  totalEl.textContent = fmt(sum);
}

on('#btnClearCart', 'click', () => { setCart([]); renderCart(); });

/* ---------- Open Bill ---------- */
on('#btnOpenBill', 'click', () => {
  const table = ($('#inpTable') && $('#inpTable').value.trim()) || 'N?';
  const staff = ($('#inpStaff') && $('#inpStaff').value.trim()) || 'staff';
  const cart  = getCart();
  if (!cart.length) return alert('ตะกร้าค่าว่าง');

  const total = cart.reduce((a, b) => a + b.qty * b.price, 0);
  const bill  = { id: Date.now(), table, staff, items: cart, createdAt: new Date().toISOString(), total };

  const bills = getBills(); bills.push(bill); setBills(bills);
  setCart([]); renderCart();
  alert(`เปิดบิล โต๊ะ ${table} เรียบร้อย`);
  renderOpenBills();
});

on('#btnAddToBill', 'click', () => {
  const tableEl = $('#inpTable');
  const staffEl = $('#inpStaff');
  const table   = tableEl ? tableEl.value.trim() : '';
  if (!table) return alert('กรอกโต๊ะก่อน');

  const cart = getCart();
  if (!cart.length) return alert('ตะกร้าค่าว่าง');

  const bills = getBills();
  let bill = bills.find(b => b.table === table);
  if (!bill) {
    bill = {
      id: Date.now(),
      table,
      staff: (staffEl && staffEl.value.trim()) || 'staff',
      items: [],
      createdAt: new Date().toISOString(),
      total: 0
    };
    bills.push(bill);
  }
  bill.items.push(...cart);
  bill.total = bill.items.reduce((s, i) => s + i.qty * i.price, 0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* bill list + pay modal */
function renderOpenBills() {
  const box = $('#openBills');
  if (!box) return;
  const bills = getBills();
  box.innerHTML = '';

  if (!bills.length) {
    box.innerHTML = '<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>';
    return;
  }

  for (const b of bills) {
    const row = document.createElement('div');
    row.className = 'card bill-row';
    row.innerHTML = `
      <div>โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <button class="btn view" data-id="${b.id}">ดูรายการ</button>
      <button class="btn primary pay" data-id="${b.id}">ปิดบิล</button>
    `;

    const viewBtn = row.querySelector('button.view');
    const payBtn  = row.querySelector('button.pay');

    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        const lines = b.items.map(i => `• ${i.name} × ${i.qty} = ฿${fmt(i.qty * i.price)}`).join('\n');
        alert(`รายการของโต๊ะ ${b.table}\n\n${lines}\n\nรวม ฿${fmt(b.total)}`);
      });
    }
    if (payBtn) {
      payBtn.addEventListener('click', () => openPayModal(b.id));
    }
    box.appendChild(row);
  }
}

/* Payment modal */
let PAY_BILL = null;
function openPayModal(billId) {
  const b = getBills().find(x => x.id === billId);
  if (!b) return;

  PAY_BILL = b;
  const tEl = $('#payTable'), sEl = $('#payStaff'), totEl = $('#payTotal'),
        rEl = $('#payReceived'), cEl = $('#payChange'), mEl = $('#payMethod'),
        slipBox = $('#slipBox'), slip = $('#paySlip'), pre = $('#slipPreview'), dlg = $('#payModal');

  if (tEl)   tEl.value   = b.table;
  if (sEl)   sEl.value   = b.staff;
  if (totEl) totEl.value = `฿${fmt(b.total)}`;
  if (rEl)   rEl.value   = b.total;
  if (cEl)   cEl.value   = '฿0';
  if (mEl)   mEl.value   = 'cash';
  if (slipBox) slipBox.hidden = true;
  if (slip)     slip.value = '';
  if (pre)      pre.src = '';
  if (dlg && dlg.showModal) dlg.showModal(); else if (dlg) { dlg.setAttribute('open',''); dlg.style.display='block'; }
}

on('#payMethod', 'change', (e) => {
  const m = e && e.target ? e.target.value : 'cash';
  const slipBox = $('#slipBox');
  if (slipBox) slipBox.hidden = (m !== 'scan');
});

on('#payReceived', 'input', () => {
  const t = (PAY_BILL && PAY_BILL.total) || 0;
  const rEl = $('#payReceived'), cEl = $('#payChange');
  const r = rEl ? Number(rEl.value || 0) : 0;
  if (cEl) cEl.value = `฿${fmt(Math.max(0, r - t))}`;
});

on('#paySlip', 'change', (e) => {
  const files = e && e.target && e.target.files ? e.target.files : null;
  const f = files && files[0] ? files[0] : null;
  const pre = $('#slipPreview');
  if (!f) { if (pre) pre.src = ''; return; }
  const reader = new FileReader();
  reader.onload = () => { if (pre) pre.src = reader.result; };
  reader.readAsDataURL(f);
});

on('#btnConfirmPay', 'click', (ev) => {
  ev.preventDefault();
  if (!PAY_BILL) return;

  const method = $('#payMethod') ? $('#payMethod').value : 'cash';
  const received = $('#payReceived') ? Number($('#payReceived').value || 0) : 0;
  const total = PAY_BILL.total;

  if (method === 'cash' && received < total) {
    return alert('จำนวนเงินไม่พอ (เงินสด)');
  }

  const change = Math.max(0, received - total);
  let slipData = '';
  if (method === 'scan') {
    const pre = $('#slipPreview');
    slipData = pre ? (pre.src || '') : '';
    if (!slipData) return alert('กรุณาแนบสลิปถ้าเลือกโอน/สแกน');
  }

  // create sale
  const sale = {
    id: 'S' + Date.now(),
    table: PAY_BILL.table,
    staff: PAY_BILL.staff,
    items: PAY_BILL.items,
    total,
    createdAt: new Date().toISOString(),
    payment: { method, received, change, slipData }
  };
  const sales = getSales(); sales.push(sale); setSales(sales);

  // ส่งคิวไป Sheets ถ้ามี enqueueSale()
  if (typeof enqueueSale === 'function') enqueueSale(sale);

  // remove bill
  let bills = getBills();
  bills = bills.filter(x => x.id !== PAY_BILL.id);
  setBills(bills);

  const dlg = $('#payModal');
  if (dlg && dlg.close) dlg.close(); else if (dlg) { dlg.removeAttribute('open'); dlg.style.display='none'; }

  PAY_BILL = null;
  alert('ปิดบิลสำเร็จ');
  renderOpenBills();
});

/* ---------- Settings: menu add / list ---------- */
function renderMenuTable() {
  const box = $('#menuTableBox');
  if (!box) return;
  const menu = getMenu();
  if (!menu.length) { box.textContent = 'ยังไม่มีเมนู — เพิ่มด้านบนได้เลย'; return; }
  const CAT = { SET: 'ชุดหมูกระทะ', AD: 'Add-on', DW: 'เครื่องดื่ม', PR: 'โปรเครื่องดื่ม' };
  const rows = menu.map(m => `
    <tr>
      <td>${m.id}</td>
      <td>${m.name}</td>
      <td>${CAT[m.cat] || m.cat}</td>
      <td style="text-align:right">฿${fmt(m.price)}</td>
      <td style="text-align:right"><button data-del="${m.id}" class="btn ghost">ลบ</button></td>
    </tr>`).join('');
  box.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th>รหัส</th><th>ชื่อ</th><th>หมวด</th><th style="text-align:right">ราคา</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  box.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del');
      const menu = getMenu().filter(x => x.id !== id);
      setMenu(menu); renderMenuTable(); renderMenu();
    });
  });
}

on('#btnAddMenu', 'click', () => {
  const name  = $('#newName')  ? $('#newName').value.trim() : '';
  const price = $('#newPrice') ? Number($('#newPrice').value || 0) : 0;
  const cat   = $('#newCat')   ? $('#newCat').value : 'SET';
  const codeRaw = $('#newCode') ? $('#newCode').value.trim() : '';
  const code = (codeRaw || ('X' + Math.random().toString(36).slice(2, 6))).toUpperCase();

  if (!name || price <= 0) return alert('กรอกชื่อ/ราคาให้ถูกต้อง');

  const menu = getMenu(); menu.push({ id: code, name, cat, price }); setMenu(menu);

  if ($('#newName'))  $('#newName').value  = '';
  if ($('#newPrice')) $('#newPrice').value = '';
  if ($('#newCode'))  $('#newCode').value  = '';

  renderMenuTable(); renderMenu();
});

/* ---------- Reports (simple) ---------- */
on('#btnToday', 'click', () => {
  const today = new Date().toDateString();
  const sales = getSales().filter(s => new Date(s.createdAt).toDateString() === today);
  const sum   = sales.reduce((a, b) => a + b.total, 0);
  const box   = $('#reportBox'); if (box) box.textContent = `วันนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});

on('#btnMonth', 'click', () => {
  const now = new Date(); const m = now.getMonth(), y = now.getFullYear();
  const sales = getSales().filter(s => { const d = new Date(s.createdAt); return d.getMonth() === m && d.getFullYear() === y; });
  const sum   = sales.reduce((a, b) => a + b.total, 0);
  const box   = $('#reportBox'); if (box) box.textContent = `เดือนนี้ ${sales.length} บิล | รวม ฿${fmt(sum)}`;
});

/* ---------- Boot ---------- */
window.addEventListener('load', () => {
  renderMenu(); renderCart(); renderOpenBills(); renderMenuTable();
});
