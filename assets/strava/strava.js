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
    if (type === 'WeightTraining') return 'lift';
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
  function hours(s) {
    var h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? h + ' h' + (m ? ' ' + m + ' m' : '') : m + ' m';
  }

  function headline(a) {
    if (a.practice) return a.is_race ? '' : hours(a.moving_time_s);
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
    // Practices and meets from the team's schedule have no map or numbers
    // to open to, so they're plain rows
    if (a.practice) {
      return '<div class="sv-entry sv-practice' + (a.is_race ? ' is-race' : '') + '"><div class="sv-row">' +
        '<span class="sv-day">' + when.getDate() + '</span>' +
        '<span class="sv-name">' + esc(a.name) + '</span>' +
        '<span class="sv-amount">' + headline(a) + '</span></div></div>';
    }
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
      return '<div class="sv-month"><h3 class="sv-month-head"><span><b>' + g.name.split(' ')[0] + '</b> ' +
        g.name.split(' ')[1] + '</span></h3><div class="sv-tl">' +
        summaryHtml(g.items) + racesHtml(g.items) +
        '</div></div>';
    }).join('') +
      (groups.length > shownMonths ? '<button type="button" class="sv-more" id="sv-more">Show more activity</button>' : '');
  }

  // A month's opening line, as on a GitHub profile ("Created 41 commits in
  // 3 repositories"): how many activities in how many sports, then a row
  // for each sport with its count and distance and a bar for its share
  var SPORT_NAMES = { swim: 'Swim', bike: 'Bike', run: 'Run', lift: 'Lift', other: 'Other' };
  var ICON_PULSE = '<svg viewBox="0 0 16 16"><path d="M1 8h3l2-5 4 10 2-5h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // The month's races and meets by name, like GitHub's "Created 2
  // repositories", each opening to its numbers when Strava has them
  // An outlined flag, its pole and cloth together centered in the icon
  var ICON_FLAG = '<svg viewBox="0 0 16 16"><path d="M4.5 12.5V3.5h7l-1.5 2.5 1.5 2.5h-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function racesHtml(items) {
    var races = items.filter(function (a) { return a.is_race; });
    if (!races.length) return '';
    return '<div class="sv-tl-item"><span class="sv-tl-icon" aria-hidden="true">' + ICON_FLAG + '</span>' +
      '<div class="sv-tl-main"><p class="sv-tl-title">Raced ' + races.length + (races.length === 1 ? ' time' : ' times') + '</p>' +
      races.map(entryHtml).join('') + '</div></div>';
  }

  function summaryHtml(items) {
    var by = {};
    items.forEach(function (a) {
      var k = sportOf(a.type);
      by[k] = by[k] || { n: 0, m: 0, s: 0 };
      by[k].n++;
      by[k].m += a.distance_m || 0;
      by[k].s += a.moving_time_s || 0;
    });
    var keys = ['swim', 'bike', 'run', 'lift', 'other'].filter(function (k) { return by[k]; });
    var most = Math.max.apply(null, keys.map(function (k) { return by[k].n; }));
    var n = items.length;
    var rows = keys.map(function (k) {
      var dist = k === 'swim' || k === 'lift' ? ' · ' + Math.round(by[k].s / 3600) + ' h'
        : by[k].m ? ' · ' + Math.round(by[k].m / M_PER_MI).toLocaleString() + ' mi' : '';
      return '<li class="sv-' + k + '"><span class="sv-tl-sport">' + SPORT_NAMES[k] + '</span>' +
        '<span class="sv-tl-count">' + by[k].n + (by[k].n === 1 ? ' activity' : ' activities') + dist + '</span>' +
        '<span class="sv-tl-bar"><span style="width:' + Math.max(4, by[k].n / most * 100) + '%"></span></span></li>';
    }).join('');
    return '<div class="sv-tl-item"><span class="sv-tl-icon" aria-hidden="true">' + ICON_PULSE + '</span>' +
      '<div class="sv-tl-main"><p class="sv-tl-title">Logged ' + n + (n === 1 ? ' activity' : ' activities') +
      ' in ' + keys.length + (keys.length === 1 ? ' sport' : ' sports') + '</p><ul class="sv-tl-sports">' + rows + '</ul></div></div>';
  }

  document.getElementById('sv-log').addEventListener('click', function (e) {
    if (e.target.id !== 'sv-more') return;
    shownMonths += STEP;
    apply();
  });

  var all = [], shownMonths = STEP;

  function apply() {
    renderLog(all);
  }


  // The team's practices and meets, from the start of the schedule to
  // today. A practice swim is left out when Strava already has a swim that
  // day at least as long, as the heatmap does
  function practices(data) {
    if (!window.SCHEDULE) return [];
    var swum = {};
    data.forEach(function (a) {
      if (a.type === 'Swim') swum[a.date] = (swum[a.date] || 0) + a.moving_time_s;
    });
    var out = [], today = new Date();
    var p = SCHEDULE.first.split('-');
    for (var t = new Date(+p[0], +p[1] - 1, +p[2]); t <= today; t.setDate(t.getDate() + 1)) {
      var plan = SCHEDULE.day(t);
      if (!plan) continue;
      var key = SCHEDULE.keyOf(t);
      if (plan.swim && (swum[key] || 0) < plan.swim * 60) {
        out.push({ date: key, start_date: key + 'T07:00:00Z', type: 'Swim', practice: true,
          is_race: !!plan.meet, name: plan.meet || 'Swim practice', moving_time_s: plan.swim * 60, distance_m: 0 });
      }
      if (plan.lift) {
        out.push({ date: key, start_date: key + 'T06:00:00Z', type: 'WeightTraining', practice: true,
          name: 'Lift', moving_time_s: plan.lift * 60, distance_m: 0 });
      }
    }
    return out;
  }

  fetch(SOURCE + 'activities.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var latest = data.reduce(function (m, a) { return a.date > m ? a.date : m; }, '');
      all = data.concat(practices(data)).sort(function (a, b) { return a.start_date < b.start_date ? 1 : -1; });
      apply();
      latest = new Date(latest + 'T00:00:00');
      document.getElementById('sv-foot').textContent = 'Last updated ' +
        latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    })
    .catch(function () {
      document.getElementById('sv-log').innerHTML = '<p class="sv-meta">Couldn’t load the activities right now</p>';
    });
})();
