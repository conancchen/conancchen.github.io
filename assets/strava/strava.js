// The training log: every activity from the strava repo's sync, a month at a
// time, each one opening to its route map and numbers. Ported from that
// repo's own page and set in this site's type and colors.
(function () {
  var SOURCE = 'https://raw.githubusercontent.com/conancchen/strava/main/';
  var M_PER_MI = 1609.344;
  var M_PER_YD = 0.9144;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  var RUN_LIKE = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'];
  var RIDE_LIKE = ['Ride', 'VirtualRide', 'EBikeRide', 'EMountainBikeRide', 'GravelRide', 'MountainBikeRide'];
  var TYPE_NAMES = {
    Run: 'Run', TrailRun: 'Trail run', VirtualRun: 'Run', Treadmill: 'Run',
    Ride: 'Bike', VirtualRide: 'Bike', EBikeRide: 'Bike', GravelRide: 'Bike',
    MountainBikeRide: 'Bike', EMountainBikeRide: 'Bike',
    Swim: 'Swim', Hike: 'Hike', Walk: 'Walk', Rowing: 'Row', Canoeing: 'Canoe',
    WeightTraining: 'Lift', Workout: 'Workout', Elliptical: 'Elliptical',
    StairStepper: 'Stairs', Yoga: 'Yoga'
  };

  function sportOf(type) {
    if (RUN_LIKE.indexOf(type) >= 0) return 'run';
    if (RIDE_LIKE.indexOf(type) >= 0) return 'bike';
    if (type === 'Swim') return 'swim';
    return 'other';
  }
  function labelFor(type) {
    return TYPE_NAMES[type] || type.replace(/([A-Z])/g, ' $1').trim();
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function fmtMi(m) { return (m / M_PER_MI).toFixed(2) + ' mi'; }
  function fmtYds(m) { return Math.round(m / M_PER_YD).toLocaleString() + ' yds'; }
  function fmtTime(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
  }
  function fmtPace(mps) {
    if (!mps) return '—';
    var s = M_PER_MI / mps;
    return Math.floor(s / 60) + ':' + pad(Math.round(s % 60)) + '/mi';
  }
  function fmtSwimPace(mps) {
    if (!mps) return '—';
    var s = (100 * M_PER_YD) / mps;
    return Math.floor(s / 60) + ':' + pad(Math.round(s % 60)) + '/100yd';
  }
  function fmtSpeed(mps) { return mps ? (mps * 2.23694).toFixed(1) + ' mph' : '—'; }
  function fmtFt(m) { return m == null ? '—' : Math.round(m * 3.28084).toLocaleString() + ' ft'; }
  function esc(s) {
    return String(s).replace(/[<>&"']/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The one number that says most about an activity
  function headline(a) {
    if (a.type === 'Swim') return fmtYds(a.distance_m);
    if (a.distance_m > 0) return fmtMi(a.distance_m);
    return fmtTime(a.moving_time_s);
  }

  function statsFor(a) {
    if (a.type === 'Swim') {
      return [['distance', fmtYds(a.distance_m)], ['time', fmtTime(a.moving_time_s)], ['pace', fmtSwimPace(a.average_speed)]];
    }
    var hr = a.average_heartrate > 0 ? ['avg hr', Math.round(a.average_heartrate) + ' bpm'] : null;
    if (!a.distance_m) return hr ? [['time', fmtTime(a.moving_time_s)], hr] : [['time', fmtTime(a.moving_time_s)]];
    return [
      ['distance', fmtMi(a.distance_m)],
      ['time', fmtTime(a.moving_time_s)],
      sportOf(a.type) === 'run' ? ['pace', fmtPace(a.average_speed)] : ['speed', fmtSpeed(a.average_speed)],
      hr || ['climb', fmtFt(a.elevation_gain_m)]
    ];
  }

  // The route over its map, in the same Web Mercator math the sync used to
  // render the PNG underneath, so the two line up
  var D2R = Math.PI / 180, SVG_W = 600, SVG_H = 360;
  function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)); }
  function decode(str) {
    var pts = [], i = 0, lat = 0, lng = 0;
    while (i < str.length) {
      var shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      pts.push([lat * 1e-5, lng * 1e-5]);
    }
    return pts;
  }
  function routeSvg(a) {
    if (!a.polyline || !a.bbox) return '';
    var pts = decode(a.polyline);
    if (pts.length < 2) return '';
    var w = a.bbox[0] * D2R, s = a.bbox[1], e = a.bbox[2] * D2R, n = a.bbox[3];
    var yn = mercY(n), ys = mercY(s);
    var d = pts.map(function (p, i) {
      var x = (p[1] * D2R - w) / (e - w) * SVG_W;
      var y = (yn - mercY(p[0])) / (yn - ys) * SVG_H;
      return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="sv-route" viewBox="0 0 ' + SVG_W + ' ' + SVG_H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" class="sv-route-case" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + d + '" class="sv-route-line sv-' + sportOf(a.type) + '" vector-effect="non-scaling-stroke"/></svg>';
  }

  function entryHtml(a) {
    var when = new Date(a.date + 'T00:00:00');
    var where = a.location ? ' · ' + esc(a.location) : '';
    var label = a.is_race ? esc(a.name || '') : labelFor(a.type) + where;
    var full = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var link = a.is_race
      ? ' · <a href="https://www.strava.com/activities/' + a.id + '" target="_blank" rel="noopener">on Strava</a>'
      : '';
    var map = a.has_map
      ? '<div class="sv-map"><img src="' + SOURCE + 'maps/' + a.id + '.png" alt="" loading="lazy">' + routeSvg(a) + '</div>'
      : '';
    var stats = statsFor(a).map(function (st) {
      return '<div><span class="sv-stat-label">' + st[0] + '</span><span class="sv-stat-value">' + st[1] + '</span></div>';
    }).join('');
    return '<details class="sv-entry' + (a.is_race ? ' is-race' : '') + '">' +
      '<summary class="sv-row"><span class="sv-day">' + when.getDate() + '</span>' +
      '<span class="sv-name">' + label + '</span>' +
      '<span class="sv-amount">' + headline(a) + '</span></summary>' +
      '<div class="sv-detail">' + map +
      '<p class="sv-meta">' + full + (a.is_race ? where : '') + link + '</p>' +
      '<div class="sv-stats">' + stats + '</div></div></details>';
  }

  // Three months at a time, newest first, with a button for the next three
  var STEP = 3;
  function renderLog(list) {
    var log = document.getElementById('sv-log');
    if (!list.length) { log.innerHTML = '<p class="sv-meta">Nothing here</p>'; return; }
    var groups = [];
    list.forEach(function (a) {
      var key = a.date.slice(0, 7);
      if (!groups.length || groups[groups.length - 1].key !== key) {
        groups.push({ key: key, name: MONTHS[+key.slice(5) - 1] + ' ' + key.slice(0, 4), items: [] });
      }
      groups[groups.length - 1].items.push(a);
    });
    log.innerHTML = groups.slice(0, shownMonths).map(function (g) {
      // The month's count and its miles on the right of its name
      var miles = g.items.reduce(function (s, a) { return s + a.distance_m; }, 0) / M_PER_MI;
      var count = g.items.length + (g.items.length === 1 ? ' activity' : ' activities');
      var sum = count + (miles >= 1 ? ' · ' + Math.round(miles).toLocaleString() + ' mi' : '');
      return '<div class="sv-month"><div class="sv-month-head"><span class="sv-month-name">' + g.name + '</span>' +
        '<span class="sv-month-sum">' + sum + '</span></div>' +
        g.items.map(entryHtml).join('') + '</div>';
    }).join('') +
      (groups.length > shownMonths ? '<button type="button" class="sv-more" id="sv-more">Show older</button>' : '');
  }

  document.getElementById('sv-log').addEventListener('click', function (e) {
    if (e.target.id !== 'sv-more') return;
    shownMonths += STEP;
    apply();
  });

  var all = [], scope = 'all', shownMonths = STEP;

  function apply() {
    var list = all.filter(function (a) {
      return scope === 'all' || a.is_race;
    });
    renderLog(list);
  }

  document.getElementById('sv-toggle').addEventListener('click', function () {
    var closed = document.getElementById('sv-section').classList.toggle('is-closed');
    this.setAttribute('aria-expanded', String(!closed));
  });

  var bar = document.getElementById('sv-filters');
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    scope = b.dataset.scope;
    shownMonths = STEP;
    bar.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    apply();
  });

  fetch(SOURCE + 'activities.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      all = data.sort(function (a, b) { return a.start_date < b.start_date ? 1 : -1; });
      apply();
      var latest = new Date(all[0].date + 'T00:00:00');
      document.getElementById('sv-foot').textContent = 'Last updated ' +
        latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    })
    .catch(function () {
      document.getElementById('sv-log').innerHTML = '<p class="sv-meta">Couldn’t load the activities right now</p>';
    });
})();
