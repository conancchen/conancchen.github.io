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
    if (a.practice) return a.is_race ? (a.days > 1 ? a.days + ' days' : '') : hours(a.moving_time_s);
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

  // What an activity opens to: its map, a line about it and its numbers
  function detailHtml(a, about) {
    var link = a.is_race
      ? ' · <a href="https://www.strava.com/activities/' + a.id + '" target="_blank" rel="noopener">on Strava</a>'
      : '';
    var map = a.has_map
      ? '<div class="sv-map"><img src="' + SOURCE + 'maps/' + a.id + '.png" alt="" loading="lazy">' + routeSvg(a) + '</div>'
      : '';
    var stats = statsFor(a).map(function (st) {
      return '<div><span class="sv-stat-label">' + st[0] + '</span><span class="sv-stat-value">' + st[1] + '</span></div>';
    }).join('');
    return map + '<p class="sv-meta">' + about + link + '</p><div class="sv-stats">' + stats + '</div>';
  }

  function entryHtml(a) {
    var when = new Date(a.date + 'T00:00:00');
    // The date as MM-DD; a meet over several days shows its first
    var md = pad(when.getMonth() + 1) + '-' + pad(when.getDate());
    // Practices and meets from the team's schedule have no map or numbers
    // to open to, so they're plain rows
    if (a.practice) {
      return '<div class="sv-entry sv-practice' + (a.is_race ? ' is-race' : '') + '"><div class="sv-row">' +
        '<span class="sv-day">' + md + '</span>' +
        '<span class="sv-name">' + esc(a.name) + '</span>' +
        '<span class="sv-amount">' + headline(a) + '</span></div></div>';
    }
    var where = a.location ? ' · ' + esc(a.location) : '';
    var label = a.is_race ? esc(a.name || '') : labelFor(a.type) + where;
    var full = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    // A triathlon is one row with its whole distance, opening to the day
    // and then each leg under its sport
    var amount = a.legs
      ? fmtMi(a.legs.reduce(function (m, l) { return m + (l.distance_m || 0); }, 0))
      : headline(a);
    var detail = a.legs
      ? '<p class="sv-meta">' + full + where + '</p>' + a.legs.map(function (l) {
          return '<div class="sv-leg">' + detailHtml(l, labelFor(l.type)) + '</div>';
        }).join('')
      : detailHtml(a, full + (a.is_race ? where : ''));
    return '<details class="sv-entry' + (a.is_race ? ' is-race' : '') + '">' +
      '<summary class="sv-row"><span class="sv-day">' + md + '</span>' +
      '<span class="sv-name">' + label + '</span>' +
      '<span class="sv-amount">' + amount + '</span></summary>' +
      '<div class="sv-detail">' + detail + '</div></details>';
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
    }).join('');
    document.getElementById('sv-more').hidden = groups.length <= shownMonths;
  }

  // A month's opening line, as on a GitHub profile ("Created 41 commits in
  // 3 repositories"): how many activities in how many sports, then a row
  // for each sport with its count and distance and a bar for its share
  var SPORT_NAMES = { swim: 'Swim', bike: 'Bike', run: 'Run', lift: 'Lift', other: 'Other' };
  var ICON_PULSE = '<svg viewBox="0 0 16 16"><path d="M2 8.5h2.1c.4 0 .8-.3.9-.6l1.2-3.3c.2-.5.9-.5 1 0l1.9 6.8c.1.5.8.6 1 .1l1-2.4c.2-.4.5-.6.9-.6H14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // The month's races and meets by name, like GitHub's "Created 2
  // repositories", each opening to its numbers when Strava has them
  // An outlined flag, its pole and cloth together centered in the icon
  var ICON_FLAG = '<svg viewBox="0 0 16 16"><path d="M4.5 13V3.6M4.5 4c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0v4.6c-1.2.8-2.4.8-3.6 0s-2.4-.8-3.6 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function racesHtml(items) {
    // A triathlon's legs are separate activities on Strava, each named for
    // the race with its sport on the end ("Ironman 70.3 bike"); the ones
    // from the same day with the same name make one race, legs in order
    var LEG = /\s+(swim|bike|run)$/i, tris = {}, races = [];
    items.forEach(function (a) {
      if (!a.is_race) return;
      if (a.practice || !LEG.test(a.name || '')) { races.push(a); return; }
      var name = a.name.replace(LEG, ''), key = a.date + ' ' + name.toLowerCase();
      var tri = tris[key];
      if (!tri) {
        tri = tris[key] = { date: a.date, is_race: true, name: name, location: a.location, legs: [] };
        races.push(tri);
      }
      // Where the legs' names differ in case, the capitalized one
      if (name < tri.name) tri.name = name;
      tri.legs.push(a);
      tri.legs.sort(function (x, y) { return x.start_date < y.start_date ? -1 : 1; });
    });
    // A lone leg is just that activity
    races = races.map(function (r) { return r.legs && r.legs.length === 1 ? r.legs[0] : r; });
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

  document.getElementById('sv-more').addEventListener('click', function () {
    shownMonths += STEP;
    apply();
  });

  var all = [], shownMonths = STEP;

  function apply() {
    renderLog(all);
  }


  // The team's practices and meets, from the start of the schedule to
  // today. A practice swim is left out when Strava already has a swim that
  // day at least as long, as the heatmap does. A meet that runs over
  // several days in a row is one race: its later days add to the first
  // day's entry instead of making their own
  function practices(data) {
    if (!window.SCHEDULE) return [];
    var swum = {};
    data.forEach(function (a) {
      if (a.type === 'Swim') swum[a.date] = (swum[a.date] || 0) + a.moving_time_s;
    });
    var out = [], today = new Date(), meet = null;
    var p = SCHEDULE.first.split('-');
    for (var t = new Date(+p[0], +p[1] - 1, +p[2]); t <= today; t.setDate(t.getDate() + 1)) {
      var plan = SCHEDULE.day(t);
      if (!plan || !plan.meet) meet = null;
      if (!plan) continue;
      var key = SCHEDULE.keyOf(t);
      if (plan.meet && meet && meet.name === plan.meet) {
        meet.days++;
        meet.moving_time_s += plan.swim * 60;
        continue;
      }
      meet = null;
      if (plan.swim && (swum[key] || 0) < plan.swim * 60) {
        out.push({ date: key, start_date: key + 'T07:00:00Z', type: 'Swim', practice: true,
          is_race: !!plan.meet, name: plan.meet || 'Swim practice', moving_time_s: plan.swim * 60, distance_m: 0, days: 1 });
        if (plan.meet) meet = out[out.length - 1];
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
      all = data.concat(practices(data)).sort(function (a, b) { return a.start_date < b.start_date ? 1 : -1; });
      apply();
      // The day of the newest thing in the log, a practice or meet from the
      // schedule included, not only the newest activity on Strava
      var latest = all.reduce(function (m, a) { return a.date > m ? a.date : m; }, '');
      latest = new Date(latest + 'T00:00:00');
      document.getElementById('sv-foot').textContent = 'Last updated ' +
        latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    })
    .catch(function () {
      document.getElementById('sv-log').innerHTML = '<p class="sv-meta">Couldn’t load the activities right now</p>';
    });
})();
