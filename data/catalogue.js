/* ============================================================================
   KEY CLAMP CATALOGUE — 27mm (26.9mm OD / 3/4" NB) Electrophoretic Black
   Source: pipedreamfittings.com, scraped 2026-08-25.
   Prices are GBP EX VAT as listed on the product pages.
   Dimensions in mm, taken from the "Data Sheet" drawings on each product page
   (the 26,9 mm (3/4") row of the size table).
   Fields marked estimated:true had no 26.9mm row published — see note.
   ==========================================================================*/

const TUBE = {
  od: 26.9,          // outside diameter, mm
  wall: 3.2,         // ASSUMPTION - not published on the pipe page. Editable in Settings.
  nominal: '3/4"',
  label: '27mm',
  colour: 'RAL 9005 Black',
  // Stock lengths sold, price ex VAT (variable product PCPB-27-*)
  stock: [
    { sku: 'PCPB-27-50',  mm:  500, price:  5.95 },
    { sku: 'PCPB-27-100', mm: 1000, price:  9.95 },
    { sku: 'PCPB-27-150', mm: 1500, price: 18.95 },
    { sku: 'PCPB-27-200', mm: 2000, price: 22.95 },
    { sku: 'PCPB-27-250', mm: 2500, price: 29.95 },
    { sku: 'PCPB-27-300', mm: 3000, price: 32.95 }
  ],
  url: 'https://pipedreamfittings.com/product/black-powder-coated-pipe-27mm-34mm-ral-9005/'
};

// Derived geometry shared by every fitting of this size.
const G = {
  tubeOD:   26.9,
  bore:     27.6,   // socket bore (tube + running clearance)
  bossOD:   38.0,   // outside diameter of a socket boss  (from 6080Z28 ring dia a=38)
  barrel:   41.0,   // length of a through-barrel          (from 608002/608006 a=41)
  grubOD:   14.0,   // grub-screw boss outer diameter
  grubLen:   6.0
};

/* Socket definition:
     dir    unit vector, fitting local space
     reach  mm from the fitting origin (= the joint centre) to the socket mouth
     kind   'socket'  pipe enters and stops
            'through' pipe passes clean through (dir and -dir are one member)
            'clamp'   clamps onto the outside of a pipe that passes by
*/

const FITTINGS = [
  /* ---------- Core structural connectors ------------------------------ */
  {
    id: 'elbow90', sku: 'KCBE-27', type: '608006B / 125-A27',
    name: 'Elbow 90°', price: 2.14, weight: 0.24,
    sheet: { a: 41 },
    sockets: [
      { dir: [1, 0, 0], reach: 41, kind: 'socket' },
      { dir: [0, 1, 0], reach: 41, kind: 'socket' }
    ],
    role: 'connector', ends: 2,
    url: 'https://pipedreamfittings.com/product/elbow-90-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'shortTee', sku: 'KCBST-27', type: '608002B / 101-27-A',
    name: 'Short Tee', price: 2.24, weight: 0.19,
    sheet: { a: 41 },
    sockets: [
      { dir: [1, 0, 0], reach: 20.5, kind: 'through' },
      { dir: [0, -1, 0], reach: 41, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/short-tee-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'longTee', sku: 'KCBLT-27', type: '608004B / 104-27-A',
    name: 'Long Tee', price: 3.49, weight: 0.35,
    sheet: { a: 41, b: 82 },
    sockets: [
      { dir: [1, 0, 0], reach: 41, kind: 'through' },
      { dir: [0, -1, 0], reach: 41, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/long-tee-27mm-black-key-clamp/'
  },
  {
    id: 'threeWayElbow', sku: 'KCBTWE-27', type: '6080Z18B / 128-A27',
    name: 'Three Way Elbow (corner)', price: 3.49, weight: 0.35,
    sheet: { a: 40 },
    sockets: [
      { dir: [1, 0, 0], reach: 40, kind: 'socket' },
      { dir: [0, 0, 1], reach: 40, kind: 'socket' },
      { dir: [0, -1, 0], reach: 40, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/three-way-90-elbow-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'threeWayThrough', sku: 'KCBTWT-27', type: '608020B / 116-27-A',
    name: 'Three Way Through (corner post)', price: 2.92, weight: 0.27,
    sheet: { a: 40 },
    sockets: [
      { dir: [0, 1, 0], reach: 20.5, kind: 'through' },
      { dir: [1, 0, 0], reach: 40, kind: 'socket' },
      { dir: [0, 0, 1], reach: 40, kind: 'socket' }
    ],
    role: 'connector', ends: 4,
    url: 'https://pipedreamfittings.com/product/three-way-through-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'twoSocketCross', sku: 'KCBTSC-27', type: '6080Z22B / 119-27-A',
    name: 'Two Socket Cross', price: 2.94, weight: 0.27,
    sheet: { a: 80 },
    sockets: [
      { dir: [0, 1, 0], reach: 20.5, kind: 'through' },
      { dir: [1, 0, 0], reach: 40, kind: 'socket' },
      { dir: [-1, 0, 0], reach: 40, kind: 'socket' }
    ],
    role: 'connector', ends: 4,
    url: 'https://pipedreamfittings.com/product/two-socket-cross-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'sideOutletTee', sku: 'KCBSOT-27', type: '6080Z24B / 135-A27',
    name: 'Side Outlet Tee', price: 3.88, weight: 0.34,
    sheet: { a: 40 },
    sockets: [
      { dir: [1, 0, 0], reach: 40, kind: 'socket' },
      { dir: [-1, 0, 0], reach: 40, kind: 'socket' },
      { dir: [0, -1, 0], reach: 40, kind: 'socket' },
      { dir: [0, 0, 1], reach: 40, kind: 'socket' }
    ],
    role: 'connector', ends: 4,
    url: 'https://pipedreamfittings.com/product/side-outlet-tee-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'fourSocketCross', sku: 'KCBFWC-27', type: '6080Z26B / 126-A27',
    name: '4 Way Cross with Central Tube', price: 6.03, weight: 0.43,
    sheet: { a: 41, b: 32 },
    sockets: [
      { dir: [0, 0, 1], reach: 16, kind: 'through' },
      { dir: [1, 0, 0], reach: 41, kind: 'socket' },
      { dir: [-1, 0, 0], reach: 41, kind: 'socket' },
      { dir: [0, 1, 0], reach: 41, kind: 'socket' },
      { dir: [0, -1, 0], reach: 41, kind: 'socket' }
    ],
    role: 'connector', ends: 6,
    url: 'https://pipedreamfittings.com/product/4-way-cross-with-central-tube-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'sleeveJoint', sku: 'KCBSJ-27', type: '608008B / 149-27-A',
    name: 'Sleeve Joint (inline coupler)', price: 3.18, weight: 0.27,
    sheet: { a: 76 },
    // 76 mm long overall, so each pipe has 38 mm of socket to enter
    sockets: [
      { dir: [0, 1, 0], reach: 38, kind: 'socket' },
      { dir: [0, -1, 0], reach: 38, kind: 'socket' }
    ],
    role: 'inline', ends: 2,
    note: 'Slides over both pipe ends. Adds 38 mm of collar either side of the joint.',
    url: 'https://pipedreamfittings.com/product/sleeve-joint-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'expandingConnector', sku: 'KCBEC-27', type: '6080Z09B',
    name: 'Expanding Connector (internal joiner)', price: 1.71, weight: 0.15,
    // 6080Z09B data sheet, 26,9 mm row: a = 76 overall, b = 22 collar, 1/4" BSP
    sheet: { a: 76, b: 22, bsp: '1/4"' },
    // The legs go *inside* the tube; only the 22 mm collar shows, so each pipe
    // ends 11 mm from the joint centre regardless of the insertion setting.
    sockets: [
      { dir: [0, 1, 0], reach: 11, kind: 'spigot', leg: 27 },
      { dir: [0, -1, 0], reach: 11, kind: 'spigot', leg: 27 }
    ],
    role: 'inline', ends: 2, internal: true,
    note: 'Hidden joint — expands inside both pipes. Only a 22 mm band shows.',
    url: 'https://pipedreamfittings.com/product/expanding-connector-black-key-clamp-fitting-27mm/'
  },
  {
    id: 'tee45', sku: 'KC45T-27-1', type: '608003B / 284A-A27',
    name: '45° Tee', price: 8.89, weight: 0.27,
    sheet: { a: 23.8, b: 14.5, c: 42, d: 30 },
    sockets: [
      { dir: [0, 1, 0], reach: 42, kind: 'through' },
      { dir: [0.7071, 0.7071, 0], reach: 42, kind: 'socket' }
    ],
    role: 'connector', ends: 3, angle: 45,
    url: 'https://pipedreamfittings.com/product/45-tee-27mm-black-key-clamp-fitting-284a-a27/'
  },
  {
    id: 'crossover90', sku: 'KCBCO-27', type: '6080Z28B / 145-A27',
    name: '90° Crossover', price: 2.79, weight: 0.20,
    sheet: { a: 38, b: 31.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [0, 0, 1], reach: 38, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/crossover-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'clampOnTee', sku: 'KCBCOT-27', type: '6080Z32B',
    name: 'Clamp On Tee', price: 3.05, weight: 0.27,
    sheet: { a: 50 },
    sockets: [
      { dir: [0, 1, 0], reach: 25, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 50, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/clamp-on-tee-27mm-black-key-clamp-fititng/'
  },
  {
    id: 'clampOnCrossover', sku: 'KCBCOC-27', type: '6080Z30',
    name: 'Clamp On Crossover', price: 2.79, weight: 0.22,
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [0, 0, 1], reach: 19, kind: 'clamp' }
    ],
    role: 'connector', ends: 4,
    url: 'https://pipedreamfittings.com/product/clamp-on-crossover-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'combinationSocket', sku: 'KCCS-27-1', type: '608030B / 165A-A27',
    name: 'Combination Socket', price: 7.97, weight: 0.28,
    sheet: { a: 35, b: 40 },
    sockets: [
      { dir: [0, 1, 0], reach: 17.5, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 40, kind: 'socket' }
    ],
    role: 'connector', ends: 3,
    url: 'https://pipedreamfittings.com/product/combination-socket-27mm-black-key-clamp-fitting-165a-a27/'
  },

  /* ---------- Anchors / bases ----------------------------------------- */
  {
    id: 'basePlate', sku: 'KCBBP-27', type: '6080Z12B / 132A-A27',
    name: 'Base Plate (oval, 2 hole)', price: 4.86, weight: 0.47,
    sheet: { a: 105, b: 60, c: 52, d: 76, hole: 11.5 },
    sockets: [ { dir: [0, 1, 0], reach: 60, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'oval', l: 105, w: 52, t: 8, holes: 2, holeSpan: 76, holeDia: 11.5 },
    url: 'https://pipedreamfittings.com/product/base-plate-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'basePlateBolts', sku: 'KCBBP-27-BOLTS', type: '132A-A27 + C12G20',
    name: 'Base Plate + M10 bolts', price: 7.35, weight: 0.55,
    sheet: { a: 105, b: 60, c: 52, d: 76, hole: 11.5 },
    sockets: [ { dir: [0, 1, 0], reach: 60, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'oval', l: 105, w: 52, t: 8, holes: 2, holeSpan: 76, holeDia: 11.5 },
    url: 'https://pipedreamfittings.com/product/base-plate-27mm-black-key-clamp-fitting-m10-bolts-included-132a-a27-c12g20/'
  },
  {
    id: 'wallPlate', sku: 'KCBWP-27', type: '608010B / 131-27-A',
    name: 'Wall Plate (round flange)', price: 2.74, weight: 0.29,
    sheet: { a: 42, b: 83, hole: 8 },
    sockets: [ { dir: [0, 1, 0], reach: 42, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'round', d: 83, t: 6, holes: 4, holeDia: 8 },
    url: 'https://pipedreamfittings.com/product/wall-plate-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'wallPlateBolts', sku: 'KCBWP-27-BOLTS', type: '131A-A27 + C11G20',
    name: 'Wall Plate + M6 bolts', price: 8.62, weight: 0.35,
    sheet: { a: 42, b: 83, hole: 8 },
    sockets: [ { dir: [0, 1, 0], reach: 42, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'round', d: 83, t: 6, holes: 4, holeDia: 8 },
    url: 'https://pipedreamfittings.com/product/wall-plate-27mm-black-key-clamp-fitting-m6-bolts-included-131a-a27-c11g20/'
  },
  {
    id: 'wallPlateOpen', sku: 'KCBOWP-27', type: '6080Z10TB',
    name: 'Wall Plate Open', price: 2.46, weight: 0.29,
    sheet: { a: 42, b: 70, hole: 6 },
    sockets: [ { dir: [0, 1, 0], reach: 42, kind: 'clamp' } ],
    role: 'anchor', ends: 1, plate: { shape: 'round', d: 70, t: 6, holes: 4, holeDia: 6 },
    url: 'https://pipedreamfittings.com/product/wall-plate-open-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'wallPlateSquare', sku: 'KCBWPS-27', type: '6080Z11B',
    name: 'Wall Plate Square', price: 3.03, weight: 0.24,
    sheet: { a: 42, b: 55, hole: 6 },
    sockets: [ { dir: [0, 1, 0], reach: 42, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'square', w: 55, t: 6, holes: 4, holeDia: 6 },
    url: 'https://pipedreamfittings.com/product/wall-plate-square-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'wallPlateInlet', sku: 'KCBWPI2-27', type: '6080Z13',
    name: 'Wall Plate Inlet (set of 2)', price: 6.73, weight: 0.40,
    sockets: [ { dir: [0, 1, 0], reach: 42, kind: 'socket' } ],
    role: 'anchor', ends: 1, setOf: 2,
    url: 'https://pipedreamfittings.com/product/wall-plate-open-27mm-set-black-key-clamp-fitting-copy/'
  },
  {
    id: 'groundSupport', sku: 'KCGS-27-1', type: '608054 / A27',
    name: 'Ground Support', price: 14.81, weight: 1.6,
    sheet: { a: 120, b: 115 }, estimated: true,
    note: 'Data sheet has no 26.9mm row (starts at 33.7mm: a=127 b=123). Dimensions scaled.',
    sockets: [ { dir: [0, 1, 0], reach: 115, kind: 'socket' } ],
    role: 'anchor', ends: 1,
    url: 'https://pipedreamfittings.com/product/ground-support-27mm-black-key-clamp-fitting-a27/'
  },
  {
    id: 'handrailBracket', sku: 'KCBHB-27', type: '608034B / 143-A27',
    name: 'Handrail Bracket', price: 2.19, weight: 0.31,
    sheet: { a: 55, b: 44, c: 57.5, d: 78, hole: 8 },
    sockets: [ { dir: [0, 1, 0], reach: 55, kind: 'socket' } ],
    role: 'anchor', ends: 1, plate: { shape: 'oval', l: 78, w: 30, t: 6, holes: 2, holeSpan: 57.5, holeDia: 8 },
    url: 'https://pipedreamfittings.com/product/handrail-bracket-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'handrailBracketOpen', sku: 'KCBHBO-27', type: '6080Z35',
    name: 'Handrail Bracket Open', price: 4.95, weight: 0.33,
    sockets: [ { dir: [0, 1, 0], reach: 55, kind: 'clamp' } ],
    role: 'anchor', ends: 1,
    url: 'https://pipedreamfittings.com/product/handrail-bracket-open-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'swivelBase', sku: 'KCSB-27-1', type: '608052 / 167M',
    name: 'One Size Swivel Base', price: 8.39, weight: 0.6,
    sockets: [ { dir: [0, 1, 0], reach: 60, kind: 'socket', swivel: true } ],
    role: 'anchor', ends: 1, swivel: true,
    url: 'https://pipedreamfittings.com/product/one-size-swivel-base-tube-pipe-clamp-27mm-black-key-clamp-fitting-167m/'
  },
  {
    id: 'swivelBaseCombination', sku: 'KCBWBC-27', type: '608050',
    name: 'Swivel Base Combination', price: 12.06, weight: 0.8,
    sockets: [ { dir: [0, 1, 0], reach: 60, kind: 'socket', swivel: true } ],
    role: 'anchor', ends: 1, swivel: true,
    url: 'https://pipedreamfittings.com/product/swivel-base-combination-27mm-black-key-clamp-fitting-copy/'
  },

  /* ---------- Adjustable / swivel angle fittings ----------------------- */
  {
    id: 'singleSwivelCombination', variable: true, sku: 'KCBSSC-27', type: '6080Z44B / 167-A27',
    name: 'Single Swivel Combination', price: 3.02, weight: 0.38,
    sheet: { a: 38, b: 58.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 58.5, kind: 'socket', swivel: true }
    ],
    role: 'connector', ends: 3, swivel: true, swivelPlane: 'xy',
    url: 'https://pipedreamfittings.com/product/single-swivel-combination-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'doubleSwivelCombination', sku: 'KCDSC-27-1', type: '608046B / 167A-A27',
    name: 'Double Swivel Combination', price: 11.70, weight: 0.67,
    sheet: { a: 76, b: 58.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 38, kind: 'through' },
      { dir: [0.7071, 0.7071, 0], reach: 58.5, kind: 'socket', swivel: true },
      { dir: [-0.7071, 0.7071, 0], reach: 58.5, kind: 'socket', swivel: true }
    ],
    role: 'connector', ends: 4, swivel: true, swivelPlane: 'xy',
    url: 'https://pipedreamfittings.com/product/double-swivel-combination-27mm-black-key-clamp-fitting-167a-a27/'
  },
  {
    id: 'cornerSwivelCombination', sku: 'KCCSC-27-1', type: '608048B / 168A-A27',
    name: '90° Corner Swivel Combination', price: 13.89, weight: 0.66,
    sheet: { a: 38, b: 58.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 58.5, kind: 'socket', swivel: true },
      { dir: [0, -1, 0], reach: 58.5, kind: 'socket', swivel: true }
    ],
    role: 'connector', ends: 3, swivel: true,
    url: 'https://pipedreamfittings.com/product/90-corner-swivel-combination-27mm-black-key-clamp-fitting-168a-a27/'
  },
  {
    id: 'cornerMaleSwivel', sku: 'KCCMS-27-1', type: '6080Z40 / 168MA-A27',
    name: '90° Corner Male Swivel', price: 9.91, weight: 0.45,
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 40, kind: 'pin', swivel: true }
    ],
    role: 'connector', ends: 2, swivel: true, pairsWith: 'femaleSwivel',
    url: 'https://pipedreamfittings.com/product/90-corner-male-swivel-27mm-black-key-clamp-fitting-168ma-a27/'
  },
  {
    id: 'singleMaleSwivel', sku: 'KCBSMS-27', type: '6080Z36B',
    name: 'Single Male Swivel', price: 3.29, weight: 0.2,
    sockets: [
      { dir: [0, 1, 0], reach: 19, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 32, kind: 'pin', swivel: true }
    ],
    role: 'connector', ends: 1, swivel: true, pairsWith: 'femaleSwivel',
    note: 'Product page shows a photo only — no dimension table published.',
    url: 'https://pipedreamfittings.com/product/single-male-swivel-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'doubleMaleSwivel', sku: 'KCBDMS-27', type: '6080Z38B',
    name: 'Double Male Swivel', price: 4.51, weight: 0.21,
    sheet: { a: 32, b: 76, pin: 8.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 16, kind: 'clamp' },
      { dir: [1, 0, 0], reach: 38, kind: 'pin', swivel: true },
      { dir: [-1, 0, 0], reach: 38, kind: 'pin', swivel: true }
    ],
    role: 'connector', ends: 1, swivel: true, pairsWith: 'femaleSwivel',
    url: 'https://pipedreamfittings.com/product/double-male-swivel-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'femaleSwivel', sku: 'KCBFS-27', type: '6080Z42B',
    name: 'Female Swivel', price: 4.89, weight: 0.22,
    sheet: { a: 61, b: 38, c: 11.2, pin: 8.5 },
    sockets: [
      { dir: [0, 1, 0], reach: 38, kind: 'socket' },
      { dir: [0, -1, 0], reach: 23, kind: 'clevis', swivel: true }
    ],
    role: 'connector', ends: 1, swivel: true, pairsWith: 'singleMaleSwivel',
    url: 'https://pipedreamfittings.com/product/female-swivel-27mm-black-key-clamp-fitting-copy/'
  },
  {
    id: 'shortTeeSwivel', variable: true, sku: 'KCSTS-60-1-3', type: '608049B',
    name: 'Short Tee Swivel', price: 7.39, weight: 0.18,
    sheet: { a: 53, b: 37, c: 42 },
    sockets: [
      { dir: [0, 1, 0], reach: 18.5, kind: 'through' },
      { dir: [1, 0, 0], reach: 53, kind: 'socket', swivel: true }
    ],
    role: 'connector', ends: 3, swivel: true,
    url: 'https://pipedreamfittings.com/product/short-tee-swivel-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'adjustableShortTee', sku: 'KCAST-27-1', type: '608007 / A27',
    name: 'Adjustable Short Tee (45–60°)', price: 7.94, weight: 0.3,
    sheet: { a: 60 }, estimated: true,
    note: 'Data sheet has no 26.9mm row (starts at 33.7mm: a=70). Dimension scaled.',
    sockets: [
      { dir: [0, 1, 0], reach: 30, kind: 'through' },
      { dir: [0.7071, -0.7071, 0], reach: 60, kind: 'socket' }
    ],
    role: 'connector', ends: 3, angleRange: [45, 60],
    url: 'https://pipedreamfittings.com/product/adjustable-short-tee-27mm-black-key-clamp-fitting-a27/'
  },
  {
    id: 'eavesRoof', sku: 'KCER-27-1', type: '608085',
    name: 'Eaves Roof Fitting (110°)', price: 13.49, weight: 0.6,
    sheet: { a: 57, b: 50 }, estimated: true,
    note: 'Data sheet has only the 48.3mm row (a=94 b=83). Dimensions scaled.',
    sockets: [
      { dir: [0, 1, 0], reach: 28, kind: 'through' },
      { dir: [0.94, -0.34, 0], reach: 57, kind: 'socket' }
    ],
    role: 'connector', ends: 3, angle: 110,
    url: 'https://pipedreamfittings.com/product/eaves-roof-fitting-27mm-black-key-clamp-fitting/'
  },

  /* ---------- Variable-angle assemblies --------------------------------
     A bend at anything other than 90° is not one casting: it is a male
     swivel pinned into a female swivel. Modelled as a single joint that
     bills as two parts, so the BOM stays orderable.                     */
  {
    id: 'swivelPair', sku: 'KCBSMS-27 + KCBFS-27', type: '6080Z36B + 6080Z42B',
    name: 'Male + Female Swivel pair', price: 3.29 + 4.89, weight: 0.42,
    madeOf: ['singleMaleSwivel', 'femaleSwivel'],
    variable: true,
    sockets: [
      { dir: [0, 1, 0], reach: 38, kind: 'socket', swivel: true },
      { dir: [1, 0, 0], reach: 38, kind: 'socket', swivel: true }
    ],
    role: 'connector', ends: 2,
    note: 'Any angle. Two parts pinned together — both are listed in the BOM.',
    url: 'https://pipedreamfittings.com/product/female-swivel-27mm-black-key-clamp-fitting-copy/'
  },

  /* ---------- Terminators & collars ------------------------------------ */
  {
    id: 'plasticEndCap', sku: 'KCPEC-27', type: '608074B / 133A-A27',
    name: 'Plastic End Cap', price: 0.15, weight: 0.003,
    sockets: [ { dir: [0, 1, 0], reach: 6, kind: 'cap' } ],
    role: 'terminator', ends: 1,
    url: 'https://pipedreamfittings.com/product/plastic-end-cap-27mm-black-key-clamp-fitting-133a-a27/'
  },
  {
    id: 'metalEndCap', sku: 'KCBMEC-27', type: '608072B',
    name: 'Metal End Cap', price: 0.99, weight: 0.05,
    sockets: [ { dir: [0, 1, 0], reach: 20, kind: 'cap' } ],
    role: 'terminator', ends: 1,
    url: 'https://pipedreamfittings.com/product/metal-end-cap-27mm-black-key-clamp-fitting/'
  },
  {
    id: 'lockingCollar', sku: 'KCBLC-27', type: '608060B',
    name: 'Locking Collar', price: 1.09, weight: 0.09,
    sheet: { a: 22 },
    sockets: [ { dir: [0, 1, 0], reach: 11, kind: 'clamp' } ],
    role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/locking-collar-27mm-black-key-clamp-fitting-copy-copy/'
  },
  {
    id: 'doubleSidedCollarPlate', sku: 'KCLC-27-B', type: '6080Z57',
    name: 'Double Sided Collar Plate 90°', price: 4.34, weight: 0.3,
    sockets: [ { dir: [0, 1, 0], reach: 15, kind: 'clamp' } ],
    role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/double-sided-collar-plate-90-black-key-clamp-fitting-27mm-a27/'
  },

  /* ---------- Accessories (costed, not auto-placed) --------------------- */
  { id: 'saddleClamp', sku: 'KCBSC-27', type: '6080Z70', name: 'Saddle Clamp', price: 0.72, weight: 0.08, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/saddle-clamp-27mm-black-key-clamp-fitting/' },
  { id: 'singleFixingPad', sku: 'KCBSFP-27', type: '6080Z55', name: 'Single Fixing Pad', price: 1.94, weight: 0.15, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/single-fixing-pad-27mm-black-key-clamp-fitting/' },
  // 6080Z56B data sheet, 26,9 mm row: a=35 pad depth, b=128 across the ears,
  // c=94 overall height, two 10 mm fixing holes, 1/4" BSP grub screw.
  { id: 'doubleFixingPad', sku: 'KCBDFP-27', type: '6080Z56B', name: 'Double Fixing Pad', price: 1.99, weight: 0.30, role: 'accessory', ends: 0,
    sheet: { a: 35, b: 128, c: 94, hole: 10, bsp: '1/4"' },
    url: 'https://pipedreamfittings.com/product/double-fixing-pad-27mm-black-key-clamp-fitting/' },
  { id: 'gateEye', sku: 'KCBGE-27', type: '6080Z62', name: 'Gate Eye', price: 3.74, weight: 0.25, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/gate-eye-27mm-black-key-clamp-fitting/' },
  { id: 'gateHinge', sku: 'KCBGH-27', type: '6080Z64', name: 'Gate Hinge', price: 5.09, weight: 0.3, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/gate-hinge-27mm-black-key-clamp-fitting/' },
  { id: 'hook', sku: 'KCBH-27', type: '182-B-27', name: 'Hook', price: 1.24, weight: 0.1, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/hook-27mm-black-key-clamp-fitting-182-b-27/' },
  { id: 'coatHook', sku: 'KCBCH-27', type: '182-B-27', name: 'Coat Hook', price: 1.56, weight: 0.1, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/coat-hook-27mm-black-key-clamp-fitting/' },
  { id: 'meshPanelClip', sku: 'PCKCSSM-27', type: 'PCKCSSM', name: 'Single Sided Mesh Panel Clip', price: 5.76, weight: 0.2, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/single-sided-mesh-panel-clip-27mm-black/' },
  { id: 'swivelWheel', sku: 'KYSW-', type: 'KYSW', name: 'Swivel Wheel with 27mm Expander', price: 11.27, weight: 0.6, role: 'accessory', ends: 0,
    url: 'https://pipedreamfittings.com/product/swivel-wheel-with-27mm-expander-black-silver/' },
  { id: 'allenKey', sku: 'KC-S-PC-DFP90-41', type: '-', name: 'Key Clamp Allen Key', price: 0.68, weight: 0.02, role: 'tool', ends: 0,
    url: 'https://pipedreamfittings.com/product/key-clamp-allen-key/' },
  { id: 'touchUpPaint', sku: 'TUSP-B', type: '-', name: 'Touch Up Spray Paint RAL 9005', price: 9.95, weight: 0.4, role: 'tool', ends: 0,
    priceNote: 'Price not published in structured data — verify before ordering.', estimated: true,
    url: 'https://pipedreamfittings.com/product/touch-up-spray-paint-ral-9005-black/' }
];

/* ============================================================================
   SHEET MATERIALS for infill panels, bolted on with Double Fixing Pads.

   NOT from Pipe Dream — they do not sell sheet. These are ONYVA's own
   placeholder rates so a panel carries a cost at all; every one is marked
   estimated and is meant to be replaced with your actual supplier price.
   Edit the £/m² in Setup, or change the numbers here.
   ==========================================================================*/
const SHEETS = [
  { id: 'ply12',   name: 'Plywood 12 mm',            thickness: 12, perM2: 28.00, density: 650,  colour: 0xb08d57, estimated: true },
  { id: 'ply18',   name: 'Plywood 18 mm',            thickness: 18, perM2: 39.00, density: 650,  colour: 0xa07f4c, estimated: true },
  { id: 'acr6',    name: 'Acrylic 6 mm (clear)',     thickness: 6,  perM2: 62.00, density: 1190, colour: 0x9fd8e8, estimated: true, opacity: 0.34 },
  { id: 'acr6opal',name: 'Acrylic 6 mm (opal)',      thickness: 6,  perM2: 68.00, density: 1190, colour: 0xe8ecef, estimated: true, opacity: 0.72 },
  { id: 'dibond3', name: 'Dibond 3 mm (composite)',  thickness: 3,  perM2: 45.00, density: 1500, colour: 0xd7dade, estimated: true },
  { id: 'ali2',    name: 'Aluminium 2 mm',           thickness: 2,  perM2: 58.00, density: 2700, colour: 0xc8ccd2, estimated: true },
  { id: 'correx4', name: 'Correx 4 mm',              thickness: 4,  perM2: 9.50,  density: 650,  colour: 0xdfe3e7, estimated: true }
];

// How far apart to space fixing pads along a pole the panel bolts to.
const PAD_SPACING = 600;   // mm

const CATALOGUE = { TUBE, G, FITTINGS, SHEETS, PAD_SPACING, scrapedOn: '2026-08-25', vatRate: 0.20 };
if (typeof window !== 'undefined') window.CATALOGUE = CATALOGUE;
