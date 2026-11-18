import {SERVICES,AREAS,PARTNERS,PERSONAS,CATEGORIES,SOURCES} from './data.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n||0).toLocaleString('en-CA');
const dollar=n=>'$'+fmt(Math.round(n));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getArea=id=>AREAS.find(a=>a.id===id)||AREAS[0];
const areaName=id=>getArea(id).name;
const categoryName=id=>CATEGORIES.find(c=>c.id===id)?.label||id;
const colorScale=(v)=>v>=80?'#ad292a':v>=65?'#e46e4d':v>=50?'#efaa83':v>=35?'#f3d9be':'#dbe9e4';
const opt=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
const state={view:'resident',persona:'maria',resident:structuredClone(PERSONAS[0]),saved:false,history:[],tasks:new Set(),selectedNeed:new Set(PERSONAS[0].needs),selectedArea:'all',category:'food',selectedAreaFocus:'fairview',mapMode:'gap',mapReady:false,map:null,mapBaseLayer:null,mapMarkers:[],mapTileErrors:0,mapTilesComplete:false,fallbackZoom:1,pilot:'extended',weeks:8,cost:150,capacity:25,partner:{...PARTNERS[0],constraints:'hours'},partnerKey:'p1',partnerProfiles:{},govCategory:'food',allocation:{food:40,housing:30,transport:20,heating:10},chat:[],screeningSession:null,screeningPlan:null,screeningTaskStatuses:{}};
const presets={extended:{title:'Extend evening hours',short:'Extra opening hours at a current provider',tag:'OPTION A',factor:0.31},mobile:{title:'Mobile outreach near a transit stop',short:'A pop-up service at a more accessible point',tag:'OPTION B',factor:0.36},navigator:{title:'Assisted application clinic',short:'One-stop benefits and transport navigation',tag:'OPTION C',factor:0.27}};
let toastTimer;
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3100)}
function store(key,data){try{localStorage.setItem('looplogic.'+key,JSON.stringify(data));return true}catch{return false}}
function load(key){try{return JSON.parse(localStorage.getItem('looplogic.'+key)||'null')}catch{return null}}
function clearStore(key){try{localStorage.removeItem('looplogic.'+key)}catch{}}
// A screening belongs to a stable demo resident ID, even if the profile is later saved.
// The visible persona dropdown may switch to 'custom' on reload; it is not a stable owner key.
function profileIdentity(){return String(state.resident?.id||state.persona)}
function rememberPersona(){store('active_persona',state.persona)}
function unique(xs){return [...new Set(xs)]}
const matchingTerms={food:/food|hungr|grocer|meal|pantr|bank/i,housing:/rent|housing|home|landlord|shelter|mortgage|apartment/i,transport:/bus|transit|commut|transport|ride|mobility/i,heating:/heat|warm|winter|electric|oil|energy|utility/i,seniors:/senior|elder|old|retire|care|aged/i,families:/family|child|kid|recreat|school|library/i};
const catOrder=['food','housing','transport','heating','seniors','families'];
function detectNeeds(input){const found=[];for(const [category,re] of Object.entries(matchingTerms))if(re.test(input))found.push(category);return found}
if (typeof window!=="undefined") window.LoopLogicState=state;
function init(){populateSelects();loadResident();loadPartner();wireEvents();selectPersona(state.persona,true);renderMatches();renderChatWelcome();renderPartner();renderGovernment();renderCatalogue();renderEvidence();switchView(location.hash?.slice(1)||'resident',true);window.addEventListener('hashchange',()=>switchView(location.hash.slice(1),true));setTimeout(()=>{updateAIStatus();if(state.view==='partner')initializeMap()},900)}
function populateSelects(){for(const sel of ['#res-area','#partner-area','#partner-location']){const node=$(sel);node.innerHTML=(sel==='#partner-area'?opt('all','All HRM areas'):'')+AREAS.map(a=>opt(a.id,a.name)).join('')}
for(const sel of ['#partner-category','#partner-focus','#gov-category','#catalogue-category']){$(sel).innerHTML=(sel==='#partner-category'||sel==='#catalogue-category'?opt('all','All categories'):'')+CATEGORIES.map(c=>opt(c.id,c.label)).join('')}
$('#service-count-side').textContent=SERVICES.length;$('#resident-service-count').textContent=SERVICES.length;
$('#need-pills').innerHTML=CATEGORIES.map(c=>`<button type="button" class="need-pill" data-need="${c.id}">${esc(c.icon)} ${esc(c.label)}</button>`).join('');
$('#chat-chips').innerHTML=['Help with heating','Find affordable transit','Housing support','Food after work'].map(v=>`<button data-prompt="${esc(v)}">${esc(v)} ↗</button>`).join('');
$('#pilot-options').innerHTML=Object.entries(presets).map(([id,p])=>`<button class="pilot-option" data-pilot="${id}"><small>${p.tag}</small><b>${p.title}</b><p>${p.short}</p></button>`).join('');
}
function switchView(view,fromHash=false){if(!['resident','partner','government','catalogue','evidence'].includes(view))view='resident';state.view=view;$$('.view').forEach(e=>e.classList.toggle('is-active',e.id==='view-'+view));$$('.nav-btn').forEach(e=>e.classList.toggle('active',e.dataset.view===view));$('#current-view-name').textContent=({resident:'RESIDENT NAVIGATOR',partner:'PARTNER INTELLIGENCE',government:'GOVERNMENT STUDIO',catalogue:'SERVICE LIBRARY',evidence:'DATA & TRUST'})[view];if(!fromHash)history.replaceState(null,'','#'+view);$('#sidebar').classList.remove('open');window.scrollTo(0,0);if(view==='partner'){renderPartner();setTimeout(()=>{initializeMap();state.map?.invalidateSize({pan:false})},220)}if(view==='government')renderGovernment();if(view==='resident')renderMatches()}
function loadResident(){
 const active=load('active_persona');
 const activePreset=PERSONAS.find(x=>x.id===active);
 const saved=load('resident');
 const savedProfile=saved&&typeof saved==='object'&&saved.profile&&typeof saved.profile==='object'?saved.profile:null;
 // Restore a manually saved profile only when it belongs to the last selected demo.
 // A saved profile from another persona must never silently override the selected resident.
 if(savedProfile&&(!active||active===savedProfile.id||active==='custom'&&savedProfile.id==='custom')){
   state.resident={...PERSONAS[0],...savedProfile};
   state.persona=activePreset?active:'custom';
   state.saved=true;
   state.selectedNeed=new Set((savedProfile.needs||[]).filter(x=>catOrder.includes(x)));
   state.tasks=new Set(saved.tasks||[]);
   state.history=(saved.history||[]).slice(-12);
 }else if(activePreset){
   state.persona=active;state.resident=structuredClone(activePreset);
   state.selectedNeed=new Set(activePreset.needs);
 }else if(active==='custom'){
   state.persona='custom';
   state.resident={id:'custom',name:'',age:35,area:'halifax',income:'unknown',housing:'rent',paysHeat:'unknown',travel:'bus',schedule:'weekdays',needs:[],notes:''};
   state.selectedNeed=new Set();
 }
}
function readResident(){const p={...state.resident};p.name=$('#res-name').value.trim().slice(0,60);p.age=Math.min(110,Math.max(0,Number($('#res-age').value)||0));p.area=$('#res-area').value;p.income=$('#res-income').value;p.housing=$('#res-housing').value;p.paysHeat=$('#res-heat').value;p.travel=$('#res-travel').value;p.schedule=$('#res-schedule').value;p.needs=[...state.selectedNeed];p.notes=$('#res-notes').value.trim().slice(0,280);state.resident=p;return p}
function setResidentForm(){const p=state.resident;$('#res-name').value=p.name||'';$('#res-age').value=p.age||'';$('#res-area').value=p.area;$('#res-income').value=p.income;$('#res-housing').value=p.housing;$('#res-heat').value=p.paysHeat;$('#res-travel').value=p.travel;$('#res-schedule').value=p.schedule;$('#res-notes').value=p.notes||'';$$('[data-need]').forEach(b=>b.classList.toggle('selected',state.selectedNeed.has(b.dataset.need)));$('#persona').value=state.persona}
function selectPersona(id,first=false){if(id!=='custom'){const p=PERSONAS.find(x=>x.id===id)||PERSONAS[0];if(!state.saved||!first){state.resident=structuredClone(p);state.tasks.clear();state.history=[];if(!first)clearScreeningArtifacts();state.selectedNeed=new Set(p.needs)}}else if(!first){state.resident={id:'custom',name:'',age:35,area:'halifax',income:'unknown',housing:'rent',paysHeat:'unknown',travel:'bus',schedule:'weekdays',needs:[],notes:''};state.tasks.clear();state.history=[];state.selectedNeed.clear();clearScreeningArtifacts()}
state.persona=id;if(!first)rememberPersona();setResidentForm();renderMatches()}
function profileSummary(p){const needs=p.needs?.map(categoryName).join(' · ')||'Needs not selected';return `${p.name||'Resident'} · ${p.age||'Age not specified'} · ${areaName(p.area)}. Priorities: ${needs}. Housing: ${p.housing}; travel: ${p.travel}; available: ${p.schedule}.`}
function statusFor(service,p){if(service.id==='harp'){
 if(p.paysHeat==='no')return {code:'review',label:'Unlikely based on heat costs',reason:'This rebate requires paying your own qualifying home-heating costs.'};
 if(p.income==='over60')return {code:'review',label:'Likely outside income range',reason:'Most income thresholds are lower; some benefit-based exceptions may apply.'};
 return {code:'possible',label:'Potential fit — verify',reason:'Check 2025 net income, household composition, heating type and all official exclusions.'};}
 if(service.id==='senior'){
 if(p.age&&p.age<64)return {code:'review',label:'Age requirement likely unmet',reason:'Must turn 65 by March 31, 2027.'};
 if(p.income==='over60')return {code:'review',label:'Income threshold likely exceeded',reason:'Household net income threshold is $45,100.'};
 return {code:'possible',label:'Potential fit — verify',reason:'Confirm age, household net income, residence, expenses, and December 1 deadline.'};}
 if(service.id==='rent'||service.id==='homeowner')return {code:'unknown',label:'Complex criteria — review',reason:'Income, immigration status, benchmark housing cost and exclusions need full screening.'};
 return {code:'unknown',label:service.kind==='directory'?'Service lookup':'Needs official review',reason:'We provide guidance, not a confirmed eligibility decision.'};}
function matchScore(service,p){let score=(p.needs||[]).includes(service.category)?72:5;score+=Math.min(12,state.history.filter(x=>x.category===service.category).length*4);const words=(p.notes||'').toLowerCase();if(service.tags.some(x=>words.includes(x)))score+=13;if(service.category==='heating'&&p.paysHeat==='yes')score+=6;if(service.id==='senior'&&p.age>=65)score+=14;if(service.id==='rent'&&p.housing==='rent')score+=12;if(service.id==='homeowner'&&p.housing==='own')score+=12;if(service.category==='transport'&&p.travel==='bus')score+=9;if(service.id==='food'&&p.schedule==='evenings')score+=11;if(service.id==='buspass'&&!p.needs.includes('transport'))score-=10;if((service.id==='senior'||service.id==='taxsenior')&&p.age<64)score-=60;if(service.id==='property'&&p.housing!=='own')score-=55;if(service.id==='homeowner'&&p.housing!=='own')score-=60;if(service.id==='rent'&&p.housing==='own')score-=50;if(service.id==='harp'&&p.paysHeat==='no')score-=30;return Math.max(0,score)}
function matchesFor(p){return SERVICES.map(s=>({...s,score:matchScore(s,p),eligibility:statusFor(s,p)})).filter(s=>s.score>=19).sort((a,b)=>b.score-a.score).slice(0,5)}
function taskKey(id,i){return id+'-'+i}
function renderMatches(){const p=readResident();const matches=matchesFor(p);$('#profile-summary').innerHTML=`<div><b>${esc(p.name||'Your profile')}</b><br><span>${esc(areaName(p.area))} · ${esc(p.needs.map(categoryName).join(', ')||'Choose your needs')}</span>${state.history.length?`<br><small>${state.history.length} saved topic interactions influence ranking</small>`:''}</div><span class="bubble-small">${matches.length} relevant options</span>`;
$('#matches').innerHTML=matches.length?matches.map(s=>`<div class="match"><div class="match-symbol">${esc(s.icon)}</div><div class="match-content"><div class="match-row"><h4>${esc(s.title)}</h4><span class="service-kind">${esc(s.amount)}</span></div><p class="match-desc">${esc(s.eligibility.reason)}</p><div class="match-footer"><span class="match-status ${s.eligibility.code==='possible'?'':'review'}">${esc(s.eligibility.label)}</span><a target="_blank" rel="noopener noreferrer" href="${esc(s.link)}" class="match-link">Official information ↗</a></div></div></div>`).join(''):'<div class="empty-state">Select one or more needs to discover relevant services.</div>';
const steps=matches.slice(0,3).flatMap(s=>s.actions.slice(0,2).map((action,i)=>({id:taskKey(s.id,i),label:action,service:s.title})));$('#plan-steps').innerHTML=`<h4>NEXT STEPS · TICK OFF AS YOU GO</h4>`+(steps.length?steps.map(t=>`<label class="task-item ${state.tasks.has(t.id)?'checked':''}"><input type="checkbox" data-task="${t.id}" ${state.tasks.has(t.id)?'checked':''}><span>${esc(t.label)} <small>· ${esc(t.service)}</small></span></label>`).join(''):'<span class="mini-note">Your plan will appear here.</span>');}
function clearScreeningArtifacts(){
  state.screeningSession=null;state.screeningPlan=null;state.screeningTaskStatuses={};
  ['screening_session','screening_plan','screening_task_statuses','screening_owner'].forEach(clearStore);
  renderScreeningPlan();
}
const safeOfficialURL=u=>{try{const p=new URL(String(u));return p.protocol==='https:'&&['www.novascotia.ca','novascotia.ca'].includes(p.hostname)?p.href:'#'}catch{return '#'}};
function renderScreeningPlan(){
  const panel=$('#screening-plan-panel');if(!panel)return;
  const p=state.screeningPlan;
  if(!p||p.program!=='rent'||!Array.isArray(p.tasks)){panel.hidden=true;return}
  panel.hidden=false;
  const m=p.metrics||{};
  const moneyOrUnknown=n=>typeof n==='number'&&Number.isFinite(n)?dollar(n):'Not provided';
  $('#screening-metrics').innerHTML=[['MONTHLY RENT',moneyOrUnknown(m.monthly_rent)],['GROSS INCOME / YEAR',moneyOrUnknown(m.annual_household_income)],['RENT ÷ GROSS INCOME',typeof m.actual_rent_to_income_pct==='number'?m.actual_rent_to_income_pct.toFixed(1)+'%':'Not available']].map(([label,value])=>`<div class="screening-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
  $('#screening-interpretation').textContent=p.interpretation||'';
  const notes=Array.isArray(p.review_notes)?p.review_notes:[];
  const official=safeOfficialURL(p.source_url);
  $('#screening-review').innerHTML=`<h4>What still needs verification</h4><ul>${notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul><a target="_blank" rel="noopener noreferrer" href="${esc(official)}">Official program requirements ↗</a>`;
  const valid=['not-started','in-progress','completed'];
  $('#screening-tasks').innerHTML=p.tasks.map(t=>{
    const cur=valid.includes(state.screeningTaskStatuses[t.id])?state.screeningTaskStatuses[t.id]:'not-started';
    return `<div class="screening-task ${cur==='completed'?'done':''}"><div><span class="screening-priority">${esc(t.priority)}</span><strong>${esc(t.title)}</strong><p>${esc(t.detail)}</p><a target="_blank" rel="noopener noreferrer" href="${esc(safeOfficialURL(t.url))}">Official reference ↗</a></div><select aria-label="Status for ${esc(t.title)}" data-screening-task="${esc(t.id)}"><option value="not-started" ${cur==='not-started'?'selected':''}>Not started</option><option value="in-progress" ${cur==='in-progress'?'selected':''}>In progress</option><option value="completed" ${cur==='completed'?'selected':''}>Completed</option></select></div>`;
  }).join('');
  const done=p.tasks.filter(t=>state.screeningTaskStatuses[t.id]==='completed').length;
  const pct=Math.round(done/Math.max(1,p.tasks.length)*100);
  $('#screening-progress-label').textContent=`${done} / ${p.tasks.length} completed`;
  $('#screening-progress-bar').setAttribute('aria-valuenow',String(pct));
  $('#screening-progress-fill').style.width=pct+'%';
}
function exportScreeningPlan(){const p=state.screeningPlan;if(!p)return;
 const m=p.metrics||{};
 const text=[`LOOPLOGIC · PRELIMINARY RENT SUPPORT PLAN`,`Fictional prototype · No eligibility determination`,``,p.title||'',
 `Reported monthly rent: ${m.monthly_rent ?? 'unknown'}`,`Reported annual gross income: ${m.annual_household_income ?? 'unknown'}`,
 `Actual rent-to-income percentage: ${m.actual_rent_to_income_pct==null?'not calculated':m.actual_rent_to_income_pct+'%'}`,
 p.interpretation||'',``,`TO VERIFY`,...(p.review_notes||[]).map(x=>'- '+x),``,`NEXT STEPS`,
 ...p.tasks.map((t,i)=>`${i+1}. [${state.screeningTaskStatuses[t.id]||'not-started'}] ${t.title}\n   ${t.detail}\n   ${t.url}`),
 ``,`Official program: ${p.source_url}`,`Checked source: ${p.source_checked||'not stated'}`,`Never enter SIN or financial documents in LoopLogic.`].join('\n');
 download('LoopLogic_rent_action_tracker.txt',text);toast('Screening checklist exported');
}
async function explainScreeningWithAI(){const p=state.screeningPlan;if(!p)return;
 const target=$('#screening-ai-note');target.hidden=false;
 if(!$('#ai-consent').checked){target.textContent='Enable the AI-sharing checkbox in CivicPath first. No information was sent.';return}
 target.textContent='Generating an explanation from the fictional plan…';
 const safe={metrics:p.metrics,review_notes:p.review_notes,tasks:p.tasks.map(t=>({title:t.title,detail:t.detail})),source:p.source_url};
 try{const msg='Explain this fictional renter next-step plan in clear, friendly English. Give up to 4 prioritized steps. The actual-rent/income ratio is NOT the provincial average-market-rent eligibility test. Do not claim approval or calculate a benefit. Cite only the official source supplied: '+JSON.stringify(safe);
 const result=await requestAI('resident',msg,{fictional:true,program:'rent'},[{name:'Official Rent Supplement',link:p.source_url}]);target.textContent=result+'\n\nAI explanation only; the saved tasks and official rules remain authoritative.';}
 catch(err){target.textContent='AI explanation unavailable: '+(err.message||'request failed')+'. Your deterministic checklist remains available.';}
}
function renderChatWelcome(){
 const owner=load('screening_owner');
 if(owner===profileIdentity()){
   state.screeningSession=load('screening_session');
   state.screeningPlan=load('screening_plan');
   state.screeningTaskStatuses=load('screening_task_statuses')||{};
 }else{
   // Never destroy saved work merely because initialization selects a different resident.
   // Changing the resident explicitly still clears prior screening artifacts.
   state.screeningSession=null;state.screeningPlan=null;state.screeningTaskStatuses={};
 }
 renderScreeningPlan();
 state.chat=[{by:'bot',txt:'Hi! I’m CivicPath. Tell me what you need, and I’ll match you with relevant Halifax or Nova Scotia resources and help organize your next steps. This is a demo, not official eligibility approval.'}];
 if(state.screeningPlan){
   const done=Object.values(state.screeningTaskStatuses).filter(x=>x==='completed').length;
   state.chat.push({by:'bot',txt:`Your saved rent-support action tracker has been restored (${done} of ${state.screeningPlan.tasks.length} tasks completed). Scroll down to continue.`});
   $('#agent-mode').textContent='INTAKE COMPLETE';
 }else if(state.screeningSession?.status==='in_progress'){
   const count=Object.keys(state.screeningSession.answers||{}).length;
   state.chat.push({by:'bot',txt:`Your rent supplement screening is saved (${count}/6 answers recorded). Continue with the next unanswered question, or say 'restart screening'.`});
   $('#agent-mode').textContent='STRUCTURED SCREENING';
 }
 paintChat();
}
function paintChat(){const el=$('#chat-history');el.innerHTML='';state.chat.slice(-12).forEach(m=>{const div=document.createElement('div');div.className='chat-message '+m.by;const title=document.createElement('small');title.textContent=m.by==='bot'?'CIVICPATH':'YOU';const span=document.createElement('span');span.textContent=m.txt;div.append(title,span);el.appendChild(div)});el.scrollTop=el.scrollHeight}
function demoGuidance(text,p){const found=detectNeeds(text);if(found.length){const cats=unique([...p.needs,...found]);state.selectedNeed=new Set(cats);p.needs=cats;setResidentForm();renderMatches()}
const tops=matchesFor(p).slice(0,3);const focus=found.length?found.map(categoryName).join(' and '):p.needs.map(categoryName).slice(0,2).join(' and ');
if(/deadline|when.*apply/i.test(text)){return tops.map(s=>`${s.title}: ${s.deadline}. Confirm dates on its official page.`).join('\n')||'Select a relevant program so I can show its application timeline.'}
if(/(apply|document|step|plan|checklist)/i.test(text)){return tops.slice(0,2).map(s=>`${s.title}: 1) ${s.actions[0]}; 2) ${s.actions[1]}; 3) Open the official page to complete the process.`).join('\n\n')||'First, select a service need and your area. I will build a checklist.'}
if(/(bus|evening|travel|after work|weekend)/i.test(text)){return `I’ve noted your access constraints. ${tops.map(s=>s.title).join(' and ')} may be relevant. Use the official provider pages to confirm hours and routes; this demo does not calculate live bus travel time. Open your action plan for next steps.`}
return `I hear that ${focus||'local assistance'} matters to you. Based on your profile, start with ${tops.map(s=>s.title).join(', ')||'the service catalogue'}. I’ve updated your action plan. Eligibility remains preliminary: verify details at the source before applying.`}
async function updateAIStatus(){const el=$('#ai-server-status');if(!el)return;if(location.protocol==='file:'){el.textContent='AI backend: unavailable in a directly opened HTML file. Extract the source and run python ai_server.py, then open http://127.0.0.1:8000.';return}try{const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw new Error('Backend API route unavailable');const data=await response.json();el.textContent=data.ready?`AI backend: configured (${data.model}). Enable the sharing checkbox to use it.`:'AI backend: running without OPENAI_API_KEY. Restart the Python server with a configured server-side key.'}catch{el.textContent='AI backend: not detected. Run python ai_server.py from the extracted source folder and open http://127.0.0.1:8000 (not the standalone HTML file).'}}
async function requestAI(mode,message,profile,services){if(location.protocol==='file:')throw new Error('Opened as a local HTML file — run python ai_server.py and use http://127.0.0.1:8000.');let response;try{response=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,message,profile,services})})}catch{throw new Error('AI backend is unreachable. Run python ai_server.py.')}let data;try{data=await response.json()}catch{throw new Error('The web server does not expose the AI API. Use python ai_server.py instead of python -m http.server.')}if(!response.ok)throw new Error(data.error||`AI server HTTP ${response.status}`);if(data.mode!=='generative'||!data.text)throw new Error('AI returned no usable answer.');return data.text}
async function screeningTurn(message){
  try {
    const response=await fetch('/api/screening',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'resident',message,screening_session:state.screeningSession})});
    if(!response.ok)return null;
    const result=await response.json();
    if(result.status==='not_screening')return null;
    if(result.status==='in_progress'&&result.completed===0){state.screeningPlan=null;state.screeningTaskStatuses={};clearStore('screening_plan');clearStore('screening_task_statuses');$('#screening-ai-note').hidden=true;}
    state.screeningSession=result.session||null;
    if(state.screeningSession){store('screening_session',state.screeningSession);store('screening_owner',profileIdentity());}else{clearStore('screening_session');clearStore('screening_owner');}
    if(result.status==='complete'&&result.plan&&result.plan.program==='rent'){
      state.screeningPlan=result.plan;state.screeningTaskStatuses={};
      store('screening_plan',state.screeningPlan);store('screening_task_statuses',state.screeningTaskStatuses);store('screening_owner',profileIdentity());
    }
    if(result.status==='cancelled')clearScreeningArtifacts();
    renderScreeningPlan();
    return result;
  }catch{return null;}
}
async function sendChat(q){if(!q.trim())return;readResident();const clean=q.trim().slice(0,480);for(const category of detectNeeds(clean)){state.history.push({category,when:new Date().toISOString().slice(0,10)});state.history=state.history.slice(-12)}if(state.saved)store('resident',{profile:state.resident,tasks:[...state.tasks],history:state.history});state.chat.push({by:'user',txt:clean});paintChat();$('#chat-input').value='';const p=state.resident;
const screening=await screeningTurn(clean);
if(screening){
  state.chat.push({by:'bot',txt:screening.text});
  $('#agent-mode').textContent=screening.status==='complete'?'INTAKE COMPLETE':'STRUCTURED SCREENING';
  paintChat();return;
}
if($('#ai-consent').checked){$('#agent-mode').textContent='CONNECTING AI';try{const text=await requestAI('resident',clean,p,matchesFor(p).map(s=>({name:s.title,description:s.description,link:s.link,deadline:s.deadline})));state.chat.push({by:'bot',txt:text});$('#agent-mode').textContent='GENERATIVE AI';paintChat();updateAIStatus();return}catch(err){$('#agent-mode').textContent='GUIDED FALLBACK';const reason=err.message||'Unknown error';$('#ai-server-status').textContent='AI unavailable: '+reason+' Guided assistant remains active.';toast('AI unavailable — guided assistant is active.')}}
state.chat.push({by:'bot',txt:demoGuidance(clean,p)});paintChat()}
function download(name,content,type='text/plain'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportPlan(){const p=readResident();const matches=matchesFor(p);const output=[`LOOPLOGIC — RESIDENT ACTION PLAN`,`Fictional prototype · Generated ${new Date().toLocaleDateString()}`,``,profileSummary(p),``,...matches.map((s,i)=>[`${i+1}. ${s.title}`,`   Preliminary status: ${s.eligibility.label}`,`   Why: ${s.eligibility.reason}`,`   Next actions:`,...s.actions.map((a,j)=>`     [${state.tasks.has(taskKey(s.id,j))?'x':' '}] ${a}`),`   Source: ${s.link}`,`   Deadline: ${s.deadline}`,``].join('\n')),`IMPORTANT: Screening is not a government eligibility decision. Confirm current requirements and service availability at the official source.`].join('\n');download('LoopLogic_resident_action_plan.txt',output);toast('Action plan exported')}
function saveResident(){readResident();rememberPersona();const ok=store('resident',{profile:state.resident,tasks:[...state.tasks],history:state.history});state.saved=ok;$('#resident-save-status').textContent=ok?'Demo profile saved in this browser only.':'Could not use browser storage in this context.';toast(ok?'Saved locally · not uploaded':'Browser storage unavailable')}
function loadPartner(){const saved=load('partners');if(saved&&typeof saved==='object'){state.partnerProfiles=saved;state.partner={...PARTNERS[0],...saved.p1};}}
function selectPartnerPersona(id){state.partnerKey=id;if(id==='custom')state.partner={id:'custom',name:'New demo partner',kind:'Community organization',area:'Central Halifax',capacity:50,focus:['food'],constraints:'hours'};else state.partner={...(PARTNERS.find(p=>p.id===id)||PARTNERS[0]),...state.partnerProfiles[id]};syncPartnerForm();renderInsight()}
function syncPartnerForm(){const p=state.partner;$('#partner-persona').value=state.partnerKey;$('#partner-name').value=p.name;$('#partner-focus').value=p.focus?.[0]||'food';$('#partner-location').value=AREAS.find(a=>a.name===p.area)?.id||'halifax';$('#partner-capacity').value=p.capacity;$('#partner-constraints').value=p.constraints||'hours'}
function readPartner(){state.partner={...state.partner,name:$('#partner-name').value.trim().slice(0,70)||'Demo partner',focus:[$('#partner-focus').value],area:areaName($('#partner-location').value),capacity:Math.min(20000,Math.max(0,Number($('#partner-capacity').value)||0)),constraints:$('#partner-constraints').value};return state.partner}
function areaData(a,c){const factor=c==='all'?1:Math.max(.25,(a[c]||40)/75);const r=Math.round(a.requests*factor);const m=Math.round(a.matched*factor*(c==='transport'?.91:1));const unmet=Math.max(0,r-m);const gap=Math.min(99,Math.max(9,Math.round((c==='all'?Math.max(a.food,a.housing,a.transport):a[c]||a.food)*.78+(unmet/Math.max(1,r)*25))));return {...a,requests:r,matched:m,unmet,gap}}
function selectedAreaData(){const filtered=state.selectedArea==='all'?AREAS:AREAS.filter(a=>a.id===state.selectedArea);return filtered.map(a=>areaData(a,state.category))}
function partnerKpis(){const arr=selectedAreaData();const sum=k=>arr.reduce((s,a)=>s+a[k],0);const top=arr.sort((a,b)=>b.gap-a.gap)[0];return {request:sum('requests'),match:sum('matched'),unmet:sum('unmet'),people:sum('people'),after:arr.length?Math.round(sum('after')/arr.length):0,top,rank:arr}}
function renderPartner(){if(!$('#partner-name').value)syncPartnerForm();$('#partner-category').value=state.category;$('#partner-area').value=state.selectedArea;const k=partnerKpis();$('#partner-kpis').innerHTML=[['Demo requests',fmt(k.request),'Resident needs, not applications','↗'],['Matched pathways',fmt(k.match),'Illustrative service matches','✓'],['Unmet requests',fmt(k.unmet),'Not proof of denied service','◎'],['Average after-work hrs',`${k.after} h`,'Illustrative access measure','◷']].map(([label,num,note,icon])=>`<div class="kpi"><span class="kpi-icon">${icon}</span><div class="kpi-label">${label}</div><strong class="kpi-number">${num}</strong><p class="kpi-detail">${note}</p></div>`).join('');const urgent=selectedAreaData().filter(a=>a.gap>=70);$('#focus-count').textContent=fmt(urgent.reduce((sum,a)=>sum+a.people,0));
renderNeighborhood();renderMap();renderGapTable();renderPartnerChart();renderPilot();renderInsight();}
function renderNeighborhood(){const a=areaData(getArea(state.selectedArea==='all'?state.selectedAreaFocus||'fairview':state.selectedArea),state.category);$('#neighborhood-title').textContent=a.name;$('#neighborhood-stats').innerHTML=[['Need gap index',`${a.gap} / 100`],['Residents in synthetic catchment',fmt(a.people)],['Category',(state.category==='all'?'All categories':categoryName(state.category))],['Illustrative requests',fmt(a.requests)],['Matched pathways',fmt(a.matched)],['Open & reachable',`${a.reachable} hrs / week`],['After work',`${a.after} hrs / week`],['Transit-stop coverage index',`${a.stop} / 100`]].map(([l,v])=>`<div class="metric-line"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('');$('#neighborhood-insight').innerHTML=`<b>Opportunity in ${esc(a.name)}</b>Access is constrained by ${a.after<10?'evening service hours':'multiple barriers'}. Estimated unmet requests: ${fmt(a.unmet)}. Investigate with providers before making an investment decision.`}
function renderGapTable(){const arr=selectedAreaData().sort((a,b)=>b.gap-a.gap);$('#gap-table').innerHTML=arr.map(a=>`<tr data-area="${a.id}" class="${state.selectedAreaFocus===a.id?'selected':''}"><td><span class="score-pill ${a.gap>=80?'hot':a.gap>=65?'medium':''}">${a.gap}</span></td><td>${esc(a.name)}</td><td>${fmt(a.requests)}</td><td>${fmt(a.matched)}</td><td>${fmt(a.unmet)}</td><td>${a.reachable} h</td><td>${a.after} h</td></tr>`).join('');}
function renderPartnerChart(){const list=selectedAreaData().sort((a,b)=>b.requests-a.requests).slice(0,6);const max=Math.max(...list.map(a=>a.requests),1);const w=530,h=list.length*40+32;const lines=list.map((a,i)=>{const y=i*40+13;return `<text x="8" y="${y+12}" font-size="11" fill="#4a6660">${esc(a.name)}</text><rect x="168" y="${y}" width="${Math.round(a.requests/max*305)}" height="12" rx="4" fill="#8caca5"/><rect x="168" y="${y+14}" width="${Math.round(a.matched/max*305)}" height="9" rx="3" fill="#1b8665"/><text x="${175+Math.round(a.requests/max*305)}" y="${y+11}" fill="#4c5e5e" font-size="10">${fmt(a.requests)}</text>`}).join('');$('#partner-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Demo service requests and matched pathways by neighbourhood">${lines}<text x="168" y="${h-5}" font-size="10" fill="#92a19c">■ Requests (grey)     ■ Matched (green)</text></svg>`}
function renderPilot(){const p=presets[state.pilot];$$('[data-pilot]').forEach(b=>b.classList.toggle('active',b.dataset.pilot===state.pilot));$('#weeks-value').textContent=state.weeks;$('#cost-value').textContent=state.cost;$('#capacity-value').textContent=state.capacity;$('#pilot-headline').textContent=p.title;const k=partnerKpis();const highNeedPeople=selectedAreaData().filter(a=>a.gap>=70).reduce((n,a)=>n+a.people,0);const potential=Math.round(highNeedPeople*p.factor);$('#pilot-deck').textContent=`A fictional catchment model suggests ${fmt(potential)} residents could have a new access option. It does not claim that they would use the service.`;
const visits=state.weeks*state.capacity;const dollars=state.weeks*state.cost;const costper=visits?dollars/visits:0;
$('#scenario-result').innerHTML=[[(state.pilot==='navigator'?'Potential users gaining assistance':'Potential reachable residents'),fmt(potential)],['Estimated household visits',fmt(visits)],['Total pilot cost',dollar(dollars)],['Cost per household visit',dollar(costper)]].map(([label,n])=>`<div><span>${label}</span><b>${n}</b></div>`).join('')+`<p class="mini-note" style="grid-column:1/-1">Assumptions: ${esc(p.title.toLowerCase())}, ${state.weeks} weekly sessions, ${state.capacity} visits/session, ${dollar(state.cost)}/session. Reach is illustrative and is not equivalent to completed referrals or unique people served.</p>`}
function renderInsight(){const k=partnerKpis();const p=readPartner();const query=$('#insight-prompt').value;let explanation='';if(query==='gap')explanation=`${k.top.name} has the highest synthetic gap index (${k.top.gap}/100) in the current filter. ${fmt(k.unmet)} demonstration requests across the selected areas lack a modeled matching pathway.`;
if(query==='hours')explanation=`Average after-work access is ${k.after} illustrative hours/week. Evening sessions may improve access in communities where working residents cannot attend daytime programs.`;
if(query==='investment')explanation=`The selected ${presets[state.pilot].title.toLowerCase()} pilot costs ${dollar(state.weeks*state.cost)} for ${fmt(state.weeks*state.capacity)} estimated household visits, or ${dollar(state.cost/state.capacity)} per visit.`;
if(query==='partner')explanation=`${p.name}, a sample ${p.kind||'community'} organization serving ${p.area}, has a stated capacity of ${fmt(p.capacity)} visits/month and prioritizes ${categoryName(p.focus?.[0]||'food')}. The ${p.constraints||'hours'} constraint could be tested through the pilot model.${state.partnerProfiles[state.partnerKey]?.previousPilot?' Previous demo pilot: '+presets[state.partnerProfiles[state.partnerKey].previousPilot].title+'.':''}`;
$('#ai-insight-content').innerHTML=`<h4>Evidence-led observation</h4><p>${esc(explanation)}</p><ul><li>Validate the gap with actual provider data and resident feedback.</li><li>Test a small intervention and track referral completion, not only inquiries.</li><li>Re-run the dashboard after collecting observed outcomes.</li></ul><div class="evidence-strip">Method: local deterministic calculation · Data: synthetic · AI narrative: not generated</div>`}
function selectArea(id){state.selectedAreaFocus=id;renderNeighborhood();renderGapTable();renderMap();const a=getArea(id);if(state.map&&state.view==='partner')state.map.panTo([a.lat,a.lon],{animate:true})}
function mapValue(a){if(state.mapMode==='reachable')return a.reachable;if(state.mapMode==='after')return a.after;return areaData(a,state.category).gap}
function mapColor(a){const n=mapValue(a);if(state.mapMode==='gap')return colorScale(n);if(state.mapMode==='reachable')return n>=30?'#246a9a':n>=23?'#4b95c8':n>=16?'#8ec1dc':'#d9e8f2';return n>=18?'#246a9a':n>=12?'#4b95c8':n>=6?'#8ec1dc':'#d9e8f2'}
function renderMap(){if(!$('#fallback-map'))return;$$('[data-map]').forEach(b=>b.classList.toggle('selected',b.dataset.map===state.mapMode));const legend=state.mapMode==='gap'?['0–34','35–49','50–64','65–79','80–100']:state.mapMode==='reachable'?['<16h','16–22h','23–29h','30+h']:['0–5h','6–11h','12–17h','18+h'];const col=state.mapMode==='gap'?['#dbe9e4','#f3d9be','#efaa83','#e46e4d','#ad292a']:['#d9e8f2','#8ec1dc','#4b95c8','#246a9a'];$('#map-legend').innerHTML=legend.map((s,i)=>`<span class="legend-item"><i class="legend-color" style="background:${col[i]}"></i>${s}</span>`).join('')+'<span class="legend-item">● Synthetic community centre</span>';
const x=lon=>48+(lon+63.76)/.31*695,y=lat=>40+(.81-(lat-44))/.22*370;
const rings=AREAS.map(a=>`<circle class="catchment-ring" cx="${x(a.lon).toFixed(1)}" cy="${y(a.lat).toFixed(1)}" r="${(14+mapValue(a)*.33).toFixed(1)}" fill="${mapColor(a)}" fill-opacity=".18" stroke="${mapColor(a)}" stroke-opacity=".6" stroke-width="1.5" />`).join('');
const markers=AREAS.map(a=>{const selected=(state.selectedAreaFocus||'fairview')===a.id;return `<g class="fake-pin" data-map-area="${a.id}" role="button" tabindex="0" aria-label="Inspect ${esc(a.name)}" transform="translate(${x(a.lon).toFixed(1)},${y(a.lat).toFixed(1)})"><circle r="${selected?17:13}" fill="${mapColor(a)}" stroke="#fff" stroke-width="3"/><circle r="${selected?6:4}" fill="#263941"/><text x="14" y="-16" text-anchor="start" font-size="11" fill="#243b44" stroke="#fff" stroke-width="3.5" paint-order="stroke" font-weight="700">${esc(a.name)}</text></g>`}).join('');
$('#fallback-map').innerHTML=`<svg viewBox="0 0 800 470" role="img" aria-label="Schematic map with interactive synthetic community access markers"><rect width="800" height="470" fill="#f3f3ec"/><path d="M472 -10 C500 70 495 115 540 143 S615 210 582 257 560 320 607 366 L705 480 L800 480 L800 -10Z" fill="#cbe1ea"/><path d="M560 0 C560 60 602 90 650 122 S740 172 800 212" fill="none" stroke="#a9cad9" stroke-width="17"/><path d="M-20 280C120 235 150 230 260 262S430 318 570 256M-30 125C92 112 170 146 230 190S381 260 515 182M310 -20C354 87 393 100 482 127M80 490C185 385 262 349 385 355" fill="none" stroke="#c2bb9f" stroke-width="13"/><path d="M-20 280C120 235 150 230 260 262S430 318 570 256M-30 125C92 112 170 146 230 190S381 260 515 182M310 -20C354 87 393 100 482 127M80 490C185 385 262 349 385 355" fill="none" stroke="#fdfbf5" stroke-width="8"/><g opacity=".52" stroke="#cbd1bd" stroke-width="1">${Array.from({length:18},(_,i)=>`<path d="M${i*48} 0 l${50-(i%4)*27} 480"/>`).join('')}${Array.from({length:12},(_,i)=>`<path d="M0 ${i*45} l800 ${-(i%4)*32+20}"/>`).join('')}</g><text x="625" y="380" font-size="15" fill="#7298a6" transform="rotate(-28 625 380)">HALIFAX HARBOUR</text><text x="15" y="23" font-size="10" fill="#81929a">SCHEMATIC / NOT TO SCALE</text>${rings}${markers}</svg>`;setFallbackZoom(state.fallbackZoom);
if(state.map){state.mapMarkers.forEach(x=>x.remove());state.mapMarkers=[];AREAS.forEach(a=>{const marker=window.L.circleMarker([a.lat,a.lon],{radius:(state.selectedAreaFocus||'fairview')===a.id?13:10,weight:3,color:'#fff',fillColor:mapColor(a),fillOpacity:1}).addTo(state.map);marker.bindTooltip(`${a.name}<br>${state.mapMode==='gap'?'Gap index':state.mapMode==='reachable'?'Reachable hours':'After-work hours'}: ${mapValue(a)}`,{direction:'top'});marker.on('click',()=>selectArea(a.id));state.mapMarkers.push(marker)})}
}
function setMapStatus(message){const status=$('#map-status');if(status)status.textContent=message}
function mapOffline(message){const shell=$('.map-shell');shell?.classList.add('offline');$('#real-map').classList.remove('ready');$('#fallback-map').style.display='block';setMapStatus(message||'Interactive schematic active; all three synthetic data layers remain available.')}
function mapOnline(){
  // Leaflet must complete ALL viewport tiles before we replace the schematic.
  if(state.mapTileErrors>0||!state.map)return;
  const shell=$('.map-shell');shell?.classList.remove('offline');
  $('#real-map').classList.add('ready');$('#fallback-map').style.display='none';
  state.mapTilesComplete=true;
  state.map.invalidateSize({pan:false});
  setMapStatus('OpenStreetMap tiles loaded · synthetic community indicators. Select a point.');
}
function initializeMap(){
  if(state.mapReady){state.map?.invalidateSize({pan:false});return;}
  if(!window.L){mapOffline('Map library unavailable. Use the interactive schematic and switch between the three layers.');return;}
  const real=$('#real-map');
  // Local CSS keeps this element measurable, even while its tiles are visually hidden.
  const rect=real.getBoundingClientRect();
  if(rect.width<100||rect.height<100){mapOffline('Map area is not visible yet. Use the schematic until the panel is ready.');return;}
  try{
    // IMPORTANT: Leaflet adds the `leaflet-container` class when L.map() runs.
    // Do not test CSS BEFORE this call: the old check always saw overflow:visible
    // on the plain #real-map element and incorrectly blocked the online map.
    state.map=window.L.map('real-map',{zoomControl:true,scrollWheelZoom:false,preferCanvas:true});
    // The local Leaflet CSS must now be active on the initialized container.
    if(getComputedStyle(real).overflow!=='hidden'){
      state.map.remove(); state.map=null;
      mapOffline('Map layout styles are unavailable. The schematic remains interactive.');
      return;
    }
    state.map.setView([44.675,-63.606],11,{animate:false});
    state.mapTileErrors=0;state.mapTilesComplete=false;
    const base=window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:16,attribution:'&copy; OpenStreetMap contributors'});
    state.mapBaseLayer=base;
    base.on('tileerror',()=>{
      state.mapTileErrors++;
      mapOffline('Some map tiles failed. The fully interactive schematic is active; use Retry map to try the online basemap again.');
    });
    base.on('load',()=>{
      // 'load' means the visible tile grid finished. 'tileload' does not.
      if(state.view==='partner'&&state.mapTileErrors===0)mapOnline();
    });
    state.mapReady=true;
    base.addTo(state.map);
    renderMap();
    state.map.invalidateSize({pan:false});
    mapOffline('Loading complete online map tiles… interactive schematic available meanwhile.');
    setTimeout(()=>{
      if(!state.mapTilesComplete&&state.mapTileErrors===0)mapOffline('Online basemap is slow or unavailable; the schematic is still interactive.');
    },7000);
  }catch(err){
    try{state.map?.remove()}catch(_){}
    state.map=null;state.mapReady=false;
    mapOffline('Online map could not initialize. The schematic still supports layer and community selection.');
  }
}
function retryMap(){
  if(!state.map){initializeMap();return;}
  state.mapTileErrors=0;state.mapTilesComplete=false;
  mapOffline('Reloading the full online basemap…');
  state.map.invalidateSize({pan:false});
  state.map.setView([44.675,-63.606],11,{animate:false});
  state.mapBaseLayer?.redraw();
  setTimeout(()=>{if(!state.mapTilesComplete)mapOffline('Online map not ready. The schematic remains available.')},7000);
}
function setFallbackZoom(level){
  state.fallbackZoom=Math.max(1,Math.min(3,level));
  const svg=$('#fallback-map svg');if(!svg)return;
  const w=800/state.fallbackZoom,h=470/state.fallbackZoom;
  // Center on the Halifax / Dartmouth region at each magnification.
  const midX=460,midY=240;
  const x=Math.max(0,Math.min(800-w,midX-w/2));
  const y=Math.max(0,Math.min(470-h,midY-h/2));
  svg.setAttribute('viewBox',`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
}
function renderGovernment(){const all=AREAS.map(a=>areaData(a,'all'));const totals=all.reduce((o,a)=>(o.requests+=a.requests,o.matched+=a.matched,o.unmet+=a.unmet,o.people+=a.people,o),{requests:0,matched:0,unmet:0,people:0});$('#gov-kpis').innerHTML=[['Community snapshots',AREAS.length,'Illustrative neighborhoods'],['Demo service requests',fmt(totals.requests),'Simulated, not received cases'],['Unmet-pathway rate',(totals.unmet/totals.requests*100).toFixed(1)+'%','Synthetic calculation'],['Curated service entries',SERVICES.length,'With official source links']].map(([title,val,note])=>`<div class="kpi"><div class="kpi-label">${title}</div><strong class="kpi-number">${val}</strong><div class="kpi-detail">${note}</div></div>`).join('');$('#gov-category').value=state.govCategory;
const list=AREAS.map(a=>areaData(a,state.govCategory));$('#gov-heatmap').innerHTML=list.map(a=>`<button type="button" class="heat-cell" style="background:${colorScale(a.gap)}" data-gov-area="${a.id}"><span>${esc(a.name)}</span><b>${a.gap}</b><small>Need index / 100</small></button>`).join('');renderGovTrend(list);renderAllocation();renderOpportunity(list);renderGovInsight();}
function renderGovTrend(list){const categories=['food','housing','transport','heating','seniors'];const vals=categories.map(c=>Math.round(AREAS.reduce((s,a)=>s+areaData(a,c).unmet,0)));const max=Math.max(...vals,1);let bars=vals.map((v,i)=>{const x=55+i*87,bh=v/max*165,y=210-bh;return `<rect x="${x}" y="${y}" width="45" height="${bh}" rx="6" fill="${['#3c8e72','#5f86af','#82a2a0','#d2b182','#b099a8'][i]}"/><text x="${x+22}" y="${y-7}" text-anchor="middle" fill="#607e74" font-size="12">${v}</text><text x="${x+22}" y="230" text-anchor="middle" fill="#677e7b" font-size="10">${categories[i]}</text>`}).join('');$('#gov-trend').innerHTML=`<svg viewBox="0 0 490 250" role="img" aria-label="Synthetic unmet-request counts by category"><path d="M40 210 H485" stroke="#cad7cb"/>${bars}</svg>`}
function renderAllocation(){const cats=['food','housing','transport','heating'];$('#allocation-sliders').innerHTML=cats.map(c=>`<div class="allocation-field"><label for="alloc-${c}"><span>${categoryName(c)}</span><b id="alloc-value-${c}">${state.allocation[c]}%</b></label><input id="alloc-${c}" data-alloc="${c}" type="range" min="0" max="100" step="5" value="${state.allocation[c]}"></div>`).join('');const total=Object.values(state.allocation).reduce((a,b)=>a+b,0);const budget=100000;const isValid=total===100;$('#allocation-result').innerHTML=`<span>Allocated funding</span><strong>${dollar(budget*total/100)} / $100,000</strong><div>${isValid?'Balanced demo allocation':'Adjust the four sliders to total exactly 100%. Current total: '+total+'%.'}</div><div class="mini-divider"></div><b>Modeled service slots</b><div>${fmt(Math.round((state.allocation.food*1.2+state.allocation.housing*.7+state.allocation.transport*1.0+state.allocation.heating*.9)*9))} illustrative potential units; not confirmed residents served.</div>`}
function renderOpportunity(list){$('#opportunity-matrix').innerHTML=list.sort((a,b)=>b.gap-a.gap).slice(0,5).map(a=>`<div class="matrix-item"><div><b>${esc(a.name)}</b><br><small>${esc(categoryName(state.govCategory))} · ${fmt(a.unmet)} unmet demo pathways</small></div><div><strong>${a.gap}/100</strong><br><small>Investigation priority</small></div></div>`).join('')}
function renderGovInsight(){const category=state.govCategory;const list=AREAS.map(a=>areaData(a,category)).sort((a,b)=>b.gap-a.gap);const top=list.slice(0,3);const total=Object.values(state.allocation).reduce((s,v)=>s+v,0);$('#gov-ai-content').innerHTML=`<h4>Priority brief · ${esc(categoryName(category))}</h4><p>In the fictional regional model, the highest relative need-index areas are <b>${top.map(a=>esc(a.name)).join(', ')}</b>. Their modeled access gaps should be investigated with actual provider coverage and resident feedback.</p><ul><li>Validate service opening hours, eligibility restrictions and geographic availability.</li><li>Trial a small outreach or after-hours intervention before scaling.</li><li>Measure completed referrals and individual privacy protections.</li></ul><div class="evidence-strip">Budget allocation: ${total}%. This is a model-generated demo summary, not an actual policy assessment or LLM response.</div>`}
function renderCatalogue(){const q=($('#catalogue-search').value||'').trim().toLowerCase();const c=$('#catalogue-category').value;const list=SERVICES.filter(s=>(c==='all'||!c||s.category===c)&&`${s.title} ${s.description} ${s.category}`.toLowerCase().includes(q));$('#catalogue-cards').innerHTML=list.map(s=>`<article class="panel service-card"><div class="service-head"><div class="title-icon">${esc(s.icon)}</div><span class="service-badge">${esc(s.kind.toUpperCase())}</span></div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p><div class="authority">${esc(s.authority)} · ${esc(s.deadline)}</div><div class="service-actions"><b style="font-size:11px">${esc(s.amount)}</b><a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">Official source ↗</a></div></article>`).join('')||'<p class="empty-state">No matching records. Try another keyword or category.</p>'}
function renderEvidence(){$('#source-list').innerHTML=SOURCES.map(s=>`<div class="source-item"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a><span>${esc(s.scope)}</span></div>`).join('')}
async function enrichWithAI(mode,message,profile){const consentId=mode==='resident'?'#ai-consent':mode==='government'?'#gov-ai-consent':'#partner-ai-consent';if(!$(consentId).checked){toast('Enable AI data sharing for this view first.');return null}try{return await requestAI(mode,message,profile,SERVICES.map(s=>({name:s.title,category:s.category,description:s.description,link:s.link})))}catch(err){toast('AI unavailable: '+(err.message||'check the backend'));return null}}
function wireEvents(){$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));$('#profile-quick').addEventListener('click',()=>switchView('resident'));$('#hero-how').addEventListener('click',()=>document.querySelector('.resident-layout').scrollIntoView({behavior:'smooth'}));$('#hero-match').addEventListener('click',()=>{$('.resident-layout').scrollIntoView({behavior:'smooth'});renderMatches();toast('Your ranked plan is ready')});$('#generate-plan').addEventListener('click',()=>{renderMatches();toast('Action plan refreshed')});$('#persona').addEventListener('change',e=>{state.saved=false;selectPersona(e.target.value);$('#resident-save-status').textContent='Demo scenario loaded. Click Save to persist it locally.'});$$('[data-need]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.need;state.selectedNeed.has(id)?state.selectedNeed.delete(id):state.selectedNeed.add(id);b.classList.toggle('selected',state.selectedNeed.has(id));renderMatches()}));$$('#view-resident .control').forEach(el=>{if(el.id!=='persona')el.addEventListener(el.tagName==='TEXTAREA'||el.tagName==='INPUT'?'input':'change',renderMatches)});$('#save-resident').addEventListener('click',saveResident);$('#clear-resident').addEventListener('click',()=>{clearStore('resident');state.saved=false;state.tasks.clear();state.history=[];clearScreeningArtifacts();$('#resident-save-status').textContent='Saved data cleared from this browser.';toast('Browser profile cleared')});$('#plan-steps').addEventListener('change',e=>{if(!e.target.dataset.task)return;e.target.checked?state.tasks.add(e.target.dataset.task):state.tasks.delete(e.target.dataset.task);if(state.saved)saveResident();renderMatches()});$('#plan-download').addEventListener('click',exportPlan);
$('#screening-tasks').addEventListener('change',e=>{const id=e.target.dataset.screeningTask;if(!id||!state.screeningPlan?.tasks?.some(t=>t.id===id))return;const status=e.target.value;if(!['not-started','in-progress','completed'].includes(status))return;state.screeningTaskStatuses[id]=status;const stored=store('screening_task_statuses',state.screeningTaskStatuses);if(!stored)toast('Browser storage is blocked: progress will not survive a refresh');renderScreeningPlan()});
$('#screening-export').addEventListener('click',exportScreeningPlan);
$('#screening-explain').addEventListener('click',explainScreeningWithAI);
$('#screening-clear').addEventListener('click',()=>{clearScreeningArtifacts();toast('Fictional screening data cleared')});$('#resident-ai-profile').addEventListener('click',async()=>{const p=readResident();const text=await enrichWithAI('resident',`Prepare a short, helpful needs profile and three concrete next steps based only on this fictional resident profile: ${profileSummary(p)}. These are the matched verified entry points: ${matchesFor(p).slice(0,3).map(s=>s.title).join('; ')}.`,p);const el=$('#resident-ai-brief');if(text){el.textContent=text;el.classList.add('generative');toast('Generative profile brief created')}else{el.classList.remove('generative');el.textContent=`DEMO PROFILE BRIEF — ${profileSummary(p)} Suggested priority: ${matchesFor(p).slice(0,3).map(s=>s.title).join(', ')||'select a need'}. Next: review the official requirements, prepare documents, and keep a checklist of actions. This summary is algorithmic, not generated by an AI model.`;toast('Created a transparent profile summary') }});$('#see-partner-impact').addEventListener('click',()=>{state.selectedAreaFocus=state.resident.area;switchView('partner')});$('#chat-form').addEventListener('submit',e=>{e.preventDefault();sendChat($('#chat-input').value)});$('#chat-chips').addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b)sendChat(b.dataset.prompt)});
$('#partner-category').addEventListener('change',e=>{state.category=e.target.value;renderPartner()});$('#partner-area').addEventListener('change',e=>{state.selectedArea=e.target.value;renderPartner()});$('#map-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-map]');if(!b)return;state.mapMode=b.dataset.map;renderMap()});$('#map-reset').addEventListener('click',()=>{state.selectedArea='all';state.selectedAreaFocus=null;$('#partner-area').value='all';renderPartner();setFallbackZoom(1);state.map?.setView([44.675,-63.606],11)});$('#map-retry').addEventListener('click',retryMap);$('#map-plus').addEventListener('click',()=>setFallbackZoom(state.fallbackZoom+.45));$('#map-minus').addEventListener('click',()=>setFallbackZoom(state.fallbackZoom-.45));$('#map-schematic-reset').addEventListener('click',()=>setFallbackZoom(1));$('#ai-server-refresh').addEventListener('click',updateAIStatus);$('#fallback-map').addEventListener('click',e=>{const b=e.target.closest('[data-map-area]');if(b)selectArea(b.dataset.mapArea)});$('#fallback-map').addEventListener('keydown',e=>{if(e.key==='Enter'){const b=e.target.closest('[data-map-area]');if(b)selectArea(b.dataset.mapArea)}});$('#export-gap-csv').addEventListener('click',()=>{const rows=selectedAreaData().sort((a,b)=>b.gap-a.gap);const csv=['Area,Gap index,Requests demo,Matched demo,Unmet demo,Reachable hours,After-work hours',...rows.map(a=>[a.name,a.gap,a.requests,a.matched,a.unmet,a.reachable,a.after].join(','))].join('\n');download('LoopLogic_synthetic_area_data.csv',csv,'text/csv');toast('Synthetic area data exported')});$('#gap-table').addEventListener('click',e=>{const tr=e.target.closest('tr[data-area]');if(tr)selectArea(tr.dataset.area)});$('#view-as-resident').addEventListener('click',()=>{state.resident.area=state.selectedAreaFocus||'fairview';state.persona='custom';selectPersona('custom',true);rememberPersona();switchView('resident')});$('#pilot-options').addEventListener('click',e=>{const btn=e.target.closest('[data-pilot]');if(btn){state.pilot=btn.dataset.pilot;renderPilot();renderInsight()}});[['weeks','weeks'],['cost','cost'],['capacity','capacity']].forEach(([id,field])=>$('#'+id).addEventListener('input',e=>{state[field]=Number(e.target.value);renderPilot();renderInsight()}));$('#partner-persona').addEventListener('change',e=>selectPartnerPersona(e.target.value));$('#partner-save').addEventListener('click',()=>{const p=readPartner();state.partnerProfiles[state.partnerKey]={...p,previousPilot:state.pilot};store('partners',state.partnerProfiles);$('#partner-saved').textContent='Fictional organization profile saved in this browser.';toast('Organization profile saved locally');renderInsight()});$('#insight-prompt').addEventListener('change',renderInsight);$('#insight-generate').addEventListener('click',()=>{renderInsight();toast('Insight regenerated from demo calculations')});$('#partner-ai').addEventListener('click',async()=>{const p=readPartner();const text=await enrichWithAI('partner',`Generate a short, measured strategic recommendation for this community organization using synthetic demonstration data. Organization profile: ${p.name}, ${p.area}, focus ${p.focus[0]}, capacity ${p.capacity}.`,p);if(text){$('#ai-insight-content').textContent=text;toast('Generative partner insight created')}else{renderInsight();toast('Using deterministic insight. Optional AI server/key not active.')}});
$('#gov-category').addEventListener('change',e=>{state.govCategory=e.target.value;renderGovernment()});$('#gov-heatmap').addEventListener('click',e=>{const b=e.target.closest('[data-gov-area]');if(b){state.selectedAreaFocus=b.dataset.govArea;state.selectedArea='all';state.category=state.govCategory;switchView('partner')}});$('#allocation-sliders').addEventListener('input',e=>{if(e.target.dataset.alloc){state.allocation[e.target.dataset.alloc]=Number(e.target.value);$('#alloc-value-'+e.target.dataset.alloc).textContent=e.target.value+'%';renderAllocation();renderGovInsight()}});$('#gov-recommend').addEventListener('click',async()=>{renderGovInsight();const p={category:state.govCategory,allocation:state.allocation,areas:AREAS.map(a=>({area:a.name,gap:areaData(a,state.govCategory).gap,unmet:areaData(a,state.govCategory).unmet}))};const text=await enrichWithAI('government','Provide a concise, source-caveated synthetic-data policy brief with ranked priorities, uncertainty, and one pilot recommendation. Never claim these figures are observed real community measurements.',p);if(text){$('#gov-ai-content').textContent=text;toast('Generative policy brief created')}else{toast('Policy recommendation updated from synthetic metrics')}$('#gov-ai-content').scrollIntoView({behavior:'smooth',block:'center'})});$$('.report-button').forEach(b=>b.addEventListener('click',()=>{downloadPartnerReport();toast('Shareable report exported') }));$('#catalogue-search').addEventListener('input',renderCatalogue);$('#catalogue-category').addEventListener('change',renderCatalogue);$('#reset-demo').addEventListener('click',()=>{['resident','partners','active_persona'].forEach(clearStore);clearScreeningArtifacts();state.saved=false;state.tasks.clear();toast('All saved demo profiles cleared');$('#resident-save-status').textContent='Local saved demo records cleared.'})}
function downloadPartnerReport(){
 const k=partnerKpis();const arr=selectedAreaData().sort((a,b)=>b.gap-a.gap);
 const rows=arr.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.gap}/100</td><td>${fmt(a.requests)}</td><td>${fmt(a.matched)}</td><td>${fmt(a.unmet)}</td><td>${a.reachable}h</td><td>${a.after}h</td></tr>`).join('');
 const p=presets[state.pilot];const total=state.weeks*state.cost;const visits=state.weeks*state.capacity;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LoopLogic · Community Intelligence Brief</title><style>body{font:14px/1.55 Arial,sans-serif;max-width:950px;margin:30px auto;color:#26363c;padding:0 16px}header{border-bottom:4px solid #267f60;padding-bottom:24px}.label{font-size:10px;letter-spacing:2px;font-weight:bold;color:#227758}h1{font-size:38px;letter-spacing:-1px;margin:7px 0}h2{font-size:20px;margin-top:27px}p{color:#64766f}.warning{background:#fff3de;border-left:4px solid #d79239;padding:14px;margin:22px 0}.metrics{display:flex;gap:12px}.metric{flex:1;border:1px solid #e3e9e4;border-radius:9px;padding:16px}.metric b{font-size:26px;display:block}.metric small{color:#6b7f7c}table{width:100%;border-collapse:collapse;margin-top:15px;font-size:12px}th,td{padding:9px;border-bottom:1px solid #e4e9e4;text-align:left}th{background:#eaf2ed}footer{margin-top:32px;font-size:11px;color:#81938b}.print{background:#247f60;color:white;padding:10px 18px;border:0;border-radius:6px;cursor:pointer}@media print{.print{display:none}}</style></head><body><header><span class="label">LOOPLOGIC / ${state.view==='government'?'GOVERNMENT STUDIO':'PARTNER INTELLIGENCE'}</span><h1>Community Intelligence Brief</h1><p>${esc(categoryName(state.category==='all'?'food':state.category))} · ${esc(state.selectedArea==='all'?'All sample areas':areaName(state.selectedArea))} · ${new Date().toLocaleDateString('en-CA')}</p><button class="print" onclick="window.print()">Print / Save as PDF</button></header><div class="warning"><b>SIMULATED RESEARCH DEMO</b><br>All operational metrics, rankings, geographical scores and pilot outcomes in this brief are synthetic. They are not verified Feed Nova Scotia, HRM, Census, or Halifax Transit counts.</div><h2>Executive snapshot</h2><div class="metrics"><div class="metric"><small>Demo requests</small><b>${fmt(k.request)}</b></div><div class="metric"><small>Matched pathways</small><b>${fmt(k.match)}</b></div><div class="metric"><small>Unmet modeled pathways</small><b>${fmt(k.unmet)}</b></div></div><h2>Area comparison</h2><table><thead><tr><th>Community</th><th>Gap score</th><th>Requests</th><th>Matched</th><th>Unmet</th><th>Reachable</th><th>After work</th></tr></thead><tbody>${rows}</tbody></table><h2>Scenario: ${esc(p.title)}</h2><p>${state.weeks} weeks · ${state.capacity} modeled household visits/week · ${dollar(state.cost)} / session. Total: <b>${dollar(total)}</b> for <b>${fmt(visits)}</b> hypothetical household visits. These numbers are assumed inputs, not estimated real-world impact.</p><h2>Recommended next validation</h2><ol><li>Obtain provider-confirmed service opening hours, location, availability, and referral outcomes.</li><li>Ingest licensed transit / geography data and compute accessible trips under a documented methodology.</li><li>Run a supervised pilot and compare observed outcomes to pre-registered targets.</li></ol><footer>LoopLogic proof of concept · 2026 · Unaffiliated with government or service providers. Official reference directory: https://data-hrm.hub.arcgis.com/ · https://ns.211.ca/ · https://www.novascotia.ca/</footer></body></html>`;
 download('LoopLogic_Community_Intelligence_Report.html',html,'text/html');
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',init);
export {matchScore,matchesFor,areaData,statusFor,profileSummary};
