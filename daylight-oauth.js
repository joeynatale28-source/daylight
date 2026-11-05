/* Daylight OAuth consent and connected apps. Supabase Auth handles code exchange. */
(function(){
"use strict";
const OAUTH_SERVER_URL="https://qrqemjgpzoqhtmsowmqv.supabase.co/functions/v1/mcp";
const LEGACY_SERVER_URL="https://qrqemjgpzoqhtmsowmqv.supabase.co/functions/v1/daylight-mcp";
window.DAYLIGHT_MCP_URL=OAUTH_SERVER_URL;
const oauthRoute=/\/oauth\/consent\/?$/.test(location.pathname)||new URLSearchParams(location.search).has("oauth_consent");
const params=new URLSearchParams(location.search);
const id=params.get("authorization_id");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const css=document.createElement("style");
css.textContent=`
.dl-consent-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:var(--backdrop,rgba(0,0,0,.6));padding:20px}
.dl-consent-dialog{width:min(490px,100%);max-height:calc(100vh - 40px);overflow-y:auto;background:var(--surface);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow-pop);padding:27px;animation:dl-consent-in 220ms cubic-bezier(.23,1,.32,1)}
@keyframes dl-consent-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.dl-consent-dialog h2{font-size:20px;line-height:1.3;font-weight:650;margin:0 0 12px}
.dl-consent-dialog p{font-size:13px;line-height:1.5;color:var(--muted)}
.dl-consent-option{display:flex;gap:12px;align-items:center;border-top:1px solid var(--line);padding:14px 0;cursor:pointer;font-size:13px}
.dl-consent-option input{width:17px;height:17px;accent-color:var(--accent)}
.dl-consent-sensitive{color:var(--danger);font-size:11px}
.dl-consent-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}
.dl-connected-item{border-top:1px solid var(--line);padding:12px 0}
.dl-connected-item .dl-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dl-connected-item label{font-size:12px;color:var(--muted);margin-right:10px;display:inline-flex;gap:5px;align-items:center}
@media(prefers-reduced-motion:reduce){.dl-consent-dialog{animation:none!important}}
`;css.textContent+="\n.dl-consent-dialog{padding:30px!important;max-width:500px!important}\n.dl-oauth-logos{display:flex;justify-content:center;align-items:center;gap:9px;margin:3px 0 24px}\n.dl-oauth-logo{height:58px;width:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;\n overflow:hidden;border:1px solid var(--line);background:var(--surface-secondary,var(--gray-2));font-size:22px;font-weight:650}\n.dl-oauth-logo.client{background:#17191b;color:#fff}.dl-oauth-logo img{width:100%;height:100%;object-fit:contain}\n.dl-oauth-logo.daylight{width:66px;font-size:12px;letter-spacing:-.04em;background:var(--surface);color:var(--text)}\n.dl-oauth-swap{height:25px;width:25px;display:grid;place-items:center;border-radius:50%;\n background:var(--surface);border:1px solid var(--line);font-size:14px;color:var(--muted)}\n.dl-consent-dialog h2{text-align:center;margin-bottom:8px;font-size:21px}\n.dl-oauth-redirect{text-align:center;margin:0 0 20px!important;font-size:12px!important}\n.dl-oauth-account{display:flex;align-items:center;gap:12px;padding:13px;border-radius:13px;border:1px solid var(--line);margin-bottom:20px}\n.dl-oauth-account>span{display:flex;flex-direction:column;min-width:0;gap:2px}\n.dl-oauth-account strong{font-size:13px}.dl-oauth-account small,.dl-oauth-account span span{font-size:11px;color:var(--muted);overflow-wrap:anywhere}\n.dl-oauth-avatar{height:38px;width:38px;display:flex;align-items:center;justify-content:center;flex:none;\n border-radius:50%;background:var(--gray-2);color:var(--text);overflow:hidden;font-weight:600}\n.dl-oauth-avatar img{height:100%;width:100%;object-fit:cover}\n.dl-oauth-allow-label{font-weight:650;color:var(--text)!important;font-size:12.5px!important;margin:4px 0 9px!important}\n.dl-oauth-permissions{border:1px solid var(--line);border-radius:14px;overflow:hidden}\n.dl-oauth-permissions .dl-consent-option{border:0;border-bottom:1px solid var(--line);\n padding:12px 13px;display:grid;grid-template-columns:24px 1fr 18px;gap:9px}\n.dl-oauth-permissions .dl-consent-option:last-child{border-bottom:0}\n.dl-oauth-permissions .dl-consent-option input{margin:0;justify-self:end}\n.dl-oauth-permission-icon{display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:16px}\n.dl-oauth-summary{margin:12px 0!important;font-size:12px!important}\n.dl-consent-actions{gap:10px!important;margin:18px 0 18px!important;display:grid!important;grid-template-columns:1fr 1fr}\n.dl-consent-actions button{width:100%;height:42px!important;margin:0!important;justify-content:center}\n.dl-oauth-footer{text-align:center;font-size:11px!important;margin:15px 0 8px!important}\n.dl-oauth-switch{text-align:center;font-size:11px;color:var(--muted)}\n.dl-oauth-switch-account{font:inherit;color:var(--text);text-decoration:underline;text-underline-offset:3px}\n.dl-oauth-switch-account:hover{opacity:.7}\n";
css.textContent+="\n.dl-chatgpt-featured{display:flex;align-items:center;justify-content:space-between;gap:12px;\n flex-wrap:wrap;padding:17px;border:1px solid var(--line);border-radius:16px;\n background:var(--surface);margin-bottom:18px}\n.dl-chatgpt-identity{display:flex;align-items:center;gap:13px;min-width:170px;flex:1}\n.dl-chatgpt-logo{object-fit:contain;flex:none;border-radius:12px;border:1px solid var(--line);background:#fff}\n.dl-chatgpt-copy{display:flex;flex-direction:column;gap:3px}\n.dl-chatgpt-copy strong{font-size:14px;font-weight:650}\n.dl-chatgpt-copy small{font-size:12px;color:var(--muted);line-height:1.4}\n.dl-chatgpt-status{display:flex;align-items:center;gap:10px}\n.dl-chatgpt-status .btn-primary{margin:0}\n.dl-connected-label{display:inline-flex;align-items:center;gap:5px;color:#238b59;font-size:13px;font-weight:650}\n.dl-ai-advanced{padding:12px 16px;border:1px solid var(--line);border-radius:14px}\n.dl-ai-advanced>summary{cursor:pointer;font-size:13px;font-weight:650}\n.dl-ai-advanced-body{margin-top:14px}\n.dl-ai-advanced-body .set-group{border:0;border-top:1px solid var(--line);border-radius:0;padding:16px 0}\n";
document.head.append(css);
function client(){return window.daylightCloud?.client}
function signed(){return window.daylightCloud?.user}
async function renderConsent(){
 if(!oauthRoute||document.getElementById("daylightOAuthConsent"))return;
 if(!signed())return; // The normal Daylight login remains in place. The URL is preserved.
 const bd=document.createElement("div");bd.id="daylightOAuthConsent";bd.className="dl-consent-backdrop";
 const pane=document.createElement("div");pane.className="dl-consent-dialog";pane.setAttribute("role","dialog");pane.setAttribute("aria-modal","true");pane.setAttribute("aria-label","Authorize connected application");
 bd.append(pane);document.body.append(bd);
 const problem=msg=>{pane.innerHTML='<h2>Unable to authorize</h2><p role="alert">'+esc(msg)+'</p><a class="btn-ghost" href="/daylight/">Return to daylight</a>'};
 if(!id){problem("The authorization request is missing its ID.");return}
 if(!client()?.auth?.oauth){problem("The installed Supabase Auth client does not support OAuth consent.");return}
 pane.innerHTML='<h2>Checking authorization request…</h2>';
 try{
  const result=await client().auth.oauth.getAuthorizationDetails(id);
  if(result.error)throw result.error;
  const d=result.data;
  if(!d)throw Error("Authorization request not found");
  if(!("authorization_id" in d)){if(d.redirect_url)location.assign(d.redirect_url);else throw Error("No authorization redirect");return}
  const cid=String(d.client?.id||d.client?.client_id||"");
  if(!cid)throw Error("The requesting client could not be identified");
  const name=String(d.client?.name||"Unknown application");
  const origin=(()=>{try{return new URL(d.redirect_uri).host}catch{return "Unspecified redirect"}})();
  const db=client();
  const found=await db.from("mcp_grants").select("can_read,can_write,can_delete").eq("user_id",signed().id).eq("client_id",cid).is("revoked_at",null).maybeSingle();
  if(found.error)throw found.error;
  const pref=found.data||{};
  const account=signed(),email=account.email||'',profile=account.user_metadata||{};
  const profileName=String(profile.full_name||profile.name||email.split('@')[0]||'Your account');
  const safeImage=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null}catch{return null}};
  const clientLogo=safeImage(d.client?.logo_uri||d.client?.logo_url||d.client?.icon_uri);
  const avatar=safeImage(profile.avatar_url||profile.picture);
  pane.innerHTML='<div class="dl-oauth-logos">'+
    '<div class="dl-oauth-logo client" id="dl-oauth-client-logo"></div>'+
    '<div class="dl-oauth-swap" aria-hidden="true">⇄</div>'+
    '<div class="dl-oauth-logo daylight" aria-label="daylight">daylight.</div></div>'+
    '<h2 id="dl-oauth-heading"></h2>'+
    '<p class="dl-oauth-redirect">Requesting app: <span id="dl-oauth-origin"></span></p>'+
    '<div class="dl-oauth-account"><div class="dl-oauth-avatar" id="dl-oauth-avatar"></div>'+
    '<span><small>Signed in as</small><strong id="dl-account-name"></strong><span id="dl-account-email"></span></span></div>'+
    '<p class="dl-oauth-allow-label" id="dl-allow-label"></p>'+
    '<div class="dl-oauth-permissions">'+
      '<label class="dl-consent-option"><span class="dl-oauth-permission-icon" aria-hidden="true">◉</span>'+
        '<span>Read my calendars and events</span><input id="dl-can-read" type="checkbox" checked aria-label="Read my calendars and events"></label>'+
      '<label class="dl-consent-option"><span class="dl-oauth-permission-icon" aria-hidden="true">✎</span>'+
        '<span>Create and edit events</span><input id="dl-can-write" type="checkbox" aria-label="Create and edit events"></label>'+
      '<label class="dl-consent-option"><span class="dl-oauth-permission-icon" aria-hidden="true">×</span>'+
        '<span>Delete events <small class="dl-consent-sensitive">Sensitive</small></span>'+
        '<input id="dl-can-delete" type="checkbox" aria-label="Delete events"></label></div>'+
    '<p class="dl-oauth-summary" id="dl-oauth-summary"></p>'+
    '<p role="alert" id="dl-oauth-error" style="color:var(--danger)"></p>'+
    '<div class="dl-consent-actions"><button type="button" class="btn-ghost" id="dl-oauth-deny">Cancel</button>'+
       '<button type="button" class="btn-primary" id="dl-oauth-allow">Allow Access</button></div>'+
    '<p class="dl-oauth-footer" id="dl-oauth-footer"></p>'+
    '<div class="dl-oauth-switch"><span id="dl-oauth-logged"></span>'+
      '<button type="button" class="dl-oauth-switch-account" id="dl-oauth-switch">Switch accounts</button></div>';
  pane.querySelector("#dl-oauth-heading").textContent=name+' wants to access your Daylight account';
  pane.querySelector("#dl-oauth-origin").textContent=origin;
  pane.querySelector("#dl-allow-label").textContent='This will allow '+name+' to:';
  pane.querySelector("#dl-account-name").textContent=profileName;
  pane.querySelector("#dl-account-email").textContent=email;
  pane.querySelector("#dl-oauth-logged").textContent='Logged in as '+email+' · ';
  pane.querySelector("#dl-oauth-footer").textContent='You can disconnect '+name+' from your Daylight account at any time.';
  const logo=pane.querySelector("#dl-oauth-client-logo");
  if(clientLogo){
    const image=document.createElement('img');image.alt=name+' logo';image.src=clientLogo;
    image.onerror=()=>{logo.textContent=name.charAt(0).toUpperCase()};
    logo.append(image);
  }else logo.textContent=name.charAt(0).toUpperCase();
  const avatarNode=pane.querySelector("#dl-oauth-avatar");
  if(avatar){
    const image=document.createElement('img');image.alt='';image.src=avatar;
    image.onerror=()=>{avatarNode.textContent=profileName.charAt(0).toUpperCase()};
    avatarNode.append(image);
  }else avatarNode.textContent=profileName.charAt(0).toUpperCase();
  pane.querySelector("#dl-oauth-switch").onclick=async()=>{
    try{
      await client().auth.signOut();
      location.assign('/daylight/?oauth_consent=1&authorization_id='+encodeURIComponent(id));
    }catch(error){pane.querySelector('#dl-oauth-error').textContent=error.message||'Could not sign out'}
  };
  const read=pane.querySelector("#dl-can-read"),write=pane.querySelector("#dl-can-write"),del=pane.querySelector("#dl-can-delete");
  read.checked=pref.can_read!==false;write.checked=!!pref.can_write;del.checked=!!pref.can_delete;
  function syncSummary(){
    const allowed=[read.checked?'read your calendars and events':null,
      write.checked?'create and edit calendar information':null,
      del.checked?'permanently delete events':null].filter(Boolean);
    pane.querySelector('#dl-oauth-summary').textContent=allowed.length?
      'If you allow access, '+name+' can '+allowed.join(', and ')+'.':
      'No access is selected. Enable Read to allow this connection to use Daylight.';
    pane.querySelector("#dl-oauth-allow").disabled=!read.checked;
  }
  read.onchange=()=>{if(!read.checked){write.checked=false;del.checked=false}syncSummary()};
  write.onchange=()=>{if(write.checked)read.checked=true;else del.checked=false;syncSummary()};
  del.onchange=()=>{if(del.checked){write.checked=true;read.checked=true}syncSummary()};
  syncSummary();
    const err=pane.querySelector("#dl-oauth-error"),allow=pane.querySelector("#dl-oauth-allow"),deny=pane.querySelector("#dl-oauth-deny");
  allow.onclick=async()=>{
    allow.disabled=true;deny.disabled=true;err.textContent="";
    try{
      const {error}=await db.from("mcp_grants").upsert({user_id:signed().id,client_id:cid,client_name:name,can_read:read.checked,can_write:write.checked,can_delete:del.checked,revoked_at:null,granted_at:new Date().toISOString()},{onConflict:"user_id,client_id"});
      if(error)throw error;
      const approved=await db.auth.oauth.approveAuthorization(id);
      if(approved.error)throw approved.error;
      if(!approved.data?.redirect_url)throw Error("Approval did not return a client redirect");
      location.assign(approved.data.redirect_url);
    }catch(e){err.textContent=e.message||"Authorization failed";allow.disabled=false;deny.disabled=false}
  };
  deny.onclick=async()=>{
    allow.disabled=true;deny.disabled=true;
    try{const denied=await db.auth.oauth.denyAuthorization(id);if(denied.error)throw denied.error;if(denied.data?.redirect_url)location.assign(denied.data.redirect_url);else throw Error("Missing denial redirect")}
    catch(e){err.textContent=e.message||"Unable to deny";allow.disabled=false;deny.disabled=false}
  };
 }catch(e){problem(e.message||"Authorization could not be loaded")}
}
document.addEventListener("daylight:workspace-ready",renderConsent);
document.addEventListener("daylight:workspace-signed-out",()=>document.getElementById("daylightOAuthConsent")?.remove());
if(oauthRoute)setTimeout(renderConsent,0);
const original=window.daylightAiPane;
if(typeof original!=="function")return;
window.daylightAiPane=function(pane){
 original(pane);
 const wrapper=pane.querySelector(".dl-ai-wrap");
 if(!wrapper)return;
 const oldTitle=wrapper.querySelector(".set-group-title");
 if(oldTitle)oldTitle.textContent="Local developer tokens";
 const create=wrapper.querySelector("#mcpCreate");
 if(create){
   const note=document.createElement("p");note.className="pane-sub";
   note.textContent="For development clients that accept a static Authorization header. OAuth connections use per-app permissions.";
   create.parentElement.insertBefore(note,create);
   const legacy=document.createElement("p");legacy.className="pane-sub";
   legacy.textContent="Legacy developer-token endpoint: "+LEGACY_SERVER_URL;
   create.parentElement.insertBefore(legacy,create);
 }
 const legacyDelete=wrapper.querySelector("#mcpDelete")?.closest(".set-group");
 if(legacyDelete){
   const heading=legacyDelete.querySelector(".set-group-title");
   if(heading)heading.textContent="Legacy token deletion safety";
   const label=legacyDelete.querySelector(".sw-label");
   if(label)label.textContent="Allow delete for legacy developer tokens";
   const help=legacyDelete.querySelector(".sw-sub");
   if(help)help.textContent="OAuth clients use their own per-app Delete permission instead.";
 }
 const urlInput=wrapper.querySelector("#mcpUrl"),configBox=wrapper.querySelector("#mcpConfig");
 const config=JSON.stringify({mcpServers:{daylight:{type:"http",url:OAUTH_SERVER_URL}}},null,2);
 if(urlInput)urlInput.value=OAUTH_SERVER_URL;
 if(configBox)configBox.textContent=config;
 const copyConfig=wrapper.querySelector("#mcpCopy");
 if(copyConfig)copyConfig.onclick=()=>navigator.clipboard.writeText(config).then(()=>toast("Copied OAuth configuration")).catch(()=>toast("Unable to copy configuration"));
 const copyUrl=wrapper.querySelector("#mcpCopyUrl");
 if(copyUrl)copyUrl.onclick=()=>navigator.clipboard.writeText(OAUTH_SERVER_URL).then(()=>toast("Copied MCP URL")).catch(()=>toast("Unable to copy URL"));
 const primary=document.createElement("div");primary.className="set-group";
 primary.innerHTML='<div class="set-group-title">Connected apps</div><p class="pane-sub">Connect ChatGPT or Claude using OAuth. Permissions are approved per application; disconnecting revokes consent.</p>'+
  '<p class="pane-sub">Claude: add a custom connector with the server URL and leave OAuth Client ID and Secret blank. ChatGPT: use Authentication = OAuth.</p>'+
  '<div id="dl-oauth-connected" role="status">Loading connections…</div>';
 wrapper.insertBefore(primary,wrapper.firstChild);
 const advanced=document.createElement("details");
 advanced.className="set-group dl-ai-advanced";
 advanced.innerHTML='<summary>Advanced connection options</summary>'+
   '<p class="pane-sub">Claude: Add a custom MCP connector, paste the server URL and leave OAuth Client ID/Secret blank. ChatGPT: use Connect above.</p>';
 const advancedBody=document.createElement("div");
 advancedBody.className="dl-ai-advanced-body";
 advanced.append(advancedBody);
 // Keep existing developer-token tooling in Advanced, never as the featured path.
 [...wrapper.children].filter(node=>node!==primary&&node!==featured&&node!==advanced).forEach(node=>{
   const title=node.querySelector('.set-group-title')?.textContent||'';
   if(!/Recent AI activity/i.test(title))advancedBody.append(node);
 });
 wrapper.append(advanced);

 const featured=document.createElement("div");
 featured.className="set-group dl-chatgpt-featured";
 featured.innerHTML='<div class="dl-chatgpt-identity">'+
   '<img src="https://chatgpt.com/favicon.ico" width="42" height="42" alt="ChatGPT logo" class="dl-chatgpt-logo">'+
   '<span class="dl-chatgpt-copy"><strong>ChatGPT Plugin</strong>'+
     '<small>Control your Daylight calendar with ChatGPT.</small></span></div>'+
   '<div class="dl-chatgpt-status" role="status" id="dl-chatgpt-status">'+
     '<button class="btn-primary" type="button" id="dl-chatgpt-connect">Connect</button></div>';
 const chatgptConnect=()=>window.open('https://chatgpt.com/plugins/plugin_asdk_app_6aebc26aea6c8191b72592d9eb7e51be','_blank','noopener,noreferrer');
 featured.querySelector('#dl-chatgpt-connect').onclick=chatgptConnect;
 wrapper.insertBefore(featured,wrapper.firstChild);

 const area=primary.querySelector("#dl-oauth-connected"),db=client(),uid=signed()?.id;
 if(!db||!uid)return;
 async function list(){
  area.textContent="";
  if(!db.auth.oauth?.listGrants){area.textContent="OAuth connections are unavailable until Supabase OAuth Server is configured.";return}
  try{
   const [auth,grants]=await Promise.all([db.auth.oauth.listGrants(),db.from("mcp_grants").select("*").eq("user_id",uid).is("revoked_at",null)]);
   if(auth.error)throw auth.error;
   if(grants.error)throw grants.error;
   const oauthEntries=Array.isArray(auth.data)?auth.data:(auth.data?.grants||[]);
   const known=new Set(oauthEntries.map(a=>a.client_id||a.client?.id));
   const entries=(grants.data||[]).filter(g=>known.has(g.client_id));
   // Only a validated Supabase OAuth grant AND its daylight permission row
   // establish a connected state; there is no cached or optimistic badge.
   const chatgptGrant=entries.find(g=>/chatgpt/i.test(g.client_name||'')||
     oauthEntries.some(a=>(a.client_id||a.client?.id)===g.client_id&&
       /chatgpt/i.test(a.client?.name||a.client_name||'')));
   const chatState=featured.querySelector('#dl-chatgpt-status');
   if(chatgptGrant){
     chatState.innerHTML='<span class="dl-connected-label" aria-label="Connected">✓ Connected</span>'+
       '<button class="btn-ghost" type="button" id="dl-chatgpt-disconnect">Disconnect</button>';
     chatState.querySelector('#dl-chatgpt-disconnect').onclick=()=>openConfirm({
       title:'Disconnect ChatGPT?',body:'ChatGPT will immediately lose calendar access.',
       confirmLabel:'Disconnect',danger:true,fn:async()=>{
         const rev=await db.auth.oauth.revokeGrant({clientId:chatgptGrant.client_id});
         if(rev.error)throw rev.error;
         const {error}=await db.from('mcp_grants').update({revoked_at:new Date().toISOString()})
           .eq('user_id',uid).eq('client_id',chatgptGrant.client_id);
         if(error)throw error;
         await list();
       }
     });
   }else{
     chatState.innerHTML='<button class="btn-primary" type="button" id="dl-chatgpt-connect">Connect</button>';
     chatState.querySelector('#dl-chatgpt-connect').onclick=chatgptConnect;
   }
   if(!entries.length){area.textContent="No connected apps yet.";return}
   entries.forEach(g=>{
    const item=document.createElement("div");item.className="dl-connected-item";
    item.innerHTML='<div class="dl-row"><strong></strong><button class="btn-danger-outline" type="button">Disconnect</button></div>'+
    '<div style="color:var(--muted);font-size:11px;margin:5px 0"></div>'+
    '<div><label><input type="checkbox" data-perm="can_read">Read</label><label><input type="checkbox" data-perm="can_write">Write</label><label><input type="checkbox" data-perm="can_delete">Delete</label></div><p role="status" class="inline-note"></p>';
    item.querySelector("strong").textContent=g.client_name||g.client_id;
    item.querySelector(".dl-row+div").textContent="Connected "+new Date(g.granted_at).toLocaleDateString();
    const boxes=[...item.querySelectorAll("[data-perm]")];
    boxes.forEach(b=>{b.checked=!!g[b.dataset.perm]});
    let saving=false;
    boxes.forEach(b=>b.onchange=async()=>{
      if(saving)return;saving=true;
      let read=boxes[0].checked,write=boxes[1].checked,del=boxes[2].checked;
      if(b.dataset.perm==="can_delete"&&del){read=true;write=true}
      if(b.dataset.perm==="can_write"&&!write)del=false;
      if(!read){write=false;del=false}
      boxes[0].checked=read;boxes[1].checked=write;boxes[2].checked=del;
      const {error}=await db.from("mcp_grants").update({can_read:read,can_write:write,can_delete:del}).eq("user_id",uid).eq("client_id",g.client_id);
      item.querySelector("[role=status]").textContent=error?(error.message||"Could not update permissions"):"Permissions updated";
      saving=false;
    });
    item.querySelector("button").onclick=()=>openConfirm({title:"Disconnect "+(g.client_name||"app")+"?",body:"This application will immediately lose access to daylight.",confirmLabel:"Disconnect",danger:true,fn:async()=>{
      const rev=await db.auth.oauth.revokeGrant({clientId:g.client_id});if(rev.error)throw rev.error;
      const {error}=await db.from("mcp_grants").update({revoked_at:new Date().toISOString()}).eq("user_id",uid).eq("client_id",g.client_id);
      if(error)throw error;await list();
    }});
    area.append(item);
   });
  }catch(e){area.textContent="OAuth connections unavailable: "+(e.message||"Check OAuth Server settings")}
 }
 list();
};
})();