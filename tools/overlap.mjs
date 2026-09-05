/* ─────────────────────────────────────────────────────────────────────────────
   overlap.mjs — walk every step and every beat of every lesson and report any
   two pieces of text in the drawing whose boxes actually intersect.

   The target is zero. A label sitting on another label is not a small thing on
   a site whose entire claim is that you can see the arithmetic.

     node tools/overlap.mjs                 # every lesson
     node tools/overlap.mjs correlation,glm # just these
     node tools/overlap.mjs '' 8911         # on another port

   Needs playwright and a chromium; nothing else here does, which is why it
   lives outside the site's dependency-free promise:
     npm i playwright && npx playwright install chromium
   ───────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
const fp=path.join(ROOT,p);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){r.writeHead(404);r.end();return;}
r.writeHead(200,{'Content-Type':T[path.extname(fp)]||'text/plain'});r.end(fs.readFileSync(fp));});
const PORT=Number(process.argv[3]||8911);
await new Promise(r=>server.listen(PORT,r));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-proxy-server']});
const page=await b.newPage({viewport:{width:1500,height:1000}});
// a scene that throws draws nothing, and nothing has no overlaps — so a broken
// lesson would report clean. Count the errors and the marks as well.
const errs=[];
page.on('pageerror',e=>errs.push(e.message));
// reduced motion so nothing is mid-tween when we measure
await page.emulateMedia({reducedMotion:'reduce'});

const LESSONS=process.argv[2]
  ? process.argv[2].split(',')
  : [...fs.readFileSync(ROOT+'/js/registry.js','utf8').matchAll(/^\s+id: '([a-z]+)'/gm)].map(m=>m[1]);

const MEASURE = () => {
  const svg=document.querySelector('.cs-canvas'); if(!svg) return [];
  const els=[...svg.querySelectorAll('g.scene text')].filter(e=>{
    const o=parseFloat(getComputedStyle(e).opacity);
    return o>0.25 && e.textContent.trim().length;
  });
  // screen space, so rotations and group transforms are already applied — a
  // getBBox() comparison calls every rotated y-axis label a collision
  const sr=svg.getBoundingClientRect();
  const k=(svg.viewBox.baseVal.width/sr.width)||1;   // back into viewBox units
  const boxes=els.map(e=>{
    const r=e.getBoundingClientRect();
    if(!r.width||!r.height) return null;
    return {t:e.textContent.trim().slice(0,34), cls:e.getAttribute('class')||'',
      x:(r.left-sr.left)*k, y:(r.top-sr.top)*k, w:r.width*k, h:r.height*k};
  }).filter(Boolean);
  const hits=[];
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],c=boxes[j];
    // getBoundingClientRect is generous about ascender and descender space, so
    // allow 2 units in each direction before calling it a collision
    const ox=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x)-2;
    const oy=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y)-2;
    if(ox>0&&oy>0) hits.push({a:a.t,b:c.t,ax:+a.x.toFixed(0),ay:+a.y.toFixed(0),
      area:+(ox*oy).toFixed(0), ox:+ox.toFixed(0), oy:+oy.toFixed(0),
      ca:a.cls, cb:c.cls});
  }
  return hits;
};

let total=0;
for(const route of LESSONS){
  await page.goto(`http://localhost:${PORT}/#/${route}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  const steps=await page.locator('.cs-step').count();
  if(!steps) continue;
  for(let i=0;i<steps;i++){
    await page.locator('.cs-step').nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const dots=page.locator('.cs-beat-dot');
    const nb=Math.max(1, await dots.count());
    for(let bt=0;bt<nb;bt++){
      if(await dots.count()>bt) await dots.nth(bt).click({timeout:1500}).catch(()=>{});
      await page.waitForTimeout(160);
      const marks=await page.evaluate(()=>document.querySelectorAll('g.scene > *').length);
      if(marks===0) console.log(`!! ${route} step${i+1} beat${bt+1}: EMPTY SCENE`);
      const hits=await page.evaluate(MEASURE);
      for(const h of hits.filter(h=>h.area>=6)){
        total++;
        console.log(`${route} step${i+1} beat${bt+1}  [${h.area}px²  ${h.ox}×${h.oy}]  "${h.a}" (${h.ca}) ✕ "${h.b}" (${h.cb})  @${h.ax},${h.ay}`);
      }
    }
  }
}
console.log(`\nTOTAL OVERLAPS: ${total}`);
console.log(errs.length?`PAGE ERRORS: ${errs.length}\n  ${[...new Set(errs)].join('\n  ')}`:'PAGE ERRORS: 0');
await b.close(); server.close();
