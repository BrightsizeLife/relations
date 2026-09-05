/* ─────────────────────────────────────────────────────────────────────────────
   smoke.mjs — load every lesson, scroll every step, click through every beat,
   and report any JavaScript error, plus how many marks each scene drew.

   A lesson with marks = 0 is broken even if nothing threw.

     node tools/smoke.mjs

   Needs playwright and a chromium:
     npm i playwright && npx playwright install chromium
   ───────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
const fp=path.join(ROOT,p);if(!fp.startsWith(ROOT)||!fs.existsSync(fp)){r.writeHead(404);r.end();return;}
r.writeHead(200,{'Content-Type':T[path.extname(fp)]||'text/plain'});r.end(fs.readFileSync(fp));});
await new Promise(r=>server.listen(8899,r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-proxy-server']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!/ERR_CONNECTION|fonts.googleapis/.test(m.text()))errors.push('CONSOLE: '+m.text());});
page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
const LESSONS=[...fs.readFileSync(ROOT+'/js/registry.js','utf8').matchAll(/^\s+id: '([a-z]+)'/gm)].map(m=>m[1]);
console.log('lessons:',LESSONS.length);
let bad=0;
for(const route of ['index','map',...LESSONS]){
  errors.length=0;
  const t0=Date.now();
  await page.goto(`http://localhost:8899/#/${route}`,{waitUntil:'networkidle'});
  await page.waitForTimeout(700);
  const steps=await page.locator('.cs-step').count();
  for(let i=0;i<steps;i++){
    await page.locator('.cs-step').nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(240);
    const next=page.locator('.cs-beatbar .cs-mini-btn').nth(1);
    for(let b=0;b<7;b++){
      if(!(await next.isVisible().catch(()=>false))||!(await next.isEnabled().catch(()=>false)))break;
      await next.click({timeout:2000}).catch(()=>{});
      await page.waitForTimeout(110);
    }
  }
  for(const sl of (await page.locator('.cs-slider').all()).slice(0,6)){
    await sl.evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForTimeout(110);
    await sl.evaluate(el=>{el.value=el.min;el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForTimeout(110);
  }
  for(const b of (await page.locator('.cs-seg-btn').all()).slice(0,8)){await b.click({timeout:2000}).catch(()=>{});await page.waitForTimeout(140);}
  for(const b of (await page.locator('.cs-data-toggle').all()).slice(0,6)){await b.click({timeout:2000}).catch(()=>{});await page.waitForTimeout(140);}
  const marks=await page.locator('.scene > *').count();
  if(errors.length)bad++;
  console.log(`${route.padEnd(14)} steps=${String(steps).padStart(2)} marks=${String(marks).padStart(4)} ${((Date.now()-t0)/1000).toFixed(1)}s ${errors.length?'ERRORS:\n   '+errors.slice(0,3).join('\n   '):'ok'}`);
}
console.log(bad?`\n${bad} ROUTES WITH ERRORS`:'\nALL CLEAN');
await browser.close(); server.close();
