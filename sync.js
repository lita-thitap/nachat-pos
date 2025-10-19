/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* ปรับให้เป็น simple request (text/plain) เพื่อตัดปัญหา CORS/preflight */

const SYNC = {
  // ค่าเริ่มต้น (แก้เป็นลิงก์ของคุณได้เลย หรือให้ผู้ใช้วางผ่าน UI)
  defaultUrl: "https://script.google.com/macros/s/AKfycbxYnp_ej9skdX1xwqonygTHVcpGS-yP2kFGMjvQmIaPcdARPAWG0w0B8KQw12aLea1j/exec",
  urlKey: "POS_WEBAPP_URL",
  modeKey: "POS_SYNC_MODE",         // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",       // คิวบิลค้างส่ง
  metaKey: "POS_SYNC_META"          // เก็บ lastTry/lastOk/error
};

/* -------------- Storage helpers -------------- */
const $ = (s) => document.querySelector(s);

function getUrl() {
  return (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim();
}
function setUrl(u) {
  localStorage.setItem(SYNC.urlKey, (u || '').trim());
}
function getMode() {
  return localStorage.getItem(SYNC.modeKey) || 'auto';
}
function setMode(m) {
  localStorage.setItem(SYNC.modeKey, m);
}
function getQueue() {
  try { return JSON.parse(localStorage.getItem(SYNC.queueKey) || '[]'); } catch { return []; }
}
function setQueue(arr) {
  localStorage.setItem(SYNC.queueKey, JSON.stringify(arr || []));
}
function getMeta() {
  try { return JSON.parse(localStorage.getItem(SYNC.metaKey) || '{}'); } catch { return {}; }
}
function setMeta(m) {
  localStorage.setItem(SYNC.metaKey, JSON.stringify(m || {}));
}

/* -------------- POST helper (text/plain) -------------- */
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  const text = await res.text(); // Apps Script อาจส่ง JSON/ข้อความ
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

/* -------------- Queue API -------------- */
// เรียกจาก app.js ตอน "ปิดบิล" สำเร็จ
// sale = { id, table, staff, items:[], total, createdAt, payment:{method, received, change} }
function enqueueSale(sale) {
  const q = getQueue();
  q.push(sale);
  setQueue(q);
  updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (${q.length} คิวค้าง)`);
  if (getMode() === 'auto') trySync();  // auto: ยิงทันที
}

// ยิงไปทีละใบ (ป้องกันชน) – ถ้ามี error จะหยุดและค้างไว้ในคิวเดิม
let syncRunning = false;
async function trySync() {
  if (syncRunning) return;
  const url = getUrl();
  if (!url) { updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }

  const q = getQueue();
  if (!q.length) { updateStatus('ไม่มีคิวค้างส่ง'); return; }

  syncRunning = true;
  try {
    for (let i = 0; i < q.length; i++) {
      const payload = q[0]; // ยิงตัวหน้าสุด
      const meta = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

      let ok = false, resp = null;
      try {
        resp = await postJSON(url, payload);
        ok = !!(resp && resp.ok !== false); // ถ้าไม่มี ok ให้ถือว่า ok
      } catch (err) {
        updateStatus(`ส่งไม่สำเร็จ: ${err}`);
        break; // ออกจาก loop (ไว้ยิงใหม่ทีหลัง)
      }

      if (!ok) {
        updateStatus(`ส่งไม่สำเร็จ: ${(resp && resp.error) || 'unknown error'}`);
        break;
      }

      // สำเร็จ -> ตัดออกจากคิว
      q.shift(); setQueue(q);
      const meta2 = getMeta(); meta2.lastOk = new Date().toISOString(); setMeta(meta2);
      updateStatus(`ส่งสำเร็จ #${payload.id} (คงเหลือ ${q.length})`);

      // ปล่อยเวลาเล็กน้อยกัน rate (คิวเยอะๆ)
      await new Promise(r => setTimeout(r, 150));
    }
  } finally {
    syncRunning = false;
  }
}

/* -------------- UI binding (รายงานขาย) -------------- */
function updateStatus(msg) {
  const s = $('#gsStatus');
  if (!s) return;
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

$('#btnSaveUrl')?.addEventListener('click', () => {
  const url = $('#inpWebAppUrl')?.value.trim();
  if (!url) { alert('กรุณาวาง Web App URL'); return; }
  setUrl(url);
  setMode($('#selSyncMode')?.value || 'auto');
  updateStatus('บันทึกการตั้งค่าแล้ว');
});

$('#selSyncMode')?.addEventListener('change', (e) => {
  setMode(e.target.value || 'auto');
  updateStatus(`โหมดซิงก์: ${getMode()}`);
});

$('#btnTest')?.addEventListener('click', async () => {
  const url = getUrl();
  if (!url) { alert('ยังไม่ตั้งค่า URL'); return; }
  try {
    const ping = await fetch(url).then(r => r.text());
    updateStatus('ทดสอบเชื่อมต่อ OK');
    console.log('Ping:', ping);
    alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
  } catch (err) {
    updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
    alert('เชื่อมต่อไม่ได้ ❌\n' + err);
  }
});

$('#btnPushPending')?.addEventListener('click', () => trySync());

/* -------------- Auto fill เมื่อโหลดหน้า -------------- */
window.addEventListener('load', fillUi);

/* -------------- Export ให้ app.js เรียกใช้ -------------- */
window.enqueueSale = enqueueSale;
window.trySync = trySync;
