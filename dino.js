// A self-contained take on the Chrome offline dinosaur game.
// Everything is drawn from pixel grids / rectangles on a canvas, so the only
// asset the page needs is the button icon itself.
(function () {
  var panel = document.getElementById('dino-game');
  var stage = document.getElementById('dino-stage');
  var canvas = document.getElementById('dino-canvas');
  if (!panel || !canvas) return;

  var ctx = canvas.getContext('2d');
  var toggleBtn = document.getElementById('dino-toggle');

  /**************/
  /* SPRITES    */
  /**************/
  // '#' paints a pixel, '.' leaves it clear. The dino is traced from
  // images/dino.png at its original 44x47, drawn one cell per scaled pixel.
  var DINO_BODY = [
    '.........................#################..',
    '.........................#################..',
    '......................####################..',
    '......................#####..###############',
    '......................#####..###############',
    '......................######################',
    '......................######################',
    '......................######################',
    '......................######################',
    '......................######################',
    '......................######################',
    '......................######################',
    '......................###########...........',
    '......................###########...........',
    '......................###########...........',
    '......................##################....',
    '##....................#########.............',
    '##..................###########.............',
    '##..................###########.............',
    '##...............##############.............',
    '##...............##############.............',
    '####.........######################.........',
    '####.........######################.........',
    '######.....####################...#.........',
    '######.....####################...#.........',
    '######.....####################.............',
    '###############################.............',
    '###############################.............',
    '###############################.............',
    '..#############################.............',
    '..##########################................',
    '....########################................',
    '....########################................',
    '....########################................',
    '.......###################..................',
    '.......###################..................',
    '.........###############....................',
    '.........###############....................'
  ];

  // The two legs live in their own grids so either one can be lifted for the
  // run cycle without redrawing the whole dino
  var DINO_LEG_BACK = [
    '...........######...........................',
    '...........######...........................',
    '...........####.............................',
    '...........####.............................',
    '...........##...............................',
    '...........##...............................',
    '...........##...............................',
    '...........####.............................',
    '...........####.............................'
  ];

  var DINO_LEG_FRONT = [
    '....................####....................',
    '....................####....................',
    '......................##....................',
    '......................##....................',
    '......................##....................',
    '......................##....................',
    '......................##....................',
    '......................####..................',
    '......................####..................'
  ];

  var BODY_ROWS = DINO_BODY.length;   // 38
  var LEG_ROWS = DINO_LEG_BACK.length; // 9
  var DINO_ROWS = BODY_ROWS + LEG_ROWS; // 47, the original sprite height
  var LEG_LIFT = 5;                    // cells a leg rises on its off beat

  // Hand-drawn at half resolution, then doubled so it shares the body's grid
  var DINO_DUCK_HALF = [
    '..................######.',
    '..................#######',
    '..................##.####',
    '..................#######',
    '...............##########',
    '#.....###################',
    '##.######################',
    '#########################',
    '########################.',
    '#####################....',
    '..###############........',
    '..##....###..............',
    '..##....###..............',
    '.####...####.............'
  ];

  // Each cell becomes a 2x2 block, so the duck sprite draws at the same unit
  // as the traced body
  var DINO_DUCK = (function (grid) {
    var out = [];
    for (var r = 0; r < grid.length; r++) {
      var wide = '';
      for (var c = 0; c < grid[r].length; c++) wide += grid[r].charAt(c) + grid[r].charAt(c);
      out.push(wide, wide);
    }
    return out;
  })(DINO_DUCK_HALF);

  /**************/
  /* STATE      */
  /**************/
  // PX is the unit for the scenery, U the finer unit the dino sprite uses
  var W = 600, H = 150, PX = 2, U = 1, scale = 1, groundY = 138;

  // Trunk height of the tall cactus, in scenery cells. Both the drawing and
  // the spawner measure off this, so they can't drift apart
  var TALL_H = 20;
  var DINO_X = 24;
  var fg = '#e4e4e4';
  var open = false, rafId = null, lastTime = 0;

  var GRAVITY = 0.62;
  var JUMP_VELOCITY = -10.4;
  // Eased off 15% from where it used to open, so the first few obstacles are a
  // warm-up. ACCELERATION is untouched, so it still climbs to the same top end
  var SPEED_START = 4.76;
  var SPEED_MAX = 12.6;
  var ACCELERATION = 0.0009;
  var BIRD_AFTER = 320;

  var state, dino, obstacles, clouds, pebbles;
  var speed, distance, score, hiScore, flashTimer, flashCount, runFrame, gameOverAt;

  hiScore = parseInt(localStorage.getItem('dinoHiScore'), 10) || 0;

  function reset(hard) {
    state = 'waiting';
    speed = SPEED_START;
    distance = 0;
    score = 0;
    flashTimer = 0;
    flashCount = 0;
    runFrame = 0;
    gameOverAt = 0;
    obstacles = [];
    dino = { y: 0, vy: 0, ducking: false, jumping: false };
    dino.y = groundY - dinoHeight();
    if (hard || !clouds) {
      clouds = [];
      pebbles = [];
      for (var i = 0; i < 2; i++) spawnCloud(W * (0.4 + i * 0.5));
      for (var j = 0; j < 26; j++) spawnPebble(Math.random() * W);
    }
  }

  function dinoHeight() {
    return (dino && dino.ducking && !dino.jumping ? DINO_DUCK.length : DINO_ROWS) * U;
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
    // The sprite grid is 47 rows tall, which is a lot of the canvas at 1:1, so
    // the dino runs at four fifths of a pixel per cell. drawGrid snaps the
    // edges, so the fractional unit costs nothing in crispness
    U = Math.max(0.5, Math.round(scale) * 0.8);
    PX = Math.max(1, Math.round(2 * scale));
    groundY = H - 12 * scale;
    if (dino) dino.y = Math.min(dino.y, groundY - dinoHeight());
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
  /* DRAWING    */
  /**************/
  // Cell edges are snapped to whole pixels rather than the rects being drawn at
  // their true size, so a fractional unit still lands on crisp pixels and
  // neighbouring cells share an edge instead of both half-covering it
  function drawGrid(grid, x, y, unit) {
    ctx.fillStyle = fg;
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      var top = Math.round(y + r * unit);
      var h = Math.round(y + (r + 1) * unit) - top;
      var runStart = -1;
      for (var c = 0; c <= row.length; c++) {
        var on = row.charAt(c) === '#';
        if (on && runStart < 0) runStart = c;
        // Painting each horizontal run as one rect keeps the fill count low
        if (!on && runStart >= 0) {
          var left = Math.round(x + runStart * unit);
          ctx.fillRect(left, top, Math.round(x + c * unit) - left, h);
          runStart = -1;
        }
      }
    }
  }

  function rect(x, y, w, h) {
    ctx.fillStyle = fg;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawDino() {
    var x = DINO_X * scale;
    if (dino.ducking && !dino.jumping) {
      drawGrid(DINO_DUCK, x, dino.y, U);
      return;
    }
    drawGrid(DINO_BODY, x, dino.y, U);

    // On the run, whichever leg is off beat is lifted clear of the ground
    var legY = dino.y + BODY_ROWS * U;
    var liftBack = 0, liftFront = 0;
    if (state === 'running' && !dino.jumping) {
      if (runFrame < 6) liftFront = LEG_LIFT * U; else liftBack = LEG_LIFT * U;
    }
    drawGrid(DINO_LEG_BACK, x, legY - liftBack, U);
    drawGrid(DINO_LEG_FRONT, x, legY - liftFront, U);
  }

  function drawCactus(o) {
    var u = PX;
    var big = o.kind === 'large';
    var tw = big ? 4 : 3;      // trunk width in cells
    var th = big ? TALL_H : 17; // trunk height in cells
    var top = o.y;
    for (var i = 0; i < o.count; i++) {
      var x = o.x + i * (big ? 12 : 9) * u;
      rect(x + 3 * u, top, tw * u, th * u);
      // Left arm with its elbow, then the right one a little higher up
      rect(x, top + (big ? 6 : 5) * u, 2 * u, (big ? 5 : 4) * u);
      rect(x, top + (big ? 9 : 8) * u, 3 * u, 2 * u);
      rect(x + (big ? 8 : 7) * u, top + (big ? 4 : 3) * u, 2 * u, (big ? 5 : 4) * u);
      rect(x + (big ? 7 : 6) * u, top + (big ? 7 : 6) * u, 3 * u, 2 * u);
    }
  }

  function drawBird(o) {
    var u = PX, x = o.x, y = o.y;
    rect(x, y + 6 * u, 5 * u, 2 * u);          // tail
    rect(x + 4 * u, y + 5 * u, 12 * u, 4 * u); // body
    rect(x + 14 * u, y + 3 * u, 4 * u, 4 * u); // head
    rect(x + 18 * u, y + 5 * u, 3 * u, u);     // beak
    if (o.frame < 8) {
      rect(x + 5 * u, y + 2 * u, 9 * u, 3 * u);
      rect(x + 7 * u, y, 6 * u, 2 * u);
    } else {
      rect(x + 5 * u, y + 9 * u, 9 * u, 3 * u);
      rect(x + 7 * u, y + 12 * u, 6 * u, 2 * u);
    }
  }

  function drawCloud(c) {
    var u = PX;
    ctx.globalAlpha = 0.45;
    rect(c.x + 2 * u, c.y + 2 * u, 12 * u, 2 * u);
    rect(c.x, c.y + 4 * u, 18 * u, 2 * u);
    rect(c.x + 3 * u, c.y, 8 * u, 2 * u);
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    rect(0, groundY, W, Math.max(1, PX / 2));
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < pebbles.length; i++) {
      var p = pebbles[i];
      rect(p.x, groundY + p.o * PX, p.w * PX, Math.max(1, PX / 2));
    }
    ctx.globalAlpha = 1;
  }

  function drawScore() {
    var text = pad(Math.floor(score));
    ctx.fillStyle = fg;
    ctx.font = 'bold ' + Math.round(11 * scale) + "px 'Courier New', Courier, monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    // The counter blinks for a moment each time it rolls past a hundred
    var hidden = flashCount > 0 && Math.floor(flashTimer / 120) % 2 === 0;
    if (!hidden) ctx.fillText(text, W - 8 * scale, 8 * scale);

    if (hiScore > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillText('HI ' + pad(hiScore), W - 8 * scale - ctx.measureText(text).width - 14 * scale, 8 * scale);
      ctx.globalAlpha = 1;
    }
  }

  function pad(n) {
    var s = String(n);
    while (s.length < 5) s = '0' + s;
    return s;
  }

  function drawCenterText(main, sub) {
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(13 * scale) + "px 'Courier New', Courier, monospace";
    ctx.fillText(main, W / 2, H * 0.34);
    if (sub) {
      ctx.globalAlpha = 0.55;
      ctx.font = Math.round(10 * scale) + "px 'Courier New', Courier, monospace";
      ctx.fillText(sub, W / 2, H * 0.34 + 18 * scale);
      ctx.globalAlpha = 1;
    }
  }

  /**************/
  /* SPAWNING   */
  /**************/
  function spawnCloud(x) {
    clouds.push({ x: x, y: (10 + Math.random() * 34) * scale, speed: 0.2 + Math.random() * 0.2 });
  }

  function spawnPebble(x) {
    pebbles.push({ x: x, w: 1 + Math.floor(Math.random() * 4), o: 2 + Math.floor(Math.random() * 3) });
  }

  function spawnObstacle() {
    var u = PX;
    var roll = Math.random();
    var o;

    if (score > BIRD_AFTER && roll < 0.22) {
      // How far the bird's body sits above the ground: the lowest one has to be
      // jumped, the two higher ones have to be ducked under
      var heights = [8, 24, 36];
      var lift = heights[Math.floor(Math.random() * heights.length)] * scale;
      o = {
        type: 'bird',
        x: W,
        y: groundY - lift - 11 * u,
        w: 21 * u,
        frame: 0
      };
    } else {
      var big = roll > 0.6;
      var count = 1 + Math.floor(Math.random() * (speed > 8 ? 3 : 2));
      var cellW = (big ? 12 : 9) * u;
      var h = (big ? TALL_H : 17) * u;
      o = {
        type: 'cactus',
        kind: big ? 'large' : 'small',
        count: count,
        x: W,
        y: groundY - h,
        w: cellW * count,
        h: h
      };
    }

    o.gap = o.w + speed * (26 + Math.random() * 46) * scale;
    obstacles.push(o);
  }

  /**************/
  /* COLLISION  */
  /**************/
  // Boxes are pulled in a little from the artwork so near-misses stay misses
  function dinoBoxes() {
    var x = DINO_X * scale, y = dino.y, u = U;
    if (dino.ducking && !dino.jumping) {
      return [{ x: x + 4 * u, y: y + 12 * u, w: 44 * u, h: 14 * u }];
    }
    return [
      { x: x + 23 * u, y: y + 2 * u, w: 19 * u, h: 13 * u },  // head
      { x: x + 4 * u, y: y + 17 * u, w: 26 * u, h: 19 * u },  // body
      { x: x + 12 * u, y: y + 38 * u, w: 12 * u, h: 8 * u }   // legs
    ];
  }

  function obstacleBox(o) {
    var u = PX;
    if (o.type === 'bird') return { x: o.x + 3 * u, y: o.y + 3 * u, w: 16 * u, h: 8 * u };
    return { x: o.x + u, y: o.y + u, w: o.w - 2 * u, h: o.h - u };
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**************/
  /* LOOP       */
  /**************/
  function update(dt) {
    if (state === 'crashed') return;

    if (state === 'running') {
      speed = Math.min(SPEED_MAX, speed + ACCELERATION * dt);
      distance += speed * dt;
      var next = distance * 0.025;
      if (Math.floor(next / 100) > Math.floor(score / 100)) {
        flashCount = 3;
        flashTimer = 0;
      }
      score = next;
      if (flashCount > 0) {
        flashTimer += dt * 16.7;
        if (flashTimer > 360) { flashCount = 0; flashTimer = 0; }
      }
      runFrame = (runFrame + dt) % 12;
    }

    var move = state === 'waiting' ? 0 : speed * scale * dt;

    // Scenery
    for (var i = clouds.length - 1; i >= 0; i--) {
      clouds[i].x -= clouds[i].speed * scale * dt;
      if (clouds[i].x < -20 * PX) { clouds.splice(i, 1); spawnCloud(W + Math.random() * W * 0.5); }
    }
    if (clouds.length < 3 && Math.random() < 0.004 * dt) spawnCloud(W + Math.random() * 60);

    for (var p = pebbles.length - 1; p >= 0; p--) {
      pebbles[p].x -= move;
      if (pebbles[p].x < -8) { pebbles.splice(p, 1); spawnPebble(W + Math.random() * 40); }
    }

    // Dino physics
    if (dino.jumping) {
      dino.vy += GRAVITY * scale * dt;
      dino.y += dino.vy * scale * dt;
      var floor = groundY - DINO_ROWS * U;
      if (dino.y >= floor) {
        dino.y = floor;
        dino.vy = 0;
        dino.jumping = false;
      }
    } else {
      dino.y = groundY - dinoHeight();
    }

    if (state !== 'running') return;

    // Obstacles
    for (var k = obstacles.length - 1; k >= 0; k--) {
      var o = obstacles[k];
      o.x -= move;
      if (o.type === 'bird') o.frame = (o.frame + dt * 0.5) % 16;
      if (o.x + o.w < 0) obstacles.splice(k, 1);
    }

    var last = obstacles[obstacles.length - 1];
    if (!last || last.x + last.gap <= W) spawnObstacle();

    // Crash check
    var boxes = dinoBoxes();
    for (var m = 0; m < obstacles.length; m++) {
      var ob = obstacleBox(obstacles[m]);
      for (var n = 0; n < boxes.length; n++) {
        if (hits(boxes[n], ob)) return crash();
      }
    }
  }

  function crash() {
    state = 'crashed';
    gameOverAt = 0;
    if (Math.floor(score) > hiScore) {
      hiScore = Math.floor(score);
      localStorage.setItem('dinoHiScore', String(hiScore));
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < clouds.length; i++) drawCloud(clouds[i]);
    drawGround();
    for (var j = 0; j < obstacles.length; j++) {
      var o = obstacles[j];
      if (o.type === 'bird') drawBird(o); else drawCactus(o);
    }
    drawDino();
    drawScore();
    if (state === 'waiting') drawCenterText('PRESS SPACE TO START', 'space / tap to jump  ·  down arrow to duck');
    if (state === 'crashed') drawCenterText('G A M E   O V E R', 'space or tap to try again');
  }

  function frame(now) {
    var delta = lastTime ? now - lastTime : 16.7;
    lastTime = now;
    var dt = Math.min(delta / 16.7, 3);
    if (state === 'crashed') gameOverAt += delta;
    update(dt);
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
  function jump() {
    if (state === 'waiting') {
      state = 'running';
      return;
    }
    if (state === 'crashed') {
      // A short lockout keeps the crashing keypress from instantly restarting
      if (gameOverAt > 400) { reset(false); state = 'running'; }
      return;
    }
    if (!dino.jumping) {
      dino.jumping = true;
      dino.ducking = false;
      dino.vy = JUMP_VELOCITY;
    }
  }

  function duck(on) {
    if (state !== 'running') return;
    if (on && dino.jumping) {
      dino.vy += 1.6; // fast-fall out of a jump, same as the original
      return;
    }
    dino.ducking = on;
  }

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') {
      e.preventDefault();
      jump();
    } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
      e.preventDefault();
      duck(true);
    } else if (e.key === 'Escape') {
      window.toggleDino();
    }
  });

  document.addEventListener('keyup', function (e) {
    if (!open) return;
    if (e.code === 'ArrowDown' || e.key === 'ArrowDown') duck(false);
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.focus();
    jump();
  });

  window.addEventListener('resize', resize);

  // Keep the sprites in step with the light/dark toggle
  new MutationObserver(readColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  /**************/
  /* TOGGLE     */
  /**************/
  window.toggleDino = function () {
    open = !open;
    // Only one game holds the gap at a time, so the others step aside
    if (open && window.closeFlappy) window.closeFlappy();
    if (open && window.closeGeometry) window.closeGeometry();
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

  window.closeDino = function () {
    if (open) window.toggleDino();
  };

  resize();
  reset(true);
  render();
})();
