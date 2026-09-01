/* ============================================================================
   engine.js — the part that turns a wireframe of pipe runs into a real,
   buildable, costed key clamp structure:
     • works out which fitting belongs at each joint, and how it is rotated
     • merges collinear runs that pass straight through a fitting
     • produces a cut list, a stock-buying plan and a costed BOM
   ==========================================================================*/
(function (global) {
  'use strict';

  const EPS = 1e-4;
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

  /* ---- the 24 rotations of a cube, as quaternions -------------------- */
  const OCT = (function () {
    const out = [], axes = [
      [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]
    ];
    const up = new THREE.Vector3(0, 1, 0);
    axes.forEach((ax) => {
      const base = new THREE.Quaternion().setFromUnitVectors(up, v3(ax).normalize());
      for (let k = 0; k < 4; k++) {
        const twist = new THREE.Quaternion().setFromAxisAngle(v3(ax).normalize(), k * Math.PI / 2);
        out.push(twist.clone().multiply(base));
      }
    });
    return out;
  })();

  /* ---- direction-set helpers ---------------------------------------- */

  // Every pipe end a fitting offers, in local space.
  function fittingDirs(fit) {
    const out = [];
    (fit.sockets || []).forEach((s) => {
      if (s.kind === 'clamp' || s.kind === 'through') {
        out.push({ dir: v3(s.dir).normalize(), s });
        out.push({ dir: v3(s.dir).normalize().negate(), s });
      } else {
        out.push({ dir: v3(s.dir).normalize(), s });
      }
    });
    return out;
  }

  // Every pipe at the joint must land on its own socket. Spare sockets on the
  // fitting are allowed (you can use a 4-way cross with one outlet empty).
  function setsMatch(fitDirs, nodeDirs, tol) {
    if (fitDirs.length < nodeDirs.length) return false;
    const used = new Array(fitDirs.length).fill(false);
    for (const nd of nodeDirs) {
      let hit = -1;
      for (let i = 0; i < fitDirs.length; i++) {
        if (used[i]) continue;
        if (fitDirs[i].dot(nd) > 1 - tol) { hit = i; break; }
      }
      if (hit < 0) return false;
      used[hit] = true;
    }
    return true;
  }

  /**
   * Find a rotation that puts a fitting's sockets onto the node's edges.
   * Returns { quat, map:[socketIndexPerNodeDir] } or null.
   */
  function findOrientation(fit, nodeDirs, opts) {
    opts = opts || {};
    // 0.001 on the dot product is about 2.5° — a cast socket will not take
    // much more than that. A looser figure lets visibly skewed joints pass.
    const tol = opts.tol == null ? 0.001 : opts.tol;
    const fd = fittingDirs(fit);
    // Auto-selection wants an exact fit; an explicit override may leave sockets spare.
    if (opts.allowSpare ? fd.length < nodeDirs.length : fd.length !== nodeDirs.length) return null;

    const tryQuat = (q) => {
      const rotated = fd.map((f) => f.dir.clone().applyQuaternion(q));
      if (!setsMatch(rotated, nodeDirs, tol)) return null;
      const map = nodeDirs.map((nd) => {
        let best = -1, bestDot = -2;
        rotated.forEach((r, i) => { const d = r.dot(nd); if (d > bestDot) { bestDot = d; best = i; } });
        return fd[best].s;
      });
      return { quat: q.clone(), map };
    };

    for (const q of OCT) { const r = tryQuat(q); if (r) return r; }

    // Non axis-aligned (swivel fittings): align first socket, then twist.
    if (fd.length >= 1) {
      for (const nd of nodeDirs) {
        const base = new THREE.Quaternion().setFromUnitVectors(fd[0].dir, nd);
        for (let k = 0; k < 72; k++) {
          const twist = new THREE.Quaternion().setFromAxisAngle(nd, k * Math.PI / 36);
          const q = twist.clone().multiply(base);
          const r = tryQuat(q);
          if (r) return r;
        }
      }
    }
    return null;
  }

  /* ---- joint classification ------------------------------------------ */

  function classify(nodeDirs) {
    const n = nodeDirs.length;
    const pairs = [];               // collinear pairs -> a member passing through
    const used = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (used[j]) continue;
        if (nodeDirs[i].dot(nodeDirs[j]) < -1 + 0.02) {
          pairs.push([i, j]); used[i] = used[j] = true; break;
        }
      }
    }
    const singles = [];
    for (let i = 0; i < n; i++) if (!used[i]) singles.push(i);

    // pairwise angles between non-collinear directions
    const angles = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(nodeDirs[i].dot(nodeDirs[j]), -1, 1)));
        angles.push(a);
      }
    const allRightAngles = angles.every((a) => Math.abs(a - 90) < 1.5 || Math.abs(a - 180) < 1.5);
    return { n, through: pairs.length, singles: singles.length, angles, allRightAngles };
  }

  /* Candidate fittings, most-preferred first, per joint shape. */
  function candidates(cls, node, ctx) {
    const c = cls, atGround = Math.abs(node.p[1]) < 1.0;
    const list = [];
    if (c.n === 1) {
      const up = ctx.dirs[0].y > 0.9;
      if (atGround && up) list.push('basePlate', 'basePlateBolts', 'groundSupport', 'swivelBase');
      list.push('plasticEndCap', 'metalEndCap', 'wallPlate', 'wallPlateSquare', 'handrailBracket');
      return list;
    }
    if (c.n === 2) {
      if (c.through === 1) return ['sleeveJoint', 'expandingConnector'];
      if (c.allRightAngles) return ['elbow90'];
      // no single casting makes a non-90° bend — it takes a swivel pair
      return ['swivelPair'];
    }
    if (c.n === 3) {
      if (c.through === 1 && c.allRightAngles) return ['shortTee', 'longTee', 'clampOnTee', 'combinationSocket'];
      if (c.through === 0 && c.allRightAngles) return ['threeWayElbow'];
      if (c.through === 1) {
        const branch = c.angles.filter((a) => Math.abs(a - 180) > 3);
        const a = Math.min.apply(null, branch);
        if (Math.abs(a - 45) < 4) return ['tee45'];
        if (Math.abs(a - 70) < 12) return ['eavesRoof'];
        if (a >= 41 && a <= 64) return ['adjustableShortTee', 'shortTeeSwivel'];
        return ['shortTeeSwivel', 'singleSwivelCombination'];
      }
      return ['cornerSwivelCombination', 'singleSwivelCombination'];
    }
    if (c.n === 4) {
      if (c.through === 2 && c.allRightAngles) return ['twoSocketCross', 'sideOutletTee', 'clampOnCrossover'];
      if (c.through === 1 && c.allRightAngles) return ['threeWayThrough', 'sideOutletTee'];
      if (c.allRightAngles) return ['sideOutletTee', 'twoSocketCross'];
      return ['doubleSwivelCombination'];
    }
    if (c.n === 5) return ['fourSocketCross', 'sideOutletTee'];
    if (c.n === 6) return ['fourSocketCross'];
    return [];
  }

  /**
   * A swivel fitting has no fixed angle — it is set on site. Rather than
   * hunting for a rotation, build its sockets directly onto the directions the
   * pipes actually take. Returns world-space sockets, or null if the joint
   * cannot be made from this fitting.
   */
  function fitVariable(fit, nodeDirs) {
    const proto = fit.sockets;
    const used = new Array(nodeDirs.length).fill(false);
    const out = [];

    // a 'through' or 'clamp' prototype needs a collinear pair of pipes
    for (const s of proto) {
      if (s.kind !== 'through' && s.kind !== 'clamp') continue;
      let pair = null;
      for (let i = 0; i < nodeDirs.length && !pair; i++) {
        if (used[i]) continue;
        for (let j = i + 1; j < nodeDirs.length; j++) {
          if (used[j]) continue;
          if (nodeDirs[i].dot(nodeDirs[j]) < -1 + 0.02) { pair = [i, j]; break; }
        }
      }
      if (!pair) return null;
      used[pair[0]] = used[pair[1]] = true;
      const d = nodeDirs[pair[0]];
      out.push({ dir: [d.x, d.y, d.z], reach: s.reach, kind: s.kind });
    }

    // every remaining prototype takes one remaining pipe, at whatever angle
    const rest = proto.filter((s) => s.kind !== 'through' && s.kind !== 'clamp');
    const free = nodeDirs.map((d, i) => i).filter((i) => !used[i]);
    if (rest.length !== free.length) return null;
    rest.forEach((s, k) => {
      const d = nodeDirs[free[k]];
      out.push({ dir: [d.x, d.y, d.z], reach: s.reach, kind: 'socket', swivel: true });
    });
    return out;
  }

  /* ---- infill panels ----------------------------------------------------
     A panel is a flat sheet filling an opening in the frame, bolted to the
     poles around it with Double Fixing Pads. It is stored as the poles it
     hangs on; the outline is worked out from their joints, so the panel
     follows the frame when the frame moves.                              */

  const SHEET = (id) => (global.CATALOGUE.SHEETS || []).find((s) => s.id === id)
    || (global.CATALOGUE.SHEETS || [])[0];

  /** Best-fit plane through a set of points: centroid plus a normal. */
  function fitPlane(pts) {
    const c = new THREE.Vector3();
    pts.forEach((p) => c.add(p));
    c.multiplyScalar(1 / pts.length);
    // widest spread gives u; the point furthest off that line gives v
    let u = null, best = 0;
    pts.forEach((p) => {
      const d = p.clone().sub(c); const L = d.length();
      if (L > best) { best = L; u = d.clone().normalize(); }
    });
    if (!u) return null;
    let v = null; best = 0;
    pts.forEach((p) => {
      const d = p.clone().sub(c);
      const perp = d.clone().sub(u.clone().multiplyScalar(d.dot(u)));
      if (perp.length() > best) { best = perp.length(); v = perp.clone().normalize(); }
    });
    if (!v) return null;
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    return { centre: c, u, v: new THREE.Vector3().crossVectors(n, u).normalize(), normal: n };
  }

  /** Convex hull of 2D points, counter-clockwise (monotone chain). */
  function hull2d(pts) {
    const p = pts.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    if (p.length < 3) return p;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  /**
   * Work out a panel's outline, area and how many fixing pads it needs.
   * Returns null if the poles it names have gone.
   */
  function solvePanel(panel, state) {
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    const edges = panel.edges
      .map((id) => state.edges.find((e) => e.id === id))
      .filter(Boolean);
    if (edges.length < 2) return null;

    const ids = new Set();
    edges.forEach((e) => { ids.add(e.a); ids.add(e.b); });
    const pts = Array.from(ids).map((id) => {
      const n = byId.get(id);
      return n ? new THREE.Vector3(n.p[0], n.p[1], n.p[2]) : null;
    }).filter(Boolean);
    if (pts.length < 3) return null;

    const pl = fitPlane(pts);
    if (!pl) return null;

    // how far the poles stray from that plane — a warped opening cannot take
    // a flat sheet, and it is better to say so than to draw a lie
    let flatness = 0;
    pts.forEach((p) => {
      flatness = Math.max(flatness, Math.abs(p.clone().sub(pl.centre).dot(pl.normal)));
    });

    const flat = pts.map((p) => {
      const d = p.clone().sub(pl.centre);
      return { x: d.dot(pl.u), y: d.dot(pl.v) };
    });
    const ring2 = hull2d(flat);
    if (ring2.length < 3) return null;

    let area2 = 0;
    for (let i = 0; i < ring2.length; i++) {
      const a = ring2[i], b = ring2[(i + 1) % ring2.length];
      area2 += a.x * b.y - b.x * a.y;
    }
    const areaMm2 = Math.abs(area2) / 2;

    const ring = ring2.map((q) => pl.centre.clone()
      .add(pl.u.clone().multiplyScalar(q.x))
      .add(pl.v.clone().multiplyScalar(q.y)));

    // pads spaced along every pole the sheet bolts to, minimum two each
    const spacing = state.settings.padSpacing || global.CATALOGUE.PAD_SPACING || 600;
    let pads = 0;
    const padPoints = [];
    edges.forEach((e) => {
      const a = byId.get(e.a), b = byId.get(e.b);
      if (!a || !b) return;
      const ap = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      const bp = new THREE.Vector3(b.p[0], b.p[1], b.p[2]);
      const len = ap.distanceTo(bp);
      const n = Math.max(2, Math.round(len / spacing) + 1);
      pads += n;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;           // keep them clear of the fittings
        padPoints.push({ pos: ap.clone().lerp(bp, t), dir: bp.clone().sub(ap).normalize() });
      }
    });

    const mat = SHEET(panel.material);
    return {
      id: panel.id, ring, normal: pl.normal, centre: pl.centre,
      areaM2: areaMm2 / 1e6, pads, padPoints, material: mat,
      thickness: mat ? mat.thickness : 12,
      flatness,
      warn: flatness > 5 ? 'Opening is not flat — a rigid sheet will not sit in it' : null
    };
  }

  function solvePanels(state) {
    return (state.panels || []).map((p) => solvePanel(p, state)).filter(Boolean);
  }

  /* ---- main solve ----------------------------------------------------- */

  function byId(id) { return global.CATALOGUE.FITTINGS.find((f) => f.id === id); }

  /**
   * For a graph of nodes + edges, decide the fitting at every node.
   * Returns { joints: Map(nodeId -> {fit, quat, dirs, sockets, warn}) }
   */
  function solveJoints(state) {
    const joints = new Map();
    state.nodes.forEach((node) => {
      const inc = state.edges.filter((e) => e.a === node.id || e.b === node.id);
      if (!inc.length) return;
      const dirs = inc.map((e) => {
        const other = state.nodes.find((n) => n.id === (e.a === node.id ? e.b : e.a));
        return v3(other.p).sub(v3(node.p)).normalize();
      });
      const cls = classify(dirs);
      const override = state.overrides && state.overrides[node.id];
      const ids = override ? [override].concat(candidates(cls, node, { dirs }))
        : candidates(cls, node, { dirs });

      let chosen = null;
      for (const id of ids) {
        const fit = byId(id);
        if (!fit || !fit.sockets) continue;
        const isOverride = (id === override);

        if (fit.variable) {
          const sock = fitVariable(fit, dirs);
          if (!sock) continue;
          // sockets are already in world space, so no rotation is needed
          const inst = Object.assign({}, fit, { sockets: sock });
          const map = dirs.map((nd) => {
            let best = sock[0], bestDot = -2;
            sock.forEach((s) => {
              const v = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]);
              [v, v.clone().negate()].forEach((cand, k) => {
                if (k === 1 && s.kind !== 'through' && s.kind !== 'clamp') return;
                const d = cand.dot(nd);
                if (d > bestDot) { bestDot = d; best = s; }
              });
            });
            return best;
          });
          chosen = { fit: inst, quat: new THREE.Quaternion(), map, spare: 0 };
          break;
        }

        const or = findOrientation(fit, dirs, { allowSpare: isOverride });
        if (or) {
          const spare = fittingDirs(fit).length - dirs.length;
          chosen = { fit, quat: or.quat, map: or.map, spare: isOverride ? spare : 0 };
          break;
        }
      }
      if (!chosen) {
        // nothing in the catalogue matches this joint exactly
        const fallbackId = ids[0] || null;
        const fit = fallbackId ? byId(fallbackId) : null;
        joints.set(node.id, {
          fit, quat: new THREE.Quaternion(), dirs, edges: inc, cls,
          warn: fit
            ? 'Fitting orientation is approximate — check this joint on site.'
            : 'No standard 27mm fitting matches this joint (' + cls.n + ' pipes). Rework the geometry or specify a fabricated part.'
        });
        return;
      }
      joints.set(node.id, {
        fit: chosen.fit, quat: chosen.quat, dirs, edges: inc, cls,
        socketFor: (edgeId) => chosen.map[inc.findIndex((e) => e.id === edgeId)],
        spare: chosen.spare,
        warn: chosen.fit.estimated
          ? 'Dimensions for this fitting are scaled, not published — verify before cutting.'
          : (chosen.spare
            ? chosen.spare + ' socket' + (chosen.spare === 1 ? '' : 's') +
              ' on this fitting will be left empty.'
            : null)
      });
    });
    return joints;
  }

  /* ---- runs, cut list -------------------------------------------------- */

  // How far from the joint centre a pipe end sits inside this socket.
  function pipeStop(socket, settings) {
    if (!socket) return 12;
    if (socket.kind === 'through') return null;      // pipe carries straight on
    if (socket.kind === 'clamp') return null;        // pipe passes the outside
    // A spigot enters the pipe rather than the pipe entering it, so the pipe
    // end butts the collar at a fixed distance — the insertion setting, which
    // is about how deep a pipe sits in a socket, does not apply.
    if (socket.kind === 'spigot') return socket.reach;
    const insert = settings.insertDepth;
    return Math.max(5, socket.reach - insert);
  }

  /**
   * Merge collinear edges that run straight through a fitting into single
   * pipe runs, then work out the length each run must be cut to.
   */
  function buildRuns(state, joints, settings) {
    const edgeById = new Map(state.edges.map((e) => [e.id, e]));
    const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
    const seen = new Set();
    const runs = [];

    const dirOf = (e, fromId) => {
      const a = nodeById.get(fromId), b = nodeById.get(e.a === fromId ? e.b : e.a);
      return v3(b.p).sub(v3(a.p)).normalize();
    };

    // does the joint at nodeId let a pipe pass straight through along dir?
    const passesThrough = (nodeId, edge) => {
      const j = joints.get(nodeId);
      if (!j || !j.socketFor) return null;
      const s = j.socketFor(edge.id);
      if (!s || s.kind !== 'through') return null;
      const d = dirOf(edge, nodeId);
      const cont = j.edges.find((e2) => {
        if (e2.id === edge.id) return false;
        return dirOf(e2, nodeId).dot(d) < -1 + 0.02;
      });
      return cont || null;
    };

    state.edges.forEach((start) => {
      if (seen.has(start.id)) return;
      const chain = [start];
      seen.add(start.id);

      // walk out from both ends of this edge
      let endA = start.a, endB = start.b;

      // extend from endB
      let cur = start, node = endB;
      for (;;) {
        const nxt = passesThrough(node, cur);
        if (!nxt || seen.has(nxt.id)) break;
        seen.add(nxt.id); chain.push(nxt);
        node = (nxt.a === node) ? nxt.b : nxt.a;
        cur = nxt;
      }
      endB = node;
      // extend from endA
      cur = start; node = endA;
      for (;;) {
        const nxt = passesThrough(node, cur);
        if (!nxt || seen.has(nxt.id)) break;
        seen.add(nxt.id); chain.unshift(nxt);
        node = (nxt.a === node) ? nxt.b : nxt.a;
        cur = nxt;
      }
      endA = node;

      const centreLen = chain.reduce((sum, e) => {
        const a = nodeById.get(e.a), b = nodeById.get(e.b);
        return sum + v3(a.p).distanceTo(v3(b.p));
      }, 0);

      const stopAt = (nodeId, edge) => {
        const j = joints.get(nodeId);
        if (!j) return 0;
        const s = j.socketFor ? j.socketFor(edge.id) : null;
        const st = pipeStop(s, settings);
        return st == null ? 0 : st;
      };
      const cut = centreLen - stopAt(endA, chain[0]) - stopAt(endB, chain[chain.length - 1]);

      runs.push({
        edges: chain.map((e) => e.id), endA, endB,
        centreLen, cut: Math.round(cut * 10) / 10,
        spans: chain.length
      });
    });
    return runs;
  }

  /* ---- stock buying plan ---------------------------------------------- */

  /**
   * First-fit-decreasing bin packing across the six stock lengths, evaluated
   * for every single-stock option plus a mixed strategy; cheapest wins.
   */
  function planStock(cuts, settings) {
    const stock = global.CATALOGUE.TUBE.stock.slice().sort((a, b) => a.mm - b.mm);
    const kerf = settings.kerf;
    const pieces = [];
    cuts.forEach((c) => { for (let i = 0; i < c.qty; i++) pieces.push(c.mm); });
    pieces.sort((a, b) => b - a);

    const tooLong = pieces.filter((p) => p > stock[stock.length - 1].mm);
    const fit = pieces.filter((p) => p <= stock[stock.length - 1].mm);

    function pack(allowed) {
      const bins = [];
      for (const p of fit) {
        let placed = false;
        for (const b of bins) {
          if (b.left >= p + (b.cuts.length ? kerf : 0)) {
            b.left -= p + (b.cuts.length ? kerf : 0); b.cuts.push(p); placed = true; break;
          }
        }
        if (!placed) {
          const s = allowed.filter((s) => s.mm >= p).sort((a, b) => a.mm - b.mm)[0];
          if (!s) return null;
          bins.push({ stock: s, left: s.mm - p, cuts: [p] });
        }
      }
      const cost = bins.reduce((t, b) => t + b.stock.price, 0);
      return { bins, cost };
    }

    let best = null;
    // try each stock length on its own
    stock.forEach((s) => {
      const r = pack([s]);
      if (r && (!best || r.cost < best.cost)) best = r;
    });
    // and a mixed plan
    const mixed = pack(stock);
    if (mixed && (!best || mixed.cost < best.cost)) best = mixed;
    if (!best) best = { bins: [], cost: 0 };

    const waste = best.bins.reduce((t, b) => t + b.left, 0);
    const bought = {};
    best.bins.forEach((b) => {
      bought[b.stock.sku] = bought[b.stock.sku] || { stock: b.stock, qty: 0 };
      bought[b.stock.sku].qty++;
    });
    return {
      bins: best.bins, cost: best.cost, waste,
      bought: Object.values(bought),
      tooLong: tooLong.map((mm) => Math.round(mm))
    };
  }

  /* ---- bill of materials ---------------------------------------------- */

  function bom(state, joints, runs, settings) {
    const fittings = {};
    const add = (fit, n) => {
      // an assembly bills as its component parts, so the BOM stays orderable
      if (fit.madeOf) {
        fit.madeOf.forEach((cid) => {
          const c = byId(cid); if (!c) return;
          fittings[c.id] = fittings[c.id] || { fit: c, qty: 0 };
          fittings[c.id].qty += n;
        });
        return;
      }
      fittings[fit.id] = fittings[fit.id] || { fit, qty: 0 };
      fittings[fit.id].qty += n;
    };
    joints.forEach((j) => { if (j.fit) add(j.fit, 1); });
    (state.extras || []).forEach((x) => {
      const f = byId(x.id); if (f) add(f, x.qty);
    });

    // Any run longer than the longest stock length has to be made from
    // several pipes joined with sleeve joints. Split it and pay for them.
    const maxStock = Math.max.apply(null, global.CATALOGUE.TUBE.stock.map((s) => s.mm));
    const cutMap = {};
    let sleevesNeeded = 0;
    runs.forEach((r) => {
      if (r.cut <= 0) return;
      let pieces = [r.cut];
      if (r.cut > maxStock) {
        const n = Math.ceil(r.cut / maxStock);
        // pipe ends butt inside a sleeve joint, so no length is lost
        pieces = new Array(n).fill(r.cut / n);
        sleevesNeeded += n - 1;
        r.splitInto = n;
      }
      pieces.forEach((p) => {
        const key = Math.round(p);
        cutMap[key] = (cutMap[key] || 0) + 1;
      });
    });
    if (sleevesNeeded) add(byId('sleeveJoint'), sleevesNeeded);
    const cuts = Object.keys(cutMap).map((k) => ({ mm: +k, qty: cutMap[k] }))
      .sort((a, b) => b.mm - a.mm);

    const fitRows = Object.values(fittings).sort((a, b) => b.qty * b.fit.price - a.qty * a.fit.price);
    const fitCost = fitRows.reduce((t, r) => t + r.qty * r.fit.price, 0);
    const fitWeight = fitRows.reduce((t, r) => t + r.qty * (r.fit.weight || 0), 0);

    const plan = planStock(cuts, settings);
    const totalPipeMm = runs.reduce((t, r) => t + Math.max(0, r.cut), 0);

    // tube weight: steel ring section, 7850 kg/m3
    const od = global.CATALOGUE.TUBE.od / 1000, w = settings.wall / 1000;
    const kgPerM = Math.PI * (Math.pow(od / 2, 2) - Math.pow(od / 2 - w, 2)) * 7850;

    const pipeCost = settings.pipeMode === 'exact'
      ? cuts.reduce((t, c) => {
          const s = global.CATALOGUE.TUBE.stock.slice().sort((a, b) => a.mm - b.mm)
            .find((s) => s.mm >= c.mm) || global.CATALOGUE.TUBE.stock[global.CATALOGUE.TUBE.stock.length - 1];
          return t + s.price * c.qty;
        }, 0)
      : plan.cost;

    // panels, and the fixing pads that hold them on
    const panels = solvePanels(state);
    const panelRows = [];
    let panelCost = 0, panelWeight = 0, padCount = 0;
    panels.forEach((p) => {
      if (!p.material) return;
      padCount += p.pads;
      const cost = p.areaM2 * p.material.perM2;
      panelCost += cost;
      panelWeight += p.areaM2 * (p.material.thickness / 1000) * p.material.density;
      panelRows.push({
        name: p.material.name, areaM2: p.areaM2, cost,
        estimated: !!p.material.estimated, pads: p.pads, warn: p.warn
      });
    });
    if (padCount) add(byId('doubleFixingPad'), padCount);

    // recount fittings now the pads are in
    const fitRows2 = Object.values(fittings)
      .sort((a, b) => b.qty * b.fit.price - a.qty * a.fit.price);
    const fitCost2 = fitRows2.reduce((t, r) => t + r.qty * r.fit.price, 0);
    const fitWeight2 = fitRows2.reduce((t, r) => t + r.qty * (r.fit.weight || 0), 0);

    const sub = fitCost2 + pipeCost + panelCost;
    const vat = settings.vat ? sub * global.CATALOGUE.vatRate : 0;

    return {
      fitRows: fitRows2, fitCost: fitCost2, fitWeight: fitWeight2, sleevesNeeded,
      cuts, plan, pipeCost, totalPipeMm,
      pipeWeight: (totalPipeMm / 1000) * kgPerM,
      panels, panelRows, panelCost, panelWeight, padCount,
      sub, vat, total: sub + vat,
      weight: fitWeight2 + (totalPipeMm / 1000) * kgPerM + panelWeight
    };
  }

  /** Which fitting a joint would need, for a set of directions. Used to preview
   *  the consequence of a pole before it is placed. */
  function pickFitting(node, dirs) {
    const cls = classify(dirs);
    for (const id of candidates(cls, node, { dirs })) {
      const fit = byId(id);
      if (fit && fit.sockets && findOrientation(fit, dirs)) return fit;
    }
    return null;
  }

  global.KCEngine = {
    solveJoints, buildRuns, bom, planStock, classify, findOrientation, byId,
    pipeStop, pickFitting, candidates, solvePanels, solvePanel
  };
})(window);
