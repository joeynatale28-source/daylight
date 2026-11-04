/**
 * Visual regression reference only: this loads the actual local Daylight UI
 * with an in-memory, fake signed-in account. It NEVER exercises real Supabase
 * credentials, MCP calls or production data. Do not use as integration proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const binary=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable']
  .find(x=>fs.existsSync(x));
if(!binary){console.log('CHROME_NOT_INSTALLED: skipping visual reference capture');process.exit(0);}
const browser=await puppeteer.launch({executablePath:binary,headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
const folder=path.join(process.cwd(),'ui-screenshots');
fs.mkdirSync(folder,{recursive:true});
try{
  const page=await browser.newPage();
  await page.setViewport({width:1380,height:900,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{
    window.supabase={createClient:()=>({
      auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}
    })};
  });
  await page.setRequestInterception(true);
  page.on('request',request=>{
    if(request.url().includes('/supabase-js@'))request.respond({
      status:200,contentType:'application/javascript',body:'window.supabase=window.supabase||{};'
    });
    else if(/^https?:/.test(request.url()))request.abort();
    else request.continue();
  });
  await page.goto('file://'+path.join(process.cwd(),'index.html'),{waitUntil:'load',timeout:30000});
  await page.evaluate(()=>{
    const cloud=window.daylightCloud;
    if(!cloud)throw Error('Cloud integration did not initialize');
    const fake={
      from:()=>{
        const chain={
          select(){return chain},eq(){return chain},order(){return Promise.resolve({data:[],error:null})},
          limit(){return Promise.resolve({data:[],error:null})},
          maybeSingle(){return Promise.resolve({data:null,error:null})},
          insert(){return Promise.resolve({data:null,error:null})},
          update(){return chain},upsert(){return Promise.resolve({data:null,error:null})}
        };
        return chain;
      },
      functions:{invoke:async(name,request)=>({data:{enabled:false,prefix:null}})}
    };
    Object.defineProperty(cloud,'ready',{get:()=>true,configurable:true});
    Object.defineProperty(cloud,'user',{get:()=>({id:'00000000-0000-4000-8000-000000000001'}),configurable:true});
    Object.defineProperty(cloud,'client',{get:()=>fake,configurable:true});
    document.getElementById('app').hidden=false;
    document.getElementById('authRoot').innerHTML='';
    window.daylightScreenshotReady=true;
  });
  for(const theme of ['dark','light']){
    await page.evaluate(theme=>{
      state.themeMode=theme;
      applyTheme();renderAll(false);
      openSettings('ai');
    },theme);
    await new Promise(resolve=>setTimeout(resolve,350));
    await page.screenshot({path:path.join(folder,'ai-access-'+theme+'.png'),fullPage:true});
    await page.evaluate(()=>{
      const close=document.querySelector('.settings-close');
      if(close)close.click();
    });
    await new Promise(resolve=>setTimeout(resolve,180));
    await page.evaluate(()=>{
      const cal=state.calendars.find(c=>!c.subscribed&&!c.builtin);
      if(!cal)throw Error('No owned calendar available in demo UI');
      window.daylightShareCalendar(cal);
    });
    await new Promise(resolve=>setTimeout(resolve,350));
    await page.screenshot({path:path.join(folder,'share-'+theme+'.png'),fullPage:true});
    await page.evaluate(()=>document.querySelector('#shareInfo')?.closest('.backdrop')?.remove());
  }
  console.log('Saved visual reference screenshots:',fs.readdirSync(folder));
}finally{await browser.close();}
