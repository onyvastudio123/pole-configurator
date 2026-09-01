/* ============================================================================
   models.js — procedural Three.js geometry for 27mm key clamp fittings.
   Every fitting is generated from its catalogue socket list + real datasheet
   dimensions, so the model and the cut list can never drift apart.
   ==========================================================================*/
(function (global) {
  'use strict';

  const G = () => global.CATALOGUE.G;

  /* ---- materials --------------------------------------------------- */
  const MAT = {};
  function materials() {
    if (MAT.iron) return MAT;
    // Cast iron with an electrophoretic black finish: a near-black body with
    // a tight specular sheen, not a bare metal that mirrors the whole room.
    MAT.iron = new THREE.MeshStandardMaterial({
      color: 0x0d0e10, roughness: 0.38, metalness: 0.18, envMapIntensity: 1.15
    });
    MAT.ironHot = new THREE.MeshStandardMaterial({
      color: 0x2b6cb0, roughness: 0.35, metalness: 0.6,
      emissive: 0x0d2a45, emissiveIntensity: 0.6
    });
    // Powder coated tube is smoother than the castings, so it reads glossier.
    MAT.pipe = new THREE.MeshStandardMaterial({
      color: 0x101113, roughness: 0.26, metalness: 0.16, envMapIntensity: 1.3
    });
    MAT.pipeHot = new THREE.MeshStandardMaterial({
      color: 0x2f7fd0, roughness: 0.3, metalness: 0.55,
      emissive: 0x123a5c, emissiveIntensity: 0.5
    });
    MAT.screw = new THREE.MeshStandardMaterial({
      color: 0x0a0a0b, roughness: 0.5, metalness: 0.85
    });
    MAT.plate = new THREE.MeshStandardMaterial({
      color: 0x0d0e10, roughness: 0.44, metalness: 0.18, envMapIntensity: 1.1
    });
    return MAT;
  }

  /* ---- primitive builders ------------------------------------------ */

  // A hollow socket: outer barrel with a bored mouth, drawn as a lathe so the
  // wall thickness reads properly at the open end.
  function socketGeom(len, od, bore, roundMouth) {
    const ro = od / 2, ri = bore / 2, c = Math.min(2.2, (ro - ri) * 0.6);
    const pts = [];
    pts.push(new THREE.Vector2(ri, 0));
    pts.push(new THREE.Vector2(ro, 0));
    pts.push(new THREE.Vector2(ro, len - c));
    if (roundMouth !== false) {
      // small rolled lip at the mouth
      for (let i = 0; i <= 4; i++) {
        const t = (i / 4) * Math.PI * 0.5;
        pts.push(new THREE.Vector2(ro - c + c * Math.cos(t), len - c + c * Math.sin(t)));
      }
    } else {
      pts.push(new THREE.Vector2(ro, len));
    }
    pts.push(new THREE.Vector2(ri, len));
    pts.push(new THREE.Vector2(ri, 0));
    return new THREE.LatheGeometry(pts, 40);
  }

  // Solid boss (no bore) — used for pins, caps, plate stalks.
  function solidGeom(len, od) {
    return new THREE.CylinderGeometry(od / 2, od / 2, len, 32);
  }

  // Grub screw: raised boss + hex socket head, growing along +X from x=0.
  // The caller sits x=0 on the outside of the socket barrel.
  const HEX_MAT = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.78, metalness: 0.4 });
  function grubScrew() {
    const g = G(), m = materials(), grp = new THREE.Group();
    // the boss flares back into the casting, so start it slightly sunk
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(g.grubOD / 2, g.grubOD / 2 + 3.0, g.grubLen + 3, 24), m.iron);
    boss.rotation.z = -Math.PI / 2;
    boss.position.x = (g.grubLen + 3) / 2 - 3;
    grp.add(boss);
    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(g.grubOD / 2 - 2.6, g.grubOD / 2 - 2.4, 3.0, 20), m.screw);
    head.rotation.z = -Math.PI / 2;
    head.position.x = g.grubLen - 1.0;
    grp.add(head);
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 2.6, 6), HEX_MAT);
    hex.rotation.z = -Math.PI / 2;
    hex.rotation.x = Math.PI / 6;
    hex.position.x = g.grubLen - 0.4;
    grp.add(hex);
    return grp;
  }

  // Orient a +Y-aligned object onto an arbitrary direction.
  const UP = new THREE.Vector3(0, 1, 0);
  function aim(obj, dir) {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    obj.quaternion.setFromUnitVectors(UP, d);
    return obj;
  }

  // Pick a radial direction for a grub screw on a socket pointing along dir.
  // Screws sit on the outward face of the casting, so choose the perpendicular
  // that points furthest away from every other socket on the fitting.
  function perpTo(dir, others) {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const ref = Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const base = new THREE.Vector3().crossVectors(d, ref).normalize();
    if (!others || !others.length) return base;
    let best = base, bestScore = Infinity;
    for (let i = 0; i < 24; i++) {
      const q = new THREE.Quaternion().setFromAxisAngle(d, (i / 24) * Math.PI * 2);
      const cand = base.clone().applyQuaternion(q);
      const score = others.reduce((m, o) => Math.max(m, cand.dot(o)), -Infinity);
      if (score < bestScore) { bestScore = score; best = cand; }
    }
    return best;
  }

  /* ---- flange plates ------------------------------------------------ */
  function plateMesh(plate) {
    const m = materials(), grp = new THREE.Group();
    let body;
    if (plate.shape === 'round') {
      body = new THREE.Mesh(new THREE.CylinderGeometry(plate.d / 2, plate.d / 2, plate.t, 44), m.plate);
    } else if (plate.shape === 'square') {
      body = new THREE.Mesh(new THREE.BoxGeometry(plate.w, plate.t, plate.w), m.plate);
    } else { // oval — a stadium: two half-round ends joined by straight sides
      const s = new THREE.Shape();
      const l = plate.l / 2, w = plate.w / 2, cx = Math.max(0, l - w);
      s.moveTo(-cx, w);
      s.lineTo(cx, w);
      s.absarc(cx, 0, w, Math.PI / 2, -Math.PI / 2, true);
      s.lineTo(-cx, -w);
      s.absarc(-cx, 0, w, -Math.PI / 2, -Math.PI * 1.5, true);
      const geo = new THREE.ExtrudeGeometry(s, { depth: plate.t, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 2 });
      geo.rotateX(-Math.PI / 2);
      body = new THREE.Mesh(geo, m.plate);
    }
    body.position.y = plate.t / 2;
    grp.add(body);

    // bolt holes, drawn as recessed dark discs (visual only)
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9, metalness: 0.1 });
    const positions = [];
    if (plate.holes === 2) {
      positions.push([-plate.holeSpan / 2, 0], [plate.holeSpan / 2, 0]);
    } else if (plate.holes === 4) {
      const r = (plate.shape === 'round' ? plate.d : plate.w) * 0.34;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        positions.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    positions.forEach(([x, z]) => {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(plate.holeDia / 2, plate.holeDia / 2, plate.t + 0.6, 16), holeMat);
      h.position.set(x, plate.t / 2, z);
      grp.add(h);
    });
    return grp;
  }

  /* ---- the main builder --------------------------------------------- */
  /**
   * Build a fitting mesh group in local space, origin at the joint centre,
   * with sockets pointing along their catalogue directions.
   * Returns a THREE.Group with .userData.fitting set.
   */
  function buildFitting(fit, opts) {
    opts = opts || {};
    const g = G(), m = materials();
    const mat = opts.highlight ? m.ironHot : m.iron;
    const grp = new THREE.Group();
    grp.userData.fitting = fit;

    const sockets = fit.sockets || [];

    // every socket axis on this fitting, used to keep grub screws clear of them
    const allAxes = [];
    sockets.forEach((s) => {
      const v = new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize();
      allAxes.push(v);
      if (s.kind === 'through' || s.kind === 'clamp') allAxes.push(v.clone().negate());
    });

    // An internal joiner shows only its collar — the rest is inside the tube.
    if (fit.internal) {
      const band = (fit.sheet && fit.sheet.b) || 22;
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(g.tubeOD / 2 + 0.4, g.tubeOD / 2 + 0.4, band, 32), mat);
      const ax = sockets[0] ? sockets[0].dir : [0, 1, 0];
      collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(ax[0], ax[1], ax[2]).normalize());
      grp.add(collar);
    }

    // Central body: a rounded blob that swallows the socket roots.
    if (!fit.internal && (sockets.length > 1 || fit.plate)) {
      const bodyR = g.bossOD / 2 * (sockets.length >= 4 ? 1.06 : 0.98);
      const body = new THREE.Mesh(new THREE.SphereGeometry(bodyR, 28, 20), mat);
      body.scale.set(1, 0.94, 1);
      grp.add(body);
    }

    sockets.forEach((s) => {
      const dirs = (s.kind === 'through') ? [s.dir, [-s.dir[0], -s.dir[1], -s.dir[2]]] : [s.dir];
      dirs.forEach((dir) => {
        let mesh;
        if (s.kind === 'pin') {
          // male swivel lug: a flat tab with a pin hole
          const tab = new THREE.Mesh(new THREE.BoxGeometry(s.reach, 11, 20), mat);
          tab.position.set(s.reach / 2, 0, 0);
          const holder = new THREE.Group();
          holder.add(tab);
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 13, 16), m.screw);
          pin.rotation.x = Math.PI / 2;
          pin.position.set(s.reach * 0.72, 0, 0);
          holder.add(pin);
          aim(holder, [0, 1, 0]);
          holder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(dir[0], dir[1], dir[2]).normalize());
          grp.add(holder);
          return;
        }
        if (s.kind === 'clevis') {
          const holder = new THREE.Group();
          [-1, 1].forEach((side) => {
            const jaw = new THREE.Mesh(new THREE.BoxGeometry(11, s.reach, 8), mat);
            jaw.position.set(0, s.reach / 2, side * (11.2 / 2 + 4));
            holder.add(jaw);
          });
          aim(holder, dir);
          grp.add(holder);
          return;
        }
        if (s.kind === 'spigot') {
          // Expanding connector: a tapered leg that disappears inside the tube.
          // Drawn slightly under the bore so it never z-fights the pipe wall.
          const id = g.tubeOD - 2 * 3.2;
          const leg = s.leg || 27;
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(id / 2 - 0.5, id / 2 - 1.4, leg, 20), mat);
          mesh.position.set(
            dir[0] * (s.reach + leg / 2), dir[1] * (s.reach + leg / 2), dir[2] * (s.reach + leg / 2));
          aim(mesh, dir);
          grp.add(mesh);
          return;
        }
        if (s.kind === 'cap') {
          mesh = new THREE.Mesh(solidGeom(s.reach, g.tubeOD + 1.6), mat);
          mesh.position.set(dir[0] * s.reach / 2, dir[1] * s.reach / 2, dir[2] * s.reach / 2);
          aim(mesh, dir);
          grp.add(mesh);
          return;
        }

        // 'socket', 'through' and 'clamp' are all hollow barrels
        const len = s.reach;
        const od = (s.kind === 'clamp') ? g.bossOD - 2 : g.bossOD;
        mesh = new THREE.Mesh(socketGeom(len, od, g.bore, s.kind !== 'clamp'), mat);
        aim(mesh, dir);
        grp.add(mesh);

        // Grub screw, sat about 60% of the way along the socket and standing
        // proud of the barrel — this is what makes a key clamp read as one.
        if (s.kind !== 'clamp' || dirs.length === 1) {
          const screw = grubScrew();
          const dv = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
          const others = allAxes.filter((a) => Math.abs(a.dot(dv)) < 0.95);
          const p = perpTo(dir, others);
          const along = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize()
            .multiplyScalar(THREE.MathUtils.clamp(len * 0.62, 13, Math.max(13, len - 11)));
          screw.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), p);
          screw.position.copy(along).add(p.clone().multiplyScalar(od / 2 - 2.4));
          grp.add(screw);
        }
      });
    });

    // flange plate at the socket root, facing away from the socket
    if (fit.plate) {
      const p = plateMesh(fit.plate);
      const d = sockets[0] ? sockets[0].dir : [0, 1, 0];
      p.position.set(0, 0, 0);
      aim(p, [-d[0], -d[1], -d[2]]);
      grp.add(p);
    }

    grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return grp;
  }

  /* ---- pipes --------------------------------------------------------- */
  function buildPipe(lengthMm, highlight) {
    const g = G(), m = materials();
    const mat = highlight ? m.pipeHot : m.pipe;
    const geo = new THREE.CylinderGeometry(g.tubeOD / 2, g.tubeOD / 2, lengthMm, 30, 1, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  global.KCModels = { buildFitting, buildPipe, materials, aim, socketGeom, plateMesh };
})(window);
