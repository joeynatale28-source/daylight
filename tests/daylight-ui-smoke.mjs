/**
 * Visual and interaction regression smoke tests with synthetic fixtures only.
 * Never uses live Supabase data or user credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'].find(fs.existsSync);
if(!chrome)throw Error('Chrome executable required for screenshot proof');
const out=path.join(process.cwd(),'ui-screenshots');
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 const page=await browser.newPage();
 await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
 await page.evaluateOnNewDocument(()=>{
   const chain=()=>{
     const q={
       select(){return q},eq(){return q},order(){return q},limit(){return q},
       is(){return q},single(){return Promise.resolve({data:null,error:null})},
       maybeSingle(){return Promise.resolve({data:null,error:null})},
       update(){return q},upsert(){return Promise.resolve({data:null,error:null})},
       insert(){return Promise.resolve({data:null,error:null})},
       then(done){return Promise.resolve({data:[],error:null}).then(done)}
     };return q;
   };
   window.__fakeClient={
     auth:{
       getSession:async()=>({data:{session:null}}),
       getUser:async()=>({data:{user:null}}),
       onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
       oauth:{
         getAuthorizationDetails:async()=>({data:{
           authorization_id:'synthetic',client:{id:'mock-chatgpt',name:'ChatGPT'},redirect_uri:'https://chatgpt.com/connector/oauth/callback',scope:'openid profile'
         },error:null}),
         listGrants:async()=>({data:{grants:[]},error:null})
       }
     },
     from:()=>chain(),
     functions:{invoke:async()=>({data:{subscriptions:[],enabled:false},error:null})}
   };
   window.supabase={createClient:()=>window.__fakeClient};
 });
 await page.setRequestInterception(true);
 page.on('request',request=>{
   if(request.url().includes('/supabase-js@'))request.respond({status:200,contentType:'application/javascript',body:'window.supabase=window.supabase||{};'});
   else if(/^https?:/.test(request.url()))request.abort();
   else request.continue();
 });
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto('file://'+path.join(process.cwd(),'index.html')+'?oauth_consent=1&authorization_id=synthetic',{waitUntil:'load',timeout:30000});
 await page.evaluate(()=>{
   const cloud=window.daylightCloud;
   if(!cloud)throw Error('Daylight cloud missing');
   Object.defineProperty(cloud,'ready',{get:()=>true,configurable:true});
   Object.defineProperty(cloud,'user',{get:()=>({id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}}),configurable:true});
   Object.defineProperty(cloud,'client',{get:()=>window.__fakeClient,configurable:true});
   state.calendars=[
     {id:'c1',name:'Hungary Creek Recreation Association',color:'teal',hidden:false,subscribed:false},
     {id:'c2',name:'swimRVA Rapids',color:'blue',hidden:false,subscribed:false},
     {id:'c3',name:'Personal',color:'green',hidden:false,subscribed:false},
     {id:'c4',name:'School Events and Assignments',color:'violet',hidden:false,subscribed:false},
     {id:'c5',name:'Travel',color:'amber',hidden:false,subscribed:false},
     {id:'c6',name:'Exams and Projects',color:'rose',hidden:false,subscribed:false},
     {id:'c7',name:'Family and Birthdays',color:'plum',hidden:false,subscribed:false}
   ];
   state.events=[
     {id:802,uid:'meet',cal:'c2',title:'Multi-day swim meet',start:new Date(2026,11,8,0),end:new Date(2026,11,12,23,59),allDay:true,loc:'Swimming pool',desc:''},
     {id:803,uid:'practice',cal:'c2',title:'Morning swim practice',start:new Date(2026,11,9,5,30),end:new Date(2026,11,9,7),allDay:false,loc:'Pool',desc:''}
   ];
   state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);state.selected=new Date(2026,11,9);state.sidebarRail=false;
   document.getElementById('app').hidden=false;document.getElementById('authRoot').innerHTML='';
   applyTheme();renderAll(false);
 });
 const bannerFiles=['sports','holidays','school-life'].flatMap(group=>
   fs.readdirSync(path.join(process.cwd(),'assets','banners',group))
     .filter(name=>name.endsWith('.webp'))
     .map(name=>({group,subject:name.slice(0,-5)})));
 for(const [group,count] of [['sports',42],['holidays',22],['school-life',27]]){
   assert.equal(bannerFiles.filter(file=>file.group===group).length,count,`${group} banner count`);
 }
 assert.equal(bannerFiles.length,91,'all 91 banner files must be present');
 for(const file of bannerFiles){
   assert.ok(fs.statSync(path.join(process.cwd(),'assets','banners',file.group,`${file.subject}.webp`)).size>0,
     `empty banner file: ${file.group}/${file.subject}.webp`);
 }
 const bannerRouting=await page.evaluate(files=>{
   const routes=files.map(({group,subject})=>({
     expected:`assets/banners/${group}/${subject}.webp`,
     actual:bannerKeyFor({title:'',category:subject})
   }));
   const cases=[
     ['Morning swim practice','assets/banners/sports/swim.webp'],
     ['Team USA','assets/banners/sports/swim.webp'],
     ['Championship swim','assets/banners/sports/swim.webp'],
     ['Thanksgiving','assets/banners/holidays/thanksgiving.webp'],
     ['Christmas Eve','assets/banners/holidays/christmas-eve.webp'],
     ['School Block',null],
     ["Aiden's Birthday",'assets/banners/school-life/birthday.webp'],
     ['Nov 17 Haircut','assets/banners/school-life/haircut.webp'],
     ['Pickup Jeep – Florida','assets/banners/school-life/road-trip.webp'],
     ['Christmas swim practice','assets/banners/sports/swim.webp']
   ].map(([title,expected])=>({title,expected,actual:bannerKeyFor({title})}));
   return {routes,cases};
 },bannerFiles);
 assert.deepEqual(bannerRouting.routes.filter(route=>route.actual!==route.expected),[],
   'every banner file must be reachable by its subject');
 assert.deepEqual(bannerRouting.cases.filter(test=>test.actual!==test.expected),[],
   'specific event matches and overrides must route to the intended banner');
 for(const theme of ['dark','light']){
   await page.evaluate(()=>closePopover());
   await page.waitForFunction(()=>document.querySelectorAll('.popover').length===0,{timeout:3000});
   await page.evaluate(theme=>{state.themeMode=theme;applyTheme();renderAll(false)},theme);
   await page.evaluate(()=>{
     const practice=state.events.find(event=>event.title==='Morning swim practice');
     openPopover({ev:practice,start:practice.start,end:practice.end},document.querySelector('.day-cell'));
   });
   await page.waitForFunction(()=>{
     const popover=[...document.querySelectorAll('.popover')].find(element=>
       element.querySelector('.pop-title')?.textContent==='Morning swim practice');
     const image=popover?.querySelector('.pop-banner img');
     return image&&image.complete&&image.naturalWidth>0&&Math.round(popover.getBoundingClientRect().width)===384;
   },{timeout:5000});
   const bannerSlot=await page.evaluate(()=>{
     const popover=[...document.querySelectorAll('.popover')].find(element=>
       element.querySelector('.pop-title')?.textContent==='Morning swim practice');
     const element=popover.querySelector('.pop-banner');
     const image=element.querySelector('img');
     const box=element.getBoundingClientRect();
     return {src:image.getAttribute('src'),width:popover.getBoundingClientRect().width,height:box.height,fit:getComputedStyle(image).objectFit};
   });
   assert.equal(bannerSlot.src,'assets/banners/sports/swim.webp');
   assert.equal(Math.round(bannerSlot.width),384);
   assert.equal(Math.round(bannerSlot.height),128);
   assert.equal(bannerSlot.fit,'cover');
   await page.screenshot({path:path.join(out,'swim-banner-'+theme+'.png')});
   await page.evaluate(()=>closePopover());
   await page.screenshot({path:path.join(out,'month-sidebar-'+theme+'.png')});
   const measure=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('.month-week')];
      const names=[...document.querySelectorAll('.cal-name')];
      return {rows:rows.length,lastBottom:rows.at(-1)?.getBoundingClientRect().bottom,scroll:document.documentElement.scrollHeight,
       names:names.map(n=>({text:n.textContent,visible:n.offsetWidth>0,full:n.scrollWidth<=n.clientWidth+1}))};
   });
   assert.equal(measure.rows,6);
   assert.ok(measure.lastBottom<=769,'sixth month row is clipped: '+JSON.stringify(measure));
   assert.ok(measure.names.some(n=>n.text==='Hungary Creek Recreation Association'&&n.visible),'long calendar must remain visible with ellipsis');
   assert.ok(!await page.$('.cal-source'), 'origin subtitle should be absent');
   await page.evaluate(()=>openSettings('ai'));
   await page.waitForSelector('.dl-chatgpt-featured',{timeout:5000});
   await page.screenshot({path:path.join(out,'chatgpt-card-'+theme+'.png')});
   await page.evaluate(()=>document.querySelector('.settings-close')?.click());
   await page.evaluate(()=>document.dispatchEvent(new Event('daylight:workspace-ready')));
   await page.waitForSelector('#daylightOAuthConsent',{timeout:5000});
   await page.screenshot({path:path.join(out,'oauth-consent-'+theme+'.png')});
   await page.evaluate(()=>document.getElementById('daylightOAuthConsent')?.remove());
 }
 // Date-cell creation and multi-day span checks.
 await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,11,9);renderAll(false)});
 const spanCount=await page.$$eval('.dl-continuous-bar',bars=>bars.length);
 assert.ok(spanCount>=1,'multi-day continuous bar missing');
 await page.evaluate(()=>{
   const cell=[...document.querySelectorAll('.day-cell')].find(c=>c.querySelector('.day-num')?.textContent.trim()==='15');
   if(!cell)throw Error('Target month cell unavailable');cell.click();
 });
 await page.waitForSelector('#efTitle',{timeout:4000});
 await page.screenshot({path:path.join(out,'new-event-dialog.png')});
 await page.evaluate(()=>document.querySelector('.backdrop .dialog [data-x]')?.click());

 // Synthetic behavior verification; never touches the real account.
 await page.evaluate(()=>{
   state.view='month';state.cursor=new Date(2026,11,9);renderAll(false);
   document.querySelector('.dl-continuous-bar')?.click();
 });
 assert.ok(await page.$('.dl-continuous-bar.dl-span-selected'),'multi-day selection did not highlight the span');
 await page.screenshot({path:path.join(out,'multiday-selected.png')});
 await page.evaluate(()=>{closePopover();state.section='calendar';state.cursor=new Date(2026,11,9);state.view='week';renderAll(false)});
 const spanCountWeek=await page.evaluate(()=>document.querySelectorAll('.dl-week-span-layer .dl-continuous-bar').length);
 const diag=await page.evaluate(()=>({
   section:state.section,view:state.view,cursor:state.cursor.toISOString(),
   dates:weekDays(state.cursor).map(d=>d.toDateString()),
   events:state.events.map(e=>({title:e.title,cal:e.cal,allDay:e.allDay,start:e.start.toISOString(),end:e.end.toISOString()})),
   className:document.querySelector('.tg-wrap')?.className,
   spans:document.querySelectorAll('.dl-week-span-layer').length,
   visibleEvents:visibleEvents().map(e=>e.title),
   allDayHtml:document.querySelector('.allday-row')?.outerHTML.slice(0,1000)
 }));
 console.log('WEEK DEBUG',JSON.stringify(diag));
 assert.ok(spanCountWeek>=1,'week multi-day span missing: '+JSON.stringify(diag));
 await page.screenshot({path:path.join(out,'multiday-week.png')});
 // Settings cleanup and an immediate Save/Discard indicator.
 await page.evaluate(()=>{state.view='month';renderAll(false);openSettings('calendar')});
 assert.ok(await page.$('#csWeekStart'),'Week start should live in Calendar settings');
 assert.equal(await page.$('#csTz'),null,'Timezone must not be duplicated in Calendar settings');
 const oldWeekends=await page.evaluate(()=>state.showWeekends);
 await page.evaluate(()=>{
   const input=document.querySelector('#csWeekends');
   input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(await page.$eval('.settings-savebar',x=>x.hidden),false,'Save bar did not appear immediately');
 await page.screenshot({path:path.join(out,'settings-unsaved.png')});
 await page.evaluate(()=>document.querySelector('[data-discard]').click());
 assert.equal(await page.evaluate(()=>state.showWeekends),oldWeekends,'Discard failed to restore the setting');
 await page.evaluate(()=>openSettings('general'));
 assert.ok(await page.$('#gsTz'),'Timezone missing from General settings');
 assert.equal(await page.$('#gsWeekStart'),null);
 await page.screenshot({path:path.join(out,'settings-general.png')});
 await page.evaluate(()=>document.querySelector('.settings-close').click());
 await page.evaluate(()=>openSettings('data'));
 assert.equal(await page.$('#fdUrl'),null,'Data & sync still contains legacy Add feed form');
 await page.screenshot({path:path.join(out,'settings-data-sync.png')});
 await page.evaluate(()=>document.querySelector('.settings-close').click());
 // Verify custom color is applied to a practice calendar, without touching the backend.
 await page.evaluate(()=>{
   const host=document.createElement('div');host.id='syntheticColorHost';
   document.body.append(host);
   window.daylightColorPicker(host,'blue',key=>{
     const cal=state.calendars.find(c=>c.id==='c2');cal.color=key;
     renderAll(false);
   });
   host.querySelector('.dl-color-plus').click();
   const hex=document.querySelector('#dl-color-hex');
   hex.value='#FF7A00';hex.dispatchEvent(new Event('input',{bubbles:true}));
   document.querySelector('[data-apply]').click();
   host.remove();
 });
 assert.equal(await page.evaluate(()=>state.calendars.find(c=>c.id==='c2').color),'#FF7A00');
 await page.screenshot({path:path.join(out,'custom-color-orange.png')});
 // Basic render benchmarks in Chromium with 7 synthetic calendars. No live-network latency.
 const timing=await page.evaluate(()=>{
   const sample=(view)=>{state.view=view;const t=performance.now();renderAll(false);return +(performance.now()-t).toFixed(1)};
   return {month_ms:sample('month'),day_ms:sample('day'),week_ms:sample('week')};
 });
 console.log('Synthetic 7-calendar render timings:',JSON.stringify(timing));
 if(errors.length)console.warn('Browser runtime notices:',errors.slice(0,8));
 console.log('Daylight visual smoke passed. Screenshots:',fs.readdirSync(out));
}finally{await browser.close()}
