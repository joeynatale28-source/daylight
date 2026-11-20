/** Live: Manage users lists the REAL accounts of this project (read through the same owner-only function the page uses, as a throwaway owner), and the page renders them. */
import {check,sleep,makeUser,tokenFor,cleanup,launchBrowser,siteUrl,failures,skipCheck,mgmt,BASE,ANON}from './live-lib.mjs';
const site=await siteUrl();const browser=await launchBrowser();
try{
 const A=await makeUser('mu',{owner:true,name:'QA Owner MU'});const tok=await tokenFor(A);
 const rows0=await (await fetch(BASE+'/rest/v1/rpc/support_users_list',{method:'POST',headers:{apikey:ANON,authorization:'Bearer '+tok.access_token,'content-type':'application/json'},body:JSON.stringify({p_q:'',p_limit:50,p_offset:0})})).json();
 const rows=rows0&&rows0.rows?rows0.rows:rows0;
 const real=await mgmt("select email from auth.users");const emails=new Set(real.map(r=>r.email));
 const names=(Array.isArray(rows)?rows:[]).map(r=>r.email||r.name||JSON.stringify(r));
 console.log('INFO rpc returned',Array.isArray(rows)?rows.length:rows,'rows');
 check(Array.isArray(rows)&&rows.length===real.length,'the list has exactly as many people as the project has accounts ('+real.length+')',{got:Array.isArray(rows)?rows.length:rows});
 check(Array.isArray(rows)&&rows.every(r=>emails.has(r.email)),'every listed person is a real account of this project',names);
 check(!JSON.stringify(rows).match(/Nathan T|Chris D|Ava G/),'no placeholder people (Nathan T., Chris D., Ava G.)');
 const ctx=await browser.createBrowserContext();const page=await ctx.newPage();await page.setViewport({width:1440,height:900});await skipCheck(page);
 await page.goto(site.url+'login/',{waitUntil:'domcontentloaded'});await page.evaluate(s=>{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify(s));localStorage.setItem('daylight-onboarded','1');sessionStorage.setItem('daylight-admin-tab','users')},tok);
 await page.goto(site.url+'dashboard/admin',{waitUntil:'load'});await sleep(8000);
 const shown=await page.evaluate(()=>({text:document.querySelector('.dl-um-host')?.innerText||'',rows:document.querySelectorAll('.dl-um-row,.dl-um-person,[data-user]').length}));
 console.log('INFO page shows',shown.rows,'rows;',shown.text.replace(/\s+/g,' ').slice(0,300));
 check(!/Nathan T|Chris D|Ava G/.test(shown.text)&&/QA Owner MU|Joey Natale|Stephen Natale|Daylight Test/.test(shown.text),'the Admin Users tab shows the real accounts',shown.text.slice(0,200));
}catch(e){check(false,'exception: '+String(e.stack||e).slice(0,400))}finally{await cleanup();await browser.close();site.close()}
console.log(failures()?'FAILURES '+failures():'ALL OK');process.exit(failures()?1:0);
