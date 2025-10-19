/* ========== Nachat POS (Frontend) ========== */
/* STORAGE KEYS */
const K = {
  MENU:'pos_menu',
  CART:'pos_cart',
  BILLS:'pos_bills',
  SALES:'pos_sales',
  WEBAPP:'POS_WEBAPP_URL',
  SYNC_MODE:'POS_SYNC_MODE', // auto | manual
};

/* ===== QR ของร้าน (แก้ตรงนี้) ===== */
const QR = {
  url: 'qr.png',                         // ใส่ไฟล์/URL รูป QR ของร้าน
  note: 'พร้อมเพย์ 081-xxxxxxx (KBANK)' // ข้อความแสดงใต้ภาพ
};

/* Helpers */
const $ = s => document.querySelector(s);
const on = (s,ev,fn)=>{const el=$(s); if(el) el.addEventListener(ev,fn);};
const fmt = n => Number(n||0).toLocaleString('th-TH');

/* Seed menu ครั้งแรก */
(function seedMenu(){
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
})();

/* State helpers */
const getMenu  = () => JSON.parse(localStorage.getItem(K.MENU)||'[]');
const setMenu  = v => localStorage.setItem(K.MENU, JSON.stringify(v));
const getCart  = () => JSON.parse(localStorage.getItem(K.CART)||'[]');
const setCart  = v => localStorage.setItem(K.CART, JSON.stringify(v));
const getBills = () => JSON.parse(localStorage.getItem(K.BILLS)||'[]');
const setBills = v => localStorage.setItem(K.BILLS, JSON.stringify(v));
const getSales = () => JSON.parse(localStorage.getItem(K.SALES)||'[]');
const setSales = v => localStorage.setItem(K.SALES, JSON.stringify(v));

/* ---------- POS: render เมนู & ตะกร้า ---------- */
function groupByCat(arr){
  const m=new Map();
  for(const it of arr){ if(!m.has(it.cat)) m.set(it.cat,[]); m.get(it.cat).push(it); }
  return m;
}
function renderMenu(){
  const wrap = $('#menuPanels'); if(!wrap) return; wrap.innerHTML='';
  const bycat=groupByCat(getMenu());
  const CAT={SET:'ชุดหมูกระทะ',AD:'Add-on',DW:'เครื่องดื่ม',PR:'โปรเครื่องดื่ม'};
  for(const [cat,items] of bycat){
    const col=document.createElement('div');
    col.className='card menu-column';
    col.innerHTML=`<h3>${CAT[cat]||cat} <span class="muted">${items.length} รายการ</span></h3>`;
    for(const it of items){
      const btn=document.createElement('div');
      btn.className='item';
      btn.innerHTML=`${it.name} <span class="price">฿${fmt(it.price)}</span>`;
      btn.onclick=()=>{ const c=getCart(); c.push({id:it.id,name:it.name,price:it.price,qty:1}); setCart(c); renderCart();};
      col.appendChild(btn);
    }
    wrap.appendChild(col);
  }
}
function renderCart(){
  const list=$('#cartList'), totalEl=$('#cartTotal'); if(!list||!totalEl) return;
  const c=getCart(); if(!c.length){ list.textContent='ยังไม่มีรายการ'; totalEl.textContent='0'; return; }
  list.innerHTML=''; let sum=0;
  c.forEach((it,i)=>{
    sum += it.price*it.qty;
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`
      <div>${it.name}</div>
      <div style="max-width:120px"><input type="number" min="1" value="${it.qty}"></div>
      <div style="max-width:120px"><input type="number" min="0" value="${it.price}"></div>
      <div style="max-width:100px" class="pill">฿${fmt(it.qty*it.price)}</div>
      <div style="max-width:120px"><button class="btn ghost">ลบ</button></div>`;
    const nums=row.querySelectorAll('input[type=number]');
    nums[0].onchange=()=>{ it.qty=Math.max(1,Number(nums[0].value||1)); setCart(c); renderCart(); };
    nums[1].onchange=()=>{ it.price=Math.max(0,Number(nums[1].value||0)); setCart(c); renderCart(); };
    row.querySelector('button').onclick=()=>{ c.splice(i,1); setCart(c); renderCart(); };
    list.appendChild(row);
  });
  totalEl.textContent=fmt(sum);
}
on('#btnClearCart','click',()=>{ setCart([]); renderCart(); });

/* ---------- เปิดบิล / เพิ่มลงบิล ---------- */
on('#btnOpenBill','click',()=>{
  const table=($('#inpTable')?.value.trim())||'N?';
  const staff=($('#inpStaff')?.value.trim())||'staff';
  const cart=getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const total=cart.reduce((a,b)=>a+b.qty*b.price,0);
  const bill={id:Date.now(),table,staff,items:cart,createdAt:new Date().toISOString(),total};
  const bills=getBills(); bills.push(bill); setBills(bills);
  setCart([]); renderCart(); renderOpenBills();
  alert(`เปิดบิล โต๊ะ ${table} เรียบร้อย`);
});
on('#btnAddToBill','click',()=>{
  const table=$('#inpTable')?.value.trim(); if(!table) return alert('กรอกโต๊ะก่อน');
  const cart=getCart(); if(!cart.length) return alert('ตะกร้าค่าว่าง');
  const bills=getBills();
  let bill=bills.find(b=>b.table===table);
  if(!bill){ bill={id:Date.now(),table,staff:($('#inpStaff')?.value.trim()||'staff'),items:[],createdAt:new Date().toISOString(),total:0}; bills.push(bill);}
  bill.items.push(...cart); bill.total=bill.items.reduce((s,i)=>s+i.qty*i.price,0);
  setBills(bills); setCart([]); renderCart(); renderOpenBills();
});

/* ---------- บิลที่เปิดอยู่ + ปิดบิล ---------- */
function renderOpenBills(){
  const box=$('#openBills'); if(!box) return; box.innerHTML='';
  const bills=getBills(); if(!bills.length){ box.innerHTML='<div class="muted">ยังไม่มีบิลที่เปิดอยู่</div>'; return; }
  bills.forEach(b=>{
    const row=document.createElement('div'); row.className='card bill-row';
    row.innerHTML=`
      <div>โต๊ะ <b>${b.table}</b> • ${b.staff}</div>
      <div class="pill">รวม ฿${fmt(b.total)}</div>
      <button class="btn" data-view>ดูรายการ</button>
      <button class="btn primary" data-pay>ปิดบิล</button>`;
    row.querySelector('[data-view]').onclick=()=>{
      const lines=b.items.map(i=>`• ${i.name} × ${i.qty} = ฿${fmt(i.qty*i.price)}`).join('\n');
      alert(`รายการของโต๊ะ ${b.table}\n\n${lines}\n\nรวม ฿${fmt(b.total)}`);
    };
    row.querySelector('[data-pay]').onclick=()=>openPayModal(b.id);
    box.appendChild(row);
  });
}

let PAY_BILL=null;
function openPayModal(id){
  const b=getBills().find(x=>x.id===id); if(!b) return;
  PAY_BILL=b;
  $('#payTable').value=b.table; $('#payStaff').value=b.staff; $('#payTotal').value=`฿${fmt(b.total)}`;
  $('#payReceived').value=b.total; $('#payChange').value='฿0'; $('#payMethod').value='cash';
  // โหลด QR จากค่าคงที่
  $('#qrImg').src=QR.url; $('#qrNote').textContent=QR.note; $('#qrBox').hidden=true;
  $('#payModal').showModal();
}
on('#payMethod','change',e=>{ $('#qrBox').hidden = (e.target.value!=='scan'); });
on('#payReceived','input',()=>{
  const r=Number($('#payReceived').value||0), t=PAY_BILL?.total||0;
  $('#payChange').value = `฿${fmt(Math.max(0,r-t))}`;
});
on('#btnConfirmPay','click',(ev)=>{
  ev.preventDefault(); if(!PAY_BILL) return;
  const method=$('#payMethod').value, received=Number($('#payReceived').value||0), total=PAY_BILL.total;
  if(method==='cash' && received<total) return alert('จำนวนเงินไม่พอ (เงินสด)');
  const sale={ id:'S'+Date.now(), table:PAY_BILL.table, staff:PAY_BILL.staff, items:PAY_BILL.items,
    total, createdAt:new Date().toISOString(), payment:{method,received,change:Math.max(0,received-total)} };
  const sales=getSales(); sales.push(sale); setSales(sales);

  // auto sync?
  const mode=localStorage.getItem(K.SYNC_MODE)||'auto';
  if(typeof enqueueSale==='function' && mode==='auto') enqueueSale(sale);

  setBills(getBills().filter(x=>x.id!==PAY_BILL.id));
  $('#payModal').close(); PAY_BILL=null; renderOpenBills();
  alert('ปิดบิลสำเร็จ');
});

/* ---------- Settings: เมนู ---------- */
function renderMenuTable(){
  const box=$('#menuTableBox'); if(!box) return;
  const menu=getMenu(); if(!menu.length){ box.textContent='ยังไม่มีเมนู — เพิ่มด้านบนได้เลย'; return; }
  const CAT={SET:'ชุดหมูกระทะ',AD:'Add-on',DW:'เครื่องดื่ม',PR:'โปรเครื่องดื่ม'};
  const rows=menu.map(m=>`
    <tr>
      <td>${m.id}</td><td>${m.name}</td><td>${CAT[m.cat]||m.cat}</td>
      <td style="text-align:right">฿${fmt(m.price)}</td>
      <td style="text-align:right"><button class="btn ghost" data-del="${m.id}">ลบ</button></td>
    </tr>`).join('');
  box.innerHTML=`<table>
    <thead><tr><th>รหัส</th><th>ชื่อ</th><th>หมวด</th><th style="text-align:right">ราคา</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  box.querySelectorAll('[data-del]').forEach(b=>{
    b.onclick=()=>{ setMenu(getMenu().filter(x=>x.id!==b.dataset.del)); renderMenuTable(); renderMenu(); };
  });
}
on('#btnAddMenu','click',()=>{
  const name=$('#newName').value.trim(), price=Number($('#newPrice').value||0),
        cat=$('#newCat').value, code=($('#newCode').value.trim()||('X'+Math.random().toString(36).slice(2,6))).toUpperCase();
  if(!name||price<=0) return alert('กรอกชื่อ/ราคาให้ถูกต้อง');
  const menu=getMenu(); menu.push({id:code,name,cat,price}); setMenu(menu);
  $('#newName').value=''; $('#newPrice').value=''; $('#newCode').value=''; renderMenuTable(); renderMenu();
});

/* ---------- Reports ---------- */
function dateStr(d){ return d.toISOString().slice(0,10); }
function parseDateInput(v){ return v ? new Date(v+'T00:00:00') : null; }

function filterSalesByRange(all, from, to){
  return all.filter(s=>{
    const d=new Date(s.createdAt);
    if(from && d<from) return false;
    if(to){ const t2 = new Date(to); t2.setDate(t2.getDate()+1); if(d>=t2) return false; }
    return true;
  });
}

function renderReports(){
  const all=getSales();

  const preset=$('#selPreset').value;
  let from=parseDateInput($('#dFrom').value), to=parseDateInput($('#dTo').value);

  const now=new Date();
  if(preset==='today'){ from=new Date(dateStr(now)); to=new Date(dateStr(now)); }
  else if(preset==='7d'){ to=new Date(dateStr(now)); from=new Date(to); from.setDate(from.getDate()-6); }
  else if(preset==='month'){
    const y=now.getFullYear(), m=now.getMonth();
    from=new Date(y,m,1); to=new Date(y,m+1,0);
    $('#dFrom').value=dateStr(from); $('#dTo').value=dateStr(to);
  }

  const list=filterSalesByRange(all, from, to);

  // KPIs
  const sum=list.reduce((a,b)=>a+b.total,0);
  const avg=list.length? Math.round(sum/list.length):0;
  $('#kpiSum').textContent='฿'+fmt(sum);
  $('#kpiAvg').textContent='฿'+fmt(avg);
  $('#kpiBills').textContent=fmt(list.length);

  // Top items
  const count = new Map();
  list.forEach(s=>s.items.forEach(i=>{
    const k=i.name; count.set(k, (count.get(k)||0)+i.qty);
  }));
  const top = [...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  $('#topList').innerHTML = top.length
    ? top.map(([name,qty])=>`<li><span>${name}</span><b>${qty}</b></li>`).join('')
    : '<div class="muted">—</div>';

  // table
  const rows = list.map(s=>{
    const d=new Date(s.createdAt);
    const dt=d.toLocaleString('th-TH');
    const pay=(s.payment?.method||'').toUpperCase();
    return `<tr>
      <td>${dt}</td><td>${s.table}</td><td style="text-align:right">฿${fmt(s.total)}</td><td>${pay||'-'}</td>
    </tr>`;
  }).join('');
  $('#salesTableBox').innerHTML = list.length
    ? `<table><thead><tr><th>วันที่เวลา</th><th>โต๊ะ</th><th style="text-align:right">ยอดสุทธิ</th><th>ชำระ</th></tr></thead><tbody>${rows}</tbody></table>`
    : 'ยังไม่มีข้อมูล';
}

// date/preset listeners
['#selPreset','#dFrom','#dTo'].forEach(sel=> on(sel,'change',renderReports));

// Export CSV
on('#btnExportCsv','click',()=>{
  const from=$('#dFrom').value, to=$('#dTo').value;
  const list=filterSalesByRange(getSales(), parseDateInput(from), parseDateInput(to));
  if(!list.length) return alert('ไม่มีข้อมูลในช่วงที่เลือก');

  const rows=[['datetime','table','staff','total','method','received','change']];
  list.forEach(s=>{
    rows.push([
      new Date(s.createdAt).toISOString(),
      s.table, s.staff, s.total,
      s.payment?.method||'', s.payment?.received||'', s.payment?.change||''
    ]);
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='sales.csv'; a.click();
  URL.revokeObjectURL(url);
});

/* ---------- Google Sheets Sync controls ---------- */
on('#btnSaveUrl','click',()=>{
  const url=$('#inpWebAppUrl').value.trim(); if(!url) return alert('วาง Web App URL ก่อน');
  localStorage.setItem(K.WEBAPP,url);
  const mode=$('#selSyncMode').value||'auto'; localStorage.setItem(K.SYNC_MODE,mode);
  $('#gsStatus').textContent='บันทึกแล้ว';
});
on('#btnTest','click', async ()=>{
  const url=localStorage.getItem(K.WEBAPP)||''; if(!url) return alert('ยังไม่ตั้งค่า URL');
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ping:true})});
    $('#gsStatus').textContent='ทดสอบ: '+res.status;
  }catch(e){ $('#gsStatus').textContent='เชื่อมต่อไม่สำเร็จ'; }
});
on('#btnPushPending','click',()=>{ if(typeof pushAllPending==='function') pushAllPending(); });

/* ---------- Boot ---------- */
window.addEventListener('load', ()=>{
  // ตั้งค่า default date สำหรับรายงาน
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const from=new Date(y,m,1), to=new Date(y,m+1,0);
  $('#selPreset').value='month';
  $('#dFrom').value = from.toISOString().slice(0,10);
  $('#dTo').value   = to.toISOString().slice(0,10);

  // เติมค่าซิงก์ในฟอร์ม
  $('#inpWebAppUrl').value = localStorage.getItem(K.WEBAPP)||'';
  $('#selSyncMode').value = localStorage.getItem(K.SYNC_MODE)||'auto';

  renderMenu(); renderCart(); renderOpenBills(); renderMenuTable(); renderReports();
});
