/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* Simple request (text/plain) เพื่อตัด preflight/CORS */

// ใช้ $ ร่วมกับ app.js; ถ้ายังไม่มีค่อยกำหนด (ป้องกันซ้ำ)
window.$ = window.$ || (sel => document.querySelector(sel));

const SYNC = {
  defaultUrl: "",                      // ใส่ URL Apps Script ที่ deploy เป็น Web App (อนุญาต Anonymous)
  urlKey: "POS_WEBAPP_URL",
  modeKey: "POS_SYNC_MODE",           // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",         // คิวบิลค้างส่ง
  metaKey: "POS_SYNC_META"            // เก็บ lastTry/lastOk/error
};

/* Storage helpers */
function getUrl()  { return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim(); }
function setUrl(u) { localStorage.setItem(SYNC.urlKey, (u || '').trim()); }
function getMode() { return localStorage.getItem(SYNC.modeKey) || 'auto'; }
function setMode(m){ localStorage.setItem(SYNC.modeKey, m); }
function getQueue(){ try {return JSON.parse(localStorage.getItem(SYNC.queueKey)||'[]')} catch{ return []} }
function setQueue(a){ localStorage.setItem(SYNC.queueKey, JSON.stringify(a||[])) }
function getMeta() { try {return JSON.parse(localStorage.getItem(SYNC.metaKey)||'{}')} catch{ return {}} }
function setMeta(m){ localStorage.setItem(SYNC.metaKey, JSON.stringify(m||{})) }

/* POST helper (text/plain) */
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

/* Queue API — เรียกจาก app.js ตอน “ปิดบิล” */
function enqueueSale(sale) {
  const q = getQueue(); q.push(sale); setQueue(q);
  updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (${q.length} คิวค้าง)`);
  if (getMode()==='auto') trySync();
}

/* ยิงทีละใบ, error ค้างคิวไว้ */
let syncRunning = false;
async function trySync() {
  if (syncRunning) return;
  const url = getUrl();
  if (!url) { updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }

  const q = getQueue();
  if (!q.length) { updateStatus('ไม่มีคิวค้างส่ง'); return; }

  syncRunning = true;
  try {
    while (q.length) {
      const payload = q[0];
      const meta = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

      // ฝั่ง Apps Script รับ payload แบบ “บิลเดียว” (ไม่ต้องมี op)
      let resp;
      try {
        resp = await postJSON(url, payload);
      } catch(err) {
        updateStatus('ส่งไม่สำเร็จ: ' + err);
        break;
      }
      if (resp && resp.ok===false) {
        updateStatus('ส่งไม่สำเร็จ: ' + (resp.error||'unknown'));
        break;
      }

      // สำเร็จ
      q.shift(); setQueue(q);
      const meta2 = getMeta(); meta2.lastOk = new Date().toISOString(); setMeta(meta2);
      updateStatus(`ส่งสำเร็จ #${payload.id} (คงเหลือ ${q.length})`);
      await new Promise(r=>setTimeout(r,120));
    }
  } finally {
    syncRunning = false;
  }
}

/* UI binding (รายงานขาย) */
function updateStatus(msg) {
  const s = $('#gsStatus'); if(!s) return;
  const qlen = getQueue().length;
  const meta = getMeta();
  s.innerHTML = [
    msg,
    `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry || '-'} | lastOk: ${meta.lastOk || '-'}</div>`
  ].join('<br/>');
}
function fillUi() {
  $('#inpWebAppUrl') && ($('#inpWebAppUrl').value = getUrl());
  $('#selSyncMode') && ($('#selSyncMode').value = getMode());
  updateStatus('พร้อมซิงก์');
}
$('#btnSaveUrl')?.addEventListener('click', ()=>{
  const url = $('#inpWebAppUrl')?.value.trim();
  if(!url) return alert('กรุณาวาง Web App URL');
  setUrl(url);
  setMode($('#selSyncMode')?.value || 'auto');
  updateStatus('บันทึกการตั้งค่าแล้ว');
});
$('#selSyncMode')?.addEventListener('change', e=>{
  setMode(e.target.value || 'auto'); updateStatus(`โหมดซิงก์: ${getMode()}`);
});
$('#btnTest')?.addEventListener('click', async ()=>{
  const url = getUrl(); if(!url) return alert('ยังไม่ตั้งค่า URL');
  try {
    const ping = await fetch(url).then(r=>r.text());
    console.log('Ping:', ping);
    updateStatus('ทดสอบเชื่อมต่อ OK'); alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
  } catch(err) {
    updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ'); alert('เชื่อมต่อไม่ได้ ❌\n'+err);
  }
});
$('#btnPushPending')?.addEventListener('click', ()=>trySync());
window.addEventListener('load', fillUi);

/* export ให้ app.js เรียก */
window.enqueueSale = enqueueSale;
window.trySync = trySync;
