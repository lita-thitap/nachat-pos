/* Nachat POS – app.js (pure JS, no HTML tags here) */

// ===== Local Storage Keys =====
const LS_KEYS = {
  MENU: "POS_MENU_V1",
  STATE: "POS_STATE_V1", // ไว้เผื่อเก็บบิล/สถานะอื่น ๆ
};

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== State =====
let MENU = loadJSON(LS_KEYS.MENU, []);

// ===== Render: ตารางตั้งค่าเมนู =====
function renderMenuTable() {
  const box = $("#menuTableBox");
  if (!box) return;

  const q = ($("#menuSearch")?.value || "").trim().toLowerCase();
  const cat = $("#menuFilter")?.value || "";

  const rows = MENU
    .filter(m => (!q || m.name.toLowerCase().includes(q)) && (!cat || m.cat === cat))
    .map(m => `
      <tr>
        <td>${m.name}</td>
        <td>${m.price.toLocaleString()}</td>
        <td>${m.cat}</td>
        <td>${m.code || "-"}</td>
        <td class="actions">
          <button class="btn" data-edit="${m.id}">แก้</button>
          <button class="btn danger" data-del="${m.id}">ลบ</button>
        </td>
      </tr>
    `).join("");

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ชื่อ</th><th class="col-price">ราคา</th><th>หมวด</th><th class="col-code">รหัส</th><th></th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">ยังไม่มีเมนู - เพิ่มด้านบนได้เลย</td></tr>`}</tbody>
    </table>
  `;

  // ลบ/แก้
  box.querySelectorAll("[data-del]").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      MENU = MENU.filter(m => m.id !== id);
      saveJSON(LS_KEYS.MENU, MENU);
      renderMenuTable();
      renderMenuPanels();
    };
  });
  box.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-edit");
      const m = MENU.find(x => x.id === id);
      if (!m) return;
      const newName = prompt("ชื่อเมนู", m.name);
      if (newName == null) return;
      const newPrice = Number(prompt("ราคา", m.price)) || 0;
      const newCat = prompt("หมวด (SET/AD/DW/PR)", m.cat) || m.cat;
      const newCode = prompt("รหัส", m.code || "") || "";
      m.name = newName.trim();
      m.price = newPrice;
      m.cat = newCat.trim().toUpperCase();
      m.code = newCode.trim();
      saveJSON(LS_KEYS.MENU, MENU);
      renderMenuTable();
      renderMenuPanels();
    };
  });
}

// ===== Render: บัตรเมนูในหน้า POS =====
function renderMenuPanels() {
  const host = $("#menuPanels");
  if (!host) return;

  // แบ่งหมวด
  const cats = [
    { key:"SET", title:"ชุดหมูกระทะ" },
    { key:"AD",  title:"Add-on" },
    { key:"DW",  title:"เครื่องดื่ม" },
    { key:"PR",  title:"โปรเครื่องดื่ม" },
  ];

  const grouped = Object.fromEntries(cats.map(c => [c.key, []]));
  MENU.forEach(m => (grouped[m.cat] || (grouped[m.cat] = [])).push(m));

  host.innerHTML = cats.map(c => {
    const items = (grouped[c.key] || []).map(m => `
      <button class="btn" style="display:block;width:100%;margin:4px 0" data-add="${m.id}">
        ${m.name} <span class="pill">฿${m.price}</span>
      </button>
    `).join("");
    return `
      <div class="card">
        <h3>${c.title} <span class="mini muted">${(grouped[c.key]||[]).length} รายการ</span></h3>
        ${items || `<div class="muted mini">ยังไม่มีเมนูในหมวดนี้</div>`}
      </div>
    `;
  }).join("");

  // คลิกเพิ่มลงตะกร้า (เดโม – แค่แจ้งเตือน)
  host.querySelectorAll("[data-add]").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-add");
      const m = MENU.find(x=>x.id===id);
      if (m) alert(`เพิ่ม "${m.name}" ลงตะกร้า (เดโม)`);
    };
  });
}

// ===== Events: เพิ่มเมนูใหม่ =====
$("#btnAddMenu")?.addEventListener("click", () => {
  const name = ($("#newName")?.value || "").trim();
  const price = Number($("#newPrice")?.value || 0);
  const cat = ($("#newCat")?.value || "SET").trim().toUpperCase();
  const code = ($("#newCode")?.value || "").trim();

  if (!name || !price) {
    alert("กรอกชื่อและราคาให้ครบ");
    return;
  }
  const item = { id: crypto.randomUUID(), name, price, cat, code };
  MENU.push(item);
  saveJSON(LS_KEYS.MENU, MENU);

  // เคลียร์ช่องกรอก
  if ($("#newName")) $("#newName").value = "";
  if ($("#newPrice")) $("#newPrice").value = "";

  renderMenuTable();
  renderMenuPanels();
});

// ค้นหา/กรอง
$("#menuSearch")?.addEventListener("input", renderMenuTable);
$("#menuFilter")?.addEventListener("change", renderMenuTable);

// ===== Init =====
renderMenuTable();
renderMenuPanels();
