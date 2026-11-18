/** Smart banner matching: every synonym maps to the right banner and nothing that matched before has moved. Loads the real file in a bare sandbox. */
import fs from 'node:fs';import vm from 'node:vm';
const R=new URL('../',import.meta.url);
const src=fs.readFileSync(new URL('dashboard/daylight-banners.js',R),'utf8');
const ctx={window:{},document:{addEventListener(){},querySelector(){return null},baseURI:'http://x/'},bannerKeyFor:null,URL};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const sug=t=>{const k=ctx.daylightSuggestBanner(t);return k?k.replace(/^dl-banner-/,''):null};
let bad=0;const check=(t,want)=>{const got=sug(t);if(got!==want){bad++;console.log('FAIL',JSON.stringify(t),'->',got,'wanted',want)}};
const S={ // title -> banner (group-name, dashes as in the file names)
'school-life-gym-workout':['Training','Work out','Exercise','Cardio','CrossFit','HIIT','Boot Camp','Spin class','Strength training'],
'school-life-dentist':['Ortho appointment','Orthodontist','Braces tightening','Teeth cleaning','Root canal'],
'school-life-doctor':['Pediatrician','Dermatologist','Optometrist','Urgent care','Flu shot'],
'school-life-vet':['Animal hospital'],'school-life-haircut':['Hair appointment'],
'school-life-meeting':['Video call','Zoom call','Teams call'],
'school-life-study-exam':['Assessment','Homework','Review packet'],
'school-life-birthday':['Bday','B-day party for Sam'],
'school-life-wedding':['Engagement party','Bridal shower'],
'school-life-party':['Celebration','Get together','Hangout'],
'school-life-concert':['Gig','Music festival','Recital'],
'school-life-movie':['Film','Drive in'],
'school-life-music-practice':['Guitar lesson','Drum lesson','Voice lesson','Orchestra','Rehearsal'],
'school-life-flight-travel':['Flying','Layover'],'school-life-road-trip':['Car trip'],
'school-life-camping':['Summer camp'],'school-life-cooking':['Meal prep'],'school-life-coding':['Hackathon'],
'school-life-art':['Drawing','Pottery','Craft'],'school-life-picnic':['BBQ','Barbecue'],
'school-life-yoga':['Pilates','Meditation','Stretching'],
'sports-running':['Jogging','5K','10K'],'sports-cycling':['Bike ride'],'sports-weightlifting':['Lifting'],
'sports-soccer':['Futbol'],'sports-basketball':['NBA'],'sports-baseball':['MLB','Little League'],
'sports-tennis':['Wimbledon'],'sports-golf':['Mini golf','Putt putt','Driving range'],'sports-hockey':['NHL'],
'sports-martial-arts':['Jiu jitsu','Kung fu','Aikido'],'sports-boxing':['Kickboxing'],'sports-gymnastics':['Tumbling'],
'sports-sailing':['Yacht'],'sports-snowboarding':['Snowboard'],'sports-skateboarding':['Skateboard','Skate park'],
'sports-surfing':['Surf'],'sports-wrestling':['WWE'],'sports-kayaking':['Canoe','Canoeing'],'sports-rock-climbing':['Bouldering'],
'holidays-christmas':['Xmas'],'holidays-new-year':['New Years'],'holidays-thanksgiving':['Turkey day'],'holidays-halloween':['Trick or treat'],
'holidays-independence-day':['July fourth'],'holidays-st-patricks-day':["St. Patty's Day"],'holidays-election-day':['Voting'],
// order checks
'holidays-new-years-eve':["New Year's Eve",'New Years Eve'],'holidays-christmas-eve':['Christmas Eve'],'sports-dance':['Dance recital'],
'sports-swim':['Swim training','Team USA training','GRAL practice','Swim meet'],'sports-soccer-':[],
};
for(const [b,ts] of Object.entries(S))for(const t of ts)check(t,b.replace(/^(holidays|sports|school-life)-/,(m,g)=>g+'-').replace(/-$/,''));
// sport-specific words still beat the general ones
check('Soccer training','sports-soccer');check('Tennis lesson','sports-tennis');check('Basketball cardio','sports-basketball');
// words that stay bannerless
for(const t of ['School','Camp','Team lunch','Pick up kids'])check(t,null);
// original behaviour unchanged
const OLD={'Dentist':'school-life-dentist','Workout':'school-life-gym-workout','Christmas':'holidays-christmas','New Year':'holidays-new-year','Midterm':'school-life-study-exam','Boxing':'sports-boxing','Camping':'school-life-camping','Concert':'school-life-concert','Yoga class':'school-life-yoga','Thanksgiving':'holidays-thanksgiving','Piano lesson':'school-life-music-practice'};
for(const [t,b] of Object.entries(OLD))check(t,b);
console.log(bad?'FAILURES '+bad:'ALL OK');process.exit(bad?1:0);
