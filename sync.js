/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* ส่งแบบ text/plain เพื่อหลบ preflight/CORS ของ Apps Script */
/* ห่อทั้งไฟล์ใน IIFE กันตัวแปรชนกับไฟล์อื่น (เช่น app.js) */
(() => {
  const SYNC = {
    // ใส่ลิงก์ Web App (/exec) หรือปล่อยว่างแล้ววางผ่าน UI
    defaultUrl: "https://script.google.com/macros/s/AKfycbzno4dN2mq-9u7Yns5IYzP2Ou90-feJ_tD7mYUbAnLOp8otG0lYweq_r237XfFN4Aoc/exec",
    urlKey:   "POS_WEBAPP_URL",
    modeKey:  "POS_SYNC_MODE",     // 'auto' | 'manual'
    queueKey: "POS_SYNC_QUEUE",    // คิวบิลค้างส่ง
    metaKey:  "POS_SYNC_META"      // lastTry/lastOk/log
  };

  /* ---------- helpers for storage / dom ---------- */
  const qs = (s) => document.querySelector(s); // <<< เปลี่ยนจาก $ เป็น qs (ไม่ชน app.js)

  const getUrl   = () => (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl || "").trim();
  const setUrl   = (u) => localStorage.setItem(SYNC.urlKey, (u||"").trim());

  const getMode  = () => localStorage.getItem(SYNC.modeKey) || "auto";
  const setMode  = (m) => localStorage.setItem(SYNC.modeKey, m);

  const getQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC.queueKey) || "[]"); } catch { return []; } };
  const setQueue = (arr) => localStorage.setItem(SYNC.queueKey, JSON.stringify(arr || []));

  const getMeta  = () => { try { return JSON.parse(localStorage.getItem(SYNC.metaKey) || "{}"); } catch { return {}; } };
  const setMeta  = (m) => localStorage.setItem(SYNC.metaKey, JSON.stringify(m || {}));

  /* ---------- POST as text/plain ---------- */
  async function postJSON(url, data) {
    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
  }

  /* ---------- map sale -> row object ให้ตรงชีต ---------- */
  // โครงสร้างชีตตาม COLS ใน Code.gs:
  // createdAt,id,table,customer,staff,device_id,status,discount,total,pay_method,received,change,items_json,updatedAt
  function toSheetRowObj(sale) {
    return {
      createdAt: sale.createdAt || new Date().toISOString(),
      id:        sale.id,
      table:     sale.table || "",
      customer:  "",
      staff:     sale.staff || "",
      device_id: "",
      status:    "closed",
      discount:  Number(sale.discount || 0),
      total:     Number(sale.total || 0),
      pay_method: sale.payment?.method || "",
      received:   Number(sale.payment?.received || 0),
      change:     Number(sale.payment?.change || 0),
      items_json: JSON.stringify(sale.items || []),
      updatedAt:  new Date().toISOString()
    };
  }

  /* ---------- public API ที่ app.js จะเรียก ---------- */
  // sale = { id, table, staff, items:[], total, createdAt, payment:{method,received,change} }
  function enqueueSale(sale) {
    const q = getQueue();
    q.push(sale);
    setQueue(q);
    updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (ค้าง ${q.length})`);
    if (getMode() === "auto") trySync();
  }

  /* ---------- main sync loop ---------- */
  let syncing = false;
  async function trySync() {
    if (syncing) return;
    const url = getUrl();
    if (!url) { updateStatus("ยังไม่ตั้งค่า Web App URL"); return; }

    const q = getQueue();
    if (!q.length) { updateStatus("ไม่มีคิวค้างส่ง"); return; }

    syncing = true;
    try {
      while (q.length) {
        // ส่งรูปแบบที่ Code.gs รู้จัก
        const payload = { op: "push", bills: [ toSheetRowObj(q[0]) ] };
        setMeta({ ...getMeta(), lastTry: new Date().toISOString() });

        let resp;
        try {
          resp = await postJSON(url, payload);
        } catch (e) {
          updateStatus("ส่งไม่สำเร็จ (network): " + e);
          break;
        }

        if (resp && resp.ok) {
          q.shift(); setQueue(q);
          setMeta({ ...getMeta(), lastOk: new Date().toISOString() });
          updateStatus(`ส่งสำเร็จ (เหลือ ${q.length})`);
          await new Promise(r => setTimeout(r, 150)); // กันยิงถี่
        } else {
          updateStatus("ส่งไม่สำเร็จ: " + (resp?.error || "unknown"));
          break;
        }
      }
    } finally {
      syncing = false;
    }
  }

  /* ---------- UI binding ---------- */
  function updateStatus(msg) {
    const s = qs("#gsStatus");
    if (!s) return;
    const qlen = getQueue().length;
    const meta = getMeta();
    s.innerHTML = [
      msg,
      `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry || "-"} | lastOk: ${meta.lastOk || "-"}</div>`
    ].join("<br/>");
  }

  function fillUi() {
    qs("#inpWebAppUrl") && (qs("#inpWebAppUrl").value = getUrl());
    qs("#selSyncMode")  && (qs("#selSyncMode").value  = getMode());
    updateStatus("พร้อมซิงก์");
  }

  qs("#btnSaveUrl")?.addEventListener("click", () => {
    const url = qs("#inpWebAppUrl")?.value.trim();
    if (!url) return alert("กรุณาวาง Web App URL (/exec)");
    setUrl(url);
    setMode(qs("#selSyncMode")?.value || "auto");
    updateStatus("บันทึกการตั้งค่าแล้ว");
  });

  qs("#selSyncMode")?.addEventListener("change", (e) => {
    setMode(e.target.value || "auto");
    updateStatus(`โหมดซิงก์: ${getMode()}`);
  });

  qs("#btnTest")?.addEventListener("click", async () => {
    const url = getUrl();
    if (!url) return alert("ยังไม่ตั้งค่า URL");
    try {
      const ping = await fetch(url).then(r => r.text());
      console.log("Ping:", ping);
      updateStatus("ทดสอบเชื่อมต่อ OK");
      alert("ทดสอบเชื่อมต่อสำเร็จ ✅");
    } catch (err) {
      updateStatus("ทดสอบเชื่อมต่อไม่สำเร็จ");
      alert("เชื่อมต่อไม่ได้ ❌\n" + err);
    }
  });

  qs("#btnPushPending")?.addEventListener("click", () => trySync());

  window.enqueueSale = enqueueSale; // export ให้ app.js เรียกใช้
  window.trySync = trySync;         // เผื่อกดทดสอบเอง
  window.addEventListener("load", fillUi);
})();
