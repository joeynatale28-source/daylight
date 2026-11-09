/**
 * Faithful local harness. Unlike a hand-built DOM, this loads the REAL
 * index.html and every real script/stylesheet over HTTP (real Google Fonts
 * included), and drives the REAL boot path: Supabase session restore ->
 * loadForUser -> workspace fetch -> render -> reveal. Only the Supabase CDN
 * script is replaced by a small stub that serves a synthetic account.
 *
 * Usage: import {launch, busyPayload} from './harness.mjs'
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT=path.resolve(process.env.HARNESS_ROOT||process.cwd());
const chrome=process.env.CHROME_PATH||[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/google-chrome-stable'
].find(fs.existsSync);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};

export function serve(port=0){
 return new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
   let file=decodeURIComponent(new URL(req.url,'http://x').pathname);
   if(file.endsWith('/'))file+='index.html';
   const full=path.join(ROOT,file);
   if(!full.startsWith(ROOT)||!fs.existsSync(full)||fs.statSync(full).isDirectory()){res.writeHead(404);res.end('nf');return}
   res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
   fs.createReadStream(full).pipe(res);
  }).listen(port,'127.0.0.1',()=>resolve({server,url:'http://127.0.0.1:'+server.address().port+'/'}));
 });
}

const STUB=`(function(){
 var cfg=window.__HARNESS||{};
 var user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}};
 var session=cfg.signedIn===false?null:{user:user,access_token:'t'};
 function chain(table){var q={select(){return q},eq(c,v){if(c==='user_id')q._uid=v;if(c==='revision')q._rev=v;return q},order(){return q},limit(){return q},is(){return q},
  update(v){if(table==='workspace_snapshots'){window.__lastUpdate=v;q._upd=v}return q},upsert(){return Promise.resolve({data:null,error:null})},insert(){return Promise.resolve({data:null,error:null})},
  single(){return q.maybeSingle()},
  maybeSingle(){
   if(table==='workspace_snapshots'){
     return new Promise(function(r){setTimeout(function(){var WS=window.__ws;if(WS){var row=WS[q._uid];if(q._upd){if(row&&row.revision===q._rev){row.payload=q._upd.payload;row.revision=q._upd.revision;r({data:{revision:row.revision},error:null})}else r({data:null,error:null});return}if(!row){var a0=window.__accounts&&window.__accounts[q._uid];row=WS[q._uid]=(a0&&a0.payload===null)?null:{payload:JSON.parse(JSON.stringify((a0&&a0.payload)||cfg.payload)),revision:1}}r({data:row?{payload:row.payload,revision:row.revision}:null,error:null});return}var acct=window.__accounts&&window.__accounts[q._uid];if(acct&&acct.payload===null){r({data:null,error:null});return}r({data:{payload:(acct&&acct.payload)||cfg.payload,revision:1},error:null})},cfg.delayMs||0)});
   }
   return Promise.resolve({data:null,error:null});
  },
  then(done){return Promise.resolve({data:[],error:null}).then(done)}};return q}
 var client={auth:{getSession:function(){return Promise.resolve({data:{session:session},error:null})},
   getUser:function(){return Promise.resolve({data:{user:session&&session.user},error:null})},
   updateUser:function(a){window.__metaUpdates=(window.__metaUpdates||[]).concat([a&&a.data]);return Promise.resolve({data:{user:user},error:null})},
   resetPasswordForEmail:function(e){window.__resetCalls=(window.__resetCalls||[]).concat([e]);return Promise.resolve({data:{},error:null})},
   signOut:function(){return Promise.resolve({})},
   onAuthStateChange:function(cb){window.__authCb=cb;setTimeout(function(){cb(session?'INITIAL_SESSION':'SIGNED_OUT',session)},0);return {data:{subscription:{unsubscribe:function(){}}}}},
   oauth:{listGrants:function(){return Promise.resolve({data:{grants:[]},error:null})}}},
  rpc:function(name,args){
   var B=window.__bc;   /* stand-in for the notification, banner and clear functions: same rules as supabase/sql/2026112[45]_*.sql */
   if(B&&/^daylight_(is_owner|list_broadcasts|mark_broadcasts_read|send_broadcast|delete_broadcast|send_notification|clear_broadcast|admin_list_notifications|send_banner|list_banners|admin_list_banners|delete_banner)$/.test(name)){
    args=args||{};var uid=window.daylightCloud&&window.daylightCloud.user&&window.daylightCloud.user.id;
    var isOwner=!!uid&&B.owners.indexOf(uid)!==-1;B.calls=(B.calls||[]).concat([name]);
    B.banners=B.banners||[];B.clears=B.clears||{};
    var ok=function(d){return Promise.resolve({data:d,error:null})},bad=function(m){return Promise.resolve({data:null,error:{message:m}})};
    if(!uid)return bad('Authenticated session required');
    var accts=window.__accounts||{};
    var resolve=function(list){var out={matched:[],missing:[],ids:[]};(list||[]).map(function(e){return String(e).trim().toLowerCase()}).filter(Boolean).filter(function(e,i,a){return a.indexOf(e)===i}).forEach(function(e){var hit=Object.keys(accts).filter(function(k){return String(accts[k].user.email).toLowerCase()===e})[0];if(hit){out.matched.push(e);out.ids.push(hit)}else out.missing.push(e)});return out};
    var emailsOf=function(ids){return (ids||[]).map(function(k){return accts[k]&&accts[k].user.email}).filter(Boolean)};
    var visible=function(i){return i.audience==='specific'?(i.recipients||[]).indexOf(uid)!==-1:true};
    if(name==='daylight_is_owner')return ok(isOwner);
    if(name==='daylight_list_broadcasts'){var reads=B.reads[uid]||(B.reads[uid]={}),clr=B.clears[uid]||{};return ok(B.items.filter(function(i){return visible(i)&&!clr[i.id]}).sort(function(a,b){return b.t-a.t}).map(function(i){return {id:i.id,title:i.title,body:i.body,sender:'daylight',created_at:new Date(i.t).toISOString(),read:!!reads[i.id]}}))}
    if(name==='daylight_mark_broadcasts_read'){var r2=B.reads[uid]||(B.reads[uid]={});B.items.forEach(function(i){r2[i.id]=1});return ok({ok:true})}
    if(name==='daylight_clear_broadcast'){(B.clears[uid]||(B.clears[uid]={}))[args.p_id]=1;return ok({cleared:true})}
    if(name==='daylight_list_banners')return ok(B.banners.filter(visible).sort(function(a,b){return b.t-a.t}).map(function(b){return {id:b.id,body:b.body,color:b.color,link:b.link||null,created_at:new Date(b.t).toISOString()}}));
    if(!isOwner)return bad('Only the owner can do this');
    if(name==='daylight_send_broadcast'||name==='daylight_send_notification'){var t=String(args.p_title||'').trim(),b=String(args.p_body||'').trim();if(!t||t.length>120)return bad('Title must be 1 to 120 characters');if(!b||b.length>1000)return bad('Message must be 1 to 1000 characters');
     var em=args.p_emails;if(!em||!em.length){var id='bc-'+(B.items.length+1)+'-'+Date.now();B.items.push({id:id,title:t,body:b,t:Date.now(),audience:'everyone',recipients:[]});return ok({sent:true,id:id,audience:'everyone',matched:[],not_found:[]})}
     var r=resolve(em);if(!r.ids.length)return ok({sent:false,audience:'specific',matched:[],not_found:r.missing});
     var id2='bc-'+(B.items.length+1)+'-'+Date.now();B.items.push({id:id2,title:t,body:b,t:Date.now(),audience:'specific',recipients:r.ids});return ok({sent:true,id:id2,audience:'specific',matched:r.matched,not_found:r.missing})}
    if(name==='daylight_admin_list_notifications')return ok(B.items.slice().sort(function(a,b){return b.t-a.t}).map(function(i){return {id:i.id,title:i.title,body:i.body,audience:i.audience,recipients:emailsOf(i.recipients),created_at:new Date(i.t).toISOString()}}));
    if(name==='daylight_delete_broadcast'){B.items=B.items.filter(function(i){return i.id!==args.p_id});return ok({deleted:true})}
    if(name==='daylight_send_banner'){var bt=String(args.p_body||'').trim();if(!bt||bt.length>200)return bad('Banner text must be 1 to 200 characters');if(!/^#[0-9A-Fa-f]{6}$/.test(String(args.p_color||'')))return bad('Pick a banner color');if(args.p_link&&!/^https?:[/][/][^ ]+$/i.test(args.p_link))return bad('The link must start with http:// or https://');
     var be=args.p_emails,bid='bn-'+(B.banners.length+1)+'-'+Date.now();
     if(!be||!be.length){B.banners.push({id:bid,body:bt,color:String(args.p_color).toUpperCase(),link:args.p_link||null,t:Date.now(),audience:'everyone',recipients:[]});return ok({sent:true,id:bid,audience:'everyone',matched:[],not_found:[]})}
     var br=resolve(be);if(!br.ids.length)return ok({sent:false,audience:'specific',matched:[],not_found:br.missing});
     B.banners.push({id:bid,body:bt,color:String(args.p_color).toUpperCase(),link:args.p_link||null,t:Date.now(),audience:'specific',recipients:br.ids});return ok({sent:true,id:bid,audience:'specific',matched:br.matched,not_found:br.missing})}
    if(name==='daylight_admin_list_banners')return ok(B.banners.slice().sort(function(a,b){return b.t-a.t}).map(function(b){return {id:b.id,body:b.body,color:b.color,link:b.link,audience:b.audience,recipients:emailsOf(b.recipients),created_at:new Date(b.t).toISOString()}}));
    if(name==='daylight_delete_banner'){B.banners=B.banners.filter(function(b){return b.id!==args.p_id});return ok({deleted:true})}
   }
   var SH=window.__sh;   /* stand-in for the calendar sharing functions: same rules as supabase/sql/20261126_calendar_sharing.sql */
   if(SH&&/^daylight_(search_people|send_calendar_share|list_calendar_shares|set_calendar_share_permission|revoke_calendar_share|list_my_invites|respond_calendar_share|clear_calendar_invite|leave_calendar_share|list_my_shared_calendars|shared_calendar_events|apply_shared_event_ops)$/.test(name)){
    args=args||{};var me=window.daylightCloud&&window.daylightCloud.user&&window.daylightCloud.user.id;
    SH.calls=(SH.calls||[]).concat([{name:name,args:args}]);SH.shares=SH.shares||[];
    var ok2=function(d){return Promise.resolve({data:d,error:null})},bad2=function(m){return Promise.resolve({data:null,error:{message:m}})};
    if(!me)return bad2('Authenticated session required');
    var acc=window.__accounts||{};window.__ws=window.__ws||{};
    var ws=function(uid){var row=window.__ws[uid];if(!row){var a1=acc[uid];if(!a1||a1.payload===null)return null;row=window.__ws[uid]={payload:JSON.parse(JSON.stringify(a1.payload)),revision:1}}return row};
    var person=function(uid){var a2=acc[uid];if(!a2)return null;var m2=a2.user.user_metadata||{};var nm=m2.full_name||m2.name||String(a2.user.email).split('@')[0];var av=m2.avatar_url&&String(m2.avatar_url).indexOf('/'+uid+'/')!==-1?m2.avatar_url:null;return {id:uid,name:nm,email:a2.user.email,avatar:av}};
    var calOf2=function(owner,calId){var w=ws(owner);if(!w)return null;var cs=(w.payload.calendars||[]).filter(function(c){return c.id===calId});return cs[0]||null};
    var find=function(id){return SH.shares.filter(function(x){return x.id===id})[0]};
    var isOwnedCal=function(c){return c&&!c.subscribed&&!c.builtin&&c.id!=='holidays'};
    if(name==='daylight_search_people'){var q=String(args.p_query||'').trim().toLowerCase();if(q.length<2)return ok2([]);
     var found=Object.keys(acc).filter(function(u){return u!==me}).map(person).filter(function(p){return p.name.toLowerCase().indexOf(q)!==-1||String(p.email).toLowerCase().indexOf(q)!==-1}).slice(0,5);
     return ok2(found.map(function(p){return {user_id:p.id,name:p.name,email:p.email,avatar_url:p.avatar}}))}
    if(name==='daylight_send_calendar_share'){var c0=calOf2(me,args.p_calendar_id);if(!c0)return bad2('Calendar not found');if(!isOwnedCal(c0))return bad2('Only calendars you own can be shared');
     if(args.p_recipient===me)return bad2('You already own this calendar');if(['view','edit'].indexOf(args.p_permission)===-1)return bad2('Choose View only or Can edit');if(!acc[args.p_recipient])return bad2('Person not found');
     var ex=SH.shares.filter(function(x){return x.owner===me&&x.cal===args.p_calendar_id&&x.recipient===args.p_recipient&&(x.status==='pending'||x.status==='accepted')})[0];
     if(ex){if(ex.status==='accepted')return bad2('This person already has access');ex.permission=args.p_permission;ex.cleared=false;ex.created=Date.now();return ok2({id:ex.id,status:'pending',permission:ex.permission})}
     var ns={id:'sh-'+(SH.shares.length+1)+'-'+Date.now(),owner:me,cal:args.p_calendar_id,recipient:args.p_recipient,permission:args.p_permission,status:'pending',cleared:false,created:Date.now()};SH.shares.push(ns);return ok2({id:ns.id,status:'pending',permission:ns.permission})}
    if(name==='daylight_list_calendar_shares')return ok2(SH.shares.filter(function(x){return x.owner===me&&x.cal===args.p_calendar_id&&(x.status==='pending'||x.status==='accepted')}).sort(function(a,b){return (b.status==='accepted')-(a.status==='accepted')||a.created-b.created}).map(function(x){var p=person(x.recipient);return {id:x.id,recipient_id:x.recipient,name:p.name,email:p.email,avatar_url:p.avatar,permission:x.permission,status:x.status,created_at:new Date(x.created).toISOString()}}));
    if(name==='daylight_set_calendar_share_permission'){var s1=find(args.p_id);if(!s1||s1.owner!==me||(s1.status!=='pending'&&s1.status!=='accepted'))return bad2('Share not found');if(['view','edit'].indexOf(args.p_permission)===-1)return bad2('Choose View only or Can edit');s1.permission=args.p_permission;return ok2({permission:s1.permission})}
    if(name==='daylight_revoke_calendar_share'){var s2=find(args.p_id);if(!s2||s2.owner!==me||(s2.status!=='pending'&&s2.status!=='accepted'))return bad2('Share not found');if(s2.status==='pending')SH.shares=SH.shares.filter(function(x){return x!==s2});else{s2.status='revoked';s2.endedBy='owner'}return ok2({revoked:true})}
    if(name==='daylight_list_my_invites')return ok2(SH.shares.filter(function(x){return x.recipient===me&&['pending','accepted','declined'].indexOf(x.status)!==-1&&!x.cleared&&calOf2(x.owner,x.cal)}).sort(function(a,b){return b.created-a.created}).map(function(x){var c=calOf2(x.owner,x.cal),o=person(x.owner);return {id:x.id,status:x.status,permission:x.permission,calendar_id:x.cal,calendar_name:c.name,calendar_color:c.color,owner_name:o.name,owner_email:o.email,owner_avatar:o.avatar,created_at:new Date(x.created).toISOString(),responded_at:x.respondedAt?new Date(x.respondedAt).toISOString():null}}));
    if(name==='daylight_respond_calendar_share'){var s3=find(args.p_id);if(!s3||s3.recipient!==me||s3.status!=='pending')return bad2('This invite is no longer available');s3.status=args.p_accept?'accepted':'declined';s3.respondedAt=Date.now();return ok2({status:s3.status})}
    if(name==='daylight_clear_calendar_invite'){var s4=find(args.p_id);if(!s4||s4.recipient!==me||s4.status==='pending')return bad2('Add or decline this invite first');s4.cleared=true;return ok2({cleared:true})}
    if(name==='daylight_leave_calendar_share'){var s5=find(args.p_id);if(!s5||s5.recipient!==me||s5.status!=='accepted')return bad2('Share not found');s5.status='revoked';s5.endedBy='recipient';return ok2({left:true})}
    if(name==='daylight_list_my_shared_calendars')return ok2(SH.shares.filter(function(x){return x.recipient===me&&x.status==='accepted'&&calOf2(x.owner,x.cal)}).map(function(x){var c=calOf2(x.owner,x.cal),o=person(x.owner);return {share_id:x.id,calendar_id:x.cal,calendar_name:c.name,calendar_color:c.color,owner_id:x.owner,owner_name:o.name,owner_email:o.email,owner_avatar:o.avatar,permission:x.permission,updated_at:new Date().toISOString()}}));
    if(name==='daylight_shared_calendar_events'){var s6=find(args.p_share_id);if(!s6||s6.recipient!==me||s6.status!=='accepted')return bad2('Share not found');var w6=ws(s6.owner);return ok2((w6.payload.events||[]).filter(function(e){return e.cal===s6.cal}))}
    if(name==='daylight_apply_shared_event_ops'){var s7=find(args.p_share_id);if(!s7||s7.recipient!==me||s7.status!=='accepted')return bad2('Share not found');if(s7.permission!=='edit')return bad2('You can view this calendar but not change it');
     var w7=ws(s7.owner);var evs=(w7.payload.events||[]).slice();var created={};var allowed=['title','start','end','allDay','loc','desc','repeat','repeatEnd','accent','weekdaysOnly','reminder','declined','uid','rrule','exdates','timezone','recurrenceId','status','placeId','locationLat','locationLng','dtstamp','sequence'];
     var clean=function(e){var o={};Object.keys(e||{}).forEach(function(k){if(allowed.indexOf(k)!==-1)o[k]=e[k]});return o};
     var ops=args.p_ops||[];for(var i=0;i<ops.length;i++){var op=ops[i],ev=op.event||{};
      if(op.op==='create'){var cl=clean(ev);if(!cl.title||!cl.start||!cl.end)return bad2('An event needs a title, start and end');var nid=evs.reduce(function(m,e){return typeof e.id==='number'&&e.id>m?e.id:m},0)+1;cl.id=nid;cl.cal=s7.cal;evs.push(cl);if(op.client_id!=null)created[op.client_id]=nid}
      else if(op.op==='update'){var idx=-1;evs.forEach(function(e,k){if(e.id===ev.id&&e.cal===s7.cal)idx=k});if(idx<0)return bad2('That event no longer exists');var m3=Object.assign({},evs[idx],clean(ev));m3.id=evs[idx].id;m3.cal=s7.cal;evs[idx]=m3}
      else if(op.op==='delete'){evs=evs.filter(function(e){return !(e.id===ev.id&&e.cal===s7.cal)})}
      else return bad2('Unknown change')}
     w7.payload.events=evs;w7.revision=w7.revision+1;return ok2({created:created,events:evs.filter(function(e){return e.cal===s7.cal})})}
   }
   var S=window.__srv;   /* a tiny stand-in for the sessions functions, switched on by tests that need it */
   if(S){
    args=args||{};
    if(name==='daylight_register_device'){S.registered=(S.registered||[]).concat([args.p_device_id]);var me=S.sessions.find(function(x){return x.id===S.current});if(me){me.device=args.p_device_id;me.label=args.p_label;me.updated=Date.now()}return Promise.resolve({data:{registered:true},error:null})}
    if(name==='daylight_list_my_sessions'){var seen={},out=[];S.sessions.slice().sort(function(a,b){return (b.id===S.current)-(a.id===S.current)||b.updated-a.updated}).forEach(function(x){if(x.device){if(seen[x.device])return;seen[x.device]=1}out.push({id:x.id,user_agent:x.ua,last_active:new Date(x.updated).toISOString(),current:x.id===S.current,device_id:x.device||null,device_label:x.label||''})});return Promise.resolve({data:out,error:null})}
    if(name==='daylight_revoke_my_session'){S.revokeLog=(S.revokeLog||[]).concat([args.p_session_id]);var t=S.sessions.find(function(x){return x.id===args.p_session_id});S.sessions=S.sessions.filter(function(x){return x.id!==args.p_session_id&&!(t&&t.device&&x.device===t.device&&x.id!==S.current)});return Promise.resolve({data:{revoked:true},error:null})}
   }
   if(name==='daylight_list_my_sessions')return Promise.resolve({data:[{id:'s-current',user_agent:'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537',last_active:new Date().toISOString(),current:true}].concat(window.__revoked?[]:[{id:'s-phone',user_agent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604',last_active:new Date(Date.now()-3*3600e3).toISOString(),current:false}]),error:null});
   if(name==='daylight_revoke_my_session'){window.__revoked=true;return Promise.resolve({data:{revoked:true},error:null})}
   return Promise.resolve({data:[],error:null});},from:chain,
  storage:{from:function(){return {upload:function(p){return Promise.resolve({data:{path:p},error:null})},remove:function(p){return Promise.resolve({data:p,error:null})},getPublicUrl:function(p){return {data:{publicUrl:'https://storage.example/avatars/'+p}}}}}},
  functions:{invoke:function(name,opts){
    var body=(opts&&opts.body)||{};window.__calls=window.__calls||[];window.__calls.push({name:name,body:body});
    if(name==='ical-subscribe'&&window.__subs){var sb=window.__subs;
     if(body.action==='list')return Promise.resolve({data:{subscriptions:sb.map(function(x){return Object.assign({},x)})},error:null});
     var sx=sb.filter(function(x){return x.id===body.id})[0];
     if(body.action==='update'){if(sx){if(body.name!==undefined)sx.name=body.name;if(body.color!==undefined)sx.color=body.color}return Promise.resolve({data:{subscription:sx},error:null})}
     if(body.action==='remove'){window.__subs=sb.filter(function(x){return x.id!==body.id});return Promise.resolve({data:{removed:true},error:null})}
     if(body.action==='refresh'){if(sx)sx.last_fetched_at=new Date().toISOString();return Promise.resolve({data:{unchanged:false},error:null})}}
    if(name==='ical-subscribe'&&body.action==='preview')return Promise.resolve({data:{name:'Test Feed',source_host:'example.com'},error:null});
    if(name==='ical-subscribe'&&body.action==='add')return Promise.resolve({data:{ok:true},error:null});
    if(name==='ical-import')return Promise.resolve({data:{added:3,updated:1,skipped:0},error:null});
    return Promise.resolve({data:{subscriptions:[]},error:null});
  }}};
 window.supabase={createClient:function(){return client}};
})();`;

/** A realistic December workspace: stacked multi-day bars, busy days, holidays. */
export const TINY_AVATAR='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNk+M/wn4EIwDiqEAEAAJwDAXH0H7sAAAAASUVORK5CYII=#/00000000-0000-4000-8000-000000000001/';
export function busyPayload({month=11,spans=4,busyDay=9,avatar=''}={}){
 const events=[];let id=1;
 const add=(d,h,t,cal,extra)=>events.push(Object.assign({id:id++,cal,title:t,start:new Date(2026,month,d,h).toISOString(),end:new Date(2026,month,d,h,45).toISOString(),allDay:false,loc:'',desc:''},extra||{}));
 for(let d=1;d<=30;d++){add(d,8,'Practice '+d,'c2');if(d%2)add(d,15,'Homework '+d,'c4')}
 for(let n=0;n<4;n++)add(busyDay,9+n,'Extra '+(n+1),'c1');
 for(let n=0;n<3;n++)add(busyDay+1,9+n,'Late '+(n+1),'c3');
 const bars=[[6,12,'Winter camp'],[7,11,'School trip'],[8,12,'Meet series'],[9,10,'Clinic'],[27,31,'Break'],[28,31,'Closed'],[29,31,'Holiday show']].slice(0,spans?7:0);
 bars.forEach(([a,b,t],i)=>{if(i<spans||i>=4)events.push({id:id++,cal:'c1',title:t,start:new Date(2026,month,a).toISOString(),end:new Date(2026,month,b,23,59).toISOString(),allDay:true,loc:'',desc:''})});
 return {version:2,calendars:[
  {id:'c1',name:'Hungary Creek Recreation Association',color:'teal'},{id:'c2',name:'swimRVA Rapids',color:'blue'},
  {id:'c3',name:'Personal',color:'green'},{id:'c4',name:'School Events and Assignments',color:'violet'},
  {id:'holidays',name:'US Holidays',color:'amber',subscribed:true,builtin:true}],
  events,tasks:[],feeds:[],settings:{themeMode:'system',avatarUrl:avatar},ui:{}};
}

/**
 * Launch the real app. opts: width,height,theme('dark'|'light'),payload,
 * delayMs (workspace fetch latency), signedIn, cache (keep localStorage from
 * a previous launch via userDataDir), month cursor via ?; returns handles.
 */
export async function launch(opts={}){
 const {width=1919,height=998,theme='dark',payload=busyPayload(),delayMs=0,signedIn=true,userDataDir,port=0,cdnDelayMs=0,baseUrl}=opts;
 // baseUrl: measure a DEPLOYED build (real files, real fonts); only Supabase is stubbed.
 const {server,url}=baseUrl?{server:{close(){}},url:baseUrl}:await serve(port);
 const browser=await puppeteer.launch({executablePath:chrome,headless:'new',userDataDir,args:['--no-sandbox']});
 const page=await browser.newPage();
 await page.setViewport({width,height,deviceScaleFactor:1});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:theme}]);
 await page.evaluateOnNewDocument((cfg)=>{window.__HARNESS=cfg;
  if(cfg.signedIn&&cfg.seedSession!==false){try{localStorage.setItem('sb-usihrcucnreecynewgbd-auth-token',JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.com',user_metadata:{full_name:'Calendar Demo'}}}))}catch(e){}}
 },{payload,delayMs,signedIn,seedSession:opts.seedSession});
 await page.setRequestInterception(true);
 page.on('request',r=>{
  const u=r.url();
  if(/cdn\.jsdelivr\.net\/npm\/@supabase/.test(u))return setTimeout(()=>r.respond({status:200,contentType:'text/javascript',body:STUB}),cdnDelayMs);
  if(/supabase\.co/.test(u))return r.respond({status:200,contentType:'application/json',body:'{}'});
  r.continue();
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const logs=[];page.on('console',m=>logs.push(m.text().slice(0,140)));page.on('requestfailed',r=>logs.push('FAILED '+r.url().slice(0,90)));
 const close=async()=>{await browser.close();server.close()};
 return {page,browser,url,errors,close,
  async load({wait=true}={}){await page.goto(url,{waitUntil:'load'});if(wait)await this.ready()},
  async ready(){try{await page.waitForFunction(()=>!!document.querySelector('.month-grid')&&!document.getElementById('dlWorkspaceLoading')&&!document.body.classList.contains('dl-canvas-holding'),{timeout:20000})}catch(e){
   const state=await page.evaluate(()=>({body:document.body.className,grid:!!document.querySelector('.month-grid'),spinner:!!document.getElementById('dlWorkspaceLoading'),app:!document.getElementById('app').hidden,auth:document.getElementById('authRoot').children.length,cloudReady:window.daylightCloud&&window.daylightCloud.ready,fonts:document.fonts.status,sb:typeof window.supabase})).catch(x=>String(x));
   throw new Error('app did not finish booting: '+JSON.stringify(state)+' errors='+JSON.stringify(errors.slice(0,3))+' console='+JSON.stringify(logs.slice(-4)));
  }
  await Promise.race([page.evaluate(()=>document.fonts.ready),new Promise(r=>setTimeout(r,4000))]);await new Promise(r=>setTimeout(r,500))}};
}

/** Measurements of the real month grid at the current viewport. */
export async function measureMonth(page){
 return page.evaluate(()=>{
  const grid=document.querySelector('.month-grid');if(!grid)return null;
  const g=grid.getBoundingClientRect();
  const scrolls=grid.scrollHeight>grid.clientHeight+1;
  const rows=[...grid.querySelectorAll('.month-week')].map(r=>{const b=r.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}});
  const gridTop=Math.round(g.top),viewport=innerHeight;
  const clipped=[];
  const edgeFor=cell=>{const c=cell.getBoundingClientRect();return c.top+cell.clientTop+cell.clientHeight+0.5};
  grid.querySelectorAll('.day-cell').forEach(cell=>{
   const edge=edgeFor(cell);
   cell.querySelectorAll('.cell-events > *').forEach(k=>{
    if(!k.getClientRects().length)return;const b=k.getBoundingClientRect();
    if(b.height&&b.bottom>edge)clipped.push(cell.dataset.date+' '+k.className.split(' ')[0]+' +'+Math.round(b.bottom-edge)+'px');
   });
  });
  grid.querySelectorAll('.dl-continuous-bar').forEach(bar=>{
   if(!bar.getClientRects().length)return;const row=bar.closest('.month-week').getBoundingClientRect();const b=bar.getBoundingClientRect();
   if(b.bottom>row.bottom+0.5)clipped.push('bar '+bar.textContent.slice(0,12)+' +'+Math.round(b.bottom-row.bottom)+'px');
  });
  const lastBottom=rows.length?rows[rows.length-1].bottom:0;
  // Rows must fill from the header to the viewport bottom exactly, unless the grid scrolls.
  const fits=scrolls?true:Math.abs(lastBottom-viewport)<=1;
  const docOverflow=document.documentElement.scrollHeight>viewport+1;
  return {viewport,gridTop,gridBottom:Math.round(g.bottom),rows:rows.map(r=>r.h),lastRowBottom:lastBottom,scrolls,fits,docOverflow,clipped,
   more:[...grid.querySelectorAll('.more-link')].filter(m=>!m.hidden).map(m=>m.textContent).slice(0,8)};
 });
}
