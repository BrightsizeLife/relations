/* ─────────────────────────────────────────────────────────────────────────────
   axe.mjs — run axe-core over a handful of routes in all three themes.

     node tools/axe.mjs                          # a representative sample
     node tools/axe.mjs index,survival,linreg    # named routes
     node tools/axe.mjs '' 8930                  # on another port

   Needs playwright, a chromium, and axe-core:
     npm i playwright axe-core && npx playwright install chromium
   ───────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const ROOT=new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
const fp=path.join(ROOT,p);if(!fs.existsSync(fp)){r.writeHead(404);r.end();return;}
r.writeHead(200,{'Content-Type':T[path.extname(fp)]||'text/plain'});r.end(fs.readFileSync(fp));});
const PORT=Number(process.argv[3]||8930);
await new Promise(r=>server.listen(PORT,r));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-proxy-server']});
const ROUTES=(process.argv[2]||'index,map,correlation,survival,regularisation,linreg,dags').split(',');
let bad=0;
for(const theme of ['dark','light','hc']){
  const p=await b.newPage({viewport:{width:1400,height:1000}});
  await p.addInitScript(t=>{try{localStorage.setItem('syw-theme',t)}catch(e){}}, theme);
  for(const route of ROUTES){
    await p.goto(`http://localhost:${PORT}/#/${route}`,{waitUntil:'domcontentloaded'});
    await p.waitForTimeout(1400);
    await p.addScriptTag({content:AXE});
    const res=await p.evaluate(async()=>await window.axe.run(document,{
      resultTypes:['violations'],
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']},
    }));
    for(const v of res.violations){
      bad++;
      console.log(`[${theme}] ${route}  ${v.impact}  ${v.id}: ${v.help}  (${v.nodes.length})`);
      v.nodes.slice(0,3).forEach(n=>console.log('       ', n.target.join(' '), '·', (n.failureSummary||'').split('\n').slice(1,3).join(' / ').slice(0,150)));
    }
  }
  await p.close();
}
console.log(`\nTOTAL VIOLATIONS: ${bad}`);
await b.close(); server.close();
