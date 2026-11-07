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
    function close(){ if(window.daylightExit)window.daylightExit(bd);else bd.remove(); }
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
    const former=new Map(state.calendars.filter(c=>c.remoteSubscriptionId).map(c=>[c.id,c.hidden]));
    let stored={};
    try{stored=JSON.parse(localStorage.getItem('daylight-feed-visibility:'+cloud.user?.id)||'{}')}catch{}
    removeRemote();
    subscriptionRows=rows;
    rows.forEach(s=>{
      const calId='subscription:'+s.id;
      const matches=state.calendars.find(c=>c.id===calId);
      if(matches)return;
      const colorKeys=['teal','blue','violet','green','amber','rose'];
      const color=(PALETTE[s.color]||/^#[0-9a-f]{6}$/i.test(String(s.color||"")))?s.color:colorKeys[rows.indexOf(s)%colorKeys.length];
      state.calendars.push({id:calId,name:s.name||'Calendar feed',color,
        hidden:former.has(calId)?former.get(calId):!!stored[calId],
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
    const key='daylight-subscription-cache:'+uid;
    if(!subscriptionRows.length){
      try{
        const cached=JSON.parse(localStorage.getItem(key)||'null');
        if(Array.isArray(cached))materialize(cached);
      }catch(e){console.warn('Cached subscriptions unavailable',e);}
    }
    try{
      const result=await Promise.race([
        call('ical-subscribe',{action:'list'}),
        new Promise((_,reject)=>setTimeout(()=>reject(Error('Subscription refresh timeout')),8000))
      ]);
      if(!own()||cloud.user.id!==uid)return;
      const rows=result.subscriptions||[];
      const contentSignature=items=>JSON.stringify(items.map(x=>[x.id,x.name,x.color,x.cached_events]));
      if(contentSignature(rows)!==contentSignature(subscriptionRows))materialize(rows);
      else subscriptionRows=rows;
      try{localStorage.setItem(key,JSON.stringify(rows));}catch{}
      // Stale-while-revalidate: fetch existing sources concurrently after painting.
      // Each backend call is independently bounded and keeps the last-good cache on failure.
      if(!loadSubscriptions.lastRefresh || Date.now()-loadSubscriptions.lastRefresh>10*60*1000){
        loadSubscriptions.lastRefresh=Date.now();
        Promise.allSettled(rows.map(s=>Promise.race([
          call('ical-subscribe',{action:'refresh',id:s.id}),
          new Promise((_,reject)=>setTimeout(()=>reject(Error('Feed refresh timeout')),7500))
        ]))).then(results=>{
          if(own()&&cloud.user.id===uid&&results.some(r=>r.status==='fulfilled'&&!r.value.unchanged))
            loadSubscriptions();
        });
      }
    }catch(e){console.warn('Subscription refresh failed; cached events remain',e);}
  }
  document.addEventListener('daylight:workspace-ready',loadSubscriptions);
  document.addEventListener('daylight:workspace-preview-ready',()=>{
    if(!cloud?.user)return;
    try{
      const rows=JSON.parse(localStorage.getItem('daylight-subscription-cache:'+cloud.user.id)||'null');
      if(Array.isArray(rows))materialize(rows);
    }catch(error){console.warn('Cached feed preview unavailable',error)}
  });
  document.addEventListener('daylight:workspace-ready',()=>{
    const summary=sessionStorage.getItem('daylight-ics-last-result');
    if(!summary)return;
    sessionStorage.removeItem('daylight-ics-last-result');
    setTimeout(()=>{
      openSettings('data');
      const result=document.getElementById('icsResult');
      if(result)result.textContent=summary;
    },50);
  });
  document.addEventListener('daylight:workspace-signed-out',()=>{
    currentUser=null;subscriptionRows=[];readOnlyCals.clear();remoteIds.clear();
  });
  window.daylightCalendarShareAction=function(body){return call('ical-feed',body);};
  window.daylightExportCalendar=async function(cal){
    if(!own()||!cal||cal.builtin||cal.subscribed)return;
    try{
      const ics=await call('ical-feed',{action:'export',calendar_id:cal.id});
      download((cal.name||'calendar').replace(/[^a-z0-9_-]+/gi,'-')+'.ics',ics);
      toast('Calendar exported');
    }catch(error){toast(error.message||'Export failed');}
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
    const g=html('<div class="set-group"><div class="set-group-title">Subscribed calendars</div>'+
      '<p class="pane-sub">Add new feeds using the + button in the sidebar. Manage existing feeds here.</p>'+
      '<div style="display:flex;gap:8px">'+btn('Refresh subscriptions','subReload')+'</div>'+
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
        const summary=imported.added+' added, '+imported.updated+' updated, '+imported.skipped+' skipped.';
        result.textContent=summary+' Reloading to display the imported events…';
        sessionStorage.setItem('daylight-ics-last-result',summary);
        // Reload the revisioned snapshot to avoid overwriting the imported events.
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
          '</span></span>'+btn('Refresh','refreshOne')+btn('Manage','manageOne')+btn('Remove','removeOne','btn-danger-outline')+'</div>');
        card.querySelector('#manageOne').onclick=()=>showManageSubscription(s);
        card.querySelector('#refreshOne').onclick=async()=>{
          try{
            status.textContent='Refreshing…';
            await call('ical-subscribe',{action:'refresh',id:s.id,force:true});
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
    g.querySelector('#subReload').onclick=async()=>{
      status.textContent='Checking feeds…';
      const outcomes=await Promise.allSettled(subscriptionRows.map(s=>Promise.race([
        call('ical-subscribe',{action:'refresh',id:s.id,force:true}),
        new Promise((_,reject)=>setTimeout(()=>reject(Error('Feed refresh timed out')),8000))
      ])));
      await loadSubscriptions();draw();
      const failures=outcomes.filter(x=>x.status==='rejected').length;
      status.textContent=failures?outcomes.length-failures+' checked; '+failures+' failed (cached events kept)':'All subscriptions checked';
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
    if(!document.getElementById('dl-ai-skeleton-style')){const style=document.createElement('style');style.id='dl-ai-skeleton-style';style.textContent=".dl-ai-skeleton{opacity:.85}.dl-ai-skeleton i{display:block;height:9px;width:62%;margin:5px 0;border-radius:5px;background:linear-gradient(90deg,var(--surface) 20%,var(--hover) 50%,var(--surface) 80%);background-size:200% 100%;animation:dlShimmer 1.2s linear infinite}.dl-ai-skeleton i+i{width:38%}@media(prefers-reduced-motion:reduce){.dl-ai-skeleton i{animation:none}}";document.head.appendChild(style)}
    paneHead(pane,'AI access','Approve AI calendar access with revocable, scoped tokens.');
    const g=html('<div class="dl-ai-wrap"><div class="set-group"><div class="set-group-title">Create access token</div>'+
      '<div class="field"><label for="mcpName">Token name</label><input class="text-input" id="mcpName" placeholder="My AI client"></div>'+
      row('Read access','List calendars, events, and tasks.',switchHTML('mcpRead',true))+
      row('Write access','Create and edit calendars, events, and tasks.',switchHTML('mcpWrite',false))+
      btn('Create token','mcpCreate','btn-primary')+'<div id="mcpOnce"></div><div id="mcpStatus" role="status"></div></div>'+
      '<div class="set-group"><div class="set-group-title">Active tokens</div><div id="mcpTokens"></div></div>'+
      '<div class="set-group"><div class="set-group-title">Legacy token deletion</div>'+
      row('Allow deletion with legacy tokens','This setting applies only to personal legacy tokens. OAuth client permissions are shown separately below.',switchHTML('mcpDelete',false))+
      '<div id="mcpDeleteStatus"></div></div>'+
      '<div class="set-group"><div class="set-group-title">Connect a client</div>'+ 
      '<p class="pane-sub">Connect a Streamable HTTP MCP client with your own token.</p>'+
      '<input class="text-input" readonly id="mcpUrl"><pre id="mcpConfig" style="white-space:pre-wrap;font-size:12px"></pre>'+
      btn('Copy server URL','mcpCopyUrl')+' '+btn('Copy client config','mcpCopy')+'</div>'+ 
      '<div class="set-group"><div class="set-group-title">Recent AI activity</div><div id="mcpAudit"></div></div></div>');
    pane.appendChild(g);
    const status=g.querySelector('#mcpStatus');
    const url=window.DAYLIGHT_MCP_URL || API+'daylight-mcp';
    g.querySelector('#mcpUrl').value=url;
    const config=JSON.stringify({mcpServers:{daylight:{type:'http',url,headers:{Authorization:'Bearer YOUR_TOKEN'}}}},null,2);
    g.querySelector('#mcpConfig').textContent=config;
    g.querySelector('#mcpCopy').onclick=()=>copy(config);
    g.querySelector('#mcpCopyUrl').onclick=()=>copy(url);
    const db=cloud.client;
    async function load(){
      if(!own())return;
      const [tokens,settings,audit,oauthGrants]=await Promise.all([
        db.from('mcp_tokens').select('id,name,token_prefix,scopes,created_at,last_used_at,revoked').eq('user_id',cloud.user.id).eq('revoked',false).order('created_at',{ascending:false}),
        db.from('user_settings').select('mcp_allow_delete').eq('user_id',cloud.user.id).maybeSingle(),
        db.from('mcp_audit_log').select('tool,action,created_at,token_name,summary,target_id').eq('user_id',cloud.user.id).order('created_at',{ascending:false}).limit(75),
        db.from('mcp_grants').select('client_id,client_name,can_read,can_write,can_delete,granted_at').eq('user_id',cloud.user.id).is('revoked_at',null).order('granted_at',{ascending:false})
      ]);
      if(tokens.error)showError(status,tokens.error);
      const grantBox=html('<div class="set-group"><div class="set-group-title">Connected OAuth clients</div><p class="pane-sub">These scopes are the permissions actually granted through daylight’s OAuth consent screen.</p><div id="mcpOAuthGrants"></div></div>');
      const tokenGroup=g.querySelector('#mcpTokens').closest('.set-group');
      tokenGroup.parentNode.insertBefore(grantBox,tokenGroup);
      const grantList=grantBox.querySelector('#mcpOAuthGrants');grantList.innerHTML='';
      (oauthGrants.data||[]).forEach(grant=>{
        const item=html('<div class="feed-row"><span class="fr-url"><strong></strong><br><span class="fr-sub"></span></span></div>');
        item.querySelector('strong').textContent=grant.client_name||'Connected client';
        const scopes=[['Read',grant.can_read],['Write',grant.can_write],['Delete',grant.can_delete]];
        item.querySelector('.fr-sub').textContent=scopes.map(([name,enabled])=>name+': '+(enabled?'Granted':'Not granted')).join(' · ')+' · Connected '+new Date(grant.granted_at).toLocaleDateString();
        grantList.appendChild(item);
      });
      if(!grantList.children.length)grantList.innerHTML=note('No active OAuth clients are connected.');
      const list=g.querySelector('#mcpTokens');list.innerHTML='';
      (tokens.data||[]).forEach(t=>{
        const item=html('<div class="feed-row"><span class="fr-url">'+esc(t.name)+
          '<br><span class="fr-sub">'+esc(t.token_prefix||'')+'•••• · '+esc((t.scopes||[]).join(', '))+' · Created: '+esc(new Date(t.created_at).toLocaleDateString())+
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
      if(!list.children.length)list.innerHTML=note('No tokens yet — create one to connect an AI client.');
      g.querySelector('#mcpDelete').checked=!!(settings.data&&settings.data.mcp_allow_delete);
      const history=g.querySelector('#mcpAudit');
      history.innerHTML=Array.from({length:4},()=>'<div class="feed-row dl-ai-skeleton"><span class="fr-url"><i></i><i></i></span></div>').join('');
      const [{data:legacyAudit},{data:workspaceRow}]=await Promise.all([
        db.from('mcp_workspace_audit').select('tool,result,created_at,client_id,target_id,target_title')
          .eq('user_id',cloud.user.id).order('created_at',{ascending:false}).limit(75),
        db.from('workspace_snapshots').select('payload').eq('user_id',cloud.user.id).maybeSingle()
      ]);
      const payload=workspaceRow&&workspaceRow.payload||{};
      const events=Array.isArray(payload.events)?payload.events:[];
      const calendars=Array.isArray(payload.calendars)?payload.calendars:[];
      function resolveAuditTarget(record){
        const storedTitle=[record.event_title,record.target_title,record.title,record.name,record.summary]
          .map(value=>String(value||'').trim())
          .find(value=>value&&!/^(?:event|calendar|task|item|record)$/i.test(value));
        if(storedTitle)return 'Event: '+storedTitle;
        if(record.target_id==null||record.target_id==='')return '';
        const raw=String(record.target_id).trim(),id=raw.replace(/^(?:event|calendar|task):/i,'');
        const event=events.find(e=>String(e.id)===id||String(e.uid||'')===id);
        if(event){
          const cal=calendars.find(c=>String(c.id)===String(event.cal));
          return 'Event: '+String(event.title||'Untitled')+(cal?' · '+String(cal.name):'');
        }
        const calendar=calendars.find(c=>String(c.id)===id);
        if(calendar)return 'Calendar: '+String(calendar.name||'Calendar')+' · event title not stored on this activity';
        const task=Array.isArray(payload.tasks)?payload.tasks.find(task=>String(task.id)===id):null;
        if(task)return 'Task: '+String(task.title||'Untitled');
        if(/delete_event/i.test(String(record.tool)))return 'Event ID '+id+' · title is not in the audit record or current workspace';
        if(/create_event/i.test(String(record.tool)))return 'Calendar target '+id+' · event title is not in the audit record';
        return 'Target ID '+id+' · no title in the audit record or current workspace';
      }
      const merged=(audit.data||[]).concat((legacyAudit||[]).map(a=>({
        tool:a.tool,action:a.result,created_at:a.created_at,
        token_name:a.client_id,summary:'',target_id:a.target_id,target_title:a.target_title
      }))).map(a=>{
        const resolved=resolveAuditTarget(a);
        return Object.assign({},a,{summary:resolved||a.summary||''});
      }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      function showAudit(limit){
        history.innerHTML='';
        merged.slice(0,limit).forEach(a=>{
          const isDelete=String(a.tool).includes('delete');
          const item=html('<div class="feed-row" style="'+(isDelete?'color:var(--danger)':'')+'">'+
            '<span class="fr-url">'+esc(a.tool)+' · '+esc(a.action)+
            '<br><span class="fr-sub">'+esc(a.token_name||'AI client')+' · '+
            esc(a.summary||('Target '+String(a.target_id||'not stored')+' · title unavailable'))+' · '+esc(new Date(a.created_at).toLocaleString())+
            '</span></span></div>');
          history.append(item);
        });
        if(merged.length>limit){
          const more=html('<button class="btn-ghost" style="margin-top:8px">Show more</button>');
          more.onclick=()=>showAudit(Math.min(limit+15,merged.length));history.append(more);
        }
        if(!merged.length)history.innerHTML=note('No AI actions recorded yet');
      }
      showAudit(15);
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
      const reveal=html('<div class="dl-token-reveal"><p class="pane-sub">You won’t be able to see this again — if you lose it, revoke it and make a new one.</p>'+
        '<div class="field"><label for="mcpRaw">Access token</label><input class="text-input" readonly id="mcpRaw"></div>'+
        btn('Copy token','mcpCopyRaw','btn-primary')+'</div>');
      const revealDialog=modal('Your new AI access token',reveal);
      reveal.querySelector('#mcpRaw').value=raw;
      reveal.querySelector('#mcpCopyRaw').onclick=()=>copy(raw);
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
  // Manage subscribed calendars from their existing sidebar rows.
  function showManageSubscription(sub) {
    const card=html('<div class="dl-manage-feed">'+
      '<div class="set-row"><span class="sw-label">Calendar</span><strong id="managedName"></strong></div>'+
      '<div class="set-row"><span class="sw-label">Last updated</span><span id="managedUpdated"></span></div>'+
      '<div class="set-row"><span class="sw-label">Feed status</span><span id="managedStatus"></span></div>'+
      '<div class="field"><label>Color</label><div class="dl-color-grid" id="managedColors"></div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'+
      btn('Refresh now','manageRefresh')+btn('Rename','manageRename')+
      btn('Unsubscribe','manageRemove','btn-danger-outline')+'</div>'+
      '<p class="inline-note" id="managedFeedback" role="status"></p></div>');
    card.querySelector('#managedName').textContent=sub.name||'Subscribed calendar';
    card.querySelector('#managedUpdated').textContent=sub.last_fetched_at?
      new Date(sub.last_fetched_at).toLocaleString():'Never';
    card.querySelector('#managedStatus').textContent=sub.last_error||'Up to date';
    const dialog=modal('Manage subscription',card);
    const target=card.querySelector('#managedFeedback');
    const colorGrid=card.querySelector('#managedColors');
    async function applyManagedColor(color){
      const scrollTop=colorGrid.scrollTop;
      try{
        await call('ical-subscribe',{action:'update',id:sub.id,color});
        sub.color=color;
        await loadSubscriptions();
        colorGrid.innerHTML='';
        window.daylightColorPicker(colorGrid,color,applyManagedColor);
        colorGrid.scrollTop=scrollTop;
        target.textContent='Calendar color updated.';
        toast('Calendar color updated');
      }catch(error){showError(target,error)}
    }
    window.daylightColorPicker(colorGrid,sub.color,applyManagedColor);
    card.querySelector('#manageRefresh').onclick=async()=>{
      target.textContent='Checking calendar feed…';
      try{await call('ical-subscribe',{action:'refresh',id:sub.id,force:true});
        await loadSubscriptions();target.textContent='Calendar refreshed. Last updated: '+new Date().toLocaleString();}
      catch(error){showError(target,error)}
    };
    card.querySelector('#manageRename').onclick=()=>{
      dialog.close();
      manageSubscription({id:'subscription:'+sub.id,name:sub.name},null,'rename');
    };
    card.querySelector('#manageRemove').onclick=()=>{
      dialog.close();
      manageSubscription({id:'subscription:'+sub.id,name:sub.name},null,'remove');
    };
  }
    function manageSubscription(cal,anchor,direct) {
    const subscription=subscriptionRows.find(s=>'subscription:'+s.id===cal.id);
    if(!subscription)return;
    function refresh(){
      call('ical-subscribe',{action:'refresh',id:subscription.id,force:true})
        .then(()=>loadSubscriptions()).then(()=>toast('Subscription checked'))
        .catch(error=>toast(error.message||'Could not update subscription'));
    }
    function rename(){
      const content=html('<div class="dl-subscription-rename"><div class="field"><label for="renameSubscription">Calendar name</label>'+
        '<input class="text-input" id="renameSubscription"></div>'+
        '<div style="display:flex;gap:8px;justify-content:flex-end">'+btn('Save','saveSubscriptionName','btn-primary')+'</div>'+
        '<p class="inline-note" id="renameError"></p></div>');
      content.querySelector('input').value=subscription.name;
      const dialog=modal('Rename subscription',content);
      content.querySelector('#saveSubscriptionName').onclick=async()=>{
        try{
          await call('ical-subscribe',{action:'update',id:subscription.id,name:content.querySelector('input').value});
          dialog.close();await loadSubscriptions();toast('Subscription renamed');
        }catch(error){showError(content.querySelector('#renameError'),error);}
      };
      content.querySelector('input').focus();
    }
    function colors(){
      const content=html('<div class="dl-swatches"><div class="menu-swatches" id="subscriptionSwatches"></div><div id="swatchError"></div></div>');
      const dialog=modal('Calendar color',content);
      window.daylightColorPicker(content.querySelector('#subscriptionSwatches'),subscription.color,async key=>{
        try{
          await call('ical-subscribe',{action:'update',id:subscription.id,color:key});
          dialog.close();await loadSubscriptions();renderAll(false);toast('Calendar color updated');
        }catch(error){showError(content.querySelector('#swatchError'),error);}
      });
    }
    function remove(){
      openConfirm({title:'Unsubscribe from '+subscription.name+'?',
        body:'This removes the subscribed calendar and all cached events from Daylight. The source calendar is not affected.',
        confirmLabel:'Unsubscribe',danger:true,fn:async()=>{
          try{await call('ical-subscribe',{action:'remove',id:subscription.id});
            await loadSubscriptions();toast('Calendar unsubscribed');}
          catch(error){toast(error.message||'Could not unsubscribe');}
        }});
    }
    if(direct==='rename')return rename();
    if(direct==='remove')return remove();
    openMenu(anchor,[
      {icon:'sync',label:'Refresh now',fn:refresh},
      {icon:'pencil',label:'Rename',fn:rename},
      {icon:'droplet',label:'Change color',fn:colors},
      {sep:true},{icon:'trash',label:'Unsubscribe',fn:remove}
    ],{align:'right'});
  }
  const oldCalRow=calRow;
  calRow=function(cal){
    const row=oldCalRow(cal);
    if(!cal.remoteSubscriptionId)return row;
    const sub=subscriptionRows.find(s=>s.id===cal.remoteSubscriptionId);
    if(!sub)return row;
    const visibility=html('<button class="icon-btn cal-visibility-btn" type="button" title="'+(cal.hidden?'Show':'Hide')+' subscription" aria-label="'+(cal.hidden?'Show':'Hide')+' '+esc(cal.name)+'">'+icon(cal.hidden?'eyeOff':'eye',15)+'</button>');
    const persist=()=>{
      let prefs={};try{prefs=JSON.parse(localStorage.getItem('daylight-feed-visibility:'+cloud.user.id)||'{}')}catch{}
      prefs[cal.id]=!!cal.hidden;
      try{localStorage.setItem('daylight-feed-visibility:'+cloud.user.id,JSON.stringify(prefs))}catch{}
    };
    row.querySelector('.cal-check')?.addEventListener('click',persist);
    visibility.onclick=()=>{animateCalendarToggle(cal);persist()};
    const menu=html('<button class="icon-btn cal-menu-btn" title="Subscription options" aria-label="Options for '+esc(cal.name)+'">'+icon('dotsV',16)+'</button>');
    menu.onclick=()=>manageSubscription(cal,menu);
    row.append(visibility,menu);return row;
  };
  window.daylightOpenSubscriptions=function(){openSettings('data');};

  // Refreshes only session-owned subscription caches; snapshot saves exclude read-only rows.

  // Reachable before Settings has ever been opened.
    window.daylightSubscribeDialog=function(prefill){
      const content=html('<div class="dl-subscribe-form">'+
        '<div class="field"><label for="dl-sub-name">Name (optional)</label><input class="text-input" id="dl-sub-name" placeholder="Use the calendar feed name"></div>'+
        '<div class="field"><label for="dl-sub-url">iCal URL</label><input class="text-input" id="dl-sub-url" placeholder="https://example.com/calendar.ics" autocomplete="off"></div>'+
        '<div class="field"><label>Calendar color</label><div class="dl-color-grid" id="dl-sub-colors"></div></div>'+
        '<p class="inline-note" role="status" id="dl-sub-feedback"></p>'+
        '<div style="display:flex;justify-content:flex-end">'+btn('Subscribe','dl-sub-save','btn-primary')+'</div></div>');
      const dlg=modal('Subscribe to a calendar',content);
      let color='teal';
      window.daylightColorPicker(content.querySelector('#dl-sub-colors'),color,k=>{color=k});
      const feedback=content.querySelector('#dl-sub-feedback'),button=content.querySelector('#dl-sub-save');
      if(prefill&&prefill.url){content.querySelector('#dl-sub-url').value=prefill.url;content.querySelector('#dl-sub-name').value=prefill.name||'';button.textContent='Add this calendar';}
      content.querySelector('#dl-sub-url').focus();
      button.onclick=async()=>{
        let url=content.querySelector('#dl-sub-url').value.trim();
        if(/^webcal:\/\//i.test(url))url='https://'+url.slice(9);
        let parsed;
        try{parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Invalid protocol')}
        catch{feedback.textContent='Enter a valid HTTPS or webcal URL.';feedback.style.color='var(--danger)';return}
        button.disabled=true;feedback.style.color='var(--muted)';feedback.textContent='Checking calendar feed…';
        try{
          const preview=await call('ical-subscribe',{action:'preview',url});
          const name=content.querySelector('#dl-sub-name').value.trim()||preview.name||preview.source_host||'Calendar feed';
          feedback.textContent='Subscribing…';
          await call('ical-subscribe',{action:'add',url,name,color});
          dlg.close();await loadSubscriptions();renderAll(false);toast('Calendar subscribed');
        }catch(err){showError(feedback,err)}finally{button.disabled=false}
      };
    };
  document.addEventListener('daylight:workspace-ready',function(){
    try{
      const current=new URL(window.location.href),feed=current.searchParams.get('addCalendar');
      if(!feed)return;
      const name=current.searchParams.get('calendarName')||'Calendar';
      current.searchParams.delete('addCalendar');current.searchParams.delete('calendarName');
      history.replaceState({},'',current.pathname+current.search+current.hash);
      setTimeout(()=>window.daylightSubscribeDialog({url:feed,name}),250);
    }catch(error){console.warn('Daylight calendar add link could not be opened',error);}
  });

})();
