/* Shared analytics for the studio website. No names, contacts or custom free text. */
(function(){
  if(new URLSearchParams(location.search).get('thumbnail')==='1')return;
  const isCatalog=/\/katalog\//.test(location.pathname);
  const ownDomain=/^(www\.)?zagorodnaya-studiya\.ru$/.test(location.hostname);
  const id=ownDomain?114379195:(isCatalog?114125638:113657787);
  window.STUDIO_METRIKA_ID=id;
  window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};window.ym.l=Date.now();
  const script=document.createElement('script');script.async=true;script.src='https://mc.yandex.ru/metrika/tag.js?id='+id;document.head.appendChild(script);
  ym(id,'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true,trackHash:!isCatalog});
  let lastActivity=Date.now(),lastTick=Date.now(),activeSeconds=0,entered=false,changeTimer=null;
  const thresholds=new Set();
  function inBuilder(){return location.hash.startsWith('#/build') && !isCatalog;}
  function project(){try{const p=JSON.parse(localStorage.getItem('modul-build-v1')||'null');if(!p)return {};return {size:p.size,layout:p.layout,terrace:p.terrace,wall:p.wall,accent:p.accent,insulation:p.ins150?'150':'standard',active_seconds:Math.round(activeSeconds)};}catch(e){return {};}}
  function goal(name,params){try{ym(id,'reachGoal',name,params||{});if(name.startsWith('builder_')&&params&&params.size)ym(id,'params',{builder_project:params});}catch(e){}}
  function tick(){const now=Date.now();if(inBuilder()&&document.visibilityState==='visible'&&now-lastActivity<60000){activeSeconds+=Math.min(5,(now-lastTick)/1000);for(const n of [30,60,180,300])if(activeSeconds>=n&&!thresholds.has(n)){thresholds.add(n);goal('builder_active_'+n,project());}}lastTick=now;}
  function enter(){if(inBuilder()&&!entered){entered=true;activeSeconds=0;thresholds.clear();lastTick=lastActivity=Date.now();goal('builder_open',project());}else if(!inBuilder()&&entered){tick();goal('builder_time',project());entered=false;}}
  window.STUDIO_ANALYTICS={goal,project,changed(){if(!inBuilder())return;clearTimeout(changeTimer);changeTimer=setTimeout(()=>goal('builder_change',project()),1200);}};
  for(const event of ['pointerdown','pointermove','keydown','scroll','touchstart'])document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
  addEventListener('hashchange',enter);addEventListener('pagehide',()=>{tick();if(entered)goal('builder_time',project());});
  document.addEventListener('visibilitychange',()=>{tick();if(document.visibilityState==='hidden'&&entered)goal('builder_time',project());});
  document.addEventListener('DOMContentLoaded',()=>{enter();document.addEventListener('click',e=>{const t=e.target.closest('button,a');if(!t)return;
    if(t.matches('[data-build]'))goal('builder_click');
    if(!isCatalog&&t.matches('a[href^="tel:"]'))goal('call_click');
    if(!isCatalog&&t.matches('a[href*="t.me"],a[href*="vk.me"]'))goal('write_click');
    if(t.id==='buy'&&inBuilder())goal('builder_summary',project());
    if(t.id==='b-lead')goal('builder_request',project());
    if(t.id==='b-share')goal('builder_share',project());
    if(t.id==='b-img')goal('builder_image',project());
    if(t.matches('[data-k]'))goal('builder_option',{option:t.dataset.k,value:t.dataset.v,...project()});
  });});
  setInterval(tick,5000);
})();
