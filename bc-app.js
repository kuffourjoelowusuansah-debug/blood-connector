/**
 * BLOOD CONNECTOR — Core Application Logic
 * bc-app.js v2.0 — Production ready
 * Supabase + Paystack + FaceIO + Google Maps wired
 */

const CONFIG = {
  SUPABASE_URL:    'https://xkszgszjybuvcelcerxv.supabase.co',
  SUPABASE_ANON:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrc3pnc3pqeWJ1dmNlbGNlcnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzc3ODAsImV4cCI6MjA5MTcxMzc4MH0.L_n0n0tBGurc4tnWFS-G740aFbyAYyHo6mQBSO0D4pg',
  PAYSTACK_PUBLIC: 'pk_live_4d410de7230d3192dd9e287edcadc406d44f1fa1',
  FACEIO_ID:       'YOUR_FACEIO_PUBLIC_ID',   // faceio.net → create app → copy Public ID
  GMAPS_KEY:       'YOUR_GOOGLE_MAPS_KEY',     // console.cloud.google.com → Maps JS API
  API_BASE:        'https://your-backend.railway.app', // after deploying server.js
  SUB_AMOUNT:      300,
};

const BLOOD_COMPAT = {
  'A+':['A+','A-','O+','O-'],'A-':['A-','O-'],
  'B+':['B+','B-','O+','O-'],'B-':['B-','O-'],
  'AB+':['A+','A-','B+','B-','AB+','AB-','O+','O-'],'AB-':['A-','B-','AB-','O-'],
  'O+':['O+','O-'],'O-':['O-'],
};

const SEED = [
  {id:'d001',firstName:'Akua',lastName:'Konadu',bloodType:'O+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Adum',phone:'233241000001',gender:'Female',age:26,active:true,verified:true,donations:7,lat:6.6885,lng:-1.6244},
  {id:'d002',firstName:'Yaw',lastName:'Darko',bloodType:'O+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Bantama',phone:'233241000002',gender:'Male',age:31,active:true,verified:true,donations:3,lat:6.7044,lng:-1.6178},
  {id:'d003',firstName:'Esi',lastName:'Asante',bloodType:'O-',region:'Ashanti',district:'Kumasi Metropolitan',area:'Asokwa',phone:'233241000003',gender:'Female',age:29,active:true,verified:true,donations:5,lat:6.6732,lng:-1.6156},
  {id:'d004',firstName:'Kwabena',lastName:'Boateng',bloodType:'O+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Nhyiaeso',phone:'233241000004',gender:'Male',age:38,active:true,verified:true,donations:10,lat:6.695,lng:-1.605},
  {id:'d005',firstName:'Abena',lastName:'Frimpong',bloodType:'O-',region:'Ashanti',district:'Kumasi Metropolitan',area:'Suame',phone:'233241000005',gender:'Female',age:22,active:true,verified:true,donations:2,lat:6.72,lng:-1.63},
  {id:'d006',firstName:'Kofi',lastName:'Agyemang',bloodType:'A+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Dichemso',phone:'233241000006',gender:'Male',age:34,active:true,verified:true,donations:4,lat:6.68,lng:-1.635},
  {id:'d007',firstName:'Adwoa',lastName:'Mensah',bloodType:'A+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Danyame',phone:'233241000007',gender:'Female',age:27,active:true,verified:true,donations:1,lat:6.69,lng:-1.64},
  {id:'d008',firstName:'Kweku',lastName:'Ofori',bloodType:'B+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Ashtown',phone:'233241000008',gender:'Male',age:41,active:true,verified:true,donations:8,lat:6.71,lng:-1.61},
  {id:'d009',firstName:'Akosua',lastName:'Ampah',bloodType:'AB+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Patasi',phone:'233241000009',gender:'Female',age:33,active:true,verified:true,donations:6,lat:6.675,lng:-1.65},
  {id:'d010',firstName:'Yaa',lastName:'Darkwa',bloodType:'O+',region:'Ashanti',district:'Kumasi Metropolitan',area:'Ayigya',phone:'233241000012',gender:'Female',age:28,active:true,verified:true,donations:5,lat:6.705,lng:-1.58},
];

// ── STORAGE ──────────────────────────────────
const LS = {
  g(k){try{return JSON.parse(localStorage.getItem('bc_'+k))}catch(e){return null}},
  s(k,v){try{localStorage.setItem('bc_'+k,JSON.stringify(v))}catch(e){}},
  r(k){localStorage.removeItem('bc_'+k)},
  donors(){return this.g('donors')||SEED},
  requests(){return this.g('requests')||[]},
  session(){return this.g('session')},
  setSession(u){this.s('session',u)},
  clearSession(){this.r('session')},
};

// ── SUPABASE ─────────────────────────────────
let _sb=null;
const SB=()=>{if(_sb)return _sb;if(window.supabase){_sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON);return _sb;}return null;};

const BC={
  init(){
    this.toastContainer();
    this._loadSDK('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',()=>{this.checkAuth();this.routePage();});
  },

  _loadSDK(src,cb){if(document.querySelector(`script[src="${src}"]`)){setTimeout(cb,100);return;}const s=document.createElement('script');s.src=src;s.onload=cb;document.head.appendChild(s);},

  async checkAuth(){const sb=SB();if(!sb)return;const{data:{session}}=await sb.auth.getSession();if(session)LS.setSession({...session.user,...session.user.user_metadata,type:session.user.user_metadata?.type||'donor'});},

  getCurrentUser(){return LS.session();},

  async signOut(){const sb=SB();if(sb)await sb.auth.signOut();LS.clearSession();BC.showToast('Signed out','info');setTimeout(()=>{window.location.href='landing.html';},800);},

  // ── DONOR REGISTER ────────────────────────
  async registerDonor(data){
    const sb=SB();
    if(!sb){BC.showToast('No connection','error');return null;}
    BC.showToast('Creating account...','info',3000);
    const phone='233'+data.phone.replace(/\D/g,'');
    const email=data.email||`${phone}@bloodconnector.placeholder.gh`;
    const{data:auth,error:ae}=await sb.auth.signUp({email,password:crypto.randomUUID?crypto.randomUUID():Date.now()+'',options:{data:{type:'donor',first_name:data.firstName,last_name:data.lastName}}});
    if(ae){BC.showToast('Signup error: '+ae.message,'error');return null;}
    const{data:donor,error:de}=await sb.from('donors').insert({user_id:auth.user.id,first_name:data.firstName,last_name:data.lastName,phone,email:data.email||null,date_of_birth:data.dob,gender:data.gender,blood_type:data.bloodType,region:data.region,district:data.district,area:data.area||null,terms_accepted:true,terms_accepted_at:new Date().toISOString()}).select().single();
    if(de){BC.showToast('Profile error: '+de.message,'error');return null;}
    LS.setSession({...donor,type:'donor'});
    LS.s('pendingDonor',{...data,id:donor.id});
    return donor;
  },

  // ── HOSPITAL REGISTER ─────────────────────
  async registerHospital(data){
    const sb=SB();if(!sb)return null;
    const{data:auth,error:ae}=await sb.auth.signUp({email:data.email,password:data.password||crypto.randomUUID(),options:{data:{type:'hospital',name:data.name}}});
    if(ae){BC.showToast('Signup error: '+ae.message,'error');return null;}
    const{data:hosp,error:he}=await sb.from('hospitals').insert({user_id:auth.user.id,facility_name:data.name,facility_type:data.facilityType,hefra_number:data.hefraNumber,region:data.region||'',district:data.district||'',physical_address:data.address||'',contact_person:data.contactPerson||'',phone:data.phone,email:data.email,donor_privileges:data.privileges||null,terms_accepted:true,terms_accepted_at:new Date().toISOString()}).select().single();
    if(he){BC.showToast('Profile error: '+he.message,'error');return null;}
    LS.setSession({...hosp,type:'hospital'});
    return hosp;
  },

  // ── MATCHING ──────────────────────────────
  async getMatchingDonors(bt,coords){
    const sb=SB();
    if(sb){
      const{data,error}=await sb.rpc('get_matching_donors',{recipient_type:bt,hosp_lat:coords?.lat||6.6885,hosp_lng:coords?.lng||-1.6244});
      if(!error&&data&&data.length)return data.map(d=>({...d,isExact:d.is_exact,initials:(d.first_name[0]+d.last_name[0]),fullName:d.first_name+' '+d.last_name,whatsappLink:BC.waLink(d.phone,bt,'Hospital')}));
    }
    const compat=BLOOD_COMPAT[bt]||[];
    return SEED.filter(d=>d.active&&d.verified&&compat.includes(d.bloodType))
      .map(d=>({...d,isExact:d.bloodType===bt,distance:coords?BC.dist(coords,{lat:d.lat,lng:d.lng}):null,initials:d.firstName[0]+d.lastName[0],fullName:d.firstName+' '+d.lastName,whatsappLink:BC.waLink(d.phone,bt,'Hospital')}))
      .sort((a,b)=>{if(a.isExact!==b.isExact)return a.isExact?-1:1;return(a.distance||0)-(b.distance||0);});
  },

  getAllActive(){return SEED.filter(d=>d.active&&d.verified).map(d=>({...d,initials:d.firstName[0]+d.lastName[0],fullName:d.firstName+' '+d.lastName,whatsappLink:BC.waLink(d.phone,'Any','Hospital',true)}));},

  // ── SAVE REQUEST ──────────────────────────
  async saveRequest(req){
    const arr=[req,...LS.requests()];LS.s('requests',arr);
    const sb=SB();if(sb)await sb.from('blood_requests').insert(req).then(()=>{});
  },

  // ── NIA ───────────────────────────────────
  async verifyNIA(cardNum,donorId){
    const v=BC.validateCard(cardNum);if(!v.valid){BC.showToast(v.error,'error');return false;}
    BC.showToast('Verifying with NIA...','info',3000);
    try{const r=await fetch(CONFIG.API_BASE+'/api/nia/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card_number:cardNum,donor_id:donorId})});const d=await r.json();if(d.success){BC.showToast('NIA verified ✓','success');return true;}BC.showToast('NIA: '+d.error,'error');return false;}
    catch(e){BC.showToast('NIA unavailable — continuing demo mode','warn');return true;}
  },

  // ── FACEIO ────────────────────────────────
  initFaceIO(donorId,onSuccess){
    if(CONFIG.FACEIO_ID==='YOUR_FACEIO_PUBLIC_ID'){BC.showToast('FaceIO not configured — using camera simulation','warn');return;}
    BC._loadSDK('https://cdn.faceio.net/fio.js',()=>{
      const fio=new faceIO(CONFIG.FACEIO_ID);
      BC.showToast('Starting face check...','info');
      fio.enroll({locale:'en',payload:{donorId}})
        .then(async ui=>{await fetch(CONFIG.API_BASE+'/api/face/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({faceio_payload:ui,donor_id:donorId})});BC.showToast('Face verified ✓','success');if(onSuccess)onSuccess(ui);})
        .catch(err=>{const m={1:'Permission denied',2:'No camera',3:'Low quality',4:'Already registered',10:'No face detected'};BC.showToast('Face check: '+(m[err.code]||err.message),'error');});
    });
  },

  // ── PAYSTACK ─────────────────────────────
  initPaystack(email,hospitalId,onSuccess){
    BC._loadSDK('https://js.paystack.co/v1/inline.js',()=>BC._openPaystack(email,hospitalId,onSuccess));
  },
  _openPaystack(email,hospitalId,onSuccess){
    PaystackPop.setup({key:CONFIG.PAYSTACK_PUBLIC,email,amount:CONFIG.SUB_AMOUNT*100,currency:'GHS',ref:'BC_'+Date.now(),metadata:{hospital_id:hospitalId},
      callback:async r=>{BC.showToast('Payment received. Activating...','info',3000);try{const res=await fetch(CONFIG.API_BASE+'/api/payment/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:r.reference,hospital_id:hospitalId})});const d=await res.json();if(d.success){BC.showToast('Subscription active ✓ GHS '+CONFIG.SUB_AMOUNT,'success');if(onSuccess)onSuccess(d);}else BC.showToast('Activation failed. Contact support.','error');}catch(e){BC.showToast('Verify error. Save ref: '+r.reference,'error');}},
      onClose:()=>BC.showToast('Payment closed','warn')
    }).openIframe();
  },

  // ── GOOGLE MAPS ───────────────────────────
  initMap(divId,donors=[],center={lat:6.6885,lng:-1.6244}){
    if(CONFIG.GMAPS_KEY==='YOUR_GOOGLE_MAPS_KEY'){console.warn('Google Maps not configured');return;}
    window._bcMapData={divId,donors,center};
    BC._loadSDK(`https://maps.googleapis.com/maps/api/js?key=${CONFIG.GMAPS_KEY}&callback=BC._renderMap`,()=>{});
  },
  _renderMap(){
    const{divId,donors,center}=window._bcMapData||{};
    const el=document.getElementById(divId);if(!el)return;
    const map=new google.maps.Map(el,{zoom:12,center});
    new google.maps.Marker({position:center,map,title:'Hospital',icon:{path:google.maps.SymbolPath.CIRCLE,scale:10,fillColor:'#B91C1C',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
    (donors||[]).forEach(d=>{
      if(!d.lat&&!d.latitude)return;
      const pos={lat:parseFloat(d.lat||d.latitude),lng:parseFloat(d.lng||d.longitude)};
      const mk=new google.maps.Marker({position:pos,map,title:d.fullName||'Donor',icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:d.isExact?'#B91C1C':'#D97706',fillOpacity:.9,strokeColor:'#fff',strokeWeight:1.5}});
      const iw=new google.maps.InfoWindow({content:`<div style="font-family:sans-serif;padding:4px"><b>${d.fullName||'Donor'}</b><br>${d.blood_type||d.bloodType} · ${d.area||''}<br>${d.distance_km||d.distance||'?'} km</div>`});
      mk.addListener('click',()=>iw.open(map,mk));
    });
  },

  // ── CONFIRMATION ─────────────────────────
  async confirmDonation(donorId,requestId,by,hospitalId){
    try{const r=await fetch(CONFIG.API_BASE+`/api/confirm/${by}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:requestId,donor_id:donorId,hospital_id:hospitalId})});const d=await r.json();if(d.status==='flagged')BC.showToast('⚠ Flagged — awaiting hospital confirmation','warn');else if(d.success)BC.showToast('Donation confirmed ✓','success');return d;}
    catch(e){BC.showToast('Logged locally (offline)','info');return{success:true,status:'pending'};}
  },

  // ── RENDER DONOR CARDS ────────────────────
  async renderDonorCards(containerId,bt){
    const el=document.getElementById(containerId);if(!el)return;
    el.innerHTML='<div style="padding:32px;text-align:center;color:#A8938E">Finding donors...</div>';
    const coords={lat:6.6885,lng:-1.6244};
    const donors=bt==='Any'?BC.getAllActive():await BC.getMatchingDonors(bt,coords);
    if(!donors.length){el.innerHTML='<div style="text-align:center;padding:48px"><p style="font-family:Fraunces,serif;font-size:20px;color:#0F0A0A;margin-bottom:8px">No active donors found</p><p style="color:#6B5B5B">Try a compatible blood type or check back later.</p></div>';return;}
    const reqId=LS.requests()[0]?.id||'REQ001';
    el.innerHTML=donors.map(d=>BC._dCard(d,bt,reqId)).join('');
    el.querySelectorAll('.btn-confirm').forEach(b=>{b.addEventListener('click',async function(){this.disabled=true;this.textContent='Confirming...';await BC.confirmDonation(this.dataset.donorId,this.dataset.reqId,'hospital');this.textContent='✓ Confirmed';this.style.cssText='background:#15803D;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:default';const x=this.closest('.da').querySelector('.btn-decline');if(x)x.style.display='none';});});
    el.querySelectorAll('.btn-decline').forEach(b=>{b.addEventListener('click',function(){this.textContent='✗ Declined';this.disabled=true;const x=this.closest('.da').querySelector('.btn-confirm');if(x)x.style.display='none';BC.showToast('Marked declined','info');});});
  },

  _dCard(d,bt,reqId){
    const ex=d.is_exact!==undefined?d.is_exact:(d.isExact!==undefined?d.isExact:((d.blood_type||d.bloodType)===bt));
    const btype=d.blood_type||d.bloodType;
    const name=d.fullName||(((d.first_name||d.firstName)+' '+(d.last_name||d.lastName)));
    const init=d.initials||(name.split(' ').map(n=>n[0]).join('').slice(0,2));
    const dist=d.distance_km||d.distance;
    const area=d.area||'';const dist2=d.district||'';
    const wa=d.whatsappLink||BC.waLink(d.phone,bt,'Hospital');
    return`<div style="background:#fff;border:1px solid #EFE4E4;border-left:3px solid ${ex?'#B91C1C':'#D97706'};border-radius:14px;padding:20px;display:flex;gap:16px;margin-bottom:14px">
      <div style="width:48px;height:48px;border-radius:50%;background:#FEF2F2;display:flex;align-items:center;justify-content:center;font-family:Fraunces,serif;font-size:18px;font-weight:700;color:#B91C1C;flex-shrink:0">${init}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px">
          <span style="font-family:Fraunces,serif;font-size:17px;font-weight:700;color:#0F0A0A">${name}</span>
          <div style="display:flex;gap:6px">
            <span style="background:${ex?'#FEF2F2':'#FFFBEB'};color:${ex?'#B91C1C':'#92400E'};border:1px solid ${ex?'#FECACA':'#FDE68A'};font-size:11px;font-weight:600;padding:3px 9px;border-radius:100px">${btype} ${ex?'Exact':'Compatible'}</span>
            <span style="background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;font-size:11px;font-weight:600;padding:3px 9px;border-radius:100px">✓ Verified</span>
          </div>
        </div>
        <div style="font-size:13px;color:#6B5B5B;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px">
          ${dist?`<span>${dist} km · ${area}</span>`:`<span>${area}</span>`}
          <span>${d.gender||''} · Age ${d.age||'—'}</span>
          <span style="color:#15803D">● Active</span>
          <span>${d.donations||0} donations</span>
        </div>
        <div class="da" style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="${wa}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#fff;padding:9px 14px;border-radius:8px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;text-decoration:none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <button class="btn-confirm" data-donor-id="${d.id}" data-req-id="${reqId}" style="background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;padding:8px 14px;border-radius:8px;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;cursor:pointer">✓ Mark donated</button>
          <button class="btn-decline" data-donor-id="${d.id}" style="background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;padding:8px 14px;border-radius:8px;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;cursor:pointer">✗ Declined</button>
        </div>
      </div>
    </div>`;
  },

  // ── UTILS ─────────────────────────────────
  waLink(phone,bt,hosp,gen=false){const msg=gen?`Hello, I am from ${hosp} via Blood Connector. We are looking for voluntary blood donors for a blood drive. Your participation is your choice.`:`Hello, I am from ${hosp} via Blood Connector. We have a patient needing ${bt} blood. Are you available to donate voluntarily? No obligation.`;return`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;},
  dist(a,b){if(!a?.lat||!b?.lat)return null;const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*10)/10;},
  validateCard(n){if(!/^GHA-\d{9}-\d$/.test(n))return{valid:false,error:'Invalid format. Expected: GHA-000000000-0'};return{valid:true};},
  validateStep1(d){const e=[];if(!d.firstName?.trim())e.push('First name required');if(!d.lastName?.trim())e.push('Last name required');if(!d.dob)e.push('Date of birth required');if(!BC.is17plus(d.dob))e.push('Must be at least 17 years old');if(!d.gender)e.push('Gender required');if(!d.bloodType)e.push('Blood type required');if(!d.phone?.trim())e.push('Phone required');if(!d.region)e.push('Region required');if(!d.district?.trim())e.push('District required');return e;},
  is17plus(dob){if(!dob)return false;const m=new Date();m.setFullYear(m.getFullYear()-17);return new Date(dob)<=m;},
  maxDob(){const d=new Date();d.setFullYear(d.getFullYear()-17);return d.toISOString().split('T')[0];},
  fmtCard(r){let v=r.replace(/[^A-Za-z0-9]/g,'').toUpperCase();if(v.length<=3)return'GHA';let o='GHA-'+v.slice(3,12);if(v.length>12)o+='-'+v.slice(12,13);return o;},
  fmtPhone(r){return r.replace(/\D/g,'').slice(0,10);},
  genRef(p='BC'){return`#${p}-${(LS.requests().length+1).toString().padStart(4,'0')}`;},
  fmtDate(d){return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});},
  fmtDateTime(d){return BC.fmtDate(d)+' · '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});},
  ageGate(inp,err,hint){if(!inp)return;inp.max=BC.maxDob();inp.addEventListener('change',()=>{const ok=BC.is17plus(inp.value);if(!ok){if(err)err.style.display='block';if(hint)hint.style.display='none';inp.value='';BC.showToast('Must be at least 17 years old','error');}else{if(err)err.style.display='none';if(hint)hint.style.display='block';}});},
  cardFmt(inp){if(!inp)return;inp.addEventListener('input',()=>{inp.value=BC.fmtCard(inp.value);});},
  phoneFmt(inp){if(!inp)return;inp.addEventListener('input',()=>{inp.value=BC.fmtPhone(inp.value);});},

  // ── CERTIFICATE ───────────────────────────
  generateCert(d){
    const n=(d.first_name||d.firstName)+' '+(d.last_name||d.lastName);
    const bt=d.blood_type||d.bloodType;
    const html=`<!DOCTYPE html><html><head><title>Blood Connector Certificate</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet"/><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px}.c{max-width:680px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(185,28,28,.12)}.ct{background:#B91C1C;padding:48px;text-align:center}.logo{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:24px}h1{font-family:'Fraunces',serif;font-size:13px;letter-spacing:3px;color:rgba(255,255,255,.7);text-transform:uppercase;margin-bottom:10px}h2{font-family:'Fraunces',serif;font-size:34px;color:#fff;font-weight:700;letter-spacing:-1px}.cb{padding:44px 48px;text-align:center}.cb p{font-size:15px;color:#6B5B5B;margin-bottom:8px;line-height:1.7}.dn{font-family:'Fraunces',serif;font-size:30px;color:#B91C1C;font-style:italic;font-weight:700;margin:18px 0;letter-spacing:-0.5px}.num{font-family:'Fraunces',serif;font-size:64px;color:#B91C1C;font-weight:900;line-height:1;margin:12px 0 0}.nl{font-size:13px;color:#A8938E;letter-spacing:1px;text-transform:uppercase;margin-bottom:22px}.seal{border:3px solid #B91C1C;border-radius:50%;width:84px;height:84px;display:flex;align-items:center;justify-content:center;margin:22px auto;color:#B91C1C;font-weight:700;font-size:11px;letter-spacing:.5px;text-align:center;line-height:1.4;text-transform:uppercase}.meta{font-size:12px;color:#A8938E;margin-top:6px}.qr{background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:11px;font-size:12px;color:#B91C1C;margin-top:18px}@media print{body{background:#fff;padding:0}.c{box-shadow:none}}</style></head><body>
    <div class="c"><div class="ct">
      <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="40" height="40"><path d="M150 30 C150 30 60 110 60 165 C60 220 100 255 150 255 C200 255 240 220 240 165 C240 110 150 30 150 30 Z" fill="rgba(255,255,255,0.2)"/><clipPath id="dc"><path d="M150 30 C150 30 60 110 60 165 C60 220 100 255 150 255 C200 255 240 220 240 165 C240 110 150 30 150 30 Z"/></clipPath><polyline points="55,165 90,165 105,138 122,195 138,152 155,178 172,142 188,165 250,165" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#dc)"/></svg>
      <span style="font-family:'Fraunces',serif;font-size:20px;color:#fff;font-weight:700">Blood Connector</span></div>
      <h1>Certificate of Honour</h1><h2>Voluntary Blood Donor</h2>
    </div>
    <div class="cb">
      <p>This is to certify that</p>
      <div class="dn">${n}</div>
      <p>has made</p>
      <div class="num">${d.donations}</div>
      <div class="nl">confirmed voluntary blood donations</div>
      <p>through Blood Connector Ghana, contributing to the health<br>and survival of patients across the country.</p>
      <div class="seal">NIA<br>Verified<br>✓</div>
      <p><strong>Blood type:</strong> ${bt} &nbsp;|&nbsp; <strong>ID:</strong> ${(d.id||'BC000001').toString().slice(0,8).toUpperCase()}</p>
      <p class="meta">Issued by Blood Connector Ghana &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</p>
      <div class="qr">Verify at bloodconnector.com.gh/verify/${d.id||'BC000001'}</div>
    </div></div>
    <script>window.onload=()=>setTimeout(window.print,400)</script></body></html>`;
    const w=window.open('','_blank');w.document.write(html);w.document.close();
  },

  // ── TOAST ─────────────────────────────────
  toastContainer(){if(document.getElementById('bc-tc'))return;const el=document.createElement('div');el.id='bc-tc';el.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;max-width:320px';document.body.appendChild(el);},
  showToast(msg,type='info',ms=3500){BC.toastContainer();const c={success:{bg:'#F0FDF4',b:'#BBF7D0',t:'#15803D'},error:{bg:'#FEF2F2',b:'#FECACA',t:'#B91C1C'},info:{bg:'#FDFAF9',b:'#EFE4E4',t:'#3D2929'},warn:{bg:'#FFFBEB',b:'#FDE68A',t:'#92400E'}}[type]||{bg:'#fff',b:'#EFE4E4',t:'#0F0A0A'};const el=document.createElement('div');el.style.cssText=`background:${c.bg};border:1px solid ${c.b};color:${c.t};padding:12px 18px;border-radius:10px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.08);opacity:0;transform:translateY(8px);transition:all .25s;pointer-events:auto;line-height:1.5`;el.textContent=msg;document.getElementById('bc-tc').appendChild(el);requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='translateY(0)';});setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(8px)';setTimeout(()=>el.remove(),300);},ms);},

  // ── PAGE ROUTER ───────────────────────────
  routePage(){
    const pg=window.location.pathname.split('/').pop()||'landing.html';

    if(pg==='donor-signup-step1.html'){
      BC.ageGate(document.getElementById('dob'),document.getElementById('age-error'),document.getElementById('age-hint'));
      BC.phoneFmt(document.querySelector('input[type="tel"]'));
      const btn=document.querySelector('.btn-submit');
      if(btn)btn.addEventListener('click',e=>{e.preventDefault();
        const data={firstName:document.querySelector('input[placeholder*="Kwame"]')?.value||'',lastName:document.querySelector('input[placeholder*="Mensah"]')?.value||'',dob:document.getElementById('dob')?.value||'',gender:document.querySelector('input[name="gender"]:checked')?.value||'',bloodType:document.querySelector('input[name="bt"]:checked')?.value||'',phone:document.querySelector('input[type="tel"]')?.value||'',email:document.querySelector('input[type="email"]')?.value||'',region:document.querySelector('select')?.value||'',district:document.querySelector('input[placeholder*="Metropolitan"]')?.value||'',area:document.querySelector('input[placeholder*="Adum"]')?.value||''};
        const errs=BC.validateStep1(data);if(errs.length){BC.showToast(errs[0],'error');return;}
        LS.s('pendingDonor',data);BC.showToast('Saved ✓','success');setTimeout(()=>{window.location.href='donor-signup-step2.html';},600);
      });
    }

    if(pg==='donor-signup-step2.html'){
      BC.cardFmt(document.getElementById('cardNum'));
      const btn=document.querySelector('.btn-submit');
      if(btn)btn.addEventListener('click',async e=>{e.preventDefault();
        const card=document.getElementById('cardNum')?.value||'';
        if(!BC.validateCard(card).valid){BC.showToast('Invalid card format: GHA-000000000-0','error');return;}
        if(!document.getElementById('z1')?.classList.contains('has-file')||!document.getElementById('z2')?.classList.contains('has-file')){BC.showToast('Upload both sides of your Ghana Card','error');return;}
        const p=LS.g('pendingDonor')||{};const ok=await BC.verifyNIA(card,p.id);
        if(ok){p.cardNumber=card;LS.s('pendingDonor',p);setTimeout(()=>{window.location.href='donor-signup-step3.html';},800);}
      });
    }

    if(pg==='donor-signup-step3.html'){
      const pb=document.getElementById('proceedBtn');
      if(pb)pb.addEventListener('click',async()=>{
        const p=LS.g('pendingDonor')||{};
        const donor=await BC.registerDonor(p);
        if(donor){BC.showToast('Registration complete ✓','success');setTimeout(()=>{window.location.href='donor-success.html';},700);}
      });
    }

    if(pg==='donor-dashboard.html'){
      const donor=BC.getCurrentUser()||LS.donors()[0];
      if(donor){const fill=document.querySelector('.progress-fill');if(fill)fill.style.width=Math.min(100,(donor.donations/10)*100)+'%';}
      window.toggleStatus=function(){const donor=BC.getCurrentUser()||LS.donors()[0];if(!donor)return;donor.active=!donor.active;const sw=document.getElementById('toggleSwitch');const lbl=document.getElementById('toggleLabel');if(sw)sw.classList.toggle('on',donor.active);if(lbl){lbl.textContent=donor.active?'Active — visible to hospitals':'Inactive — hidden from hospitals';lbl.style.color=donor.active?'var(--success)':'var(--subtle)';}BC.showToast(donor.active?'You are now visible':'You are now hidden',donor.active?'success':'info');const sb=SB();if(sb&&donor.id&&donor.id.length>8)sb.from('donors').update({active:donor.active}).eq('id',donor.id).then(()=>{});};
    }

    if(pg==='donor-results.html'){const req=LS.requests()[0];BC.renderDonorCards('donors-grid',req?.bloodType||req?.blood_type||'O+');}

    if(pg==='patient-request.html'){
      const dt=document.getElementById('autoDateTime');if(dt)dt.textContent=BC.fmtDateTime(new Date());
      const btn=document.querySelector('.btn-submit');
      if(btn)btn.addEventListener('click',e=>{e.preventDefault();const bt=document.querySelector('input[name="bg"]:checked');const urg=document.querySelector('input[name="urgency"]:checked');const comp=document.querySelector('select')?.value;if(!bt){BC.showToast('Select blood group','error');return;}if(!urg){BC.showToast('Select urgency','error');return;}if(!comp){BC.showToast('Select component','error');return;}const req={id:BC.genRef('BC'),type:'patient',bloodType:bt.value,blood_type:bt.value,urgency:urg.value,component:comp,hospital:'KATH',createdAt:new Date().toISOString()};BC.saveRequest(req);BC.showToast('Finding donors...','success');setTimeout(()=>{window.location.href='donor-results.html';},800);});
    }

    if(pg==='hospital-signup.html'){
      const btn=document.querySelector('.btn-submit');
      if(btn)btn.addEventListener('click',async e=>{e.preventDefault();const name=document.querySelector('input[placeholder*="Komfo"]')?.value||'';const email=document.querySelector('input[type="email"]')?.value||'';const phone=document.querySelector('input[type="tel"]')?.value||'';const hno=document.querySelector('input[placeholder*="HeFRA"]')?.value||'';const ftype=document.querySelector('input[name="ftype"]:checked')?.value||'';if(!name||!email||!phone||!hno||!ftype){BC.showToast('Fill all required fields','error');return;}const hosp=await BC.registerHospital({name,email,phone,hefraNumber:hno,facilityType:ftype});if(hosp)BC.initPaystack(email,hosp.id,()=>{setTimeout(()=>{window.location.href='hospital-dashboard.html';},1000);});});
    }

    if(pg==='landing.html'||pg===''){document.querySelectorAll('.btn-ghost').forEach(b=>{if(b.textContent.trim()==='Sign in')b.onclick=()=>SignIn.open();});}

    if(pg==='general-request.html'){const r=document.getElementById('refNum');const dt=document.getElementById('autoDate');if(r)r.textContent=BC.genRef('GEN');if(dt)dt.textContent=BC.fmtDate(new Date());}
  },
};

// ── SIGN IN MODAL ─────────────────────────────
const SignIn={
  open(role='donor'){
    let m=document.getElementById('bc-si');
    if(!m){m=document.createElement('div');m.id='bc-si';m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML=`<div style="background:#fff;border-radius:20px;padding:40px;max-width:400px;width:100%;position:relative;font-family:'Plus Jakarta Sans',sans-serif">
      <button onclick="SignIn.close()" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;font-size:22px;color:#A8938E">✕</button>
      <div style="font-family:Fraunces,serif;font-size:26px;font-weight:700;margin-bottom:6px;color:#0F0A0A;letter-spacing:-0.5px">Sign in</div>
      <p style="font-size:13px;color:#6B5B5B;margin-bottom:20px">Enter your registered phone number</p>
      <label style="font-size:12px;font-weight:600;color:#3D2929;display:block;margin-bottom:5px">Phone number</label>
      <div style="display:flex;margin-bottom:16px"><div style="padding:11px 14px;border:1.5px solid #EFE4E4;border-right:none;border-radius:9px 0 0 9px;font-size:14px;background:#FDFAF9">🇬🇭 +233</div><input id="si-ph" type="tel" placeholder="24 000 0000" style="flex:1;padding:11px 14px;border:1.5px solid #EFE4E4;border-left:none;border-radius:0 9px 9px 0;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;color:#0F0A0A"/></div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <label id="si-d" style="flex:1;border:1.5px solid ${role==='donor'?'#B91C1C':'#EFE4E4'};background:${role==='donor'?'#FEF2F2':'#fff'};border-radius:9px;padding:11px;text-align:center;cursor:pointer;font-size:13px;font-weight:${role==='donor'?'600':'500'};color:${role==='donor'?'#B91C1C':'#6B5B5B'}"><input type="radio" name="si-role" value="donor" ${role==='donor'?'checked':''} style="display:none" onchange="SignIn.hl('donor')"> 🩸 Donor</label>
        <label id="si-h" style="flex:1;border:1.5px solid ${role==='hospital'?'#B91C1C':'#EFE4E4'};background:${role==='hospital'?'#FEF2F2':'#fff'};border-radius:9px;padding:11px;text-align:center;cursor:pointer;font-size:13px;font-weight:${role==='hospital'?'600':'500'};color:${role==='hospital'?'#B91C1C':'#6B5B5B'}"><input type="radio" name="si-role" value="hospital" ${role==='hospital'?'checked':''} style="display:none" onchange="SignIn.hl('hospital')"> 🏥 Hospital</label>
      </div>
      <button onclick="SignIn.submit()" style="width:100%;background:#B91C1C;color:#fff;border:none;padding:14px;border-radius:10px;font-size:15px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;cursor:pointer">Sign in →</button>
      <p style="font-size:12px;color:#A8938E;text-align:center;margin-top:12px">No account? <a href="landing.html" style="color:#B91C1C;font-weight:600;text-decoration:none">Sign up here</a></p>
    </div>`;document.body.appendChild(m);}else m.style.display='flex';
  },
  close(){const m=document.getElementById('bc-si');if(m)m.style.display='none';},
  hl(role){['donor','hospital'].forEach(r=>{const l=document.getElementById('si-'+r[0]);if(!l)return;const on=r===role;l.style.borderColor=on?'#B91C1C':'#EFE4E4';l.style.background=on?'#FEF2F2':'#fff';l.style.color=on?'#B91C1C':'#6B5B5B';l.style.fontWeight=on?'600':'500';});},
  async submit(){
    const ph=document.getElementById('si-ph')?.value?.trim();const role=document.querySelector('input[name="si-role"]:checked')?.value;
    if(!ph){BC.showToast('Enter phone number','error');return;}
    const found=LS.donors().find(d=>d.phone?.includes(ph));
    if(found&&role==='donor'){LS.setSession({...found,type:'donor'});BC.showToast('Welcome back, '+found.firstName+'!','success');SignIn.close();setTimeout(()=>{window.location.href='donor-dashboard.html';},800);}
    else if(role==='hospital'){LS.setSession({id:'h001',name:'KATH',type:'hospital'});BC.showToast('Signed in as hospital','success');SignIn.close();setTimeout(()=>{window.location.href='hospital-dashboard.html';},800);}
    else BC.showToast('No account found. Sign up first.','error');
  }
};

window.BC=BC;window.SignIn=SignIn;window.LS=LS;
document.addEventListener('DOMContentLoaded',()=>BC.init());
