/* Logotipo SG flotante. La imagen original se usa como textura sobre un plano con
   profundidad (capas apiladas): nunca se redibuja ni se deforma. Si WebGL no está
   disponible, se queda visible la imagen estática (.lh-fb). */
window.logo3d = function (box) {
  const T = window.THREE, cv = box && box.querySelector('canvas'), fb = box && box.querySelector('.lh-fb');
  if (!T || !cv || !fb) return;
  let r;
  try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  if (!r.getContext()) return;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sc = new T.Scene(), cm = new T.PerspectiveCamera(30, 1, .1, 50), g = new T.Group();
  cm.position.z = 9; sc.add(g);

  new T.TextureLoader().load(fb.currentSrc || fb.src, tex => {
    tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = r.capabilities.getMaxAnisotropy();
    const ar = tex.image.width / tex.image.height, H = 4.6, W = H * ar;
    const geo = new T.PlaneGeometry(W, H), N = 14, gap = .03;
    // Capas traseras: mismo contorno, tono oro oscuro, forman el canto metálico.
    for (let i = N; i >= 1; i--) {
      const k = i / N, m = new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .5, color: new T.Color().setRGB(.55 - .25 * k, .36 - .2 * k, .12 - .08 * k), side: T.DoubleSide });
      const p = new T.Mesh(geo, m); p.position.z = -i * gap; g.add(p);
    }
    // Cara frontal con la textura original sin tintar.
    const front = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .02 }));
    g.add(front);
    // Reflejo que recorre la silueta (máscara derivada del alfa del propio logo).
    const mc = document.createElement('canvas'), s = 512; mc.width = s; mc.height = Math.round(s / ar);
    const x = mc.getContext('2d'); x.drawImage(tex.image, 0, 0, mc.width, mc.height);
    const d = x.getImageData(0, 0, mc.width, mc.height);
    for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i + 3]; d.data[i] = d.data[i + 1] = d.data[i + 2] = a; d.data[i + 3] = 255 }
    x.putImageData(d, 0, 0);
    const mask = new T.CanvasTexture(mc);
    const gc = document.createElement('canvas'); gc.width = 256; gc.height = 4;
    const gx = gc.getContext('2d'), gr = gx.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#000'); gr.addColorStop(.44, '#000'); gr.addColorStop(.5, '#fff1c4'); gr.addColorStop(.56, '#000'); gr.addColorStop(1, '#000');
    gx.fillStyle = gr; gx.fillRect(0, 0, 256, 4);
    const sh = new T.CanvasTexture(gc); sh.wrapS = T.RepeatWrapping; sh.repeat.set(.7, 1);
    const sheen = new T.Mesh(geo, new T.MeshBasicMaterial({ map: sh, alphaMap: mask, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: .55 }));
    sheen.position.z = .004; g.add(sheen);
    // Resplandor dorado controlado detrás del emblema.
    const hc = document.createElement('canvas'); hc.width = hc.height = 256;
    const hx = hc.getContext('2d'), hg = hx.createRadialGradient(128, 128, 0, 128, 128, 128);
    hg.addColorStop(0, 'rgba(214,166,75,.38)'); hg.addColorStop(.55, 'rgba(148,98,31,.12)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    hx.fillStyle = hg; hx.fillRect(0, 0, 256, 256);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(hc), blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.set(W * 1.7, W * 1.7, 1); halo.position.z = -N * gap - .3; g.add(halo);

    box.classList.add('gl-on'); // oculta la imagen estática solo cuando el 3D ya está listo
    // Interacción: arrastrar gira el emblema (inercia); en reposo vuelve a su posición frontal.
    let mx = 0, my = 0, tx = 0, ty = 0, vis = true, dg = 0, lx = 0, ly = 0, ry = 0, rx = 0, vy = 0, idle = 0;
    const TAU = Math.PI * 2, hint = box.querySelector('.lh-hint');
    box.addEventListener('pointerdown', e => { dg = 1; lx = e.clientX; ly = e.clientY; box.setPointerCapture(e.pointerId); box.classList.add('grab'); if (hint) hint.style.opacity = 0 });
    const up = () => { dg = 0; idle = performance.now() + 2400; box.classList.remove('grab') };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('dblclick', () => { vy = .32 }); // vuelta completa
    addEventListener('pointermove', e => {
      const b = box.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width - .5) * 2; ty = ((e.clientY - b.top) / b.height - .5) * 2;
      if (dg) { vy = (e.clientX - lx) * .012; ry += vy; rx = Math.max(-.7, Math.min(.7, rx + (e.clientY - ly) * .008)); lx = e.clientX; ly = e.clientY }
    }, { passive: true });
    new IntersectionObserver(es => vis = es[0].isIntersecting).observe(box);
    const clock = new T.Clock();
    (function f() {
      if (!cv.isConnected) { r.dispose(); return }
      requestAnimationFrame(f);
      if (!vis || document.hidden) return;
      const t = clock.getElapsedTime(), w = box.clientWidth, h = box.clientHeight;
      if (cv._w != w || cv._h != h) { r.setSize(w, h, false); cm.aspect = w / h; cm.fov = w / h < .9 ? 38 : 30; cm.updateProjectionMatrix(); cv._w = w; cv._h = h }
      if (!dg) {
        ry += vy; vy *= .94;
        if (Math.abs(vy) < .004 && performance.now() > idle) { ry += (Math.round(ry / TAU) * TAU - ry) * .035; rx *= .95 }
      }
      mx += (tx - mx) * .07; my += (ty - my) * .07;
      const fl = reduce ? 0 : 1;
      g.position.y = Math.sin(t * .9) * .14 * fl;
      g.rotation.y = ry + Math.sin(t * .35) * .16 * fl + mx * .32;
      g.rotation.x = rx + Math.sin(t * .5) * .04 * fl + my * .16;
      g.position.x = mx * .12;
      // el reflejo recorre el emblema y reacciona al cursor y al giro
      sh.offset.x = (reduce ? 0 : ((t * .16) % 1.6) - .8) + mx * .35 + Math.sin(ry) * .4;
      r.render(sc, cm);
    })();
  }, undefined, () => { /* si la textura falla se mantiene la imagen estática */ });
};
