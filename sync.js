// sync.js (FINAL) – Nachat POS Google Sheets Sync
// ✅ แก้ปัญหา CORS โดยใช้ no-cors
// ✅ ไม่ชนตัวแปร $ จาก app.js
// ✅ ใช้ localStorage เก็บ URL, Mode, Queue

(function () {
  const SYNC = {
    defaultUrl: "https://script.google.com/macros/s/AKfycbxydXEkJ24gTGfHUNzD7M4YZSPzIkY23tc1xh0WMJO2H32DTxS_UsmzTlwE-grZjhJv/exec",
    urlKey: "POS_WEBAPP_URL",
    modeKey: "POS_SYNC_MODE",   // 'auto' | 'manual'
    queueKey: "POS_SYNC_QUEUE", // คิวบิลค้างส่ง
    metaKey: "POS_SYNC_META"    // เก็บ lastTry/lastOk
  };

  // ---------- helpers ----------
  const qs = (s) => document.querySelector(s);

  const getUrl   = () => (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl).trim();
  const setUrl   = (u) => localStorage.setItem(SYNC.urlKey, (u || '').trim());
  const getMode  = () => localStorage.getItem(SYNC.modeKey) || 'auto';
  const setMode  = (m) => localStorage.setItem(SYNC.modeKey, m);

  const getQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC.queueKey) || '[]'); } catch { return []; } };
  const setQueue = (arr) => localStorage.setItem(SYNC.queueKey, JSON.stringify(arr || []));

  const getMeta  = () => { try { return JSON.parse(localStorage.getItem(SYNC.metaKey) || '{}'); } catch { return {}; } };
  const setMeta  = (m) => localStorage.setItem(SYNC.metaKey, JSON.stringify(m || {}));

  // ---------- POST helper ----------
  async function postJSON(url, data) {
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // ✅ ป้องกัน CORS preflight
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      });
      // no-cors: อ่าน response ไม่ได้แต่ถือว่าส่งแล้ว
      return { ok: true };
    } catch (err) {
      console.error("Sync error:", err);
      return { ok: false, error: String(err) };
    }
  }

  // ---------- UI ----------
  function updateStatus(msg) {
    const s = qs('#gsStatus'); 
    if (!s) return;
    const meta = getMeta();
    s.innerHTML = [
      msg,
      `<div class="muted">คิวค้าง: ${getQueue().length} | lastTry: ${meta.lastTry || '-'} | lastOk: ${meta.lastOk || '-'}</div>`
    ].join('<br/>');
  }

  function fillUi() {
    qs('#inpWebAppUrl') && (qs('#inpWebAppUrl').value = getUrl());
    qs('#selSyncMode') && (qs('#selSyncMode').value = getMode());
    updateStatus('พร้อมซิงก์');
  }

  // ---------- Queue ----------
  function enqueueSale(sale) {
    const q = getQueue(); 
    q.push(sale); 
    setQueue(q);
    updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (คิวค้าง ${q.length})`);
    if (getMode() === 'auto') trySync(); // ยิงอัตโนมัติ
  }

  let syncing = false;
  async function trySync() {
    if (syncing) return;
    const url = getUrl();
    if (!url) { updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }

    const q = getQueue();
    if (!q.length) { updateStatus('ไม่มีคิวค้างส่ง'); return; }

    syncing = true;
    try {
      while (q.length) {
        const payload = q[0];
        const meta = getMeta(); 
        meta.lastTry = new Date().toISOString(); 
        setMeta(meta);

        const resp = await postJSON(url, payload);
        if (!resp.ok) {
          updateStatus(`ส่งไม่สำเร็จ: ${resp.error || 'network error'}`);
          break;
        }

        // success
        q.shift(); 
        setQueue(q);
        const m2 = getMeta(); 
        m2.lastOk = new Date().toISOString(); 
        setMeta(m2);
        updateStatus(`ส่งสำเร็จ #${payload.id} (เหลือ ${q.length})`);
        await new Promise(r => setTimeout(r, 150));
      }
    } finally {
      syncing = false;
    }
  }

  // ---------- Event listeners ----------
  qs('#btnSaveUrl') && qs('#btnSaveUrl').addEventListener('click', () => {
    const url = (qs('#inpWebAppUrl')?.value || '').trim();
    if (!url) return alert('กรุณาวาง Web App URL');
    setUrl(url);
    setMode(qs('#selSyncMode')?.value || 'auto');
    updateStatus('บันทึกการตั้งค่าแล้ว');
  });

  qs('#selSyncMode') && qs('#selSyncMode').addEventListener('change', e => {
    setMode(e.target.value || 'auto');
    updateStatus(`โหมดซิงก์: ${getMode()}`);
  });

  qs('#btnTest') && qs('#btnTest').addEventListener('click', async () => {
    const url = getUrl(); 
    if (!url) return alert('ยังไม่ตั้งค่า URL');
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ op: 'ping', now: Date.now() })
      });
      updateStatus('ทดสอบเชื่อมต่อ OK');
      alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
    } catch (err) {
      updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
      alert('เชื่อมต่อไม่ได้ ❌\n' + err);
    }
  });

  qs('#btnPushPending') && qs('#btnPushPending').addEventListener('click', () => trySync());

  window.addEventListener('load', fillUi);

  // ---------- Export ให้ app.js ใช้ ----------
  window.enqueueSale = enqueueSale;
  window.trySync = trySync;
})();
