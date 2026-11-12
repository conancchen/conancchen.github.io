// The swim team's season, which isn't on Strava: the usual practice week,
// the weeks that ran differently and the meets. The training page's heatmap
// and its activity list both read their practices and meets from here.
window.SCHEDULE = (function () {
  // Last season and this one, each from its start, minus the break over
  // the end of the year
  var SEASONS = [['2025-09-03', '2026-02-01'], ['2026-09-03', '9999-12-31']];
  var BREAK = ['2025-12-22', '2025-12-31'];

  // Minutes of [swim, lift] by weekday, Sunday first
  var PRACTICE = [[0, 0], [180, 60], [120, 0], [180, 60], [120, 0], [180, 60], [120, 0]];

  // Weeks that ran differently from the usual one, as [swim, lift]
  var WEEKS = {
    '2026-10-18': [180, 60], '2026-10-19': [240, 0], '2026-10-20': [120, 0],
    '2026-10-21': [240, 0], '2026-10-22': [120, 60], '2026-10-23': [240, 0]
  };

  // Meet days count as a 4.5-hour swim instead of practice and show as races
  var MEET_MINUTES = 270;
  var MEETS = {
    '2025-11-08': 'at Dartmouth w/ Brown', '2025-11-14': 'vs Columbia',
    '2025-11-22': 'at Cornell w/ Penn',
    '2025-12-04': 'Big Al Invitational', '2025-12-05': 'Big Al Invitational',
    '2025-12-06': 'Big Al Invitational',
    '2026-01-09': 'at Navy w/ Kenyon, Delaware', '2026-01-10': 'at Navy w/ Kenyon, Delaware',
    '2026-01-24': 'vs Penn State',
    '2026-01-30': 'at Harvard w/ Yale', '2026-01-31': 'at Harvard w/ Yale',
    '2026-10-16': 'vs Villanova',
    '2026-11-07': 'at Columbia w/ Dartmouth', '2026-11-14': 'at Penn',
    '2026-11-20': 'Big Al Invitational', '2026-11-21': 'Big Al Invitational',
    '2026-11-22': 'Big Al Invitational',
    '2027-01-08': 'vs Navy, Notre Dame, Delaware', '2027-01-09': 'vs Navy, Notre Dame, Delaware',
    '2027-01-16': 'at Brown w/ Cornell',
    '2027-01-29': 'vs Harvard & Yale', '2027-01-30': 'vs Harvard & Yale'
  };

  function inSeason(key) {
    if (key >= BREAK[0] && key <= BREAK[1]) return false;
    return SEASONS.some(function (s) { return key >= s[0] && key <= s[1]; });
  }

  function keyOf(t) {
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }

  // What a day held: { meet, swim, lift } in minutes, or null for none
  function day(t) {
    var key = keyOf(t);
    if (MEETS[key]) return { meet: MEETS[key], swim: MEET_MINUTES, lift: 0 };
    if (!inSeason(key)) return null;
    var p = WEEKS[key] || PRACTICE[t.getDay()];
    return p[0] || p[1] ? { swim: p[0], lift: p[1] } : null;
  }

  return { day: day, keyOf: keyOf, first: SEASONS[0][0] };
})();
