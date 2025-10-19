/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* ใช้ qs() แทน $() เพื่อไม่ชนกับ app.js และห่อใน IIFE กันตัวแปร global รั่ว */

(()=>{
  const SYNC = {
    defaultUrl: "https://script.google.com/macros/s/AKfycbxydXEkJ24gTGfHUNzD7M4YZSPzIkY23tc1xh0WMJO2H32DTxS_UsmzTlwE-grZjhJv/exec",
    urlKey: "POS_WEBAPP_URL",
    modeKey: "POS_SYNC_MODE",
    queueKey: "POS_SYNC_QUEUE",
    metaKey: "POS_SYNC_META"
  };

  /* ---------- DOM helper (ไม่ใช้ $ เพื่อไม่ชน) ---------- */
  const qs = (s)=>document.querySelector(s);

  /* ---------- Storage helpers ---------- */
  function getUrl(){ return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim(); }
  function setUrl(u){ localStorage.setItem(SYNC.urlKey, (u||'').trim()); }
  function getMode(){ return localStorage.getItem(SYNC.modeKey) || 'auto'; }
  function setMode(m){ localStorage.setItem(SYNC.modeKey, m); }
  function getQueue(){ try{ return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]'); }catch{ return []; } }
  function setQueue(a){ localStorage.setItem(SYNC.queueKey, JSON.stringify(a||[])); }
  function getMeta(){ try{ return JSON.parse(localStorage.getItem(SYNC.metaKey)||'{}'); }catch{ return {}; } }
  function setMeta(m){ localStorage.setItem(SYNC.metaKey, JSON.stringify(m||{})); }

  /* ---------- POST helper (text/plain) ---------- */
  async function postJSON(url, data){
    const res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    try{ return JSON.parse(text); }catch{ return { ok:true, raw:text }; }
  }

  /* ---------- Queue API ---------- */
  function enqueueSale(sale){
    const q = getQueue(); q.push(sale); setQueue(q);
    updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (${q.length} คิวค้าง)`);
    if(getMode()==='auto') trySync();
  }

  let syncRunning = false;
  async function trySync(){
    if(syncRunning) return;
    const url = getUrl(); if(!url){ updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }
    const q = getQueue(); if(!q.length){ updateStatus('ไม่มีคิวค้างส่ง'); return; }

    syncRunning = true;
    try{
      while(q.length){
        const payload = q[0];
        const meta = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

        let ok=false, resp=null;
        try{
          resp = await postJSON(url, payload);
          ok = !!(resp && resp.ok !== false);
        }catch(err){
          updateStatus(`ส่งไม่สำเร็จ: ${err}`);
          break;
        }

        if(!ok){
          updateStatus(`ส่งไม่สำเร็จ: ${(resp&&resp.error)||'unknown error'}`);
          break;
        }

        q.shift(); setQueue(q);
        const meta2 = getMeta(); meta2.lastOk = new Date().toISOString(); setMeta(meta2);
        updateStatus(`ส่งสำเร็จ #${payload.id} (คงเหลือ ${q.length})`);
        await new Promise(r=>setTimeout(r,150));
      }
    }finally{
      syncRunning = false;
    }
  }

  /* ---------- UI binding ---------- */
  function updateStatus(msg){
    const s = qs('#gsStatus'); if(!s) return;
    const qlen = getQueue().length, meta = getMeta();
    s.innerHTML = [
      msg,
      `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry||'-'} | lastOk: ${meta.lastOk||'-'}</div>`
    ].join('<br/>');
  }

  function fillUi(){
    const urlIn = qs('#inpWebAppUrl'); if(urlIn) urlIn.value = getUrl();
    const modeSel = qs('#selSyncMode'); if(modeSel) modeSel.value = getMode();
    updateStatus('พร้อมซิงก์');
  }

  qs('#btnSaveUrl')?.addEventListener('click', ()=>{
    const url = qs('#inpWebAppUrl')?.value.trim();
    if(!url) return alert('กรุณาวาง Web App URL');
    setUrl(url);
    setMode(qs('#selSyncMode')?.value || 'auto');
    updateStatus('บันทึกการตั้งค่าแล้ว');
  });

  qs('#selSyncMode')?.addEventListener('change', e=>{
    setMode(e.target.value || 'auto');
    updateStatus(`โหมดซิงก์: ${getMode()}`);
  });

  qs('#btnTest')?.addEventListener('click', async ()=>{
    const url = getUrl(); if(!url) return alert('ยังไม่ตั้งค่า URL');
    try{
      const ping = await fetch(url).then(r=>r.text());
      console.log('Ping:', ping);
      updateStatus('ทดสอบเชื่อมต่อ OK');
      alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
    }catch(err){
      updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
      alert('เชื่อมต่อไม่ได้ ❌\n'+err);
    }
  });

  qs('#btnPushPending')?.addEventListener('click', ()=>trySync());

  window.addEventListener('load', fillUi);

  /* ให้ app.js เรียกใช้ได้ */
  window.enqueueSale = enqueueSale;
  window.trySync = trySync;
})();
