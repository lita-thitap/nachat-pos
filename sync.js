// sync.js (FINAL)
// Nachat POS – Google Sheets Sync (frontend)
// - ไม่ประกาศ $ ชนกับ app.js
// - fetch แบบ text/plain เพื่อตัด preflight
// - export เฉพาะ enqueueSale / trySync

(function () {
  const SYNC = {
    defaultUrl: "https://script.google.com/macros/s/AKfycbxydXEkJ24gTGfHUNzD7M4YZSPzIkY23tc1xh0WMJO2H32DTxS_UsmzTlwE-grZjhJv/exec",
    urlKey: "POS_WEBAPP_URL",
    modeKey: "POS_SYNC_MODE",     // 'auto' | 'manual'
    queueKey: "POS_SYNC_QUEUE",   // คิวบิลค้างส่ง
    metaKey: "POS_SYNC_META"      // lastTry / lastOk
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

  async function postJSON(url, data) {
    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
  }

  // ---------- queue / sync ----------
  function updateStatus(msg) {
    const s = qs('#gsStatus'); if (!s) return;
    const meta = getMeta();
    s.innerHTML = [
      msg,
      `<div class="muted">คิวค้าง: ${getQueue().length} | lastTry: ${meta.lastTry || '-'} | lastOk: ${meta.lastOk || '-'}</div>`
    ].join('<br/>');
  }

  function enqueueSale(sale) {
    const q = getQueue(); q.push(sale); setQueue(q);
    updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (คิวค้าง ${q.length})`);
    if (getMode() === 'auto') trySync();
  }

  let syncing = false;
  async function trySync() {
    if (syncing) return;
    const url = getUrl();
    if (!url) { updateStatus('ยังไม่ตั้งค่า Web App URL'); return; }

    const q = getQueue(); if (!q.length) { updateStatus('ไม่มีคิวค้างส่ง'); return; }

    syncing = true;
    try {
      while (q.length) {
        const payload = q[0];
        const meta    = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

        let ok = false, resp = null;
        try {
          // ด้านหน้า: ส่ง single sale ไปให้ GAS
          resp = await postJSON(url, payload);
          ok   = !!(resp && resp.ok !== false);
        } catch (e) {
          updateStatus(`ส่งไม่สำเร็จ: ${e}`);
          break;
        }

        if (!ok) {
          updateStatus(`ส่งไม่สำเร็จ: ${(resp && resp.error) || 'unknown error'}`);
          break;
        }

        // success
        q.shift(); setQueue(q);
        const m2 = getMeta(); m2.lastOk = new Date().toISOString(); setMeta(m2);
        updateStatus(`ส่งสำเร็จ #${payload.id} (เหลือ ${q.length})`);

        await new Promise(r => setTimeout(r, 150)); // กันยิงถี่
      }
    } finally {
      syncing = false;
    }
  }

  // ---------- UI binding (Reports tab) ----------
  function fillUi() {
    qs('#inpWebAppUrl') && (qs('#inpWebAppUrl').value = getUrl());
    qs('#selSyncMode') && (qs('#selSyncMode').value = getMode());
    updateStatus('พร้อมซิงก์');
  }

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
    const url = getUrl(); if (!url) return alert('ยังไม่ตั้งค่า URL');
    try {
      const ping = await fetch(url).then(r => r.text());
      console.log('Ping:', ping);
      updateStatus('ทดสอบเชื่อมต่อ OK');
      alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
    } catch (e) {
      updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
      alert('เชื่อมต่อไม่ได้ ❌\n' + e);
    }
  });

  qs('#btnPushPending') && qs('#btnPushPending').addEventListener('click', () => trySync());
  window.addEventListener('load', fillUi);

  // export เฉพาะที่ app.js ต้องใช้
  window.enqueueSale = enqueueSale;
  window.trySync     = trySync;
})();
