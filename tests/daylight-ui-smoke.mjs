/**
 * Visual and interaction regression smoke tests with synthetic fixtures only.
 * Never uses live Supabase data or user credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const chrome=process.env.CHROME_PATH||[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'
].find(fs.existsSync);
if(!chrome)throw Error('Chrome executable required for screenshot proof');
const out=path.join(process.cwd(),'ui-screenshots');
fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const errors=[];
const failedRequests=[];
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
       resetPasswordForEmail:async()=>({data:{},error:null}),
       updateUser:async({data})=>({data:{user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:data}},error:null}),
       onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
       oauth:{
         getAuthorizationDetails:async()=>({data:{
           authorization_id:'synthetic',client:{id:'mock-chatgpt',name:'ChatGPT'},redirect_uri:'https://chatgpt.com/connector/oauth/callback',scope:'openid profile'
         },error:null}),
         listGrants:async()=>({data:{grants:[]},error:null})
       }
     },
     rpc:async(name,args)=>{
       if(name==='daylight_list_my_sessions')return {data:[
         {id:'session-current',user_agent:'Chrome/120 Windows',last_active:new Date().toISOString(),current:true},
         ...(window.__revoked?[]:[{id:'session-other',user_agent:'Firefox/120 Mac OS',last_active:new Date().toISOString(),current:false}])
       ],error:null};
       if(name==='daylight_revoke_my_session'){window.__revoked=true;return {data:{revoked:true},error:null}}
       return {data:null,error:null};
     },
     from:()=>chain(),
     storage:{from:bucket=>({
       upload:async(path,blob,options)=>{window.__uploadedPaths=window.__uploadedPaths||[];window.__uploadedPaths.push({bucket,path,type:options.contentType,size:blob.size});return {data:{path},error:null}},
       remove:async paths=>({data:paths,error:null}),
       getPublicUrl:path=>({data:{publicUrl:'https://storage.example/avatars/'+path}})
     })},
     functions:{invoke:async(name,options)=>{
       if(name==='ical-feed'){
         const body=options?.body||{};
         if(body.action==='public-status')return {data:{public_enabled:!!window.__shareState?.public_enabled},error:null};
         if(body.action==='public-on'||body.action==='public-reset'){window.__shareN=(window.__shareN||0)+1;window.__shareState=Object.assign({},window.__shareState,{public_enabled:true});return {data:{public_enabled:true,url:'https://example.test/feed?token='+window.__shareN},error:null}}
         if(body.action==='public-off'){window.__shareState=Object.assign({},window.__shareState,{public_enabled:false});return {data:{public_enabled:false},error:null}}
         if(body.action==='status')return {data:{enabled:!!window.__shareState?.enabled,public_enabled:!!window.__shareState?.public_enabled,public_url:'https://example.test/public.ics'},error:null};
         if(body.action==='set-public'){window.__shareState=Object.assign({},window.__shareState,{public_enabled:body.public});return {data:{public_enabled:body.public,public_url:'https://example.test/public.ics'},error:null}}
         if(body.action==='enable'||body.action==='reset'){window.__shareState=Object.assign({},window.__shareState,{enabled:true});return {data:{enabled:true,urls:{https:'https://example.test/private-token.ics'}},error:null}}
         if(body.action==='disable'){window.__shareState=Object.assign({},window.__shareState,{enabled:false});return {data:{enabled:false},error:null}}
         if(body.action==='export')return {data:'BEGIN:VCALENDAR\\nEND:VCALENDAR',error:null};
       }
       return {data:{subscriptions:[],enabled:false},error:null}
     }}
   };
   window.__shareState={enabled:false,public_enabled:false};
   window.supabase={createClient:()=>window.__fakeClient};
 });
 await page.setRequestInterception(true);
 const assetRoot=path.resolve(process.cwd(),'assets')+path.sep;
 page.on('request',request=>{
   const url=request.url();
   if(url.includes('/supabase-js@')){
     request.respond({status:200,contentType:'application/javascript',body:'window.supabase=window.supabase||{};'});
     return;
   }
   if(url.startsWith('file://')){
     const pathname=decodeURIComponent(new URL(url).pathname);
     const relative=path.relative(process.cwd(),pathname);
     const resolved=path.resolve(pathname);
     if((relative.startsWith('assets'+path.sep)||relative.startsWith('assets/'))&&resolved.startsWith(assetRoot)){
       request.continue();
       return;
     }
   }
   if(/^https?:/.test(url))request.abort();
   else request.continue();
 });
 page.on('console',m=>{if(m.text().includes('DLDEBUG'))console.log(m.text())});
 page.on('pageerror',err=>errors.push(err.message));
page.on('console',m=>{if(m.text().includes('DLDEBUG'))console.log(m.text())});
 page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
 await page.goto('file://'+path.join(process.cwd(),'index.html')+'?oauth_consent=1&authorization_id=synthetic',{waitUntil:'load',timeout:30000});
 await page.waitForSelector('#authScreen',{timeout:5000});
 for(const theme of ['dark','light']){
   await page.evaluate(theme=>{state.themeMode=theme;applyTheme()},theme);
   const mark=await page.evaluate(theme=>{
     const root=document.querySelector('.auth-brand-mark');
     const light=root?.querySelector('.daylight-mark-light');
     const dark=root?.querySelector('.daylight-mark-dark');
     const style=n=>n?getComputedStyle(n).display:'none';
     return {present:!!root,light:light?.getAttribute('src'),dark:dark?.getAttribute('src'),
       loaded:[!!light?.complete&&light.naturalWidth>0,!!dark?.complete&&dark.naturalWidth>0],
       displays:[style(light),style(dark)],visibleWidths:[light?.getBoundingClientRect().width||0,dark?.getBoundingClientRect().width||0]};
   },theme);
   assert.ok(mark.present,'sign-in brand mark missing');
   assert.equal(mark.light,'./assets/daylight-sunarc-light-NOBG.png');
   assert.equal(mark.dark,'./assets/daylight-sunarc-dark-NOBG.png');
   assert.deepEqual(mark.loaded,[true,true],'both sign-in logo files must load: '+JSON.stringify({mark,failedRequests}));
   assert.equal(mark.displays[theme==='dark'?0:1],'none','inactive theme mark must be hidden');
   assert.ok(mark.visibleWidths[theme==='dark'?1:0]>0,'active theme mark must render');
   const authMark=await page.evaluate(()=>({
     images:[...document.querySelectorAll('.auth-mark img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,display:getComputedStyle(img).display})),
     legacySvg:!!document.querySelector('.auth-mark svg')
   }));
   assert.deepEqual(authMark.images.map(image=>image.src),['./assets/daylight-sunarc-light-NOBG.png','./assets/daylight-sunarc-dark-NOBG.png']);
   assert.ok(authMark.images.every(image=>image.loaded),'sign-in illustration marks must load');
   assert.equal(authMark.legacySvg,false,'legacy sunrise/rays sign-in artwork must be gone');
 
   await page.screenshot({path:path.join(out,'signin-'+theme+'.png')});
 }
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
     {id:'c7',name:'Family and Birthdays',color:'plum',hidden:false,subscribed:false},
     {id:'holidays',name:'US Holidays',color:'amber',hidden:false,subscribed:true,builtin:true}
   ];
   state.events=[
     {id:802,uid:'meet',cal:'c2',title:'Multi-day swim meet',start:new Date(2026,11,8,0),end:new Date(2026,11,12,23,59),allDay:true,loc:'Swimming pool',desc:''},
     {id:803,uid:'practice',cal:'c2',title:'Morning swim practice',start:new Date(2026,11,9,5,30),end:new Date(2026,11,9,7),allDay:false,loc:'Pool',desc:''},
     {id:804,uid:'timed-only',cal:'c3',title:'Timed-only measurement fixture',start:new Date(2026,11,22,9,0),end:new Date(2026,11,22,9,30),allDay:false,loc:'',desc:''}
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
     expected:`dl-banner-${group}-${subject}`,
     actual:bannerKeyFor({title:'',category:subject})
   }));
   const cases=[
     ['Morning swim practice','dl-banner-sports-swim'],
     ['Team USA','dl-banner-sports-swim'],
     ['Championship swim','dl-banner-sports-swim'],
     ['Thanksgiving','dl-banner-holidays-thanksgiving'],
     ['Christmas Eve','dl-banner-holidays-christmas-eve'],
     ['School Block',null],
     ["Aiden's Birthday",'dl-banner-school-life-birthday'],
     ['Nov 17 Haircut','dl-banner-school-life-haircut'],
     ['Pickup Jeep – Florida','dl-banner-school-life-road-trip'],
     ['Christmas swim practice','dl-banner-sports-swim']
   ].map(([title,expected])=>({title,expected,actual:bannerKeyFor({title})}));
   return {routes,cases};
 },bannerFiles);
 assert.deepEqual(bannerRouting.routes.filter(route=>route.actual!==route.expected),[],
   'every banner file must be reachable by its subject');
 assert.deepEqual(bannerRouting.cases.filter(test=>test.actual!==test.expected),[],
   'specific event matches and overrides must route to the intended banner');
 const initialSpan=await page.$('.dl-continuous-bar');
 assert.ok(initialSpan,'multi-day continuous bar missing in the initial month render');
 const overflow=await page.evaluate(async()=>{
   state.calendars.push({id:'scratch-overflow',name:'Scratch overflow test',color:'gray',hidden:false,subscribed:false,shared:false});
   for(let n=0;n<5;n++)state.events.push({id:950+n,title:'Overflow test '+(n+1),cal:'scratch-overflow',start:new Date(2026,11,9,8+n),end:new Date(2026,11,9,8+n,30),allDay:false,repeat:null,reminder:null});
   state.view='month';state.cursor=new Date(2026,11,9);renderAll(false);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const cell=[...document.querySelectorAll('.day-cell')].find(n=>n.dataset.date==='2026-12-09');
   const more=cell?.querySelector('.more-link'),label=more?.textContent||'';
   more?.click();
   return {label,view:state.view};
 });
 assert.match(overflow.label,/\+\d+ more/,'five synthetic events should expose a +N more link');
 assert.equal(overflow.view,'day','clicking +N more should open the selected day');
 await page.evaluate(()=>{
   state.events=state.events.filter(e=>e.cal!=='scratch-overflow');
   state.calendars=state.calendars.filter(c=>c.id!=='scratch-overflow');
   state.view='month';state.cursor=new Date(2026,11,9);renderAll(false);
 });
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
   assert.ok(bannerSlot.src.endsWith('/assets/banners/sports/swim.webp'));
   assert.equal(Math.round(bannerSlot.width),384);
   assert.equal(Math.round(bannerSlot.height),128);
   assert.equal(bannerSlot.fit,'cover');
   await page.screenshot({path:path.join(out,'swim-banner-'+theme+'.png')});
   await page.evaluate(()=>{
     if(!state.events.some(e=>e.title==='Thanksgiving'))state.events.push(
       {id:960,cal:'c7',title:'Thanksgiving',start:new Date(2026,10,26),end:new Date(2026,10,26,23,59),allDay:true},
       {id:961,cal:'c7',title:'Christmas Eve',start:new Date(2026,11,24),end:new Date(2026,11,24,23,59),allDay:true},
       {id:962,cal:'c7',title:"Aiden's Birthday",start:new Date(2026,10,17),end:new Date(2026,10,17,23,59),allDay:true},
       {id:963,cal:'c7',title:'Nov 17 Haircut',start:new Date(2026,10,17,15),end:new Date(2026,10,17,16),allDay:false},
       {id:964,cal:'c4',title:'School Block',start:new Date(2026,11,10,8),end:new Date(2026,11,10,15),allDay:false}
     );
   });
   const popoverCases=[
     ['Thanksgiving','/assets/banners/holidays/thanksgiving.webp'],
     ['Christmas Eve','/assets/banners/holidays/christmas-eve.webp'],
     ["Aiden's Birthday",'/assets/banners/school-life/birthday.webp'],
     ['Nov 17 Haircut','/assets/banners/school-life/haircut.webp'],
     ['School Block',null]
   ];
   for(const [title,expected] of popoverCases){
     const result=await page.evaluate((title,expected)=>{
       const ev=state.events.find(e=>e.title===title);
       openPopover({ev,start:ev.start,end:ev.end},document.querySelector('.day-cell'));
       const pop=[...document.querySelectorAll('.popover')].find(p=>p.querySelector('.pop-title')?.textContent===title);
       const src=pop?.querySelector('.pop-banner img')?.getAttribute('src')||null;
       const path=src?new URL(src,document.baseURI).pathname:null;
       return {title,path,expected,hasBanner:!!pop?.querySelector('.pop-banner')};
     },title,expected);
     assert.ok(expected?result.path?.endsWith(expected):!result.hasBanner,'incorrect popover banner for '+title+': '+JSON.stringify(result));
     await page.evaluate(()=>closePopover());
     await page.waitForFunction(()=>document.querySelectorAll('.popover').length===0,{timeout:3000});
   }
   const togglePopover=await page.evaluate(()=>{
     const ev=state.events.find(event=>event.title==='Morning swim practice');
     const occurrence={ev,start:ev.start,end:ev.end};
     const anchor=document.querySelector('.day-cell');
     openPopover(occurrence,anchor);
     const opened=document.querySelectorAll('.popover').length;
     openPopover(occurrence,anchor);
     return {opened,closed:!popEl};
   });
   assert.deepEqual(togglePopover,{opened:1,closed:true},'clicking the same event twice should close its popover');
   await page.waitForFunction(()=>document.querySelectorAll('.popover').length===0,{timeout:1000});
   await page.screenshot({path:path.join(out,'month-sidebar-'+theme+'.png')});
   const measure=await page.evaluate(()=>{
     const grid=document.querySelector('.month-grid'),rows=[...grid.querySelectorAll('.month-week')];
     const cell=grid.querySelector('[data-date="2026-12-22"]');
     const dateBottom=cell?.querySelector('.day-num')?.getBoundingClientRect().bottom;
     const chipTop=cell?.querySelector('.chip:not([hidden])')?.getBoundingClientRect().top;
     return {height:grid.clientHeight,scrollHeight:grid.scrollHeight,overflowY:getComputedStyle(grid).overflowY,
       rows:rows.length,rowHeights:rows.map(r=>r.getBoundingClientRect().height),
       firstChipOffset:chipTop!=null&&dateBottom!=null?chipTop-dateBottom:null,
       sixthRowBottom:rows.at(-1)?.getBoundingClientRect().bottom,gridBottom:grid.getBoundingClientRect().bottom};
   });
   assert.equal(measure.rows,6);
   assert.equal(measure.overflowY,'auto','month grid must own the scroll');
   assert.ok(measure.firstChipOffset!==null&&measure.firstChipOffset<=6,
     'timed-only cell must have a collapsed all-day lane and 4px spacing: '+JSON.stringify(measure));
   assert.ok(measure.sixthRowBottom<=measure.gridBottom+1||measure.scrollHeight>measure.height,
     'sixth row must fit or be reachable by scroll: '+JSON.stringify(measure));
   await page.screenshot({path:path.join(out,'month-layout-'+theme+'.png')});
   const names=await page.evaluate(()=>[...document.querySelectorAll('.cal-name')].map(n=>({text:n.textContent,visible:n.offsetWidth>0})));
   assert.ok(names.some(n=>n.text==='Hungary Creek Recreation Association'&&n.visible),'long calendar must remain visible with ellipsis');
   await page.setViewport({width:1280,height:800,deviceScaleFactor:1});
   await new Promise(resolve=>setTimeout(resolve,90));
   const medium=await page.evaluate(()=>{const g=document.querySelector('.month-grid'),r=[...g.querySelectorAll('.month-week')];return {h:g.clientHeight,sh:g.scrollHeight,last:r.at(-1).getBoundingClientRect().bottom,b:g.getBoundingClientRect().bottom};});
   assert.ok(medium.last<=medium.b+1||medium.sh>medium.h,'1280x800 month row 6: '+JSON.stringify(medium));
   await page.setViewport({width:1280,height:600,deviceScaleFactor:1});
   await new Promise(resolve=>setTimeout(resolve,120));
   const short=await page.evaluate(()=>{const g=document.querySelector('.month-grid'),r=[...g.querySelectorAll('.month-week')];g.scrollTop=g.scrollHeight;return {h:g.clientHeight,sh:g.scrollHeight,st:g.scrollTop,last:r.at(-1).getBoundingClientRect().bottom,b:g.getBoundingClientRect().bottom};});
   assert.ok(short.sh>short.h&&short.st>0,'short month must scroll: '+JSON.stringify(short));
   assert.ok(short.last<=short.b+1,'month row 6 reachable after scrolling: '+JSON.stringify(short));
   await page.setViewport({width:1366,height:768,deviceScaleFactor:1});
   await new Promise(resolve=>setTimeout(resolve,90));
   assert.ok(!await page.$('.cal-source'), 'origin subtitle should be absent');
   await page.evaluate(()=>openSettings('ai'));
   await page.waitForSelector('.dl-chatgpt-featured',{timeout:5000});
   await page.screenshot({path:path.join(out,'chatgpt-card-'+theme+'.png')});
   await page.evaluate(()=>document.querySelector('.settings-close')?.click());
   await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
   await page.evaluate(()=>openSettings('profile'));
   await page.waitForSelector('#profileFullName',{timeout:3000});
   await page.waitForFunction(()=>document.querySelectorAll('.dl-session-row').length===2,{timeout:3000});
   const profile=await page.evaluate(()=>({
     sections:[...document.querySelectorAll('.settings-rail .sr-item')].map(button=>button.textContent.trim()),
     email:document.querySelector('.dl-profile-photo')?.closest('.set-group')?.querySelector('[data-email]')?.textContent,
     sessions:[...document.querySelectorAll('.dl-session-row')].map(row=>row.textContent),
     sessionUi:[...document.querySelectorAll('.dl-session-row')].map(row=>{const badge=row.querySelector('.dl-session-badge'),out=row.querySelector('.dl-session-signout');
       const box=out&&{width:out.offsetWidth,height:out.offsetHeight};return {badge:badge?parseFloat(getComputedStyle(badge).fontSize):null,badgeText:badge&&badge.textContent,
        signout:out?{w:box.width,h:box.height,title:out.title,color:getComputedStyle(out).color,hasIcon:!!out.querySelector('svg'),text:out.textContent.trim()}:null,textButton:!!row.querySelector('button.btn-ghost')}}),
     closeSize:(()=>{const r=document.querySelector('.settings-close').getBoundingClientRect();return [r.width,r.height]})()
   }));
   assert.deepEqual(profile.sections,['Profile','Appearance','Calendar','Notifications','AI access','Shortcuts']);
   assert.equal(profile.email,'demo@example.com','Profile must show the authenticated email');
   assert.ok(profile.sessions.some(text=>text.includes('Chrome on Windows')&&text.includes('This device')),'current session is labelled This device: '+JSON.stringify(profile.sessions));
   const [current,other]=profile.sessionUi;
   assert.ok(current.badge!==null&&current.badge<=12&&current.badgeText==='This device'&&!current.signout,'current session wears a tiny This device badge and has no sign-out: '+JSON.stringify(current));
   assert.ok(other.badge===null&&other.signout&&other.signout.w>=36&&other.signout.h>=36&&other.signout.title==='Sign out'&&other.signout.hasIcon&&other.signout.text===''&&!other.textButton,'other sessions get a red icon sign-out (>=36px, tooltip), not a text button: '+JSON.stringify(other));
   assert.notEqual(other.signout.color,'rgb(237, 237, 237)','sign-out icon uses the destructive color');
   assert.ok(profile.closeSize[0]>=36&&profile.closeSize[1]>=36,'settings close hit target must be at least 36 by 36 pixels');
   await page.screenshot({path:path.join(out,'settings-profile-'+theme+'.png')});
   await page.click('.dl-session-signout');
   await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]',{timeout:2000});
   await page.click('#overlayRoot > .backdrop:last-child [data-ok]');
   await page.waitForFunction(()=>document.querySelectorAll('.dl-session-row').length===1&&!document.querySelector('.dl-session-signout'),{timeout:3000});
   await page.evaluate(()=>{window.__revoked=false});
   await page.evaluate(()=>document.querySelector('.settings-close')?.click());
   await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
   await page.evaluate(()=>document.dispatchEvent(new Event('daylight:workspace-ready')));
   await page.waitForSelector('#daylightOAuthConsent',{timeout:5000});
   await page.screenshot({path:path.join(out,'oauth-consent-'+theme+'.png')});
   await page.evaluate(()=>document.getElementById('daylightOAuthConsent')?.remove());
 }
 // Crowded day: fit chips to measured cell height and preserve +N more.
 await page.evaluate(()=>{
   for(let n=0;n<9;n++)state.events.push({
     id:980+n,title:'Busy day fixture '+(n+1),cal:'c3',
     start:new Date(2026,11,31,8+n,0),end:new Date(2026,11,31,8+n,25),allDay:false,loc:'',desc:''
   });
   renderAll(false);
 });
 await new Promise(resolve=>setTimeout(resolve,100));
 const busyMetrics=await page.evaluate(()=>{
   const cell=document.querySelector('.day-cell[data-date="2026-12-31"]'),r=cell.getBoundingClientRect();
   const chips=[...cell.querySelectorAll('.chip:not([hidden])')],more=cell.querySelector('.more-link');
   return {visible:chips.length,total:cell.querySelectorAll('.chip').length,
     more:more?.textContent||'',clipped:chips.some(chip=>chip.getBoundingClientRect().bottom>r.bottom-4)};
 });
 assert.match(busyMetrics.more,/\+\d+ more/);
 assert.equal(busyMetrics.clipped,false,'no visible chips may be clipped');
 await page.screenshot({path:path.join(out,'month-busy-day.png')});
 await page.evaluate(()=>{state.events=state.events.filter(event=>event.id<980);renderAll(false);});
 // The canvas-only spinner stays visible for at least one second, including
 // on a fast load, while the sidebar remains rendered throughout.
 await page.evaluate(()=>{
   document.dispatchEvent(new Event('daylight:workspace-loading'));
   document.dispatchEvent(new Event('daylight:workspace-ready'));
 });
 await new Promise(resolve=>setTimeout(resolve,500));
 const fastSpinner=await page.evaluate(()=>{
   const spinner=document.querySelector('#dlWorkspaceLoading');
   return {exists:!!spinner,startedAt:Number(spinner?.dataset.startedAt),
     appVisible:!document.querySelector('#app')?.hidden,
     sidebarVisible:document.querySelector('#sidebar')?.getBoundingClientRect().width>0,
     spinnerVisible:getComputedStyle(spinner||document.body).opacity!=='0'};
 });
 assert.ok(fastSpinner.exists&&fastSpinner.spinnerVisible,'fast workspace load must keep the spinner visible');
 assert.ok(fastSpinner.appVisible&&fastSpinner.sidebarVisible,'the app and sidebar must remain visible during load');
 assert.ok(await page.evaluate(startedAt=>performance.now()-startedAt,fastSpinner.startedAt)<1000,'fast-load spinner sample must be before the one-second minimum');
 await page.screenshot({path:path.join(out,'workspace-spinner-with-sidebar.png')});
 await page.waitForFunction(()=>!document.querySelector('#dlWorkspaceLoading'),{timeout:2500});
 await page.evaluate(()=>document.dispatchEvent(new Event('daylight:workspace-loading')));
 await new Promise(resolve=>setTimeout(resolve,1100));
 const spinnerState=await page.evaluate(()=>{
   const spinner=document.querySelector('#dlWorkspaceLoading');
   const canvas=document.querySelector('#main')?.getBoundingClientRect();
   const box=spinner?.getBoundingClientRect();
   return {exists:!!spinner,appVisible:!document.querySelector('#app')?.hidden,
     sidebarVisible:document.querySelector('#sidebar')?.getBoundingClientRect().width>0,
     canvasCovered:!!canvas&&!!box&&Math.abs(canvas.left-box.left)<1&&Math.abs(canvas.top-box.top)<1&&Math.abs(canvas.width-box.width)<1&&Math.abs(canvas.height-box.height)<1,
     canvasHidden:getComputedStyle(document.querySelector('#viewWrap')).visibility==='hidden'&&getComputedStyle(document.querySelector('#headerBand')).visibility==='hidden',
     obsoleteBoot:!!document.querySelector('#bootScreen')};
 });
 assert.ok(spinnerState.exists,'slow workspace load must keep the spinner visible');
 assert.ok(spinnerState.appVisible&&spinnerState.sidebarVisible,'sidebar must remain rendered during slow load');
 assert.ok(spinnerState.canvasCovered,'spinner must cover only the calendar canvas');
 assert.ok(spinnerState.canvasHidden,'calendar canvas must stay blank (not painted) behind the spinner');
 assert.equal(spinnerState.obsoleteBoot,false,'obsolete boot screen must not exist');
 await page.screenshot({path:path.join(out,'workspace-spinner-with-sidebar-slow.png')});
 await page.evaluate(()=>document.dispatchEvent(new Event('daylight:workspace-ready')));
 await page.waitForFunction(()=>!document.querySelector('#dlWorkspaceLoading'),{timeout:2500});
 await page.evaluate(()=>document.querySelector('#collapseBtn')?.click());
 await page.waitForSelector('#sidebar.rail .sidebar-expand',{timeout:2000});
 const railItem=await page.$('#sidebar.rail .side-row');
 assert.ok(railItem,'collapsed sidebar must retain rail navigation controls');
 const railTip=await railItem.evaluate(n=>n.getAttribute('title'));
 assert.ok(railTip,'collapsed rail navigation controls must expose native hover tooltips');
 const railBrand=await page.evaluate(()=>({
   visible:document.querySelector('#sidebar.rail .logo-tile')?.offsetWidth>0,
   tileBackground:getComputedStyle(document.querySelector('#sidebar.rail .logo-tile')).backgroundColor,
   expandLabel:document.querySelector('#sidebar.rail .sidebar-expand')?.getAttribute('title')
 }));
 assert.ok(railBrand.visible&&railBrand.expandLabel==='Expand sidebar','collapsed brand must show the mark and a separate expand control');
 await page.evaluate(()=>document.querySelector('#sidebar.rail .sidebar-expand')?.click());
 await page.waitForFunction(()=>!document.querySelector('#sidebar')?.classList.contains('rail'),{timeout:2000});
 assert.ok(await page.$eval('#sidebar',node=>node.innerText.includes('Subscriptions')),'sidebar section must be named Subscriptions');
 const zone=await page.evaluate(()=>{
   openSettings('calendar');
   const device=document.querySelector('#gsUseDevTz');
   device.checked=false;device.dispatchEvent(new Event('change',{bubbles:true}));
   const picker=document.querySelector('#gsTz');
   picker.value='Asia/Tokyo';picker.dispatchEvent(new Event('change',{bubbles:true}));
   return {zone:effectiveTz(),offset:tzOffsetStr(effectiveTz()),disabled:document.querySelector('#gsTz')?.disabled};
 });
 assert.equal(zone.zone,'Asia/Tokyo','manual time zone must become effective immediately');
 assert.ok(zone.offset.includes('+09:00'),'manual time zone must update its GMT offset');
 assert.equal(zone.disabled,false,'manual time zone picker must be enabled');
 await page.evaluate(()=>{
   const device=document.querySelector('#gsUseDevTz');
   device.checked=true;device.dispatchEvent(new Event('change',{bubbles:true}));
   document.querySelector('[data-save]')?.click();
 });
 // Date-cell creation and multi-day span checks.
 await page.evaluate(()=>{state.section='calendar';state.view='month';state.cursor=new Date(2026,11,9);renderAll(false)});
 await page.evaluate(()=>{
   const cell=[...document.querySelectorAll('.day-cell')].find(c=>c.querySelector('.day-num')?.textContent.trim()==='15');
   if(!cell)throw Error('Target month cell unavailable');cell.click();
 });
 await page.waitForSelector('#efTitle',{timeout:4000});
 const eventForm=await page.evaluate(()=>{
   const fields=['#efTitle','#efLoc','#efDesc','#efCal','#efSDate','#efEDate'];
   const present=fields.every(selector=>!!document.querySelector(selector));
   const location=document.querySelector('#efLoc');
   const attached=!!location&&location.dataset.tomtomAttached==='yes';
   const dialog=document.querySelector('.event-form-dialog');
   return {present,attached,dialog:!!dialog};
 });
 assert.ok(eventForm.present,'event form must expose title, location, description, calendar, and date fields');
 assert.ok(eventForm.dialog,'event form dialog must be present');
 assert.ok(eventForm.attached,'TomTom autocomplete must attach to the event location field');
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
 await page.evaluate(()=>{state.view='month';renderAll(false);openSettings('general');[...document.querySelectorAll('.settings-rail .sr-item')].find(b=>b.textContent.trim()==='Calendar')?.click()});
 await page.waitForSelector('#csWeekStart',{timeout:2000});
 assert.ok(await page.$('#csWeekStart'),'Week start should live in Calendar settings');
 assert.ok(await page.$('#gsTz'),'Timezone should live in Calendar settings');
 const oldWeekends=await page.evaluate(()=>state.showWeekends);
 const savedSettingKeys=['weekStart','timeFormat','dateFormat','defaultDuration','defaultCalendarId','defaultReminder','density','showWeekends','weekNumbers','showDeclined','tzLabel','notifSound','quietEnabled','quietStart','quietEnd','summaryTime','workDays','workStart','workEnd','useDeviceTz','themeMode','firstName','profileName','reduceMotion','remind15','dailySummary','sidebarRail','avatarUrl','customColors'];
 const oldSettings=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,Array.isArray(state[key])?state[key].slice():state[key]])),savedSettingKeys);
 await page.evaluate(()=>{
   const input=document.querySelector('#csWeekends');
   input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(await page.$eval('.settings-savebar',x=>x.hidden),false,'Save bar did not appear immediately');
 await page.screenshot({path:path.join(out,'settings-unsaved.png')});
 await page.evaluate(()=>document.querySelector('[data-discard]').click());
 await page.waitForSelector('#dlSettingsDiscardConfirm',{timeout:2000});
 await page.screenshot({path:path.join(out,'settings-discard-confirm.png')});
 await page.evaluate(()=>document.querySelector('[data-confirm-discard]').click());
 assert.equal(await page.evaluate(()=>state.showWeekends),oldWeekends,'Discard failed to restore the setting');
 const afterDiscard=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,Array.isArray(state[key])?state[key].slice():state[key]])),savedSettingKeys);
 assert.deepEqual(afterDiscard,oldSettings,'Discard failed to restore every saved setting');
 assert.ok(await page.$('.settings-dialog'),'Discard must keep Settings open');
 assert.equal(await page.$eval('.settings-savebar',x=>x.hidden),true,'Discard must hide the pill after reverting');
 await page.evaluate(()=>{
   const input=document.querySelector('#csWeekends');
   input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await new Promise(resolve=>setTimeout(resolve,80));
 assert.equal(await page.$eval('.settings-savebar',x=>x.hidden),false,'second edit must show save capsule');
 await page.screenshot({path:path.join(out,'settings-save-capsule.png')});
 await page.evaluate(()=>document.querySelector('[data-save]').click());
 await new Promise(resolve=>setTimeout(resolve,120));
 const savedPill=await page.evaluate(()=>{const bar=document.querySelector('.settings-savebar'),btn=bar.querySelector('[data-save]'),check=btn.querySelector('.save-check');
   return {visible:!bar.hidden,saved:bar.classList.contains('is-saved'),bg:getComputedStyle(btn).backgroundColor,check:getComputedStyle(check).display,stroke:getComputedStyle(check).stroke}});
 assert.deepEqual(savedPill,{visible:true,saved:true,bg:'rgb(33, 136, 56)',check:'block',stroke:'rgb(255, 255, 255)'},'Save turns the button green with a white check before the pill closes');
 await page.waitForFunction(()=>document.querySelector('.settings-savebar')?.hidden,{timeout:1500});
 assert.equal(await page.evaluate(()=>state.showWeekends),!oldWeekends,'Save must preserve edited value');
 await page.evaluate(()=>[...document.querySelectorAll('.settings-rail .sr-item')].find(button=>button.textContent.trim()==='Profile')?.click());
 assert.ok(await page.$('#profileFullName'),'Profile section missing from Settings');
 assert.equal(await page.$('#gsWeekStart'),null);
 await page.screenshot({path:path.join(out,'settings-profile.png')});
 await page.evaluate(()=>document.querySelector('.settings-close').click());
 await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
 await page.evaluate(()=>openSettings('data'));
 assert.equal(await page.$('#fdUrl'),null,'Data & sync still contains legacy Add feed form');
 await page.screenshot({path:path.join(out,'settings-data-sync.png')});
 await page.evaluate(()=>document.querySelector('.settings-close').click());
 await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
 // Profile photos are staged inside the settings transaction and upload only on Save.
 await page.evaluate(()=>openSettings('profile'));
 await page.waitForSelector('#profileFullName',{timeout:2000});
 const avatarInput=await page.$('.dl-identity input[type=file]');
 await avatarInput.uploadFile(path.join(process.cwd(),'assets','favicon-light-16.png'));
 await page.waitForFunction(()=>document.querySelector('.dl-profile-status')?.textContent.includes('Save changes')||document.querySelector('.dl-profile-status')?.textContent.includes('Picture ready'),{timeout:3000});
 await page.waitForFunction(()=>!document.querySelector('.settings-savebar')?.hidden,{timeout:2000});
 assert.equal(await page.evaluate(()=>state.avatarUrl.startsWith('blob:')),true,'photo should preview before upload');
 assert.equal(await page.$eval('.settings-savebar',node=>node.hidden),false,'photo selection should show the save capsule');
 await page.evaluate(()=>document.querySelector('[data-save]').click());
 await page.waitForFunction(()=>window.__uploadedPaths?.length===1,{timeout:5000});
 await page.waitForFunction(()=>document.querySelector(".settings-savebar")?.hidden&&!document.querySelector(".settings-saving"),{timeout:3000});
 const uploadedAvatar=await page.evaluate(()=>({url:state.avatarUrl,path:window.__uploadedPaths[0]}));
 assert.ok(uploadedAvatar.url.startsWith('https://storage.example/avatars/'),'saved photo should use its public storage URL');
 assert.equal(uploadedAvatar.path.path,'00000000-0000-4000-8000-000000000001/avatar.png');
 assert.equal(uploadedAvatar.path.type,'image/png');
 await page.evaluate(()=>{
   document.querySelector('[data-remove]').click();
   document.querySelector('[data-discard]').click();
 });
 await page.waitForSelector('#dlSettingsDiscardConfirm',{timeout:2000});
 await page.evaluate(()=>document.querySelector('[data-confirm-discard]').click());
 assert.equal(await page.evaluate(()=>state.avatarUrl),uploadedAvatar.url,'discarding a removal should restore the saved photo');
 await page.evaluate(()=>document.querySelector('.settings-close').click());
 await page.waitForFunction(()=>!document.querySelector('.backdrop .settings-dialog'),{timeout:2000});
 // Item 13/14/6: the calendar ⋯ opens a settings-style popup: rename, colour
 // (presets, Your colors with remove, spectrum + HEX + RGB in sync), public
 // link on/off/reset, export. Name and colour use the Save/Discard capsule.
 await page.evaluate(()=>{
   const row=[...document.querySelectorAll('.cal-row')].find(item=>item.querySelector('.cal-name')?.textContent==='Personal');
   row.querySelector('.cal-menu-btn').click();
 });
 await page.waitForSelector('.dl-calsettings',{timeout:3000});
 await page.waitForFunction(()=>!document.querySelector('.dl-calsettings [aria-label="Public link"]')?.disabled,{timeout:3000});
 assert.equal(await page.$('.menu[role=menu]'),null,'calendar dots should no longer open the narrow legacy menu');
 const popup=await page.evaluate(()=>{const d=document.querySelector('.dl-calsettings'),dot=d.querySelector('.dl-cs2-dot'),x=d.querySelector('.settings-close'),sw=d.querySelector('.dl-sw');
   return {width:d.offsetWidth,radius:getComputedStyle(d).borderRadius,dot:dot.offsetWidth,x:[x.offsetWidth,x.offsetHeight],swatch:sw.offsetWidth,
    labels:[...d.querySelectorAll('.dl-cs2-label')].map(n=>n.textContent.trim()),rows:[...d.querySelectorAll('.dl-cs2-row')].map(n=>n.innerText.replace(/\s+/g,' ').trim()),
    nameInput:!!d.querySelector('input.dl-cs2-name'),fields:[...d.querySelectorAll('.dl-inline-field>span')].map(n=>n.textContent)}});
 assert.deepEqual([popup.width,popup.radius,popup.dot,popup.swatch],[336,'14px',12,26],'popup shell: 336px, radius 14, 12px dot, 26px swatches: '+JSON.stringify(popup));
 assert.ok(popup.x[0]>=32&&popup.x[1]>=32,'close target >=32px');
 assert.deepEqual(popup.labels,['Color','Your colors']);
 assert.deepEqual(popup.rows,['Share calendar Off','Export .ics','Delete calendar'],'action rows: '+JSON.stringify(popup.rows));
 assert.deepEqual(popup.fields,['HEX','R','G','B'],'one row of HEX + R + G + B');
 assert.ok(popup.nameInput,'name stays editable in the header');
 const colorSync=await page.evaluate(()=>{
   const hex=document.querySelector('.dl-calsettings [data-hex]');
   hex.value='#FF7A00';hex.dispatchEvent(new Event('input',{bubbles:true}));
   const rgb=[0,1,2].map(i=>document.querySelector('.dl-calsettings [data-rgb="'+i+'"]').value);
   const hue=document.querySelector('.dl-calsettings .dl-color-hue').value;
   const r=document.querySelector('.dl-calsettings [data-rgb="0"]');
   r.value='0';r.dispatchEvent(new Event('input',{bubbles:true}));
   const afterRgb=document.querySelector('.dl-calsettings [data-hex]').value;
   hex.value='#FF7A00';hex.dispatchEvent(new Event('input',{bubbles:true}));
   return {rgb,hue,afterRgb,calColor:state.calendars.find(c=>c.id==='c3').color,
     pill:!document.querySelector('.dl-calsettings .settings-savebar').hidden};
 });
 assert.deepEqual(colorSync.rgb,['255','122','0'],'HEX entry must drive the RGB fields');
 assert.equal(colorSync.hue,'29','HEX entry must move the spectrum');
 assert.equal(colorSync.afterRgb,'#007A00','RGB entry must drive the HEX field');
 assert.equal(colorSync.calColor,'#FF7A00','colour previews on the calendar before saving');
 assert.ok(colorSync.pill,'a colour change shows the save capsule');
 await page.evaluate(()=>{
   document.querySelector('.dl-calsettings [data-save-custom]').click();
   const name=document.querySelector('#calSettingsName');
   name.value='Personal Renamed';name.dispatchEvent(new Event('input',{bubbles:true}));
 });
 assert.ok(await page.evaluate(()=>state.customColors.includes('#FF7A00')),'Add to Your colors stores the colour on this account');
 await page.evaluate(()=>{
   const toggle=document.querySelector('.dl-calsettings [aria-label="Public link"]');
   toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.querySelector('.dl-cs-public input')?.value==='https://example.test/feed?token=1',{timeout:3000});
 await page.screenshot({path:path.join(out,'calendar-settings-share.png')});
 await page.evaluate(()=>document.querySelector('.dl-calsettings .settings-savebar [data-save]').click());
 await page.waitForFunction(()=>document.querySelector('.dl-calsettings .settings-savebar')?.classList.contains('is-saved'),{timeout:1000});
 await page.waitForFunction(()=>document.querySelector('.dl-calsettings .settings-savebar')?.hidden,{timeout:2000});
 const shareResult=await page.evaluate(()=>({
   name:state.calendars.find(calendar=>calendar.id==='c3')?.name,
   color:state.calendars.find(calendar=>calendar.id==='c3')?.color,
   publicLink:state.calendars.find(calendar=>calendar.id==='c3')?.publicLink,
   sidebar:[...document.querySelectorAll('.cal-name')].some(n=>n.textContent==='Personal Renamed')
 }));
 assert.equal(shareResult.name,'Personal Renamed');
 assert.equal(shareResult.color,'#FF7A00');
 assert.equal(shareResult.publicLink,'https://example.test/feed?token=1');
 assert.ok(shareResult.sidebar,'rename shows in the sidebar');
 // Reset mints a new link; Off clears it.
 await page.evaluate(()=>document.querySelector('.dl-cs-public [data-reset]').click());
 await page.waitForSelector('#overlayRoot > .backdrop:last-child [data-ok]',{timeout:2000});
 await page.evaluate(()=>document.querySelector('#overlayRoot > .backdrop:last-child [data-ok]').click());
 await page.waitForFunction(()=>document.querySelector('.dl-cs-public input')?.value==='https://example.test/feed?token=2',{timeout:3000});
 await page.evaluate(()=>{const t=document.querySelector('.dl-calsettings [aria-label="Public link"]');t.checked=false;t.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.waitForFunction(()=>document.querySelector('.dl-cs-public')?.hidden&&!state.calendars.find(c=>c.id==='c3').publicLink,{timeout:3000});
 // Removing a saved colour leaves the calendar that uses it unchanged.
 await page.evaluate(()=>{const remove=[...document.querySelectorAll('.dl-calsettings .dl-color-remove')].find(b=>/#FF7A00/i.test(b.getAttribute('aria-label')));remove.click()});
 const removal=await page.evaluate(()=>({saved:state.customColors.includes('#FF7A00'),color:state.calendars.find(c=>c.id==='c3').color}));
 assert.deepEqual(removal,{saved:false,color:'#FF7A00'},'removing a saved colour must not recolour the calendar');
 await page.evaluate(()=>document.querySelector('.dl-calsettings .settings-savebar [data-save]').click());
 await page.waitForFunction(()=>document.querySelector('.dl-calsettings .settings-savebar')?.hidden,{timeout:2500});
 await page.evaluate(()=>document.querySelector('.dl-calsettings .settings-close').click());
 await page.waitForFunction(()=>!document.querySelector('.dl-calsettings'),{timeout:2000});
 // US Holidays: Appearance + Export only.
 await page.evaluate(()=>{const row=[...document.querySelectorAll('.cal-row')].find(item=>item.querySelector('.cal-name')?.textContent==='US Holidays');row.querySelector('.cal-menu-btn').click()});
 await page.waitForSelector('.dl-calsettings',{timeout:3000});
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.dl-calsettings .dl-cs2-row')].map(n=>n.textContent.replace(/\s+/g,' ').trim())),['Export .ics'],'US Holidays popup: colors + Export only (no Share, no Delete)');
 assert.equal(await page.$('.dl-calsettings input.dl-cs2-name'),null,'US Holidays cannot be renamed');
 await page.evaluate(()=>document.querySelector('.dl-calsettings .settings-close').click());
 await page.waitForFunction(()=>!document.querySelector('.dl-calsettings'),{timeout:2000});
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
 assert.ok(await page.evaluate(()=>state.customColors.includes('#FF7A00')),'custom colors should be stored in the account workspace');
 assert.equal(await page.evaluate(()=>localStorage.getItem('daylight-custom-colors')),null,'custom colors must not remain in shared browser storage');
 await page.screenshot({path:path.join(out,'custom-color-orange.png')});
 // Item 17: notifications button sits next to Search and opens an empty-state panel.
 // The synthetic OAuth consent fixture and leftover dialogs are cleared first.
 await page.evaluate(()=>{document.getElementById('daylightOAuthConsent')?.remove();document.querySelectorAll('#overlayRoot>*').forEach(n=>n.remove());settingsState.transactionActive=false;state.section='calendar';state.view='month';renderAll(false)});
 const headerButtons=await page.evaluate(()=>[...document.querySelectorAll('#headerBand .head-right .icon-btn')].map(b=>b.getAttribute('aria-label')));
 assert.equal(headerButtons[headerButtons.indexOf('Search')+1],'Notifications','notifications button must sit next to Search: '+JSON.stringify(headerButtons));
 await page.click('#headerBand .dl-notif-btn');
 await page.waitForSelector('.dl-notif-panel .dl-notif-empty',{timeout:2000});
 assert.match(await page.$eval('.dl-notif-panel',n=>n.textContent),/all caught up/i);
 await page.screenshot({path:path.join(out,'notifications-panel.png')});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('.dl-notif-panel'),{timeout:2000});
 // Item 7: real mouse clicks — clicking the same event again closes its popover.
 await page.evaluate(()=>{state.view='month';state.cursor=new Date(2026,11,9);renderAll(false)});
 const chipSel='.day-cell[data-date="2026-12-09"] .chip';
 await page.click(chipSel);
 await page.waitForSelector('.popover',{timeout:2000});
 await page.click(chipSel);
 await page.waitForFunction(()=>document.querySelectorAll('.popover').length===0,{timeout:2000});
 assert.equal(await page.evaluate(()=>!!popEl),false,'second click on the same event must close its popover');
 // Item 11: the Settings close button owns its whole 36px+ hit area.
 await page.evaluate(()=>openSettings('profile'));
 await page.waitForSelector('.settings-dialog>.settings-close',{timeout:2000});
 await new Promise(resolve=>setTimeout(resolve,350));
 const closeHits=await page.evaluate(()=>{const b=document.querySelector('.settings-dialog>.settings-close'),r=b.getBoundingClientRect();
   return {size:[r.width,r.height],hits:[[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2],[r.left+r.width/2,r.top+r.height/2]].map(([x,y])=>b.contains(document.elementFromPoint(x,y)))}});
 assert.ok(closeHits.size[0]>=36&&closeHits.size[1]>=36,'close hit area too small: '+JSON.stringify(closeHits));
 assert.ok(closeHits.hits.every(Boolean),'something intercepts clicks on the close button: '+JSON.stringify(closeHits));
 const closeBox=await page.$eval('.settings-dialog>.settings-close',b=>{const r=b.getBoundingClientRect();return {x:r.right-3,y:r.bottom-3}});
 await page.mouse.click(closeBox.x,closeBox.y);
 await page.waitForFunction(()=>!document.querySelector('.settings-dialog'),{timeout:2000});
 // Basic render benchmarks in Chromium with 7 synthetic calendars. No live-network latency.
 const timing=await page.evaluate(()=>{
   const sample=(view)=>{state.view=view;const t=performance.now();renderAll(false);return +(performance.now()-t).toFixed(1)};
   return {month_ms:sample('month'),day_ms:sample('day'),week_ms:sample('week')};
 });
 console.log('Synthetic 7-calendar render timings:',JSON.stringify(timing));
 if(errors.length)console.warn('Browser runtime notices:',errors.slice(0,8));
 // Real-page checks (real index.html over HTTP, real boot path): month grid fit at six
 // window heights in both themes, and the cold/warm load path.
 const {spawnSync}=await import('node:child_process');
 for(const [script,env] of [['tests/month-fit.mjs',{HEIGHTS:'1080,998,900,800,700,620'}],['tests/load-path.mjs',{}],['tests/stage1.mjs',{}],['tests/reduce-motion.mjs',{}],['tests/month-switcher.mjs',{}]]){
   const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,...env,CHROME_PATH:chrome},timeout:420000});
   process.stdout.write(run.stdout||'');
   const detail=(run.stdout||'').split(String.fromCharCode(10)).filter(l=>/FAIL|Assertion|Error/.test(l)).slice(0,8).join(String.fromCharCode(10));
   assert.equal(run.status,0,script+' failed: '+detail+' '+(run.stderr||'').slice(0,800));
 }
 console.log('Daylight visual smoke passed. Screenshots:',fs.readdirSync(out));
}catch(error){
 // Surface the failure as a GitHub Actions error annotation (readable from the run page and API).
 const text=String(error&&error.stack||error).split(String.fromCharCode(10)).slice(0,6).join('%0A').slice(0,1500);
 console.log('::error title=Visual suite failed::'+text);
 throw error;
}finally{await browser.close()}
