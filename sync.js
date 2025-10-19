/* --- แทนที่ฟังก์ชันเดิมทั้งก้อนนี้ใน sync.js --- */

// ส่งแบบ no-cors เพื่อตัด preflight/CORS
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    mode: 'no-cors',                         // << สำคัญ
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  // opaque response จะมี status = 0 เสมอ ถือว่าสำเร็จถ้าไม่ throw
  return { ok: true };
}

// ปุ่มทดสอบเชื่อมต่อ: ใช้ no-cors เช่นกัน
$('#btnTest')?.addEventListener('click', async () => {
  const url = getUrl();
  if (!url) { alert('ยังไม่ตั้งค่า URL'); return; }
  try {
    await fetch(url, { mode: 'no-cors' });   // << สำคัญ
    updateStatus('ทดสอบเชื่อมต่อ OK');
    alert('ทดสอบเชื่อมต่อสำเร็จ ✅');
  } catch (err) {
    updateStatus('ทดสอบเชื่อมต่อไม่สำเร็จ');
    alert('เชื่อมต่อไม่ได้ ❌\n' + err);
  }
});
