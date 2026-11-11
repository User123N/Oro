/* Emblema SG 3D autónomo. Usa el archivo original como textura: no redibuja ni altera el logo. */
window.logo3d = function (box) {
  const T = window.THREE, cv = box?.querySelector('canvas'), fb = box?.querySelector('.lh-fb');
  if (!T || !cv || !fb || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  } catch (_) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, .1, 50), group = new T.Group();
  camera.position.z = 9; scene.add(group);

  new T.TextureLoader().load(fb.currentSrc || fb.src, texture => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const aspect = texture.image.width / texture.image.height, height = 4.6, width = height * aspect;
    const geometry = new T.PlaneGeometry(width, height), layers = 9, depth = .035;
    for (let i = layers; i >= 1; i--) {
      const k = i / layers;
      const material = new T.MeshBasicMaterial({
        map: texture, transparent: true, alphaTest: .5,
        color: new T.Color().setRGB(.55 - .25 * k, .36 - .2 * k, .12 - .08 * k),
        side: T.DoubleSide
      });
      const side = new T.Mesh(geometry, material);
      side.position.z = -i * depth; group.add(side);
    }
    group.add(new T.Mesh(geometry, new T.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .02 })));

    // Reflejo fino que se desplaza por la superficie del emblema.
    const maskCanvas = document.createElement('canvas'), size = 256;
    maskCanvas.width = size; maskCanvas.height = Math.round(size / aspect);
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    maskCtx.drawImage(texture.image, 0, 0, maskCanvas.width, maskCanvas.height);
    const pixels = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const alpha = pixels.data[i + 3];
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = alpha;
      pixels.data[i + 3] = 255;
    }
    maskCtx.putImageData(pixels, 0, 0);
    const mask = new T.CanvasTexture(maskCanvas);
    const shineCanvas = document.createElement('canvas'); shineCanvas.width = 256; shineCanvas.height = 2;
    const shineCtx = shineCanvas.getContext('2d'), gradient = shineCtx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#000'); gradient.addColorStop(.46, '#000');
    gradient.addColorStop(.5, '#fff1c4'); gradient.addColorStop(.54, '#000'); gradient.addColorStop(1, '#000');
    shineCtx.fillStyle = gradient; shineCtx.fillRect(0, 0, 256, 2);
    const shineTexture = new T.CanvasTexture(shineCanvas);
    shineTexture.wrapS = T.RepeatWrapping; shineTexture.repeat.set(.7, 1);
    const shine = new T.Mesh(geometry, new T.MeshBasicMaterial({
      map: shineTexture, alphaMap: mask, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, opacity: .5
    }));
    shine.position.z = .004; group.add(shine);

    const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 128;
    const haloCtx = haloCanvas.getContext('2d'), haloGradient = haloCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    haloGradient.addColorStop(0, 'rgba(214,166,75,.3)');
    haloGradient.addColorStop(.55, 'rgba(148,98,31,.1)');
    haloGradient.addColorStop(1, 'rgba(0,0,0,0)');
    haloCtx.fillStyle = haloGradient; haloCtx.fillRect(0, 0, 128, 128);
    const halo = new T.Sprite(new T.SpriteMaterial({
      map: new T.CanvasTexture(haloCanvas), blending: T.AdditiveBlending, depthWrite: false
    }));
    halo.scale.set(width * 1.7, width * 1.7, 1);
    halo.position.z = -layers * depth - .3; group.add(halo);

    box.classList.add('gl-on');
    const clock = new T.Clock();
    let visible = false, frame = 0, lastRender = 0, raf = 0, widthNow = 0, heightNow = 0;
    let angle = 0, resizeObserver;
    const render = now => {
      raf = 0;
      if (!visible || document.hidden || !cv.isConnected) return;
      // 30 FPS es suficiente para un giro suave y reduce el trabajo de GPU.
      if (now - lastRender < 32) { raf = requestAnimationFrame(render); return; }
      lastRender = now;
      const w = box.clientWidth, h = box.clientHeight;
      if (w !== widthNow || h !== heightNow) {
        widthNow = w; heightNow = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.fov = w / h < .9 ? 38 : 30;
        camera.updateProjectionMatrix();
      }
      const delta = Math.min(clock.getDelta(), .05);
      angle += delta * .22; // giro continuo y pausado, sin interacción
      group.rotation.y = angle + Math.sin(clock.elapsedTime * .32) * .035;
      group.rotation.x = Math.sin(clock.elapsedTime * .42) * .025;
      group.position.y = Math.sin(clock.elapsedTime * .8) * .12;
      shineTexture.offset.x = (clock.elapsedTime * .12) % 1.5 - .5;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    const start = () => { if (!visible) { visible = true; clock.start(); if (!raf) raf = requestAnimationFrame(render); } };
    const stop = () => { visible = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
    const observer = new IntersectionObserver(entries => entries[0].isIntersecting ? start() : stop(), { threshold: .05 });
    observer.observe(box);
    const onVisibility = () => document.hidden ? stop() : (observer.takeRecords(), box.getBoundingClientRect().bottom > 0 && box.getBoundingClientRect().top < innerHeight && start());
    document.addEventListener('visibilitychange', onVisibility);
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(() => { widthNow = 0; }); resizeObserver.observe(box); }
    box._logo3dCleanup = () => {
      stop(); observer.disconnect(); resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      texture.dispose(); mask.dispose(); shineTexture.dispose(); geometry.dispose();
      renderer.dispose();
    };
  }, undefined, () => { /* la imagen original permanece visible si WebGL o la textura fallan */ });
};
