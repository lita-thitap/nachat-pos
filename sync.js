// sync.js — เวอร์ชันกันชน ไม่ชนกับตัวแปร global
(()=>{ 'use strict';

  // เก็บ key ชื่อเดียว
  const SYNC = { webAppUrlKey: 'POS_WEBAPP_URL' };

  // helper เฉพาะไฟล์นี้ (ตั้งชื่อ qs เพื่อไม่ชนกับ $ ใน app.js)
  const qs = (sel, el=document)=> el.querySelector(sel);

  // เก็บ/อ่าน Web App URL สำหรับ Apps Script
  function getWebAppUrl(){
    return localStorage.getItem(SYNC.webAppUrlKey) || '';
  }
  function setWebAppUrl(url){
    localStorage.setItem(SYNC.webAppUrlKey, (url || '').trim());
  }

  // ปุ่มบันทึก URL (ถ้ามีอยู่ในหน้า)
  qs('#btnSaveUrl')?.addEventListener('click', () => {
    const url = (qs('#inpWebAppUrl')?.value || '').trim();
    if (!url) { alert('วาง Web App URL ก่อน'); return; }
    setWebAppUrl(url);
    alert('บันทึกแล้ว');
  });

  // เผยฟังก์ชันให้อีกไฟล์เรียกใช้ได้ ถ้าจำเป็น
  window.getWebAppUrl = getWebAppUrl;

})();
