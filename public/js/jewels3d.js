/* Joyas 3D de la ficha de producto. Geometría procedural (eslabones entrelazados,
   cabezas de sello biseladas, medalla con borde) iluminada con un entorno de estudio
   generado en código para reflejos metálicos. Arrastra para girar; sigue al cursor. */
window.jewel3d = function (cv, shape) {
  const T = window.THREE;
  if (!T || !cv) return;
  let r;
  try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { cv.style.display = 'none'; return; }
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const sc = new T.Scene(), cm = new T.PerspectiveCamera(32, 1, .1, 50), g = new T.Group();
  cm.position.set(0, 0, 9); sc.add(g);

  // Entorno de estudio: cajas de luz cálidas sobre fondo oscuro -> reflejos en el oro.
  const es = new T.Scene();
  es.add(new T.Mesh(new T.SphereGeometry(20, 32, 16), new T.MeshBasicMaterial({ color: 0x0b0907, side: T.BackSide })));
  const soft = (w, h, x, y, z, c, k) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  soft(12, 5, 0, 10, 2, 0xfff0cf, 5); soft(3, 12, -10, 0, 3, 0xffe1a0, 4); soft(3, 12, 10, 0, -2, 0xffd48a, 3); soft(14, 3, 0, -8, 4, 0x8a5a1c, 1.5); soft(6, 6, 0, 2, 12, 0xffffff, 2);
  const pmrg = new T.PMREMGenerator(r); const pm = pmrg.fromScene(es, .03).texture; sc.environment = pm;

  const gold = new T.MeshStandardMaterial({ color: 0xe0b25a, metalness: 1, roughness: .2, envMapIntensity: 1.25 });
  const dark = new T.MeshStandardMaterial({ color: 0xa8742a, metalness: 1, roughness: .38, envMapIntensity: 1 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const rrect = (w, h, rad) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad); s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad); s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y); return s; };
  const slab = (shp, depth, b = .04) => new T.ExtrudeGeometry(shp, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 28 });

  // Cadena de eslabones ovalados entrelazados (cada uno gira 90° respecto al anterior).
  const chain = (pts, closed, kinds, R, t, flat) => {
    const curve = new T.CatmullRomCurve3(pts, closed), len = curve.getLength(), geo = new T.TorusGeometry(R, t, 20, 56);
    let s = 0, i = 0, prev = 0;
    while (s < len - (closed ? R : 0)) {
      const sx = kinds[i % kinds.length], half = R * sx;
      s += i ? (half + prev) * .74 : 0; if (s >= len) break;
      const u = s / len, o = new T.Object3D(), m = new T.Mesh(geo, gold);
      o.position.copy(curve.getPointAt(u));
      o.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), curve.getTangentAt(u).normalize());
      m.scale.set(sx, 1, flat); m.rotation.x = (i % 2) * Math.PI / 2; o.add(m); g.add(o);
      prev = half; i++;
    }
  };
  const U = (n, w, d, y0) => Array.from({ length: n }, (_, k) => { const x = (k / (n - 1) - .5) * 2 * w; return new T.Vector3(x, d * (x / w) ** 2 + y0, 0) });
  const loop = (n, rad) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return new T.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0) });
  const bail = (y) => { add(new T.TorusGeometry(.17, .05, 16, 40), gold, 0, y, 0); };

  const build = {
    cadena: () => { chain(U(40, 2.7, 2.2, -1.1), false, [1.3], .27, .08, 1); g.rotation.x = .12; },
    grumet: () => { chain(U(40, 2.6, 2, -1), false, [1.25], .27, .12, .8); g.rotation.x = .12; },
    figaro: () => { chain(U(48, 2.8, 2.2, -1.1), false, [1, 1, 1, 2.3], .25, .075, 1); },
    pulsera: () => { // brazalete rígido con placa
      add(new T.CylinderGeometry(1.3, 1.3, .6, 96, 1, true), new T.MeshStandardMaterial({ color: 0xe0b25a, metalness: 1, roughness: .22, envMapIntensity: 1.25, side: T.DoubleSide })).rotation.x = Math.PI / 2;
      [-.3, .3].forEach(z => add(new T.TorusGeometry(1.3, .045, 16, 96), gold, 0, 0, z));
      const p = add(slab(rrect(1.1, .42, .08), .06), gold, 0, 1.32, 0); p.rotation.x = -Math.PI / 2;
      const q = add(slab(rrect(.85, .24, .05), .02, .015), dark, 0, 1.4, 0); q.rotation.x = -Math.PI / 2;
      g.rotation.x = -.95;
    },
    sello: () => ring(false), anillo: () => ring(true),
    dije: () => {
      const d = new T.Shape(); d.moveTo(0, 1.05); d.lineTo(.85, 0); d.lineTo(0, -1.05); d.lineTo(-.85, 0); d.closePath();
      const i = new T.Shape(); i.moveTo(0, .62); i.lineTo(.5, 0); i.lineTo(0, -.62); i.lineTo(-.5, 0); i.closePath();
      add(slab(d, .2, .07), gold, 0, -.2, 0); add(slab(i, .02, .02), dark, 0, -.2, .2); bail(.97);
    },
    moneda: () => {
      const c = add(new T.CylinderGeometry(1.05, 1.05, .16, 96), gold); c.rotation.x = Math.PI / 2;
      [.09, -.09].forEach(z => add(new T.TorusGeometry(1.05, .07, 20, 96), gold, 0, 0, z));
      const f = add(new T.CylinderGeometry(.8, .8, .02, 96), dark, 0, 0, .085); f.rotation.x = Math.PI / 2;
      add(new T.TorusGeometry(.5, .025, 12, 80), gold, 0, 0, .1); bail(1.3);
    }
  };
  function ring(round) { // aro biselado + cabeza (sello cuadrado o redondo)
    const band = add(new T.TorusGeometry(1.05, .2, 28, 120), gold); band.scale.z = 1.25;
    const sh = round ? (() => { const s = new T.Shape(); s.absellipse(0, 0, .62, .62, 0, Math.PI * 2); return s })() : rrect(1.15, 1, .14);
    const hd = add(slab(sh, .2, .06), gold, 0, 1.12, 0); hd.rotation.x = -Math.PI / 2;
    const ins = add(slab(round ? (() => { const s = new T.Shape(); s.absellipse(0, 0, .4, .4, 0, Math.PI * 2); return s })() : rrect(.7, .56, .08), .02, .015), dark, 0, 1.43, 0); ins.rotation.x = -Math.PI / 2;
    g.rotation.x = .3;
  }
  (build[shape] || build.pulsera)();
  const base = g.rotation.x;

  // Sombra de contacto suave bajo la pieza.
  const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 128;
  const sx = sc2.getContext('2d'), sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const fl = new T.Mesh(new T.PlaneGeometry(5, 5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc2), transparent: true, depthWrite: false }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -2.2; sc.add(fl);

  // Interacción: arrastrar con inercia, seguimiento suave del cursor, giro lento en reposo.
  let dg = 0, lx = 0, ly = 0, vy = 0, ry = 0, rx = 0, mx = 0, my = 0, tx = 0, ty = 0, vis = true;
  cv.style.cursor = 'grab'; cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', e => { dg = 1; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing' });
  const up = () => { dg = 0; cv.style.cursor = 'grab' };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  addEventListener('pointermove', e => {
    const b = cv.getBoundingClientRect(); tx = ((e.clientX - b.left) / b.width - .5) * 2; ty = ((e.clientY - b.top) / b.height - .5) * 2;
    if (dg) { vy = (e.clientX - lx) * .012; ry += vy; rx = Math.max(-.8, Math.min(.8, rx + (e.clientY - ly) * .008)); lx = e.clientX; ly = e.clientY }
  }, { passive: true });
  new IntersectionObserver(es2 => vis = es2[0].isIntersecting).observe(cv);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, clock = new T.Clock();
  (function f() {
    if (!cv.isConnected) { r.dispose(); pm.dispose(); pmrg.dispose(); return }
    requestAnimationFrame(f); if (!vis || document.hidden) return;
    const t = clock.getElapsedTime(), w = cv.clientWidth, h = cv.clientHeight;
    if (cv._w != w || cv._h != h) { r.setSize(w, h, false); cm.aspect = w / h; cm.updateProjectionMatrix(); cv._w = w; cv._h = h }
    if (!dg) { ry += vy; vy *= .95; if (Math.abs(vy) < .002 && !reduce) ry += .004; rx *= .97 }
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    g.rotation.y = ry + mx * .35; g.rotation.x = base + rx + my * .12;
    g.position.y = reduce ? 0 : Math.sin(t * 1.1) * .08;
    r.render(sc, cm);
  })();
};
