const layout = ['WWWWWWWW', 'WRRCCCCE', 'WRRCHCEW', 'WCCCCCCW', 'WRCBCRCW', 'WWWEWWWW'];
const roomLabels = {'1,1':'101', '2,1':'102', '4,1':'103', '1,2':'LAB', '4,2':'FIRE', '1,4':'104', '4,4':'105', '6,4':'106'};
const start = {x:2, y:4};
const exits = [{x:7, y:1, name:'Exit A'}, {x:3, y:5, name:'Exit B'}];
const hazard = {x:4, y:2};
const blocked = {x:4, y:4};
const API_URL = 'http://127.0.0.1:8000/api';
const USER_STORAGE_KEY = 'smartEvacUser';

let player;
let startedAt;
let timerId;
let moves;
let mistakes;
let choseSafe;
let completed;
let currentUser = getStoredUser();

const $ = id => document.getElementById(id);
const key = (x, y) => x + ',' + y;
const walkable = (x, y) => layout[y] && layout[y][x] && layout[y][x] !== 'W'
  && !(x === blocked.x && y === blocked.y) && !(x === hazard.x && y === hazard.y);

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

function resultStorageKey() {
  return 'smartEvacResults:' + (currentUser ? currentUser.id : 'demo-student');
}

function getHistory() {
  const savedResults = localStorage.getItem(resultStorageKey());
  if (savedResults) return JSON.parse(savedResults);

  // Keep any result history created before student accounts were introduced.
  if (currentUser && currentUser.id === 'demo-student') {
    const legacyResults = localStorage.getItem('smartEvacResults');
    if (legacyResults) {
      localStorage.setItem(resultStorageKey(), legacyResults);
      return JSON.parse(legacyResults);
    }
  }
  return [];
}

function saveHistory(results) {
  localStorage.setItem(resultStorageKey(), JSON.stringify(results.slice(0, 10)));
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'SE';
}

function updateProfile() {
  const signedIn = Boolean(currentUser);
  $('profileName').textContent = signedIn ? currentUser.name : 'Not signed in';
  $('profileAvatar').textContent = signedIn ? initials(currentUser.name) : 'SE';
  $('analyticsButton').hidden = !signedIn;
  $('logoutButton').hidden = !signedIn;
}

function showAuth(mode = 'login') {
  setAuthMode(mode);
  $('resultModal').hidden = true;
  $('authModal').hidden = false;
  document.body.classList.add('auth-open');
  window.setTimeout(() => $('authEmail').focus(), 50);
}

function hideAuth() {
  $('authModal').hidden = true;
  document.body.classList.remove('auth-open');
}

function setAuthMode(mode) {
  const registering = mode === 'register';
  $('authForm').dataset.mode = mode;
  $('nameField').hidden = !registering;
  $('authName').required = registering;
  $('authPassword').autocomplete = registering ? 'new-password' : 'current-password';
  $('authTitle').textContent = registering ? 'Build your safety profile' : 'Welcome back';
  $('authDescription').textContent = registering
    ? 'Create an account to track how your evacuation skills improve with every drill.'
    : 'Sign in to save your evacuation performance and continue your safety training.';
  $('authSubmit').textContent = registering ? 'Create account' : 'Sign in';
  $('authSwitchText').textContent = registering ? 'Already have an account?' : 'New to SMART EVAC?';
  $('authSwitch').textContent = registering ? 'Sign in instead' : 'Create an account';
  clearAuthError();
}

function showAuthError(message) {
  $('authError').textContent = message;
  $('authError').hidden = false;
}

function clearAuthError() {
  $('authError').textContent = '';
  $('authError').hidden = true;
}

async function submitAuth(event) {
  event.preventDefault();
  clearAuthError();

  const registering = $('authForm').dataset.mode === 'register';
  const submitButton = $('authSubmit');
  const originalLabel = submitButton.textContent;
  const payload = {
    email: $('authEmail').value.trim(),
    password: $('authPassword').value
  };
  if (registering) payload.name = $('authName').value.trim();

  submitButton.disabled = true;
  submitButton.textContent = registering ? 'Creating account...' : 'Signing in...';
  try {
    const response = await fetch(API_URL + (registering ? '/auth/register' : '/auth/login'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Could not complete sign in.');

    currentUser = {id: String(data.id), name: data.name, email: data.email, demo: false};
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    $('authForm').reset();
    updateProfile();
    hideAuth();
    reset();
    renderHistory();
    loadRemoteHistory();
  } catch (error) {
    showAuthError(error.message === 'Failed to fetch'
      ? 'Could not reach the local API. Start the FastAPI server, or continue in demo mode.'
      : error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

function continueAsDemo() {
  currentUser = {id: 'demo-student', name: 'Demo Student', email: '', demo: true};
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
  updateProfile();
  hideAuth();
  reset();
  renderHistory();
  loadRemoteHistory();
}

function logout() {
  localStorage.removeItem(USER_STORAGE_KEY);
  currentUser = null;
  clearInterval(timerId);
  $('timer').textContent = '00:00';
  $('resultModal').hidden = true;
  $('analyticsDashboard').hidden = true;
  $('simulatorContent').hidden = false;
  updateProfile();
  renderHistory();
  showAuth('login');
}

function bfs(from) {
  const queue = [from];
  const visited = new Set([key(from.x, from.y)]);
  const parent = {};

  while (queue.length) {
    const current = queue.shift();
    if (exits.some(exit => exit.x === current.x && exit.y === current.y)) {
      const path = [];
      let node = current;
      while (node) {
        path.unshift(node);
        node = parent[key(node.x, node.y)];
      }
      return path;
    }

    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
      const next = {x: current.x + dx, y: current.y + dy};
      const nextKey = key(next.x, next.y);
      if (walkable(next.x, next.y) && !visited.has(nextKey)) {
        visited.add(nextKey);
        parent[nextKey] = current;
        queue.push(next);
      }
    });
  }
  return [];
}

function renderMap() {
  const map = $('buildingMap');
  map.innerHTML = '';
  const pathKeys = new Set(bfs(player).map(point => key(point.x, point.y)));

  layout.forEach((row, y) => [...row].forEach((type, x) => {
    const cell = document.createElement('div');
    cell.className = 'cell ' + (type === 'W' ? 'wall' : type === 'C' ? 'corridor' : 'room');
    if (roomLabels[key(x, y)]) cell.dataset.label = roomLabels[key(x, y)];
    if (pathKeys.has(key(x, y)) && !(x === player.x && y === player.y)) cell.classList.add('route');
    if (x === hazard.x && y === hazard.y) cell.classList.add('hazard');
    if (x === blocked.x && y === blocked.y) cell.classList.add('blocked');
    if (exits.some(exit => exit.x === x && exit.y === y)) cell.classList.add('exit');
    if (x === player.x && y === player.y) {
      cell.classList.add('player');
      cell.innerHTML = '<span class="player-token"></span>';
    }
    map.append(cell);
  }));

  const path = bfs(player);
  $('pathLength').textContent = Math.max(path.length - 1, 0) + ' steps';
  $('routeStatus').textContent = path.length ? 'SAFE ROUTE' : 'NO ROUTE';
  const travelled = Math.min(100, Math.round(moves / 7 * 100));
  $('progress').style.width = travelled + '%';
  $('progressText').textContent = travelled + '% EVACUATED';
  $('moves').textContent = moves + ' MOVES';
}

function updateTimer() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const text = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  $('timer').textContent = text;
  return text;
}

function move(direction) {
  if (completed || !currentUser) return;
  const directions = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]};
  const [dx, dy] = directions[direction];
  const next = {x: player.x + dx, y: player.y + dy};

  if (!walkable(next.x, next.y)) {
    mistakes++;
    $('score').innerHTML = Math.max(0, 100 - mistakes * 8) + ' <small>/ 100</small>';
    $('guidanceTitle').textContent = 'Route unavailable';
    $('guidanceText').textContent = 'That direction is unsafe or blocked. Recalculate and follow the lime path.';
    return;
  }

  player = next;
  moves++;
  renderMap();
  const exit = exits.find(item => item.x === player.x && item.y === player.y);
  if (exit) finish(exit);
}

function decide(choice, button) {
  if (completed || !currentUser) return;
  document.querySelectorAll('[data-decision]').forEach(item => item.disabled = true);
  button.classList.add('selected');

  if (choice === 'unsafe') {
    mistakes += 2;
    $('score').innerHTML = Math.max(0, 100 - mistakes * 8) + ' <small>/ 100</small>';
    $('guidanceTitle').textContent = 'Unsafe choice recorded';
    $('guidanceText').textContent = 'Stair A is smoke-filled. Return to the recommended route.';
  } else {
    choseSafe = true;
    $('guidanceTitle').textContent = 'Good decision';
    $('guidanceText').textContent = 'Stair B is clear. Continue towards Exit B.';
  }
}

function finish(exit) {
  completed = true;
  clearInterval(timerId);
  const time = updateTimer();
  const score = Math.max(0, 100 - mistakes * 8 - (choseSafe ? 0 : 5) - Math.max(0, moves - 7) * 2);
  $('score').innerHTML = score + ' <small>/ 100</small>';
  $('finalTime').textContent = time;
  $('finalScore').textContent = score;
  $('finalMistakes').textContent = mistakes;
  $('resultTitle').textContent = 'You reached ' + exit.name;
  $('resultSummary').textContent = mistakes
    ? 'Evacuation complete. Review your route choices to improve.'
    : 'Excellent work - you made every safety-critical choice.';
  $('routeStatus').textContent = 'EVACUATED';
  $('guidanceTitle').textContent = 'Evacuation complete';
  $('guidanceText').textContent = 'You safely reached ' + exit.name + '. Your result has been recorded.';
  $('progress').style.width = '100%';
  $('progressText').textContent = '100% EVACUATED';
  $('resultModal').hidden = false;
  saveResult({time, score, mistakes, date: new Date().toLocaleDateString()});
  renderHistory();
}

function saveResult(result) {
  const list = getHistory();
  list.unshift(result);
  saveHistory(list);

  fetch(API_URL + '/results', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      student_id: currentUser.id,
      scenario: 'Fire in Room 103',
      evacuation_time: result.time,
      score: result.score,
      mistakes: result.mistakes
    })
  }).catch(() => {
    // The local browser history remains available while the API is offline.
  });
}

function renderHistory() {
  const list = getHistory();
  $('historyList').innerHTML = list.length
    ? list.slice(0, 4).map(result => '<li><span>' + result.date + ' · ' + result.time + '</span><b>' + result.score + '/100</b></li>').join('')
    : '<li><span>No completed drills yet.</span></li>';
  updateAnalytics();
}

async function loadRemoteHistory() {
  if (!currentUser) return;
  try {
    const response = await fetch(API_URL + '/results?student_id=' + encodeURIComponent(currentUser.id));
    if (!response.ok) throw new Error('Could not load saved results.');
    const results = await response.json();
    if (!results.length) return;
    saveHistory(results.map(result => ({
      time: result.evacuation_time,
      score: result.score,
      mistakes: result.mistakes,
      date: new Date(result.created_at).toLocaleDateString()
    })));
    renderHistory();
  } catch {
    // The page keeps using local history when the backend is offline.
  }
}

function clearHistory() {
  localStorage.removeItem(resultStorageKey());
  renderHistory();
  if (!currentUser) return;
  fetch(API_URL + '/results?student_id=' + encodeURIComponent(currentUser.id), {method: 'DELETE'}).catch(() => {
    // Local history is cleared even if the API is not currently available.
  });
}

function timeToSeconds(time) {
  const [minutes, seconds] = time.split(':').map(Number);
  return minutes * 60 + seconds;
}

function formatDuration(seconds) {
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function svgNode(tag, attributes = {}, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  if (text) node.textContent = text;
  return node;
}

function renderPerformanceChart(results) {
  const chart = $('performanceChart');
  const emptyState = $('chartEmpty');
  chart.replaceChildren(svgNode('title', {}, 'Safety score progression across completed drills'));
  emptyState.hidden = results.length > 0;
  if (!results.length) return;

  const width = 650;
  const height = 250;
  const bounds = {left: 58, right: 24, top: 24, bottom: 42};
  const plotWidth = width - bounds.left - bounds.right;
  const plotHeight = height - bounds.top - bounds.bottom;
  const x = index => results.length === 1
    ? bounds.left + plotWidth / 2
    : bounds.left + (plotWidth / (results.length - 1)) * index;
  const y = score => bounds.top + ((100 - score) / 100) * plotHeight;

  [100, 75, 50, 25, 0].forEach(score => {
    chart.append(svgNode('line', {
      x1: bounds.left, y1: y(score), x2: width - bounds.right, y2: y(score), class: 'chart-grid-line'
    }));
    chart.append(svgNode('text', {
      x: bounds.left - 11, y: y(score) + 4, class: 'chart-axis-label', 'text-anchor': 'end'
    }, String(score)));
  });

  const points = results.map((result, index) => x(index) + ',' + y(result.score)).join(' ');
  const areaPoints = bounds.left + ',' + (height - bounds.bottom) + ' ' + points + ' ' + (width - bounds.right) + ',' + (height - bounds.bottom);
  chart.append(svgNode('polygon', {points: areaPoints, class: 'chart-area'}));
  chart.append(svgNode('polyline', {points, class: 'chart-line'}));

  results.forEach((result, index) => {
    const point = svgNode('circle', {cx: x(index), cy: y(result.score), r: 5, class: 'chart-point'});
    point.append(svgNode('title', {}, 'Drill ' + (index + 1) + ': ' + result.score + ' out of 100'));
    chart.append(point);
    chart.append(svgNode('text', {
      x: x(index), y: height - 15, class: 'chart-axis-label', 'text-anchor': 'middle'
    }, 'Drill ' + (index + 1)));
  });
}

function updateAnalytics() {
  const results = getHistory();
  const orderedResults = [...results].reverse();
  const total = results.length;
  $('totalDrills').textContent = total;
  $('historyCount').textContent = total + (total === 1 ? ' attempt' : ' attempts');

  if (!total) {
    $('averageScore').textContent = '--';
    $('bestScore').textContent = '--';
    $('fastestTime').textContent = '--:--';
    $('drillContext').textContent = 'Start your first drill';
    $('scoreContext').textContent = 'No score data yet';
    $('bestContext').textContent = 'Complete a drill to set a record';
    $('timeContext').textContent = 'Time your first safe exit';
    $('chartTrend').textContent = 'Awaiting data';
    $('insightTitle').textContent = 'Your training starts here';
    $('insightText').textContent = 'Complete the fire drill, then return here to review your safety decisions and evacuation efficiency.';
    $('focusText').textContent = 'Follow the highlighted route and choose Stair B when smoke is detected.';
    $('analyticsHistory').innerHTML = '<li class="analytics-empty">No completed drills yet. Your next result will appear here.</li>';
    renderPerformanceChart([]);
    return;
  }

  const average = Math.round(results.reduce((sum, result) => sum + result.score, 0) / total);
  const best = Math.max(...results.map(result => result.score));
  const fastest = Math.min(...results.map(result => timeToSeconds(result.time)));
  const safest = Math.min(...results.map(result => result.mistakes));
  const firstScore = orderedResults[0].score;
  const lastScore = orderedResults[orderedResults.length - 1].score;
  const scoreChange = lastScore - firstScore;

  $('averageScore').textContent = average + '/100';
  $('bestScore').textContent = best + '/100';
  $('fastestTime').textContent = formatDuration(fastest);
  $('drillContext').textContent = total === 1 ? 'First recorded attempt' : 'Based on recent attempts';
  $('scoreContext').textContent = average >= 85 ? 'Strong safety performance' : 'Room to strengthen decisions';
  $('bestContext').textContent = best === 100 ? 'Perfect safety record achieved' : 'Your current personal best';
  $('timeContext').textContent = safest === 0 ? 'Achieved with no mistakes' : 'Keep safety ahead of speed';
  $('chartTrend').textContent = scoreChange > 0 ? '+' + scoreChange + ' points since first drill' : scoreChange < 0 ? scoreChange + ' points since first drill' : 'Steady performance';

  if (average >= 90 && safest === 0) {
    $('insightTitle').textContent = 'Safe choices are becoming a habit';
    $('insightText').textContent = 'Your recent attempts show strong route awareness and reliable hazard avoidance.';
    $('focusText').textContent = 'Maintain your route accuracy while working on a calmer, faster evacuation.';
  } else if (average >= 75) {
    $('insightTitle').textContent = 'You are building a reliable route';
    $('insightText').textContent = 'Your performance is on track. Small route and decision improvements can lift your score further.';
    $('focusText').textContent = safest > 0 ? 'Avoid blocked routes and smoke zones before trying to reduce time.' : 'Repeat the drill and aim to improve your evacuation time safely.';
  } else {
    $('insightTitle').textContent = 'Review the safe route before speed';
    $('insightText').textContent = 'Your score suggests that hazards or blocked routes are creating avoidable mistakes.';
    $('focusText').textContent = 'Use the lime route guidance and choose Stair B to keep clear of smoke.';
  }

  $('analyticsHistory').innerHTML = results.map((result, index) =>
    '<li><span class="attempt-index">#' + (total - index) + '</span><span class="attempt-date">' + result.date + '</span><span class="attempt-time">' + result.time + '</span><span class="attempt-mistakes">' + result.mistakes + ' mistakes</span><b>' + result.score + '/100</b></li>'
  ).join('');
  renderPerformanceChart(orderedResults);
}

function showAnalytics() {
  if (!currentUser) return;
  $('resultModal').hidden = true;
  $('simulatorContent').hidden = true;
  $('analyticsDashboard').hidden = false;
  updateAnalytics();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function showSimulator() {
  $('analyticsDashboard').hidden = true;
  $('simulatorContent').hidden = false;
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function reset() {
  player = {...start};
  startedAt = Date.now();
  moves = 0;
  mistakes = 0;
  choseSafe = false;
  completed = false;
  clearInterval(timerId);
  timerId = setInterval(updateTimer, 1000);
  $('timer').textContent = '00:00';
  $('score').innerHTML = '100 <small>/ 100</small>';
  $('guidanceTitle').textContent = 'Take Exit B';
  $('guidanceText').textContent = 'Follow the highlighted route through the central corridor.';
  $('resultModal').hidden = true;
  document.querySelectorAll('[data-decision]').forEach(button => {
    button.disabled = false;
    button.classList.remove('selected');
  });
  renderMap();
}

document.addEventListener('keydown', event => {
  if (!$('authModal').hidden) return;
  const movesByKey = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right'};
  if (movesByKey[event.key]) {
    event.preventDefault();
    move(movesByKey[event.key]);
  }
});

document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.move)));
document.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => decide(button.dataset.decision, button)));
$('restartButton').addEventListener('click', reset);
$('newDrillButton').addEventListener('click', reset);
$('clearHistory').addEventListener('click', clearHistory);
$('analyticsButton').addEventListener('click', showAnalytics);
$('backToSimulator').addEventListener('click', showSimulator);
$('authForm').addEventListener('submit', submitAuth);
$('authSwitch').addEventListener('click', () => setAuthMode($('authForm').dataset.mode === 'login' ? 'register' : 'login'));
$('demoButton').addEventListener('click', continueAsDemo);
$('logoutButton').addEventListener('click', logout);

updateProfile();
renderHistory();
reset();
if (currentUser) {
  hideAuth();
  loadRemoteHistory();
} else {
  clearInterval(timerId);
  showAuth('login');
}
