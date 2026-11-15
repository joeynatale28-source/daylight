-- =====================================================================================================================
-- SAMPLE ACCOUNTS FOR SCREENSHOTS  (paste this whole file into the Supabase SQL editor and press Run)
--
-- Creates 12 fake people with real-looking calendars, events and tasks built around TODAY (so every screenshot looks current).
-- Each account is e-mail confirmed and already onboarded, so signing in goes straight to a full calendar.
--
--   Sign in with any of:  maya.chen@daylight-sample.test ... noah.kim@daylight-sample.test     (list printed at the bottom)
--   Password for all:     SamplePass!2026
--
-- Safe to run more than once: it first removes any earlier sample accounts (only addresses ending @daylight-sample.test) and
-- rebuilds them. It never touches any other account. To remove the samples for good, run just the block marked CLEAN UP at the end.
-- Nothing is e-mailed. These are fake people on a fake domain.
-- =====================================================================================================================

do $$
declare
  v_password constant text := 'SamplePass!2026';
  v_tz constant text := 'America/New_York';
  v_today date := (now() at time zone 'America/New_York')::date;
  v_month date := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  v_people jsonb;
  p jsonb;
  v_uid uuid;
  v_email text;
  v_name text;
  v_cals jsonb;
  v_events jsonb;
  v_tasks jsonb;
  v_id int;
  v_ev jsonb;
  v_t jsonb;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_dow int;
  v_first date;
  v_cal_id text;
  v_default_rem int;
  v_n int := 0;
  v_payload jsonb;
  v_calendars jsonb;
  v_evlist jsonb;
  v_tasklist jsonb;
  v_hex text;
  v_pat text;
  v_d int;
begin
  -- ---------------------------------------------------------------------------------------------------------------
  -- Start clean: remove earlier sample accounts (and their workspaces)
  -- ---------------------------------------------------------------------------------------------------------------
  delete from public.workspace_snapshots where user_id in (select id from auth.users where email like '%@daylight-sample.test');
  delete from auth.identities where user_id in (select id from auth.users where email like '%@daylight-sample.test');
  delete from auth.users where email like '%@daylight-sample.test';

  -- ---------------------------------------------------------------------------------------------------------------
  -- The people. cals = [name, color]; ev = event templates; tasks = [title, days from today, done]
  --   ev fields:  c calendar number (1-based) · t title · w weekdays for a weekly repeat (0=Sun..6=Sat) · o day offset from the
  --   first of this month (one-off) · h/m start time · dur minutes · ad all day · loc · r reminder minutes · span extra days (all day)
  -- ---------------------------------------------------------------------------------------------------------------
  v_people := $json$[
  {"email":"maya.chen","name":"Maya Chen","cals":[["Practices","blue"],["Meets","amber"],["Personal","green"],["Family","rose"]],
   "ev":[
    {"c":1,"t":"Morning practice","w":[1,2,4,5],"h":5,"m":30,"dur":120,"loc":"Brookside Aquatic Center","r":30},
    {"c":1,"t":"Dryland workout","w":[3],"h":16,"m":0,"dur":60,"loc":"Brookside gym","r":15},
    {"c":1,"t":"Stroke clinic","o":9,"h":17,"m":30,"dur":90,"loc":"Brookside Aquatic Center"},
    {"c":2,"t":"Winter Invitational","o":12,"ad":true,"span":2,"loc":"Richmond Aquatic Complex"},
    {"c":2,"t":"Team travel meeting","o":6,"h":19,"m":0,"dur":45,"loc":"Zoom"},
    {"c":2,"t":"Regional Championships","o":24,"ad":true,"span":3,"loc":"Virginia Beach"},
    {"c":3,"t":"Dentist","o":8,"h":9,"m":30,"dur":60,"loc":"Smile Dental","r":60},
    {"c":3,"t":"Lunch with Jess","o":15,"h":12,"m":15,"dur":75,"loc":"Alamo Cafe"},
    {"c":3,"t":"Yoga","w":[6],"h":9,"m":0,"dur":60,"loc":"Flow Studio"},
    {"c":4,"t":"Mom's birthday dinner","o":19,"h":18,"m":30,"dur":120,"loc":"Pomodoro Trattoria"},
    {"c":4,"t":"Sunday brunch","w":[0],"h":10,"m":30,"dur":90}],
   "tasks":[["Order new team caps",2,false],["Post meet schedule",1,false],["Renew lifeguard certification",12,false],["Book hotel for regionals",5,false],["Reply to booster club",-2,true]]},

  {"email":"daniel.okafor","name":"Daniel Okafor","cals":[["Work","blue"],["Focus time","violet"],["Personal","green"]],
   "ev":[
    {"c":1,"t":"Daily standup","w":[1,2,3,4,5],"h":9,"m":30,"dur":15,"loc":"Zoom","r":5},
    {"c":1,"t":"Sprint planning","w":[1],"h":10,"m":0,"dur":90,"loc":"Conference room B","r":15},
    {"c":1,"t":"1:1 with Priya","w":[3],"h":14,"m":0,"dur":30,"loc":"Zoom"},
    {"c":1,"t":"Design review","o":10,"h":15,"m":0,"dur":60,"loc":"Zoom"},
    {"c":1,"t":"Quarterly roadmap review","o":17,"h":13,"m":0,"dur":120,"loc":"Main conference room"},
    {"c":1,"t":"Release v2.4","o":21,"h":16,"m":0,"dur":60},
    {"c":2,"t":"Deep work: API refactor","w":[2,4],"h":13,"m":0,"dur":180,"r":10},
    {"c":3,"t":"Gym","w":[1,3,5],"h":6,"m":30,"dur":60,"loc":"Iron Works"},
    {"c":3,"t":"Dinner with Marcus","o":11,"h":19,"m":0,"dur":120,"loc":"Kōyō Ramen"},
    {"c":3,"t":"Flight to Austin","o":26,"h":7,"m":45,"dur":240,"loc":"RIC → AUS"}],
   "tasks":[["Review pull requests",0,false],["Write postmortem",3,false],["Update on-call runbook",7,false],["Book flights for offsite",-1,true],["Expense report",4,false]]},

  {"email":"priya.raman","name":"Priya Raman","cals":[["Classes","violet"],["Study","teal"],["Life","rose"]],
   "ev":[
    {"c":1,"t":"Organic Chemistry","w":[1,3,5],"h":9,"m":0,"dur":75,"loc":"Science Hall 210","r":15},
    {"c":1,"t":"Statistics","w":[2,4],"h":11,"m":0,"dur":75,"loc":"Gilman 104"},
    {"c":1,"t":"Chem lab","w":[2],"h":14,"m":0,"dur":170,"loc":"Science Hall Lab 3"},
    {"c":1,"t":"Midterm: Organic Chemistry","o":13,"h":9,"m":0,"dur":75,"loc":"Science Hall 210","r":1440},
    {"c":2,"t":"Study group","w":[0,3],"h":18,"m":30,"dur":120,"loc":"Library, room 3B"},
    {"c":2,"t":"Office hours: Prof. Hale","o":7,"h":15,"m":30,"dur":30},
    {"c":2,"t":"Thesis proposal due","o":20,"ad":true},
    {"c":3,"t":"Brunch with Anika","o":9,"h":11,"m":0,"dur":90,"loc":"The Daily Grind"},
    {"c":3,"t":"Call home","w":[0],"h":15,"m":0,"dur":45},
    {"c":3,"t":"Concert: The Lumineers","o":22,"h":19,"m":30,"dur":180,"loc":"Altria Theater"}],
   "tasks":[["Finish lab report",1,false],["Read chapter 9",2,false],["Pay rent",5,false],["Email advisor",0,false],["Buy textbook",-3,true]]},

  {"email":"marcus.bell","name":"Marcus Bell","cals":[["Shop","green"],["Clients","blue"],["Personal","gray"]],
   "ev":[
    {"c":1,"t":"Open shop","w":[2,3,4,5,6],"h":10,"m":0,"dur":30},
    {"c":1,"t":"Inventory count","w":[1],"h":9,"m":0,"dur":120},
    {"c":1,"t":"Supplier call: Hartwell Lumber","o":8,"h":13,"m":30,"dur":30,"loc":"Phone"},
    {"c":1,"t":"Farmers market booth","o":12,"h":8,"m":0,"dur":300,"loc":"Main Street Market"},
    {"c":1,"t":"Holiday pop-up","o":25,"ad":true,"span":1,"loc":"Shockoe Slip"},
    {"c":2,"t":"Custom table consult: Reeves","o":5,"h":14,"m":0,"dur":60,"loc":"Shop"},
    {"c":2,"t":"Install: Okafor dining set","o":14,"h":9,"m":30,"dur":180,"loc":"214 Maple Ave"},
    {"c":2,"t":"Quote follow-ups","w":[1],"h":15,"m":0,"dur":45},
    {"c":3,"t":"Pickup: Dylan","w":[3],"h":15,"m":15,"dur":30,"loc":"Westview Elementary"},
    {"c":3,"t":"Date night","o":18,"h":19,"m":0,"dur":150,"loc":"Rue 8"}],
   "tasks":[["Order walnut slabs",1,false],["Send invoice to Reeves",0,false],["Renew business license",16,false],["Fix the table saw fence",3,false],["Post new listings",-1,true]]},

  {"email":"elena.rossi","name":"Elena Rossi","cals":[["Classroom","green"],["School events","amber"],["Personal","plum"]],
   "ev":[
    {"c":1,"t":"Homeroom","w":[1,2,3,4,5],"h":8,"m":0,"dur":20,"loc":"Room 14"},
    {"c":1,"t":"Period 2 Algebra","w":[1,2,3,4,5],"h":9,"m":15,"dur":55,"loc":"Room 14"},
    {"c":1,"t":"Period 5 Geometry","w":[1,2,3,4,5],"h":13,"m":0,"dur":55,"loc":"Room 14"},
    {"c":1,"t":"Department meeting","w":[3],"h":15,"m":30,"dur":45,"loc":"Library"},
    {"c":1,"t":"Grades due","o":11,"h":16,"m":0,"dur":30},
    {"c":2,"t":"Parent-teacher conferences","o":15,"h":16,"m":0,"dur":180,"loc":"Gym"},
    {"c":2,"t":"Science fair","o":19,"h":18,"m":0,"dur":120,"loc":"Cafeteria"},
    {"c":2,"t":"Teacher workday (no students)","o":23,"ad":true},
    {"c":3,"t":"Pilates","w":[2,4],"h":17,"m":30,"dur":50,"loc":"Core Studio"},
    {"c":3,"t":"Book club","o":13,"h":19,"m":0,"dur":120,"loc":"Sofia's place"}],
   "tasks":[["Grade quizzes",1,false],["Print study guides",0,false],["Order classroom supplies",6,false],["Update seating chart",-2,true],["Plan field trip",9,false]]},

  {"email":"sam.patel","name":"Sam Patel","cals":[["Clients","blue"],["Studio","violet"],["Personal","teal"]],
   "ev":[
    {"c":1,"t":"Kickoff: Fernwood branding","o":3,"h":10,"m":0,"dur":60,"loc":"Zoom","r":15},
    {"c":1,"t":"Client review: Cascade app","o":7,"h":14,"m":0,"dur":45,"loc":"Zoom"},
    {"c":1,"t":"Final files due: Fernwood","o":16,"ad":true},
    {"c":1,"t":"Invoice day","w":[5],"h":16,"m":0,"dur":30},
    {"c":2,"t":"Design block","w":[1,2,3,4],"h":9,"m":30,"dur":180,"r":0},
    {"c":2,"t":"Portfolio refresh","w":[5],"h":10,"m":0,"dur":120},
    {"c":2,"t":"Print proofs pickup","o":10,"h":12,"m":0,"dur":30,"loc":"Pixel & Press"},
    {"c":3,"t":"Run club","w":[2,4],"h":6,"m":15,"dur":55,"loc":"Byrd Park"},
    {"c":3,"t":"Haircut","o":12,"h":17,"m":0,"dur":45,"loc":"Blade & Comb"},
    {"c":3,"t":"Design meetup","o":20,"h":18,"m":30,"dur":120,"loc":"Common House"}],
   "tasks":[["Send Fernwood concepts",0,false],["Reply to Cascade feedback",1,false],["Renew font licenses",10,false],["Update rates sheet",4,false],["Back up project files",-2,true]]},

  {"email":"hannah.lee","name":"Hannah Lee","cals":[["Shifts","rose"],["Training","blue"],["Home","green"]],
   "ev":[
    {"c":1,"t":"Day shift","w":[1,2,3],"h":7,"m":0,"dur":720,"loc":"St. Mary's Hospital","r":60},
    {"c":1,"t":"Night shift","o":14,"h":19,"m":0,"dur":720,"loc":"St. Mary's Hospital"},
    {"c":1,"t":"Night shift","o":15,"h":19,"m":0,"dur":720,"loc":"St. Mary's Hospital"},
    {"c":1,"t":"Charge nurse handoff","w":[4],"h":6,"m":45,"dur":30,"loc":"Unit 4B"},
    {"c":2,"t":"CPR recertification","o":9,"h":13,"m":0,"dur":180,"loc":"Training Center"},
    {"c":2,"t":"Charting workshop","o":18,"h":10,"m":0,"dur":120,"loc":"Conference room A"},
    {"c":3,"t":"Farmers market","w":[6],"h":9,"m":30,"dur":90,"loc":"17th Street Market"},
    {"c":3,"t":"Grocery run","w":[0],"h":11,"m":0,"dur":60},
    {"c":3,"t":"Vet: Biscuit","o":11,"h":16,"m":30,"dur":45,"loc":"Willow Animal Clinic"},
    {"c":3,"t":"Video call with Dad","o":21,"h":20,"m":0,"dur":45}],
   "tasks":[["Swap shift with Jen",1,false],["Renew nursing license",14,false],["Meal prep",0,false],["Order scrubs",6,false],["Pay electric bill",-1,true]]},

  {"email":"jordan.walker","name":"Jordan Walker","cals":[["Family","rose"],["Kids","amber"],["Work","blue"],["House","green"]],
   "ev":[
    {"c":2,"t":"School drop-off","w":[1,2,3,4,5],"h":8,"m":10,"dur":25,"loc":"Lincoln Elementary"},
    {"c":2,"t":"Piano lesson: Ava","w":[2],"h":16,"m":30,"dur":45,"loc":"Keys Music School"},
    {"c":2,"t":"Soccer practice: Eli","w":[3],"h":17,"m":0,"dur":75,"loc":"Hollins Field"},
    {"c":2,"t":"Soccer game: Eli","o":6,"h":10,"m":0,"dur":90,"loc":"Hollins Field","r":60},
    {"c":2,"t":"Class pizza party","o":16,"h":12,"m":0,"dur":60,"loc":"Lincoln Elementary"},
    {"c":3,"t":"Team sync","w":[1,3],"h":11,"m":0,"dur":30,"loc":"Zoom"},
    {"c":3,"t":"Quarterly review","o":12,"h":14,"m":0,"dur":60,"loc":"Zoom"},
    {"c":1,"t":"Family movie night","w":[5],"h":19,"m":0,"dur":120},
    {"c":1,"t":"Grandma visits","o":19,"ad":true,"span":2},
    {"c":4,"t":"Plumber","o":4,"h":9,"m":0,"dur":120,"loc":"Home"},
    {"c":4,"t":"Trash and recycling","w":[4],"h":7,"m":0,"dur":15}],
   "tasks":[["Sign Ava's permission slip",0,false],["Buy birthday gift for Eli",5,false],["Schedule pediatrician",3,false],["Return library books",-1,true],["Wash the soccer jerseys",1,false]]},

  {"email":"aisha.rahman","name":"Aisha Rahman","cals":[["Work","blue"],["Product","violet"],["Personal","green"]],
   "ev":[
    {"c":1,"t":"Leadership sync","w":[1],"h":9,"m":0,"dur":60,"loc":"Zoom"},
    {"c":2,"t":"Product standup","w":[2,3,4],"h":10,"m":0,"dur":20,"loc":"Zoom"},
    {"c":2,"t":"Roadmap workshop","o":8,"h":13,"m":0,"dur":180,"loc":"Room 5"},
    {"c":2,"t":"User interviews","w":[2],"h":14,"m":0,"dur":90},
    {"c":1,"t":"Board prep","o":13,"h":15,"m":0,"dur":90},
    {"c":1,"t":"All-hands","o":17,"h":11,"m":0,"dur":60,"loc":"Auditorium"},
    {"c":2,"t":"Launch day: Insights","o":22,"ad":true},
    {"c":3,"t":"Spin class","w":[1,3,5],"h":6,"m":0,"dur":45,"loc":"Cycle House"},
    {"c":3,"t":"Dinner party","o":11,"h":18,"m":30,"dur":210,"loc":"Home"},
    {"c":3,"t":"Weekend trip: Blue Ridge","o":26,"ad":true,"span":2}],
   "tasks":[["Write launch announcement",2,false],["Review Q1 metrics",1,false],["Approve designs",0,false],["Book dinner party catering",4,false],["Send meeting notes",-1,true]]},

  {"email":"tom.nguyen","name":"Tom Nguyen","cals":[["Training","blue"],["Games","amber"],["Personal","green"]],
   "ev":[
    {"c":1,"t":"U12 practice","w":[2,4],"h":17,"m":30,"dur":90,"loc":"Meadow Park Field 2","r":30},
    {"c":1,"t":"U14 practice","w":[1,3],"h":17,"m":30,"dur":90,"loc":"Meadow Park Field 1"},
    {"c":1,"t":"Coaches meeting","o":5,"h":19,"m":0,"dur":60,"loc":"Rec center"},
    {"c":2,"t":"Home game vs Eagles","o":6,"h":10,"m":0,"dur":120,"loc":"Meadow Park Field 1","r":90},
    {"c":2,"t":"Away game at Hanover","o":13,"h":9,"m":30,"dur":120,"loc":"Hanover Sports Complex"},
    {"c":2,"t":"Tournament weekend","o":27,"ad":true,"span":1,"loc":"Charlotte"},
    {"c":3,"t":"Strength session","w":[1,5],"h":6,"m":0,"dur":60,"loc":"Anytime Fitness"},
    {"c":3,"t":"Physical therapy","o":9,"h":8,"m":0,"dur":50,"loc":"Peak PT"},
    {"c":3,"t":"Team dinner","o":14,"h":18,"m":30,"dur":120,"loc":"Pho Saigon"}],
   "tasks":[["Order new jerseys",3,false],["Send lineup to parents",1,false],["Confirm field permits",6,false],["Wash practice pinnies",0,false],["Pay referee fees",-2,true]]},

  {"email":"chloe.martin","name":"Chloe Martin","cals":[["Weddings","plum"],["Vendors","blue"],["Personal","green"]],
   "ev":[
    {"c":1,"t":"Wedding: Hart & Alvarez","o":12,"h":16,"m":0,"dur":420,"loc":"Linden Estate","r":1440},
    {"c":1,"t":"Rehearsal: Hart & Alvarez","o":11,"h":17,"m":30,"dur":90,"loc":"Linden Estate"},
    {"c":1,"t":"Wedding: Brooks & Tran","o":26,"h":15,"m":30,"dur":420,"loc":"The Greenhouse"},
    {"c":1,"t":"Consult: new couple","o":4,"h":11,"m":0,"dur":60,"loc":"Studio"},
    {"c":2,"t":"Florist walkthrough","o":7,"h":14,"m":0,"dur":60,"loc":"Petal & Stem"},
    {"c":2,"t":"Cake tasting","o":9,"h":15,"m":30,"dur":45,"loc":"Sugar Lane Bakery"},
    {"c":2,"t":"Vendor call","w":[2],"h":10,"m":0,"dur":30},
    {"c":3,"t":"Pilates","w":[1,3],"h":7,"m":30,"dur":50,"loc":"Core Studio"},
    {"c":3,"t":"Anniversary dinner","o":18,"h":19,"m":30,"dur":120,"loc":"Lemaire"}],
   "tasks":[["Confirm DJ for Hart wedding",2,false],["Print seating charts",8,false],["Send final invoice: Brooks",12,false],["Order table runners",1,false],["Email photographer",-1,true]]},

  {"email":"noah.kim","name":"Noah Kim","cals":[["Gigs","rose"],["Rehearsal","violet"],["Day job","blue"],["Personal","green"]],
   "ev":[
    {"c":1,"t":"Gig: The Camel","o":5,"h":20,"m":0,"dur":180,"loc":"The Camel","r":180},
    {"c":1,"t":"Gig: Strange Matter","o":12,"h":21,"m":0,"dur":150,"loc":"Strange Matter"},
    {"c":1,"t":"Wedding band: Hart reception","o":12,"h":18,"m":0,"dur":240,"loc":"Linden Estate"},
    {"c":1,"t":"Open mic","w":[3],"h":19,"m":0,"dur":180,"loc":"Hardywood"},
    {"c":2,"t":"Band rehearsal","w":[2,6],"h":18,"m":30,"dur":150,"loc":"Garage"},
    {"c":2,"t":"Studio session","o":10,"h":12,"m":0,"dur":300,"loc":"Echo Room Studio"},
    {"c":3,"t":"Barista shift","w":[1,4,5],"h":6,"m":0,"dur":480,"loc":"Lamplighter"},
    {"c":4,"t":"Guitar lesson (teaching)","w":[3],"h":16,"m":0,"dur":60},
    {"c":4,"t":"Dentist","o":14,"h":10,"m":0,"dur":45}],
   "tasks":[["Learn new set list",3,false],["Restring the Telecaster",1,false],["Book van for tour",9,false],["Send press photos",0,false],["Pay rehearsal space",-1,true]]}
  ]$json$::jsonb;

  -- ---------------------------------------------------------------------------------------------------------------
  -- Build every account
  -- ---------------------------------------------------------------------------------------------------------------
  for p in select * from jsonb_array_elements(v_people) loop
    v_n := v_n + 1;
    v_uid := gen_random_uuid();
    v_email := (p->>'email') || '@daylight-sample.test';
    v_name := p->>'name';
    v_cals := p->'cals';
    v_events := p->'ev';
    v_tasks := p->'tasks';

    -- the account itself (e-mail confirmed, already onboarded)
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
            crypt(v_password, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', v_name, 'onboarded', true),
            now() - make_interval(days => 40 + v_n), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text, 'email',
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
            now(), now() - make_interval(days => 40 + v_n), now());

    -- calendars
    v_calendars := '[]'::jsonb;
    for v_id in 1..jsonb_array_length(v_cals) loop
      v_calendars := v_calendars || jsonb_build_array(jsonb_build_object(
        'id', 'c' || v_id, 'name', v_cals->(v_id - 1)->>0, 'color', v_cals->(v_id - 1)->>1,
        'hidden', false, 'subscribed', false, 'shared', false, 'builtin', false));
    end loop;
    v_calendars := v_calendars || jsonb_build_array(jsonb_build_object(
        'id', 'holidays', 'name', 'US Holidays', 'color', 'amber', 'hidden', false, 'subscribed', true, 'shared', false, 'builtin', true));

    -- events
    v_evlist := '[]'::jsonb;
    v_id := 0;
    for v_ev in select * from jsonb_array_elements(v_events) loop
      v_cal_id := 'c' || (v_ev->>'c');
      if v_ev ? 'w' then
        -- a weekly repeat for each chosen weekday, first occurrence three weeks before this month so it always fills the grid
        for v_d in select (x)::int from jsonb_array_elements_text(v_ev->'w') x loop
          v_first := (v_month - 21) + ((v_d - extract(dow from (v_month - 21))::int + 7) % 7);
          v_start := ((v_first::timestamp) + make_interval(hours => (v_ev->>'h')::int, mins => (v_ev->>'m')::int)) at time zone v_tz;
          v_end := v_start + make_interval(mins => (v_ev->>'dur')::int);
          v_id := v_id + 1;
          v_evlist := v_evlist || jsonb_build_array(jsonb_build_object(
            'id', v_id, 'title', v_ev->>'t', 'cal', v_cal_id,
            'start', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'end', to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'allDay', false, 'loc', coalesce(v_ev->>'loc', ''), 'desc', '', 'repeat', 'weekly',
            'reminder', case when v_ev ? 'r' then (v_ev->>'r')::int else null end, 'uid', 'sample-' || v_n || '-' || v_id));
        end loop;
      else
        v_day := v_month + (v_ev->>'o')::int;
        if coalesce((v_ev->>'ad')::boolean, false) then
          v_start := (v_day::timestamp) at time zone v_tz;
          v_end := ((v_day + coalesce((v_ev->>'span')::int, 0))::timestamp + interval '23 hours 59 minutes') at time zone v_tz;
        else
          v_start := ((v_day::timestamp) + make_interval(hours => (v_ev->>'h')::int, mins => (v_ev->>'m')::int)) at time zone v_tz;
          v_end := v_start + make_interval(mins => (v_ev->>'dur')::int);
        end if;
        v_id := v_id + 1;
        v_evlist := v_evlist || jsonb_build_array(jsonb_build_object(
          'id', v_id, 'title', v_ev->>'t', 'cal', v_cal_id,
          'start', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'end', to_char(v_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'allDay', coalesce((v_ev->>'ad')::boolean, false), 'loc', coalesce(v_ev->>'loc', ''), 'desc', '', 'repeat', null,
          'reminder', case when v_ev ? 'r' then (v_ev->>'r')::int else null end, 'uid', 'sample-' || v_n || '-' || v_id));
      end if;
    end loop;

    -- tasks (due dates are relative to today; the last one in each list is already done)
    v_tasklist := '[]'::jsonb;
    for v_t in select * from jsonb_array_elements(v_tasks) loop
      v_id := v_id + 1;
      v_start := ((v_today + (v_t->>1)::int)::timestamp) at time zone v_tz;
      v_tasklist := v_tasklist || jsonb_build_array(jsonb_build_object(
        'id', v_id, 'title', v_t->>0, 'cal', 'c1',
        'due', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'hasTime', false, 'done', (v_t->>2)::boolean));
    end loop;

    v_payload := jsonb_build_object(
      'version', 2, 'calendars', v_calendars, 'events', v_evlist, 'tasks', v_tasklist, 'feeds', '[]'::jsonb,
      'settings', jsonb_build_object('themeMode', 'system', 'firstName', split_part(v_name, ' ', 1), 'profileName', v_name,
                                     'identityOwner', v_uid::text, 'defaultCalendarId', 'c1', 'defaultView', 'month'),
      'ui', '{}'::jsonb);

    insert into public.workspace_snapshots (user_id, payload, revision) values (v_uid, v_payload, 1)
    on conflict (user_id) do update set payload = excluded.payload, revision = 1, updated_at = now();
  end loop;

  raise notice 'Created % sample accounts. Password for all: %', v_n, v_password;
end $$;

-- What was created (the Results panel shows this):
select u.email as "sign in with", 'SamplePass!2026' as password,
       jsonb_array_length(s.payload->'events') as events, jsonb_array_length(s.payload->'tasks') as tasks
from auth.users u join public.workspace_snapshots s on s.user_id = u.id
where u.email like '%@daylight-sample.test' order by u.email;

-- =====================================================================================================================
-- CLEAN UP (run ONLY this block when you are done with the screenshots; it removes just the sample accounts):
--   delete from public.workspace_snapshots where user_id in (select id from auth.users where email like '%@daylight-sample.test');
--   delete from auth.identities where user_id in (select id from auth.users where email like '%@daylight-sample.test');
--   delete from auth.users where email like '%@daylight-sample.test';
-- =====================================================================================================================
