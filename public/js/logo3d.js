/* Logo SG 3D estable: movimiento continuo sin giro de canto ni desapariciones. */
window.logo3d = function (box) {
  const T=window.THREE,cv=box?.querySelector('canvas'),fb=box?.querySelector('.lh-fb');
  if(!T||!cv||!fb||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let renderer;
  try{renderer=new T.WebGLRenderer({canvas:cv,alpha:true,antialias:false,powerPreference:'low-power'});}catch(_){return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,50),group=new T.Group();
  camera.position.z=9;scene.add(group);
  let disposed=false,raf=0,observer=null,resizeObserver=null;
  new T.TextureLoader().load(fb.currentSrc||fb.src,texture=>{
    if(disposed||!box.isConnected){texture.dispose();renderer.dispose();return;}
    texture.colorSpace=T.SRGBColorSpace;
    const aspect=texture.image.width/texture.image.height,height=4.6,width=height*aspect;
    const geometry=new T.PlaneGeometry(width,height),layers=7,depth=.028,materials=[];
    for(let i=layers;i>=1;i--){
      const k=i/layers,material=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.35,color:new T.Color().setRGB(.72-.22*k,.52-.2*k,.25-.12*k),side:T.DoubleSide});
      materials.push(material);const side=new T.Mesh(geometry,material);side.position.z=-i*depth;group.add(side);
    }
    const frontMat=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.015,side:T.DoubleSide});
    materials.push(frontMat);group.add(new T.Mesh(geometry,frontMat));
    const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=96;
    const ctx=haloCanvas.getContext('2d'),grad=ctx.createRadialGradient(48,48,0,48,48,48);
    grad.addColorStop(0,'rgba(214,166,75,.22)');grad.addColorStop(.6,'rgba(148,98,31,.08)');grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,96,96);
    const haloTexture=new T.CanvasTexture(haloCanvas),halo=new T.Sprite(new T.SpriteMaterial({map:haloTexture,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
    halo.scale.set(width*1.55,width*1.55,1);halo.position.z=-layers*depth-.2;group.add(halo);
    box.classList.add('gl-on');
    let visible=false,lastRender=0,widthNow=0,heightNow=0;const clock=new T.Clock();
    const render=now=>{
      raf=0;if(disposed||!visible||document.hidden||!cv.isConnected)return;
      if(now-lastRender<40){raf=requestAnimationFrame(render);return;}lastRender=now;
      const w=box.clientWidth,h=box.clientHeight;
      if(w!==widthNow||h!==heightNow){widthNow=w;heightNow=h;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.fov=w/Math.max(1,h)<.9?38:30;camera.updateProjectionMatrix();}
      const t=clock.getElapsedTime();
      group.rotation.y=Math.sin(t*.38)*.14;
      group.rotation.x=Math.sin(t*.52)*.035;
      group.position.y=Math.sin(t*.82)*.11;
      halo.material.opacity=.75+Math.sin(t*.7)*.12;
      renderer.render(scene,camera);raf=requestAnimationFrame(render);
    };
    const start=()=>{if(!visible){visible=true;clock.start();if(!raf)raf=requestAnimationFrame(render);}};
    const stop=()=>{visible=false;if(raf)cancelAnimationFrame(raf);raf=0;};
    observer=new IntersectionObserver(entries=>entries[0].isIntersecting?start():stop(),{threshold:.02});observer.observe(box);
    const onVisibility=()=>document.hidden?stop():start();document.addEventListener('visibilitychange',onVisibility);
    if('ResizeObserver'in window){resizeObserver=new ResizeObserver(()=>{widthNow=0;});resizeObserver.observe(box);}
    box._logo3dCleanup=()=>{disposed=true;stop();observer?.disconnect();resizeObserver?.disconnect();document.removeEventListener('visibilitychange',onVisibility);texture.dispose();haloTexture.dispose();geometry.dispose();materials.forEach(m=>m.dispose());renderer.dispose();box.classList.remove('gl-on');};
  },undefined,()=>{});
};