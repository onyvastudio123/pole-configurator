# ONYVA Studio · Pole System Configurator

A browser tool for designing art installation structures out of 27mm key clamp
fittings and pipe, with a live cost, cut list and bill of materials.

**Just open `ONYVA Pole System Configurator.html`.** Everything is inlined — no
server, no install, no internet. It works offline and can be emailed to anyone.

---

## What it does

You draw the structure as a wireframe on a snapping 3D grid. The tool then works
out, for every joint, **which fitting you actually need** based on how many pipes
meet there and at what angles — an elbow for two at 90°, a three way elbow for a
box corner, a short tee where a rail passes a post, a base plate where a single
post lands on the floor, and so on. It builds the real fitting in 3D at that
joint, orientated correctly.

From that it derives:

- **Cut list** — pipes that run straight *through* a fitting (a tee, a cross) are
  merged into one continuous pipe, because that is how they are actually built.
  Each run's cut length is the centre-to-centre distance minus the socket
  engagement at each end.
- **Buying plan** — a bin-packing pass over the six stock lengths Pipe Dream
  sells, testing each length on its own plus a mixed strategy, and picking the
  cheapest. Saw kerf is allowed for. Runs longer than 3 m are automatically split
  and sleeve joints added to the BOM.
- **Cost** — every fitting and pipe priced from the live scraped catalogue,
  subtotal ex VAT, VAT at 20%, and an estimated total weight.

Exports a CSV bill of materials + cut list, and a JSON you can reopen later.

## Controls

Camera controls follow Blender: **the middle mouse button drives the view**, so
the left button is free for selecting and never fights the camera.

| | |
|---|---|
| Middle-drag | orbit |
| `Shift`+middle-drag, or right-drag | pan |
| Scroll | zoom |
| Left-click a pole | open the resizer |
| Left-click a joint | see and change its fitting |
| Left-drag a box | select every pole inside it |
| `Shift`- or `Ctrl`-click | add or remove one pole from the selection |
| **+ Add pole** button, or `A` | start placing poles; click for each point |
| `Esc` or right-click | finish the run and go back to normal |
| Hold `Shift`, or press `V` | run the next pole **vertically** |
| Drag a joint | move that end directly (see below) |
| `G` / `R` | move / rotate the selection (see below) |
| `Shift`+`D` | duplicate the selection and place it with the mouse |
| `F` | fit the view to the structure |
| `Ctrl+Z` / `Ctrl+Shift+Z` | undo / redo |
| `Ctrl+S` / `Ctrl+O` | save / open a design |

With several poles selected the resizer sets them all to the same length at
once, and the inspector totals their cut lengths.

#### Where a run can start

A structure has to stand on something, so the **first** point of a run can only
land in one of three places, and the readout tells you which:

- **On the ground** — a blue ring lies flat where the foot will go
- **From this joint** — hovering an existing joint builds off it
- **Tee off this pole** — hovering partway along a pole starts there and splits
  it into a tee

You cannot start a run from a point floating in mid-air, and the working height
resets to the ground for every new run — so putting a foot down next to a
structure you have already built no longer picks up that structure's height.

Once a run is under way its later points are free, since the pole behind them is
holding them up. A cantilevered end is perfectly normal.

While placing, the readout shows the length, the turn angle and **which fitting
that angle will need** — so you can see a joint get expensive before you commit
to it.

To extend an existing structure, click a joint and use **+ Add a pole from this
joint**, or select it and press `A`.

### Dragging an end

Hover any joint and a blue ball appears — press and drag it and that end follows
the mouse, with the pole's length shown at the top of the screen as it changes.
No keyboard needed. The grab area is much larger than the fitting itself, so the
loose end of an angled pole is easy to catch.

Dragging an end snaps and joins exactly like `G` does, so pulling one pole's end
onto another connects them.

### Angles

Every joint is a fitting bought for a particular angle, so the angles are drawn
on the model: a small arc between the two poles and the figure in degrees.
Anything that is not a right angle shows in amber, since that is the one you
need to think about. Right angles and straight-throughs are hidden by default —
turn them on with **Setup → … including right angles**, or switch the whole
thing off with **Show joint angles**.

The angles also appear live in the move/rotate readout, so you can watch a joint
pass through 45° as you swing a pole.

### Duplicating — `Shift`+`D`

Copies the selected poles and hands them straight to the move tool, so they
follow the mouse until you click to place them. Everything the move tool does
applies: `X`/`Y`/`Z` to lock an axis, type an exact offset, and snapping to join
the copy onto something. `Esc` throws the copy away rather than leaving it
stacked invisibly on the original.

A fresh copy sits exactly on top of its original, so snapping stays off until
you have dragged it clear — otherwise it would weld straight back into the thing
it was copied from.

### Continuing a pole — ↗ Continue

Starting a new run from the tip of an angled pole is fiddly, so select the pole
and hit **↗ Continue** in the resizer to add another of the same length carrying
on in the same direction, already joined. It grows from the loose end, and the
new pole is selected, so `G` moves it or `R` swings it to a new angle.

Two poles carrying straight on need a coupler, so the joint between them comes
out as a Sleeve Joint — swap it for an Expanding Connector if you want the join
hidden.

### Moving and rotating — `G` and `R`

Modal transforms, the way Blender does them. Select something, press the key,
move the mouse — no button held — and click to confirm.

| | |
|---|---|
| `G` | grab and move the selection |
| `R` | rotate it |
| `X` `Y` `Z` | lock to an axis (`Z` is up, as in Blender) |
| type a number | exact value — `G` `X` `500` moves 500 mm along X |
| `Shift` | fine mode: 1 mm steps, 1° instead of 15° |
| click or `Enter` | confirm |
| `Esc` or right-click | cancel, putting everything back |

Pressing the same axis twice while moving releases the constraint. Free movement
slides across the ground plane; use `Z` to go vertical.

Selecting a **pole** transforms both its joints, so the pole moves as a unit.
Selecting a **joint** moves just that joint. Select several poles — `Shift`-click,
or drag a box — and they transform together about their shared centre.

#### Joining things together

Poles do not connect just by crossing — they have to share a joint. While you
are moving, the tool watches for something to join onto and pulls the selection
onto it, showing a green ring at the spot and turning the readout green. Release
and it welds:

- **onto a joint** — the two become one joint, and the right fitting is chosen
- **onto a pole** — that pole is split in two and you get a tee

An existing joint always wins over splitting a pole, so landing near a corner
joins the corner rather than cutting the pole beside it. A tee is never placed
within 120 mm of a pole's end, since that would leave an unbuildable stub — it
joins to the end instead.

To attach one end of a pole, **click the joint at that end** and press `G`: only
that end moves, so the pole pivots onto the target. Click the pole itself and the
whole thing translates instead.

##### Fixing a whole design at once

If you already have a structure built with poles left near each other but never
actually connected, **Setup → Tidy up → Weld loose joints** fixes the lot in one
pass. Set how close counts as touching (20 mm by default) and it will:

- merge ends that nearly touch into a single joint
- pull an end that rests on another pole exactly onto it and split that pole
  into a tee
- drop any joint left with no poles attached

It repeats until nothing more changes, since one weld often brings the next pair
into range, and it tells you what it did. It is a single undo step, so `Ctrl+Z`
puts everything back if the tolerance was too generous. Running it on a design
that is already properly connected does nothing at all.

Snapping is off when you type an exact value — a typed measurement is deliberate
— and holding `Shift` suppresses it if you want to place something close to
another pole without joining to it.

**Rotation is rigid.** Cut lengths, angles and fittings come out exactly as they
went in, whether you turn something 90° or 7°. Only the angle snaps (to 15°, or
1° with `Shift`); the resulting coordinates stay exact, because rounding rotated
positions onto the grid would quietly stretch the poles and knock the corners out
of square. Moves do snap to the grid, since that is what keeps a layout tidy.

### Resizing a pole

Click any pole and a resizer appears next to it: a slider, a typed length in mm,
and one-tap buttons for the length that uses a whole 50/100/150/200/250/300 cm
stock pipe with no offcut. The fittings, the cut list and the cost all follow as
you drag.

- **Stretch structure** (default) — everything beyond that pole moves with it, so
  a frame keeps its shape. Lengthening one edge of a cube resizes the cube.
- **Off** — only the pole's far joint moves, which deforms the frame. Useful for
  skewing something deliberately.
- **⇄ Flip end** — grow from the other end instead.
- **Lock to fitting angles** (default on) — see below.
- **Standard pipe lengths only** — see below.

The slider stops at 3 m because that is the longest pipe sold; past that a pole
needs a second pipe and a coupler.

### Standard pipe lengths only

Pipe is sold in six lengths — 50, 100, 150, 200, 250 and 300 cm. Tick this and
the slider moves in those steps only, so every pole is a whole pipe used uncut:
no sawing, no offcuts, and the cost is exactly the price on the site. The quick
buttons under the slider do the same thing for one pole at a time.

It governs edits you make, not the whole model — poles you never touch keep the
length they already had.

### Lock to fitting angles

Moving one joint swings the pipes around it. A few hundred millimetres is enough
to turn a square corner into an angle no casting makes, and the structure then
looks fine on screen while being unbuildable. With the lock on, the slider only
stops at lengths where **every** joint still has a fitting whose sockets truly
line up with the pipes — it searches ±700 mm and takes the nearest one, telling
you in the note when it had to move.

It also works in reverse: nudge the slider on a structure that has already been
pulled off-square and it snaps back to true.

Hold `Shift` while dragging to invert the setting for that drag. With **Standard
pipe lengths only** also ticked, the lock picks the best of the six stock
lengths rather than searching continuously.

If the lock has to jump a long way, that usually means the far joint simply
cannot go where you are dragging it — turn on **Stretch structure** and it will
move freely, because the rest of the frame moves with it. The note says so when
this happens.

## Saving your work

Three layers, because a web page cannot silently write to your disk:

**1. Autosave — nothing to do.** Every change is written to this browser's local
storage a moment later. Close the tab, reboot, come back next week: it opens on
what you were last doing, with a bar at the top confirming it and a **Start
fresh** button if you wanted a blank canvas.

That autosave lives *inside the browser*, tied to this machine and this copy of
the file. It is a safety net, not a backup — clearing browsing data wipes it, and
it does not travel to another computer or to a colleague. It also only holds the
one most recent session.

**2. Save — a real file.** The **Save** button (or `Ctrl+S`) writes a `.json`
file named after the design. On Chrome and Edge you pick the folder the first
time and every later save writes straight back to that same file, so you can
keep designs beside the job:

```
ONYVA Studio - ON Y VA!\_PROJECTS\<job>\rig\Brighton-Arch-v3.onyva.json
```

On other browsers it lands in your **Downloads** folder instead. Click the name
chip to the left of the button to rename the design — that name becomes the
filename.

**3. Open.** The **Open** button (`Ctrl+O`) loads one of those files back. These
are the files to put in a shared drive, attach to an email, or commit alongside a
job — they are small, plain text, and hold the whole design plus your settings.

The **Setup** tab also has *Save a copy as…* if you want a second copy without
disturbing the file you are working in.

### Joining two poles end to end

Click the joint where two poles meet in a straight line and the override
dropdown offers both inline couplers:

| | | |
|---|---|---|
| **Sleeve Joint** `KCBSJ-27` | £3.18 | 76 mm collar that slides *over* both pipe ends. Visible, grub-screwed. |
| **Expanding Connector** `KCBEC-27` | £1.71 | Goes *inside* both pipes and expands. Only a 22 mm band shows. |

Dimensions are from the 6080Z09B data sheet, 26,9 mm row: 76 mm long overall,
22 mm collar, ¼" BSP grub screw, 0.15 kg. Because the connector sits inside the
tube, each pipe stops 11 mm from the joint centre no matter what the insertion
allowance is set to — the cut list accounts for this, so the two options give
slightly different cut lengths for the same structure.

### Snap angles

The dropdown in the toolbar controls what angles new poles can take, and each
option corresponds to what you can actually buy:

- **Right angles only** — every joint lands on a stock 90° casting. Cheapest.
- **45° steps — stock fittings** — adds diagonals; joints resolve to elbows, tees
  and 45° tees.
- **Any angle — swivel fittings** — free placement. Non-90° bends resolve to a
  male + female swivel pair, which is billed as the **two separate parts** you
  have to order, because no single casting makes an adjustable bend.

---

## Where the data comes from

Everything was scraped from pipedreamfittings.com on **2026-08-25**.

- `data/catalogue.js` — all 52 products in the 27mm electrophoretic black range,
  with prices **ex VAT**, SKUs, Interclamp type codes and product URLs.
- `reference/datasheets/` — the 54 dimension drawings the models are built from.
- `reference/photos/` — product photos used to confirm socket topology
  (how many sockets, at what angles, and which member passes through).
- `reference/scraped-prices.csv` — the raw price scrape.
- `data/dims-raw.md` — every dimension read off a drawing, with the type code.

The drawings are generic per fitting type with a size table; the **26,9 mm (¾")**
row is the one used throughout.

### Key dimensions for 26.9mm

| | |
|---|---|
| Tube OD | 26.9 mm |
| Socket boss OD | 38 mm |
| Standard socket reach from joint centre | 40–41 mm |
| Through-barrel length | 41 mm (82 mm on a long tee) |

## Assumptions — please check these against real parts

These are flagged in the app and are all editable in the **Setup** tab.

1. **Tube wall thickness: 3.2 mm.** Not published anywhere on the pipe page.
   3.2 mm is the usual spec for 26.9 mm key clamp tube. Affects the **weight
   estimate only** — no effect on cost or geometry.
2. **Socket engagement: 30 mm.** How far a pipe sits into a socket, which sets
   how much shorter than centre-to-centre each cut is. Measure one real fitting
   and correct it before cutting anything.
3. **Three fittings have no 26.9 mm row on their data sheet** — Adjustable Short
   Tee, Ground Support and Eaves Roof Fitting. Their dimensions are scaled down
   from the smallest published size. They are marked *est. dims* in the BOM and
   the app warns on the joint. **Prices for them are real**, only the geometry is
   estimated.
4. **Base plate vs wall plate.** The site attaches the oval two-hole drawing to
   the Base Plate and the round four-hole drawing to the Wall Plate. That is the
   opposite of what the type codes suggest, so the app follows the site. If you
   order and they arrive the other way round, swap them in `data/catalogue.js`.
5. **Touch Up Spray Paint** has no price in the site's structured data; £9.95 is
   a placeholder and is marked estimated.
6. Prices are **ex VAT** as listed, and exclude delivery.

---

## Working on the source

The single file is built from the sources in `src/`:

```bash
bash build.sh
```

- `data/catalogue.js` — products, prices, socket geometry
- `src/models.js` — procedural Three.js geometry for every fitting
- `src/engine.js` — fitting selection, run merging, cut list, packing, costing
- `src/app.js` — scene, drawing tools, UI
- `index.html` — the development shell (needs a local web server)
- `vendor/` — Three.js r147 + OrbitControls
- `brand/` — the ONYVA logo, original and the cleaned copy inlined in the header

To edit a price or a dimension, change `data/catalogue.js` and re-run
`build.sh`. Nothing else needs touching — the 3D model, the cut list and the
cost all derive from that one file, so they cannot drift apart.

### Why not Blender?

The fittings are generated procedurally from the datasheet numbers rather than
modelled by hand. That means a dimension correction is a one-line edit and the
model, the cut list and the price all update together — where hand-modelled
meshes would have to be re-exported and could silently disagree with the
costing. If you later want photoreal renders for a client, the same catalogue
can drive a Blender export; the geometry rules live in `src/models.js`.

### Scripting

The app exposes `window.KCApp` — `state`, `solved`, `addNode(x,y,z)`,
`addEdge(a,b)`, `rebuild()`, `preset(name)`, `exportCsv()`, plus
`selectRun(edgeId)`, `selectNode(nodeId)`, `currentRun` and `setLength(mm)`.
Useful for generating parametric structures from the console:

```js
// a 3 m × 2 m × 2.4 m frame
KCApp.state.nodes = []; KCApp.state.edges = [];
const b = [[0,0,0],[3000,0,0],[3000,0,2000],[0,0,2000]].map(p => KCApp.addNode(...p));
const t = [[0,2400,0],[3000,2400,0],[3000,2400,2000],[0,2400,2000]].map(p => KCApp.addNode(...p));
for (let i = 0; i < 4; i++) {
  KCApp.addEdge(b[i], b[(i+1)%4]);
  KCApp.addEdge(t[i], t[(i+1)%4]);
  KCApp.addEdge(b[i], t[i]);
}
KCApp.rebuild(); KCApp.frameAll();
```
