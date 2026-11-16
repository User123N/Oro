/* ORO multi-jewelry platform layer */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);
let client=null,tenant=null,platformHome=false,admin=false;
const host=()=>location.hostname.toLowerCase();
const rootDomain=()=>String(window.ORO_ROOT_DOMAIN||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'');
const tenantSubdomain=slug=>rootDomain()?slug+'.'+rootDomain():'';
async function init(sb){
 client=sb;
 const domain=host();
 try{
  const {data,error}=await client.rpc('resolve_jewelry_domain',{p_domain:domain});
  if(error)return {tenant:null,platformHome:false,legacy:true};
  if(data&&data[0]){tenant=data[0];platformHome=false;return {tenant,platformHome:false}}
  const root=rootDomain();
  if(root&&domain.endsWith('.'+root)){const candidate=domain.slice(0,-root.length-1).split('.')[0];if(candidate&&await openTenantBySlug(candidate))return {tenant,platformHome:false}}
 }catch(e){return {tenant:null,platformHome:false,legacy:true}}
 tenant=null;platformHome=true;
 try{const {data}=await client.from('jewelry_tenants').select('id').eq('status','active').limit(1);if(data?.length===1){} }catch(e){}
 return {tenant:null,platformHome:true};
}
async function openTenantBySlug(slug){
 const {data,error}=await client.from('jewelry_tenants').select('id,slug,name,brand_name,description,logo_url,city,status').eq('slug',slug).eq('status','active').maybeSingle();
 if(error)throw error;
 if(!data)return false;
 tenant={...data,tenant_id:data.id};platformHome=false;return true;
}
async function loadTenantData(){
 if(!tenant)return null;
 const {data,error}=await client.from('jewelry_store_data').select('data_key,data').eq('tenant_id',tenant.tenant_id);
 if(error)throw error;
 const out={};(data||[]).forEach(r=>out[r.data_key]=r.data);
 return out;
}
async function saveTenantData(values){
 if(!tenant)throw new Error('Este dominio todavía no está vinculado a una joyería.');
 const rows=['settings','products','collections'].map(k=>({tenant_id:tenant.tenant_id,data_key:k,data:values[k]}));
 const {error}=await client.from('jewelry_store_data').upsert(rows,{onConflict:'tenant_id,data_key'});
 if(error)throw error;
}
function card(t){const tag='a',href=t.domain?' href="https://'+esc(t.domain)+'"':' href="#/joyeria/'+esc(t.slug)+'"';return '<'+tag+' class="market-card"'+href+'><div class="market-logo">'+(t.logo_url?'<img src="'+esc(t.logo_url)+'" alt="">':'<span>✦</span>')+'</div><div class="market-card-copy"><small>'+esc(t.city||'JOYERÍA')+'</small><h3>'+esc(t.brand_name||t.name)+'</h3><p>'+esc(t.description||'Descubre su catálogo y colecciones.')+'</p><span>Visitar tienda <b>↗</b></span></div></'+tag+'>'}
async function renderHome(){
 const root=document.querySelector('#app');if(!root)return;
 document.querySelector('#hd').innerHTML='<header class="market-header"><a href="#/" class="market-brand">ORO<span>✦</span></a><nav><a href="#/">Joyerías</a><a href="#/plataforma">Administrar</a></nav></header>';
 document.querySelector('#ft').innerHTML='<footer class="market-footer"><div class="market-wrap"><b>ORO · MARKETPLACE</b><span>Un espacio para cada joyería.</span><a href="#/plataforma">Centro de administración ↗</a></div></footer>';
 root.innerHTML='<section class="market-hero"><div class="market-orb"></div><div class="market-wrap"><span class="market-eyebrow">ORO · MARKETPLACE</span><h1>Un universo de<br><em>joyerías.</em></h1><p>Descubre marcas, colecciones y piezas únicas. Cada joyería tiene su propio espacio.</p><div class="market-search"><input id="marketSearch" type="search" placeholder="Buscar una joyería o ciudad…"></div><div id="marketGrid" class="market-grid"><p>Cargando joyerías…</p></div></div></section>';
 try{
  const {data,error}=await client.from('jewelry_tenants').select('id,slug,name,brand_name,description,logo_url,city').eq('status','active').order('created_at',{ascending:false});
  if(error)throw error;
  const {data:domains}=await client.from('jewelry_domains').select('tenant_id,domain').eq('verified',true);
  const domainMap={};(domains||[]).forEach(d=>domainMap[d.tenant_id]=d.domain);
  const grid=document.querySelector('#marketGrid'),render=(q='')=>{const list=(data||[]).filter(t=>(t.brand_name+' '+t.name+' '+t.city+' '+t.description).toLowerCase().includes(q.toLowerCase())).map(t=>({...t,domain:domainMap[t.id]}));grid.innerHTML=list.length?list.map(t=>card(t)).join(''):'<p class="market-empty">Todavía no hay joyerías publicadas.</p>'};
  render();document.querySelector('#marketSearch')?.addEventListener('input',e=>render(e.target.value));
 }catch(e){document.querySelector('#marketGrid').innerHTML='<p class="market-empty">No se pudo cargar el directorio. Comprueba que la migración multi-joyería esté instalada en Supabase.</p>'}
}
async function isAdmin(){
 const {data:{user}}=await client.auth.getUser();if(!user)return false;
 const {data,error}=await client.from('platform_admins').select('email').eq('email',user.email).maybeSingle();
 admin=!error&&!!data;return admin;
}

function renderBillingPanel(root,stores,billingMap,payments){
 const panel=document.createElement('section');
 panel.className='platform-panel oro-billing';
 panel.style.marginTop='20px';
 panel.innerHTML='<span class="market-eyebrow">ORO · FACTURACIÓN</span><h2>Pagos iniciales y mensualidades</h2><p>Control comercial manual de cada catálogo.</p>'+((stores||[]).map(t=>{
  const b=billingMap[t.id]||{};
  const history=(payments||[]).filter(p=>p.tenant_id===t.id).slice(0,3);
  return '<article class="oro-billing-row"><div class="oro-billing-title"><b>'+esc(t.brand_name||t.name)+'</b><small>Estado: '+esc(b.billing_status||'sin configurar')+' · Vence: '+esc(b.next_due_at||'sin fecha')+'</small></div><div class="oro-billing-fields"><label>Pago inicial<input type="number" min="0" step="1000" data-setup="'+t.id+'" value="'+Number(b.setup_fee||0)+'"></label><label>Mensualidad<input type="number" min="0" step="1000" data-monthly="'+t.id+'" value="'+Number(b.monthly_fee||0)+'"></label><label>Próximo vencimiento<input type="date" data-due="'+t.id+'" value="'+esc(b.next_due_at||'')+'"></label><label>Estado comercial<select data-bill-status="'+t.id+'"><option value="pending" '+(b.billing_status==='pending'?'selected':'')+'>Pendiente</option><option value="active" '+(b.billing_status==='active'?'selected':'')+'>Activo</option><option value="past_due" '+(b.billing_status==='past_due'?'selected':'')+'>Vencido</option><option value="grace" '+(b.billing_status==='grace'?'selected':'')+'>Gracia</option><option value="suspended" '+(b.billing_status==='suspended'?'selected':'')+'>Suspendido</option><option value="cancelled" '+(b.billing_status==='cancelled'?'selected':'')+'>Cancelado</option></select></label></div><button class="platform-secondary" data-save-billing="'+t.id+'">Guardar condiciones</button><div class="oro-payment-entry"><select data-payment-type="'+t.id+'"><option value="setup">Pago inicial</option><option value="monthly">Mensualidad</option></select><input type="number" min="1" step="1000" placeholder="Valor recibido (COP)" data-payment-amount="'+t.id+'"><input type="text" placeholder="Nota o referencia" data-payment-note="'+t.id+'"><button class="platform-primary" data-record-payment="'+t.id+'">Registrar pago</button></div><div class="oro-payment-history">'+(history.length?history.map(p=>'<small>'+esc(p.payment_type==='setup'?'Inicial':'Mensualidad')+' · '+new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(p.amount))+' · '+new Date(p.paid_at).toLocaleDateString('es-CO')+'</small>').join(''):'<small>Sin pagos registrados.</small>')+'</div></article>';
 }).join('')||'<p>Aún no hay joyerías.</p>');
 root.querySelector('.platform-wrap')?.appendChild(panel);
 panel.querySelectorAll('[data-save-billing]').forEach(btn=>btn.onclick=async()=>{
  const id=btn.dataset.saveBilling;
  const payload={tenant_id:id,setup_fee:Math.max(0,Number(panel.querySelector('[data-setup="'+id+'"]').value||0)),monthly_fee:Math.max(0,Number(panel.querySelector('[data-monthly="'+id+'"]').value||0)),next_due_at:panel.querySelector('[data-due="'+id+'"]').value||null,billing_status:panel.querySelector('[data-bill-status="'+id+'"]').value,updated_at:new Date().toISOString()};
  const {error}=await client.from('jewelry_billing').upsert(payload,{onConflict:'tenant_id'});
  if(error){alert('No se pudieron guardar las condiciones: '+error.message);return}
  if(payload.billing_status==='suspended'||payload.billing_status==='active'){const {error:tenantError}=await client.from('jewelry_tenants').update({status:payload.billing_status,updated_at:new Date().toISOString()}).eq('id',id);if(tenantError){alert('Condiciones guardadas, pero no se actualizó el estado del catálogo: '+tenantError.message);return}}
  alert('Condiciones comerciales guardadas.');
 });
 panel.querySelectorAll('[data-record-payment]').forEach(btn=>btn.onclick=async()=>{
  const id=btn.dataset.recordPayment,type=panel.querySelector('[data-payment-type="'+id+'"]').value,amount=Number(panel.querySelector('[data-payment-amount="'+id+'"]').value),note=panel.querySelector('[data-payment-note="'+id+'"]').value.trim();
  if(!Number.isFinite(amount)||amount<=0){alert('Introduce un valor de pago válido.');return}
  const now=new Date(),today=now.toISOString().slice(0,10),end=new Date(now);
  end.setMonth(end.getMonth()+1);
  const {error}=await client.from('jewelry_payments').insert({tenant_id:id,payment_type:type,amount,paid_at:now.toISOString(),period_start:type==='monthly'?today:null,period_end:type==='monthly'?end.toISOString().slice(0,10):null,note});
  if(error){alert('No se pudo registrar el pago: '+error.message);return}
  if(type==='monthly'||type==='setup'){
   const {error:billingError}=await client.from('jewelry_billing').update({billing_status:'active',next_due_at:end.toISOString().slice(0,10),updated_at:now.toISOString()}).eq('tenant_id',id);
   if(billingError){alert('Pago registrado, pero no se actualizó el vencimiento: '+billingError.message);return}
   const {error:tenantError}=await client.from('jewelry_tenants').update({status:'active',updated_at:now.toISOString()}).eq('id',id);
   if(tenantError){alert('Pago registrado, pero no se reactivó el catálogo: '+tenantError.message);return}
  }
  alert('Pago registrado correctamente.');
  renderAdmin();
 });
}

async function renderAdmin(){
 const root=document.querySelector('#app');if(!root)return;
 const {data:{session}}=await client.auth.getSession();
 if(!session){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><span class="market-eyebrow">ORO · CONTROL CENTRAL</span><h1>Panel maestro</h1><p>Inicia sesión o crea tu cuenta de acceso.</p><form id="platformLogin"><h2>Iniciar sesión</h2><input name="email" type="email" placeholder="Tu correo" autocomplete="email" required><input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" required><button class="platform-primary">Entrar</button><p id="platformMsg" role="status"></p></form><form id="platformSignup"><h2>Crear cuenta</h2><input name="email" type="email" placeholder="Tu correo" autocomplete="email" required><input name="password" type="password" minlength="8" placeholder="Crea una contraseña (8+ caracteres)" autocomplete="new-password" required><button class="platform-secondary">Registrarme</button><p id="signupMsg" role="status"></p></form></div></section>';root.querySelector('#platformLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){root.querySelector('#platformMsg').textContent='No se pudo iniciar sesión. Revisa tus datos.';return}renderAdmin()};root.querySelector('#platformSignup').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await client.auth.signUp({email:f.get('email'),password:f.get('password')});if(error){root.querySelector('#signupMsg').textContent='No se pudo crear la cuenta: '+error.message;return}if(data.session){root.querySelector('#signupMsg').textContent='Cuenta creada. Abriendo configuración…';renderAdmin()}else{root.querySelector('#signupMsg').textContent='Cuenta creada. Confirma el correo que te envió Supabase y después inicia sesión.'}};return}
 if(!await isAdmin()){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><span class="market-eyebrow">PRIMER ACCESO</span><h1>Activar administrador principal</h1><p>Esta cuenta todavía no tiene permisos. Si estás configurando ORO por primera vez, introduce la clave de activación de un solo uso.</p><form id="platformBootstrap"><input name="token" type="password" autocomplete="off" placeholder="Clave de activación" required><button class="platform-primary">Activar mi cuenta</button><p id="bootstrapMsg" role="status"></p></form><button class="platform-secondary" id="logout">Cerrar sesión</button></div></section>';root.querySelector('#platformBootstrap').onsubmit=async e=>{e.preventDefault();const token=new FormData(e.target).get('token');const {error}=await client.rpc('claim_platform_admin',{p_token:token});if(error){root.querySelector('#bootstrapMsg').textContent='No se pudo activar: '+error.message;return}root.querySelector('#bootstrapMsg').textContent='Administrador activado.';renderAdmin()};root.querySelector('#logout').onclick=()=>client.auth.signOut().then(()=>renderAdmin());return}
 const {data:stores,error}=await client.from('jewelry_tenants').select('*').order('created_at',{ascending:false});
 const {data:domains}=await client.from('jewelry_domains').select('*');
 const {data:owners}=await client.from('jewelry_tenant_owners').select('tenant_id,owner_email');
 const {data:billing}=await client.from('jewelry_billing').select('*');
 const {data:payments}=await client.from('jewelry_payments').select('*').order('paid_at',{ascending:false}).limit(100);
 const billingMap={};(billing||[]).forEach(b=>billingMap[b.tenant_id]=b);
 const domainMap={},ownerMap={};(domains||[]).forEach(d=>domainMap[d.tenant_id]=d.domain);(owners||[]).forEach(o=>ownerMap[o.tenant_id]=o.owner_email);
 root.innerHTML='<section class="platform-admin"><div class="platform-wrap"><header class="platform-head"><div><span class="market-eyebrow">ORO · SUPERADMIN</span><h1>Centro de joyerías</h1><p>Administra negocios, propietarios y dominios desde un solo lugar.</p></div><button id="platformLogout" class="platform-secondary">Cerrar sesión</button></header><div class="platform-stats"><article><small>Joyerías</small><b>'+(stores||[]).length+'</b></article><article><small>Catálogos activos</small><b>'+(stores||[]).filter(x=>x.status==='active').length+'</b></article><article><small>Mensualidad potencial</small><b>'+new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Object.values(billingMap).reduce((sum,b)=>sum+Number(b.monthly_fee||0),0))+'</b></article><article><small>Pagos pendientes</small><b>'+(billing||[]).filter(b=>['pending','past_due','grace'].includes(b.billing_status)).length+'</b></article></div><div class="platform-columns"><form id="createJewelry" class="platform-panel"><span class="market-eyebrow">NUEVO NEGOCIO</span><h2>Agregar joyería</h2><label>Nombre comercial<input name="name" required placeholder="Ej. Joyería SGarcía"></label><label>Nombre de marca<input name="brand" required placeholder="Marca visible"></label><label>Identificador URL<input name="slug" required pattern="[a-z0-9-]+" placeholder="joyeria-sgarcia"></label><label>Correo del propietario<input name="owner" type="email" required placeholder="propietario@correo.com"></label><label>Ciudad<input name="city" placeholder="Ciudad, país"></label><label>Descripción<textarea name="description" rows="3" placeholder="Presentación breve"></textarea></label><label>Pago inicial (COP)<input name="setup_fee" type="number" min="0" step="1000" value="0" required></label><label>Mensualidad (COP)<input name="monthly_fee" type="number" min="0" step="1000" value="0" required></label><label>Formato del subdominio<input value="'+esc(rootDomain()?'slug.'+rootDomain():'Configura ORO_ROOT_DOMAIN en Vercel')+'" disabled></label><button class="platform-primary">Crear joyería</button><p id="createMsg" role="status"></p></form><div class="platform-panel"><span class="market-eyebrow">DIRECTORIO</span><h2>Joyerías registradas</h2><div class="platform-store-list">'+((stores||[]).map(t=>'<article class="platform-store"><div><b>'+esc(t.brand_name)+'</b><small>'+esc(t.slug)+' · '+esc(ownerMap[t.id]||'Propietario sin asignar')+'</small><small>'+esc(domainMap[t.id]||'Sin dominio vinculado')+'</small><input data-domain-input="'+t.id+'" placeholder="nuevo-dominio.com" aria-label="Dominio de la joyería"></div><select data-status="'+t.id+'"><option value="active" '+(t.status==='active'?'selected':'')+'>Activa</option><option value="suspended" '+(t.status==='suspended'?'selected':'')+'>Suspendida</option><option value="draft" '+(t.status==='draft'?'selected':'')+'>Borrador</option></select><button class="platform-secondary" data-add-domain="'+t.id+'">Guardar dominio</button><button class="platform-secondary" data-verify="'+t.id+'" data-domain="'+(domainMap[t.id]||'')+'">Verificar dominio</button><button class="platform-danger" data-delete="'+t.id+'">Eliminar</button></article>').join('')||'<p>Aún no hay joyerías.</p>')+'</div></div></div><aside class="platform-note"><b>Dominios:</b> el dominio debe existir y apuntar al hosting. La asociación queda pendiente de verificación DNS; no se marca como activo hasta verificarlo.</aside></div></section>';
 renderBillingPanel(root,stores,billingMap,payments);
 if(error){root.querySelector('.platform-store-list').textContent='No se pudo cargar el listado.';return}
 root.querySelector('#platformLogout').onclick=()=>client.auth.signOut().then(()=>renderAdmin());
 root.querySelector('#createJewelry').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),slug=slugify(f.get('slug'));const payload={slug,name:f.get('name').trim(),brand_name:f.get('brand').trim(),city:f.get('city').trim(),description:f.get('description').trim(),status:'draft'};const {data,error}=await client.from('jewelry_tenants').insert(payload).select().single();if(error){root.querySelector('#createMsg').textContent='No se pudo crear: '+error.message;return}const {error:ownerError}=await client.from('jewelry_tenant_owners').insert({tenant_id:data.id,owner_email:f.get('owner').trim().toLowerCase()});if(ownerError){root.querySelector('#createMsg').textContent='Joyería creada, pero no se pudo guardar el propietario: '+ownerError.message;return}const setupFee=Math.max(0,Number(f.get('setup_fee')||0)),monthlyFee=Math.max(0,Number(f.get('monthly_fee')||0));const due=new Date();due.setDate(due.getDate()+30);const {error:billingError}=await client.from('jewelry_billing').upsert({tenant_id:data.id,setup_fee:setupFee,monthly_fee:monthlyFee,contracted_at:new Date().toISOString().slice(0,10),next_due_at:due.toISOString().slice(0,10),billing_status:'pending'},{onConflict:'tenant_id'});if(billingError){root.querySelector('#createMsg').textContent='Joyería y propietario creados, pero falta aplicar la migración comercial 002: '+billingError.message;return}const subdomain=tenantSubdomain(slug);if(subdomain){const {error:domainError}=await client.from('jewelry_domains').upsert({tenant_id:data.id,domain:subdomain,verified:false,is_primary:true},{onConflict:'domain'});if(domainError){root.querySelector('#createMsg').textContent='Joyería creada, pero no se pudo registrar el subdominio: '+domainError.message;return}}if((stores||[]).length===0&&/sgarcia/i.test(payload.slug+' '+payload.name+' '+payload.brand)){let allowed=[];try{const {data:legacy,error:legacyError}=await client.from('store').select('*');if(!legacyError&&Array.isArray(legacy))allowed=legacy.filter(x=>['settings','products','collections'].includes(x.id)).map(x=>({tenant_id:data.id,data_key:x.id,data:x.data}))}catch(e){}if(!allowed.length){try{const cached=[['settings','au_s'],['products','au_p'],['collections','au_c']];allowed=cached.map(([data_key,key])=>{const raw=localStorage.getItem(key);if(!raw)return null;try{return {tenant_id:data.id,data_key,data:JSON.parse(raw)}}catch(e){return null}}).filter(Boolean)}catch(e){}}if(allowed.length){const {error:copyError}=await client.from('jewelry_store_data').upsert(allowed,{onConflict:'tenant_id,data_key'});if(copyError){root.querySelector('#createMsg').textContent='Joyería creada, pero la importación inicial requiere revisión: '+copyError.message;return}}}root.querySelector('#createMsg').textContent='Joyería creada correctamente'+(subdomain?'. Subdominio pendiente de verificación: '+subdomain:'. Configura ORO_ROOT_DOMAIN en Vercel para asignar el subdominio')+'. El propietario ya puede iniciar sesión con su cuenta de Supabase Auth.';e.target.reset();renderAdmin()};
 root.querySelectorAll('[data-status]').forEach(el=>el.onchange=async()=>{const {error}=await client.from('jewelry_tenants').update({status:el.value,updated_at:new Date().toISOString()}).eq('id',el.dataset.status);if(error)alert('No se pudo cambiar el estado: '+error.message)});
 root.querySelectorAll('[data-add-domain]').forEach(el=>el.onclick=async()=>{const field=root.querySelector('[data-domain-input="'+el.dataset.addDomain+'"]');const domain=String(field?.value||'').trim().toLowerCase().replace('https://','').replace('http://','').split('/').join('');if(!domain){alert('Escribe el dominio primero.');return}const {error}=await client.from('jewelry_domains').insert({tenant_id:el.dataset.addDomain,domain,verified:false,is_primary:true});if(error){alert('No se pudo guardar el dominio: '+error.message);return}renderAdmin()});
 root.querySelectorAll('[data-verify]').forEach(el=>el.onclick=async()=>{const domain=el.dataset.domain;if(!domain){alert('Primero agrega un dominio para esta joyería.');return}if(!confirm('Confirma que '+domain+' ya apunta a Vercel, el wildcard DNS está configurado y HTTPS está listo.'))return;const {error}=await client.from('jewelry_domains').update({verified:true}).eq('tenant_id',el.dataset.verify).eq('domain',domain);if(error){alert('No se pudo verificar: '+error.message);return}renderAdmin()});
 root.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async()=>{if(!confirm('¿Eliminar esta joyería y sus datos? Esta acción no se puede deshacer.'))return;const {error}=await client.from('jewelry_tenants').delete().eq('id',el.dataset.delete);if(error){alert('No se pudo eliminar: '+error.message);return}renderAdmin()});
}

async function renderOwnerAdmin(){
 const root=document.querySelector('#app');if(!root)return;
 const {data:{session}}=await client.auth.getSession();
 if(!session){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><span class="market-eyebrow">ORO · TU JOYERÍA</span><h1>Administrar tienda</h1><p>Inicia sesión con el correo que el superadministrador asignó a tu joyería.</p><form id="ownerLogin"><label>Correo<input name="email" type="email" required autocomplete="email"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><button class="platform-primary">Entrar</button><p id="ownerMsg" role="status"></p></form></div></section>';root.querySelector('#ownerLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){root.querySelector('#ownerMsg').textContent='No se pudo iniciar sesión. Verifica tus datos.';return}renderOwnerAdmin()};return}
 const email=String(session.user.email||'').toLowerCase();
 const {data:assignments,error}=await client.from('jewelry_tenant_owners').select('tenant_id,owner_email').eq('owner_email',email);
 if(error){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><h1>No se pudo cargar tu acceso</h1><p>'+esc(error.message)+'</p></div></section>';return}
 const ids=(assignments||[]).map(x=>x.tenant_id);
 if(!ids.length){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><span class="market-eyebrow">ORO · ACCESO</span><h1>Aún no tienes una joyería asignada</h1><p>Solicita al superadministrador que registre tu correo como propietario.</p><button class="platform-secondary" id="ownerLogout">Cerrar sesión</button></div></section>';root.querySelector('#ownerLogout').onclick=()=>client.auth.signOut().then(()=>renderOwnerAdmin());return}
 const {data:stores, error:storeError}=await client.from('jewelry_tenants').select('id,slug,name,brand_name,status').in('id',ids);
 if(storeError){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><h1>Error</h1><p>'+esc(storeError.message)+'</p></div></section>';return}
 let selected=(stores||[])[0];
 const render=async()=>{
  const {data:rows,error:dataError}=await client.from('jewelry_store_data').select('data_key,data').eq('tenant_id',selected.id);
  if(dataError){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><h1>No se pudieron cargar los datos</h1><p>'+esc(dataError.message)+'</p></div></section>';return}
  const values={settings:{},products:[],collections:[]};(rows||[]).forEach(x=>values[x.data_key]=x.data);
  root.innerHTML='<section class="platform-admin"><div class="platform-wrap"><header class="platform-head"><div><span class="market-eyebrow">ORO · PANEL DE JOYERÍA</span><h1>'+esc(selected.brand_name||selected.name)+'</h1><p>Administra únicamente la información pública de tu tienda.</p></div><button id="ownerLogout" class="platform-secondary">Cerrar sesión</button></header><div class="owner-toolbar"><label>Mi joyería<select id="ownerStore">'+(stores||[]).map(t=>'<option value="'+t.id+'" '+(t.id===selected.id?'selected':'')+'>'+esc(t.brand_name||t.name)+'</option>').join('')+'</select></label><a class="platform-secondary" href="'+(tenantSubdomain(selected.slug)?'https://'+esc(tenantSubdomain(selected.slug)):'#/joyeria/'+esc(selected.slug))+'" target="_blank" rel="noopener">Ver catálogo ↗</a></div><nav class="oro-owner-tabs" aria-label="Navegación del panel"><button class="active" data-owner-view="overview">Inicio</button><button data-owner-view="products">Productos</button><button data-owner-view="categories">Categorías</button><button data-owner-view="settings">Diseño y configuración</button></nav><section class="platform-panel oro-owner-home" data-owner-panel="overview"><span class="market-eyebrow">RESUMEN</span><h2>Tu joyería, en un solo lugar</h2><p>Gestiona el catálogo, organiza tus categorías y mantén actualizada la identidad de tu marca.</p><div class="oro-owner-metrics"><article><small>Productos</small><b>'+values.products.length+'</b></article><article><small>Categorías</small><b>'+values.collections.length+'</b></article><article><small>Estado del catálogo</small><b>'+esc(selected.status==='active'?'Activo':selected.status==='pending'?'Pendiente':'Suspendido')+'</b></article></div><div class="oro-owner-shortcuts"><button data-owner-view="products">Gestionar productos ↗</button><button data-owner-view="categories">Organizar categorías ↗</button><button data-owner-view="settings">Editar identidad ↗</button></div></section><div class="owner-grid"><article class="platform-panel" data-owner-panel="products"><span class="market-eyebrow">CATÁLOGO</span><h2>Productos</h2><p>Gestiona nombres, precios, descripciones e imágenes desde el catálogo.</p><textarea id="ownerProducts" rows="14" spellcheck="false">'+esc(JSON.stringify(values.products,null,2))+'</textarea></article><article class="platform-panel" data-owner-panel="categories"><span class="market-eyebrow">ORGANIZACIÓN</span><h2>Categorías</h2><p>En este sistema se guardan como colecciones de la tienda.</p><textarea id="ownerCategories" rows="14" spellcheck="false">'+esc(JSON.stringify(values.collections,null,2))+'</textarea></article><article class="platform-panel owner-settings" data-owner-panel="settings"><span class="market-eyebrow">IDENTIDAD</span><h2>Configuración de tienda</h2><p>Nombre, contacto, colores, textos e identidad visual.</p><textarea id="ownerSettings" rows="14" spellcheck="false">'+esc(JSON.stringify(values.settings,null,2))+'</textarea></article></div><div class="owner-save"><button id="ownerSave" class="platform-primary">Guardar cambios</button><p id="ownerSaveMsg" role="status"></p></div></div></section>';
  const showOwnerView=(view)=>{root.querySelectorAll('[data-owner-panel]').forEach(panel=>{panel.hidden=panel.dataset.ownerPanel!==view});root.querySelectorAll('[data-owner-view]').forEach(button=>button.classList.toggle('active',button.dataset.ownerView===view));};
  root.querySelectorAll('[data-owner-view]').forEach(button=>button.onclick=()=>showOwnerView(button.dataset.ownerView));
  showOwnerView('overview');
  root.querySelector('#ownerLogout').onclick=()=>client.auth.signOut().then(()=>renderOwnerAdmin());
  root.querySelector('#ownerStore')?.addEventListener('change',async e=>{selected=(stores||[]).find(t=>t.id===e.target.value)||selected;await render()});
  root.querySelector('#ownerSave').onclick=async()=>{
   const msg=root.querySelector('#ownerSaveMsg');
   try{
    const products=JSON.parse(root.querySelector('#ownerProducts').value);
    const collections=JSON.parse(root.querySelector('#ownerCategories').value);
    const settings=JSON.parse(root.querySelector('#ownerSettings').value);
    if(!Array.isArray(products)||!Array.isArray(collections)||!settings||Array.isArray(settings)||typeof settings!=='object')throw new Error('Productos y categorías deben ser listas JSON; configuración debe ser un objeto JSON.');
    const payload=[{tenant_id:selected.id,data_key:'products',data:products},{tenant_id:selected.id,data_key:'collections',data:collections},{tenant_id:selected.id,data_key:'settings',data:settings}];
    const {error:saveError}=await client.from('jewelry_store_data').upsert(payload,{onConflict:'tenant_id,data_key'});
    if(saveError)throw saveError;
    msg.textContent='Cambios guardados correctamente.';
   }catch(err){msg.textContent='No se pudo guardar: '+(err.message||'revisa el contenido JSON.')}
  };
 };
 await render();
}

window.OroPlatform={init,openTenantBySlug,loadTenantData,saveTenantData,renderOwnerAdmin,get tenant(){return tenant},get platformHome(){return platformHome},renderHome,renderAdmin};
})();