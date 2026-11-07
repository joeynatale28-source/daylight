/* Daylight calendar color picker — shared by owned calendars and subscriptions. */
(function(){
"use strict";
const colors=Array.from({length:24},(_,i)=>hsv((i*15)%360,0.82,0.94)).concat(["#737373","#A3A3A3","#D4D4D4","#FFFFFF","#111111"]);
const STORE="daylight-custom-colors";
let saved=[];
try{saved=JSON.parse(localStorage.getItem(STORE)||"[]").filter(x=>/^#[0-9A-F]{6}$/i.test(x)).slice(0,30)}catch{}
function hsv(h,s,v){let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return "#"+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,"0")).join("").toUpperCase()}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const style=document.createElement("style");
style.textContent=`
.cal-row{align-items:center;min-height:28px;height:30px;gap:7px}
.cal-row .cal-name{flex:1 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25}
.cal-row .cal-menu-btn{flex:0 0 28px}
.cal-row .cal-check{flex:0 0 auto}
.dl-color-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin:8px 0}
.dl-color-grid .dl-color-item{height:25px;min-width:0;width:100%;border-radius:9px;position:relative;border:2px solid transparent;outline-offset:2px;cursor:pointer}
.dl-color-grid .dl-color-item[aria-pressed=true]{outline:2px solid var(--text)}
.dl-color-grid .dl-color-item:focus-visible{outline:2px solid var(--accent)}
.dl-color-plus{border:1px solid var(--line)!important;background:var(--surface);color:var(--text);font-size:19px;font-weight:500}
.dl-color-label{font-size:11px;color:var(--muted);margin:9px 0 2px;font-weight:600}
.dl-color-square{height:172px;border-radius:12px;position:relative;cursor:crosshair;touch-action:none;background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent);border:1px solid var(--line)}
.dl-color-point{position:absolute;height:14px;width:14px;border:2px solid #fff;box-shadow:0 0 0 1px #333;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.dl-color-hue{display:block;width:100%;margin:15px 0;accent-color:var(--accent)}
.dl-color-preview{height:28px;width:28px;flex:none;border-radius:8px;border:1px solid var(--line)}
.dl-color-error{font-size:12px;color:var(--danger);min-height:16px}
.dl-color-modal .dialog-body{display:grid;gap:10px}
.dl-color-modal .dialog-body .field{margin:0}
.month-wrap{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.month-grid{flex:1 1 auto;min-height:0;height:auto;overflow-y:auto;overscroll-behavior:contain;grid-template-rows:repeat(6,minmax(105px,1fr))}
.month-week{min-height:105px;height:auto;overflow:visible}
.day-cell{min-height:0;overflow:hidden}
.cell-events{min-height:0;overflow:hidden}
.agenda-cal-name{font-weight:600;color:var(--muted)}
@media(max-height:750px){.dow-cell{padding-top:5px;padding-bottom:5px}.day-cell{padding-top:2px;padding-bottom:1px}.day-num{height:22px;min-height:22px}}
@media(prefers-reduced-motion:reduce){.dl-color-modal,.dl-color-modal *{animation:none!important;transition:none!important}}
`;
style.textContent += `
/* Daylight sidebar: stable single-line labels and compact adaptive rows. */
.cal-row .cal-name,.cal-row .fr-url{white-space:nowrap!important;text-overflow:ellipsis!important;overflow:hidden!important;min-width:0!important}
.cal-row{height:var(--dl-cal-row-height,30px)!important;min-height:0!important;flex-shrink:1!important}
.sidebar .cal-list,.sidebar .calendars-list{min-height:0}
.sidebar .cal-check{flex-shrink:0}
.sidebar.collapsed .cal-check,.sidebar.rail .cal-check,
.sidebar.collapsed .cal-visibility-btn,.sidebar.rail .cal-visibility-btn{display:none!important}
.dl-rail-tooltip{position:fixed;z-index:99999;pointer-events:none;padding:7px 10px;border-radius:7px;background:var(--surface2);color:var(--text);border:1px solid var(--line);box-shadow:var(--shadow-pop);font-size:12px;font-weight:500;white-space:nowrap;animation:dlTipIn 120ms var(--ease-out)}
@keyframes dlTipIn{from{opacity:0;transform:translateX(-3px)}to{opacity:1;transform:translateX(0)}}
#dlWorkspaceSkeleton{display:none;position:fixed;inset:0;z-index:99990;background:var(--bg);color:var(--text);grid-template-columns:64px minmax(0,1fr);gap:0;pointer-events:none}
.workspace-loading-visible #dlWorkspaceSkeleton{display:grid}
.dl-sk-side{background:var(--bg-sidebar);border-right:1px solid var(--sidebar-line);padding:18px 12px;display:flex;flex-direction:column;gap:22px;align-items:center}
.dl-sk-side i,.dl-sk-grid i{background:linear-gradient(90deg,var(--surface) 20%,var(--hover) 50%,var(--surface) 80%);background-size:200% 100%;animation:dlShimmer 1.2s linear infinite}
.dl-sk-side i{width:30px;height:30px;border-radius:9px}
.dl-sk-main{min-width:0;padding:22px 28px;display:flex;flex-direction:column;gap:16px}
.dl-sk-head{height:38px;width:46%;border-radius:9px;background:var(--surface)}
.dl-sk-week{height:28px;border-radius:7px;background:var(--surface)}
.dl-sk-grid{flex:1;min-height:0;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(6,1fr);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.dl-sk-grid i{border-right:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
@keyframes dlShimmer{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.dl-sk-grid i,.dl-sk-side i{animation:none}}
`;

document.head.append(style);
let workspaceLoadingTimer=null;
function ensureWorkspaceSkeleton(){
 if(document.getElementById("dlWorkspaceSkeleton"))return;
 const shell=document.createElement("div");shell.id="dlWorkspaceSkeleton";shell.setAttribute("aria-label","Loading calendar workspace");
 shell.innerHTML='<div class="dl-sk-side"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="dl-sk-main"><i class="dl-sk-head"></i><div class="dl-sk-week"></div><div class="dl-sk-grid">'+Array.from({length:42},()=>'<i></i>').join("")+'</div></div>';
 document.body.appendChild(shell);
}
function showWorkspaceLoading(){
 clearTimeout(workspaceLoadingTimer);
 workspaceLoadingTimer=setTimeout(()=>{document.body.classList.add("workspace-loading-visible");ensureWorkspaceSkeleton()},200);
}
function hideWorkspaceLoading(){
 clearTimeout(workspaceLoadingTimer);workspaceLoadingTimer=null;
 document.body.classList.remove("workspace-loading-visible");
 document.getElementById("dlWorkspaceSkeleton")?.remove();
}
if(document.body.classList.contains("booting"))showWorkspaceLoading();
document.addEventListener("daylight:workspace-loading",showWorkspaceLoading);
document.addEventListener("daylight:workspace-ready",hideWorkspaceLoading);
document.addEventListener("daylight:workspace-loading-failed",hideWorkspaceLoading);
document.addEventListener("daylight:workspace-signed-out",hideWorkspaceLoading);
let railTooltipTimer=null,railTooltipNode=null;
function railControl(target){
 const side=target.closest("#sidebar.rail");if(!side)return null;
 const control=target.closest("button,a,[role=button]");if(!control||!side.contains(control)||control.matches(".cal-menu-btn"))return null;
 let label=control.getAttribute("aria-label")||control.getAttribute("title")||control.dataset.tooltip||"";
 if(!label&&control.matches(".cal-check"))label=control.closest(".cal-row")?.querySelector(".cal-name")?.textContent.trim()||"Calendar visibility";
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
function remember(color){color=color.toUpperCase();if(!saved.includes(color)){saved.unshift(color);saved=saved.slice(0,30);try{localStorage.setItem(STORE,JSON.stringify(saved))}catch{}}}
function custom(onApply,seed){
 let h=28,s=.75,v=1,hex=/^#[0-9A-F]{6}$/i.test(seed)?seed.toUpperCase():"#FF7A00";
 const bd=document.createElement("div");bd.className="backdrop dl-color-modal";
 bd.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-label="Custom calendar color" style="width:min(390px,94vw)"><div class="dialog-head"><span class="dialog-title">Custom color</span><button class="icon-btn" data-cancel aria-label="Close">×</button></div><div class="dialog-body"><label for="dl-color-hex">Choose a color</label><div class="dl-color-square" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="75"><span class="dl-color-point"></span></div><label for="dl-color-hue">Hue</label><input class="dl-color-hue" type="range" id="dl-color-hue" min="0" max="359" value="28"><div class="field"><label for="dl-color-hex">Hex color</label><div style="display:flex;gap:10px;align-items:center"><span class="dl-color-preview"></span><input class="text-input" id="dl-color-hex" maxlength="7" spellcheck="false" value="'+esc(hex)+'"></div></div><div class="dl-color-error" role="alert"></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" data-apply>Apply</button></div></div></div>';
 (document.getElementById("overlayRoot")||document.body).append(bd);
 const square=bd.querySelector(".dl-color-square"),point=bd.querySelector(".dl-color-point"),hue=bd.querySelector("#dl-color-hue"),input=bd.querySelector("#dl-color-hex"),err=bd.querySelector(".dl-color-error"),preview=bd.querySelector(".dl-color-preview");
 function draw(){hex=hsv(h,s,v);input.value=hex;err.textContent="";square.style.backgroundColor=hsv(h,1,1);point.style.left=s*100+"%";point.style.top=(1-v)*100+"%";hue.value=h;preview.style.background=hex;square.setAttribute("aria-valuenow",Math.round(s*100))}
 function adjust(ev){const r=square.getBoundingClientRect();s=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));draw()}
 square.addEventListener("pointerdown",e=>{square.setPointerCapture(e.pointerId);adjust(e)});
 square.addEventListener("pointermove",e=>{if(e.buttons)adjust(e)});
 square.addEventListener("keydown",e=>{const d=e.key==="ArrowRight"||e.key==="ArrowUp"?.01:e.key==="ArrowLeft"||e.key==="ArrowDown"?-.01:0;if(!d)return;e.preventDefault();if(e.key==="ArrowUp"||e.key==="ArrowDown")v=Math.max(0,Math.min(1,v+d));else s=Math.max(0,Math.min(1,s+d));draw()});
 hue.addEventListener("input",()=>{h=Number(hue.value);draw()});
 input.addEventListener("input",()=>{const t=input.value.trim();if(!/^#[0-9A-F]{6}$/i.test(t)){err.textContent="Enter a valid #RRGGBB color";return}hex=t.toUpperCase();err.textContent="";preview.style.background=hex});
 function close(){if(window.daylightExit)window.daylightExit(bd);else bd.remove()}
 bd.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=close);
 bd.addEventListener("mousedown",e=>{if(e.target===bd)close()});
 bd.querySelector("[data-apply]").onclick=()=>{const val=input.value.trim();if(!/^#[0-9A-F]{6}$/i.test(val)){err.textContent="Enter a valid #RRGGBB color";return}remember(val);onApply(val.toUpperCase());close()};
 draw();input.focus();
}
window.daylightColorPicker=function(host,initial,onChange){
 host.textContent="";host.classList.add("dl-color-grid");
 let selected=initial;
 function make(key,label){const b=document.createElement("button");b.type="button";b.className="dl-color-item";b.style.background=window.PALETTE?.[key]?.dot||key;b.title=label||key;b.setAttribute("aria-label","Color "+(label||key));b.setAttribute("aria-pressed",String(key===selected));b.onclick=()=>{selected=key;onChange(key);paint()};host.append(b)}
 function paint(){host.querySelectorAll(".dl-color-item:not(.dl-color-plus)").forEach(b=>b.setAttribute("aria-pressed",String(b.title===selected)))}
 colors.forEach(key=>make(key));
 if(initial&&!colors.includes(initial)&&!saved.includes(initial))
   make(initial,"Current color");
 if(saved.length){const label=document.createElement("div");label.className="dl-color-label";label.textContent="Your colors";label.style.gridColumn="1/-1";host.append(label);saved.forEach(key=>make(key))}
 const plus=document.createElement("button");plus.type="button";plus.className="dl-color-item dl-color-plus";plus.textContent="+";plus.title="Create custom color";plus.setAttribute("aria-label","Create custom color");plus.onclick=()=>custom(key=>{selected=key;onChange(key);window.daylightColorPicker(host,selected,onChange)},/^#/.test(selected)?selected:"#FF7A00");host.append(plus);
};
})();