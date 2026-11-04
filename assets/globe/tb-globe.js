/* tb-globe.js — hero globe with orbiting product links.
   Progressive enhancement: the product list lives in the HTML (#tb-globe .tb-globe-list a[data-product]).
   This script turns those SAME links into orbiting orbs around a Three.js globe. Nothing is hard-coded here.
   Node positions are plain trigonometry (no three needed), so the links are usable before three loads;
   three (lazy, only near the viewport) just draws the globe, rings and glow behind them. */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.min.js'; // same r184 the /3d page bundles
const FOV = 32;                       // vertical field of view, degrees
const TAN_HALF = Math.tan(FOV * Math.PI / 360);
const DEG = Math.PI / 180;
const HEX = /^#[0-9a-f]{3,8}$/i;

// Orbit presets: radius (globe radius = 1), inclination, node longitude, angular speed (rad/s).
const ORBITS = [
  { r: 1.55, tilt: 18 * DEG,  node: 0,          speed: 0.30 },
  { r: 1.90, tilt: -24 * DEG, node: 40 * DEG,   speed: -0.23 },
  { r: 2.30, tilt: 30 * DEG,  node: -35 * DEG,  speed: 0.17 },
];
const ORBITS_NARROW = [
  { r: 1.50, tilt: 18 * DEG,  node: 0,          speed: 0.30 },
  { r: 1.80, tilt: -24 * DEG, node: 40 * DEG,   speed: -0.23 },
  { r: 2.10, tilt: 30 * DEG,  node: -35 * DEG,  speed: 0.17 },
];

const root = document.getElementById('tb-globe');
if (root) boot(root);

function boot(root) {
  const list = root.querySelector('.tb-globe-list');
  const links = list ? Array.from(list.querySelectorAll('a[data-product]')) : [];
  if (!links.length) return;

  // Read product data from the markup (single source of truth).
  const prim = links.some(a => a.hasAttribute('data-primary'));
  const items = links.map((a, i) => {
    const color = HEX.test(a.dataset.color || '') ? a.dataset.color : '#0A84FF';
    a.style.setProperty('--c', color);                       // also colours the fallback cards
    const li = a.closest('li') || a.parentElement;
    const primary = prim ? a.hasAttribute('data-primary') : i < 4;   // default: first four are the headline products
    li.classList.toggle('is-primary', primary);
    return {
      a, li, primary, color, id: a.dataset.product,
      name: (a.querySelector('b') || a).textContent.trim(),
      tag: a.querySelector('span') ? a.querySelector('span').textContent.trim() : '',
      orbit: 0, phase: 0, x: 0, y: 0, z: 0,
    };
  });

  // Click tracking (never blocks navigation); the destination's tb-beacon.js records the UTM visit.
  list.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-product]');
    if (!a) return;
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'select_content', { content_type: 'product', item_id: a.dataset.product, link_url: a.href });
      }
    } catch (_) { /* analytics must never break the link */ }
  });

  // Keep the grid when we cannot or should not animate.
  if (!hasWebGL()) return;
  const conn = navigator.connection;
  if (conn && conn.saveData) return;

  // ----- enhanced mode -----
  root.classList.add('tb-on');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const st = {
    W: 0, H: 0, u: 100, d: 7, narrow: false,
    yaw: 0.6, pitch: 0.18, inertia: 0,
    mul: 1, target: 1, paused: false, reduced: mqReduce.matches,
    visible: false, active: null, focused: false, t: 0,
  };
  root.classList.toggle('tb-static', st.reduced);

  const stage = document.createElement('div');
  stage.className = 'tb-globe-stage';
  stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  root.insertBefore(stage, root.firstChild);

  const hint = root.dataset.hint || 'Drag to rotate. Select a product to open it.';
  const info = document.createElement('div');
  info.className = 'tb-globe-info';
  info.setAttribute('aria-hidden', 'true');
  root.appendChild(info);
  const showInfo = it => {
    info.textContent = '';
    if (it) {
      const s = document.createElement('strong'); s.textContent = it.name;
      info.appendChild(s); info.appendChild(document.createTextNode(it.tag));
    } else info.textContent = hint;
  };
  showInfo(null);

  const pause = document.createElement('button');
  pause.type = 'button'; pause.className = 'tb-globe-pause';
  const lblPause = root.dataset.pauseLabel || 'Pause motion', lblPlay = root.dataset.playLabel || 'Play motion';
  const setPauseUI = () => {
    pause.setAttribute('aria-label', st.paused ? lblPlay : lblPause);
    pause.setAttribute('aria-pressed', String(st.paused));
    pause.textContent = st.paused ? '▶' : '❚❚';
  };
  setPauseUI();
  pause.addEventListener('click', () => { st.paused = !st.paused; setPauseUI(); request(); });
  root.appendChild(pause);

  // ----- layout: distribute products over orbits, fit the camera to the box -----
  function assign() {
    const prims = items.filter(i => i.primary), rest = items.filter(i => !i.primary);
    const groups = [[], [], []];
    prims.forEach((it, k) => groups[k % 2].push(it));                       // headline products on the two inner orbits
    rest.forEach((it, k) => groups[k < 6 ? 2 : 1].push(it));                // the rest on the outer orbit (overflow to the middle)
    groups.forEach((g, o) => g.forEach((it, k) => {
      it.orbit = o;
      it.phase = (k / g.length) * Math.PI * 2 + o * 0.9;
    }));
  }
  assign();

  let orbits = ORBITS;
  function layout() {
    if (st.failed) return;
    const W = root.clientWidth, H = root.clientHeight;
    if (!W || !H) return;
    st.W = W; st.H = H; st.narrow = W < 640;
    orbits = st.narrow ? ORBITS_NARROW : ORBITS;
    const used = orbits.filter((o, i) => items.some(it => it.orbit === i));
    const rMax = Math.max.apply(null, used.map(o => o.r));
    // Vertical reach of the orbits over the pitch range the user can drag to.
    let vExt = 1;
    used.forEach(o => { vExt = Math.max(vExt, o.r * Math.sin(Math.abs(o.tilt) + 0.42)); });
    const padX = st.narrow ? 54 : 100, padY = st.narrow ? 74 : 86;
    st.u = Math.max(40, Math.min((W / 2 - padX) / rMax, (H / 2 - padY) / vExt, H * 0.3));
    st.d = H / (2 * st.u * TAN_HALF);                                         // camera distance for u px per unit at the origin
    if (gl) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.renderer.setPixelRatio(dpr);
      gl.renderer.setSize(W, H, false);
      gl.camera.aspect = W / H; gl.camera.position.z = st.d; gl.camera.updateProjectionMatrix();
      gl.orbitGroups.forEach((g, i) => g.scale.setScalar(orbits[i].r));
      gl.orbitGroups.forEach((g, i) => { g.rotation.x = orbits[i].tilt; });
    }
    request();
  }

  // ----- per-frame update: positions of the orbs (pure math) + draw -----
  function place() {
    const cy = st.pitch, sinP = Math.sin(cy), cosP = Math.cos(cy);
    const k = st.H / 2 / TAN_HALF, cx0 = st.W / 2, cy0 = st.H / 2;
    items.forEach(it => {
      const o = orbits[it.orbit], th = it.phase + st.t * o.speed;
      // point on the orbit circle -> inclination -> node longitude (+ parallax from yaw) -> pitch of the whole system
      const lx = o.r * Math.cos(th), lz = o.r * Math.sin(th);
      const y1 = -lz * Math.sin(o.tilt), z1 = lz * Math.cos(o.tilt);
      const nd = o.node + st.yaw * 0.35, cn = Math.cos(nd), sn = Math.sin(nd);
      const x2 = lx * cn + z1 * sn, z2 = -lx * sn + z1 * cn;
      const y3 = y1 * cosP - z2 * sinP, z3 = y1 * sinP + z2 * cosP;
      const depth = st.d - z3, sx = cx0 + x2 * k / depth, sy = cy0 - y3 * k / depth;
      const front = (z3 / o.r) * 0.5 + 0.5;                                   // 0 back .. 1 front
      const hidden = z3 < 0 && Math.hypot(sx - cx0, sy - cy0) < st.u * 1.02;   // behind the globe disc
      const s = (1 + (st.d / depth - 1) * 0.8) * (it.primary ? 1 : 0.88) * (st.narrow ? 0.92 : 1);
      const op = hidden ? 0.16 : 0.5 + 0.5 * front;
      const li = it.li;
      li.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
      li.style.setProperty('--s', s.toFixed(3));                                // depth scale applies to the visuals, never the 44px tap box
      li.style.opacity = op.toFixed(2);
      li.style.zIndex = String(Math.round(z3 * 40 + 200) + (it === st.active ? 1000 : 0));
      it.a.style.pointerEvents = hidden ? 'none' : 'auto';
    });
  }

  function step(dt) {
    if (st.failed) return;
    st.mul += (st.target - st.mul) * Math.min(1, dt * 6);
    const moving = !st.reduced && !st.paused;
    if (moving) { st.t += dt * st.mul; st.yaw += (0.07 * st.mul) * dt; }
    if (!st.reduced) { st.yaw += st.inertia * dt; st.inertia *= Math.exp(-dt * 2.5); if (Math.abs(st.inertia) < 0.005) st.inertia = 0; }
    place();
    if (gl) drawGL();
  }

  // ----- render loop: only while visible, tab shown, and something is moving -----
  let raf = 0, last = 0, dragging = false;
  const animating = () =>
    (st.visible && !document.hidden && !st.reduced && !st.paused) || dragging || st.inertia !== 0 || Math.abs(st.mul - st.target) > 0.01;
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    step(dt);
    if (animating() && (st.visible || dragging) && !document.hidden) raf = requestAnimationFrame(loop);
  }
  function request() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) request(); });
  const onReduce = () => { st.reduced = mqReduce.matches; root.classList.toggle('tb-static', st.reduced); if (st.reduced) st.inertia = 0; request(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce); else if (mqReduce.addListener) mqReduce.addListener(onReduce);

  // ----- hover / focus: highlight, slow the orbit, show the tagline -----
  function activate(it, focus) {
    st.active = it; st.focused = !!(it && focus);
    st.target = !it ? 1 : (focus ? 0 : 0.12);
    showInfo(it); request();
  }
  items.forEach(it => {
    it.a.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && !dragging) activate(it, false); });
    it.a.addEventListener('pointerleave', () => { if (!st.focused) activate(null); });
    it.a.addEventListener('focus', () => activate(it, true));
    it.a.addEventListener('blur', () => activate(null));
  });

  // ----- drag to rotate; a drag never counts as a click -----
  let sx = 0, sy = 0, px = 0, py = 0, pt = 0, moved = false;
  root.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (e.target.closest && e.target.closest('.tb-globe-pause'))) return;
    sx = px = e.clientX; sy = py = e.clientY; pt = e.timeStamp; moved = false; dragging = true; st.inertia = 0;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });
  function onMove(e) {
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
    if (!moved) { moved = true; root.classList.add('tb-drag'); }
    const dx = e.clientX - px, dy = e.clientY - py, dt = Math.max(1, e.timeStamp - pt) / 1000;
    px = e.clientX; py = e.clientY; pt = e.timeStamp;
    st.yaw += dx * 0.006;
    st.pitch = Math.max(-0.4, Math.min(0.4, st.pitch + dy * 0.004));
    st.inertia = st.reduced ? 0 : Math.max(-3, Math.min(3, dx * 0.006 / dt));
    request();
  }
  function onUp() {
    dragging = false; root.classList.remove('tb-drag');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    setTimeout(() => { moved = false; }, 60);                  // swallow the click that follows a drag
    request();
  }
  root.addEventListener('click', e => {
    if (moved && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); }   // keyboard activation (detail 0) always passes
  }, true);

  // ----- Three.js (lazy) -----
  let gl = null, glStarted = false;
  function drawGL() {
    gl.globe.rotation.y = st.yaw;
    gl.system.rotation.x = st.pitch;
    gl.orbitGroups.forEach((g, i) => { g.rotation.y = orbits[i].node + st.yaw * 0.35; });
    gl.stars.rotation.y = st.yaw * 0.12;
    gl.renderer.render(gl.scene, gl.camera);
  }
  async function startGL() {
    if (glStarted) return; glStarted = true;
    try {
      const THREE = await import(THREE_URL);
      gl = buildScene(THREE, canvas, items, st);
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
      layout();
    } catch (err) {
      fail();
    }
  }
  // three missing / no context: drop back to the plain card grid
  function fail() {
    st.failed = true; gl = null; stage.remove(); info.remove(); pause.remove();
    root.classList.remove('tb-on', 'tb-drag', 'tb-static');
    items.forEach(it => { it.li.removeAttribute('style'); it.a.style.pointerEvents = ''; });
  }

  // ----- wiring: size, visibility -----
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(root); else window.addEventListener('resize', layout);
  layout();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      st.visible = es[es.length - 1].isIntersecting;
      if (st.visible) { startGL(); request(); }
    }, { rootMargin: '300px 0px' }).observe(root);
  } else { st.visible = true; startGL(); request(); }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    if (!g) return false;
    const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext();   // free the probe context
    return true;
  } catch (_) { return false; }
}

// Build the globe, graticule, rings, atmosphere and star dust.
function buildScene(THREE, canvas, items, st) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const blue = new THREE.Color('#0A84FF'), indigo = new THREE.Color('#5E5CE6');

  const system = new THREE.Group(); scene.add(system);       // pitch applies to globe + orbits together
  const globe = new THREE.Group(); system.add(globe);        // yaw spin applies to the globe only

  // Opaque body with a fresnel rim: hides the far side of dots/rings and gives the edge glow.
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.985, 64, 48), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.6); vec3 base=vec3(0.025,0.035,0.085); vec3 rim=mix(vec3(0.04,0.52,1.0),vec3(0.37,0.36,0.9),0.5); gl_FragColor=vec4(mix(base,rim*0.9,f),1.0); }',
  }));
  globe.add(body);

  // Dotted surface: Fibonacci sphere, brightness varied by smooth noise (abstract texture, not geography).
  const n = st.narrow ? 1500 : 2800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) / n * 2, rad = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    pos[i * 3] = x * 1.004; pos[i * 3 + 1] = y * 1.004; pos[i * 3 + 2] = z * 1.004;
    const v = Math.sin(x * 3.1 + 1.3) * Math.sin(y * 2.7 - 0.4) + 0.6 * Math.sin(z * 4.3 + x * 1.7) + 0.4 * Math.sin(y * 7.1 + z * 5.3);
    const b = 0.22 + 0.78 * Math.max(0, Math.min(1, (v + 0.4) / 1.6));
    c.copy(blue).lerp(indigo, (y + 1) / 2).multiplyScalar(b);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  globe.add(new THREE.Points(dg, new THREE.PointsMaterial({
    size: st.narrow ? 0.085 : 0.07, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  // Graticule (latitude / longitude lines).
  const gp = [], seg = 96;
  for (let lat = -60; lat <= 60; lat += 30) {
    const r = Math.cos(lat * DEG), y = Math.sin(lat * DEG);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
      gp.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r);
    }
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const L = lon * DEG;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
      gp.push(Math.cos(a0) * Math.cos(L), Math.sin(a0), Math.cos(a0) * Math.sin(L), Math.cos(a1) * Math.cos(L), Math.sin(a1), Math.cos(a1) * Math.sin(L));
    }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gp), 3));
  globe.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3d7bff, transparent: true, opacity: 0.16, depthWrite: false })));

  // Atmosphere: back-face shell that fades out from the limb.
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.17, 64, 48), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float t=clamp(-vN.z*2.0,0.0,1.0); float i=pow(t,1.7); vec3 col=mix(vec3(0.37,0.36,0.9),vec3(0.04,0.52,1.0),t); gl_FragColor=vec4(col*1.25,i*0.85); }',
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  // Orbit rings, one per orbit preset, tinted by the products that ride on them.
  const orbitGroups = ORBITS.map((o, oi) => {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const pts = [], seg2 = 180;
    for (let i = 0; i < seg2; i++) { const a = i / seg2 * 6.2832; pts.push(Math.cos(a), 0, Math.sin(a)); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const mine = items.filter(it => it.orbit === oi);
    const tint = mine.length ? new THREE.Color(mine[0].color) : blue.clone();
    g.add(new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: tint.lerp(blue, 0.4), transparent: true, opacity: 0.3, depthWrite: false })));
    system.add(g);
    return g;
  });

  // Star dust.
  const sn = 260, sp = new Float32Array(sn * 3);
  for (let i = 0; i < sn; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.2832, r = Math.sqrt(1 - u * u), d = 9 + Math.random() * 6;
    sp[i * 3] = Math.cos(a) * r * d; sp[i * 3 + 1] = u * d * 0.6; sp[i * 3 + 2] = Math.sin(a) * r * d - 4;
  }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0x9db4ff, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(stars);

  return { renderer, scene, camera, system, globe, orbitGroups, stars };
}
