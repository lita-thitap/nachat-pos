<!-- ============================== sync.js ============================== -->
<script type="module" id="sync-js">
(function(){
  const badge=document.getElementById('syncState');
  window.SYNC = window.SYNC || { enabled:true, url: localStorage.getItem('SYNC_URL')||'', shopId:'nachat-pos', intervalMs:30000 };
  const META='SYNC_META_V1';
  const getMeta=()=>{ try{return JSON.parse(localStorage.getItem(META)||'{}')}catch{return{}} };
  const setMeta=p=>{ const m={...getMeta(),...p}; localStorage.setItem(META,JSON.stringify(m)); return m };
  const setBadge=(t,ok)=>{ if(!badge) return; badge.textContent=t; badge.style.color= ok?'#8de48d':'#93a0ae'; };

  async function post(url,payload){
    const res = await fetch(url,{ method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload)});
    const txt=await res.text(); try{return JSON.parse(txt)}catch{return {ok:false,raw:txt}} }

  async function pull(immediate=false){ if(!SYNC.enabled||!SYNC.url) return false; const meta=getMeta(); try{ const data=await post(SYNC.url,{op:'pull',shopId:SYNC.shopId,since: immediate?0:(meta.lastPull||0)}); if(Array.isArray(data?.bills)) merge(data.bills); setMeta({lastPull:data?.now||Date.now()}); setBadge('online',true); return true }catch{ setBadge('offline',false); return false } }
  async function push(){ if(!SYNC.enabled||!SYNC.url) return false; try{ const s=window.Adapter.getState(); const bills=[...(s.openBills||[]),...(s.closedBills||[])]; await post(SYNC.url,{op:'push',shopId:SYNC.shopId,bills}); setBadge('online',true); pull(true); return true }catch{ setBadge('offline',false); return false } }
  function merge(incoming){ const s=window.Adapter.getState(); const map=new Map([...s.openBills,...s.closedBills].map(b=>[b.id,b])); incoming.forEach(b=>{ const has=map.get(b.id); const inMs=Date.parse(b.updatedAt||0); if(!has){ (b.status==='closed'? s.closedBills:s.openBills).unshift(b) } else { const hasMs=Date.parse(has.updatedAt||0); if(inMs>hasMs) Object.assign(has,b) } }); window.Adapter.setState(s); }

  function start(){ pull(true); setInterval(()=>pull(false), SYNC.intervalMs); }

  window.Sync={ loadConfig:()=>{ SYNC.url = localStorage.getItem('SYNC_URL')||SYNC.url||'' }, pull, push, pushSoon:()=>setTimeout(push,200), test:async()=>{ if(!SYNC.url) return false; try{ const r=await post(SYNC.url,{op:'pull',shopId:SYNC.shopId,since:0}); return !!r }catch{return false} } };
  document.addEventListener('DOMContentLoaded', start);
})();
</script>