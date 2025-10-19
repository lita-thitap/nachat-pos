/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* ยิงแบบ text/plain เพื่อเลี่ยง preflight/CORS */

const SYNC = {
  defaultUrl: "https://script.google.com/macros/s/AKfycbxydXEkJ24gTGfHUNzD7M4YZSPzIkY23tc1xh0WMJO2H32DTxS_UsmzTlwE-grZjhJv/exec",
  urlKey:   "POS_WEBAPP_URL",
  modeKey:  "POS_SYNC_MODE",     // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",    // เก็บคิวบิลค้างส่ง
  metaKey:  "POS_SYNC_META"      // เก็บ lastTry / lastOk / error ล่าสุด
};

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);

function getUrl(){ return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim(); }
function setUrl(u){ localStorage.setItem(SYNC.urlKey, (u||'').trim()); }

function getMode(){ return localStorage.getItem(SYNC.modeKey) || 'auto'; }
function setMode(m){ localStorage.setItem(SYNC.modeKey, m); }

function getQueue(){ try{ return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]'); }catch{ return []; } }
function setQueue(a){ localStorage.setItem(SYNC.queueKey, JSON.stringify(a||[])); }

function getMeta(){ try{ return JSON.parse(localStorage.getItem(SYNC.metaKey)||'{}'); }catch{ return {}; } }
function setMeta(m){ localStorage.setItem(SYNC.metaKey, JSON.stringify(m||{})); }

/* ---------- POST (text/plain) ---------- */
async function postJSON(url, data){
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  const text = await res.text();     // Apps Script อาจส่ง JSON หรือแค่ข้อความ
  try { return JSON.parse(text); }   // พยายาม parse ก่อน
  catch { return { ok:true, raw:text }; }
}

/* ---------- queue APIs ---------- */
// เรียกจาก app.js ตอน “ปิดบิล” สำเร็จ
// sale = { id, table, staff, items:[], total, createdAt, payment:{method, received, change}, updatedAt? }
function enqueueSale(sale){
  const q = getQueue();
  q.push(sale);
  setQueue(q);
  updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (คิวค้าง ${q.length})`);
  if(getMode()==='auto') trySync();
}

let syncRunning = false;
async function trySync(){
  if(syncRunning) return;
  const url = getUrl();
  if(!url){ updateStatus('ยังไม่ได้ตั้งค่า Web App URL'); return; }

  const q = getQueue();
  if(!q.length){ updateStatus('ไม่มีคิวค้างส่ง'); return; }

  syncRunning = true;
  try{
    // ใช้ while เพื่อให้ทำงานกับการ shift() ได้ 100%
    while(q.length){
      const payload = q[0];
      const meta    = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

      let ok = false, resp = null;
      try{
        resp = await postJSON(url, payload);
        ok   = !(resp && resp.ok === false); // ถ้าไม่มี field ok ให้ถือว่าสำเร็จ
      }catch(err){
        updateStatus(`ส่งไม่สำเร็จ (เครือข่าย): ${err}`);
        break; // หยุดไว้ก่อน รอผู้ใช้กดส่งใหม่
      }

      if(!ok){
        updateStatus(`ส่งไม่สำเร็จจากเซิร์ฟเวอร์: ${(resp && resp.error)||'unknown'}`);
        break;
      }

      // สำเร็จ -> ตัดใบหน้าสุดออก
      q.shift(); setQueue(q);
      const meta2 = getMeta(); meta2.lastOk = new Date().toISOString(); setMeta(meta2);
      updateStatus(`ส่งสำเร็จ #${payload.id} (คงเหลือ ${q.length})`);

      // กัน rate limit เบา ๆ
      await new Promise(r=>setTimeout(r,150));
    }
  }finally{
    syncRunning = false;
  }
}

/* ---------- UI/report bindings ---------- */
function updateStatus(msg){
  const el = $('#gsStatus'); if(!el) return;
  const qlen = getQueue().length;
  const meta = getMeta();
  el.innerHTML = [
    msg,
    `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry||'-'} | lastOk: ${meta.lastOk||'-'}</div>`
  ].join('<br/>');
}

function fillUi(){
  if($('#inpWebAppUrl')) $('#inpWebAppUrl').value = getUrl();
  if($('#selSyncMode'))  $('#selSyncMode').value  = getMode();
  updateStatus('พร้อมซิงก์');
}

$('#btnSaveUrl')?.addEventListener('click', ()=>{
  const url = $('#inpWebAppUrl')?.value.trim();
  if(!url){ alert('กรุณาวาง Web App URL'); return; }
  setUrl(url);
  setMode($('#selSyncMode')?.value || 'auto');
  updateStatus('บันทึกการตั้งค่าแล้ว');
});

$('#selSyncMode')?.addEventListener('change', e=>{
  setMode(e.target.value || 'auto');
  updateStatus(`โหมดซิงก์: ${getMode()}`);
});

$('#btnTest')?.addEventListener('click', async ()=>{
  const url = getUrl(); if(!url){ alert('ยังไม่ตั้งค่า URL'); return; }
  try{
    const txt = await fetch(url).then(r=>r.text());
    console.log('Ping:', txt);
    updateStatus('ทดสอบเชื่อมต่อ OK');
    alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
  }catch(err){
    updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
    alert('เชื่อมต่อไม่ได้ ❌\n'+err);
  }
});

$('#btnPushPending')?.addEventListener('click', ()=>trySync());

window.addEventListener('load', fillUi);

/* export ให้ app.js ใช้ */
window.enqueueSale = enqueueSale;
window.trySync     = trySync;
