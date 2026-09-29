/* Daily Planner application.
   Supabase is intentionally optional until configured in config.js.
   Security model: Supabase Auth + RLS. Never put service-role keys here. */
const TOPICS=[
"Insecure Deserialization","DNS Rebinding","HTTP Request Smuggling","Server-Side Template Injection (SSTI)",
"Server-Side Request Forgery (SSRF)","XML External Entity (XXE) Injection","Server-Side Prototype Pollution",
"Web Cache Poisoning","Web Cache Deception","Server-Side Race Conditions (TOCTOU)",
"Out-of-Band (OOB) Injection (SQLi / NoSQLi / LDAP)","Mass Assignment / Over-Posting","Arbitrary File Write / Zip Slip",
"GraphQL Query Depth & Batching Exploitation","JWT Implementation Flaws & Key Confusion","Polyglot & Arbitrary File Upload",
"SQL Injection (SQLi)","OS Command Injection","Broken Object-Level Authorization (BOLA / IDOR)",
"Broken Function-Level Authorization (BFLA)","Vertical & Horizontal Privilege Escalation","Path Traversal / Directory Traversal",
"Local File Inclusion (LFI) & Remote File Inclusion (RFI)","Cross-Site Request Forgery (CSRF)",
"Broken Authentication & Session Management","Improper Rate Limiting & Resource Exhaustion (DoS)",
"Server-Side Information & Environment Disclosure","Insecure Cryptographic Storage & Hardcoded Secrets",
"Security Misconfiguration & Exposed Management Interfaces"];
const SLOTS=[
["08:00–10:00","Read security research","Extract the attack primitive, trust boundary, exploit chain, and why the bug worked.","read"],
["10:00–11:00","Breakfast + reset","Flexible 30–60 minute buffer before execution.","break"],
["11:00–16:00","Bug hunting","Primary execution block: target → hypothesis → test → evidence.","hunt"],
["16:00–19:00","Deep security concept","Current roadmap concept. Two-session deep dive across two days.","learn"],
["19:00–20:00","Dinner + reset","Flexible 30–60 minute break.","break"],
["20:00–00:00","Bug hunting","Second major hunting block. Continue the strongest hypothesis or move feature.","hunt"],
["00:00–00:30","Buffer / short break","Save evidence, close tabs, prepare final hunting block.","break"],
["00:30–03:00","Bug bounty execution","Validation, chaining, retesting, report writing, or focused hunting.","hunt"],
["03:00–03:30","English / soft skills","Technical English, communication, report quality, concise explanations.","soft"],
["03:30–03:40","Tomorrow’s agenda","Choose target + feature + first hypothesis/test. Then stop.","review"]];

const CFG=window.PLANNER_CONFIG||{};
const hasCloud=Boolean(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase);
const supa=hasCloud?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
const KEY="planner_local_v3";
let db=loadLocal(), selectedDate=localISO(new Date()), pickerDate=selectedDate, user=null, saving=false;

function localISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parseLocal(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=parseLocal(s);d.setDate(d.getDate()+n);return localISO(d)}
function dim(y,m){return new Date(y,m+1,0).getDate()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(s,o={weekday:"long",month:"short",day:"numeric",year:"numeric"}){return new Intl.DateTimeFormat(undefined,o).format(parseLocal(s))}
function blank(){return {days:{},topics:[]}}
function loadLocal(){try{let x=JSON.parse(localStorage.getItem(KEY)||"");if(x?.days&&Array.isArray(x.topics))return x}catch{}return blank()}
function persist(){localStorage.setItem(KEY,JSON.stringify(db))}
function ensureDay(){if(!db.days[selectedDate])db.days[selectedDate]={checks:{},review:{win:"",block:"",next:""}};return db.days[selectedDate]}
function toast(t){const e=document.querySelector(".toast");if(!e)return;e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1500)}
function setStatus(t,ok=true){const e=document.querySelector("#syncStatus");if(e)e.textContent=t}

function renderShell(){
document.querySelector("#app").innerHTML=`
<div class="app">
<header class="topbar">
 <div class="brand"><i class="brand-mark"></i><div><strong>Daily Planner</strong><small>Private execution dashboard</small></div></div>
 <div class="row"><div class="status"><i></i><span id="syncStatus">${hasCloud?"Cloud ready":"Local mode"}</span></div><div class="actions">
  <button class="btn" id="settingsBtn">Settings</button><button class="btn" id="exportBtn">Export</button><button class="btn" id="importBtn">Import</button><button class="btn danger" id="logoutBtn">Sign out</button>
 </div></div>
</header>
<div class="shell"><main class="stack">
<section class="card">
<div class="date-head"><div class="date-toolbar"><div class="date-nav">
<button class="iconbtn" id="prev">‹</button><div class="date-main"><button class="date-display" id="dateDisplay"><div><strong id="dateTitle">—</strong><span id="dateSub">—</span></div></button>
<div class="date-pop" id="datePop"><div class="scrollers"><div class="scroller" id="monthScroll"></div><div class="scroller" id="dayScroll"></div><div class="scroller" id="yearScroll"></div></div><div class="date-pop-foot"><button class="btn" id="dateCancel">Cancel</button><div class="row"><span class="tiny muted">Scroll to choose</span><button class="btn primary" id="dateApply">Apply</button></div></div></div></div><button class="iconbtn" id="next">›</button>
</div><button class="btn primary" id="todayBtn">Today</button></div><div class="day-title" id="dayLabel"></div></div>
<div class="kpis"><div class="kpi"><b id="dayPct">0%</b><span>routine completion</span></div><div class="kpi"><b id="huntPct">0%</b><span>hunting blocks</span></div><div class="kpi"><b id="learnPct">0%</b><span>learning block</span></div><div class="kpi"><b id="streak">0</b><span>full-day streak</span></div></div>
<div class="progress-wrap"><div class="progress-label"><span>Daily execution</span><span id="count">0 / 0</span></div><div class="progress"><i id="dayProgress"></i></div></div>
</section>
<section class="card"><div class="tabs" id="tabs"><button class="tab active" data-view="plan">Plan</button><button class="tab" data-view="review">Review</button><button class="tab" data-view="analytics">Analytics</button><button class="tab" data-view="roadmap">Roadmap</button></div>
<div class="view active" id="view-plan"><div class="cardhead"><h2>Daily execution</h2><span class="tag purple">08:00 → 03:40</span></div><div class="timeline" id="timeline"></div></div>
<div class="view" id="view-review"><div class="cardhead"><h2>Bedtime review</h2><span class="tiny muted">Close the loop</span></div><div class="pad review-grid">
<div class="review-box"><label>What moved forward today?</label><textarea id="reviewWin" placeholder="Bugs, hypotheses, writeups, concepts..."></textarea></div>
<div class="review-box"><label>Where did I lose time / what blocked me?</label><textarea id="reviewBlock" placeholder="Record the bottleneck factually."></textarea></div>
<div class="review-box full"><label>Tomorrow's hunting agenda</label><textarea id="reviewNext" placeholder="Target + feature + hypothesis + first test."></textarea></div>
<div class="review-box full"><div class="row between"><span id="reviewStatus" class="tiny muted"></span><button class="btn primary" id="saveReview">Save review</button></div></div></div>
<div class="cardhead"><h2>Review history</h2><span class="tiny muted">Recent</span></div><div class="pad" id="reviewHistory"></div></div>
<div class="view" id="view-analytics"><div class="cardhead"><h2>Execution analytics</h2><span class="tiny muted">14-day trend</span></div><div class="pad analytics-grid"><div class="metric"><h3>Completion history</h3><div class="barwrap" id="analytics"></div></div><div class="metric"><h3>Selected day</h3><div class="metric-big" id="analyticsBig">0%</div><div class="tiny muted" id="analyticsSub"></div></div></div><div class="cardhead"><h2>30-day calendar</h2><span class="tiny muted">Click a day</span></div><div class="pad"><div class="calendar" id="calendar"></div></div></div>
<div class="view" id="view-roadmap"><div class="cardhead"><h2>Security learning roadmap</h2><span class="tag orange">2 sessions / concept</span></div><div class="pad"><div class="row"><select id="topicSelect"></select><button class="btn primary" id="addTopic">Add</button></div></div><div id="topics"></div></div>
<div class="view" id="view-settings"><div class="cardhead"><h2>Account & settings</h2><span class="tiny muted">Private controls</span></div><div class="pad settings-grid">
<div class="settings-card"><h3>Change password</h3><div class="field"><label>New password</label><input id="newPass" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div><div class="field"><label>Confirm password</label><input id="newPass2" type="password" autocomplete="new-password"></div><button class="btn primary" id="changePass">Update password</button><div id="passMsg" class="tiny muted" style="margin-top:8px"></div></div>
<div class="settings-card"><h3>Account</h3><div class="tiny muted">Signed in as</div><div id="accountEmail" style="margin-top:4px;font-weight:650"></div><div class="tiny muted" style="margin-top:12px">Storage</div><div style="margin-top:4px">Supabase + local cache</div></div>
<div class="settings-card"><h3>Data portability</h3><p class="tiny muted">Export creates a JSON backup of your planner data. Import replaces the local cache; cloud data is not deleted.</p><button class="btn" id="settingsExport" style="margin-top:9px">Export backup</button></div>
</div></div>
</section></main>
<aside class="stack"><section class="card"><div class="cardhead"><h2>Quick review</h2><span class="tiny muted">Selected day</span></div><div class="pad" id="quickReview"></div></section>
<section class="card"><div class="cardhead"><h2>Next-day agenda</h2><span class="tiny muted">From review</span></div><div class="pad" id="nextAgenda"></div></section>
<section class="card"><div class="cardhead"><h2>Account security</h2></div><div class="pad tiny muted">Authentication is handled by Supabase Auth. Database access is restricted by Row Level Security. The public frontend never contains a service-role key.</div></section></aside></div>
<div class="footer">Private daily planner · Supabase Auth + PostgreSQL + RLS · local cache for resilience</div></div><div class="toast"></div>`;
bindUI(); renderAll();
}
function showAuth(){
document.querySelector("#app").innerHTML=`<div class="auth"><div class="auth-box"><div class="auth-title"><h1>Daily Planner</h1><p>Private workspace · sign in to continue</p></div><form class="auth-form" id="authForm"><input id="email" type="email" autocomplete="username" placeholder="Email" required><input id="password" type="password" autocomplete="current-password" placeholder="Password" required><button class="btn primary" type="submit">Sign in</button><div id="authErr" class="error"></div></form><div class="tiny muted" style="margin-top:14px">Your initial account password will be created in Supabase during setup. It is not stored in this frontend.</div></div></div>`;
document.querySelector("#authForm").onsubmit=async e=>{e.preventDefault();const er=document.querySelector("#authErr");er.textContent="Signing in…";const {data,error}=await supa.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});if(error)er.textContent=error.message;else{user=data.user;await cloudLoad();renderShell()}};
}
function bindUI(){
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
document.querySelector("#settingsBtn").onclick=()=>switchView("settings");
document.querySelector("#prev").onclick=()=>{selectedDate=addDays(selectedDate,-1);renderAll()};
document.querySelector("#next").onclick=()=>{selectedDate=addDays(selectedDate,1);renderAll()};
document.querySelector("#todayBtn").onclick=()=>{selectedDate=localISO(new Date());renderAll()};
document.querySelector("#dateDisplay").onclick=e=>{e.stopPropagation();openPicker()};
document.querySelector("#dateCancel").onclick=closePicker;
document.querySelector("#dateApply").onclick=()=>{selectedDate=pickerDate;closePicker();renderAll()};
document.addEventListener("click",e=>{if(!e.target.closest(".date-main"))closePicker()},{once:false});
document.querySelector("#saveReview").onclick=()=>{persist();saveDayCloud();toast("Review saved")};
["reviewWin","reviewBlock","reviewNext"].forEach((id,i)=>document.querySelector("#"+id).oninput=()=>{ensureDay().review[["win","block","next"][i]]=document.querySelector("#"+id).value;persist()});
document.querySelector("#addTopic").onclick=()=>{const n=document.querySelector("#topicSelect").value;if(!db.topics.some(x=>x.name===n)){db.topics.push({name:n,s1:false,s2:false});persist();saveTopicsCloud();renderAll();toast("Concept added")}};
document.querySelector("#logoutBtn").onclick=async()=>{if(supa)await supa.auth.signOut();user=null;showAuth()};
document.querySelector("#changePass").onclick=changePassword;
document.querySelector("#exportBtn").onclick=exportData;document.querySelector("#settingsExport").onclick=exportData;
document.querySelector("#importBtn").onclick=()=>document.querySelector("#fileInput")?.click();
}
function switchView(name){document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===name));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+name))}
function renderAll(){renderDate();renderTimeline();renderReview();renderAnalytics();renderCalendar();renderTopics();renderStats();buildPicker(pickerDate)}
function renderDate(){document.querySelector("#dateTitle").textContent=fmt(selectedDate,{month:"short",day:"numeric"});document.querySelector("#dateSub").textContent=fmt(selectedDate,{year:"numeric"});document.querySelector("#dayLabel").textContent=fmt(selectedDate)}
function renderTimeline(){const d=ensureDay();document.querySelector("#timeline").innerHTML=SLOTS.map((s,i)=>`<div class="slot ${d.checks["slot"+i]?"completed":""}"><div class="time">${s[0]}</div><div><h3>${esc(s[1])} <span class="tag ${s[3]==="hunt"?"green":s[3]==="learn"?"purple":""}">${s[3]}</span></h3><div class="desc">${esc(s[2])}</div></div><input class="check" type="checkbox" data-slot="${i}" ${d.checks["slot"+i]?"checked":""}></div>`).join("");document.querySelectorAll("[data-slot]").forEach(x=>x.onchange=async()=>{ensureDay().checks["slot"+x.dataset.slot]=x.checked;persist();renderAll();await saveDayCloud()})}
function renderReview(){const r=ensureDay().review;document.querySelector("#reviewWin").value=r.win||"";document.querySelector("#reviewBlock").value=r.block||"";document.querySelector("#reviewNext").value=r.next||"";document.querySelector("#reviewStatus").textContent=Object.values(r).some(Boolean)?"Saved locally":"No review saved";const rs=Object.entries(db.days).filter(([_,v])=>v.review&&Object.values(v.review).some(Boolean)).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10);document.querySelector("#reviewHistory").innerHTML=rs.length?rs.map(([ds,v])=>`<div class="note" style="margin-bottom:8px"><div class="note-top"><span>${esc(fmt(ds))}</span><button class="btn tiny" data-rdate="${ds}">open</button></div><p>${esc(v.review.win||v.review.next||v.review.block||"Review saved.")}</p></div>`).join(""):'<div class="empty">No reviews yet.</div>';document.querySelectorAll("[data-rdate]").forEach(x=>x.onclick=()=>{selectedDate=x.dataset.rdate;renderAll()});document.querySelector("#quickReview").innerHTML=r.win?`<div class="tiny muted">What moved forward</div><div style="margin-top:6px;font-size:12px">${esc(r.win)}</div>`:'<div class="empty" style="padding:5px">No review yet.</div>';document.querySelector("#nextAgenda").innerHTML=r.next?`<div style="font-size:12px;white-space:pre-wrap">${esc(r.next)}</div>`:'<div class="empty" style="padding:5px">No agenda yet.</div>'}
function renderStats(){const d=ensureDay(),done=Object.values(d.checks).filter(Boolean).length,pct=Math.round(done/SLOTS.length*100),hunt=[2,5,7].filter(i=>d.checks["slot"+i]).length;document.querySelector("#dayPct").textContent=pct+"%";document.querySelector("#huntPct").textContent=Math.round(hunt/3*100)+"%";document.querySelector("#learnPct").textContent=d.checks.slot3?"100%":"0%";document.querySelector("#count").textContent=`${done} / ${SLOTS.length}`;document.querySelector("#dayProgress").style.width=pct+"%";let st=0,c=selectedDate;while(db.days[c]&&SLOTS.every((_,i)=>db.days[c].checks?.["slot"+i])){st++;c=addDays(c,-1);if(st>365)break}document.querySelector("#streak").textContent=st;document.querySelector("#analyticsBig").textContent=pct+"%";document.querySelector("#analyticsSub").textContent=`${done} of ${SLOTS.length} blocks complete`}
function renderAnalytics(){const a=[];for(let i=13;i>=0;i--){const ds=addDays(selectedDate,-i),d=db.days[ds],p=d?Math.round(Object.values(d.checks||{}).filter(Boolean).length/SLOTS.length*100):0;a.push({ds,p})}document.querySelector("#analytics").innerHTML=a.map(x=>`<div class="barline"><span>${x.ds.slice(5)}</span><div class="bar"><i style="width:${x.p}%"></i></div><b>${x.p}%</b></div>`).join("")}
function renderCalendar(){const base=parseLocal(selectedDate),first=new Date(base.getFullYear(),base.getMonth(),1),start=(first.getDay()+6)%7;let cells="";for(let i=0;i<42;i++){const d=new Date(first.getFullYear(),first.getMonth(),i-start+1),ds=localISO(d),v=db.days[ds],done=v?Object.values(v.checks||{}).filter(Boolean).length:0;cells+=`<div class="calday ${d.getMonth()!=first.getMonth()?"mutedday":""} ${ds===localISO(new Date())?"today":""} ${ds===selectedDate?"selected":""}" data-cal="${ds}"><span>${d.getDate()}</span>${done?`<i class="dot ${done<SLOTS.length?"partial":""}"></i>`:""}</div>`}document.querySelector("#calendar").innerHTML=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=>`<div class="calhead">${x}</div>`).join("")+cells;document.querySelectorAll("[data-cal]").forEach(x=>x.onclick=()=>{selectedDate=x.dataset.cal;renderAll();switchView("plan")})}
function renderTopics(){document.querySelector("#topicSelect").innerHTML=TOPICS.map(x=>`<option>${esc(x)}</option>`).join("");document.querySelector("#topics").innerHTML=db.topics.length?db.topics.map((t,i)=>`<div class="topic ${t.s1&&t.s2?"done":""}"><div class="row between"><div class="topic-name">${esc(t.name)}</div><button class="btn tiny" data-del="${i}">remove</button></div><div class="topic-meta">Concept ${i+1} · two-session deep dive</div><div class="topicgrid"><div class="session ${t.s1?"done":""}"><label><input class="check" type="checkbox" data-t="${i}" data-s="s1" ${t.s1?"checked":""}> <span><b>Session 1</b><br><span class="muted">Internals, primitives, preconditions, minimal lab/PoC.</span></span></label></div><div class="session ${t.s2?"done":""}"><label><input class="check" type="checkbox" data-t="${i}" data-s="s2" ${t.s2?"checked":""}> <span><b>Session 2</b><br><span class="muted">Bypasses, chaining, reports, detection and mitigation.</span></span></label></div></div></div>`).join(""):'<div class="empty">Add concepts to your two-session learning queue.</div>';document.querySelectorAll("[data-t]").forEach(x=>x.onchange=async()=>{db.topics[x.dataset.t][x.dataset.s]=x.checked;persist();renderAll();await saveTopicsCloud()});document.querySelectorAll("[data-del]").forEach(x=>x.onclick=async()=>{db.topics.splice(+x.dataset.del,1);persist();renderAll();await saveTopicsCloud()})}
function buildPicker(v){pickerDate=v;const d=parseLocal(v),months=["January","February","March","April","May","June","July","August","September","October","November","December"],years=[];for(let y=d.getFullYear()-5;y<=d.getFullYear()+5;y++)years.push(y);document.querySelector("#monthScroll").innerHTML=months.map((x,i)=>`<button class="${i===d.getMonth()?"selected":""}" data-m="${i}">${x}</button>`).join("");document.querySelector("#dayScroll").innerHTML=Array.from({length:dim(d.getFullYear(),d.getMonth())},(_,i)=>i+1).map(x=>`<button class="${x===d.getDate()?"selected":""}" data-d="${x}">${x}</button>`).join("");document.querySelector("#yearScroll").innerHTML=years.map(x=>`<button class="${x===d.getFullYear()?"selected":""}" data-y="${x}">${x}</button>`).join("");document.querySelectorAll("[data-m],[data-d],[data-y]").forEach(x=>x.onclick=()=>{let q=parseLocal(pickerDate),y=q.getFullYear(),m=q.getMonth(),day=q.getDate();if(x.dataset.m!==undefined)m=+x.dataset.m;if(x.dataset.d!==undefined)day=+x.dataset.d;if(x.dataset.y!==undefined)y=+x.dataset.y;day=Math.min(day,dim(y,m));pickerDate=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;buildPicker(pickerDate)})}
function openPicker(){buildPicker(selectedDate);document.querySelector("#datePop").classList.add("open");setTimeout(()=>document.querySelectorAll(".scroller .selected").forEach(x=>x.scrollIntoView({block:"center"})),0)}
function closePicker(){document.querySelector("#datePop")?.classList.remove("open")}

function exportData(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));a.download="daily-planner-backup-"+selectedDate+".json";a.click()}
async function changePassword(){const a=document.querySelector("#newPass").value,b=document.querySelector("#newPass2").value,m=document.querySelector("#passMsg");if(a.length<8||a!==b){m.textContent="Use at least 8 characters and make both fields match.";return}if(!supa){m.textContent="Supabase is not configured yet.";return}const {error}=await supa.auth.updateUser({password:a});m.textContent=error?error.message:"Password updated.";if(!error){document.querySelector("#newPass").value="";document.querySelector("#newPass2").value=""}}
async function cloudLoad(){if(!supa||!user)return;setStatus("Syncing…");const [days,topics]=await Promise.all([supa.from("daily_entries").select("*").eq("user_id",user.id),supa.from("learning_topics").select("*").eq("user_id",user.id).order("position")]);if(days.error||topics.error){setStatus("Cloud error · local mode");return}db.days={};for(const x of days.data||[])db.days[x.entry_date]={checks:x.checks||{},review:x.review||{win:"",block:"",next:""}};db.topics=(topics.data||[]).map(x=>({name:x.name,s1:x.session1_done,s2:x.session2_done}));persist();setStatus("Synced")}
async function saveDayCloud(){if(!supa||!user)return;const d=ensureDay();setStatus("Saving…");const {error}=await supa.from("daily_entries").upsert({user_id:user.id,entry_date:selectedDate,checks:d.checks,review:d.review},{onConflict:"user_id,entry_date"});setStatus(error?"Cloud save failed · local cache":"Synced")}
async function saveTopicsCloud(){if(!supa||!user)return;await supa.from("learning_topics").delete().eq("user_id",user.id);const rows=db.topics.map((x,i)=>({user_id:user.id,name:x.name,session1_done:x.s1,session2_done:x.s2,position:i}));if(rows.length)await supa.from("learning_topics").insert(rows)}
async function boot(){if(!hasCloud){renderShell();return}const {data}=await supa.auth.getSession();if(data.session){user=data.session.user;await cloudLoad();renderShell()}else showAuth();supa.auth.onAuthStateChange(async(_,session)=>{if(session&&!user){user=session.user;await cloudLoad();renderShell()}else if(!session)showAuth()})}
boot();