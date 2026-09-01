/* ============================================================================
   app.js — scene, drawing tools, rendering and UI for the key clamp builder.
   ==========================================================================*/
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---- state ---------------------------------------------------------- */
  let uid = 1;
  const nid = () => 'n' + (uid++), eid = () => 'e' + (uid++);

  const state = {
    nodes: [], edges: [], overrides: {}, extras: [], panels: [],
    settings: {
      grid: 100, insertDepth: 30, kerf: 2, wall: 3.2,
      vat: true, pipeMode: 'stock', showFittings: true, showGrid: true,
      snapMode: 'ortho',      // 'ortho' | 'fittings' | 'free'
      stretch: true,          // resizing a pole stretches the structure with it
      lockAngles: true,       // only allow lengths every joint has a fitting for
      standardOnly: false,    // restrict poles to whole pipes as sold
      showAngles: true,       // draw joint angles on the model
      showAllAngles: false,   // ...including the 90s, which are usually obvious
      padSpacing: 600,        // mm between fixing pads along a pole
      sheet: 'ply12'          // default panel material
    }
  };
  let history = [], future = [];

  function snapshot() {
    return JSON.stringify({ nodes: state.nodes, edges: state.edges, overrides: state.overrides, extras: state.extras, panels: state.panels });
  }
  function pushHistory() { history.push(snapshot()); if (history.length > 80) history.shift(); future = []; }
  function restore(s) {
    const d = JSON.parse(s);
    state.nodes = d.nodes; state.edges = d.edges; state.overrides = d.overrides || {}; state.extras = d.extras || []; state.panels = d.panels || [];
    uid = 1; state.nodes.concat(state.edges).forEach((o) => {
      const n = parseInt(String(o.id).slice(1), 10); if (n >= uid) uid = n + 1;
    });

    // An undo can delete the joint a run was being drawn from, or whatever was
    // selected. Drop both rather than leave them pointing at something gone.
    if (drawFrom && !state.nodes.some((n) => n.id === drawFrom)) endRun();
    if (selection) {
      const alive = selection.type === 'node'
        ? state.nodes.some((n) => n.id === selection.id)
        : state.edges.some((e) => e.id === selection.id);
      if (!alive) selection = null;
    }
    rebuild();
  }
  function undo() { if (!history.length) return; future.push(snapshot()); restore(history.pop()); }
  function redo() { if (!future.length) return; history.push(snapshot()); restore(future.pop()); }

  /* ---- three.js scaffolding -------------------------------------------- */
  let renderer, scene, camera, controls, raycaster, structureGroup, ghostGroup, gridGroup;
  let handleGroup, overlayGroup;
  const mouse = new THREE.Vector2();

  function studioEnvironment() {
    // A canvas-built equirectangular map: gives the fittings the soft studio
    // highlights the Pipe Dream product renders have, with no external assets.
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#aab2bd'); grad.addColorStop(0.42, '#6d747e');
    grad.addColorStop(0.55, '#3a3f46'); grad.addColorStop(1, '#0d0f12');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    // two soft boxes — these give the crisp highlights along the tube
    [[250, 120, 150], [720, 160, 120]].forEach(([x, y, r]) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function initThree() {
    const host = $('#viewport');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0f11);
    scene.environment = studioEnvironment();
    scene.fog = new THREE.Fog(0x0e0f11, 6000, 18000);

    camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 10, 40000);
    camera.position.set(2100, 1500, 2600);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.target.set(0, 500, 0);
    controls.maxPolarAngle = Math.PI * 0.495;
    // Blender-style: the middle button drives the camera, Shift+middle pans,
    // and the left button is left free for selecting.
    controls.mouseButtons = {
      LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN
    };

    // Black powder coat needs a restrained key + a bright environment: too much
    // raw light energy turns the whole surface into one flat specular sheen.
    const hemi = new THREE.HemisphereLight(0xbfd3e6, 0x131417, 0.18);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(1800, 3000, 1600);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const d = 3000;
    key.shadow.camera.left = -d; key.shadow.camera.right = d;
    key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
    key.shadow.camera.far = 12000; key.shadow.bias = -0.0012;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb6cc, 0.16);
    fill.position.set(-2200, 1200, -900); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.42);
    rim.position.set(-600, 900, -2600); scene.add(rim);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40000, 40000),
      new THREE.ShadowMaterial({ opacity: 0.42 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    gridGroup = new THREE.Group(); scene.add(gridGroup);
    structureGroup = new THREE.Group(); scene.add(structureGroup);
    ghostGroup = new THREE.Group(); scene.add(ghostGroup);
    handleGroup = new THREE.Group(); scene.add(handleGroup);
    overlayGroup = new THREE.Group(); scene.add(overlayGroup);
    raycaster = new THREE.Raycaster();

    buildGrid();
    addEventListener('resize', onResize);
    onResize();
    animate();
  }

  function buildGrid() {
    gridGroup.clear();
    if (!state.settings.showGrid) return;
    const step = state.settings.grid, span = step * 40;
    const grid = new THREE.GridHelper(span, span / step, 0x3a3f47, 0x1e2126);
    grid.material.transparent = true; grid.material.opacity = 0.75;
    gridGroup.add(grid);
    const major = new THREE.GridHelper(span, span / (step * 10), 0x5a626e, 0x5a626e);
    major.material.transparent = true; major.material.opacity = 0.5;
    major.position.y = 0.4;
    gridGroup.add(major);
  }

  function onResize() {
    const host = $('#viewport');
    // A hidden or collapsed panel reports 0, which would make the aspect ratio
    // NaN and poison every projection. Never go below a single pixel.
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    positionWidget();
    renderer.render(scene, camera);
  }

  /* ---- drawing -------------------------------------------------------- */
  let mode = 'draw';            // 'draw' | 'select'
  let drawFrom = null;          // node id we're drawing from
  let planeY = 0;               // current working height
  let pendingAnchor = null;     // what the first point of a run would land on
  let lastPoint = new THREE.Vector3();
  let hoverPoint = null;
  let selection = null;         // {type:'edge'|'node', id}

  /**
   * The directions a new pole may run in, given the snap mode.
   *  ortho     – the six axes; every joint lands on a stock 90° fitting
   *  fittings  – 45° steps, so joints resolve to elbows, tees and 45° tees
   *  free      – any direction; joints resolve to swivel fittings
   */
  function snapDirections(vertical, mode) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
    if (vertical) {
      if (mode === 'ortho') return [V(0, 1, 0), V(0, -1, 0)];
      // 45° steps in every vertical plane at 45° around the compass
      const out = [V(0, 1, 0), V(0, -1, 0)];
      for (let a = 0; a < 8; a++) {
        const th = a * Math.PI / 4;
        const hx = Math.cos(th), hz = Math.sin(th);
        out.push(V(hx * 0.7071, 0.7071, hz * 0.7071));
        out.push(V(hx * 0.7071, -0.7071, hz * 0.7071));
      }
      return out;
    }
    if (mode === 'ortho') return [V(1, 0, 0), V(-1, 0, 0), V(0, 0, 1), V(0, 0, -1)];
    const out = [];
    for (let a = 0; a < 8; a++) {
      const th = a * Math.PI / 4;
      out.push(V(Math.cos(th), 0, Math.sin(th)));
    }
    return out;
  }

  function pointerToPlane(ev) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }

  /**
   * Where a *new* run is allowed to start. A structure has to stand on
   * something, so the first point can only be the ground, an existing joint, or
   * a point on an existing pole — never a spot floating in mid-air. Later
   * points in the run are already anchored by the pole behind them, so they are
   * free (a cantilevered end is perfectly normal).
   */
  function anchorPoint(ev) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // an existing joint wins — easiest thing to build off
    handleGroup.updateMatrixWorld(true);
    const hh = raycaster.intersectObjects(handleGroup.children, false);
    for (const h of hh) {
      if (!h.object.userData.handle) continue;
      const n = state.nodes.find((x) => x.id === h.object.userData.pick.id);
      if (n) return { point: new THREE.Vector3(n.p[0], n.p[1], n.p[2]), kind: 'joint', nodeId: n.id };
    }

    // otherwise anywhere along a pole, which becomes a tee
    structureGroup.updateMatrixWorld(true);
    const sh = raycaster.intersectObjects(structureGroup.children, true);
    for (const h of sh) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o || !o.userData.pick || o.userData.pick.type !== 'run') continue;
      const run = solved.runs.find((x) => x.edges[0] === o.userData.pick.id);
      if (!run) continue;
      const eid = nearestEdgeOfRun(run, h.point);
      if (!eid) continue;
      const e = state.edges.find((x) => x.id === eid);
      const a = state.nodes.find((n) => n.id === e.a);
      const b = state.nodes.find((n) => n.id === e.b);
      const ap = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const bp = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      const ab = bp.clone().sub(ap), len = ab.length();
      const t = THREE.MathUtils.clamp(h.point.clone().sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
      const along = t * len;
      if (along < WELD_END_CLEAR || along > len - WELD_END_CLEAR) {
        const end = along < len / 2 ? a : b;
        return { point: new THREE.Vector3(end.p[0], end.p[1], end.p[2]), kind: 'joint', nodeId: end.id };
      }
      return { point: ap.clone().add(ab.multiplyScalar(t)), kind: 'pole', edgeId: eid };
    }

    // failing that, the ground
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(ground, hit)) return null;
    const s = snapPoint(hit); s.y = 0;
    return { point: s, kind: 'ground' };
  }

  /** Which edge of a multi-span run a world point sits nearest to. */
  function nearestEdgeOfRun(run, p) {
    let best = null, bd = Infinity;
    run.edges.forEach((eid) => {
      const e = state.edges.find((x) => x.id === eid); if (!e) return;
      const a = state.nodes.find((n) => n.id === e.a);
      const b = state.nodes.find((n) => n.id === e.b);
      if (!a || !b) return;
      const ap = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const bp = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      const ab = bp.clone().sub(ap);
      const t = THREE.MathUtils.clamp(p.clone().sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
      const d = p.distanceTo(ap.clone().add(ab.multiplyScalar(t)));
      if (d < bd) { bd = d; best = eid; }
    });
    return best;
  }

  function snapPoint(p) {
    const g = state.settings.grid;
    return new THREE.Vector3(
      Math.round(p.x / g) * g, Math.round(p.y / g) * g, Math.round(p.z / g) * g
    );
  }

  // Nearest existing node within a screen-space grab radius.
  function nodeNear(p, tol) {
    tol = tol || state.settings.grid * 0.5;
    let best = null, bd = tol;
    state.nodes.forEach((n) => {
      const d = new THREE.Vector3(n.p[0], n.p[1], n.p[2]).distanceTo(p);
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }

  /**
   * The node to use for a point being placed. Prefers an existing joint, then a
   * point along an existing pole — which splits that pole into a tee — and only
   * makes a loose node if it is really out on its own. Every point of a run
   * goes through this, not just the first, or a run drawn *into* an existing
   * pole would end up touching it with no fitting between them.
   */
  function nodeOrSplitAt(p, skipEdgeIds) {
    const tol = Math.max(60, state.settings.grid * 0.45);
    const near = nodeNear(p, tol);
    if (near) return near.id;

    const skip = skipEdgeIds || [];
    let best = null, bd = tol;
    state.edges.forEach((e) => {
      if (skip.indexOf(e.id) !== -1) return;
      const a = state.nodes.find((n) => n.id === e.a);
      const b = state.nodes.find((n) => n.id === e.b);
      if (!a || !b) return;
      const ap = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const bp = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      const ab = bp.clone().sub(ap), len = ab.length();
      if (len < WELD_END_CLEAR * 2.2) return;
      const t = THREE.MathUtils.clamp(p.clone().sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
      const along = t * len;
      if (along < WELD_END_CLEAR || along > len - WELD_END_CLEAR) return;
      const cp = ap.clone().add(ab.clone().multiplyScalar(t));
      const d = p.distanceTo(cp);
      if (d < bd) { bd = d; best = { edge: e, point: cp }; }
    });

    if (best) {
      const id = addNodeAt(best.point);
      const a = best.edge.a, b = best.edge.b;
      if (a !== id && b !== id) {
        state.edges = state.edges.filter((x) => x.id !== best.edge.id);
        addEdge(a, id); addEdge(id, b);
      }
      return id;
    }
    return addNodeAt(p);
  }

  /** Where the next point should go, given the mouse and the snap mode. */
  function candidatePoint(ev) {
    // the first point of a run has to land on something solid
    if (!drawFrom) {
      const a = anchorPoint(ev);
      pendingAnchor = a;
      return a ? a.point : null;
    }
    pendingAnchor = null;

    const hit = pointerToPlane(ev);
    if (!hit) return null;
    const mode = state.settings.snapMode;

    const from = state.nodes.find((n) => n.id === drawFrom);
    if (!from) { drawFrom = null; return snapPoint(hit); }   // anchor was undone
    const o = new THREE.Vector3(from.p[0], from.p[1], from.p[2]);
    const v = hit.clone().sub(o);
    const g = state.settings.grid;

    // Free mode: any direction on the working plane, or straight up when the
    // vertical modifier is held — height still has to come from somewhere.
    if (mode === 'free' && !vertMode) return hit.clone();

    const dirs = (mode === 'free')
      ? [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]
      : snapDirections(vertMode, mode);
    let best = dirs[0], bestDot = -Infinity;
    dirs.forEach((a) => { const d = v.dot(a); if (d > bestDot) { bestDot = d; best = a; } });
    const len = Math.max(g, Math.round(Math.max(0, bestDot) / g) * g);
    return o.clone().add(best.clone().multiplyScalar(len));
  }

  let shiftHeld = false;
  let vertMode = false;   // hold Shift (or press V) to draw vertically

  function addNodeAt(p) {
    const existing = nodeNear(p, 1);
    if (existing) return existing.id;
    const n = { id: nid(), p: [p.x, p.y, p.z] };
    state.nodes.push(n);
    return n.id;
  }
  function addEdge(a, b) {
    if (a === b) return null;
    const dup = state.edges.find((e) =>
      (e.a === a && e.b === b) || (e.a === b && e.b === a));
    if (dup) return dup.id;
    const e = { id: eid(), a, b };
    state.edges.push(e);
    return e.id;
  }

  /* The camera lives on the middle and right buttons, so the left button is
     free: a click selects or places, a drag sweeps a box over several poles. */
  let press = null;
  const CLICK_PX = 5;

  function marqueeEl() { return $('#marquee'); }

  function onPointerDown(ev) {
    if (xform) return;                            // clicks confirm on release
    if (ev.button !== 0) return;

    // Grabbing a joint handle drags that end straight away. Runs in the capture
    // phase so the orbit controls never see the press.
    if (mode !== 'draw') {
      const h = handleAt(ev);
      if (h) {
        ev.preventDefault(); ev.stopPropagation();
        selection = { type: 'node', id: h };
        rebuild();
        beginTransform('move');
        if (xform) { xform.direct = true; applyTransform(ev); }
        return;
      }
    }
    press = { x: ev.clientX, y: ev.clientY, t: performance.now(), box: false };
  }

  function onPointerUp(ev) {
    if (xform) {
      if (ev.button === 0) endTransform(true);
      else if (ev.button === 2) endTransform(false);
      return;
    }
    if (ev.button === 2) { if (drawFrom) endRun(); return; }
    if (ev.button !== 0 || !press) return;
    const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
    const wasBox = press.box;
    const start = press;
    press = null;
    marqueeEl().style.display = 'none';

    if (wasBox) { boxSelect(start, ev, ev.shiftKey || ev.ctrlKey); return; }
    if (moved > CLICK_PX) return;

    if (mode === 'draw') {
      const p = candidatePoint(ev);
      if (!p) return;
      pushHistory();
      let id;
      if (!drawFrom && pendingAnchor && pendingAnchor.kind === 'joint') {
        id = pendingAnchor.nodeId;                    // build off an existing joint
      } else if (!drawFrom && pendingAnchor && pendingAnchor.kind === 'pole') {
        // starting partway along a pole splits it, giving a tee
        const e = state.edges.find((x) => x.id === pendingAnchor.edgeId);
        id = addNodeAt(p);
        if (e && e.a !== id && e.b !== id) {
          const a = e.a, b = e.b;
          state.edges = state.edges.filter((x) => x.id !== e.id);
          addEdge(a, id); addEdge(id, b);
        }
      } else {
        id = nodeOrSplitAt(p);
      }
      if (drawFrom) addEdge(drawFrom, id);
      drawFrom = id;
      planeY = p.y;
      pendingAnchor = null;
      rebuild();
    } else {
      pickAt(ev);
    }
  }

  function onPointerMove(ev) {
    if (xform) { applyTransform(ev); return; }   // a modal transform owns the mouse

    // highlight a joint handle under the pointer, so it reads as grabbable
    if (!press && mode !== 'draw') {
      const h = handleAt(ev);
      if (h !== hoverNode) {
        hoverNode = h;
        drawHoverRing();
        $('#viewport').style.cursor = h ? 'grab' : 'default';
      }
    }
    // a left drag in select mode sweeps a selection box
    if (press && mode !== 'draw') {
      const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
      if (press.box || moved > CLICK_PX) {
        press.box = true;
        const host = $('#viewport').getBoundingClientRect();
        const m = marqueeEl();
        m.style.display = 'block';
        m.style.left = (Math.min(press.x, ev.clientX) - host.left) + 'px';
        m.style.top = (Math.min(press.y, ev.clientY) - host.top) + 'px';
        m.style.width = Math.abs(ev.clientX - press.x) + 'px';
        m.style.height = Math.abs(ev.clientY - press.y) + 'px';
      }
      return;
    }
    if (mode !== 'draw') return;
    hoverPoint = candidatePoint(ev);
    drawGhost();
  }

  /** Select every pole whose length lies mostly inside the swept box. */
  function boxSelect(from, to, additive) {
    const host = $('#viewport').getBoundingClientRect();
    const x0 = Math.min(from.x, to.clientX) - host.left;
    const x1 = Math.max(from.x, to.clientX) - host.left;
    const y0 = Math.min(from.y, to.clientY) - host.top;
    const y1 = Math.max(from.y, to.clientY) - host.top;
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]));

    const hits = solved.runs.filter((run) => {
      const a = nodeById.get(run.endA), b = nodeById.get(run.endB);
      if (!a || !b) return false;
      const pa = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const pb = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      // sample along the pipe: a pole counts if most of it is in the box
      let inside = 0;
      const N = 9;
      for (let i = 0; i <= N; i++) {
        const p = pa.clone().lerp(pb, i / N).project(camera);
        if (p.z > 1) continue;
        const sx = (p.x * 0.5 + 0.5) * host.width;
        const sy = (-p.y * 0.5 + 0.5) * host.height;
        if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) inside++;
      }
      return inside > N / 2;
    }).map((r) => r.edges[0]);

    if (!hits.length && !additive) { selection = null; rebuild(); return; }
    const prev = additive ? selectedRunIds() : [];
    const ids = prev.slice();
    hits.forEach((id) => { if (ids.indexOf(id) === -1) ids.push(id); });
    selection = ids.length ? { type: 'run', id: ids[0], ids } : null;
    rebuild();
  }

  function endRun() {
    drawFrom = null; ghostGroup.clear();
    pendingAnchor = null;
    planeY = 0;                      // the next run starts from the ground again
    $('#liveLen').style.display = 'none';
    // a single click that never became a pole leaves a joint holding nothing
    const before = state.nodes.length;
    state.nodes = state.nodes.filter((n) => nodeDegree(n.id) > 0);
    setMode('select');
    if (state.nodes.length !== before) rebuild();
  }

  function drawGhost() {
    ghostGroup.clear();
    if (!hoverPoint) return;
    // green while the start point is sitting on something it can stand on
    const anchored = !drawFrom && pendingAnchor;
    const col = anchored
      ? (pendingAnchor.kind === 'ground' ? 0x4da3ff : 0x54e08a)
      : 0x4da3ff;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(state.settings.grid * 0.09, 16, 12),
      new THREE.MeshBasicMaterial({ color: col })
    );
    marker.position.copy(hoverPoint);
    ghostGroup.add(marker);

    // a foot on the ground reads better with a ring lying flat on it
    if (anchored && pendingAnchor.kind === 'ground') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(state.settings.grid * 0.3, 3.5, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(hoverPoint);
      ghostGroup.add(ring);
    }

    if (!drawFrom) {
      const el = $('#liveLen');
      el.textContent = anchored
        ? ({ ground: 'On the ground', joint: 'From this joint', pole: 'Tee off this pole' })[pendingAnchor.kind]
        : 'Nowhere to stand — aim at the ground or a pole';
      el.style.display = 'block';
    }

    const from = drawFrom ? state.nodes.find((n) => n.id === drawFrom) : null;
    if (drawFrom && !from) drawFrom = null;                  // anchor was undone
    if (from) {
      const a = new THREE.Vector3(from.p[0], from.p[1], from.p[2]);
      const len = a.distanceTo(hoverPoint);
      if (len > 1) {
        const pipe = window.KCModels.buildPipe(len, true);
        pipe.material = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.55 });
        const mid = a.clone().add(hoverPoint).multiplyScalar(0.5);
        pipe.position.copy(mid);
        pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
          hoverPoint.clone().sub(a).normalize());
        ghostGroup.add(pipe);
        // show the turn angle and the fitting it will need at the previous joint
        let extra = '';
        const prev = state.edges.filter((e) => e.a === drawFrom || e.b === drawFrom);
        if (prev.length) {
          const dirs = prev.map((e) => {
            const o = state.nodes.find((n) => n.id === (e.a === drawFrom ? e.b : e.a));
            return o ? new THREE.Vector3(o.p[0], o.p[1], o.p[2]).sub(a).normalize() : null;
          }).filter(Boolean);
          if (dirs.length) {
            const nd = hoverPoint.clone().sub(a).normalize();
            const ang = THREE.MathUtils.radToDeg(
              Math.acos(THREE.MathUtils.clamp(dirs[0].dot(nd), -1, 1)));
            const fitName = previewFitting(drawFrom, dirs.concat([nd]));
            extra = ' · ' + Math.round(ang) + '°' + (fitName ? ' · ' + fitName : '');
          }
        }
        $('#liveLen').textContent = fmtLen(len) + extra;
        $('#liveLen').style.display = 'block';
      }
    } else {
      $('#liveLen').style.display = 'none';
    }
  }

  /* ---- modal move / rotate, Blender style -------------------------------
     G grabs, R rotates. The mouse drives it with no button held; X/Y/Z lock to
     an axis, digits type an exact value, click or Enter confirms, Esc or
     right-click puts everything back.

     Axis letters follow Blender, not three.js: Z is up. The map below is the
     only place that translates.                                          */

  // Keyed by the letter you type. Z is up, so this is also the only place the
  // Blender convention is translated into three.js's Y-up world.
  const AXIS_VEC = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 0, 1),
    z: new THREE.Vector3(0, 1, 0)
  };
  const ROT_SNAP = 15;                                 // degrees, Shift for fine
  const WELD_END_CLEAR = 120;   // mm — no tee closer than this to a pole's end,
                                // it would leave a stub too short to fit anything

  let xform = null;

  /** Every node the current selection should drag along with it. */
  function selectedNodeIds() {
    if (!selection) return [];
    if (selection.type === 'node') return [selection.id];
    const ids = new Set();
    currentRuns().forEach((r) => {
      r.edges.forEach((eid) => {
        const e = state.edges.find((x) => x.id === eid);
        if (e) { ids.add(e.a); ids.add(e.b); }
      });
    });
    return Array.from(ids);
  }

  /** Where the pointer ray meets a plane through `point` with normal `n`. */
  function rayOnPlane(ev, n, point) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, point);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
  }

  /** Screen angle of the pointer about the pivot, for rotation. */
  function screenAngle(ev, pivot) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    const p = pivot.clone().project(camera);
    const px = (p.x * 0.5 + 0.5) * r.width, py = (-p.y * 0.5 + 0.5) * r.height;
    return Math.atan2((ev.clientY - r.top) - py, (ev.clientX - r.left) - px);
  }

  /**
   * If the selected poles hang off the rest of the structure by exactly one
   * joint, and that joint sits on a straight pole, the assembly can only really
   * do one thing: ride up and down that pole. Constraining the move to the host
   * pole's axis keeps the host straight, instead of dragging its joint sideways
   * and bending it. Returns the axis to slide along, or null.
   */
  function slideConstraint(ids, selEdges) {
    if (!selEdges || !selEdges.size) return null;
    const anchors = [];
    ids.forEach((id) => {
      const ext = state.edges.filter((e) =>
        (e.a === id || e.b === id) && !selEdges.has(e.id));
      if (ext.length) anchors.push({ id, ext });
    });
    if (anchors.length !== 1) return null;          // free-floating, or pinned twice

    const { id, ext } = anchors[0];
    const n = state.nodes.find((x) => x.id === id);
    if (!n) return null;
    const o = new THREE.Vector3(n.p[0], n.p[1], n.p[2]);
    const dirs = ext.map((e) => {
      const other = state.nodes.find((x) => x.id === (e.a === id ? e.b : e.a));
      return new THREE.Vector3(other.p[0], other.p[1], other.p[2]).sub(o).normalize();
    });

    let axis = null;
    if (dirs.length === 1) {
      axis = dirs[0].clone();                       // hanging off the end of a pole
    } else {
      for (let i = 0; i < dirs.length && !axis; i++) {
        for (let j = i + 1; j < dirs.length; j++) {
          if (dirs[i].dot(dirs[j]) < -0.98) { axis = dirs[i].clone(); break; }
        }
      }
    }
    if (!axis) return null;                         // a corner, not a straight pole
    axis.normalize();
    // point it "up the pole" so the readout reads the way the thing moves
    if (axis.y < -0.01 || (Math.abs(axis.y) <= 0.01 && axis.x + axis.z < 0)) axis.negate();
    return { nodeId: id, axis, origin: o };
  }

  function beginTransform(kind) {
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    // `ids` and `origin` are indexed against each other all through the
    // transform, so build the node list from the ids rather than re-filtering
    // state.nodes — those two orders are not the same.
    const ids = selectedNodeIds().filter((id) => byId.has(id));
    if (!ids.length) { toast('Select a pole or joint first'); return; }

    const nodes = ids.map((id) => byId.get(id));
    const pivot = new THREE.Vector3();
    nodes.forEach((n) => pivot.add(new THREE.Vector3(n.p[0], n.p[1], n.p[2])));
    pivot.multiplyScalar(1 / nodes.length);

    xform = {
      kind, ids,
      // held rather than pushed, so cancelling leaves no trace in the undo stack
      before: snapshot(),
      origin: nodes.map((n) => n.p.slice()),
      pivot,
      axis: kind === 'rotate' ? 'z' : null,   // rotating on the ground is the common case
      startHit: null, startAngle: null,
      typed: '', fine: false, delta: 0
    };

    // poles attached to the rest of the structure at one joint slide along it
    if (kind === 'move' && selection && selection.type === 'run') {
      const selEdges = new Set();
      currentRuns().forEach((r) => r.edges.forEach((e) => selEdges.add(e)));
      xform.slide = slideConstraint(ids, selEdges);
    }
    controls.enabled = false;
    $('#viewport').style.cursor = kind === 'move' ? 'move' : 'crosshair';
    drawXformHud();
  }

  /**
   * While dragging, look for something to join onto: a stationary joint, or a
   * point along a stationary pole. Returns the best target and the offset that
   * would land the moved geometry exactly on it — applied to the whole
   * selection, so it shifts as one piece rather than distorting.
   */
  function findSnap(byId) {
    const moving = new Set(xform.ids);
    const thr = Math.max(80, state.settings.grid * 0.75);
    const stillNodes = state.nodes.filter((n) => !moving.has(n.id));
    const stillEdges = state.edges.filter((e) => !moving.has(e.a) && !moving.has(e.b));
    let node = null, edge = null;

    xform.ids.forEach((id) => {
      const m = byId.get(id); if (!m) return;
      const mp = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);

      stillNodes.forEach((s) => {
        const sp = new THREE.Vector3(s.p[0], s.p[1], s.p[2]);
        const d = mp.distanceTo(sp);
        if (d < thr && (!node || d < node.d)) {
          node = { d, kind: 'node', nodeId: id, offset: sp.clone().sub(mp), point: sp };
        }
      });

      stillEdges.forEach((e) => {
        const a = byId.get(e.a), b = byId.get(e.b); if (!a || !b) return;
        const ap = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
        const bp = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
        const ab = bp.clone().sub(ap);
        const len = ab.length(); if (len < WELD_END_CLEAR * 2.2) return;
        const t = THREE.MathUtils.clamp(mp.clone().sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
        const along = t * len;
        // a tee right next to an end leaves an unbuildable stub
        if (along < WELD_END_CLEAR || along > len - WELD_END_CLEAR) return;
        const cp = ap.clone().add(ab.clone().multiplyScalar(t));
        const d = mp.distanceTo(cp);
        if (d < thr && (!edge || d < edge.d)) {
          edge = { d, kind: 'edge', nodeId: id, edgeId: e.id, offset: cp.clone().sub(mp), point: cp };
        }
      });
    });

    // An existing joint always wins. Splitting a pole is the fallback, or you
    // could never land on a corner without cutting the pole beside it in two.
    return node || edge;
  }

  /** Draw a ring where the selection would join. */
  function drawSnapMarker() {
    ghostGroup.clear();
    if (!xform || !xform.snap) return;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(46, 5, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x54e08a })
    );
    ring.quaternion.copy(camera.quaternion);
    g.add(ring);
    g.position.copy(xform.snap.point);
    ghostGroup.add(g);
  }

  /** On confirm, actually join what was snapped: weld coincident joints, and
   *  split a pole in two if something landed partway along it. */
  function weldTransform() {
    if (!xform || !xform.snap) return false;
    const snap = xform.snap;

    // landing mid-pole turns that pole into two, meeting at the moved joint
    if (snap.kind === 'edge') {
      const e = state.edges.find((x) => x.id === snap.edgeId);
      if (e && e.a !== snap.nodeId && e.b !== snap.nodeId) {
        const a = e.a, b = e.b;
        state.edges = state.edges.filter((x) => x.id !== e.id);
        addEdge(a, snap.nodeId);
        addEdge(snap.nodeId, b);
      }
    }

    // any moved joint now sitting on a stationary one becomes that joint
    const moving = new Set(xform.ids);
    let joined = 0;
    xform.ids.forEach((id) => {
      const m = state.nodes.find((n) => n.id === id); if (!m) return;
      const t = state.nodes.find((n) => !moving.has(n.id) &&
        Math.abs(n.p[0] - m.p[0]) < 1 &&
        Math.abs(n.p[1] - m.p[1]) < 1 &&
        Math.abs(n.p[2] - m.p[2]) < 1);
      if (!t) return;
      state.edges.forEach((e) => {
        if (e.a === m.id) e.a = t.id;
        if (e.b === m.id) e.b = t.id;
      });
      state.nodes = state.nodes.filter((n) => n.id !== m.id);
      delete state.overrides[m.id];
      joined++;
    });

    // welding can leave a pole joined to itself, or two poles doubled up
    dedupeEdges();
    return joined > 0 || snap.kind === 'edge';
  }

  /** Fold node `from` into node `into`, moving its poles across. */
  function mergeNodes(from, into) {
    state.edges.forEach((e) => {
      if (e.a === from.id) e.a = into.id;
      if (e.b === from.id) e.b = into.id;
    });
    state.nodes = state.nodes.filter((n) => n.id !== from.id);
    delete state.overrides[from.id];
    dedupeEdges();
  }

  function dedupeEdges() {
    const seen = new Set();
    state.edges = state.edges.filter((e) => {
      if (e.a === e.b) return false;
      const k = [e.a, e.b].sort().join('|');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  const nodeDegree = (id) =>
    state.edges.reduce((n, e) => n + (e.a === id || e.b === id ? 1 : 0), 0);

  /**
   * One-shot cleanup for a structure built with poles left not quite touching.
   * Ends within tolerance of each other become one joint; an end resting on the
   * side of another pole splits it into a tee. Repeats until nothing changes,
   * since one weld can bring the next pair into range.
   */
  function weldAll(tol) {
    pushHistory();
    const V = (n) => new THREE.Vector3(n.p[0], n.p[1], n.p[2]);
    let joins = 0, tees = 0, guard = 0;

    // ends that nearly touch
    for (let again = true; again && guard < 400; guard++) {
      again = false;
      for (let i = 0; i < state.nodes.length && !again; i++) {
        for (let j = i + 1; j < state.nodes.length; j++) {
          const A = state.nodes[i], B = state.nodes[j];
          if (V(A).distanceTo(V(B)) > tol) continue;
          // keep the busier joint's position — it is the one holding things up
          const keep = nodeDegree(B.id) > nodeDegree(A.id) ? B : A;
          mergeNodes(keep === A ? B : A, keep);
          joins++; again = true; break;
        }
      }
    }

    // ends resting on the side of a pole
    for (let again = true; again && guard < 800; guard++) {
      again = false;
      const edges = state.edges.slice();
      for (const e of edges) {
        const a = state.nodes.find((n) => n.id === e.a);
        const b = state.nodes.find((n) => n.id === e.b);
        if (!a || !b) continue;
        const ap = V(a), bp = V(b), ab = bp.clone().sub(ap), len = ab.length();
        if (len < WELD_END_CLEAR * 2.2) continue;
        const hit = state.nodes.find((n) => {
          if (n.id === e.a || n.id === e.b) return false;
          const t = THREE.MathUtils.clamp(V(n).sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
          const along = t * len;
          if (along < WELD_END_CLEAR || along > len - WELD_END_CLEAR) return false;
          return V(n).distanceTo(ap.clone().add(ab.clone().multiplyScalar(t))) <= tol;
        });
        if (!hit) continue;
        // pull it exactly onto the pole, then split the pole at it
        const t = THREE.MathUtils.clamp(V(hit).sub(ap).dot(ab) / ab.lengthSq(), 0, 1);
        const cp = ap.clone().add(ab.clone().multiplyScalar(t));
        hit.p = [cp.x, cp.y, cp.z];
        state.edges = state.edges.filter((x) => x.id !== e.id);
        addEdge(e.a, hit.id); addEdge(hit.id, e.b);
        dedupeEdges();
        tees++; again = true; break;
      }
    }

    // a pole with nothing left at one end is not a pole
    state.nodes = state.nodes.filter((n) => nodeDegree(n.id) > 0);
    selection = null;
    rebuild();

    if (!joins && !tees) { toast('Nothing close enough to join'); return { joins, tees }; }
    const bits = [];
    if (joins) bits.push(joins + (joins === 1 ? ' joint' : ' joints'));
    if (tees) bits.push(tees + (tees === 1 ? ' tee' : ' tees'));
    toast('Welded ' + bits.join(' and '));
    return { joins, tees };
  }

  /**
   * Carry on from the selected pole: a copy of the same length and direction,
   * joined to its far end. Starting a fresh run from the tip of an angled pole
   * is fiddly; this just continues the line, and you can bend it afterwards
   * with R or by dragging the new end.
   */
  function duplicateRun() {
    const runs = currentRuns();
    if (!runs.length) { toast('Select a pole first'); return; }
    pushHistory();
    const made = [];
    runs.forEach((run) => {
      const byId = new Map(state.nodes.map((n) => [n.id, n]));
      const a = byId.get(run.endA), b = byId.get(run.endB);
      if (!a || !b) return;
      // grow from the loose end if there is one, so a run extends outwards
      const fromFree = nodeDegree(b.id) === 1 ? b : (nodeDegree(a.id) === 1 ? a : b);
      const other = fromFree === b ? a : b;
      const tip = new THREE.Vector3(fromFree.p[0], fromFree.p[1], fromFree.p[2]);
      const dir = tip.clone().sub(new THREE.Vector3(other.p[0], other.p[1], other.p[2]));
      const end = tip.clone().add(dir);
      const id = addNodeAt(end);
      const eid2 = addEdge(fromFree.id, id);
      if (eid2) made.push(eid2);
    });
    if (!made.length) { toast('Nothing to continue'); return; }
    selection = { type: 'run', id: made[0], ids: made };
    clickAnchor = null; anchorFor = null;
    rebuild();
    toast(made.length > 1 ? made.length + ' poles added' : 'Pole added — G to move, R to angle');
  }

  /**
   * Copy the selected poles and hand them straight to the move tool, so they
   * follow the mouse until you click to place them. Escape throws the copy away
   * rather than leaving it stacked invisibly on the original.
   */
  function duplicateSelection() {
    const runs = currentRuns();
    if (!runs.length) { toast('Select a pole first'); return; }
    const before = snapshot();

    const edgeIds = new Set();
    runs.forEach((r) => r.edges.forEach((id) => edgeIds.add(id)));
    const nodeIds = new Set();
    edgeIds.forEach((id) => {
      const e = state.edges.find((x) => x.id === id);
      if (e) { nodeIds.add(e.a); nodeIds.add(e.b); }
    });

    const map = new Map();
    nodeIds.forEach((id) => {
      const n = state.nodes.find((x) => x.id === id); if (!n) return;
      const copy = { id: nid(), p: n.p.slice() };
      state.nodes.push(copy);
      map.set(id, copy.id);
    });
    const made = [];
    edgeIds.forEach((id) => {
      const e = state.edges.find((x) => x.id === id); if (!e) return;
      const ne = addEdge(map.get(e.a), map.get(e.b));
      if (ne) made.push(ne);
    });
    if (!made.length) { state.nodes = JSON.parse(before).nodes; return; }

    selection = { type: 'run', id: made[0], ids: made };
    clickAnchor = null; anchorFor = null;
    rebuild();
    beginTransform('move');
    if (xform) {
      xform.before = before;         // undo/cancel go back past the copy itself
      xform.isDup = true;
    }
    toast(made.length > 1 ? made.length + ' poles copied — click to place' : 'Copied — click to place');
  }

  /**
   * Fill the opening framed by the selected poles with a sheet, bolted on with
   * Double Fixing Pads. Stored as the poles it hangs on, so it follows the
   * frame when the frame is moved or resized.
   */
  const currentSheet = () =>
    window.CATALOGUE.SHEETS.find((s) => s.id === state.settings.sheet)
    || window.CATALOGUE.SHEETS[0];

  function addPanel() {
    const runs = currentRuns();
    if (runs.length < 2) { toast('Select the poles around an opening first'); return; }
    const edges = [];
    runs.forEach((r) => r.edges.forEach((e) => { if (edges.indexOf(e) === -1) edges.push(e); }));

    const panel = {
      id: 'pn' + (uid++),
      edges,
      material: state.settings.sheet
    };
    const solvedPanel = window.KCEngine.solvePanel(panel, state);
    if (!solvedPanel) { toast('Those poles do not frame a flat opening'); return; }

    pushHistory();
    state.panels.push(panel);
    selection = null;
    rebuild();
    const a = solvedPanel.areaM2.toFixed(2);
    toast(solvedPanel.warn
      ? 'Panel added — ' + solvedPanel.warn
      : 'Panel added · ' + a + ' m² · ' + solvedPanel.pads + ' fixing pads');
  }

  function deletePanel(id) {
    pushHistory();
    state.panels = state.panels.filter((p) => p.id !== id);
    selection = null;
    rebuild();
  }

  function resetXformNodes() {
    if (!xform) return;
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    xform.ids.forEach((id, i) => {
      const n = byId.get(id); if (n) n.p = xform.origin[i].slice();
    });
  }

  function applyTransform(ev) {
    if (!xform) return;
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    resetXformNodes();

    if (xform.kind === 'move') {
      let delta = new THREE.Vector3();
      if (xform.typed !== '' && xform.axis) {
        delta = AXIS_VEC[xform.axis].clone().multiplyScalar(parseFloat(xform.typed) || 0);
      } else if (ev) {
        // A slide is an axis constraint like any other, so read the mouse on a
        // plane containing that axis — a horizontal plane can never yield
        // vertical movement, which is most of what sliding up a post is.
        const axis = xform.axis ? AXIS_VEC[xform.axis]
                   : (xform.slide ? xform.slide.axis : null);
        let normal, hit;
        if (axis) {
          // a plane that contains the axis and faces the camera as much as it can
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          normal = new THREE.Vector3().crossVectors(axis, camDir).cross(axis).normalize();
          if (!isFinite(normal.x) || normal.lengthSq() < 1e-6) normal = new THREE.Vector3(0, 1, 0);
        } else {
          normal = new THREE.Vector3(0, 1, 0);         // slide across the ground
        }
        hit = rayOnPlane(ev, normal, xform.pivot);
        if (!hit) { drawXformHud(); return; }
        if (!xform.startHit) xform.startHit = hit.clone();
        delta = hit.clone().sub(xform.startHit);
        if (axis) delta = axis.clone().multiplyScalar(delta.dot(axis));
        const step = xform.fine ? 1 : state.settings.grid;
        delta.set(Math.round(delta.x / step) * step,
                  Math.round(delta.y / step) * step,
                  Math.round(delta.z / step) * step);
      }
      // Ride the host pole rather than dragging its joint off the line. An
      // explicit axis lock (X/Y/Z) means the user wants free movement instead.
      if (xform.slide && !xform.axis) {
        const step = xform.fine ? 1 : state.settings.grid;
        let t = delta.dot(xform.slide.axis);
        t = Math.round(t / step) * step;
        delta = xform.slide.axis.clone().multiplyScalar(t);
      }

      xform.delta = delta;
      xform.ids.forEach((id, i) => {
        const n = byId.get(id); if (!n) return;
        const o = xform.origin[i];
        n.p = [o[0] + delta.x, o[1] + delta.y, o[2] + delta.z];
      });

    } else {
      let deg;
      if (xform.typed !== '') {
        deg = parseFloat(xform.typed) || 0;
      } else if (ev) {
        const a = screenAngle(ev, xform.pivot);
        if (xform.startAngle === null) xform.startAngle = a;
        deg = THREE.MathUtils.radToDeg(a - xform.startAngle);
        const step = xform.fine ? 1 : ROT_SNAP;
        deg = Math.round(deg / step) * step;
      } else { deg = xform.delta || 0; }
      xform.delta = deg;

      const axis = AXIS_VEC[xform.axis || 'z'];
      const q = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg));
      // Positions stay exact. Snapping rotated coordinates to the grid would
      // stretch the poles and knock the corners off square — the angle is what
      // gets snapped, not the geometry it produces.
      xform.ids.forEach((id, i) => {
        const n = byId.get(id); if (!n) return;
        const o = xform.origin[i];
        const v = new THREE.Vector3(o[0], o[1], o[2]).sub(xform.pivot).applyQuaternion(q).add(xform.pivot);
        n.p = [v.x, v.y, v.z];
      });
    }

    // Look for something to join onto — but never when an exact value was
    // typed, since that is a deliberate measurement, not a gesture.
    xform.snap = null;
    // Sliding is already anchored to a pole; letting the snap pull it off that
    // line would defeat the constraint.
    const sliding = !!(xform.slide && !xform.axis && xform.kind === 'move');
    // A copy starts life on top of its original, which would snap straight back
    // into it. Hold snapping off until it has been dragged clear.
    const clearOfOrigin = !xform.isDup ||
      (xform.kind === 'move' && xform.delta && xform.delta.length
        ? xform.delta.length() > Math.max(80, state.settings.grid * 0.75) * 1.25
        : false);
    if (xform.typed === '' && !xform.fine && clearOfOrigin && !sliding) {
      const s = findSnap(byId);
      if (s) {
        xform.snap = s;
        xform.ids.forEach((id) => {
          const n = byId.get(id); if (!n) return;
          n.p = [n.p[0] + s.offset.x, n.p[1] + s.offset.y, n.p[2] + s.offset.z];
        });
      }
    }

    rebuild();
    drawSnapMarker();
    drawXformHud();
    showDragLengths();
  }

  /** While dragging an end, show what it is doing to the poles it holds up. */
  function showDragLengths() {
    const el = $('#liveLen');
    if (!xform) { el.style.display = 'none'; return; }
    const touched = solved.runs.filter((r) =>
      xform.ids.indexOf(r.endA) !== -1 || xform.ids.indexOf(r.endB) !== -1);
    if (!touched.length) { el.style.display = 'none'; return; }
    el.textContent = touched.slice(0, 3).map((r) => fmtLen(r.cut)).join('  ·  ') +
      (touched.length > 3 ? '  · …' : '');
    el.style.display = 'block';
  }

  function drawXformHud() {
    const el = $('#xform');
    if (!xform) { el.classList.remove('on'); return; }
    const axisName = xform.axis ? xform.axis.toUpperCase() + (xform.axis === 'z' ? ' (up)' : '') : 'free';
    let main;
    if (xform.kind === 'move') {
      const d = xform.delta || new THREE.Vector3();
      if (xform.slide && !xform.axis) {
        const t = d.dot ? d.dot(xform.slide.axis) : 0;
        main = 'Slide along pole  ' + (t > 0 ? '+' : '') + Math.round(t) + ' mm';
      } else if (xform.typed !== '') {
        main = 'Move ' + axisName + ' ' + xform.typed + ' mm';
      } else {
        main = 'Move ' + axisName + '  ' +
          [d.x, d.y, d.z].map((v) => (v > 0 ? '+' : '') + Math.round(v)).join(', ') + ' mm';
      }
    } else {
      main = 'Rotate ' + axisName + '  ' +
        (xform.typed !== '' ? xform.typed : Math.round(xform.delta || 0)) + '°';
    }
    // The angles this move is creating, which decide the fittings. Moving one
    // end swings the pole about its far joint, so that joint counts too.
    const touched = new Set(xform.ids);
    state.edges.forEach((e) => {
      if (touched.has(e.a)) touched.add(e.b);
      else if (touched.has(e.b)) touched.add(e.a);
    });
    const angles = [];
    solved.joints.forEach((j, id) => {
      if (!touched.has(id) || !j.dirs || j.dirs.length < 2) return;
      for (let i = 0; i < j.dirs.length; i++) {
        for (let k = i + 1; k < j.dirs.length; k++) {
          const d = Math.round(THREE.MathUtils.radToDeg(
            Math.acos(THREE.MathUtils.clamp(j.dirs[i].dot(j.dirs[k]), -1, 1))));
          if (d < 179 && angles.indexOf(d) === -1) angles.push(d);
        }
      }
    });
    if (angles.length) main += '   ' + angles.slice(0, 4).map((d) => d + '°').join(' ');

    if (xform.snap) {
      main += xform.snap.kind === 'edge' ? '   → joins onto pole' : '   → joins at joint';
    }
    $('#xformLabel').textContent = main;
    $('#xformHint').textContent = xform.snap
      ? 'release to join · Shift holds it off'
      : (xform.slide && !xform.axis)
        ? 'held on the pole it hangs from · X Y Z to break away · Esc cancels'
        : 'X Y Z axis · type a number · Shift fine · click to confirm · Esc cancels';
    el.classList.toggle('snapped', !!xform.snap);
    el.classList.add('on');
  }

  function endTransform(keep) {
    if (!xform) return;
    let joined = false;
    if (keep) {
      joined = weldTransform();
      history.push(xform.before); if (history.length > 80) history.shift();
      future = [];
    } else if (xform.isDup) {
      restore(xform.before);         // discard the copy outright
    } else {
      resetXformNodes(); rebuild();
    }
    xform = null;
    ghostGroup.clear();
    $('#liveLen').style.display = 'none';
    hoverNode = null; drawHoverRing();
    if (joined) { selection = null; rebuild(); toast('Joined'); }
    controls.enabled = true;
    $('#viewport').style.cursor = mode === 'draw' ? 'crosshair' : 'default';
    $('#xform').classList.remove('on');
  }

  /* ---- pole resizer widget --------------------------------------------- */

  function previewFitting(nodeId, dirs) {
    const n = state.nodes.find((x) => x.id === nodeId);
    if (!n) return '';
    const f = window.KCEngine.pickFitting(n, dirs);
    return f ? f.name : 'no standard fitting';
  }

  let widgetAnchor = null;   // world position the widget tracks
  let clickAnchor = null;    // exact spot the pole was clicked, if it was clicked
  let anchorFor = null;      // which selection the current anchor belongs to
  let flipEnd = false;       // which end of the run grows

  /** The ids of every selected pole (one, or many after a box select). */
  function selectedRunIds() {
    if (!selection || selection.type !== 'run') return [];
    return selection.ids && selection.ids.length ? selection.ids : [selection.id];
  }

  function currentRun() {
    if (!selection || selection.type !== 'run') return null;
    return solved.runs.find((r) => r.edges[0] === selection.id) || null;
  }

  function currentRuns() {
    const ids = selectedRunIds();
    return ids.map((id) => solved.runs.find((r) => r.edges[0] === id)).filter(Boolean);
  }

  /** Every node at or beyond `from` along `dir` — the part that moves when a
   *  pole is stretched, so a frame keeps its shape instead of skewing. */
  function nodesBeyond(fromNode, dir) {
    const base = new THREE.Vector3(fromNode.p[0], fromNode.p[1], fromNode.p[2]).dot(dir);
    return state.nodes.filter((n) =>
      new THREE.Vector3(n.p[0], n.p[1], n.p[2]).dot(dir) > base - 0.5);
  }

  /** Resize a run to a new cut length.
   *  The length is read back from the live node positions rather than the
   *  solved snapshot, so resizing several poles in a row — or the same pole
   *  twice — stays correct even when they share joints. */
  function setRunLength(run, newCut) {
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
    let a = nodeById.get(run.endA), b = nodeById.get(run.endB);
    if (!a || !b) return;
    if (flipEnd) { const t = a; a = b; b = t; }
    const pa = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
    const pb = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
    const dir = pb.clone().sub(pa).normalize();
    if (!isFinite(dir.x)) return;

    // cut length as it stands right now, however much has moved since the solve
    const liveCut = run.cut + (pa.distanceTo(pb) - run.centreLen);
    const delta = newCut - liveCut;
    if (Math.abs(delta) < 0.01) return;

    const moving = state.settings.stretch ? nodesBeyond(b, dir) : [b];
    moving.forEach((n) => {
      n.p = [n.p[0] + dir.x * delta, n.p[1] + dir.y * delta, n.p[2] + dir.z * delta];
    });
  }

  function showWidget() {
    const w = $('#poleWidget');
    if (xform || (selection && selection.type === 'panel')) {
      w.classList.remove('on'); return;                // out of the way
    }
    const runs = currentRuns();
    const run = runs[0];
    if (!run) {
      w.classList.remove('on');
      widgetAnchor = anchorFor = clickAnchor = null;
      return;
    }

    // The anchor is set when you click and then left alone, so dragging the
    // slider does not drag the panel around with the pole it is resizing. It
    // still tracks the camera, so it stays with the pole when you orbit.
    const key = selectedRunIds().join(',');
    if (clickAnchor) {
      widgetAnchor = clickAnchor.clone();          // exactly where you clicked
      anchorFor = key;
      clickAnchor = null;
    } else if (key !== anchorFor) {
      // selected from script or the keyboard: fall back to the midpoint
      const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
      widgetAnchor = new THREE.Vector3();
      runs.forEach((r) => {
        const pa = nodeById.get(r.endA).p, pb = nodeById.get(r.endB).p;
        widgetAnchor.add(new THREE.Vector3(
          (pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2));
      });
      widgetAnchor.multiplyScalar(1 / runs.length);
      anchorFor = key;
    }

    const cut = Math.round(run.cut);
    const mixed = runs.some((r) => Math.abs(r.cut - run.cut) > 0.5);
    $('#pwTitle').textContent = runs.length > 1
      ? runs.length + ' poles' + (mixed ? ' · mixed lengths' : '')
      : (run.spans > 1 ? 'Pole run · ' + run.spans + ' spans' : 'Pole');
    $('#pwNum').value = cut;
    const std = state.settings.standardOnly;
    const slider = $('#pwSlider');
    slider.min = std ? 500 : 100;
    slider.max = MAX_POLE;                     // 3 m is the longest pipe sold
    slider.step = std ? 500 : 10;              // whole pipes come in 500 mm steps
    slider.value = Math.min(cut, MAX_POLE);
    $('#pwStretch').checked = state.settings.stretch;
    $('#pwLock').checked = state.settings.lockAngles;
    $('#pwStd').checked = std;

    // whole pipes, used uncut — the lengths that cost exactly what the site says
    $('#pwStock').innerHTML = window.CATALOGUE.TUBE.stock.map((s) =>
      '<button data-mm="' + s.mm + '"' +
      (Math.abs(s.mm - cut) < 1 ? ' class="hit"' : '') + '>' +
      (s.mm / 10) + 'cm</button>').join('');
    $$('#pwStock button').forEach((b) => {
      b.onclick = () => { pushHistory(); applyLength(+b.dataset.mm); };
    });

    const over = cut > 3000;
    let lock = '';
    if (lastLock === 'stuck') {
      lock = ' <b>No nearby length keeps every joint buildable' +
        (state.settings.stretch ? '.' : ' — try Stretch structure.') + '</b>';
    } else if (typeof lastLock === 'number') {
      lock = ' <i>Snapped to ' + lastLock + ' mm to keep the joints buildable.</i>';
      // a big jump means the free end simply cannot go where it was dragged
      if (!state.settings.stretch && Math.abs(lastLock - lastAsked) > 100) {
        lock += ' Turn on Stretch structure to move it freely.';
      }
    }
    const stdNote = std
      ? (stockLengths().indexOf(cut) !== -1
          ? '<i>Whole ' + (cut / 10) + ' cm pipe, uncut.</i> '
          : '<b>Not a stock length — the slider will snap to one.</b> ')
      : '';
    $('#pwNote').innerHTML =
      (runs.length > 1
        ? 'Sets all ' + runs.length + ' to the same length. '
        : 'Centre-to-centre ' + fmtLen(run.centreLen) + '. ') +
      stdNote +
      (state.settings.stretch
        ? 'Everything beyond this pole moves with it.'
        : 'Only this pole&rsquo;s far joint moves.') +
      lock +
      (over ? ' <b>Over 3&nbsp;m — a sleeve joint will be added.</b>' : '');

    w.classList.add('on');
    positionWidget();
  }

  function positionWidget() {
    const w = $('#poleWidget');
    if (!widgetAnchor) return;
    const host = $('#viewport');
    const p = widgetAnchor.clone().project(camera);
    // visibility lives entirely on the class, so closing the widget sticks
    if (p.z > 1) { w.classList.remove('on'); return; }
    w.classList.add('on');
    const x = (p.x * 0.5 + 0.5) * host.clientWidth;
    const y = (-p.y * 0.5 + 0.5) * host.clientHeight;
    if (!isFinite(x) || !isFinite(y)) return;      // panel not laid out yet

    // Sit the panel well clear of the pole you clicked, on whichever side has
    // room, and centred on the click so it never covers what it is editing.
    const pad = 10, gap = 56, ww = w.offsetWidth, wh = w.offsetHeight;
    let left = x + gap;
    if (left + ww > host.clientWidth - pad) left = x - gap - ww;
    w.style.left = Math.max(pad, Math.min(host.clientWidth - ww - pad, left)) + 'px';
    w.style.top = Math.max(pad, Math.min(host.clientHeight - wh - pad, y - wh / 2)) + 'px';
  }

  /* ---- angle lock -------------------------------------------------------
     Moving one joint can swing the pipes around it onto an angle no casting
     makes, which quietly turns cheap 90° corners into swivel pairs — or into
     nothing orderable at all. With the lock on we search outwards from the
     length you asked for and stop at the nearest one whose joints are all
     still buildable. */

  const snapshotPositions = () => state.nodes.map((n) => n.p.slice());
  const restorePositions = (snap) =>
    state.nodes.forEach((n, i) => { n.p = snap[i].slice(); });

  /** Lower is better: 10 for a joint that cannot actually be made, 1 for one
   *  that needs an adjustable swivel instead of a fixed casting.
   *  A joint with no `socketFor` came from the solver's last-resort fallback —
   *  it has a fitting pencilled in, but the sockets do not line up with the
   *  pipes, so it is not buildable. */
  function jointPenalty() {
    let score = 0, worst = 1;
    window.KCEngine.solveJoints(state).forEach((j) => {
      if (!j.fit || !j.socketFor) { score += 10; return; }
      if (j.fit.variable) score += 1;
      // how squarely the sockets actually point down the pipes
      const sock = [];
      j.fit.sockets.forEach((s) => {
        const v = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2])
          .normalize().applyQuaternion(j.quat);
        sock.push(v);
        if (s.kind === 'through' || s.kind === 'clamp') sock.push(v.clone().negate());
      });
      j.dirs.forEach((nd) => {
        let m = -1;
        sock.forEach((s) => { const d = s.dot(nd); if (d > m) m = d; });
        if (m < worst) worst = m;
      });
    });
    // Any tolerance leaves a band of nearly-square lengths that all "fit", so
    // fold the alignment error into the score: dead square beats nearly square.
    return score + (1 - worst) * 20;
  }

  const LOCK_RANGE = 700, LOCK_COARSE = 20, LOCK_FINE = 5;   // mm
  // The longest pipe sold is 3 m; anything past that needs a second pipe and a
  // sleeve, so there is no point offering it on the slider.
  const MAX_POLE = 3000;

  /**
   * The length nearest `desired` that makes the joints as buildable as they can
   * be nearby — not merely no worse than they are now, so a structure that has
   * already been pulled off-angle can be recovered by nudging the slider.
   * Coarse pass first, then a fine pass around the winner.
   */
  const stockLengths = () => window.CATALOGUE.TUBE.stock.map((s) => s.mm);
  const nearestStock = (mm) => stockLengths()
    .reduce((a, b) => (Math.abs(b - mm) < Math.abs(a - mm) ? b : a));

  function lockedLength(runs, desired) {
    const snap = snapshotPositions();
    const scoreAt = (cut) => {
      restorePositions(snap);
      runs.forEach((run) => setRunLength(run, cut));
      const s = jointPenalty();
      restorePositions(snap);
      return s;
    };

    const EPS = 1e-4;
    if (scoreAt(desired) < EPS) return { mm: desired, snapped: false };

    let best = { mm: desired, score: Infinity };
    const consider = (cut) => {
      if (cut < 50 || cut > MAX_POLE) return;
      const s = scoreAt(cut);
      // better joints win; on a tie, stay closest to what was asked for
      if (s < best.score ||
         (s === best.score && Math.abs(cut - desired) < Math.abs(best.mm - desired))) {
        best = { mm: cut, score: s };
      }
    };

    if (state.settings.standardOnly) {
      // only whole pipes are on offer, so simply pick the best of the six
      stockLengths().forEach(consider);
    } else {
      for (let d = 0; d <= LOCK_RANGE; d += LOCK_COARSE) {
        consider(desired - d); if (d) consider(desired + d);
        if (best.score < EPS && d >= LOCK_COARSE * 2) break;   // close enough to refine
      }
      const centre = best.mm;
      for (let d = LOCK_FINE; d < LOCK_COARSE; d += LOCK_FINE) {
        consider(centre - d); consider(centre + d);
      }
    }

    if (best.score === Infinity) return { mm: desired, snapped: false, stuck: true };
    return {
      mm: best.mm,
      snapped: best.mm !== desired,
      stuck: best.score >= 10          // still a joint with no fitting at all
    };
  }

  let lastLock = null;    // what the lock did, for the widget note
  let lastAsked = 0;      // the length that was asked for before snapping

  function applyLength(mm) {
    const runs = currentRuns();
    if (!runs.length) return;
    mm = Math.max(50, Math.min(MAX_POLE, mm));
    if (state.settings.standardOnly) mm = nearestStock(mm);
    lastAsked = mm;

    // With several poles selected the lock is judged on the whole set at once,
    // after they have all been resized — otherwise it would fight itself.
    if (state.settings.lockAngles !== shiftHeld) {
      const r = lockedLength(runs, mm);
      lastLock = r.stuck ? 'stuck' : (r.snapped ? r.mm : null);
      mm = r.mm;
    } else {
      lastLock = null;
    }

    applyLengthTo(runs, mm);
    rebuild();
  }

  /** Resize each of `runs` to `mm`, working from their original lengths. */
  function applyLengthTo(runs, mm) {
    runs.forEach((run) => setRunLength(run, mm));
  }

  /* ---- angle overlays ---------------------------------------------------
     Every joint is a fitting bought for a particular angle, so the angles are
     worth seeing on the model. Right angles and straight-throughs are drawn
     faintly since they are the expected case; anything else stands out.    */

  const ARC_R = 105;            // mm, radius of the little arc at a joint

  /** A small text plate that always faces the camera. */
  function angleLabel(text, strong) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 64);
    g.font = 'bold 40px ui-monospace, Menlo, Consolas, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = strong ? '#ffb020' : '#8b939e';
    g.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: strong ? 0.95 : 0.5, depthTest: true
    }));
    s.scale.set(190, 95, 1);
    return s;
  }

  function drawAngleOverlays() {
    overlayGroup.clear();
    if (!state.settings.showAngles) return;
    const showAll = state.settings.showAllAngles;

    solved.joints.forEach((j, nodeId) => {
      const n = state.nodes.find((x) => x.id === nodeId);
      if (!n || !j.dirs || j.dirs.length < 2) return;
      const o = new THREE.Vector3(n.p[0], n.p[1], n.p[2]);
      let drawn = 0;

      for (let i = 0; i < j.dirs.length && drawn < 3; i++) {
        for (let k = i + 1; k < j.dirs.length && drawn < 3; k++) {
          const a = j.dirs[i], b = j.dirs[k];
          const deg = THREE.MathUtils.radToDeg(
            Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
          const square = Math.abs(deg - 90) < 1.5;
          const straight = Math.abs(deg - 180) < 1.5;
          if (straight) continue;                       // a pipe running on through
          if (square && !showAll) continue;             // the expected case
          drawn++;

          // arc from one pole to the other
          const pts = [];
          const steps = 18;
          const axis = new THREE.Vector3().crossVectors(a, b);
          if (axis.lengthSq() < 1e-8) continue;
          axis.normalize();
          const rad = THREE.MathUtils.degToRad(deg);
          for (let s = 0; s <= steps; s++) {
            const q = new THREE.Quaternion().setFromAxisAngle(axis, rad * (s / steps));
            pts.push(a.clone().applyQuaternion(q).multiplyScalar(ARC_R).add(o));
          }
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
              color: square ? 0x6b7280 : 0xffb020,
              transparent: true, opacity: square ? 0.35 : 0.6
            }));
          overlayGroup.add(line);

          const mid = pts[Math.floor(steps / 2)].clone()
            .sub(o).multiplyScalar(1.42).add(o);
          const lab = angleLabel(Math.round(deg) + '°', !square);
          lab.position.copy(mid);
          overlayGroup.add(lab);
        }
      }
    });
    overlayGroup.updateMatrixWorld(true);
  }

  /* ---- draggable joint handles -----------------------------------------
     A free end is a small casting and awkward to hit, especially on an angled
     pole. Every joint gets an invisible ball around it that is easy to grab,
     and dragging one moves that end directly — no keyboard needed.        */

  const HANDLE_R = 48;          // mm — generous enough to grab, small enough not to overlap
  let hoverNode = null;

  function buildHandles() {
    handleGroup.clear();
    const live = new Set();
    state.edges.forEach((e) => { live.add(e.a); live.add(e.b); });
    state.nodes.forEach((n) => {
      if (!live.has(n.id)) return;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(HANDLE_R, 12, 10),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      m.position.set(n.p[0], n.p[1], n.p[2]);
      m.userData.pick = { type: 'node', id: n.id };
      m.userData.handle = true;
      handleGroup.add(m);
    });
    // Raycasting reads matrixWorld, which is otherwise only refreshed by a
    // render. Update it here so a hit test is correct the instant handles exist.
    handleGroup.updateMatrixWorld(true);
    drawHoverRing();
  }

  function drawHoverRing() {
    const old = handleGroup.getObjectByName('hoverRing');
    if (old) handleGroup.remove(old);
    if (!hoverNode || xform) return;
    const n = state.nodes.find((x) => x.id === hoverNode);
    if (!n) return;
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(24, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.62 })
    );
    g.name = 'hoverRing';
    g.position.set(n.p[0], n.p[1], n.p[2]);
    handleGroup.add(g);
  }

  /** Which joint handle is under the pointer, if any. */
  function handleAt(ev) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    handleGroup.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(handleGroup.children, false);
    for (const h of hits) {
      if (h.object.userData.handle) return h.object.userData.pick.id;
    }
    return null;
  }

  function pickAt(ev) {
    const host = $('#viewport'), r = host.getBoundingClientRect();
    mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(structureGroup.children, true);
    let pick = null, hitPoint = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o && o.userData.pick) { pick = o.userData.pick; hitPoint = h.point.clone(); break; }
    }
    // Pin the resizer to the spot that was clicked. It stays put while the
    // slider runs, instead of chasing the pole's moving midpoint.
    clickAnchor = hitPoint;

    // Shift- or Ctrl-click adds a pole to the selection instead of replacing it
    const additive = (ev.shiftKey || ev.ctrlKey);
    if (additive && pick && pick.type === 'run' && selection && selection.type === 'run') {
      const ids = selectedRunIds().slice();
      const at = ids.indexOf(pick.id);
      if (at === -1) ids.push(pick.id); else ids.splice(at, 1);
      selection = ids.length ? { type: 'run', id: ids[0], ids } : null;
    } else {
      selection = pick;
    }
    rebuild();
  }

  /* ---- build the scene from state --------------------------------------- */
  let solved = { joints: new Map(), runs: [], bomData: null };

  function rebuild() {
    structureGroup.clear();

    const joints = window.KCEngine.solveJoints(state);
    const runs = window.KCEngine.buildRuns(state, joints, state.settings);
    const bomData = window.KCEngine.bom(state, joints, runs, state.settings);
    solved = { joints, runs, bomData };

    const nodeById = new Map(state.nodes.map((n) => [n.id, n]));

    // pipes — one mesh per run, so what you see is what you cut
    runs.forEach((run) => {
      const first = state.edges.find((e) => e.id === run.edges[0]);
      const last = state.edges.find((e) => e.id === run.edges[run.edges.length - 1]);
      const a = nodeById.get(run.endA), b = nodeById.get(run.endB);
      const pa = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const pb = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      const dir = pb.clone().sub(pa).normalize();
      const jA = joints.get(run.endA), jB = joints.get(run.endB);
      const sA = jA && jA.socketFor ? window.KCEngine.pipeStop(jA.socketFor(first.id), state.settings) : 0;
      const sB = jB && jB.socketFor ? window.KCEngine.pipeStop(jB.socketFor(last.id), state.settings) : 0;
      const start = pa.clone().add(dir.clone().multiplyScalar(sA == null ? 0 : sA));
      const end = pb.clone().sub(dir.clone().multiplyScalar(sB == null ? 0 : sB));
      const len = start.distanceTo(end);
      if (len <= 0.5) return;
      const isSel = selectedRunIds().indexOf(run.edges[0]) !== -1;
      const pipe = window.KCModels.buildPipe(len, isSel);
      pipe.position.copy(start.clone().add(end).multiplyScalar(0.5));
      pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      pipe.userData.pick = { type: 'run', id: run.edges[0], run };
      structureGroup.add(pipe);
    });

    // fittings
    if (state.settings.showFittings) {
      joints.forEach((j, nodeId) => {
        if (!j.fit || !j.fit.sockets) return;
        const n = nodeById.get(nodeId);
        const isSel = selection && selection.type === 'node' && selection.id === nodeId;
        const g = window.KCModels.buildFitting(j.fit, { highlight: isSel });
        g.position.set(n.p[0], n.p[1], n.p[2]);
        g.quaternion.copy(j.quat);
        g.userData.pick = { type: 'node', id: nodeId, joint: j };
        structureGroup.add(g);

        if (j.warn) {
          const s = new THREE.Mesh(
            new THREE.SphereGeometry(30, 14, 10),
            new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.32 })
          );
          s.position.set(n.p[0], n.p[1], n.p[2]);
          structureGroup.add(s);
        }
      });
    } else {
      joints.forEach((j, nodeId) => {
        const n = nodeById.get(nodeId);
        const s = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0x4da3ff }));
        s.position.set(n.p[0], n.p[1], n.p[2]);
        s.userData.pick = { type: 'node', id: nodeId, joint: j };
        structureGroup.add(s);
      });
    }

    // infill panels, drawn from the poles they hang on
    (bomData.panels || []).forEach((p) => {
      const sel = selection && selection.type === 'panel' && selection.id === p.id;
      const g = window.KCModels.buildPanel(p, { highlight: sel });
      structureGroup.add(g);
    });

    renderBom(bomData);
    updateHud();
    renderInspector();
    showWidget();
    buildHandles();
    drawAngleOverlays();
    if (ready) markDirty();      // every change is autosaved a moment later
  }

  /* ---- formatting ------------------------------------------------------- */
  const money = (n) => '£' + n.toFixed(2);
  function fmtLen(mm) {
    if (mm >= 1000) return (mm / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ' m';
    return Math.round(mm) + ' mm';
  }

  /* ---- BOM panel -------------------------------------------------------- */
  function renderBom(b) {
    const box = $('#bom');
    if (!b.fitRows.length && !b.cuts.length) {
      box.innerHTML = '<p class="empty">Draw a pipe run to start costing.</p>';
      $('#grandTotal').textContent = '£0.00';
      $('#totalNote').textContent = 'nothing to price yet';
      return;
    }
    let h = '';

    h += '<h3>Fittings</h3><table class="bomtable"><tbody>';
    b.fitRows.forEach((r) => {
      h += '<tr><td class="q">' + r.qty + '×</td>' +
        '<td><a href="' + r.fit.url + '" target="_blank" rel="noopener">' + r.fit.name + '</a>' +
        '<span class="sku">' + r.fit.sku + (r.fit.estimated ? ' · est. dims' : '') + '</span></td>' +
        '<td class="n">' + money(r.qty * r.fit.price) + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="subtot"><span>Fittings subtotal</span><b>' + money(b.fitCost) + '</b></div>';

    h += '<h3>Pipe — cut list</h3><table class="bomtable"><tbody>';
    b.cuts.forEach((c) => {
      h += '<tr><td class="q">' + c.qty + '×</td><td>' + fmtLen(c.mm) +
        '<span class="sku">cut length</span></td><td class="n"></td></tr>';
    });
    h += '</tbody></table>';

    if (state.settings.pipeMode === 'stock') {
      h += '<h3>Pipe — buy</h3><table class="bomtable"><tbody>';
      b.plan.bought.forEach((x) => {
        h += '<tr><td class="q">' + x.qty + '×</td><td>' + fmtLen(x.stock.mm) + ' length' +
          '<span class="sku">' + x.stock.sku + '</span></td>' +
          '<td class="n">' + money(x.qty * x.stock.price) + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="subtot"><span>Pipe subtotal</span><b>' + money(b.pipeCost) + '</b></div>';
      h += '<p class="hint">Offcut waste ' + fmtLen(b.plan.waste) +
        ' · ' + b.plan.bins.length + ' stock length' + (b.plan.bins.length === 1 ? '' : 's') +
        ' · ' + state.settings.kerf + 'mm saw kerf allowed</p>';
      if (b.sleevesNeeded) {
        h += '<p class="warn">' + b.sleevesNeeded + ' run' + (b.sleevesNeeded === 1 ? '' : 's') +
          ' exceed the 3 m maximum stock length, so ' + b.sleevesNeeded +
          ' sleeve joint' + (b.sleevesNeeded === 1 ? ' has' : 's have') +
          ' been added and those runs split into equal pipes.</p>';
      }
      if (b.plan.tooLong.length) {
        h += '<p class="warn">' + b.plan.tooLong.length + ' cut(s) still exceed the longest stock ' +
          'length — check the geometry.</p>';
      }
    } else {
      h += '<div class="subtot"><span>Pipe subtotal (buy to length)</span><b>' + money(b.pipeCost) + '</b></div>';
    }

    if (b.panelRows && b.panelRows.length) {
      h += '<h3>Panels</h3><table class="bomtable"><tbody>';
      b.panelRows.forEach((p) => {
        h += '<tr><td class="q">1&times;</td><td>' + p.name +
          '<span class="sku">' + p.areaM2.toFixed(2) + ' m&sup2; · ' +
          p.pads + ' fixing pads</span></td>' +
          '<td class="n">' + money(p.cost) + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="subtot"><span>Panel subtotal</span><b>' + money(b.panelCost) + '</b></div>';
      h += '<p class="warn">Sheet rates are ONYVA placeholders, not supplier prices — ' +
        'Pipe Dream does not sell sheet. Set your own &pound;/m&sup2; in Setup before quoting.</p>';
      b.panelRows.filter((p) => p.warn).forEach((p) => {
        h += '<p class="warn">' + p.warn + '</p>';
      });
    }

    h += '<div class="totals">' +
      '<div><span>Subtotal (ex VAT)</span><b>' + money(b.sub) + '</b></div>' +
      (state.settings.vat ? '<div><span>VAT @ 20%</span><b>' + money(b.vat) + '</b></div>' : '') +
      '<div><span>Total pipe</span><b>' + fmtLen(b.totalPipeMm) + '</b></div>' +
      '<div><span>Est. weight</span><b>' + b.weight.toFixed(1) + ' kg</b></div>' +
      '</div>';

    box.innerHTML = h;
    $('#grandTotal').textContent = money(b.total);
    $('#totalNote').textContent = state.settings.vat ? 'inc VAT' : 'ex VAT';
  }

  /* ---- inspector -------------------------------------------------------- */
  function renderInspector() {
    const box = $('#inspector');
    if (!selection) { box.innerHTML = '<p class="empty">Select a pipe or a joint to inspect it.</p>'; return; }

    if (selection.type === 'panel') {
      const stored = state.panels.find((p) => p.id === selection.id);
      const p = (solved.bomData.panels || []).find((x) => x.id === selection.id);
      if (!stored || !p) { box.innerHTML = '<p class="empty">Panel no longer exists.</p>'; return; }
      let h = '<h3>Panel</h3>';
      h += '<p class="big">' + p.material.name + '</p>';
      h += '<p class="hint">' + p.areaM2.toFixed(2) + ' m&sup2; · ' + p.thickness + ' mm · ' +
        p.pads + ' Double Fixing Pads · ' + money(p.areaM2 * p.material.perM2) + ' ex VAT</p>';
      if (p.warn) h += '<p class="warn">' + p.warn + '</p>';
      if (p.material.estimated) {
        h += '<p class="warn">&pound;' + p.material.perM2.toFixed(2) +
          '/m&sup2; is a placeholder, not a supplier price. Set your own in Setup.</p>';
      }
      h += '<label class="fld"><span>Material</span><select id="panelMat">' +
        window.CATALOGUE.SHEETS.map((s) => '<option value="' + s.id + '"' +
          (s.id === stored.material ? ' selected' : '') + '>' + s.name + '</option>').join('') +
        '</select></label>';
      h += '<button class="btn danger" id="delPanel">Delete panel</button>';
      box.innerHTML = h;
      $('#panelMat').onchange = (e) => {
        pushHistory(); stored.material = e.target.value; rebuild();
      };
      $('#delPanel').onclick = () => deletePanel(selection.id);
      return;
    }

    if (selection.type === 'node') {
      const j = solved.joints.get(selection.id);
      if (!j) { box.innerHTML = '<p class="empty">Joint has no fitting.</p>'; return; }
      const cls = j.cls;
      let h = '<h3>Joint</h3>';
      h += '<p class="big">' + (j.fit ? j.fit.name : 'Unmatched') + '</p>';
      if (j.fit) h += '<p class="sku">' + j.fit.sku + ' · ' + j.fit.type + ' · ' + money(j.fit.price) + ' ex VAT</p>';
      h += '<p class="hint">' + cls.n + ' pipe' + (cls.n === 1 ? '' : 's') +
        ' · ' + cls.through + ' passing through</p>';
      if (j.warn) h += '<p class="warn">' + j.warn + '</p>';

      const alts = window.CATALOGUE.FITTINGS.filter((f) => f.sockets);
      h += '<label class="fld"><span>Override fitting</span><select id="overrideSel">' +
        '<option value="">Auto — best match</option>' +
        alts.map((f) => '<option value="' + f.id + '"' +
          (state.overrides[selection.id] === f.id ? ' selected' : '') + '>' +
          f.name + ' (' + money(f.price) + ')</option>').join('') +
        '</select></label>';
      h += '<button class="btn" id="addFromHere" style="width:100%;margin-top:12px">' +
        '+ Add a pole from this joint</button>';
      h += '<button class="btn danger" id="delNode">Delete joint &amp; its poles</button>';
      box.innerHTML = h;
      $('#addFromHere').onclick = startAddPole;
      $('#overrideSel').onchange = (e) => {
        pushHistory();
        if (e.target.value) state.overrides[selection.id] = e.target.value;
        else delete state.overrides[selection.id];
        rebuild();
      };
      $('#delNode').onclick = () => {
        pushHistory();
        state.edges = state.edges.filter((e) => e.a !== selection.id && e.b !== selection.id);
        state.nodes = state.nodes.filter((n) => n.id !== selection.id);
        delete state.overrides[selection.id];
        selection = null; rebuild();
      };
    } else {
      const run = currentRun() || selection.run;
      if (!run) { box.innerHTML = '<p class="empty">Pole no longer exists.</p>'; return; }
      const many = currentRuns();
      let h = '<h3>' + (many.length > 1 ? many.length + ' poles selected' : 'Pole run') + '</h3>';
      if (many.length > 1) {
        const total = many.reduce((s, r) => s + r.cut, 0);
        h += '<p class="big">' + fmtLen(total) + '</p>';
        h += '<p class="sku">total cut length · ' +
          many.map((r) => Math.round(r.cut)).join(', ') + ' mm</p>';
      } else {
        h += '<p class="big">' + fmtLen(run.cut) + '</p>';
        h += '<p class="sku">cut length · centre-to-centre ' + fmtLen(run.centreLen) +
          ' · ' + run.spans + ' span' + (run.spans === 1 ? '' : 's') + '</p>';
      }
      h += '<p class="hint">Cut = centre-to-centre − the insertion allowance at each end (' +
        state.settings.insertDepth + ' mm socket engagement).</p>';
      const sel = currentRuns();
      h += '<button class="btn danger" id="delRun">Delete ' +
        (sel.length > 1 ? 'these ' + sel.length + ' poles' : 'this run') + '</button>';
      box.innerHTML = h;
      $('#delRun').onclick = () => {
        pushHistory();
        const ids = new Set();
        sel.forEach((r) => r.edges.forEach((e) => ids.add(e)));
        state.edges = state.edges.filter((e) => !ids.has(e.id));
        const live = new Set();
        state.edges.forEach((e) => { live.add(e.a); live.add(e.b); });
        state.nodes = state.nodes.filter((n) => live.has(n.id));
        selection = null; rebuild();
      };
    }
  }

  const SNAP_LABEL = { ortho: '90° only', fittings: '45° steps', free: 'any angle' };

  function updateHud() {
    $('#hudMode').textContent = mode === 'draw'
      ? (drawFrom ? 'Click to place the next joint · Esc finishes' : 'Click to start the run')
      : 'Click a pole to resize · a joint to change the fitting';
    $('#hudPlane').textContent = 'Height ' + fmtLen(planeY) +
      (vertMode ? ' · vertical' : ' · horizontal') +
      ' · ' + SNAP_LABEL[state.settings.snapMode];
    $('#hudCount').textContent = state.nodes.length + ' joints · ' + solved.runs.length + ' poles';
  }

  /* ---- presets ---------------------------------------------------------- */
  function preset(kind) {
    pushHistory();
    state.nodes = []; state.edges = []; state.overrides = {}; uid = 1;
    const g = state.settings.grid;
    const mk = (x, y, z) => addNodeAt(new THREE.Vector3(x, y, z));

    if (kind === 'cube') {
      const s = g * 10, hgt = g * 20;
      const b = [mk(0, 0, 0), mk(s, 0, 0), mk(s, 0, s), mk(0, 0, s)];
      const t = [mk(0, hgt, 0), mk(s, hgt, 0), mk(s, hgt, s), mk(0, hgt, s)];
      for (let i = 0; i < 4; i++) {
        addEdge(b[i], b[(i + 1) % 4]);
        addEdge(t[i], t[(i + 1) % 4]);
        addEdge(b[i], t[i]);
      }
    } else if (kind === 'portal') {
      const w = g * 24, h = g * 22;
      const a = mk(0, 0, 0), b = mk(0, h, 0), c = mk(w, h, 0), d = mk(w, 0, 0);
      addEdge(a, b); addEdge(b, c); addEdge(c, d);
    } else if (kind === 'plinth') {
      const s = g * 6, h = g * 9;
      const b = [mk(0, 0, 0), mk(s, 0, 0), mk(s, 0, s), mk(0, 0, s)];
      const t = [mk(0, h, 0), mk(s, h, 0), mk(s, h, s), mk(0, h, s)];
      const m = [mk(0, h / 2, 0), mk(s, h / 2, 0), mk(s, h / 2, s), mk(0, h / 2, s)];
      for (let i = 0; i < 4; i++) {
        addEdge(b[i], b[(i + 1) % 4]); addEdge(t[i], t[(i + 1) % 4]);
        addEdge(m[i], m[(i + 1) % 4]);
        addEdge(b[i], m[i]); addEdge(m[i], t[i]);
      }
    } else if (kind === 'wall') {
      const bays = 4, w = g * 12, h = g * 20;
      let prevB = null, prevT = null;
      for (let i = 0; i <= bays; i++) {
        const b = mk(i * w, 0, 0), t = mk(i * w, h, 0);
        addEdge(b, t);
        if (prevB !== null) { addEdge(prevB, b); addEdge(prevT, t); }
        prevB = b; prevT = t;
      }
    }
    selection = null; drawFrom = null;
    rebuild();
    frameAll();
  }

  function frameAll() {
    if (!state.nodes.length) return;
    const box = new THREE.Box3();
    state.nodes.forEach((n) => box.expandByPoint(new THREE.Vector3(n.p[0], n.p[1], n.p[2])));
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 2000;
    controls.target.copy(c);
    const dir = new THREE.Vector3(1, 0.75, 1.15).normalize();
    camera.position.copy(c.clone().add(dir.multiplyScalar(size * 1.25)));
    controls.update();
  }

  /* ---- export ------------------------------------------------------------ */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function exportCsv() {
    const b = solved.bomData; if (!b) return;
    const rows = [['Type', 'Qty', 'Description', 'SKU', 'Unit £ ex VAT', 'Line £ ex VAT', 'Product URL']];
    b.fitRows.forEach((r) => rows.push(
      ['Fitting', r.qty, r.fit.name, r.fit.sku, r.fit.price.toFixed(2), (r.qty * r.fit.price).toFixed(2), r.fit.url]));
    if (state.settings.pipeMode === 'stock') {
      b.plan.bought.forEach((x) => rows.push(
        ['Pipe', x.qty, '27mm black pipe ' + (x.stock.mm / 10) + ' cm', x.stock.sku,
          x.stock.price.toFixed(2), (x.qty * x.stock.price).toFixed(2), window.CATALOGUE.TUBE.url]));
    }
    rows.push([]);
    rows.push(['Cut list']);
    rows.push(['Qty', 'Cut length (mm)']);
    b.cuts.forEach((c) => rows.push([c.qty, c.mm]));
    rows.push([]);
    rows.push(['Subtotal ex VAT', '', '', '', '', b.sub.toFixed(2)]);
    if (state.settings.vat) rows.push(['VAT 20%', '', '', '', '', b.vat.toFixed(2)]);
    rows.push(['Total', '', '', '', '', b.total.toFixed(2)]);
    rows.push(['Estimated weight (kg)', '', '', '', '', b.weight.toFixed(1)]);
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    download('keyclamp-bom.csv', csv, 'text/csv');
  }

  /* ---- saving ----------------------------------------------------------
     Three layers, because a browser cannot silently write to disk:
       · autosave  — every change, into this browser's local storage, so
                     closing the tab never loses work
       · Save      — a .json file. On Chrome/Edge it writes back to the same
                     file you picked; elsewhere it lands in Downloads
       · Open      — reads one of those .json files back
     ------------------------------------------------------------------- */

  const AUTOSAVE_KEY = 'onyva-pole-configurator/autosave/v1';
  let projectName = 'Untitled';
  let fileHandle = null;        // File System Access handle, when supported
  let dirty = false;
  let ready = false;            // true once startup is done, so init is not "a change"

  function designData() {
    return {
      app: 'ONYVA Pole System Configurator',
      version: 1, name: projectName, savedOn: new Date().toISOString(),
      nodes: state.nodes, edges: state.edges,
      overrides: state.overrides, extras: state.extras, settings: state.settings
    };
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function markDirty() {
    dirty = true;
    $('#projName').classList.add('dirty');
    autosave();
  }

  function setProjectName(n) {
    projectName = (n || 'Untitled').trim() || 'Untitled';
    $('#projName').textContent = projectName;
  }

  function markSaved() {
    dirty = false;
    $('#projName').classList.remove('dirty');
  }

  /* --- autosave (this browser only) --- */
  let autosaveTimer = null;
  function autosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(designData())); }
      catch (e) { /* private window, blocked storage, or full — never fatal */ }
    }, 600);
  }

  function loadAutosave() {
    let raw = null;
    try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    let d; try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || !Array.isArray(d.nodes) || !d.nodes.length) return false;

    applyDesign(d);
    const when = d.savedOn ? new Date(d.savedOn) : null;
    $('#restoreMsg').textContent = 'Picked up where you left off' +
      (when ? ' — ' + when.toLocaleString('en-GB',
        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    $('#restoreBar').classList.add('on');
    return true;
  }

  function applyDesign(d) {
    state.nodes = d.nodes || [];
    state.edges = d.edges || [];
    state.overrides = d.overrides || {};
    state.extras = d.extras || [];
    if (d.settings) Object.assign(state.settings, d.settings);
    uid = 1; state.nodes.concat(state.edges).forEach((o) => {
      const n = parseInt(String(o.id).slice(1), 10); if (n >= uid) uid = n + 1;
    });
    setProjectName(d.name);
    drawFrom = null; selection = null;
    syncSettingsUi(); rebuild(); frameAll();
  }

  const safeName = () =>
    projectName.replace(/[^\w \-]+/g, '').trim().replace(/\s+/g, '-') || 'design';

  /* --- explicit save --- */
  async function saveDesign(forcePicker) {
    const text = JSON.stringify(designData(), null, 2);

    // Chrome/Edge: write straight back to the file the user chose
    if (window.showSaveFilePicker) {
      try {
        if (!fileHandle || forcePicker) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: safeName() + '.onyva.json',
            types: [{ description: 'ONYVA pole design', accept: { 'application/json': ['.json'] } }]
          });
        }
        const w = await fileHandle.createWritable();
        await w.write(text); await w.close();
        markSaved(); toast('Saved to ' + fileHandle.name);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;      // user cancelled
        fileHandle = null;                              // fall through to download
      }
    }
    download(safeName() + '.onyva.json', text, 'application/json');
    markSaved(); toast('Saved to your Downloads folder');
  }

  function exportJson() { saveDesign(true); }

  function importJson(file) {
    const fr = new FileReader();
    fr.onload = () => {
      let d;
      try { d = JSON.parse(fr.result); }
      catch (err) { alert('That file could not be read as a saved design.'); return; }
      if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) {
        alert('That file is not an ONYVA pole design.'); return;
      }
      pushHistory();
      // a design that was never named takes the name of the file it came from
      if (!d.name || d.name === 'Untitled') {
        d.name = file.name.replace(/\.(onyva\.)?json$/i, '').replace(/[-_]+/g, ' ');
      }
      applyDesign(d);
      buildGrid();
      markSaved();
      toast('Opened ' + projectName);
    };
    fr.readAsText(file);
  }

  /** Open via the file picker, keeping the handle so Save writes back to it. */
  async function openDesign() {
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({
          types: [{ description: 'ONYVA pole design', accept: { 'application/json': ['.json'] } }]
        });
        fileHandle = h;
        importJson(await h.getFile());
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    $('#fileIn2').click();
  }

  /* ---- UI wiring --------------------------------------------------------- */
  function syncSettingsUi() {
    $('#gridSel').value = String(state.settings.grid);
    $('#snapSel').value = state.settings.snapMode;
    $('#vatChk').checked = state.settings.vat;
    $('#fitChk').checked = state.settings.showFittings;
    $('#gridChk').checked = state.settings.showGrid;
    if ($('#sheetSel')) $('#sheetSel').value = state.settings.sheet;
    if ($('#sheetRate') && currentSheet()) $('#sheetRate').value = currentSheet().perM2;
    if ($('#padSpace')) $('#padSpace').value = state.settings.padSpacing;
    $('#angChk').checked = state.settings.showAngles;
    $('#ang90Chk').checked = state.settings.showAllAngles;
    $('#pipeMode').value = state.settings.pipeMode;
    $('#insertNum').value = state.settings.insertDepth;
    $('#kerfNum').value = state.settings.kerf;
    $('#wallNum').value = state.settings.wall;
  }

  function wire() {
    const host = $('#viewport');
    host.addEventListener('pointerdown', onPointerDown, true);   // capture: beat OrbitControls
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('contextmenu', (e) => {
      if (xform || (mode === 'draw' && drawFrom)) e.preventDefault();
    });

    // the widget floats over the canvas — keep its clicks out of the viewport
    const pw = $('#poleWidget');
    ['pointerdown', 'pointerup', 'pointermove', 'wheel'].forEach((t) =>
      pw.addEventListener(t, (e) => e.stopPropagation()));
    $('#pwClose').onclick = () => { selection = null; rebuild(); };
    $('#pwSlider').oninput = (e) => {
      $('#pwNum').value = e.target.value;
      applyLength(+e.target.value);
    };
    $('#pwSlider').onpointerdown = () => pushHistory();
    $('#pwNum').onchange = (e) => { pushHistory(); applyLength(+e.target.value); };
    $('#pwStretch').onchange = (e) => { state.settings.stretch = e.target.checked; showWidget(); };
    $('#pwLock').onchange = (e) => { state.settings.lockAngles = e.target.checked; showWidget(); };
    $('#pwStd').onchange = (e) => {
      state.settings.standardOnly = e.target.checked;
      const run = currentRun();
      if (e.target.checked && run) { pushHistory(); applyLength(nearestStock(run.cut)); }
      else showWidget();
    };
    $('#pwFlip').onclick = () => { flipEnd = !flipEnd; showWidget(); };
    $('#pwDup').onclick = duplicateRun;
    $('#pwPanel').onclick = addPanel;

    // panel settings
    const sheetSel = $('#sheetSel');
    sheetSel.innerHTML = window.CATALOGUE.SHEETS
      .map((s) => '<option value="' + s.id + '">' + s.name + '</option>').join('');
    sheetSel.onchange = (e) => {
      state.settings.sheet = e.target.value;
      $('#sheetRate').value = currentSheet().perM2;
      rebuild();
    };
    $('#sheetRate').onchange = (e) => {
      const s = currentSheet();
      if (s) { s.perM2 = Math.max(0, +e.target.value || 0); s.estimated = false; }
      rebuild();
    };
    $('#padSpace').onchange = (e) => {
      state.settings.padSpacing = Math.max(150, Math.min(2000, +e.target.value || 600));
      rebuild();
    };

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      // While a transform is running it takes the whole keyboard.
      if (xform) {
        const k = e.key.toLowerCase();
        if (e.key === 'Escape') { endTransform(false); return; }
        if (e.key === 'Enter') { endTransform(true); return; }
        if (k === 'x' || k === 'y' || k === 'z') {
          // pressing the same axis twice releases the constraint
          xform.axis = (xform.axis === k && xform.kind === 'move') ? null : k;
          xform.startHit = null; xform.startAngle = null; xform.typed = '';
          applyTransform(null); return;
        }
        if (/^[0-9]$/.test(e.key) || e.key === '.' || e.key === '-') {
          if (xform.kind === 'move' && !xform.axis) xform.axis = 'x';
          xform.typed += e.key; applyTransform(null); return;
        }
        if (e.key === 'Backspace') {
          xform.typed = xform.typed.slice(0, -1); applyTransform(null); return;
        }
        if (e.key === 'Shift') { xform.fine = true; applyTransform(null); return; }
        return;
      }

      if (e.key === 'Escape') { endRun(); selection = null; rebuild(); }
      if (e.key === 'Shift') {
        shiftHeld = true; vertMode = true;
        controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;   // Blender's Shift+MMB
        updateHud();
      }
      if (e.key.toLowerCase() === 'v') { vertMode = !vertMode; updateHud(); }
      // modifier shortcuts first, then the bare letter keys
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 's') { e.preventDefault(); saveDesign(false); }
        if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        if (k === 'o') { e.preventDefault(); openDesign(); }
        return;
      }
      if (e.key.toLowerCase() === 'a') startAddPole();
      if (e.key.toLowerCase() === 'f') frameAll();
      if (e.key.toLowerCase() === 'g') beginTransform('move');
      if (e.key.toLowerCase() === 'r') beginTransform('rotate');
      if (e.key.toLowerCase() === 'd' && e.shiftKey) { e.preventDefault(); duplicateSelection(); }
      if (e.key.toLowerCase() === 'p' && !e.shiftKey) addPanel();
      if (e.key === 'Delete' && selection) {
        const btn = $('#delNode') || $('#delRun'); if (btn) btn.click();
      }
    });
    addEventListener('keyup', (e) => {
      if (e.key !== 'Shift') return;
      if (xform) { xform.fine = false; applyTransform(null); return; }
      shiftHeld = false; vertMode = false;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
      updateHud();
    });

    $('#btnAddPole').onclick = () => {
      if (mode === 'draw') endRun(); else startAddPole();
    };
    $('#snapSel').onchange = (e) => { state.settings.snapMode = e.target.value; updateHud(); };
    $('#btnUndo').onclick = undo;
    $('#btnRedo').onclick = redo;
    $('#btnFrame').onclick = frameAll;
    $('#btnClear').onclick = () => {
      if (!state.nodes.length || confirm('Clear the whole design?')) {
        pushHistory();
        state.nodes = []; state.edges = []; state.overrides = {}; selection = null; drawFrom = null;
        rebuild();
      }
    };
    $$('.preset').forEach((b) => { b.onclick = () => preset(b.dataset.preset); });
    $('#btnCsv').onclick = exportCsv;
    $('#btnJson').onclick = exportJson;
    $('#fileIn').onchange = (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };
    $('#fileIn2').onchange = (e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; };

    $('#btnWeld').onclick = () => {
      const tol = Math.max(1, Math.min(200, +$('#weldTol').value || 20));
      weldAll(tol);
    };
    $('#btnSave').onclick = () => saveDesign(false);
    $('#btnOpen').onclick = openDesign;
    $('#projName').onclick = () => {
      const n = prompt('Name this design', projectName);
      if (n !== null) { setProjectName(n); markDirty(); }
    };
    $('#rbClose').onclick = () => $('#restoreBar').classList.remove('on');
    $('#rbFresh').onclick = () => {
      $('#restoreBar').classList.remove('on');
      pushHistory();
      state.nodes = []; state.edges = []; state.overrides = {}; state.extras = [];
      setProjectName('Untitled'); fileHandle = null;
      rebuild();
    };

    $('#gridSel').onchange = (e) => { state.settings.grid = +e.target.value; buildGrid(); updateHud(); };
    $('#vatChk').onchange = (e) => { state.settings.vat = e.target.checked; rebuild(); };
    $('#fitChk').onchange = (e) => { state.settings.showFittings = e.target.checked; rebuild(); };
    $('#gridChk').onchange = (e) => { state.settings.showGrid = e.target.checked; buildGrid(); };
    $('#angChk').onchange = (e) => { state.settings.showAngles = e.target.checked; drawAngleOverlays(); };
    $('#ang90Chk').onchange = (e) => { state.settings.showAllAngles = e.target.checked; drawAngleOverlays(); };
    $('#pipeMode').onchange = (e) => { state.settings.pipeMode = e.target.value; rebuild(); };
    $('#insertNum').onchange = (e) => { state.settings.insertDepth = +e.target.value; rebuild(); };
    $('#kerfNum').onchange = (e) => { state.settings.kerf = +e.target.value; rebuild(); };
    $('#wallNum').onchange = (e) => { state.settings.wall = +e.target.value; rebuild(); };

    $$('.tab').forEach((t) => {
      t.onclick = () => {
        $$('.tab').forEach((x) => x.classList.toggle('on', x === t));
        $$('.tabpane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + t.dataset.tab));
      };
    });
  }

  /** Enter pole-drawing. Starting from a selected joint continues from there. */
  function startAddPole() {
    const from = (selection && selection.type === 'node') ? selection.id : null;
    setMode('draw');
    drawFrom = from;
    if (from) {
      const n = state.nodes.find((x) => x.id === from);
      if (n) planeY = n.p[1];
    } else {
      planeY = 0;                    // an unanchored run begins on the ground
    }
    selection = null;
    rebuild();
  }

  function setMode(m) {
    mode = m; drawFrom = null; ghostGroup.clear();
    const btn = $('#btnAddPole');
    btn.classList.toggle('on', m === 'draw');
    btn.textContent = m === 'draw' ? 'Finish (Esc)' : '+ Add pole';
    $('#viewport').style.cursor = m === 'draw' ? 'crosshair' : 'default';
    if (m === 'draw') { selection = null; $('#poleWidget').classList.remove('on'); }
    updateHud();
  }

  /* ---- catalogue panel ---------------------------------------------------- */
  function renderCatalogue() {
    const rows = window.CATALOGUE.FITTINGS.map((f) =>
      '<tr><td><a href="' + f.url + '" target="_blank" rel="noopener">' + f.name + '</a>' +
      '<span class="sku">' + f.sku + ' · ' + f.type + (f.estimated ? ' · est.' : '') + '</span></td>' +
      '<td class="n">' + money(f.price) + '</td></tr>').join('');
    $('#cat').innerHTML =
      '<p class="hint">27mm (26.9mm OD) electrophoretic black. Prices ex VAT, ' +
      'scraped from pipedreamfittings.com on ' + window.CATALOGUE.scrapedOn + '.</p>' +
      '<table class="bomtable"><tbody>' + rows + '</tbody></table>' +
      '<h3>Pipe</h3><table class="bomtable"><tbody>' +
      window.CATALOGUE.TUBE.stock.map((s) =>
        '<tr><td>' + (s.mm / 10) + ' cm<span class="sku">' + s.sku + '</span></td>' +
        '<td class="n">' + money(s.price) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  /* ---- public handle (scripting / debugging) ------------------------------ */
  window.KCApp = {
    state, get solved() { return solved; },
    rebuild, frameAll, preset, exportCsv, exportJson,
    saveDesign, openDesign, autosave,
    beginTransform, applyTransform, endTransform, weldAll, duplicateRun,
    duplicateSelection, drawAngleOverlays, addPanel, deletePanel,
    get overlayCount() { return overlayGroup ? overlayGroup.children.length : 0; },
    handleAt, get hoverNode() { return hoverNode; },
    endRun, anchorPoint, get planeY() { return planeY; },
    get pendingAnchor() { return pendingAnchor; },
    get xform() { return xform; },
    get projectName() { return projectName; },
    set projectName(n) { setProjectName(n); markDirty(); },
    addNode: (x, y, z) => addNodeAt(new THREE.Vector3(x, y, z)),
    addEdge, pushHistory, undo, redo, startAddPole,
    // the joint an in-progress run is anchored to; settable so a run can be
    // continued from script, and readable when debugging draw state
    get drawFrom() { return drawFrom; },
    set drawFrom(v) { drawFrom = v; },
    ghostAt: (x, y, z) => { hoverPoint = new THREE.Vector3(x, y, z); drawGhost(); },
    get currentRun() { return currentRun(); },
    selectRun: (edgeId) => { selection = { type: 'run', id: edgeId }; rebuild(); },
    selectRuns: (ids) => { selection = ids.length ? { type: 'run', id: ids[0], ids } : null; rebuild(); },
    selectAll: () => {
      const ids = solved.runs.map((r) => r.edges[0]);
      selection = ids.length ? { type: 'run', id: ids[0], ids } : null; rebuild();
    },
    selectNode: (nodeId) => { selection = { type: 'node', id: nodeId }; rebuild(); },
    get selection() { return selection; },
    setLength: applyLength,
    get scene() { return scene; }, get camera() { return camera; }
  };

  /* ---- go ----------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initThree(); wire(); syncSettingsUi(); setMode('select');
    renderCatalogue(); rebuild();
    // pick up an unsaved session if there is one, otherwise start on the demo
    if (!loadAutosave()) preset('cube');
    ready = true;
    markSaved();
  });
})();
