/* ========== Nachat POS (Frontend) ========== */
const K = { MENU:'pos_menu', CART:'pos_cart', BILLS:'pos_bills', SALES:'pos_sales' };
const $ = s => document.querySelector(s);
const fmt = n => Number(n||0).toLocaleString('th-TH');

/* Seed menu */
(function(){
  if(localStorage.getItem(K.MENU)) return;
  localStorage.setItem(K.MENU, JSON.stringify([
    {id:'Z99',name:'ชุดรวมหมูถาด',cat:'SET',price:299},
    {id:'Z98',name:'ชุดหมูทะเล',cat:'SET',price:299},
    {id:'A10',name:'สันคอหมูสไลซ์ (ถาด)',cat:'AD',price:50},
    {id:'A20',name:'เบคอนรมควัน (ถาด)',cat:'AD',price:50},
    {id:'A30',name:'กุ้ง (ถาด)',cat:'AD',price:50},
    {id:'D10',name:'น้ำเปล่า (ขวด)',cat:'DW',price:15},
    {id:'D20',name:'น้ำแข็งถัง',cat:'DW',price:30},
    {id:'P30',name:'โปรเบียร์ 3 ขวด',cat:'PR',price:210},
    {id:'P60',name:'โปรเบียร์ 6 ขวด',cat:'PR',price:410},
  ]));
})();

/* State helpers */
const getMenu = () => JSON.parse(localStorage.getItem(K.MENU)||'[]');
const setMenu = v => localStorage.setItem(K.MENU, JSON.stringify(v));
const getCart = () => JSON.parse(localStorage.getItem(K.CART)||'[]');
const setCart = v => localStorage.setItem(K.CART, JSON.stringify(v));
const getBills= () => JSON.parse(localStorage.getItem(K.BILLS)||'[]');
const setBills= v => localStorage.setItem(K.BILLS, JSON.stringify(v));
const getSales= () => JSON.parse(localStorage.getItem(K.SALES)||'[]');
const setSales= v => localStorage.setItem(K.SALES, JSON.stringify(v));

/* POS: render menu */
function groupByCat(a){ const m=new Map(); a.forEach(it=>{if(!m.has(it.cat)) m.set(it.cat,[]); m.get(it.cat).push(it)}); return m; }
function renderMenu(){
  const box = $('#menuPanels'); if(!box) return; box.innerHTML='';
  const by = groupByCat(getMenu()); const CN={SET:'ชุดหมูกระทะ',AD:'Add-on',DW:'เครื่องดื่ม',PR:'โปรเครื่องดื่ม'};
  for(const [cat,items] of by){
    const col=document.createElement('div'); col.className='card menu-column';
    col.innerHTML=`<h3>${CN[cat]||cat} <span class="muted">${items.length} รายการ</span></h3>`;
    items.forEach(it=>{
      const btn=document.createElement('div'); btn.className='item';
      btn.innerHTML=`${it.name} <span class="price">฿${fmt(it.price)}</span>`;
      btn.addEventListener('click',()=>{ const c=getCart(); c.push({id:it.id,name:it.name,price:it.price,qty:1}); setCart(c); renderCart(); });
      col.appendChild(btn);
    });
    box.appendChild(col);
  }
}

/* Cart */
function renderCart(){
  const list=$('#cartList'), total=$('#cartTotal'); if(!list||!total) return;
  const cart=getCart(); if(!cart.length){ list.textContent='ยังไม่มีรายการ'; total.textContent='0'; return; }
  list.innerHTML=''; let sum=0;
  cart.forEach((it,i)=>{
    sum+=it.qty*it.price;
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`
      <div>${it.name}</div>
      <div style="max-width:120px"><input type="number" min="1" value="${it.qty}"></div>
      <div style="max-width:120px"><input type="number" min="0" value="${it.price}"></div>
      <div style="max-width:100px" class="pill">฿${fmt(it.qty*it.price)}</div>
      <div style="max-width:120px"><button class="btn ghost">ลบ</button></div>`;
    const [qty,price]=row.querySelectorAll('input');
    qty.addEventListener('change',()=>{ it.qty=Math.max(1,Number(qty.value||1)); setCart(cart); renderCart(); });
    price.addEventListener('change',()=>{ it.price=Math.max(0,Number(price.value||0)); setCart(cart); renderCart(); });
    row.querySelector('button').addEventListener('click',()=>{ cart.splice(i,1); setCart(cart); renderCart(); });
    list.appendChild(row);
  });
  total.textContent=fmt(sum);
}
$('#btnClearCart')?.addEventListener('click',()=>{ setCart([]); renderCart(); });

/* Open bill */
$('#btnOpenBill')?.addEventListener('click',()=>{
  const table=$('#inpTable').value.trim()||'N?';
  const staff=$('#inpStaff').value.trim()||'staff';
  const cart=getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const total=cart.reduce((a,b)=>a+b.qty*b.price,0);
  const b={id:Date.now(),table,staff,items:cart,createdAt:new Date().toISOString(),total};
  const bills=getBills(); bills.push(b); setBills(bills); setCart([]); renderCart(); renderOpenBills();
  alert(`เปิดบิล โต๊ะ ${table} แล้ว`);
});

$('#btnAddToBill')?.addEventListener('click',()=>{
  const table=$('#inpTable').value.trim(); if(!table) return alert('กรอกโต๊ะก่อน');
  const cart=getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const bills=getBills(); let b=bills.find(x=>x.table===table);
  if(!b){ b={id:Date.now(),table,staff:$('#inpStaff').value.trim()||'staff',items:[],createdAt:new Date().toISOString(),total:0}; bills.push(b); }
  b.items.push(...cart); b.total=b.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* Bills list (ดู/แก้ไข/ยกเลิก/ปิด) */
function renderOpenBills(){
  const box=$('#openBills'); if(!box) return; box.innerHTML='';
  const bills=getBills(); if(!bills.length){ box.innerHTML='<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }
  bills.forEach(b=>{
    const row=document.createElement('div'); row.className='card bill-row';
    row.innerHTML=`
      <div>โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <div class="bill-actions">
        <button class="btn" data-view="${b.id}">ดูรายการ</button>
        <button class="btn" data-edit="${b.id}">แก้ไขบิล</button>
        <button class="btn ghost" data-cancel="${b.id}">ยกเลิกบิล</button>
        <button class="btn primary" data-pay="${b.id}">ปิดบิล</button>
      </div>`;
    row.querySelector('[data-view]').addEventListener('click',()=>{
      alert(`รายการโต๊ะ ${b.table}\n\n${
        b.items.map(i=>`• ${i.name} × ${i.qty} = ฿${fmt(i.qty*i.price)}`).join('\n')
      }\n\nรวม ฿${fmt(b.total)}`);
    });
    row.querySelector('[data-edit]').addEventListener('click',()=>{
      setCart(b.items); $('#inpTable').value=b.table; $('#inpStaff').value=b.staff;
      setBills(getBills().filter(x=>x.id!==b.id)); renderCart(); renderOpenBills();
      document.querySelector('[data-tab="#pos"]')?.click();
    });
    row.querySelector('[data-cancel]').addEventListener('click',()=>{
      if(!confirm(`ยกเลิกบิลโต๊ะ ${b.table}?`)) return;
      setBills(getBills().filter(x=>x.id!==b.id)); renderOpenBills();
    });
    row.querySelector('[data-pay]').addEventListener('click',()=>openPayModal(b.id));
    box.appendChild(row);
  });
}

/* Pay modal */
let PAY_BILL=null;
function openPayModal(id){
  const b=getBills().find(x=>x.id===id); if(!b) return; PAY_BILL=b;
  $('#payTable').value=b.table; $('#payStaff').value=b.staff;
  $('#payTotal').value=`฿${fmt(b.total)}`; $('#payReceived').value=b.total; $('#payChange').value='฿0';
  $('#payMethod').value='cash'; $('#printReceiptChk').checked=false;
  $('#qrBox').hidden=true; $('#qrImg').src=''; $('#qrNote').textContent='';
  $('#payModal').showModal();
}
$('#payMethod')?.addEventListener('change',e=>{
  if(e.target.value==='scan'){
    const amt=PAY_BILL?.total||0; const QR_URL='qrcode.png';
    $('#qrImg').src=QR_URL;
    $('#qrNote').textContent=`KBANK · กรพพร ทรัพย์คงเดช พร้อมเพย์: 0813238287 ยอดที่ต้องโอน ฿${fmt(amt)}`;
    $('#qrBox').hidden=false; $('#payReceived').value=amt; $('#payChange').value='฿0';
  }else{ $('#qrBox').hidden=true; }
});
$('#payReceived')?.addEventListener('input',()=>{
  const t=PAY_BILL?.total||0, r=Number($('#payReceived').value||0);
  $('#payChange').value=`฿${fmt(Math.max(0,r-t))}`;
});

/* พิมพ์บิล */
function printReceipt(sale){
  const lines=(sale.items||[]).map(i=>`
    <tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">฿${fmt(i.price)}</td>
      <td style="text-align:right">฿${fmt(i.qty*i.price)}</td></tr>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title>
  <style>body{font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto;padding:16px;color:#111}
  h2{margin:0 0 6px} .muted{color:#666} table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{padding:6px;border-bottom:1px solid #eee} .right{text-align:right}</style></head><body>
  <h2>ณฉัตร | Nachat – POS</h2>
  <div class="muted">${new Date(sale.createdAt).toLocaleString('th-TH')} • โต๊ะ ${sale.table} • ${sale.staff}</div>
  <table><thead><tr><th>รายการ</th><th style="text-align:center">จำนวน</th>
    <th class="right">ราคา</th><th class="right">รวม</th></tr></thead>
  <tbody>${lines}</tbody><tfoot>
  <tr><td colspan="3" class="right"><b>ยอดสุทธิ</b></td><td class="right"><b>฿${fmt(sale.total)}</b></td></tr>
  <tr><td colspan="3" class="right">ชำระ (${sale.payment.method.toUpperCase()})</td><td class="right">฿${fmt(sale.payment.received||0)}</td></tr>
  <tr><td colspan="3" class="right">เงินทอน</td><td class="right">฿${fmt(sale.payment.change||0)}</td></tr>
  </tfoot></table><p class="muted right">ขอบคุณครับ/ค่ะ</p>
  <script>window.print();setTimeout(()=>window.close(),300);<\/script></body></html>`;
  const w=window.open('','_blank','width=420,height=600'); w.document.write(html); w.document.close();
}

/* ปิดบิล */
$('#btnConfirmPay')?.addEventListener('click',ev=>{
  ev.preventDefault(); if(!PAY_BILL) return;
  const method=$('#payMethod').value, received=Number($('#payReceived').value||0), total=PAY_BILL.total;
  if(method==='cash' && received<total) return alert('จำนวนเงินไม่พอ (เงินสด)');
  const sale={ id:'S'+Date.now(), table:PAY_BILL.table, staff:PAY_BILL.staff, items:PAY_BILL.items,
    total, createdAt:new Date().toISOString(), payment:{method,received,change:Math.max(0,received-total)} };
  const sales=getSales(); sales.push(sale); setSales(sales);
  if(typeof enqueueSale==='function') enqueueSale(sale); // ให้ sync.js จัดการคิวไป Sheets
  setBills(getBills().filter(x=>x.id!==PAY_BILL.id)); $('#payModal').close(); if($('#printReceiptChk').checked) printReceipt(sale);
  PAY_BILL=null; alert('ปิดบิลสำเร็จ'); renderOpenBills(); if(!$('#reports')?.hidden) renderReports();
});

/* Settings: เมนู */
function renderMenuTable(){
  const box = $('#menuTableBox'); if(!box) return;
  const menu = getMenu();
  if(!menu.length){ box.textContent='ยังไม่มีเมนู — เพิ่มด้านบนได้เลย'; return; }

  const CAT = {SET:'ชุดหมูกระทะ',AD:'Add-on',DW:'เครื่องดื่ม',PR:'โปรเครื่องดื่ม'};
  const catOpts = (sel) => `
    <option value="SET" ${sel==='SET'?'selected':''}>ชุดหมูกระทะ</option>
    <option value="AD"  ${sel==='AD'?'selected':''}>Add-on</option>
    <option value="DW"  ${sel==='DW'?'selected':''}>เครื่องดื่ม</option>
    <option value="PR"  ${sel==='PR'?'selected':''}>โปรเครื่องดื่ม</option>
  `;

  const rows = menu.map(m=>`
    <tr data-id="${m.id}">
      <td style="white-space:nowrap">${m.id}</td>
      <td>${m.name}</td>
      <td>${CAT[m.cat]||m.cat}</td>
      <td style="text-align:right">฿${fmt(m.price)}</td>
      <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end">
        <button class="btn" data-edit="${m.id}">แก้ไข</button>
        <button class="btn ghost" data-del="${m.id}">ลบ</button>
      </td>
    </tr>`).join('');

  box.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="width:120px">รหัส</th>
          <th>ชื่อ</th>
          <th style="width:160px">หมวด</th>
          <th style="width:120px;text-align:right">ราคา</th>
          <th style="width:190px"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  // ลบเมนู
  box.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const id = btn.dataset.del;
      const next = getMenu().filter(x=>x.id!==id);
      setMenu(next);
      renderMenuTable(); renderMenu();
    });
  });

  // แก้ไขเมนู (inline)
  box.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id  = btn.dataset.edit;
      const all = getMenu();
      const m   = all.find(x=>x.id===id);
      if(!m) return;

      const tr = box.querySelector(`tr[data-id="${id}"]`);
      tr.innerHTML = `
        <td><input class="edit-code" value="${m.id}" style="width:110px" /></td>
        <td><input class="edit-name" value="${m.name}" /></td>
        <td>
          <select class="edit-cat" style="width:160px">
            ${catOpts(m.cat)}
          </select>
        </td>
        <td style="text-align:right">
          <input class="edit-price" type="number" min="0" step="1" value="${m.price}" style="width:110px;text-align:right" />
        </td>
        <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end">
          <button class="btn" data-save="${id}">บันทึก</button>
          <button class="btn ghost" data-cancel="${id}">ยกเลิก</button>
        </td>
      `;

      // ยกเลิก = รีเฟรชตารางเดิม
      tr.querySelector('[data-cancel]').addEventListener('click', ()=>{
        renderMenuTable();
      });

      // บันทึกค่าใหม่
      tr.querySelector('[data-save]').addEventListener('click', ()=>{
        const newId    = tr.querySelector('.edit-code').value.trim().toUpperCase();
        const newName  = tr.querySelector('.edit-name').value.trim();
        const newCat   = tr.querySelector('.edit-cat').value;
        const newPrice = Number(tr.querySelector('.edit-price').value||0);

        if(!newId || !newName || !(newCat in CAT) || newPrice<0){
          alert('กรอกข้อมูลให้ถูกต้อง (รหัส/ชื่อ/หมวด/ราคา)'); return;
        }

        // กันรหัสซ้ำ (ยกเว้นกรณีไม่เปลี่ยนรหัส)
        if(newId!==id && all.some(x=>x.id===newId)){
          alert('รหัสเมนูซ้ำ กรุณาใช้รหัสอื่น'); return;
        }

        // อัปเดตใน array
        const idx = all.findIndex(x=>x.id===id);
        all[idx] = { id:newId, name:newName, cat:newCat, price:newPrice };

        setMenu(all);
        renderMenuTable();   // รีเฟรชตาราง
        renderMenu();        // รีเฟรชปุ่มสั่งในหน้า POS
      });
    });
  });
}
$('#btnAddMenu')?.addEventListener('click',()=>{
  const name=$('#newName').value.trim(), price=Number($('#newPrice').value||0), cat=$('#newCat').value;
  const code=($('#newCode').value.trim()||('X'+Math.random().toString(36).slice(2,6))).toUpperCase();
  if(!name||price<=0) return alert('กรอกชื่อ/ราคาให้ถูกต้อง');
  const menu=getMenu(); menu.push({id:code,name,cat,price}); setMenu(menu);
  $('#newName').value=''; $('#newPrice').value=''; $('#newCode').value=''; renderMenuTable(); renderMenu();
});

/* Reports */
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function getUIRange(){
  const p=$('#selPreset')?.value||'month', f=$('#dFrom'), t=$('#dTo'); const now=new Date(); let from,to;
  if(p==='custom'){ from=f?.value?startOfDay(f.value):new Date(0); to=t?.value?endOfDay(t.value):new Date(8640000000000000); return {from,to}; }
  if(p==='today'){ from=startOfDay(now); to=endOfDay(now); }
  else if(p==='7d'){ to=endOfDay(now); from=startOfDay(new Date(now-6*24*3600*1000)); }
  else { const y=now.getFullYear(), m=now.getMonth(); from=new Date(y,m,1); to=new Date(y,m+1,0,23,59,59,999); }
  if(f) f.value=from.toISOString().slice(0,10); if(t) t.value=to.toISOString().slice(0,10); return {from,to};
}
function renderReports(){
  const sales=getSales(), {from,to}=getUIRange();
  const rows=sales.filter(s=>{ const d=new Date(s.createdAt||s.updatedAt||Date.now()); return d>=from && d<=to; });
  const sum=rows.reduce((a,b)=>a+Number(b.total||0),0), avg=rows.length?sum/rows.length:0;
  $('#kpiSum') && ($('#kpiSum').textContent='฿'+fmt(sum)); $('#kpiBills') && ($('#kpiBills').textContent=rows.length);
  $('#kpiAvg') && ($('#kpiAvg').textContent='฿'+fmt(avg));
  const map=new Map(); rows.forEach(r=>(r.items||[]).forEach(i=>{ const k=i.name||i.id; map.set(k,(map.get(k)||0)+(Number(i.qty)||1)); }));
  const top=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5), ul=$('#topList');
  if(ul) ul.innerHTML=top.length?top.map(([n,q])=>`<li><span>${n}</span><b>${q}</b></li>`).join(''):'<div class="muted">ยังไม่มีข้อมูล</div>';
  const box=$('#salesTableBox'); if(box){ if(!rows.length){ box.innerHTML='<div class="muted">ยังไม่มีข้อมูล</div>'; return; }
    box.innerHTML=`<table><thead><tr><th>วันที่เวลา</th><th>โต๊ะ</th><th style="text-align:right">ยอดสุทธิ</th><th>ชำระ</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${new Date(r.createdAt||r.updatedAt).toLocaleString('th-TH')}</td>
    <td>${r.table||'-'}</td><td style="text-align:right">฿${fmt(r.total||0)}</td><td>${(r.payment?.method||'').toUpperCase()}</td></tr>`).join('')}</tbody></table>`; }
}
window.renderReports=renderReports;
$('#selPreset')?.addEventListener('change',renderReports); $('#dFrom')?.addEventListener('change',renderReports); $('#dTo')?.addEventListener('change',renderReports);

/* ====== ปุ่มล้างเฉพาะข้อมูลรายการขาย ====== */
document.getElementById('btnResetSales')?.addEventListener('click', () => {
  if (!confirm('ยืนยันล้างข้อมูล “รายการขาย” ทั้งหมดหรือไม่?\n(ข้อมูลในรายงานยอดขายจะถูกล้างออก แต่บิลและเมนูจะยังอยู่เหมือนเดิม)')) return;

  localStorage.removeItem(K.SALES); // ล้างเฉพาะข้อมูลยอดขาย
  alert('ล้างข้อมูล “รายการขาย” เรียบร้อยแล้ว ✅');

  // รีเฟรชหน้าแสดงผล
  try {
    renderReports();
  } catch (err) {
    console.warn('ไม่สามารถรีเฟรชรายงานได้', err);
  }
});

/* Boot */
window.addEventListener('load',()=>{ renderMenu(); renderCart(); renderOpenBills(); renderMenuTable(); renderReports(); });
