<!-- ============================== app.js ============================== -->
<script type="module" id="app-js">
// app.js
const LS_STATE = 'POS_STATE_V1';
const LS_MENU  = 'POS_MENU_V1';
const $ = s=>document.querySelector(s);

/********* State *********/
const State = {
  load(){ try{return JSON.parse(localStorage.getItem(LS_STATE))||{cart:[],openBills:[],closedBills:[],lastId:0}}catch{return {cart:[],openBills:[],closedBills:[],lastId:0}} },
  save(s){ localStorage.setItem(LS_STATE, JSON.stringify(s)); }
};
let S = State.load();

/********* Menu *********/
const DefaultMenu=[
  {name:'ชุดหมูกระทะ (สำหรับ 2–3 คน)', price:299, cat:'SET', code:'Z99'},
  {name:'สันคอหมูสไลด์ (ถาด)', price:79, cat:'AD', code:'AD'},
  {name:'เบคอนหวาน (ถาด)', price:89, cat:'AD', code:'AD'},
  {name:'กุ้ง (ถาด)', price:99, cat:'AD', code:'AD'},
  {name:'ชุดผัก', price:39, cat:'AD', code:'AD'},
  {name:'น้ำแข็งถัง', price:30, cat:'DW', code:'ICE'},
  {name:'น้ำเปล่า', price:15, cat:'DW', code:'DW'},
  {name:'น้ำอัดลม (ขวดเล็ก)', price:25, cat:'DW', code:'DS'},
  {name:'โปรเบียร์สิงห์ 3 ขวด', price:210, cat:'PR', code:'BEER-SG'}
];

const MenuStore={
  load(){ try{ return JSON.parse(localStorage.getItem(LS_MENU)) || DefaultMenu }catch{ return DefaultMenu } },
  save(list){ localStorage.setItem(LS_MENU, JSON.stringify(list)); }
};
let MENU = MenuStore.load();

/********* Utils *********/
const money=n=> (n||0).toLocaleString('th-TH');
const sum = items => items.reduce((t,i)=>t+(i.price||0)*(i.qty||1),0);

/********* POS UI *********/
const cartList=$('#cartList'); const cartTotal=$('#cartTotal');
const inpTable=$('#inpTable'); const inpStaff=$('#inpStaff');

function renderMenuPanels(){
  const panels=$('#menuPanels');
  const cats=[
    {id:'SET', title:'ชุดหมูกระทะ'},
    {id:'AD',  title:'Add-on'},
    {id:'DW',  title:'เครื่องดื่ม'},
    {id:'PR',  title:'โปรโมชันเครื่องดื่ม'}
  ];
  panels.innerHTML = cats.map(c=>{
    const items = MENU.filter(m=>m.cat===c.id);
    const btns = items.map(it=>`<button class="btn" data-add='${JSON.stringify({name:it.name,price:it.price}).replaceAll("'","&apos;")}' style="width:100%;margin:6px 0">+ ${it.name} ${it.price? '('+it.price+')':''}</button>`).join('');
    return `<div class="card"><h3>${c.title}</h3>${btns || '<div class="muted mini">ยังไม่มีเมนูในหมวดนี้</div>'}</div>`;
  }).join('');

  panels.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{
    const item = JSON.parse(b.getAttribute('data-add').replaceAll('&apos;','\''));
    S.cart.push({...item, qty:1}); State.save(S); renderCart();
  }));
}

function renderCart(){
  if(S.cart.length===0){ cartList.textContent='ยังไม่มีรายการ'; cartTotal.textContent='0'; return; }
  cartList.innerHTML = S.cart.map(it=>`<div class="row"><div>${it.name}</div><div class="muted">x${it.qty||1}</div><div class="right">${money(it.price)}</div></div>`).join('');
  cartTotal.textContent = money(sum(S.cart));
}

$('#btnClearCart').onclick = ()=>{ S.cart=[]; State.save(S); renderCart(); };
$('#btnAddToBill').onclick = ()=>{
  const open = S.openBills[0];
  if(!open){ alert('ยังไม่มีบิลเปิดอยู่'); return; }
  if(S.cart.length===0){ alert('ตะกร้าว่าง'); return; }
  open.items.push(...S.cart); open.total = sum(open.items) - (open.discount||0); open.updatedAt=new Date().toISOString();
  S.cart=[]; State.save(S); renderCart(); renderOpenBills(); window.Sync.pushSoon();
};

$('#btnOpenBill').onclick = ()=>{
  const table=(inpTable.value||'').trim(); const staff=(inpStaff.value||localStorage.getItem('EMP_NAME')||'staff').trim();
  if(!table){ alert('กรอกหมายเลขโต๊ะ'); return; }
  const id=++S.lastId; const bill={ id:String(id), table, staff, items:[...S.cart], discount:0, total:0, status:'open', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  bill.total = sum(bill.items);
  S.openBills.unshift(bill); S.cart=[]; State.save(S); renderAll(); window.Sync.pushSoon();
};

function renderOpenBills(){
  const box=$('#openBills');
  if(S.openBills.length===0){ box.innerHTML='<div class="muted">ยังไม่มีบิลเปิดอยู่</div>'; return; }
  box.innerHTML = S.openBills.map(b=>`
    <div class="card">
      <div class="row" style="justify-content:space-between"><div><b>โต๊ะ ${b.table}</b> · <span class="muted">บิล #${b.id}</span></div><div class="muted">พนง: ${b.staff||'-'}</div></div>
      <div class="space"></div>
      <table><thead><tr><th>รายการ</th><th>จำนวน</th><th class="right">ราคา</th></tr></thead><tbody>
      ${b.items.map(it=>`<tr><td>${it.name}</td><td>${it.qty||1}</td><td class="right">${money(it.price)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">รวม</td><td class="right">${money(b.total)}</td></tr></tfoot></table>
      <div class="row" style="margin-top:6px;gap:8px">
        <button class="btn" data-edit="${b.id}">แก้ไข</button>
        <button class="btn" data-discount="${b.id}">ส่วนลด</button>
        <span style="flex:1"></span>
        <button class="btn primary" data-pay="${b.id}">ปิดบิล</button>
      </div>
    </div>
  `).join('');

  box.querySelectorAll('[data-discount]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.getAttribute('data-discount'); const b=S.openBills.find(v=>v.id===id);
    const d=Number(prompt('ใส่ส่วนลด (บาท)', b.discount||0)||0); b.discount=d; b.total=sum(b.items)-d; b.updatedAt=new Date().toISOString(); State.save(S); renderOpenBills(); window.Sync.pushSoon();
  }));
  box.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.getAttribute('data-edit'); const b=S.openBills.find(v=>v.id===id);
    const t=prompt('แก้ชื่อโต๊ะ', b.table)||b.table; b.table=t; b.updatedAt=new Date().toISOString(); State.save(S); renderOpenBills(); window.Sync.pushSoon();
  }));
  box.querySelectorAll('[data-pay]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.getAttribute('data-pay'); closeBill(id);
  }));
}

function closeBill(id){
  const b=S.openBills.find(v=>v.id===id); if(!b) return;
  b.pay_method = prompt('วิธีชำระ? cash/transfer','transfer')||'cash';
  b.status='closed'; b.updatedAt=new Date().toISOString();
  S.closedBills.unshift(b); S.openBills=S.openBills.filter(v=>v.id!==id); State.save(S); renderAll(); window.Sync.pushSoon();
}

/********* Reports *********/
function reportRange(start,end){
  const rows=[...S.openBills,...S.closedBills].filter(b=>{ const t=Date.parse(b.createdAt||b.updatedAt||0); return (!start||t>=Date.parse(start))&&(!end||t<=Date.parse(end)); });
  const sumAll=rows.reduce((n,b)=>n+(b.total||0),0); return {rows:rows,sum:sumAll};
}
$('#btnToday').onclick=()=>{ const d=new Date();const y=d.getFullYear(),m=d.getMonth(),day=d.getDate(); const s=new Date(y,m,day).toISOString(), e=new Date(y,m,day,23,59,59).toISOString(); const r=reportRange(s,e); $('#reportBox').innerHTML=`<b>วันนี้</b> ยอดรวม <b>${money(r.sum)}</b> บาท · บิล ${r.rows.length} ใบ`; };
$('#btnMonth').onclick=()=>{ const d=new Date();const y=d.getFullYear(),m=d.getMonth(); const s=new Date(y,m,1).toISOString(), e=new Date(y,m+1,0,23,59,59).toISOString(); const r=reportRange(s,e); $('#reportBox').innerHTML=`<b>เดือนนี้</b> ยอดรวม <b>${money(r.sum)}</b> บาท · บิล ${r.rows.length} ใบ`; };
$('#btnPullNow').onclick=()=>window.Sync.pull(true);

/********* Settings: Cloud *********/
$('#btnSaveUrl').onclick=()=>{ const url=$('#inpWebAppUrl').value.trim(); if(!url.endsWith('/exec')){ alert('URL ต้องลงท้าย /exec'); return;} localStorage.setItem('SYNC_URL',url); $('#gsStatus').textContent='บันทึกแล้ว'; window.Sync.loadConfig(); };
$('#btnTest').onclick=async()=>{ const ok=await window.Sync.test(); $('#gsStatus').textContent= ok?'เชื่อมต่อสำเร็จ':'เชื่อมต่อไม่สำเร็จ'; };
$('#btnClearLocal').onclick=()=>{ if(!confirm('ยืนยันล้างข้อมูลในเครื่องนี้?'))return; localStorage.removeItem(LS_STATE); alert('ล้างข้อมูลแล้ว'); location.reload(); };

/********* Settings: Menu *********/
function renderMenuTable(){
  const q=($('#menuSearch').value||'').toLowerCase(); const f=$('#menuFilter').value||'';
  const rows=MENU.filter(m=> (!f||m.cat===f) && (!q||m.name.toLowerCase().includes(q)) );
  const catSel = (val, id)=>`<select data-cid="${id}"><option value="SET" ${val==='SET'?'selected':''}>ชุดหมูกระทะ</option><option value="AD" ${val==='AD'?'selected':''}>Add-on</option><option value="DW" ${val==='DW'?'selected':''}>เครื่องดื่ม</option><option value="PR" ${val==='PR'?'selected':''}>โปรโมชันเครื่องดื่ม</option></select>`;
  const html = `<table>
    <thead><tr><th>ชื่อ</th><th>หมวด</th><th class="col-price">ราคา</th><th class="col-code">รหัส</th><th class="right">ทำรายการ</th></tr></thead>
    <tbody>
      ${rows.map((m,i)=>`<tr>
        <td><input data-name="${i}" value="${m.name}"/></td>
        <td>${catSel(m.cat,i)}</td>
        <td><input type="number" data-price="${i}" value="${m.price||0}"/></td>
        <td><input data-code="${i}" value="${m.code||''}"/></td>
        <td class="right actions"><button class="btn ghost" data-up="${i}">↑</button><button class="btn ghost" data-down="${i}">↓</button><button class="btn danger" data-del="${i}">ลบ</button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  $('#menuTableBox').innerHTML=html || '<div class="muted mini">ไม่พบเมนู</div>';

  // Bind changes
  $('#menuTableBox').querySelectorAll('input[data-name]').forEach(el=>el.addEventListener('input',()=>{ const i=Number(el.dataset.name); MENU[i].name=el.value; MenuStore.save(MENU); renderMenuPanels(); }));
  $('#menuTableBox').querySelectorAll('input[data-price]').forEach(el=>el.addEventListener('input',()=>{ const i=Number(el.dataset.price); MENU[i].price=Number(el.value||0); MenuStore.save(MENU); renderMenuPanels(); }));
  $('#menuTableBox').querySelectorAll('input[data-code]').forEach(el=>el.addEventListener('input',()=>{ const i=Number(el.dataset.code); MENU[i].code=el.value; MenuStore.save(MENU); }));
  $('#menuTableBox').querySelectorAll('select[data-cid]').forEach(el=>el.addEventListener('change',()=>{ const i=Number(el.dataset.cid); MENU[i].cat=el.value; MenuStore.save(MENU); renderMenuPanels(); }));
  $('#menuTableBox').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.del); if(!confirm('ลบเมนูนี้?'))return; MENU.splice(i,1); MenuStore.save(MENU); renderMenuTable(); renderMenuPanels(); }));
  $('#menuTableBox').querySelectorAll('[data-up]').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.up); if(i<=0) return; const t=MENU[i-1]; MENU[i-1]=MENU[i]; MENU[i]=t; MenuStore.save(MENU); renderMenuTable(); renderMenuPanels(); }));
  $('#menuTableBox').querySelectorAll('[data-down]').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.down); if(i>=MENU.length-1) return; const t=MENU[i+1]; MENU[i+1]=MENU[i]; MENU[i]=t; MenuStore.save(MENU); renderMenuTable(); renderMenuPanels(); }));
}

$('#btnAddMenu').onclick=()=>{
  const name=($('#newName').value||'').trim(); if(!name){ alert('ใส่ชื่อเมนู'); return; }
  const price=Number($('#newPrice').value||0); const cat=$('#newCat').value; const code=($('#newCode').value||'').trim();
  MENU.push({name,price,cat,code}); MenuStore.save(MENU);
  $('#newName').value=''; $('#newPrice').value=''; $('#newCode').value='';
  renderMenuTable(); renderMenuPanels();
};
$('#menuSearch').addEventListener('input',renderMenuTable); $('#menuFilter').addEventListener('change',renderMenuTable);

/********* Boot *********/
function renderAll(){ renderMenuPanels(); renderCart(); renderOpenBills(); }
renderAll();

// Expose to sync.js
window.Adapter={
  getState:()=>S,
  setState:(next)=>{ S=next; State.save(S); renderAll(); },
  touchBills:(st)=>{ const now=new Date().toISOString(); st.openBills.forEach(b=>{if(!b.updatedAt) b.updatedAt=now}); st.closedBills.forEach(b=>{if(!b.updatedAt) b.updatedAt=now}); return st; }
};
</script>