/* Daylight calendar color picker — shared by owned calendars and subscriptions. */
(function(){
"use strict";
const colors=Array.from({length:24},(_,i)=>hsv((i*15)%360,0.82,0.94)).concat(["#737373","#A3A3A3","#D4D4D4","#FFFFFF","#111111"]);
function savedColors(){return Array.isArray(state.customColors)?state.customColors.filter(x=>/^#[0-9A-F]{6}$/i.test(x)).slice(0,30):[]}
function hsv(h,s,v){let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return "#"+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,"0")).join("").toUpperCase()}
function hsvFromHex(value){
 const raw=value.slice(1),r=parseInt(raw.slice(0,2),16)/255,g=parseInt(raw.slice(2,4),16)/255,b=parseInt(raw.slice(4,6),16)/255;
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0;
 if(d){if(max===r)h=60*(((g-b)/d)%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4)}
 if(h<0)h+=360;
 return [h,max===0?0:d/max,max];
}
function rgbHex(red,green,blue){return "#"+[red,green,blue].map(n=>Math.round(n).toString(16).padStart(2,"0")).join("").toUpperCase()}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
/* Layout CSS for the calendar chrome now lives in index.html (<style id="dl-critical-css">) so it applies at first paint. */
/* Item 1: the calendar canvas (header band + view) is never shown until it
   is fully formatted. The sidebar renders immediately; the canvas stays blank
   behind one spinner until (a) at least one second has passed, (b) the real
   workspace has rendered, (c) subscribed calendars have loaded (or failed),
   and (d) web fonts are ready. The reveal is a single fade; nothing is
   re-rendered after it. */
const canvasGate={active:false,startedAt:0,workspace:false,subscriptions:false,timer:null,removeTimer:null,token:0};
function showWorkspaceLoading(){
 clearTimeout(canvasGate.timer);clearTimeout(canvasGate.removeTimer);
 const main=document.getElementById("main");
 if(!main)return;
 let shell=document.getElementById("dlWorkspaceLoading");
 if(!canvasGate.active||!shell){
  /* A shell spinner painted by the page itself counts from when it appeared. */
  canvasGate.startedAt=shell&&Number(shell.dataset.startedAt)?Number(shell.dataset.startedAt):performance.now();
  canvasGate.workspace=false;canvasGate.subscriptions=false;
 }
 canvasGate.active=true;canvasGate.token++;
 if(!shell){
  shell=document.createElement("div");shell.id="dlWorkspaceLoading";
  shell.setAttribute("role","status");shell.setAttribute("aria-label","Loading calendar");
  shell.innerHTML='<span class="dl-loading-spinner" aria-hidden="true"></span>';
 }
 shell.dataset.startedAt=String(canvasGate.startedAt);
 shell.classList.remove("is-exiting");
 if(shell.parentNode!==main)main.appendChild(shell);
 document.body.classList.add("dl-canvas-holding");
}
function revealCanvas(){
 const shell=document.getElementById("dlWorkspaceLoading");
 canvasGate.active=false;
 document.body.classList.remove("dl-canvas-holding");
 document.dispatchEvent(new Event("daylight:canvas-revealed"));
 if(!shell)return;
 shell.classList.add("is-exiting");
 canvasGate.removeTimer=setTimeout(()=>shell.remove(),170);
}
function tryRevealCanvas(){
 if(!canvasGate.active||!canvasGate.workspace||!canvasGate.subscriptions)return;
 const token=canvasGate.token;
 /* Fonts may delay the reveal, but never for more than 1.5 s (slow or blocked font host). */
 const fonts=document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready.catch(()=>null),new Promise(resolve=>setTimeout(resolve,1500))]):Promise.resolve();
 fonts.then(()=>{
  if(token!==canvasGate.token||!canvasGate.active)return;
  const remaining=Math.max(0,1000-(performance.now()-canvasGate.startedAt));
  clearTimeout(canvasGate.timer);
  canvasGate.timer=setTimeout(()=>{
   if(token!==canvasGate.token||!canvasGate.active)return;
   /* Final layout pass happens while still hidden: chip counts and row
      fitting are recomputed, then two frames let layout settle. */
   try{if(typeof renderAll==="function"&&!document.getElementById("app").hidden)renderAll(false)}catch(error){console.warn("Final calendar render failed",error)}
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(token!==canvasGate.token||!canvasGate.active)return;
    revealCanvas();
   }));
  },remaining);
 });
}
function hideWorkspaceLoading(){
 canvasGate.workspace=true;
 /* Subscribed calendars have their own 8 s timeout; never hold longer than that + a margin. */
 const token=canvasGate.token;
 setTimeout(()=>{if(token===canvasGate.token&&canvasGate.active&&!canvasGate.subscriptions){canvasGate.subscriptions=true;tryRevealCanvas()}},4000);
 tryRevealCanvas();
}
document.addEventListener("daylight:workspace-loading",showWorkspaceLoading);
document.addEventListener("daylight:workspace-ready",hideWorkspaceLoading);
document.addEventListener("daylight:subscriptions-ready",()=>{canvasGate.subscriptions=true;tryRevealCanvas()});
document.addEventListener("daylight:workspace-signed-out",()=>{canvasGate.token++;clearTimeout(canvasGate.timer);revealCanvas()});
/* Scripts load in document order and Supabase can restore a session before this
   file has run, so "loading"/"ready" may already have fired. The page's own
   shell spinner marks a cold load in progress: adopt it and catch up on what
   was missed instead of waiting for events that will not come again. */
if(window.__dlShellSpinner&&!window.__dlFromCache&&document.getElementById("dlWorkspaceLoading")){
 showWorkspaceLoading();
 if(window.daylightCloud&&window.daylightCloud.ready)canvasGate.workspace=true;
 if(window.__dlSubscriptionsReady)canvasGate.subscriptions=true;
 tryRevealCanvas();
}
/* Item 6: "Your colors" live only in each account's own workspace
   (state.customColors → settings.customColors). The old browser-wide list
   ("daylight-custom-colors" in localStorage) was created by the owner, so it
   is migrated into the owner's account only (matched by a SHA-256 hash of the
   account email) and then deleted; no other account ever reads it. */
const LEGACY_COLOR_OWNER="a00768ca186b1bea6b4ce55c020974030c196679fe52f65ed73beb63df43bc32";
async function legacyColorOwner(email){
 try{const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(email||"").trim().toLowerCase()));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")===LEGACY_COLOR_OWNER}catch{return false}
}
document.addEventListener("daylight:workspace-ready",async function(){
 const account=window.daylightCloud?.user;
 if(!account?.id)return;
 const migrationKey="daylight-custom-colors-migrated:"+account.id;
 let hasLegacy=false;try{hasLegacy=!!localStorage.getItem("daylight-custom-colors")}catch{}
 if(!hasLegacy||!(await legacyColorOwner(account.email)))return;
 if(window.daylightCloud?.user?.id!==account.id)return;
 try{
  if(localStorage.getItem(migrationKey))return;
  const raw=localStorage.getItem("daylight-custom-colors");
  if(raw){
   let legacy=[];
   try{legacy=JSON.parse(raw)}catch(error){console.warn("Could not migrate saved custom colors",error)}
   if(Array.isArray(legacy)){
    const merged=legacy.filter(x=>typeof x==="string"&&/^#[0-9A-F]{6}$/i.test(x)).map(x=>x.toUpperCase()).concat(savedColors());
    state.customColors=Array.from(new Set(merged)).slice(0,30);
    if(window.daylightCloud?.commit&&window.settingsState?.transactionActive)window.daylightCloud.commit();
    else if(window.daylightCloud?.save)window.daylightCloud.save();
   }
   localStorage.removeItem("daylight-custom-colors");
  }
  localStorage.setItem(migrationKey,"1");
 }catch(error){console.warn("Could not migrate legacy custom colors",error)}
});
let railTooltipTimer=null,railTooltipNode=null;
function railControl(target){
 const side=target.closest("#sidebar.rail");if(!side)return null;
 const control=target.closest("button,a,[role=button],.side-row,.cal-row,.sidebar-add-rail,.profile-row");if(!control||!side.contains(control)||control.matches(".cal-menu-btn"))return null;
 let label=control.getAttribute("aria-label")||control.getAttribute("title")||control.dataset.tooltip||"";
 if(!label&&control.matches(".cal-check,.cal-row"))label=control.closest(".cal-row")?.querySelector(".cal-name")?.textContent.trim()||"Calendar visibility";
 if(!label&&control.matches(".side-row"))label=control.textContent.trim();
 if(!label&&control.matches(".sidebar-add-rail"))label="Create";
 if(!label&&control.matches(".brand-row .icon-btn"))label="Expand sidebar";
 if(!label&&control.matches(".profile-row"))label="Account";
 if(!label)label=control.textContent.trim();
 return label?{control,label}:null;
}
function hideRailTooltip(){clearTimeout(railTooltipTimer);railTooltipTimer=null;railTooltipNode?.remove();railTooltipNode=null}
function scheduleRailTooltip(target){
 const found=railControl(target);if(!found){hideRailTooltip();return}
 hideRailTooltip();
 railTooltipTimer=setTimeout(()=>{
  const r=found.control.getBoundingClientRect(),tip=document.createElement("div");
  tip.className="dl-rail-tooltip";tip.setAttribute("role","tooltip");tip.textContent=found.label;
  tip.style.left=Math.min(window.innerWidth-12,r.right+10)+"px";
  tip.style.top=Math.max(8,Math.min(window.innerHeight-36,r.top+r.height/2-14))+"px";
  document.body.appendChild(tip);railTooltipNode=tip;
 },400);
}
document.addEventListener("mouseover",e=>scheduleRailTooltip(e.target));
document.addEventListener("pointerover",e=>scheduleRailTooltip(e.target));
document.addEventListener("pointerout",e=>{if(!e.relatedTarget?.closest?.("#sidebar.rail"))hideRailTooltip()});
document.addEventListener("focusin",e=>scheduleRailTooltip(e.target));
document.addEventListener("focusout",hideRailTooltip);
function fitCalendarRows(){
 const rows=[...document.querySelectorAll(".sidebar .cal-row")];
 if(!rows.length)return;
 const height=window.innerHeight;
 const rowHeight=Math.max(20,Math.min(30,Math.floor((height-455)/rows.length)));
 document.documentElement.style.setProperty("--dl-cal-row-height",rowHeight+"px");
}
new MutationObserver(()=>requestAnimationFrame(fitCalendarRows)).observe(document.body,{childList:true,subtree:true});
window.addEventListener("resize",fitCalendarRows);
document.addEventListener("daylight:workspace-ready",fitCalendarRows);
function remember(color,options){
 color=color.toUpperCase();const saved=savedColors();if(saved.includes(color))return;
 state.customColors=[color].concat(saved).slice(0,30);
 if(options?.deferSavedColors){if(options.onSavedColorsChange)options.onSavedColorsChange();return}
 if(window.settingsState?.transactionActive){if(window.settingsState.markDirty)window.settingsState.markDirty()}else if(window.daylightCloud?.save)window.daylightCloud.save()
}
function custom(onApply,seed,options){
 let hex=/^#[0-9A-F]{6}$/i.test(seed)?seed.toUpperCase():"#FF7A00";
 let [h,s,v]=hsvFromHex(hex);
 const bd=document.createElement("div");bd.className="backdrop dl-color-modal";
 bd.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-label="Custom calendar color" style="width:min(390px,94vw)"><div class="dialog-head"><span class="dialog-title">Custom color</span><button class="icon-btn" data-cancel aria-label="Close">×</button></div><div class="dialog-body"><div class="dl-color-square" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100"><span class="dl-color-point"></span></div><label for="dl-color-hue">Spectrum</label><input class="dl-color-hue" type="range" id="dl-color-hue" min="0" max="359"><div class="field"><label for="dl-color-hex">HEX</label><div style="display:flex;gap:10px;align-items:center"><span class="dl-color-preview"></span><input class="text-input" id="dl-color-hex" maxlength="7" spellcheck="false"></div></div><div class="dl-color-rgb"><div class="field"><label for="dl-color-r">R</label><input class="text-input" type="number" id="dl-color-r" min="0" max="255" step="1"></div><div class="field"><label for="dl-color-g">G</label><input class="text-input" type="number" id="dl-color-g" min="0" max="255" step="1"></div><div class="field"><label for="dl-color-b">B</label><input class="text-input" type="number" id="dl-color-b" min="0" max="255" step="1"></div></div><div class="dl-color-error" role="alert"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" data-apply>Apply</button></div></div></div>';
 (document.getElementById("overlayRoot")||document.body).append(bd);
 const square=bd.querySelector(".dl-color-square"),point=bd.querySelector(".dl-color-point"),hue=bd.querySelector("#dl-color-hue"),input=bd.querySelector("#dl-color-hex"),err=bd.querySelector(".dl-color-error"),preview=bd.querySelector(".dl-color-preview");
 const rgbInputs=[bd.querySelector("#dl-color-r"),bd.querySelector("#dl-color-g"),bd.querySelector("#dl-color-b")];
 function draw(){hex=hsv(h,s,v);input.value=hex;err.textContent="";square.style.backgroundColor=hsv(h,1,1);point.style.left=s*100+"%";point.style.top=(1-v)*100+"%";hue.value=h;preview.style.background=hex;square.setAttribute("aria-valuenow",Math.round(s*100));rgbInputs.forEach((field,index)=>field.value=parseInt(hex.slice(1+index*2,3+index*2),16))}
 function syncHex(value){hex=value.toUpperCase();[h,s,v]=hsvFromHex(hex);draw()}
 function adjust(ev){const r=square.getBoundingClientRect();s=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));draw()}
 square.addEventListener("pointerdown",e=>{square.setPointerCapture(e.pointerId);adjust(e)});
 square.addEventListener("pointermove",e=>{if(e.buttons)adjust(e)});
 square.addEventListener("keydown",e=>{const d=e.key==="ArrowRight"||e.key==="ArrowUp"?.01:e.key==="ArrowLeft"||e.key==="ArrowDown"?-.01:0;if(!d)return;e.preventDefault();if(e.key==="ArrowUp"||e.key==="ArrowDown")v=Math.max(0,Math.min(1,v+d));else s=Math.max(0,Math.min(1,s+d));draw()});
 hue.addEventListener("input",()=>{h=Number(hue.value);draw()});
 input.addEventListener("input",()=>{const t=input.value.trim();if(!/^#[0-9A-F]{6}$/i.test(t)){err.textContent="Enter a valid #RRGGBB color";return}syncHex(t)});
 rgbInputs.forEach(field=>field.addEventListener("input",()=>{
  if(field.value==="")return;
  const rgb=rgbInputs.map(input=>Number(input.value));
  if(rgb.some(value=>!Number.isFinite(value)))return;
  const bounded=rgb.map(value=>Math.max(0,Math.min(255,Math.round(value))));
  syncHex(rgbHex(bounded[0],bounded[1],bounded[2]));
 }));
 function close(){if(window.daylightExit)window.daylightExit(bd);else bd.remove()}
 bd.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=close);
 bd.addEventListener("mousedown",e=>{if(e.target===bd)close()});
 bd.querySelector("[data-apply]").onclick=()=>{const val=input.value.trim();if(!/^#[0-9A-F]{6}$/i.test(val)){err.textContent="Enter a valid #RRGGBB color";return}if(options?.remember!==false)remember(val,options);else if(options?.onCustom)options.onCustom(val.toUpperCase());onApply(val.toUpperCase());close()};
 draw();input.focus();
}
/* Item 13: inline custom colour picker — a draggable saturation/brightness
   field plus hue spectrum, with HEX and RGB entry. All three stay in sync
   live; onChange receives each valid #RRGGBB as it changes. */
window.daylightInlineColorPicker=function(host,seed,onChange){
 let hex=/^#[0-9A-F]{6}$/i.test(seed||"")?seed.toUpperCase():"#FF7A00";
 let [h,s,v]=hsvFromHex(hex);
 host.classList.add("dl-inline-picker");
 host.innerHTML='<div class="dl-color-square" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100"><span class="dl-color-point"></span></div>'+
  '<input class="dl-color-hue" type="range" min="0" max="359" step="1" aria-label="Hue spectrum">'+
  '<div class="dl-inline-values"><span class="dl-color-preview" aria-hidden="true"></span>'+
  '<label class="dl-inline-field dl-inline-hex"><span>HEX</span><input class="text-input" data-hex maxlength="7" spellcheck="false" autocomplete="off"></label>'+
  '<label class="dl-inline-field"><span>R</span><input class="text-input" data-rgb="0" type="number" min="0" max="255" step="1" inputmode="numeric"></label>'+
  '<label class="dl-inline-field"><span>G</span><input class="text-input" data-rgb="1" type="number" min="0" max="255" step="1" inputmode="numeric"></label>'+
  '<label class="dl-inline-field"><span>B</span><input class="text-input" data-rgb="2" type="number" min="0" max="255" step="1" inputmode="numeric"></label></div>'+
  '<div class="dl-color-error" role="alert"></div>';
 const square=host.querySelector(".dl-color-square"),point=host.querySelector(".dl-color-point"),hue=host.querySelector(".dl-color-hue"),
  hexInput=host.querySelector("[data-hex]"),preview=host.querySelector(".dl-color-preview"),err=host.querySelector(".dl-color-error"),
  rgbInputs=[0,1,2].map(i=>host.querySelector('[data-rgb="'+i+'"]'));
 function paint(skip){
  hex=hsv(h,s,v);err.textContent="";
  square.style.backgroundColor=hsv(h,1,1);point.style.left=s*100+"%";point.style.top=(1-v)*100+"%";
  if(skip!=="hue")hue.value=Math.round(h);
  preview.style.background=hex;square.setAttribute("aria-valuenow",Math.round(s*100));
  if(skip!=="hex")hexInput.value=hex;
  if(skip!=="rgb")rgbInputs.forEach((field,i)=>field.value=parseInt(hex.slice(1+i*2,3+i*2),16));
 }
 function emit(){if(onChange)onChange(hex)}
 function fromHex(value,skip){hex=value.toUpperCase();[h,s,v]=hsvFromHex(hex);paint(skip);emit()}
 function adjust(ev){const r=square.getBoundingClientRect();s=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));paint();emit()}
 square.addEventListener("pointerdown",e=>{square.setPointerCapture(e.pointerId);adjust(e)});
 square.addEventListener("pointermove",e=>{if(e.buttons)adjust(e)});
 square.addEventListener("keydown",e=>{const d=e.key==="ArrowRight"||e.key==="ArrowUp"?.02:e.key==="ArrowLeft"||e.key==="ArrowDown"?-.02:0;if(!d)return;e.preventDefault();if(e.key==="ArrowUp"||e.key==="ArrowDown")v=Math.max(0,Math.min(1,v+d));else s=Math.max(0,Math.min(1,s+d));paint();emit()});
 hue.addEventListener("input",()=>{h=Number(hue.value);paint("hue");emit()});
 hexInput.addEventListener("input",()=>{let t=hexInput.value.trim();if(t&&t[0]!=="#")t="#"+t;if(!/^#[0-9A-F]{6}$/i.test(t)){err.textContent=t.length>=7?"Enter a color as #RRGGBB":"";return}fromHex(t,"hex")});
 rgbInputs.forEach(field=>field.addEventListener("input",()=>{
  if(field.value==="")return;
  const rgb=rgbInputs.map(input=>Number(input.value));
  if(rgb.some(n=>!Number.isFinite(n)||n<0||n>255)){err.textContent="RGB values run from 0 to 255";return}
  fromHex(rgbHex(rgb[0],rgb[1],rgb[2]),"rgb");
 }));
 paint();
 return {get value(){return hex},set(value){if(/^#[0-9A-F]{6}$/i.test(value||"")){hex=value.toUpperCase();[h,s,v]=hsvFromHex(hex);paint()}}};
};
window.daylightColorPicker=function(host,initial,onChange,options){
 options=options||{};
 host.textContent="";host.classList.add("dl-color-grid");
 let selected=initial;
 const saved=savedColors();
 function make(key,label,removable){
  const entry=removable?document.createElement("span"):null;
  if(entry)entry.className="dl-color-entry";
  const b=document.createElement("button");b.type="button";b.className="dl-color-item";b.style.background=window.PALETTE?.[key]?.dot||key;b.title=label||key;b.dataset.color=key;b.setAttribute("aria-label","Color "+(label||key));b.setAttribute("aria-pressed",String(key===selected));b.onclick=()=>{selected=key;onChange(key);paint()};
  if(entry){
   entry.appendChild(b);
   const remove=document.createElement("button");remove.type="button";remove.className="dl-color-remove";remove.textContent="×";remove.title="Remove saved color "+key;remove.setAttribute("aria-label","Remove saved color "+key);
   remove.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    state.customColors=savedColors().filter(color=>color!==key);
    if(options.deferSavedColors){if(options.onSavedColorsChange)options.onSavedColorsChange()}
    else if(window.settingsState?.transactionActive){if(window.settingsState.markDirty)window.settingsState.markDirty()}
    else if(window.daylightCloud?.save)window.daylightCloud.save();
    window.daylightColorPicker(host,selected,onChange,options);
   };
   entry.appendChild(remove);host.append(entry);
  }else host.append(b);
 }
 function paint(){host.querySelectorAll(".dl-color-item:not(.dl-color-plus)").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.color===selected)))}
 colors.forEach(key=>make(key));
 if(initial&&!colors.includes(initial)&&!saved.includes(initial))
   make(initial,"Current color");
 if(saved.length||options.alwaysShowSaved){const label=document.createElement("div");label.className="dl-color-label";label.textContent="Your colors";label.style.gridColumn="1/-1";host.append(label);saved.forEach(key=>make(key,null,true));if(!saved.length){const empty=document.createElement("div");empty.className="dl-color-empty";empty.style.gridColumn="1/-1";empty.textContent="Colors you save from the custom picker appear here.";host.append(empty)}}
 if(options.noCustomButton)return;
 const plus=document.createElement("button");plus.type="button";plus.className="dl-color-item dl-color-plus";plus.textContent="+";plus.title="Create custom color";plus.setAttribute("aria-label","Create custom color");plus.onclick=()=>custom(key=>{selected=key;onChange(key);window.daylightColorPicker(host,selected,onChange,options)},/^#/.test(selected)?selected:"#FF7A00",options);host.append(plus);
};
})();