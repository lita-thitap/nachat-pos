/* ========== Nachat POS – Google Sheets Sync (frontend, Bills + Menu) ========== */
(() => {
  const SYNC = {
    defaultUrl: "https://script.google.com/macros/s/AKfycbw6QkmuP9vHPZIHO9rzzKsS1Haz9cFkQtye2s66wkvukLt-MwjvAk-ZtfrgNHJzGoNo/exec",
    urlKey:   "POS_WEBAPP_URL",
    modeKey:  "POS_SYNC_MODE",
    queueKey: "POS_SYNC_QUEUE",
    metaKey:  "POS_SYNC_META",
    menuKey:  "POS_MENU_QUEUE", // ✅ เพิ่มคิวสำหรับเมนู
  };

  const qs = (s) => document.querySelector(s);
  const getUrl  = () => (localStorage.getItem(SYNC.urlKey) || SYNC.defaultUrl || "").trim();
  const setUrl  = (u) => localStorage.setItem(SYNC.urlKey, (u||"").trim());
  const getMode = () => localStorage.getItem(SYNC.modeKey) || "auto";
  const setMode = (m) => localStorage.setItem(SYNC.modeKey, m);

  const getQueue = () => { try { return JSON.parse(localStorage.getItem(SYNC.queueKey) || "[]"); } catch { return []; } };
  const setQueue = (arr) => localStorage.setItem(SYNC.queueKey, JSON.stringify(arr || []));
  const getMenuQ = () => { try { return JSON.parse(localStorage.getItem(SYNC.menuKey) || "null"); } catch { return null; } };
  const setMenuQ = (obj) => localStorage.setItem(SYNC.menuKey, JSON.stringify(obj || null));

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

  /* ---------- map sale -> row object ---------- */
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

  /* ---------- Bills Sync ---------- */
  function enqueueSale(sale) {
    const q = getQueue();
    q.push(sale);
    setQueue(q);
    updateStatus(`เข้าคิวบิล #${sale.id} แล้ว (ค้าง ${q.length})`);
    if (getMode() === "auto") trySync();
  }

  let syncing = false;
  async function trySync() {
    if (syncing) return;
    const url = getUrl();
    if (!url) return updateStatus("ยังไม่ตั้งค่า Web App URL");

    const q = getQueue();
    if (!q.length) return updateStatus("ไม่มีคิวค้างส่ง");

    syncing = true;
    try {
      while (q.length) {
        const payload = { op: "push", bills: [ toSheetRowObj(q[0]) ] };
        setMeta({ ...getMeta(), lastTry: new Date().toISOString() });
        let resp;
        try { resp = await postJSON(url, payload); }
        catch (e) { updateStatus("ส่งไม่สำเร็จ (network): " + e); break; }

        if (resp && resp.ok) {
          q.shift(); setQueue(q);
          setMeta({ ...getMeta(), lastOk: new Date().toISOString() });
          updateStatus(`ส่งสำเร็จ (เหลือ ${q.length})`);
          await new Promise(r => setTimeout(r, 150));
        } else {
          updateStatus("ส่งไม่สำเร็จ: " + (resp?.error || "unknown"));
          break;
        }
      }
    } finally { syncing = false; }
  }

  /* ---------- Menu Sync (ใหม่) ---------- */

  // ดึงเมนูจาก Cloud แล้วอัปเดต localStorage.pos_menu
  async function pullMenuFromCloud() {
    const url = getUrl();
    if (!url) return updateStatus("ยังไม่ตั้งค่า Web App URL");

    try {
      const res = await fetch(`${url}?action=getMenu`);
      const data = await res.json();
      if (!data?.ok || !Array.isArray(data.menu)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");

      localStorage.setItem("pos_menu", JSON.stringify(data.menu));
      window.renderMenu?.(); window.renderMenuTable?.();
      updateStatus(`ดึงเมนูจาก Cloud แล้ว (${data.menu.length} รายการ) ✅`);
    } catch (err) {
      updateStatus("ดึงเมนูล้มเหลว: " + err.message);
    }
  }

  // เข้าคิวส่งเมนูทั้งชุดขึ้น Cloud
  function enqueueMenu(menuArr) {
    if (!Array.isArray(menuArr)) return;
    const payload = { at: Date.now(), menu: menuArr };
    setMenuQ(payload);
    updateStatus(`เข้าคิวอัปเดตเมนู (${menuArr.length} รายการ)`);
    if (getMode() === "auto") pushMenuPending();
  }

  // ส่งเมนูที่ค้างในคิวขึ้น Cloud
  async function pushMenuPending() {
    const url = getUrl();
    const q = getMenuQ();
    if (!url || !q) return updateStatus("ไม่มีเมนูค้างส่งหรือยังไม่ตั้งค่า URL");

    try {
      const res = await postJSON(url, { action: "upsertMenu", payload: q });
      if (res?.ok) {
        localStorage.removeItem(SYNC.menuKey);
        updateStatus("อัปเดตเมนูขึ้น Cloud สำเร็จ ✅");
      } else {
        throw new Error(res?.error || "unknown");
      }
    } catch (err) {
      updateStatus("ส่งเมนูล้มเหลว: " + err.message);
    }
  }

  /* ---------- UI ---------- */
  function updateStatus(msg) {
    const s = qs("#gsStatus"); if (!s) return;
    const qlen = getQueue().length;
    const meta = getMeta();
    s.innerHTML = [
      msg,
      `<div class="muted">บิลค้าง: ${qlen} | lastTry: ${meta.lastTry || "-"} | lastOk: ${meta.lastOk || "-"}</div>`
    ].join("<br/>");
  }

  function fillUi() {
    qs("#inpWebAppUrl") && (qs("#inpWebAppUrl").value = getUrl());
    qs("#selSyncMode")  && (qs("#selSyncMode").value  = getMode());
    updateStatus("พร้อมซิงก์");
    if (getUrl()) pullMenuFromCloud(); // ✅ ดึงเมนูทุกครั้งที่เปิดหน้า
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
      const ping = await fetch(`${url}?action=ping`).then(r => r.json());
      if (ping.ok) alert("ทดสอบเชื่อมต่อสำเร็จ ✅");
      else throw new Error("Ping failed");
      updateStatus("ทดสอบเชื่อมต่อ OK");
    } catch (err) {
      updateStatus("ทดสอบเชื่อมต่อไม่สำเร็จ");
      alert("เชื่อมต่อไม่ได้ ❌\n" + err);
    }
  });

  qs("#btnPushPending")?.addEventListener("click", async () => {
    await trySync();
    await pushMenuPending();
  });

  window.enqueueSale = enqueueSale;
  window.trySync = trySync;
  window.enqueueMenu = enqueueMenu;
  window.pullMenuFromCloud = pullMenuFromCloud;
  window.pushMenuPending = pushMenuPending;
  window.addEventListener("load", fillUi);
})();
