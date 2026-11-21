'use strict';
// Standalone, offline PDF writer. No external libraries or network calls.
(function(){
const enc=new TextEncoder();
const ascii=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/€/g,'EUR ').replace(/[^\x20-\x7e]/g,'-');
const esc=s=>ascii(s).replace(/[\\()]/g,'\\$&');
function dataBytes(url){const b=atob(url.split(',')[1]);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
async function jpeg(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas'),scale=Math.min(1,1100/Math.max(im.naturalWidth,im.naturalHeight));c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve({bytes:dataBytes(c.toDataURL('image/jpeg',0.72)),w:c.width,h:c.height})}catch(e){reject(e)}};im.onerror=reject;im.src=src})}
async function build(rows,start,end){
 const objs=[null];const add=v=>(objs.push(v),objs.length-1);const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const pages=[];const pageRoot=add('');
 const commands=[];let images=[];let y=795;
 function txt(t,x,yy,size=10){commands.push(`BT /F1 ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${esc(t)}) Tj ET`)}
 function line(yy){commands.push(`0.8 G 45 ${yy} m 550 ${yy} l S`)}
 function newPage(){if(commands.length){const stream=enc.encode(commands.join('\n'));const content=add({stream,dict:''});const resources=`<< /Font << /F1 ${font} 0 R >> /XObject << ${images.map(([name,id])=>`/${name} ${id} 0 R`).join(' ')} >> >>`;const page=add(`<< /Type /Page /Parent ${pageRoot} 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents ${content} 0 R >>`);pages.push(page)}commands.length=0;images=[];y=795}
 txt('Declaratie thuisladen zakelijke auto',45,y,18);y-=30;txt(`Periode: ${start} t/m ${end}`,45,y,11);y-=27;line(y);y-=22;
 txt('Datum',45,y,10);txt('kWh',195,y,10);txt('Tarief/kWh',290,y,10);txt('Bedrag',430,y,10);y-=14;line(y);y-=20;
 let totalKwh=0,totalCost=0;
 for(const x of rows){if(y<90){newPage();txt('Declaratie thuisladen - vervolg',45,y,15);y-=35}const cost=x.kwh*x.rate;totalKwh+=x.kwh;totalCost+=cost;txt(x.date,45,y);txt(x.kwh.toFixed(2),195,y);txt(`EUR ${x.rate.toFixed(4)}`,290,y);txt(`EUR ${cost.toFixed(2)}`,430,y);y-=20}
 if(y<130){newPage();txt('Declaratie thuisladen - totaal',45,y,15);y-=35}
 line(y);y-=25;txt(`Totaal: ${totalKwh.toFixed(2)} kWh - EUR ${totalCost.toFixed(2)}`,45,y,13);y-=26;txt('Tarief per laadbeurt vastgelegd. Energienota afzonderlijk bewaard.',45,y,9);y-=28;
 txt('Foto-bewijs van laadbeurten',45,y,13);y-=24;
 for(let i=0;i<rows.length;i++){
  const x=rows[i];if(!x.photo)continue;
  let pic;try{pic=await jpeg(x.photo)}catch{if(y<80)newPage();txt(`Foto ${i+1} kon niet worden verwerkt (${x.date})`,45,y);y-=20;continue}
  const maxW=480,maxH=300,scale=Math.min(maxW/pic.w,maxH/pic.h),w=pic.w*scale,h=pic.h*scale;
  if(y-h-35<48){newPage();txt('Foto-bewijs - vervolg',45,y,14);y-=35}
  txt(`${i+1}. ${x.date} - ${x.kwh.toFixed(2)} kWh`,45,y,10);y-=13;
  const id=add({stream:pic.bytes,dict:`/Type /XObject /Subtype /Image /Width ${pic.w} /Height ${pic.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`});const name=`Im${images.length+1}`;images.push([name,id]);commands.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 45 ${(y-h).toFixed(2)} cm /${name} Do Q`);y-=h+30;
 }
 newPage();objs[pageRoot]=`<< /Type /Pages /Kids [${pages.map(p=>`${p} 0 R`).join(' ')}] /Count ${pages.length} >>`;
 const catalog=add(`<< /Type /Catalog /Pages ${pageRoot} 0 R >>`);
 const chunks=[];let pos=0;function write(bytes){chunks.push(bytes);pos+=bytes.length}function str(s){write(enc.encode(s))}
 str('%PDF-1.4\n');const offsets=[0];for(let i=1;i<objs.length;i++){offsets[i]=pos;str(`${i} 0 obj\n`);const o=objs[i];if(typeof o==='string')str(o+'\n');else{str(`<< ${o.dict} /Length ${o.stream.length} >>\nstream\n`);write(o.stream);str('\nendstream\n')}str('endobj\n')}
 const xref=pos;str(`xref\n0 ${objs.length}\n0000000000 65535 f \n`);for(let i=1;i<objs.length;i++)str(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);str(`trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(chunks,{type:'application/pdf'});
}
 window.exportLaadPDF=async(rows,start,end)=>{const blob=await build(rows,start,end);const filename=`Laaddeclaratie_${start}_tm_${end}.pdf`;const file=new File([blob],filename,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Laaddeclaratie'});return}catch(e){if(e.name==='AbortError')return}}
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
};
})();
