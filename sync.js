/* Nachat POS – sync.js (pure JS) */

// ปล่อยเป็นโครงไว้ก่อน เพื่อไม่ให้ error
// ถ้าจะเชื่อม Google Sheets ให้ใส่ฟังก์ชัน fetch() ที่ POST ไปยัง Web App URL ที่ตั้งค่าไว้

const SYNC = {
  webAppUrlKey: "POS_WEBAPP_URL",
};

const $ = (sel) => document.querySelector(sel);

function getWebAppUrl() {
  return localStorage.getItem(SYNC.webAppUrlKey) || "";
}
function setWebAppUrl(url) {
  localStorage.setItem(SYNC.webAppUrlKey, url);
}

$("#btnSaveUrl")?.addEventListener("click", () => {
  const url = $("#inpWebAppUrl")?.value.trim() || "";
  if (!url) return alert("วาง Web App URL ก่อน");
  setWebAppUrl(url);
  alert("บันทึกแล้ว");
});

$("#btnTest")?.addEventListener("click", async () => {
  const url = getWebAppUrl();
  if (!url) return alert("ยังไม่ได้ตั้งค่า Web App URL");
  try {
    // แค่ HEAD/GET test (จริง ๆ ควรทำ POST echo)
    const res = await fetch(url, { method: "GET" });
    $("#gsStatus").textContent = res.ok ? "เชื่อมต่อได้" : `เชื่อมต่อไม่ได้ (HTTP ${res.status})`;
  } catch (e) {
    $("#gsStatus").textContent = "เชื่อมต่อไม่ได้";
  }
});

// preload url ในช่อง input หากมี
if ($("#inpWebAppUrl")) $("#inpWebAppUrl").value = getWebAppUrl();
