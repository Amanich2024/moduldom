(function(){
'use strict';
let busy=false;
const W=1240,H=1754,pad=52;
async function downloadHouse(h){
 if(busy||!h)return;busy=true;
 const buttons=[...document.querySelectorAll('[data-house-pdf]')];buttons.forEach(b=>{b.disabled=true;b.textContent='Готовлю PDF…';});
 try{
  const pdf=await PDFLib.PDFDocument.create(),contacts=STUDIO_DATA.contacts;
  pdf.setTitle(h.title+' - Загородная студия');pdf.setAuthor('Загородная студия');
  const labels=[contacts.phone,'zagorodnaya-studiya.ru','ВКонтакте','Telegram','Авито'];
  const urls=['tel:'+contacts.phone,'https://zagorodnaya-studiya.ru',contacts.write,(contacts.telegram||contacts.channel).split('?')[0],contacts.avito];
  let cv,g,areas;
  function row(y){g.font='29px Arial';const gap=26,total=labels.reduce((s,l)=>s+g.measureText(l).width,0)+gap*4,font=Math.min(29,29*(W-pad*2)/total);g.font=font+'px Arial';let x=pad;labels.forEach((l,i)=>{const width=g.measureText(l).width;g.fillStyle='#176694';g.fillText(l,x,y);g.fillRect(x,y+4,width,1);areas.push({x,y,width,font,url:urls[i]});x+=width+gap;});}
  function newPage(){cv=document.createElement('canvas');cv.width=W;cv.height=H;g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);areas=[];g.fillStyle='#1d2125';g.font='bold 33px Arial';g.fillText('Загородная студия',pad,48);row(94);row(H-40);g.fillStyle='#d9deda';g.fillRect(pad,H-90,W-pad*2,1);}
  function wrap(text,x,y,width,font=29,line=40){g.font=font+'px Arial';g.fillStyle='#1d2125';let current='';for(const word of String(text).split(/\s+/)){const next=current?current+' '+word:word;if(g.measureText(next).width>width&&current){g.fillText(current,x,y);y+=line;current=word;}else current=next;}if(current){g.fillText(current,x,y);y+=line;}return y;}
  async function finish(){const im=await pdf.embedPng(cv.toDataURL('image/png')),s=595.28/W,page=pdf.addPage([595.28,H*s]);page.drawImage(im,{x:0,y:0,width:595.28,height:H*s});page.node.set(PDFLib.PDFName.of('Annots'),pdf.context.obj(areas.map(a=>pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[a.x*s,(H-a.y-8)*s,(a.x+a.width)*s,(H-a.y+a.font)*s],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFLib.PDFString.of(a.url)}})))));}
  newPage();let y=wrap(h.title,pad,160,W-2*pad,42,54)+28;
  const facts=(h.facts||[]).map(([k,v])=>k+': '+v);if(h.note)facts.push(h.note);if(h.spec?.length)facts.push('Комплектация:',...h.spec);
  for(const fact of facts){const estimated=Math.ceil(g.measureText(String(fact)).width/(W-pad*2))*40+25;if(y+estimated>H-130){await finish();newPage();y=160;}y=wrap(fact,pad,y,W-2*pad)+20;}await finish();
  for(let i=0;i<h.photos.length;i++){
   const photo=h.photos[i],im=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось загрузить фото '+(i+1)));image.src='img/'+photo[0]+'.webp';});
   newPage();wrap(h.title,pad,154,W-pad*2,34,44);const maxW=W-pad*2,maxH=1280,scale=Math.min(maxW/im.naturalWidth,maxH/im.naturalHeight),w=im.naturalWidth*scale,hh=im.naturalHeight*scale;g.drawImage(im,(W-w)/2,210,w,hh);wrap((photo[2]?'План. ':'')+(i+1)+' / '+h.photos.length+'. '+photo[1],pad,1540,W-pad*2,25,34);await finish();
  }
  const url=URL.createObjectURL(new Blob([await pdf.save()],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='zagorodnaya-studiya-'+(h.id||'dom')+'.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){alert('Не удалось скачать PDF. '+e.message);}finally{busy=false;buttons.forEach(b=>{b.disabled=false;b.textContent='Скачать проект (PDF)';});}
}
window.STUDIO_PROJECT_PDF={downloadHouse};
})();
