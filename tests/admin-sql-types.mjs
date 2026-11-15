/**
 * Guard for the Admin "Manage" lists (it regressed once already): on real Supabase auth.users.email is varchar, so every
 * array_agg over it that is returned as text[] MUST be cast with ::text, or the function errors and the list comes back empty.
 * Scans every SQL file in the repo; the latest definition of each owner list function must carry the cast.
 */
import fs from 'node:fs';
let failed=false;
const check=(n,ok,d)=>{if(!ok)failed=true;console.log((ok?'PASS ':'FAIL ')+n+(ok||!d?'':'  -> '+d))};
const files=fs.readdirSync('supabase/sql').filter(f=>f.endsWith('.sql')).sort();
const bad=[];
for(const f of files){
 const text=fs.readFileSync('supabase/sql/'+f,'utf8').split(String.fromCharCode(10)).filter(l=>!/^\s*--/.test(l)).join(String.fromCharCode(10));
 for(const m of text.matchAll(/array_agg\(\s*u\.email(?!\s*::text)[^)]*\)/g))bad.push(f+': '+m[0].slice(0,60));
}
// the 20261125 original is superseded by 20261127; every file after it must be clean
const after=bad.filter(b=>!/^20261125_/.test(b));
check('no file after the original dashboard SQL aggregates u.email without ::text',after.length===0,after.join(' | '));
const last=files.filter(f=>/array_agg\(u\.email::text/.test(fs.readFileSync('supabase/sql/'+f,'utf8'))&&/daylight_admin_list_banners/.test(fs.readFileSync('supabase/sql/'+f,'utf8'))).pop();
check('the newest daylight_admin_list_banners definition carries the cast',!!last&&last>='20261205',String(last));
if(failed){console.log('admin sql types FAILED');process.exit(1)}
console.log('PASS admin sql types');
