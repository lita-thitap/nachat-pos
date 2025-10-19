/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
const SYNC = {
  defaultUrl: "",                          // เว้นว่างหรือใส่ URL ได้
  urlKey: "POS_WEBAPP_URL",
  modeKey: "POS_SYNC_MODE",               // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",             // คิวบิลค้างส่ง
  metaKey: "POS_SYNC_META"                // เก็บ lastTry/lastOk
};

/* Storage helpers */
function getUrl() { return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim(); }
function setUrl(u) { localStorage.setItem(SYNC.urlKey, (u||'').trim()); }
function getMode() { return localStorage.getItem(SYNC.modeKey) || 'auto'; }
function setMode(m) { localStorage.setItem(SYNC.modeKey, m); }
function getQueue() { try { return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]'); } catch { return []; } }
function setQueue(a){ localStorage.setItem(SYNC.queueKey, JSON.stringify(a||[])); }
function getMeta()  { try { return JSON.parse(localStorage.getItem(SYNC.metaKey)||'{}'); } catch { return {}; } }
function setMeta(m) { localStorage.setItem(SYNC.metaKey, JSON.stringify(m||{})); }

/* POST helper (text/plain) */
async function postPlain(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok:true, raw:text }; }
}

/* Queue API – เรียกจาก app.js ตอนปิดบิล */
function enqueueSale(sale){
  const q = getQueue(); q.push({op:'push', ...sale}); setQueue(q);
  updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (${q.length} คิวค้าง)`);
  if(getMode()==='auto') trySync();
}
window.enqueueSale = enqueueSale;

let syncRunning=false;
async function trySync(){
  if(syncRunning) return;
  const url = getUrl();
  if(!url){ updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }

  const q = getQueue();
  if(!q.length){ updateStatus('ไม่มีคิวค้างส่ง'); return; }

  syncRunning=true;
  try{
    while(q.length){
      const payload = q[0];
      const meta = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);
      let ok=false, resp=null;
      try{
        resp = await postPlain(url, payload);
        ok = !!(resp && resp.ok !== false);
      }catch(err){
        updateStatus('ส่งไม่สำเร็จ: '+err); break;
      }
      if(!ok){ updateStatus('ส่งไม่สำเร็จ: '+(resp?.error||'unknown')); break; }

      q.shift(); setQueue(q);
      const meta2=getMeta(); meta2.lastOk=new Date().toISOString(); setMeta(meta2);
      updateStatus(`ส่งสำเร็จ #${payload.id||'-'} (คงเหลือ ${q.length})`);
      await new Promise(r=>setTimeout(r,150));
    }
  }finally{ syncRunning=false; }
}
window.trySync = trySync;

/* UI bindings (Reports page) */
function qs(s){ return document.querySelector(s); }

function updateStatus(msg){
  const s = qs('#gsStatus'); if(!s) return;
  const qlen = getQueue().length;
  const meta = getMeta();
  s.innerHTML = [
    msg,
    `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry||'-'} | lastOk: ${meta.lastOk||'-'}</div>`
  ].join('<br/>');
}
function fillUi(){
  const urlInput = qs('#inpWebAppUrl'); if(urlInput) urlInput.value = getUrl();
  const modeSel  = qs('#selSyncMode');  if(modeSel)  modeSel.value  = getMode();
  updateStatus('พร้อมซิงก์');
}
qs('#btnSaveUrl')?.addEventListener('click', ()=>{
  const url = qs('#inpWebAppUrl')?.value.trim();
  if(!url){ alert('กรุณาวาง Web App URL'); return; }
  setUrl(url);
  setMode(qs('#selSyncMode')?.value || 'auto');
  updateStatus('บันทึกการตั้งค่าแล้ว');
});
qs('#selSyncMode')?.addEventListener('change', e=>{
  setMode(e.target.value||'auto'); updateStatus(`โหมดซิงก์: ${getMode()}`);
});
qs('#btnTest')?.addEventListener('click', async ()=>{
  const url = getUrl(); if(!url){ alert('ยังไม่ตั้งค่า URL'); return; }
  try{
    const ping = await fetch(url).then(r=>r.text());
    console.log('Ping:', ping);
    updateStatus('ทดสอบเชื่อมต่อ OK'); alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
  }catch(err){
    updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ'); alert('เชื่อมต่อไม่ได้ ❌\n'+err);
  }
});
qs('#btnPushPending')?.addEventListener('click', ()=> trySync());
window.addEventListener('load', fillUi);
