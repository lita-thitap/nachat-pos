/* ========== Nachat POS – Google Sheets Sync (frontend) ========== */
/* ส่งแบบ text/plain เพื่อหลบ preflight/CORS ของ Apps Script */

const SYNC = {
  // ใส่ลิงก์ Web App (/exec) ได้เลย หรือปล่อยว่างแล้ววางผ่าน UI ช่อง “Web App URL”
  defaultUrl: "https://script.google.com/macros/s/AKfycbz3PktISjWdIu8LHOdpC9dRh8QgZ0z91K5kHIUsuocnNnX6yr39fvnIlmd2VS5lyUva/exec",

  urlKey:   "POS_WEBAPP_URL",
  modeKey:  "POS_SYNC_MODE",    // 'auto' | 'manual'
  queueKey: "POS_SYNC_QUEUE",   // คิวบิลค้างส่ง
  metaKey:  "POS_SYNC_META"     // lastTry/lastOk/log
};

/* ---------- helpers for storage / dom ---------- */
const $ = s => document.querySelector(s);

const getUrl   = () => (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl || "").trim();
const setUrl   = u  => localStorage.setItem(SYNC.urlKey, (u||"").trim());

const getMode  = () => localStorage.getItem(SYNC.modeKey) || "auto";
const setMode  = m  => localStorage.setItem(SYNC.modeKey, m);

const getQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC.queueKey) || "[]"); } catch { return []; } };
const setQueue = arr => localStorage.setItem(SYNC.queueKey, JSON.stringify(arr || []));

const getMeta  = () => { try { return JSON.parse(localStorage.getItem(SYNC.metaKey) || "{}"); } catch { return {}; } };
const setMeta  = m   => localStorage.setItem(SYNC.metaKey, JSON.stringify(m || {}));

/* ---------- POST as text/plain ---------- */
async function postJSON(url, data) {
  const res  = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data)
  });
  const text = await res.text();          // Apps Script จะคืนเป็น text เสมอ
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

/* ---------- public API ที่ app.js จะเรียก ---------- */
// sale = { id, table, staff, items:[], total, createdAt, payment:{method,received,change} }
window.enqueueSale = function enqueueSale(sale) {
  const q = getQueue();
  q.push(sale);
  setQueue(q);
  updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (ค้าง ${q.length})`);
  if (getMode() === "auto") trySync();
};

/* ---------- main sync loop ---------- */
let syncing = false;
window.trySync = async function trySync() {
  if (syncing) return;
  const url = getUrl();
  if (!url) { updateStatus("ยังไม่ตั้งค่า Web App URL"); return; }

  const q = getQueue();
  if (!q.length) { updateStatus("ไม่มีคิวค้างส่ง"); return; }

  syncing = true;
  try {
    while (q.length) {
      const payload = { op: "sale", sale: q[0] };
      const meta = getMeta(); meta.lastTry = new Date().toISOString(); setMeta(meta);

      let ok = false, resp;
      try {
        resp = await postJSON(url, payload);
        ok = !!(resp && resp.ok !== false);
      } catch (e) {
        updateStatus(`ส่งไม่สำเร็จ: ${e}`);
        break; // ไว้มายิงใหม่รอบหน้า
      }

      if (!ok) {
        updateStatus(`ส่งไม่สำเร็จ: ${(resp && resp.error) || "unknown"}`);
        break;
      }

      // ตัดออกจากคิวเมื่อสำเร็จ
      q.shift(); setQueue(q);
      const meta2 = getMeta(); meta2.lastOk = new Date().toISOString(); setMeta(meta2);
      updateStatus(`ส่งสำเร็จ (เหลือ ${q.length})`);

      // กันยิงถี่ ๆ
      await new Promise(r => setTimeout(r, 150));
    }
  } finally {
    syncing = false;
  }
};

/* ---------- UI binding ในหน้า “รายงานขาย” ---------- */
function updateStatus(msg) {
  const s = $("#gsStatus");
  if (!s) return;
  const qlen = getQueue().length;
  const meta = getMeta();
  s.innerHTML = [
    msg,
    `<div class="muted">คิวค้าง: ${qlen} | lastTry: ${meta.lastTry || "-"} | lastOk: ${meta.lastOk || "-"}</div>`
  ].join("<br/>");
}

function fillUi() {
  $("#inpWebAppUrl") && ($("#inpWebAppUrl").value = getUrl());
  $("#selSyncMode") && ($("#selSyncMode").value = getMode());
  updateStatus("พร้อมซิงก์");
}

/* ปุ่ม UI */
$("#btnSaveUrl")?.addEventListener("click", () => {
  const url = $("#inpWebAppUrl")?.value.trim();
  if (!url) return alert("กรุณาวาง Web App URL (/exec)");
  setUrl(url);
  setMode($("#selSyncMode")?.value || "auto");
  updateStatus("บันทึกการตั้งค่าแล้ว");
});

$("#selSyncMode")?.addEventListener("change", (e) => {
  setMode(e.target.value || "auto");
  updateStatus(`โหมดซิงก์: ${getMode()}`);
});

$("#btnTest")?.addEventListener("click", async () => {
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

$("#btnPushPending")?.addEventListener("click", () => trySync());

/* โหลดค่าเริ่มต้น */
window.addEventListener("load", fillUi);
