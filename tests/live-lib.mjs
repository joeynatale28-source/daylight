/** Shared helpers for tests that run against the real Supabase project with throwaway accounts: environment, admin API, a Pages-like static server
 *  for the local build (SITE=local), and a browser. Nothing here ever touches a real person's account: every account is made here and deleted again. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const R=new URL('../',import.meta.url);
export const ROOT=path.resolve(new URL('.',R).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const env=Object.fromEntries(fs.readFileSync(new URL('.env',R),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
export const REF=env.NEW_PROJECT_REF,BASE=`https://${REF}.supabase.co`;
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;
export const check=(ok,m,x)=>{if(!ok)bad++;console.log((ok?'PASS ':'FAIL ')+m+(ok||x===undefined?'':' -> '+JSON.stringify(x).slice(0,400)))};
export const failures=()=>bad;
const keys=await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN}})).json();
export const SVC=keys.find(k=>k.name==='service_role').api_key,ANON=keys.find(k=>k.name==='anon').api_key;
export async function mgmt(sql){const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:sql})});return r.json()}
const made=[];
export async function makeUser(tag,{owner=false,name}={}){
 const stamp=Date.now()+Math.floor(Math.random()*1000),email=`qa.daylight.${tag}${stamp}@mailinator.com`,pw=`Qa-${stamp}Zz9!`;
 const cu=await (await fetch(BASE+'/auth/v1/admin/users',{method:'POST',headers:{apikey:SVC,authorization:'Bearer '+SVC,'content-type':'application/json'},body:JSON.stringify({email,password:pw,email_confirm:true,user_metadata:{full_name:name||('QA '+tag)}})})).json();
 if(!cu.id)throw new Error('could not create '+tag+': '+JSON.stringify(cu).slice(0,200));
 made.push(cu.id);
 if(owner)await mgmt(`insert into public.daylight_owners(user_id) values ('${cu.id}') on conflict do nothing`);
 return {id:cu.id,email,pw,name:name||('QA '+tag)};
}
export async function tokenFor(u){return (await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'content-type':'application/json'},body:JSON.stringify({email:u.email,password:u.pw})})).json()}
export async function cleanup(){
 if(!made.length)return;
 await mgmt(`delete from public.daylight_owners where user_id = any (array[${made.map(i=>`'${i}'`).join(',')}]::uuid[])`).catch(()=>{});
 for(const id of made)await fetch(`${BASE}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:{apikey:SVC,authorization:'Bearer '+SVC}}).catch(()=>{});
}
export const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome'].find(fs.existsSync);
export const launchBrowser=()=>process.env.HEADFUL?puppeteer.launch({executablePath:chrome,headless:false,defaultViewport:null,ignoreDefaultArgs:['--enable-automation'],args:['--no-sandbox','--disable-blink-features=AutomationControlled']}):puppeteer.launch({executablePath:chrome,headless:'new',args:['--no-sandbox']});

/* The local build served the way GitHub Pages serves it: folders get an index.html, a folder address without a trailing slash is redirected to
   the slash form, the deploy copies the app page into /dashboard/{tasks,support,admin}, and unknown paths get 404.html with a 404 status. */
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon','.woff2':'font/woff2'};
export async function serveLocal(){
 const copies=['tasks','support','admin'];
 const srv=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');let p=decodeURIComponent(u.pathname);
  const m=p.match(/^\/dashboard\/((?:tasks|support|admin)(?:\/users)?)(\/)?$/);
  let file;
  if(m&&(m[1]==='admin/users'||!/\//.test(m[1])||true)&&/^(tasks|support|admin|admin\/users)$/.test(m[1])){ if(!m[2]){res.writeHead(301,{location:p+'/'+u.search});return res.end()} file=path.join(ROOT,'dashboard','index.html') }
  else{
   file=path.join(ROOT,p);
   if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
   if(fs.existsSync(file)&&fs.statSync(file).isDirectory()){ if(!p.endsWith('/')){res.writeHead(301,{location:p+'/'+u.search});return res.end()} file=path.join(file,'index.html') }
  }
  if(!fs.existsSync(file)){file=path.join(ROOT,'404.html');res.statusCode=404}
  else res.statusCode=200;
  let body=fs.readFileSync(file);const ext=path.extname(file);
  if(ext==='.html'||ext==='.js')body=Buffer.from(body.toString('utf8').replace(/__BUILD_ID__/g,'localbuild'));
  res.setHeader('content-type',MIME[ext]||'application/octet-stream');res.setHeader('cache-control','no-store');
  res.end(body);
 });
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${srv.address().port}/`,close:()=>srv.close()};
}
export async function siteUrl(){
 if(process.env.SITE&&process.env.SITE!=='local')return {url:process.env.SITE.replace(/\/?$/,'/'),close(){}};
 if(process.env.SITE==='local')return serveLocal();
 return {url:'https://joeynatale28-source.github.io/daylight/',close(){}};
}
/* the same sign-in the real app stores */
export async function putSession(page,tok){
 await page.evaluate((s)=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s))},tok);
}
export const skipCheck=page=>page.evaluateOnNewDocument(()=>{try{sessionStorage.setItem('daylight-sc-ok',String(Date.now()+864e5))}catch(e){}});
