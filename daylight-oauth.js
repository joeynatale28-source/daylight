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
`;document.head.append(css);
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
  pane.innerHTML='<h2 id="dl-oauth-heading"></h2><p>This app will be able to access the parts of your daylight account that you approve.</p>'+
    '<p><strong>Redirect:</strong> <span id="dl-oauth-origin"></span></p>'+
    '<label class="dl-consent-option"><input id="dl-can-read" type="checkbox" checked>Read my calendars and events</label>'+
    '<label class="dl-consent-option"><input id="dl-can-write" type="checkbox">Create and edit events</label>'+
    '<label class="dl-consent-option"><input id="dl-can-delete" type="checkbox">Delete events <span class="dl-consent-sensitive">Sensitive</span></label>'+
    '<p role="alert" id="dl-oauth-error" style="color:var(--danger)"></p>'+
    '<div class="dl-consent-actions"><button type="button" class="btn-ghost" id="dl-oauth-deny">Deny</button><button type="button" class="btn-primary" id="dl-oauth-allow">Allow</button></div>';
  pane.querySelector("#dl-oauth-heading").textContent="Would you like to allow "+name+" to access your daylight account?";
  pane.querySelector("#dl-oauth-origin").textContent=origin;
  const read=pane.querySelector("#dl-can-read"),write=pane.querySelector("#dl-can-write"),del=pane.querySelector("#dl-can-delete");
  read.checked=pref.can_read!==false;write.checked=!!pref.can_write;del.checked=!!pref.can_delete;
  read.onchange=()=>{if(!read.checked){write.checked=false;del.checked=false}};
  write.onchange=()=>{if(write.checked)read.checked=true;else del.checked=false};
  del.onchange=()=>{if(del.checked){write.checked=true;read.checked=true}};
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