/* ==== Nachat POS Sync Module (Google Sheets) ==== */
const SYNC = {
  enabled: true,
  url: localStorage.getItem('POS_WEBAPP_URL') || '',
  queueKey: 'sync_queue',
  intervalMs: 15000
};

function getQueue(){ return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]'); }
function setQueue(q){ localStorage.setItem(SYNC.queueKey, JSON.stringify(q)); }

async function postJSON(url, data){
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return await res.json().catch(()=>({ok:true}));
}

async function trySync(){
  if(!SYNC.enabled) return;
  const url = SYNC.url.trim(); if(!url) return;
  const q = getQueue(); if(!q.length) return;

  const pending=[...q];
  for(const payload of pending){
    try{
      await postJSON(url, payload);
      q.shift(); setQueue(q);
      console.log('✅ synced sale', payload.table, payload.total);
    }catch(err){
      console.warn('❌ sync failed, keep queue', err);
      break;
    }
  }
}
setInterval(trySync, SYNC.intervalMs);

function enqueueSale(sale){ const q=getQueue(); q.push(sale); setQueue(q); trySync(); }

window.addEventListener('load', ()=>{
  const urlInput  = document.getElementById('inpWebAppUrl');
  if(!urlInput) return;
  const saveBtn   = document.getElementById('btnSaveUrl');
  const testBtn   = document.getElementById('btnTest');
  const clearBtn  = document.getElementById('btnClearLocal');
  const statusEl  = document.getElementById('gsStatus');

  urlInput.value = localStorage.getItem('POS_WEBAPP_URL') || '';
  saveBtn?.addEventListener('click', ()=>{
    const url = urlInput.value.trim(); if(!url) return alert('กรอก Web App URL ก่อน');
    localStorage.setItem('POS_WEBAPP_URL', url);
    SYNC.url = url; alert('บันทึก URL แล้ว');
  });
  testBtn?.addEventListener('click', async ()=>{
    const url = urlInput.value.trim(); if(!url) return alert('กรอก URL ก่อน');
    try{ await postJSON(url, {test:true}); statusEl.textContent='✅ เชื่อมต่อสำเร็จ'; }
    catch{ statusEl.textContent='❌ เชื่อมต่อไม่สำเร็จ'; }
  });
  clearBtn?.addEventListener('click', ()=>{
    if(confirm('ล้างข้อมูลทั้งหมดในเครื่องนี้?')){
      localStorage.clear(); alert('ล้างข้อมูลแล้ว รีเฟรชหน้า'); location.reload();
    }
  });
});
