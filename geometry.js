// A geometry-dash run cut from the same cloth as dino.js and flappy.js: same
// canvas footprint, same monochrome ink, same slide-open panel. The level is a
// character grid, so adding a second one later is a matter of appending another
// entry to LEVELS.
(function () {
  var panel = document.getElementById('geometry-game');
  var stage = document.getElementById('geometry-stage');
  var canvas = document.getElementById('geometry-canvas');
  if (!panel || !canvas) return;

  var ctx = canvas.getContext('2d');
  var toggleBtn = document.getElementById('geometry-toggle');

  /**************/
  /* LEVELS     */
  /**************/
  // One character per cell, bottom row sitting on the ground:
  //   '^' spike   '#' block   '_' jump pad   '.' empty
  //   '>' switch to the ship   '<' switch back to the cube
  // Chunks are 40 columns wide and get joined end to end, so a screenful is
  // roughly one chunk and the layout stays readable in the source.
  //
  // Stereo Madness: five cube stretches trading off with four ship corridors,
  // 1240 columns at 13 cells a second, which is the ~1:35 the real one runs.
  // Every jump in it was checked by simulation before it landed here — if you
  // edit the grid by hand, edit it knowing that.
  var STEREO_MADNESS = [
    // 0-39
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '..............................^.........'],
    // 40-79
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '....^.......^.......^.........^^........'],
    // 80-119
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '......####.........^......####..........'],
    // 120-159
    ['........................................',
     '........................................',
     '........................................',
     '..........^.............................',
     '....#############.....^^........^^^...>.'],
    // 160-199
    ['....................###.............###.',
     '....................................###.',
     '........................................',
     '........................................',
     '....................###.................'],
    // 200-239
    ['............................###.........',
     '........................................',
     '........................................',
     '............###.........................',
     '............###.............###.........'],
    // 240-279
    ['....###.................................',
     '....###.................................',
     '........................................',
     '....................###.................',
     '....................###...........<.....'],
    // 280-319
    ['........................................',
     '........................................',
     '........................................',
     '.....................................^..',
     '................^.......^^........######'],
    // 320-359
    ['........................................',
     '........................................',
     '..............##........................',
     '..............##........................',
     '#........._...##............^^^.........'],
    // 360-399
    ['........................................',
     '........................................',
     '........................................',
     '......^.................................',
     '###############.........^^........^.....'],
    // 400-439
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '..^.........####........^.....^^^.....>.'],
    // 440-479
    ['....................###.................',
     '....................###.................',
     '........................................',
     '..................................###...',
     '..................................###...'],
    // 480-519
    ['........###...........###...............',
     '......................###...............',
     '........................................',
     '....................................###.',
     '........###.....^^..................###.'],
    // 520-559
    ['..........###...........###.............',
     '........................###.............',
     '........................................',
     '........................................',
     '..........###.......................<...'],
    // 560-599
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '....................^.......^.......^^..'],
    // 600-639
    ['........................................',
     '........................................',
     '..........................##............',
     '.........^................##............',
     '......########........_...##..........^^'],
    // 640-679
    ['........................................',
     '........................................',
     '........................................',
     '........................^...............',
     '^.........^^........############........'],
    // 680-719
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '..^.......^^^.........#####.....^^..>...'],
    // 720-759
    ['..................................###...',
     '..................................###...',
     '........................................',
     '....................###.................',
     '....................###.................'],
    // 760-799
    ['........###.........................###.',
     '....................................###.',
     '........................................',
     '......................###...............',
     '........###...........###...............'],
    // 800-839
    ['..........###...........................',
     '........................................',
     '........................................',
     '........................###.............',
     '..........###...........###.........<...'],
    // 840-879
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '................^.......^^........^^^...'],
    // 880-919
    ['........................................',
     '........................................',
     '............................##..........',
     '..........^.................##..........',
     '......##########........_...##..........'],
    // 920-959
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '^^^.......^^........^.......^.........##'],
    // 960-999
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '####........^^^.........^^............>.'],
    // 1000-1039
    ['....................###.................',
     '........................................',
     '........................................',
     '..................................###...',
     '....................###...........###...'],
    // 1040-1079
    ['........###...........###...............',
     '........###.............................',
     '........................................',
     '....................................###.',
     '................^^....###...........###.'],
    // 1080-1119
    ['..........###...........................',
     '..........###...........................',
     '........................................',
     '........................................',
     '..................................<.....'],
    // 1120-1159
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '................^.......^^........^^^...'],
    // 1160-1199
    ['........................................',
     '........................................',
     '..............................##........',
     '..........^...................##........',
     '......########............_...##........'],
    // 1200-1239
    ['........................................',
     '........................................',
     '........................................',
     '........................................',
     '..^^^.......^^........^.......^.........']
  ];

  var LEVELS = [{ name: 'STEREO MADNESS', key: 'stereoMadness', chunks: STEREO_MADNESS }];
  var level = LEVELS[0];

  // rows[0] is the ground row, rows[1] the one above it, and so on
  var rows = [];
  var portals = {};
  (function buildRows() {
    var height = level.chunks[0].length;
    for (var r = 0; r < height; r++) {
      var line = '';
      for (var c = 0; c < level.chunks.length; c++) line += level.chunks[c][height - 1 - r];
      rows.push(line);
    }
    // A portal is a gate across the whole column, so it's lifted out of the
    // grid rather than tested cell by cell
    for (var col = 0; col < rows[0].length; col++) {
      for (var row = 0; row < rows.length; row++) {
        var ch = rows[row].charAt(col);
        if (ch === '>') portals[col] = 'ship';
        else if (ch === '<') portals[col] = 'cube';
      }
    }
  })();

  var LEVEL_COLS = rows[0].length;
  var LEVEL_ROWS = rows.length;

  function cellAt(col, row) {
    if (row < 0 || row >= LEVEL_ROWS || col < 0 || col >= LEVEL_COLS) return '.';
    return rows[row].charAt(col);
  }

  /**************/
  /* PHYSICS    */
  /**************/
  // Everything below is in cells per second, so the numbers stay readable and
  // the canvas size only decides how big a cell is drawn
  // These five move as a set. The hop is the fixed shape everything else is
  // solved against — 2.2 cells high and 5 cells long, which is what clears a
  // triple spike — so making the level come at you faster means shortening the
  // jump by the same factor rather than just winding the scroll up, or the
  // hop would start overshooting the gaps the grid was laid out for.
  // At 13 cells/s a jump lasts 0.385s.
  var SPEED = 13;         // cells travelled per second
  var GRAVITY = 119;      // cells per second squared
  var JUMP_V = 22.9;      // ~2.2 cells high, ~5 cells long
  var PAD_V = 32;         // ~4.3 cells high, ~7 cells long
  var ROT_SPEED = 234;    // a quarter turn per jump — a tumble, not a spin

  // The ship holds height by feel rather than by hop: thrust is a shade over
  // twice its gravity, so a tap climbs and letting go sinks at the same rate
  var SHIP_GRAVITY = 57.5;
  var SHIP_THRUST = 115;
  var SHIP_MAX_V = 12.4;

  // How many cells of air fit between the deck and the top of the canvas, which
  // is also what sets the zoom. Lower is tighter framing and reads faster;
  // 5.75 is the floor, since the pad launch peaks at 5.3
  var CEILING = 5.75;

  var W = 600, H = 150, scale = 1, CELL = 24, groundY = 138, PX = 2;
  var CUBE_X = 5.2;       // where the cube rides, in cells from the left edge
  var fg = '#e4e4e4';
  var open = false, rafId = null, lastTime = 0;

  // A press that lands while the cube is still in the air is remembered this
  // long and spent the moment it touches down. Without it, only a key held all
  // the way through survives to the landing frame and every early tap is
  // silently dropped — which reads as the game lagging behind your thumb
  var JUMP_BUFFER = 0.13;

  var state, mode, worldX, cubeY, vy, grounded, angle, holding, jumpBuffer;
  var attempts, best, deathTimer, winTimer, sparks, trail, padsUsed;
  var clouds, pebbles;

  best = parseInt(localStorage.getItem('geoBest_' + level.key), 10) || 0;
  attempts = 0;

  function reset(hard) {
    state = 'waiting';
    mode = 'cube';
    worldX = 0;
    cubeY = 0;
    vy = 0;
    grounded = true;
    angle = 0;
    holding = false;
    jumpBuffer = 0;
    deathTimer = 0;
    winTimer = 0;
    sparks = [];
    trail = [];
    padsUsed = {};
    // The scenery outlives a death, so retrying doesn't reshuffle the sky
    if (hard || !clouds) {
      clouds = [];
      pebbles = [];
      for (var i = 0; i < 2; i++) spawnCloud(W * (0.4 + i * 0.5));
      for (var j = 0; j < 26; j++) spawnPebble(Math.random() * W);
    }
    if (hard) attempts = 0;
  }

  function spawnCloud(x) {
    clouds.push({ x: x, y: (8 + Math.random() * 30) * scale, speed: 12 + Math.random() * 14 });
  }

  function spawnPebble(x) {
    pebbles.push({ x: x, w: 1 + Math.floor(Math.random() * 4), o: 2 + Math.floor(Math.random() * 3) });
  }

  function stepScenery(dt) {
    var i;
    for (i = clouds.length - 1; i >= 0; i--) {
      clouds[i].x -= clouds[i].speed * scale * dt;
      if (clouds[i].x < -20 * PX) { clouds.splice(i, 1); spawnCloud(W + Math.random() * W * 0.5); }
    }
    if (clouds.length < 3 && Math.random() < 0.24 * dt) spawnCloud(W + Math.random() * 60);

    // The grit on the deck runs at the level's own speed, so it reads as ground
    for (i = pebbles.length - 1; i >= 0; i--) {
      pebbles[i].x -= SPEED * CELL * dt;
      if (pebbles[i].x < -8) { pebbles.splice(i, 1); spawnPebble(W + Math.random() * 40); }
    }
  }

  function progress() {
    return Math.max(0, Math.min(1, worldX / LEVEL_COLS));
  }

  /**************/
  /* SIZING     */
  /**************/
  function resize() {
    var cssW = Math.max(260, Math.round(panel.clientWidth));
    var cssH = cssW < 420 ? 120 : 150;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    W = cssW;
    H = cssH;
    scale = H / 150;
    groundY = Math.round(H - 12 * scale);
    // Sized off the height, so the pad launch always fits under the ceiling and
    // the ship corridors have somewhere to be
    CELL = Math.max(8, Math.round(groundY / CEILING));
    PX = Math.max(1, Math.round(2 * scale));
    readColor();
    if (open) syncPanelHeight();
  }

  // The sprites inherit the page's text colour so the game follows the theme
  function readColor() {
    fg = getComputedStyle(canvas).color || '#e4e4e4';
  }

  function syncPanelHeight() {
    panel.style.height = stage.offsetHeight + 'px';
  }

  /**************/
  /* GEOMETRY   */
  /**************/
  // Cell space to canvas space. x is a column, y counts cells up from the deck
  function sx(col) { return (col - (worldX - CUBE_X)) * CELL; }
  function sy(cells) { return groundY - cells * CELL; }

  function rect(x, y, w, h) {
    ctx.fillStyle = fg;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /**************/
  /* DRAWING    */
  /**************/
  // Same three-slab cloud the other two games use
  function drawCloud(c) {
    var u = PX;
    ctx.globalAlpha = 0.45;
    rect(c.x + 2 * u, c.y + 2 * u, 12 * u, 2 * u);
    rect(c.x, c.y + 4 * u, 18 * u, 2 * u);
    rect(c.x + 3 * u, c.y, 8 * u, 2 * u);
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    rect(0, groundY, W, Math.max(1, Math.round(2 * scale)));
    // Grit scattered under the deck, the same as the dino's and the bird's
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < pebbles.length; i++) {
      var p = pebbles[i];
      rect(p.x, groundY + p.o * PX, p.w * PX, Math.max(1, PX / 2));
    }
    ctx.globalAlpha = 1;
  }

  // Every edge is snapped to whole pixels off the same two helpers, so cells
  // that touch share an edge exactly instead of each rounding its own way —
  // that mismatch is what made neighbouring blocks shimmer as they scrolled
  function px(col) { return Math.round(sx(col)); }
  function py(cells) { return Math.round(sy(cells)); }

  // A row of touching blocks is drawn as one platform rather than n squares,
  // so there are no interior seams to flicker at all
  function drawBlockRun(col, row, n) {
    var x = px(col), w = px(col + n) - x;
    var y = py(row + 1), h = py(row) - y;
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, w, h);
  }

  function drawSpike(col, row) {
    var x = px(col), right = px(col + 1), base = py(row);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo((x + right) / 2, base - CELL);
    ctx.lineTo(right, base);
    ctx.lineTo(x, base);
    ctx.closePath();
    ctx.fill();
  }

  function drawPad(col, row) {
    var x = px(col), base = py(row), s = CELL;
    var h = Math.max(3, Math.round(s * 0.18));
    rect(x + s * 0.1, base - h, s * 0.8, h);
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < 3; i++) {
      rect(x + s * (0.22 + i * 0.28), base - h - s * 0.22, Math.max(1, s * 0.08), s * 0.16);
    }
    ctx.globalAlpha = 1;
  }

  // A gate the full height of the column, so it can't be flown past
  function drawPortal(col, kind) {
    var cx = px(col) + (px(col + 1) - px(col)) / 2;
    var top = py(CEILING), bottom = py(0);
    var line = Math.max(1, Math.round(CELL * 0.06));

    ctx.globalAlpha = 0.3;
    rect(cx - line / 2, top, line, bottom - top);
    ctx.globalAlpha = 1;

    // The mouth: a tall lens with the mode it drops you into drawn inside
    var ry = CELL * 1.5, rx = CELL * 0.42, mid = py(0) - ry;
    ctx.strokeStyle = fg;
    ctx.lineWidth = Math.max(2, Math.round(CELL * 0.1));
    ctx.beginPath();
    ctx.ellipse(cx, mid, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = fg;
    var m = CELL * 0.22;
    if (kind === 'ship') {
      ctx.beginPath();
      ctx.moveTo(cx - m, mid - m);
      ctx.lineTo(cx + m, mid);
      ctx.lineTo(cx - m, mid + m);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(cx - m), Math.round(mid - m), Math.round(m * 2), Math.round(m * 2));
    }
  }

  function drawLevel() {
    var from = Math.max(0, Math.floor(worldX - CUBE_X) - 1);
    var to = Math.min(LEVEL_COLS - 1, from + Math.ceil(W / CELL) + 2);

    for (var row = 0; row < LEVEL_ROWS; row++) {
      var runStart = -1;
      for (var col = from; col <= to + 1; col++) {
        var ch = col <= to ? cellAt(col, row) : '.';
        if (ch === '#') {
          if (runStart < 0) runStart = col;
          continue;
        }
        if (runStart >= 0) {
          drawBlockRun(runStart, row, col - runStart);
          runStart = -1;
        }
        if (ch === '^') drawSpike(col, row);
        else if (ch === '_') drawPad(col, row);
      }
    }

    for (var c = from; c <= to; c++) {
      if (portals[c]) drawPortal(c, portals[c]);
    }
  }

  function drawPlayer() {
    if (state === 'dead') return;
    var s = CELL * 0.92;
    // Rounded, so an axis-aligned cube lands on whole pixels instead of
    // shimmering along a sub-pixel edge
    var cx = Math.round(sx(worldX) + CELL / 2);
    var cy = Math.round(sy(cubeY) - CELL / 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillStyle = fg;

    if (mode === 'ship') {
      // A rounded pod rather than a wedge: flat deck, flat belly, the nose
      // tapering off the front and a stubby tail off the back
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.09);
      ctx.lineTo(s * 0.3, -s * 0.14);
      ctx.quadraticCurveTo(s * 0.58, -s * 0.12, s * 0.68, s * 0.12);
      ctx.quadraticCurveTo(s * 0.62, s * 0.34, s * 0.36, s * 0.4);
      ctx.lineTo(-s * 0.36, s * 0.4);
      ctx.quadraticCurveTo(-s * 0.52, s * 0.4, -s * 0.52, s * 0.22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.09);
      ctx.lineTo(-s * 0.64, -s * 0.2);
      ctx.lineTo(-s * 0.6, s * 0.06);
      ctx.lineTo(-s * 0.5, s * 0.06);
      ctx.closePath();
      ctx.fill();

      // The canopy, with the cube riding inside it
      ctx.beginPath();
      ctx.moveTo(-s * 0.26, -s * 0.1);
      ctx.quadraticCurveTo(0, -s * 0.62, s * 0.26, -s * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.clearRect(-s * 0.105, -s * 0.295, s * 0.21, s * 0.16);
    } else {
      var border = Math.max(2, Math.round(s * 0.14));
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.clearRect(-s / 2 + border, -s / 2 + border, s - border * 2, s - border * 2);
      // A face, so the spin is readable
      var eye = Math.max(2, Math.round(s * 0.16));
      ctx.fillRect(-s * 0.26, -s * 0.14, eye, eye);
      ctx.fillRect(s * 0.26 - eye, -s * 0.14, eye, eye);
      ctx.fillRect(-s * 0.2, s * 0.14, s * 0.4, Math.max(1, eye * 0.5));
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.globalAlpha = 0.55;
    var i;
    for (i = 0; i < trail.length; i++) {
      ctx.globalAlpha = 0.5 * trail[i].life;
      rect(trail[i].x, trail[i].y, trail[i].s, trail[i].s);
    }
    for (i = 0; i < sparks.length; i++) {
      ctx.globalAlpha = Math.max(0, sparks[i].life);
      rect(sparks[i].x, sparks[i].y, sparks[i].s, sparks[i].s);
    }
    ctx.globalAlpha = 1;
  }

  function drawProgress() {
    var barW = Math.round(W * 0.42);
    var barH = Math.max(5, Math.round(7 * scale));
    var x = Math.round((W - barW) / 2);
    var y = Math.round(6 * scale);

    ctx.globalAlpha = 0.35;
    rect(x, y, barW, 1);
    rect(x, y + barH - 1, barW, 1);
    rect(x, y, 1, barH);
    rect(x + barW - 1, y, 1, barH);
    ctx.globalAlpha = 1;
    rect(x + 2, y + 2, Math.max(0, (barW - 4) * progress()), barH - 4);

    ctx.fillStyle = fg;
    ctx.font = 'bold ' + Math.round(9 * scale) + "px 'Courier New', Courier, monospace";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(progress() * 100) + '%', x + barW + 8 * scale, y + barH / 2);

    if (best > 0) {
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'right';
      ctx.fillText('BEST ' + best + '%', x - 8 * scale, y + barH / 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawCenterText(main, sub) {
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(13 * scale) + "px 'Courier New', Courier, monospace";
    ctx.fillText(main, W / 2, H * 0.4);
    if (sub) {
      ctx.globalAlpha = 0.55;
      ctx.font = Math.round(10 * scale) + "px 'Courier New', Courier, monospace";
      ctx.fillText(sub, W / 2, H * 0.4 + 18 * scale);
      ctx.globalAlpha = 1;
    }
  }

  function drawAttempt() {
    // Rides along with the level for the first stretch, the way the real one does
    var x = sx(6);
    if (x > W) return;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(11 * scale) + "px 'Courier New', Courier, monospace";
    ctx.fillText('ATTEMPT ' + attempts, x, sy(3.2));
    ctx.globalAlpha = 1;
  }

  /**************/
  /* COLLISION  */
  /**************/
  // Blocks get the cube's true height. Insetting the bottom would mean a cube
  // sitting on a lid doesn't overlap it, so the landing snap only fires once
  // the cube has sunk in far enough to be seen doing it — that sink-and-pop is
  // a visible jitter. Only the sides come in, so brushing a corner is forgiven
  function solidBox() {
    return { x: worldX + 0.06, y: cubeY, w: 0.88, h: 1 };
  }

  // Spikes are scored generously in every direction, so near-misses stay misses
  function softBox() {
    return { x: worldX + 0.1, y: cubeY + 0.08, w: 0.8, h: 0.84 };
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // The spike's own box is a fraction of its cell — clipping the flare at the
  // bottom corners is forgiven, the way it is in the real game
  function spikeBox(col, row) {
    return { x: col + 0.32, y: row + 0.04, w: 0.36, h: 0.62 };
  }

  function resolve(prevY) {
    grounded = false;

    if (cubeY <= 0) {
      cubeY = 0;
      if (vy < 0) vy = 0;
      grounded = true;
    }

    var c0 = Math.floor(worldX + 0.02);
    var c1 = Math.floor(worldX + 0.98);
    var r0 = Math.floor(cubeY - 0.05);
    var r1 = Math.floor(cubeY + 0.98);
    var solid = solidBox();
    var soft = softBox();

    for (var c = c0; c <= c1; c++) {
      // Portals take the whole column, so there's no height at which you can
      // slip past one
      if (portals[c]) setMode(portals[c]);

      for (var r = r0; r <= r1; r++) {
        var ch = cellAt(c, r);
        if (ch === '.' || ch === '>' || ch === '<') continue;

        if (ch === '#') {
          if (!hits(solid, { x: c, y: r, w: 1, h: 1 })) continue;
          // Coming down onto the lid is a landing; anything else is a wall
          if (vy <= 0 && prevY >= r + 1 - 0.1) {
            cubeY = r + 1;
            vy = 0;
            grounded = true;
            solid = solidBox();
            soft = softBox();
          } else {
            return die();
          }
        } else if (ch === '^') {
          if (hits(soft, spikeBox(c, r))) return die();
        } else if (ch === '_') {
          var id = c + ':' + r;
          if (!padsUsed[id] && hits(soft, { x: c + 0.05, y: r, w: 0.9, h: 0.4 })) {
            padsUsed[id] = true;
            vy = PAD_V;
            grounded = false;
            burst(6, 0.5);
          }
        }
      }
    }
  }

  /**************/
  /* PARTICLES  */
  /**************/
  function burst(count, spread) {
    for (var i = 0; i < count; i++) {
      sparks.push({
        x: sx(worldX) + CELL / 2,
        y: sy(cubeY) - CELL / 2,
        vx: (Math.random() * 2 - 1) * 260 * spread,
        vy: (Math.random() * 2 - 1) * 260 * spread,
        s: Math.max(2, Math.round(CELL * 0.12)),
        life: 1
      });
    }
  }

  function stepParticles(dt) {
    var i;
    for (i = trail.length - 1; i >= 0; i--) {
      trail[i].x -= SPEED * CELL * dt;
      trail[i].life -= dt * 2.6;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    for (i = sparks.length - 1; i >= 0; i--) {
      sparks[i].x += sparks[i].vx * dt;
      sparks[i].y += sparks[i].vy * dt;
      sparks[i].vy += 700 * dt;
      sparks[i].life -= dt * 1.4;
      if (sparks[i].life <= 0) sparks.splice(i, 1);
    }
  }

  function emitTrail(dt) {
    // The cube throws sparks off the deck; the ship trails exhaust the whole time
    if (!(mode === 'ship' || grounded) || Math.random() > dt * 40) return;
    trail.push({
      x: sx(worldX) - CELL * 0.1,
      y: sy(cubeY) - CELL * (0.05 + Math.random() * 0.2),
      s: Math.max(1, Math.round(CELL * 0.1)),
      life: 1
    });
  }

  /**************/
  /* LOOP       */
  /**************/
  function die() {
    if (state !== 'running') return;
    state = 'dead';
    deathTimer = 0;
    burst(22, 1);
    recordBest();
  }

  function recordBest() {
    var pct = Math.round(progress() * 100);
    if (pct > best) {
      best = pct;
      localStorage.setItem('geoBest_' + level.key, String(best));
    }
  }

  function win() {
    state = 'won';
    winTimer = 0;
    worldX = LEVEL_COLS;
    best = 100;
    localStorage.setItem('geoBest_' + level.key, '100');
  }

  function launch() {
    attempts++;
    var keep = attempts;
    reset(false);
    attempts = keep;
    state = 'running';
    if (holding) jump();
  }

  function jump() {
    if (!grounded || mode !== 'cube') return;
    vy = JUMP_V;
    grounded = false;
    jumpBuffer = 0;
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    // The cube squares up on the way through, so it doesn't enter a corridor
    // mid-spin
    angle = 0;
    burst(10, 0.6);
  }

  function update(dt) {
    stepParticles(dt);
    // Nothing drifts until the run is actually under way — a scrolling deck
    // under a stationary cube just reads as the game already having started
    if (state === 'running') stepScenery(dt);

    if (state === 'dead') {
      deathTimer += dt;
      // Auto-retry, the way the real one does
      if (deathTimer > 0.85) launch();
      return;
    }

    if (state === 'won') {
      winTimer += dt;
      return;
    }

    if (state !== 'running') return;

    if (jumpBuffer > 0) jumpBuffer -= dt;

    var prevY = cubeY;
    worldX += SPEED * dt;

    if (mode === 'ship') {
      // Held is climb, released is sink — no hop, so height is flown not timed
      vy += (holding ? SHIP_THRUST - SHIP_GRAVITY : -SHIP_GRAVITY) * dt;
      vy = Math.max(-SHIP_MAX_V, Math.min(SHIP_MAX_V, vy));
    } else {
      vy -= GRAVITY * dt;
    }
    cubeY += vy * dt;

    resolve(prevY);
    if (state !== 'running') return;

    if (mode === 'ship') {
      // Noses up as it climbs, down as it sinks
      angle = Math.max(-32, Math.min(32, -vy * 3.4));
    } else if (grounded) {
      // Spins in the air, squares up on landing
      angle = Math.round(angle / 90) * 90;
      // Fires on the same frame the cube touches down, so a press made a
      // fraction early still comes out the instant it can
      if (holding || jumpBuffer > 0) { jumpBuffer = 0; jump(); }
    } else {
      angle += ROT_SPEED * dt;
    }

    // Bumping the ceiling is a stop, not a death
    var ceiling = CEILING - 1;
    if (cubeY > ceiling) { cubeY = ceiling; if (vy > 0) vy = 0; }

    emitTrail(dt);

    if (worldX >= LEVEL_COLS) win();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < clouds.length; i++) drawCloud(clouds[i]);
    drawLevel();
    drawGround();
    drawParticles();
    drawPlayer();
    drawProgress();

    if (state === 'waiting') {
      drawCenterText('PRESS SPACE TO START', level.name.toLowerCase() + '  ·  hold to fly, tap to jump');
    } else if (state === 'running' && worldX < 14) {
      drawAttempt();
    } else if (state === 'won') {
      drawCenterText('LEVEL COMPLETE', 'space or tap to run it again');
    }
  }

  function frame(now) {
    var delta = lastTime ? now - lastTime : 16.7;
    lastTime = now;
    update(Math.min(delta / 1000, 0.05));
    render();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId === null) {
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  /**************/
  /* INPUT      */
  /**************/
  function press() {
    holding = true;
    jumpBuffer = JUMP_BUFFER;
    if (state === 'waiting') return launch();
    if (state === 'won') { reset(false); return launch(); }
    // Grounded, this jumps on the spot rather than waiting for the next frame
    if (state === 'running') jump();
  }

  function release() {
    holding = false;
  }

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) press();
    } else if (e.key === 'Escape') {
      window.toggleGeometry();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') release();
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.focus();
    press();
  });

  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  window.addEventListener('resize', resize);

  // Keep the sprites in step with the light/dark toggle
  new MutationObserver(readColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  /**************/
  /* TOGGLE     */
  /**************/
  window.toggleGeometry = function () {
    open = !open;
    // Only one game holds the gap at a time, so the others step aside
    if (open && window.closeDino) window.closeDino();
    if (open && window.closeFlappy) window.closeFlappy();
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');

    if (open) {
      resize();
      if (!state) reset(true);
      syncPanelHeight();
      start();
    } else {
      panel.style.height = '0px';
      stop();
    }
  };

  window.closeGeometry = function () {
    if (open) window.toggleGeometry();
  };

  resize();
  reset(true);
  render();
})();
