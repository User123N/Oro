/* ORO multi-jewelry platform layer */
(()=>{'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);
let client=null,tenant=null,platformHome=false,admin=false;
const host=()=>location.hostname.toLowerCase().replace(/^www\./,'');
async function init(sb){
 client=sb;
 const domain=host();
 try{
  const {data,error}=await client.rpc('resolve_jewelry_domain',{p_domain:domain});
  if(!error&&data&&data[0]){tenant=data[0];platformHome=false;return {tenant,platformHome:false}}
 }catch(e){}
 tenant=null;platformHome=true;
 try{const {data}=await client.from('jewelry_tenants').select('id').eq('status','active').limit(1);if(data?.length===1){} }catch(e){}
 return {tenant:null,platformHome:true};
}
async function loadTenantData(){
 if(!tenant)return null;
 const {data,error}=await client.from('jewelry_store_data').select('data_key,data').eq('tenant_id',tenant.tenant_id);
 if(error)throw error;
 const out={};(data||[]).forEach(r=>out[r.data_key]=r.data);return out;
}
async function saveTenantData(values){
 if(!tenant)throw new Error('Este dominio todavía no está vinculado a una joyería.');
 const rows=['settings','products','collections'].map(k=>({tenant_id:tenant.tenant_id,data_key:k,data:values[k]}));
 const {error}=await client.from('jewelry_store_data').upsert(rows,{onConflict:'tenant_id,data_key'});
 if(error)throw error;
}
function card(t){return '<a class="market-card" href="'+(t.domain?'https://'+esc(t.domain):'javascript:void(0)')+'"><div class="market-logo">'+(t.logo_url?'<img src="'+esc(t.logo_url)+'" alt="">':'<span>✦</span>')+'</div><div class="market-card-copy"><small>'+esc(t.city||'JOYERÍA')+'</small><h3>'+esc(t.brand_name||t.name)+'</h3><p>'+esc(t.description||'Descubre su catálogo y colecciones.')+'</p><span>Visitar tienda <b>↗</b></span></div></a>'}
async function renderHome(){
 const root=document.querySelector('#app');if(!root)return;
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
async function renderAdmin(){
 const root=document.querySelector('#app');if(!root)return;
 const {data:{session}}=await client.auth.getSession();
 if(!session){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><span class="market-eyebrow">ORO · CONTROL CENTRAL</span><h1>Panel maestro</h1><p>Inicia sesión con la cuenta administradora de la plataforma.</p><form id="platformLogin"><input name="email" type="email" placeholder="Correo administrador" required><input name="password" type="password" placeholder="Contraseña" required><button class="platform-primary">Entrar al panel</button><p id="platformMsg" role="status"></p></form></div></section>';root.querySelector('#platformLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){root.querySelector('#platformMsg').textContent='No se pudo iniciar sesión.';return}renderAdmin()};return}
 if(!await isAdmin()){root.innerHTML='<section class="platform-admin"><div class="platform-panel"><h1>Acceso restringido</h1><p>Esta cuenta no tiene permisos de administrador de la plataforma.</p><button class="platform-secondary" id="logout">Cerrar sesión</button></div></section>';root.querySelector('#logout').onclick=()=>client.auth.signOut().then(()=>renderAdmin());return}
 const {data:stores,error}=await client.from('jewelry_tenants').select('*').order('created_at',{ascending:false});
 const {data:domains}=await client.from('jewelry_domains').select('*');
 const domainMap={};(domains||[]).forEach(d=>domainMap[d.tenant_id]=d.domain);
 root.innerHTML='<section class="platform-admin"><div class="platform-wrap"><header class="platform-head"><div><span class="market-eyebrow">ORO · SUPERADMIN</span><h1>Centro de joyerías</h1><p>Administra negocios, propietarios y dominios desde un solo lugar.</p></div><button id="platformLogout" class="platform-secondary">Cerrar sesión</button></header><div class="platform-stats"><article><small>Joyerías</small><b>'+(stores||[]).length+'</b></article><article><small>Activas</small><b>'+(stores||[]).filter(x=>x.status==='active').length+'</b></article><article><small>Con dominio</small><b>'+(domains||[]).length+'</b></article></div><div class="platform-columns"><form id="createJewelry" class="platform-panel"><span class="market-eyebrow">NUEVO NEGOCIO</span><h2>Agregar joyería</h2><label>Nombre comercial<input name="name" required placeholder="Ej. Joyería SGarcía"></label><label>Nombre de marca<input name="brand" required placeholder="Marca visible"></label><label>Identificador URL<input name="slug" required pattern="[a-z0-9-]+" placeholder="joyeria-sgarcia"></label><label>Correo del propietario<input name="owner" type="email" required placeholder="propietario@correo.com"></label><label>Ciudad<input name="city" placeholder="Ciudad, país"></label><label>Descripción<textarea name="description" rows="3" placeholder="Presentación breve"></textarea></label><label>Dominio propio (opcional)<input name="domain" placeholder="www.mimarca.com"></label><button class="platform-primary">Crear joyería</button><p id="createMsg" role="status"></p></form><div class="platform-panel"><span class="market-eyebrow">DIRECTORIO</span><h2>Joyerías registradas</h2><div class="platform-store-list">'+((stores||[]).map(t=>'<article class="platform-store"><div><b>'+esc(t.brand_name)+'</b><small>'+esc(t.slug)+' · '+esc(t.owner_email)+'</small><small>'+esc(domainMap[t.id]||'Sin dominio vinculado')+'</small></div><select data-status="'+t.id+'"><option value="active" '+(t.status==='active'?'selected':'')+'>Activa</option><option value="suspended" '+(t.status==='suspended'?'selected':'')+'>Suspendida</option><option value="draft" '+(t.status==='draft'?'selected':'')+'>Borrador</option></select><button class="platform-secondary" data-verify="'+t.id+'" data-domain="'+(domainMap[t.id]||'')+'">Verificar dominio</button><button class="platform-danger" data-delete="'+t.id+'">Eliminar</button></article>').join('')||'<p>Aún no hay joyerías.</p>')+'</div></div></div><aside class="platform-note"><b>Dominios:</b> el dominio debe existir y apuntar al hosting. La asociación queda pendiente de verificación DNS; no se marca como activo hasta verificarlo.</aside></div></section>';
 if(error){root.querySelector('.platform-store-list').textContent='No se pudo cargar el listado.';return}
 root.querySelector('#platformLogout').onclick=()=>client.auth.signOut().then(()=>renderAdmin());
 root.querySelector('#createJewelry').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),slug=slugify(f.get('slug'));const payload={slug,name:f.get('name').trim(),brand_name:f.get('brand').trim(),owner_email:f.get('owner').trim().toLowerCase(),city:f.get('city').trim(),description:f.get('description').trim(),status:'active'};const {data,error}=await client.from('jewelry_tenants').insert(payload).select().single();if(error){root.querySelector('#createMsg').textContent='No se pudo crear: '+error.message;return}if((stores||[]).length===0){const {data:legacy}=await client.from('store').select('*');const allowed=(legacy||[]).filter(x=>['settings','products','collections'].includes(x.id)).map(x=>({tenant_id:data.id,data_key:x.id,data:x.data}));if(allowed.length){const {error:copyError}=await client.from('jewelry_store_data').upsert(allowed,{onConflict:'tenant_id,data_key'});if(copyError){root.querySelector('#createMsg').textContent='Joyería creada, pero la importación inicial requiere revisión: '+copyError.message;return}}}const domain=String(f.get('domain')||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/$/,'');if(domain){const {error:de}=await client.from('jewelry_domains').insert({tenant_id:data.id,domain,verified:false,is_primary:true});if(de){root.querySelector('#createMsg').textContent='Joyería creada; el dominio no se pudo asociar: '+de.message;return}}root.querySelector('#createMsg').textContent='Joyería creada correctamente. El propietario ya puede iniciar sesión con su correo tras registrarse en Supabase Auth.';e.target.reset();renderAdmin()};
 root.querySelectorAll('[data-status]').forEach(el=>el.onchange=async()=>{const {error}=await client.from('jewelry_tenants').update({status:el.value,updated_at:new Date().toISOString()}).eq('id',el.dataset.status);if(error)alert('No se pudo cambiar el estado: '+error.message)});
 root.querySelectorAll('[data-verify]').forEach(el=>el.onclick=async()=>{const domain=el.dataset.domain;if(!domain){alert('Primero agrega un dominio para esta joyería.');return}if(!confirm('Confirma que '+domain+' ya apunta a Netlify y que el certificado HTTPS está listo.'))return;const {error}=await client.from('jewelry_domains').update({verified:true}).eq('tenant_id',el.dataset.verify).eq('domain',domain);if(error){alert('No se pudo verificar: '+error.message);return}renderAdmin()});
 root.querySelectorAll('[data-delete]').forEach(el=>el.onclick=async()=>{if(!confirm('¿Eliminar esta joyería y sus datos? Esta acción no se puede deshacer.'))return;const {error}=await client.from('jewelry_tenants').delete().eq('id',el.dataset.delete);if(error){alert('No se pudo eliminar: '+error.message);return}renderAdmin()});
}
window.OroPlatform={init,loadTenantData,saveTenantData,get tenant(){return tenant},get platformHome(){return platformHome},renderHome,renderAdmin};
})();