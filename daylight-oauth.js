/* Daylight OAuth consent screen. Supabase Auth handles code exchange; this file only shows the consent step.
   Visuals follow the app: sun-arc mark, Inter, the app's tokens, the standard dialog, switches and buttons, both themes.
   LOGIC is unchanged from the previous consent screen (what is shown about the client and the permissions, how approve and deny work).
   The AI access pane (connected AIs, activity) lives in daylight-ai-access.js. */
(function(){
"use strict";
const OAUTH_SERVER_URL="https://usihrcucnreecynewgbd.supabase.co/functions/v1/mcp";
window.DAYLIGHT_MCP_URL=OAUTH_SERVER_URL;
const oauthRoute=/\/oauth\/consent\/?$/.test(location.pathname)||new URLSearchParams(location.search).has("oauth_consent");
const params=new URLSearchParams(location.search);
const id=params.get("authorization_id");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const css=document.createElement("style");
css.textContent=`
.dl-consent-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:var(--backdrop,rgba(0,0,0,.5));padding:20px;animation:dl-backdrop-show .16s cubic-bezier(.23,1,.32,1) both}
.dl-consent-dialog{width:min(480px,100%);max-height:calc(100dvh - 40px);overflow-y:auto;background:var(--surface);border-radius:12px;box-shadow:var(--shadow-pop);padding:28px 28px 22px;font-family:var(--font);color:var(--text);animation:dl-overlay-show .19s cubic-bezier(.23,1,.32,1) both}
.dl-consent-dialog h2{font-size:20px;line-height:1.3;font-weight:620;letter-spacing:-.015em;text-align:center;margin:0 0 6px}
.dl-consent-dialog p{font-size:13.5px;line-height:1.5;color:var(--muted);margin:0}
.dl-oauth-logos{display:flex;justify-content:center;align-items:center;gap:14px;margin:0 0 20px}
.dl-oauth-logo{height:56px;width:56px;border-radius:14px;display:grid;place-items:center;overflow:hidden;background:var(--hover);border:1px solid var(--line-soft);font-size:22px;font-weight:650}
.dl-oauth-logo img{width:100%;height:100%;object-fit:cover}
.dl-oauth-logo.is-dark{background:#17191b}.dl-oauth-logo.is-dark img{width:122%;height:122%;max-width:none;object-fit:contain}
.dl-oauth-logo.daylight img{width:32px;height:32px;object-fit:contain}
.dl-oauth-logo .daylight-mark-dark{display:none}[data-theme="dark"] .dl-oauth-logo .daylight-mark-light{display:none}[data-theme="dark"] .dl-oauth-logo .daylight-mark-dark{display:block}
.dl-oauth-swap{color:var(--faint);display:grid;place-items:center}
.dl-oauth-redirect{text-align:center;margin:0 0 20px!important;font-size:12.5px!important;color:var(--faint)!important}
.dl-oauth-account{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:var(--input-bg);margin-bottom:18px}
.dl-oauth-account>span{display:flex;flex-direction:column;min-width:0;gap:1px}
.dl-oauth-account small{font-size:11.5px;color:var(--faint)}.dl-oauth-account strong{font-size:14px;font-weight:600}.dl-oauth-account span span{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}
.dl-oauth-avatar{height:36px;width:36px;display:grid;place-items:center;flex:none;border-radius:50%;background:var(--text);color:var(--bg);overflow:hidden;font-weight:650;font-size:13px}
.dl-oauth-avatar img{height:100%;width:100%;object-fit:cover}
.dl-oauth-allow-label{font-size:11px!important;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)!important;margin:0 0 4px!important}
.dl-oauth-permissions{margin-bottom:6px}
.dl-oauth-permissions .set-row{padding:12px 0;align-items:center;border-bottom:1px solid var(--line-soft)}
.dl-oauth-permissions .set-row:last-child{border-bottom:0}
.dl-consent-sensitive{color:var(--danger);font-size:11px;font-weight:600;margin-left:6px}
.dl-oauth-summary{font-size:13px!important;margin:8px 0 14px!important}
.dl-oauth-error{color:var(--danger)!important;margin:0 0 10px!important;font-size:13px!important}
.dl-consent-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.dl-consent-actions .btn-primary{margin-left:0}
.dl-oauth-footer{text-align:center;font-size:12px!important;color:var(--faint)!important;margin:16px 0 4px!important}
.dl-oauth-switch{text-align:center;font-size:12px;color:var(--faint)}
.dl-oauth-switch-account{font:inherit;color:var(--text);text-decoration:underline;text-underline-offset:3px}
.dl-oauth-state{text-align:center;padding:6px 0 2px}.dl-oauth-state .dl-oauth-logos{margin-bottom:16px}.dl-oauth-state .btn-ghost{margin-top:18px}
@media(prefers-reduced-motion:reduce){.dl-consent-dialog,.dl-consent-backdrop{animation:none!important}}
`;
document.head.append(css);
function client(){return window.daylightCloud?.client}
function signed(){return window.daylightCloud?.user}
const markLogo='<div class="dl-oauth-logo daylight" aria-label="Daylight"><img class="daylight-mark daylight-mark-light" src="./assets/daylight-sunarc-light-NOBG.png" alt=""><img class="daylight-mark daylight-mark-dark" src="./assets/daylight-sunarc-dark-NOBG.png" alt=""></div>';
const switchRow=(inputId,label,sub,extra)=>'<div class="set-row switch-row"><span><span class="sw-label">'+label+(extra||'')+'</span><div class="sw-sub">'+sub+'</div></span>'+
  '<label class="switch"><input type="checkbox" id="'+inputId+'" aria-label="'+esc(label.replace(/<[^>]*>/g,''))+'"><span class="track"></span><span class="knob"></span></label></div>';
async function renderConsent(){
 if(!oauthRoute||document.getElementById("daylightOAuthConsent"))return;
 if(!signed())return; // The normal Daylight login remains in place. The URL is preserved.
 const bd=document.createElement("div");bd.id="daylightOAuthConsent";bd.className="dl-consent-backdrop";
 const pane=document.createElement("div");pane.className="dl-consent-dialog";pane.setAttribute("role","dialog");pane.setAttribute("aria-modal","true");pane.setAttribute("aria-label","Authorize connected application");
 bd.append(pane);document.body.append(bd);
 const state=(heading,text,kind)=>{pane.innerHTML='<div class="dl-oauth-state"><div class="dl-oauth-logos">'+markLogo+'</div><h2>'+esc(heading)+'</h2>'+(text?'<p'+(kind==="error"?' role="alert"':'')+'>'+esc(text)+'</p>':'')+(kind==="error"?'<a class="btn-ghost" href="./">Return to Daylight</a>':'')+'</div>'};
 const problem=msg=>state("Unable to authorize",msg,"error");
 if(!id){problem("The authorization request is missing its ID.");return}
 if(!client()?.auth?.oauth){problem("The installed Supabase Auth client does not support OAuth consent.");return}
 state("Checking authorization request…","");
 try{
  const result=await client().auth.oauth.getAuthorizationDetails(id);
  if(result.error)throw result.error;
  const d=result.data;
  if(!d)throw Error("Authorization request not found");
  if(!("authorization_id" in d)){if(d.redirect_url){state("Returning you to the app…","");location.assign(d.redirect_url)}else throw Error("No authorization redirect");return}
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
  /* the requesting app's logo: its own registered logo, else the real Claude / ChatGPT marks, else its initial */
  const known=/chatgpt|openai/i.test(name)?{src:"./assets/chatgpt-logo-white.svg",dark:true}:/claude|anthropic/i.test(name)?{src:"./assets/claude-logo.png",dark:false}:null;
  const clientLogo=safeImage(d.client?.logo_uri||d.client?.logo_url||d.client?.icon_uri)||(known&&known.src);
  const avatar=safeImage(profile.avatar_url||profile.picture);
  pane.innerHTML='<div class="dl-oauth-logos">'+
    '<div class="dl-oauth-logo client" id="dl-oauth-client-logo"></div>'+
    '<div class="dl-oauth-swap" aria-hidden="true">'+(typeof icon==="function"?icon("chevR",18):"⇄")+'</div>'+
    markLogo+'</div>'+
    '<h2 id="dl-oauth-heading"></h2>'+
    '<p class="dl-oauth-redirect">Requesting app: <span id="dl-oauth-origin"></span></p>'+
    '<div class="dl-oauth-account"><div class="dl-oauth-avatar" id="dl-oauth-avatar"></div>'+
    '<span><small>Signed in as</small><strong id="dl-account-name"></strong><span id="dl-account-email"></span></span></div>'+
    '<p class="dl-oauth-allow-label" id="dl-allow-label"></p>'+
    '<div class="dl-oauth-permissions">'+
      switchRow('dl-can-read','Read my calendars and events','See your calendars, events and tasks.')+
      switchRow('dl-can-write','Create and edit events','Add and change events, calendars and tasks.')+
      switchRow('dl-can-delete','Delete events','Remove events permanently.','<span class="dl-consent-sensitive">Sensitive</span>')+'</div>'+
    '<p class="dl-oauth-summary" id="dl-oauth-summary"></p>'+
    '<p role="alert" class="dl-oauth-error" id="dl-oauth-error"></p>'+
    '<div class="dl-consent-actions"><button type="button" class="btn-ghost" id="dl-oauth-deny">Cancel</button>'+
       '<button type="button" class="btn-primary" id="dl-oauth-allow">Allow access</button></div>'+
    '<p class="dl-oauth-footer" id="dl-oauth-footer"></p>'+
    '<div class="dl-oauth-switch"><span id="dl-oauth-logged"></span>'+
      '<button type="button" class="dl-oauth-switch-account" id="dl-oauth-switch">Switch accounts</button></div>';
  pane.querySelector("#dl-oauth-heading").textContent=name+' wants to access your Daylight account';
  pane.querySelector("#dl-oauth-origin").textContent=origin;
  pane.querySelector("#dl-allow-label").textContent='This will allow '+name+' to';
  pane.querySelector("#dl-account-name").textContent=profileName;
  pane.querySelector("#dl-account-email").textContent=email;
  pane.querySelector("#dl-oauth-logged").textContent='Logged in as '+email+' · ';
  pane.querySelector("#dl-oauth-footer").textContent='You can disconnect '+name+' from your Daylight account at any time.';
  const logo=pane.querySelector("#dl-oauth-client-logo");
  if(clientLogo){
    const image=document.createElement('img');image.alt=name+' logo';image.src=clientLogo;
    if(known&&known.dark)logo.classList.add("is-dark");
    image.onerror=()=>{logo.classList.remove("is-dark");logo.textContent=name.charAt(0).toUpperCase()};
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
      state(name+" is connected","Returning you to "+name+"…");
      location.assign(approved.data.redirect_url);
    }catch(e){err.textContent=e.message||"Authorization failed";allow.disabled=false;deny.disabled=false}
  };
  deny.onclick=async()=>{
    allow.disabled=true;deny.disabled=true;
    try{const denied=await db.auth.oauth.denyAuthorization(id);if(denied.error)throw denied.error;if(denied.data?.redirect_url){state("Access was not allowed","Returning you to "+name+"…");location.assign(denied.data.redirect_url)}else throw Error("Missing denial redirect")}
    catch(e){err.textContent=e.message||"Unable to deny";allow.disabled=false;deny.disabled=false}
  };
 }catch(e){problem(e.message||"Authorization could not be loaded")}
}
document.addEventListener("daylight:workspace-ready",renderConsent);
document.addEventListener("daylight:workspace-signed-out",()=>document.getElementById("daylightOAuthConsent")?.remove());
if(oauthRoute)setTimeout(renderConsent,0);
})();
