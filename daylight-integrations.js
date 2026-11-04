/* Daylight integrations — additive UI for existing Supabase functions.
 * No change to the verified calendar layout. All privileged work stays server-side.
 */
(function () {
  'use strict';
  const cloud = window.daylightCloud;
  const API = 'https://qrqemjgpzoqhtmsowmqv.supabase.co/functions/v1/';
  const readOnlyCals = new Set();
  let remoteIds = new Set();
  let subscriptionRows = [];
  let currentUser = null;
  const modal = (title, body) => {
    const bd = el('<div class="backdrop"><div class="dialog" style="width:min(520px,95vw)"><div class="dialog-head"><span class="dialog-title">' +
      esc(title) + '</span><button class="icon-btn" data-close title="Close">' + icon('x',17) +
      '</button></div><div class="dialog-body"></div></div></div>');
    bd.querySelector('.dialog-body').appendChild(body);
    overlayRoot.appendChild(bd);
    function close(){ bd.remove(); }
    bd.querySelector('[data-close]').addEventListener('click',close);
    bd.addEventListener('mousedown',e=>{if(e.target===bd)close();});
    return {root:bd,close};
  };
  const html = (markup) => el(markup);
  const note = (msg, danger) => '<p class="inline-note" style="' +(danger?'color:var(--danger);':'')+ '">'+esc(msg)+'</p>';
  const btn = (label, id, kind='btn-ghost') => '<button type="button" class="'+kind+'" id="'+id+'">'+esc(label)+'</button>';
  const row = (label, description, control) => '<div class="set-row switch-row"><span><span class="sw-label">'+esc(label)+'</span><span class="sw-sub">'+esc(description)+'</span></span>'+control+'</div>';
  const own = () => cloud && cloud.ready && cloud.user;
  async function call(fn, body) {
    if (!own()) throw Error('Sign in to daylight first');
    const {data,error} = await cloud.client.functions.invoke(fn,{body});
    if (error) {
      let msg=error.message||'Request failed';
      if(error.context && typeof error.context.json==='function') {
        try{const reply=await error.context.json(); msg=reply.error||msg;}catch{}
      }
      throw Error(msg);
    }
    if(data && data.error) throw Error(data.error);
    return data;
  }
  function showError(target,error){
    target.textContent=error.message||String(error);
    target.style.color='var(--danger)';
  }
  function copy(text) {
    if(!navigator.clipboard || !window.isSecureContext){ toast('Copy needs HTTPS or localhost');return; }
    navigator.clipboard.writeText(text).then(()=>toast('Copied to clipboard')).catch(()=>toast('Copy failed'));
  }
  function download(name,content,type='text/calendar;charset=utf-8') {
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=document.createElement('a'); a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function calendarRow(id){return state.calendars.find(c=>c.id===id);}
  function newEventID(source) {
    let v=2166136261;
    for(let i=0;i<source.length;i++)v=Math.imul(v ^ source.charCodeAt(i),16777619);
    return -1-(v>>>0);
  }
  function localDate(utcText,hour,minute) {
    const d=new Date(utcText);
    return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),hour||0,minute||0);
  }
  function removeRemote() {
    state.events=state.events.filter(ev=>!ev.feedSubscriptionId);
    state.calendars=state.calendars.filter(cal=>!cal.remoteSubscriptionId);
    readOnlyCals.clear();remoteIds.clear();
  }
  function materialize(rows) {
    removeRemote();
    subscriptionRows=rows;
    rows.forEach(s=>{
      const calId='subscription:'+s.id;
      const matches=state.calendars.find(c=>c.id===calId);
      if(matches)return;
      const colorKeys=['teal','blue','violet','green','amber','rose'];
      const color=colorKeys[rows.indexOf(s)%colorKeys.length];
      state.calendars.push({id:calId,name:s.name||'Calendar feed',color,hidden:false,
        subscribed:true,builtin:false,remoteSubscriptionId:s.id});
      remoteIds.add(calId);
      const events=Array.isArray(s.cached_events)?s.cached_events:[];
      events.forEach((e,i)=>{
        try{
          const start=e.allDay?localDate(e.start,0,0):new Date(e.start);
          const end=e.allDay?localDate(e.end,23,59):new Date(e.end);
          if(!(end>start)) return;
          state.events.push({id:newEventID(s.id+':'+(e.occurrence_id||i)),title:e.title||'Untitled',
            cal:calId,start,end,allDay:!!e.allDay,loc:e.location||'',
            desc:e.description||'',repeat:null,reminder:null,declined:e.status==='CANCELLED',
            uid:e.external_uid,feedSubscriptionId:s.id,sourceTimezone:e.source_timezone,
            status:e.status||'CONFIRMED'});
        }catch(error){console.warn('Ignoring invalid subscribed event',error);}
      });
    });
    renderAll(false);
  }
  async function loadSubscriptions() {
    if(!own())return;
    const uid=cloud.user.id;
    try{
      const result=await call('ical-subscribe',{action:'list'});
      if(!own()||cloud.user.id!==uid)return;
      materialize(result.subscriptions||[]);
    }catch(e){console.warn('Subscription refresh failed; existing events remain',e);}
  }
  document.addEventListener('daylight:workspace-ready',loadSubscriptions);
  document.addEventListener('daylight:workspace-signed-out',()=>{
    currentUser=null;subscriptionRows=[];readOnlyCals.clear();remoteIds.clear();
  });
  async function shareDialog(cal) {
    if(!own()||cal.builtin||cal.subscribed)return;
    const body=html('<div class="set-group">'+
      '<div class="set-row switch-row"><span><span class="sw-label">Share this calendar</span>'+
      '<span class="sw-sub">Generate a read-only subscription URL</span></span>'+
      '<label class="switch"><input id="shareToggle" type="checkbox" aria-label="Enable calendar sharing"><span class="track"></span><span class="knob"></span></label></div>'+
      '<div id="shareInfo" role="status">'+note('Loading sharing settings…')+'</div>'+
      '<div id="shareLinks" aria-live="polite"></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px">'+
      btn('Reset link','shareReset','btn-danger-outline')+
      btn('Export calendar (.ics)','shareExport')+'</div>'+
      note("Anyone with this link can see this calendar's events. It's read-only — they can't change anything.")+
      '</div>');
    const dialog=modal('Share · '+cal.name,body);
    const info=body.querySelector('#shareInfo'),links=body.querySelector('#shareLinks'),
      toggle=body.querySelector('#shareToggle'),reset=body.querySelector('#shareReset');
    let busy=false,enabled=false;
    async function status(){
      try{
        const data=await call('ical-feed',{action:'status',calendar_id:cal.id});
        enabled=!!data.enabled;toggle.checked=enabled;reset.hidden=!enabled;
        info.innerHTML=note(enabled
          ? 'Sharing on · '+(data.prefix||'')+'••••••••. The full link cannot be shown again because only a hash is saved. Reset to make a new one.'
          : 'Sharing is off. Only you can access this calendar.');
      }catch(e){showError(info,e);}
    }
    function reveal(result){
      const urls=result.urls;
      if(!urls)return;
      links.innerHTML='<p class="inline-note">Copy the full links now. They will never be displayed again.</p>'+
        '<div class="field"><label for="shareHttps">HTTPS subscription URL</label><input class="text-input" readonly id="shareHttps"></div>'+
        '<div class="field"><label for="shareWebcal">Apple Calendar webcal URL</label><input class="text-input" readonly id="shareWebcal"></div>'+
        '<div style="display:flex;gap:8px">'+btn('Copy HTTPS','copyHttps')+btn('Copy webcal','copyWebcal')+'</div>';
      links.querySelector('#shareHttps').value=urls.https;
      links.querySelector('#shareWebcal').value=urls.webcal;
      links.querySelector('#copyHttps').onclick=()=>copy(urls.https);
      links.querySelector('#copyWebcal').onclick=()=>copy(urls.webcal);
      links.classList.remove('dl-status-enter');void links.offsetWidth;
      links.classList.add('dl-status-enter');
    }
    toggle.onchange=async()=>{
      if(busy)return;
      if(toggle.checked){
        busy=true;toggle.disabled=true;
        try{const data=await call('ical-feed',{action:'enable',calendar_id:cal.id});
          await status();reveal(data);}
        catch(e){toggle.checked=false;showError(info,e);}
        finally{busy=false;toggle.disabled=false;}
      }else{
        toggle.checked=true;
        openConfirm({title:'Disable calendar sharing?',
          body:'Anyone using this feed link will immediately lose access. The URL will return 404.',
          confirmLabel:'Disable sharing',danger:true,fn:async()=>{
            busy=true;toggle.disabled=true;
            try{await call('ical-feed',{action:'disable',calendar_id:cal.id});
              links.innerHTML='';await status();}
            catch(e){showError(info,e);}
            finally{busy=false;toggle.disabled=false;}
          }});
      }
    };
    reset.onclick=()=>openConfirm({
      title:'Reset calendar link?',
      body:'Any app using the old link will stop syncing immediately. The old URL will return 404.',
      confirmLabel:'Reset link',danger:true,fn:async()=>{
        reset.disabled=true;
        try{const data=await call('ical-feed',{action:'reset',calendar_id:cal.id});
          links.innerHTML='';await status();reveal(data);}
        catch(e){showError(info,e);}
        finally{reset.disabled=false;}
      }
    });
    body.querySelector('#shareExport').onclick=()=>window.daylightExportCalendar(cal,info);
    await status();
    return dialog;
  }
  window.daylightExportCalendar=async function(cal,errorTarget) {
    if(!own()||!cal||cal.builtin||cal.subscribed)return;
    try{
      const contents=await call('ical-feed',{action:'export',calendar_id:cal.id});
      download((cal.name||'calendar').replace(/[^a-z0-9_-]+/gi,'-')+'.ics',contents);
      toast('Calendar exported');
    }catch(e){if(errorTarget)showError(errorTarget,e);else toast(e.message||'Unable to export calendar');}
  };
  window.daylightShareCalendar=shareDialog;
  const originalCalendarPane=paneCalendar;
  paneCalendar=function(pane,close){
    originalCalendarPane(pane,close);
    const group=html('<div class="set-group"><div class="set-group-title">Sharing</div>'+
      '<p class="pane-sub">Choose an owned calendar to manage its subscription link.</p>'+
      '<div class="dl-settings-share" id="calendarShareActions"></div></div>');
    pane.appendChild(group);
    const actions=group.querySelector('#calendarShareActions');
    state.calendars.filter(c=>!c.subscribed&&!c.builtin).forEach(cal=>{
      const b=html('<button class="btn-ghost" type="button"></button>');
      b.textContent='Share · '+cal.name;
      b.addEventListener('click',()=>shareDialog(cal));
      actions.appendChild(b);
    });
  };

  window.daylightExportEvent=async function(event) {
    if(!own())return;
    const calendar=calendarRow(event.cal);
    if(!calendar||calendar.builtin||calendar.subscribed){toast('Subscribed events cannot be exported individually');return;}
    try{
      const data=await call('ical-feed',{action:'export',calendar_id:calendar.id,event_id:event.id});
      download((event.title||'event').replace(/[^a-z0-9_-]+/gi,'-')+'.ics',data);
      toast('Event exported');
    }catch(error){toast(error.message||'Unable to export event');}
  };
  function feedPane(pane) {
    const existing=pane.querySelector('.set-group');
    if(existing)existing.remove();
    const g=html('<div class="set-group"><div class="set-group-title">Subscribe and share calendars</div>'+
      '<p class="pane-sub">Add a read-only iCalendar feed. Other calendar events are updated through Supabase and retain their original time zones.</p>'+
      '<div class="field"><label for="subName">Calendar name (optional)</label><input class="text-input" id="subName" placeholder="Use the feed’s calendar name"></div>'+
      '<div class="field"><label for="subUrl">Calendar URL</label><input class="text-input" id="subUrl" placeholder="https://example.com/calendar.ics">'+
      '</div><div style="display:flex;gap:8px">'+btn('Add calendar by URL','subAdd','btn-primary')+btn('Refresh subscriptions','subReload')+'</div>'+
      '<div id="subStatus" role="status" style="margin:10px 0"></div><div id="subList"></div></div>');
    pane.insertBefore(g,pane.firstElementChild.nextElementSibling||null);
    const importGroup=html('<div class="set-group"><div class="set-group-title">Import iCalendar (.ics)</div>'+
      '<p class="pane-sub">Import events into a calendar you own. Re-importing the same file matches events by UID.</p>'+
      '<div class="field"><label for="icsCalendar">Destination calendar</label><select class="text-input" id="icsCalendar"></select></div>'+
      '<input class="text-input" type="file" id="icsFile" accept=".ics,text/calendar">'+
      '<div style="margin-top:10px">'+btn('Import .ics','icsImport','btn-primary')+'</div>'+
      '<div class="inline-note" id="icsResult" role="status"></div></div>');
    pane.insertBefore(importGroup,g.nextSibling);
    const selector=importGroup.querySelector('#icsCalendar');
    state.calendars.filter(c=>!c.subscribed&&!c.builtin).forEach(c=>{
      const option=document.createElement('option');option.value=c.id;option.textContent=c.name;
      selector.appendChild(option);
    });
    importGroup.querySelector('#icsImport').onclick=async()=>{
      const file=importGroup.querySelector('#icsFile').files?.[0];
      const result=importGroup.querySelector('#icsResult');
      if(!file||!selector.value){result.textContent='Choose a .ics file and an owned calendar';return;}
      if(file.size>2500000){result.textContent='Maximum file size: 2.5 MB';return;}
      try{
        const imported=await call('ical-import',{action:'import',calendar_id:selector.value,ics:await file.text()});
        result.textContent=imported.added+' added, '+imported.updated+' updated, '+imported.skipped+' skipped. Reloading…';
        // The Edge Function uses a compare-and-swap workspace revision.
        // Reload rather than risk overwriting imported data with an older open snapshot.
        location.reload();
      }catch(e){showError(result,e);}
    };
    const status=g.querySelector('#subStatus'),list=g.querySelector('#subList');
    function draw(){
      list.innerHTML='';
      if(!subscriptionRows.length)list.appendChild(html(note('No external calendar subscriptions yet.')));
      subscriptionRows.forEach(s=>{
        const card=html('<div class="feed-row"><span class="fr-url">'+esc(s.name||'Calendar')+
          '<br><span class="fr-sub">'+esc(s.url||'')+
          (s.last_error?' · Couldn’t update: '+esc(s.last_error):' · Last fetched: '+esc(s.last_fetched_at?new Date(s.last_fetched_at).toLocaleString():'Never'))+
          (s.skipped_count?' · '+s.skipped_count+' skipped':'')+
          '</span></span>'+btn('Refresh','refreshOne')+btn('Remove','removeOne','btn-danger-outline')+'</div>');
        card.querySelector('#refreshOne').onclick=async()=>{
          try{
            status.textContent='Refreshing…';
            await call('ical-subscribe',{action:'refresh',id:s.id});
            await loadSubscriptions();draw();status.textContent='Subscription checked';
          }catch(e){showError(status,e);}
        };
        card.querySelector('#removeOne').onclick=()=>openConfirm({
          title:'Remove subscription?',body:'Read-only events from this feed will disappear from daylight. The original calendar is not affected.',
          confirmLabel:'Remove',danger:true,fn:async()=>{
            try{await call('ical-subscribe',{action:'remove',id:s.id});await loadSubscriptions();draw();toast('Subscription removed');}
            catch(e){showError(status,e);}
          }
        });
        list.appendChild(card);
      });
    }
    g.querySelector('#subAdd').onclick=async()=>{
      const b=g.querySelector('#subAdd');b.disabled=true;status.textContent='Validating and importing calendar…';
      try{
        const result=await call('ical-subscribe',{action:'add',url:g.querySelector('#subUrl').value.trim(),
          name:g.querySelector('#subName').value.trim()});
        await loadSubscriptions();draw();
        g.querySelector('#subUrl').value='';g.querySelector('#subName').value='';
        status.textContent='Added '+result.imported+' events'+(result.skipped?' ('+result.skipped+' skipped)':'');
      }catch(e){showError(status,e);}
      finally{b.disabled=false;}
    };
    g.querySelector('#subReload').onclick=async()=>{
      status.textContent='Checking feeds…';
      try{
        for(const s of subscriptionRows)await call('ical-subscribe',{action:'refresh',id:s.id});
        await loadSubscriptions();draw();status.textContent='Feeds checked';
      }catch(e){showError(status,e);}
    };
    draw();
  }
  const originalData=paneData;
  paneData=function(pane,close){
    originalData(pane,close);
    feedPane(pane);
  };
  function tokenRaw(){
    const b=new Uint8Array(32);crypto.getRandomValues(b);
    return 'dl_mcp_'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function tokenHash(token){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function aiPane(pane) {
    paneHead(pane,'AI access','Approve AI calendar access with revocable, scoped tokens.');
    const g=html('<div class="set-group"><div class="set-group-title">Create access token</div>'+
      '<div class="field"><label for="mcpName">Token name</label><input class="text-input" id="mcpName" placeholder="My AI client"></div>'+
      '<div class="field"><label><input type="checkbox" id="mcpRead" checked> Read calendars and tasks</label></div>'+
      '<div class="field"><label><input type="checkbox" id="mcpWrite"> Create or edit calendars and tasks</label></div>'+
      btn('Create token','mcpCreate','btn-primary')+'<div id="mcpOnce"></div><div id="mcpStatus" role="status"></div></div>'+
      '<div class="set-group"><div class="set-group-title">Active tokens</div><div id="mcpTokens"></div></div>'+
      '<div class="set-group"><div class="set-group-title">Destructive access</div>'+
      row('Allow AI event deletion','Off by default, even for tokens with write access.','<input type="checkbox" id="mcpDelete">')+
      '<div id="mcpDeleteStatus"></div></div>'+
      '<div class="set-group"><div class="set-group-title">MCP server</div>'+
      '<p class="pane-sub">Connect a Streamable HTTP MCP client with your own token.</p>'+
      '<input class="text-input" readonly id="mcpUrl"><pre id="mcpConfig" style="white-space:pre-wrap;font-size:12px"></pre>'+
      btn('Copy client config','mcpCopy')+'</div>'+
      '<div class="set-group"><div class="set-group-title">Recent AI activity</div><div id="mcpAudit"></div></div>');
    pane.appendChild(g);
    const status=g.querySelector('#mcpStatus');
    const url=window.DAYLIGHT_MCP_URL || API+'daylight-mcp';
    g.querySelector('#mcpUrl').value=url;
    const config=JSON.stringify({mcpServers:{daylight:{type:'http',url,headers:{Authorization:'Bearer YOUR_TOKEN'}}}},null,2);
    g.querySelector('#mcpConfig').textContent=config;
    g.querySelector('#mcpCopy').onclick=()=>copy(config);
    const db=cloud.client;
    async function load(){
      if(!own())return;
      const [tokens,settings,audit]=await Promise.all([
        db.from('mcp_tokens').select('id,name,token_prefix,scopes,created_at,last_used_at,revoked').eq('user_id',cloud.user.id).eq('revoked',false).order('created_at',{ascending:false}),
        db.from('user_settings').select('mcp_allow_delete').eq('user_id',cloud.user.id).maybeSingle(),
        db.from('mcp_audit_log').select('tool,action,created_at').eq('user_id',cloud.user.id).order('created_at',{ascending:false}).limit(15)
      ]);
      if(tokens.error)showError(status,tokens.error);
      const list=g.querySelector('#mcpTokens');list.innerHTML='';
      (tokens.data||[]).forEach(t=>{
        const item=html('<div class="feed-row"><span class="fr-url">'+esc(t.name)+
          '<br><span class="fr-sub">'+esc(t.token_prefix||'')+'•••• · '+esc((t.scopes||[]).join(', '))+
          ' · Last used: '+esc(t.last_used_at?new Date(t.last_used_at).toLocaleString():'Never')+
          '</span></span>'+btn('Revoke','revoke','btn-danger-outline')+'</div>');
        item.querySelector('#revoke').onclick=()=>openConfirm({
          title:'Revoke AI token?',body:'This token will immediately stop working.',
          confirmLabel:'Revoke',danger:true,fn:async()=>{
            const {error}=await db.from('mcp_tokens').update({revoked:true}).eq('id',t.id).eq('user_id',cloud.user.id);
            if(error)showError(status,error);else{toast('Token revoked');load();}
          }
        });list.appendChild(item);
      });
      if(!list.children.length)list.innerHTML=note('No active AI tokens');
      g.querySelector('#mcpDelete').checked=!!(settings.data&&settings.data.mcp_allow_delete);
      const history=g.querySelector('#mcpAudit');history.innerHTML='';
      (audit.data||[]).forEach(a=>{
        history.appendChild(html('<div class="feed-row">'+esc(a.tool)+' · '+esc(a.action)+' · '+esc(new Date(a.created_at).toLocaleString())+'</div>'));
      });
      if(!history.children.length)history.innerHTML=note('No AI actions recorded yet');
    }
    g.querySelector('#mcpCreate').onclick=async()=>{
      const name=g.querySelector('#mcpName').value.trim();
      const scopes=[];
      if(g.querySelector('#mcpRead').checked)scopes.push('read');
      if(g.querySelector('#mcpWrite').checked){scopes.push('write');if(!scopes.includes('read'))scopes.push('read');}
      if(!name||name.length>100||!scopes.length){status.textContent='Enter a name and choose a scope';return;}
      const raw=tokenRaw(),hashed=await tokenHash(raw);
      const {error}=await db.from('mcp_tokens').insert({user_id:cloud.user.id,name,scopes,
        token_prefix:raw.slice(7,15),token_hash:hashed});
      if(error)return showError(status,error);
      const once=g.querySelector('#mcpOnce');
      once.innerHTML='<p class="inline-note">Copy this token now. It will not appear again.</p>'+
        '<input class="text-input" readonly id="mcpRaw">'+btn('Copy token','mcpCopyRaw');
      once.querySelector('#mcpRaw').value=raw;
      once.querySelector('#mcpCopyRaw').onclick=()=>copy(raw);
      g.querySelector('#mcpName').value='';
      status.textContent='Token created';load();
    };
    g.querySelector('#mcpDelete').onchange=function(){
      if(!this.checked){
        db.from('user_settings').upsert({user_id:cloud.user.id,mcp_allow_delete:false}).then(({error})=>{
          if(error)showError(g.querySelector('#mcpDeleteStatus'),error);else toast('AI deletion disabled');
        });return;
      }
      this.checked=false;
      openConfirm({title:'Allow AI deletion?',body:'AI clients holding a write token will be able to permanently delete calendar events. This is account-wide until you turn it off.',
        confirmLabel:'Enable deletion',danger:true,fn:async()=>{
          const {error}=await db.from('user_settings').upsert({user_id:cloud.user.id,mcp_allow_delete:true});
          if(error)showError(g.querySelector('#mcpDeleteStatus'),error);else{g.querySelector('#mcpDelete').checked=true;toast('AI deletion enabled');}
        }});
    };
    load().catch(e=>showError(status,e));
  }
  window.daylightAiPane=aiPane;
  // Refreshes only session-owned subscription caches; snapshot saves exclude read-only rows.
})();
