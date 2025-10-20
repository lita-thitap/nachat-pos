/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
const SYNC = {
  defaultUrl: "https://script.google.com/macros/s/AKfycbxPcGHuSgNKgos5qKZRC87E_SEgfFYIfNZjlvPuL11KosZweJqtkxanZe3rvbcSLVW6/exec", // ใส่ลิงก์ Web App ของคุณได้ หรือปล่อยว่างแล้ววางผ่าน UI
  urlKey: "POS_WEBAPP_URL",
  modeKey: "POS_SYNC_MODE",  // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",
  metaKey: "POS_SYNC_META"
};

const $Q = s => document.querySelector(s);

function getUrl(){ return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim(); }
function setUrl(u){ localStorage.setItem(SYNC.urlKey, (u||'').trim()); }
function getMode(){ return localStorage.getItem(SYNC.modeKey) || 'auto'; }
function setMode(m){ localStorage.setItem(SYNC.modeKey, m); }
function getQueue(){ try{return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]')}catch{return[]} }
function setQueue(a){ localStorage.setItem(SYNC.queueKey, JSON.stringify(a||[])); }
function getMeta(){ try{return JSON.parse(localStorage.getItem(SYNC.metaKey)||'{}')}catch{return{}} }
function setMeta(m){ localStorage.setItem(SYNC.metaKey, JSON.stringify(m||{})); }

/* POST helper (text/plain) */
async function postJSON(url, data){
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request
    body: JSON.stringify(data)
  });
  const text = await res.text();
  try{ return JSON.parse(text); }catch{ return { ok:true, raw:text }; }
}

/* ให้ app.js เรียกเมื่อปิดบิลสำเร็จ */
function enqueueSale(sale){
  const q=getQueue();
  q.push({op:'sale', sale});
  setQueue(q);
  updateStatus(`เข้าคิว #${sale.id} (คิวค้าง ${q.length})`);
  if(getMode()==='auto') trySync();
}

let syncing=false;
async function trySync(){
  if(syncing) return;
  const url=getUrl(); if(!url) return updateStatus('ยังไม่ตั้งค่า Web App URL');
  const q=getQueue(); if(!q.length) return updateStatus('ไม่มีคิวค้างส่ง');

  syncing=true;
  try{
    while(q.length){
      const payload=q[0];
      setMeta({...getMeta(), lastTry:new Date().toISOString()});
      let ok=false, resp=null;
      try{ resp=await postJSON(url, payload); ok=!!(resp && resp.ok!==false); }
      catch(err){ updateStatus('ส่งไม่สำเร็จ: '+err); break; }
      if(!ok){ updateStatus('ส่งไม่สำเร็จ: '+(resp&&resp.error||'unknown')); break; }
      q.shift(); setQueue(q);
      setMeta({...getMeta(), lastOk:new Date().toISOString()});
      updateStatus(`ส่งสำเร็จ (เหลือ ${q.length})`);
      await new Promise(r=>setTimeout(r,150));
    }
  }finally{ syncing=false; }
}

/* UI bindings (Reports tab) */
function updateStatus(msg){
  const s=$Q('#gsStatus'); if(!s) return;
  const qlen=getQueue().length, m=getMeta();
  s.innerHTML=[msg, `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${m.lastTry||'-'} | lastOk: ${m.lastOk||'-'}</div>`].join('<br/>');
}
function fillUi(){
  $Q('#inpWebAppUrl') && ($Q('#inpWebAppUrl').value=getUrl());
  $Q('#selSyncMode') && ($Q('#selSyncMode').value=getMode());
  updateStatus('พร้อมซิงก์');
}
$Q('#btnSaveUrl')?.addEventListener('click',()=>{
  const url=$Q('#inpWebAppUrl')?.value.trim(); if(!url) return alert('กรุณาวาง Web App URL');
  setUrl(url); setMode($Q('#selSyncMode')?.value||'auto'); updateStatus('บันทึกการตั้งค่าแล้ว');
});
$Q('#selSyncMode')?.addEventListener('change',e=>{ setMode(e.target.value||'auto'); updateStatus(`โหมดซิงก์: ${getMode()}`); });
$Q('#btnTest')?.addEventListener('click',async()=>{
  const url=getUrl(); if(!url) return alert('ยังไม่ตั้งค่า URL');
  try{ const ping=await fetch(url).then(r=>r.text()); console.log('Ping:', ping); alert('ทดสอบเชื่อมต่อสำเร็จ ✅'); updateStatus('ทดสอบเชื่อมต่อ OK'); }
  catch(e){ alert('เชื่อมต่อไม่ได้ ❌\n'+e); updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ'); }
});
$Q('#btnPushPending')?.addEventListener('click',()=>trySync());
window.addEventListener('load', fillUi);

/* export ให้ app.js ใช้ */
window.enqueueSale = enqueueSale;
window.trySync     = trySync;
