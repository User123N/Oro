/* ORO — single application router. Legacy storefront and legacy admin UI removed. */
(()=>{'use strict';
 const $=s=>document.querySelector(s);
 const platform=()=>window.OroPlatform;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const connectionPage=(title,description)=>{const root=$('#app');$('#hd').innerHTML='';$('#ft').innerHTML='';root.innerHTML='<section class="oro-login-shell"><div class="oro-login-card"><div class="oro-mark">ORO <span>✦</span></div><span class="market-eyebrow">PLATAFORMA DE JOYERÍAS</span><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p><a class="oro-action-secondary" href="#/">Volver al inicio</a></div></section>'};
 let sb=null,ready=false,busy=false;
 async function route(){
  if(busy)return;busy=true;
  try{
   const hash=location.hash||'#/';const parts=hash.replace(/^#\/?/,'').split('/');let page=parts[0]||'',slug=parts[1]||'';
   if(page==='admin'){location.hash='#/plataforma';return}
   if(['tienda','coleccion','producto','nosotros','contacto','inicio'].includes(page)){location.hash='#/';return}
   if(page==='gestion'){
    $('#hd').innerHTML='';$('#ft').innerHTML='';
    if(!ready){connectionPage('Panel temporalmente desconectado','No se pudo establecer conexión con Supabase. Verifica las variables públicas del proyecto en Vercel.');return}
    await platform().renderOwnerAdmin();return;
   }
   if(page==='plataforma'){
    $('#hd').innerHTML='';$('#ft').innerHTML='';
    if(!ready){connectionPage('Centro ORO','El centro de administración necesita una conexión activa con Supabase.');return}
    await platform().renderAdmin();return;
   }
   if(page==='joyeria'||(ready&&platform().tenant)){
    $('#hd').innerHTML='';$('#ft').innerHTML='';
    if(!ready){connectionPage('Catálogo no disponible','Esta joyería necesita una conexión activa para mostrar sus productos.');return}
    if(page==='joyeria'&&(!platform().tenant||platform().tenant.slug!==slug)){
     const ok=await platform().openTenantBySlug(slug);
     if(!ok){connectionPage('Joyería no disponible','El catálogo no existe o no está publicado.');return}
    }
    await platform().renderTenantCatalog();return;
   }
   if(!ready){await platform().renderHome();return}
   if(platform().tenant){await platform().renderTenantCatalog();return}
   await platform().renderHome();
  }catch(error){connectionPage('No se pudo cargar ORO',error?.message||'Ocurrió un error inesperado.')}
  finally{busy=false}
 }
 addEventListener('hashchange',()=>{if(!busy)route()});
 (async()=>{
  try{
   await(window.__sbReady||Promise.resolve());
   const cfg=window.SB||{};
   if(cfg.url&&cfg.key&&window.supabase){
    sb=window.supabase.createClient(cfg.url,cfg.key);
    window.__oroSb=sb;
    await platform().init(sb);
    ready=true;
   }
  }catch(error){ready=false}
  route();
 })();
})();