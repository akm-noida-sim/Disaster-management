const layout = ['WWWWWWWW', 'WRRCCCCE', 'WRRCCCCW', 'WCCCCCCW', 'WRCBCRCW', 'WWWEWWWW'];
const roomLabels = {'1,1':'101', '2,1':'102', '4,1':'103', '1,2':'LAB', '1,4':'104', '4,4':'105', '6,4':'106'};
const start = {x: 2, y: 4};
const exits = [{x: 7, y: 1, name: 'Exit A'}, {x: 3, y: 5, name: 'Exit B'}];
const API_URL = 'http://127.0.0.1:8000/api';
const USER_STORAGE_KEY = 'smartEvacUser';

const scenarios = {
  fire: {
    id: 'fire',
    shortName: 'Fire drill',
    drillLabel: 'FIRE EVACUATION',
    title: 'Fire in Room 103',
    subtitle: 'Smoke blocks the central route · Exit B recommended',
    heroDescription: 'Navigate the Science Block, avoid smoke and fire, and reach a safe exit before conditions worsen.',
    icon: '♨',
    mapIcon: 'F',
    mapLabel: 'FIRE',
    hazardName: 'Fire detected',
    hazardDescription: 'Room 103 is unsafe. Smoke is spreading into the central corridor.',
    risk: 'HIGH',
    riskPercent: 78,
    hazard: {x: 4, y: 2},
    blocked: {x: 4, y: 4},
    recommendedExit: 'Exit B',
    routeText: 'Follow the highlighted route away from smoke and towards Exit B.',
    decisionTitle: 'Stair A has heavy smoke.',
    decisionPrompt: 'Which way do you go?',
    unsafeLabel: 'Stair A',
    safeLabel: 'Stair B',
    unsafeGuidance: 'Stair A is smoke-filled. Return to the recommended route.',
    safeGuidance: 'Stair B is clear. Continue towards Exit B.',
    color: 'fire'
  },
  earthquake: {
    id: 'earthquake',
    shortName: 'Earthquake drill',
    drillLabel: 'EARTHQUAKE EVACUATION',
    title: 'Earthquake: structural damage',
    subtitle: 'South route is blocked · Exit A recommended',
    heroDescription: 'Move away from damaged areas, avoid falling hazards, and use the clear northern exit route.',
    icon: '⚠',
    mapIcon: '!',
    mapLabel: 'DAMAGE',
    hazardName: 'Structural damage reported',
    hazardDescription: 'A ceiling collapse has made the central corridor unsafe.',
    risk: 'HIGH',
    riskPercent: 74,
    hazard: {x: 5, y: 3},
    blocked: {x: 3, y: 4},
    recommendedExit: 'Exit A',
    routeText: 'Use the northern corridor and keep clear of the damaged section.',
    decisionTitle: 'A lift is nearby after the tremor.',
    decisionPrompt: 'Which evacuation route do you choose?',
    unsafeLabel: 'Use lift',
    safeLabel: 'Use stairs',
    unsafeGuidance: 'Do not use lifts after an earthquake. Follow the marked stair route.',
    safeGuidance: 'Correct. Use the stairs and continue towards Exit A.',
    color: 'earthquake'
  },
  flood: {
    id: 'flood',
    shortName: 'Flood drill',
    drillLabel: 'FLOOD EVACUATION',
    title: 'Flooding near the south exit',
    subtitle: 'Exit B is submerged · Exit A recommended',
    heroDescription: 'Avoid rising water, keep away from the south exit, and use the dry northern evacuation route.',
    icon: '≈',
    mapIcon: '~',
    mapLabel: 'WATER',
    hazardName: 'Water level rising',
    hazardDescription: 'Floodwater has reached the south exit and lower corridor.',
    risk: 'HIGH',
    riskPercent: 72,
    hazard: {x: 3, y: 5},
    blocked: {x: 3, y: 4},
    recommendedExit: 'Exit A',
    routeText: 'Avoid the flooded south exit and follow the dry path to Exit A.',
    decisionTitle: 'Water is collecting near the lower corridor.',
    decisionPrompt: 'What is the safer action?',
    unsafeLabel: 'Cross water',
    safeLabel: 'Go higher',
    unsafeGuidance: 'Never cross unknown floodwater. Rejoin the elevated evacuation route.',
    safeGuidance: 'Correct. Move to the higher, dry route towards Exit A.',
    color: 'flood'
  },
  gas: {
    id: 'gas',
    shortName: 'Gas leak drill',
    drillLabel: 'GAS LEAK EVACUATION',
    title: 'Gas leak in the chemistry wing',
    subtitle: 'East wing contaminated · Exit B recommended',
    heroDescription: 'Avoid the contaminated chemistry wing, do not create sparks, and follow the shortest clear exit route.',
    icon: '☁',
    mapIcon: 'G',
    mapLabel: 'GAS',
    hazardName: 'Gas leak detected',
    hazardDescription: 'The chemistry-wing air is contaminated. Keep clear of the east corridor.',
    risk: 'HIGH',
    riskPercent: 76,
    hazard: {x: 5, y: 2},
    blocked: {x: 6, y: 2},
    recommendedExit: 'Exit B',
    routeText: 'Stay away from the east wing and exit through the clear south route.',
    decisionTitle: 'You notice the smell of gas.',
    decisionPrompt: 'What should you do before leaving?',
    unsafeLabel: 'Use switch',
    safeLabel: 'Avoid sparks',
    unsafeGuidance: 'Do not operate switches or create sparks near a suspected gas leak.',
    safeGuidance: 'Correct. Avoid ignition sources and use the clear route to Exit B.',
    color: 'gas'
  },
  general: {
    id: 'general',
    shortName: 'General emergency',
    drillLabel: 'GENERAL EMERGENCY',
    title: 'General emergency evacuation',
    subtitle: 'South route unavailable · Exit A recommended',
    heroDescription: 'Respond calmly to an unclassified emergency, avoid restricted areas, and follow the designated exit guidance.',
    icon: '!',
    mapIcon: '!',
    mapLabel: 'ALERT',
    hazardName: 'Emergency area restricted',
    hazardDescription: 'A restricted area has been reported in the central corridor.',
    risk: 'MEDIUM',
    riskPercent: 58,
    hazard: {x: 4, y: 3},
    blocked: {x: 3, y: 4},
    recommendedExit: 'Exit A',
    routeText: 'Follow the northern corridor and use the designated Exit A route.',
    decisionTitle: 'An unfamiliar alert is announced.',
    decisionPrompt: 'How should you respond?',
    unsafeLabel: 'Run alone',
    safeLabel: 'Follow signs',
    unsafeGuidance: 'Avoid panic. Rejoin the marked evacuation path and follow staff guidance.',
    safeGuidance: 'Correct. Follow emergency signs and proceed calmly to Exit A.',
    color: 'general'
  }
};

const buildingFloors = [
  {number: 0, label: 'Ground Floor', roomPrefix: 'G'},
  {number: 1, label: 'First Floor', roomPrefix: '1'},
  {number: 2, label: 'Second Floor', roomPrefix: '2'},
  {number: 3, label: 'Third Floor', roomPrefix: '3'},
  {number: 4, label: 'Fourth Floor', roomPrefix: '4'}
];
const buildingDirections = {
  n: {label: 'North', x: 50, y: 12},
  e: {label: 'East', x: 88, y: 50},
  s: {label: 'South', x: 50, y: 88},
  w: {label: 'West', x: 12, y: 50}
};
const buildingRoomPositions = [
  {room: 1, x: 29, y: 19, direction: 'n'},
  {room: 2, x: 71, y: 19, direction: 'n'},
  {room: 3, x: 83, y: 34, direction: 'e'},
  {room: 4, x: 83, y: 66, direction: 'e'},
  {room: 5, x: 71, y: 81, direction: 's'},
  {room: 6, x: 29, y: 81, direction: 's'},
  {room: 7, x: 17, y: 66, direction: 'w'},
  {room: 8, x: 17, y: 34, direction: 'w'}
];
const buildingState = {
  selectedFloor: 0,
  selectedRoomId: null,
  hazardNodeId: null
};
const buildingGraph = createBuildingGraph();

let activeScenario = scenarios.fire;
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
const samePoint = (first, second) => first.x === second.x && first.y === second.y;
const targetExit = () => exits.find(exit => exit.name === activeScenario.recommendedExit);
const walkable = (x, y) => layout[y] && layout[y][x] && layout[y][x] !== 'W'
  && !(x === activeScenario.blocked.x && y === activeScenario.blocked.y)
  && !(x === activeScenario.hazard.x && y === activeScenario.hazard.y);

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
  $('selectDrillButton').hidden = !signedIn;
  $('analyticsButton').hidden = !signedIn;
  $('logoutButton').hidden = !signedIn;
}

function updateScenarioUI() {
  document.body.dataset.scenario = activeScenario.color;
  $('liveDrillLabel').textContent = activeScenario.drillLabel;
  $('scenarioTitle').textContent = activeScenario.title;
  $('scenarioSubtitle').textContent = activeScenario.subtitle;
  $('heroDescription').textContent = activeScenario.heroDescription;
  $('mapScenarioLabel').textContent = 'SCIENCE BLOCK · GROUND FLOOR · ' + activeScenario.shortName.toUpperCase();
  $('hazardLegend').textContent = activeScenario.hazardName.toLowerCase();
  $('hazardIcon').textContent = activeScenario.icon;
  $('hazardTitle').textContent = activeScenario.hazardName;
  $('hazardDescription').textContent = activeScenario.hazardDescription;
  $('riskLevel').textContent = activeScenario.risk;
  $('riskBar').style.width = activeScenario.riskPercent + '%';
  $('decisionTitle').textContent = activeScenario.decisionTitle;
  $('decisionPrompt').textContent = activeScenario.decisionPrompt;
  $('unsafeDecision').textContent = activeScenario.unsafeLabel;
  $('safeDecision').textContent = activeScenario.safeLabel;
  renderScenarioOptions();
}

function showAuth(mode = 'login') {
  setAuthMode(mode);
  $('resultModal').hidden = true;
  $('scenarioModal').hidden = true;
  document.body.classList.remove('scenario-open');
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
  const payload = {email: $('authEmail').value.trim(), password: $('authPassword').value};
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
    showScenarioPicker();
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
  showScenarioPicker();
}

function logout() {
  localStorage.removeItem(USER_STORAGE_KEY);
  currentUser = null;
  clearInterval(timerId);
  $('timer').textContent = '00:00';
  $('resultModal').hidden = true;
  hideScenarioPicker();
  $('analyticsDashboard').hidden = true;
  $('simulatorContent').hidden = false;
  updateProfile();
  renderHistory();
  showAuth('login');
}

function roomLabel(floorNumber, roomNumber) {
  const floor = buildingFloors.find(item => item.number === floorNumber);
  return floor.roomPrefix + String(roomNumber).padStart(2, '0');
}

function createBuildingGraph() {
  const nodes = {};
  const edges = {};
  const addNode = node => {
    nodes[node.id] = node;
    edges[node.id] = [];
  };
  const connect = (first, second, weight) => {
    edges[first].push({to: second, weight});
    edges[second].push({to: first, weight});
  };

  buildingFloors.forEach(floor => {
    const hubId = 'hub-' + floor.number;
    addNode({id: hubId, type: 'hub', floor: floor.number, x: 50, y: 50, label: 'Central corridor'});

    Object.entries(buildingDirections).forEach(([direction, details]) => {
      const stairId = 'stair-' + direction + '-' + floor.number;
      addNode({
        id: stairId,
        type: 'stair',
        floor: floor.number,
        direction,
        x: details.x,
        y: details.y,
        label: details.label + ' staircase'
      });
      connect(hubId, stairId, 14);
    });

    buildingRoomPositions.forEach(room => {
      const roomId = 'room-' + floor.number + '-' + room.room;
      addNode({
        id: roomId,
        type: 'room',
        floor: floor.number,
        room: room.room,
        direction: room.direction,
        x: room.x,
        y: room.y,
        label: 'Room ' + roomLabel(floor.number, room.room)
      });
      connect(roomId, hubId, 12);
      connect(roomId, 'stair-' + room.direction + '-' + floor.number, 8);
    });

    if (floor.number > 0) {
      Object.keys(buildingDirections).forEach(direction => {
        connect('stair-' + direction + '-' + floor.number, 'stair-' + direction + '-' + (floor.number - 1), 24);
      });
    }
  });

  Object.entries(buildingDirections).forEach(([direction, details]) => {
    const exitId = 'exit-' + direction;
    const exitPosition = {
      n: {x: 50, y: 7},
      e: {x: 93, y: 50},
      s: {x: 50, y: 93},
      w: {x: 7, y: 50}
    }[direction];
    addNode({
      id: exitId,
      type: 'exit',
      floor: 0,
      direction,
      x: exitPosition.x,
      y: exitPosition.y,
      label: details.label + ' ground exit'
    });
    connect('stair-' + direction + '-0', exitId, 6);
  });

  return {nodes, edges};
}

function buildingNodeIdForZone(floor, zone) {
  return zone === 'hub' ? 'hub-' + floor : zone + '-' + floor;
}

function buildingFloorName(floor) {
  return buildingFloors.find(item => item.number === floor).label;
}

function aStarRoute(startId, targetId, blockedNodeId) {
  const {nodes, edges} = buildingGraph;
  const heuristic = nodeId => {
    const node = nodes[nodeId];
    const target = nodes[targetId];
    const horizontalDistance = Math.hypot(node.x - target.x, node.y - target.y) * 0.1;
    return horizontalDistance + Math.abs(node.floor - target.floor) * 18;
  };
  const open = [{id: startId, score: heuristic(startId)}];
  const cameFrom = {};
  const pathCost = {[startId]: 0};

  while (open.length) {
    open.sort((first, second) => first.score - second.score);
    const current = open.shift().id;
    if (current === targetId) {
      const path = [current];
      let node = current;
      while (cameFrom[node]) {
        node = cameFrom[node];
        path.unshift(node);
      }
      return {path, cost: pathCost[current]};
    }

    buildingGraph.edges[current].forEach(edge => {
      if (edge.to === blockedNodeId || current === blockedNodeId) return;
      const candidate = pathCost[current] + edge.weight;
      if (candidate < (pathCost[edge.to] ?? Infinity)) {
        cameFrom[edge.to] = current;
        pathCost[edge.to] = candidate;
        const queued = open.find(item => item.id === edge.to);
        const score = candidate + heuristic(edge.to);
        if (queued) queued.score = score;
        else open.push({id: edge.to, score});
      }
    });
  }
  return null;
}

function findBuildingRoute() {
  if (!buildingState.selectedRoomId) return null;
  const exitRoutes = Object.keys(buildingDirections)
    .map(direction => aStarRoute(buildingState.selectedRoomId, 'exit-' + direction, buildingState.hazardNodeId))
    .filter(Boolean);
  return exitRoutes.sort((first, second) => first.cost - second.cost)[0] || null;
}

function routeSteps(route) {
  if (!route) return [];
  const steps = [];
  route.path.forEach((nodeId, index) => {
    const node = buildingGraph.nodes[nodeId];
    const previous = index ? buildingGraph.nodes[route.path[index - 1]] : null;
    if (node.type === 'room') steps.push('Start in ' + node.label);
    if (node.type === 'stair' && previous && previous.type === 'room') {
      steps.push('Enter the ' + node.label);
    }
    if (node.type === 'stair' && previous && previous.type === 'stair' && node.floor < previous.floor) {
      steps.push('Descend to ' + buildingFloorName(node.floor));
    }
    if (node.type === 'exit') steps.push('Leave via the ' + node.label);
  });
  return steps;
}

function populateBuildingRoomSelect() {
  const floor = Number($('buildingFloorSelect').value);
  $('buildingRoomSelect').innerHTML = '<option value="">Choose a classroom</option>';
  buildingRoomPositions.forEach(room => {
    const option = document.createElement('option');
    option.value = 'room-' + floor + '-' + room.room;
    option.textContent = 'Room ' + roomLabel(floor, room.room);
    if (option.value === buildingState.selectedRoomId) option.selected = true;
    $('buildingRoomSelect').append(option);
  });
}

function fillBuildingControls() {
  const floorOptions = buildingFloors.map(floor => '<option value="' + floor.number + '">' + floor.label + '</option>').join('');
  $('buildingFloorSelect').innerHTML = floorOptions;
  $('hazardFloorSelect').innerHTML = floorOptions;
  $('buildingFloorSelect').value = String(buildingState.selectedFloor);
  $('hazardFloorSelect').value = String(buildingState.selectedFloor);
  populateBuildingRoomSelect();
}

function renderFloorTabs() {
  const tabs = $('floorTabs');
  tabs.innerHTML = '';
  buildingFloors.forEach(floor => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floor-tab';
    button.textContent = floor.number === 0 ? 'G' : String(floor.number);
    button.title = floor.label;
    button.setAttribute('aria-pressed', String(floor.number === buildingState.selectedFloor));
    button.addEventListener('click', () => {
      buildingState.selectedFloor = floor.number;
      $('buildingFloorSelect').value = String(floor.number);
      $('hazardFloorSelect').value = String(floor.number);
      populateBuildingRoomSelect();
      refreshBuildingCommandCenter();
    });
    tabs.append(button);
  });
}

function mapSvgElement(tag, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

function renderMultiFloorMap() {
  const map = $('multiFloorMap');
  const route = findBuildingRoute();
  const routeNodes = new Set(route ? route.path : []);
  const visibleFloor = buildingState.selectedFloor;
  const mapNodes = Object.values(buildingGraph.nodes).filter(node => node.floor === visibleFloor);
  const mapLinks = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mapLinks.setAttribute('viewBox', '0 0 100 100');
  mapLinks.classList.add('building-map-links');
  const drawn = new Set();

  map.innerHTML = '';
  buildingGraph.edges && Object.entries(buildingGraph.edges).forEach(([nodeId, edges]) => {
    const source = buildingGraph.nodes[nodeId];
    if (source.floor !== visibleFloor) return;
    edges.forEach(edge => {
      const target = buildingGraph.nodes[edge.to];
      const edgeKey = [nodeId, edge.to].sort().join(':');
      if (target.floor !== visibleFloor || drawn.has(edgeKey)) return;
      drawn.add(edgeKey);
      const line = mapSvgElement('line', {x1: source.x, y1: source.y, x2: target.x, y2: target.y});
      if (routeNodes.has(nodeId) && routeNodes.has(edge.to)) line.classList.add('route-link');
      mapLinks.append(line);
    });
  });
  map.append(mapLinks);

  mapNodes.forEach(node => {
    const element = document.createElement(node.type === 'room' ? 'button' : 'div');
    element.className = 'building-node building-node-' + node.type;
    element.style.left = node.x + '%';
    element.style.top = node.y + '%';
    element.dataset.node = node.id;
    if (routeNodes.has(node.id)) element.classList.add('on-route');
    if (node.id === buildingState.selectedRoomId) element.classList.add('current-location');
    if (node.id === buildingState.hazardNodeId) element.classList.add('restricted-zone');
    if (node.type === 'room') {
      element.type = 'button';
      element.textContent = roomLabel(node.floor, node.room);
      element.setAttribute('aria-label', 'Set location to ' + node.label);
      element.addEventListener('click', () => {
        buildingState.selectedRoomId = node.id;
        buildingState.selectedFloor = node.floor;
        $('buildingFloorSelect').value = String(node.floor);
        populateBuildingRoomSelect();
        $('buildingRoomSelect').value = node.id;
        refreshBuildingCommandCenter();
      });
    } else if (node.type === 'stair') {
      element.textContent = node.direction.toUpperCase() + ' STAIR';
    } else if (node.type === 'hub') {
      element.textContent = 'CORRIDOR';
    } else {
      element.textContent = node.direction.toUpperCase() + ' EXIT';
    }
    map.append(element);
  });

  $('floorMapTitle').textContent = buildingFloorName(visibleFloor);
  const hazardText = buildingState.hazardNodeId
    ? 'Restricted: ' + buildingGraph.nodes[buildingState.hazardNodeId].label + '. A* is rerouting around it.'
    : 'Click a classroom or use the controls to calculate a route.';
  $('floorMapLegend').textContent = hazardText;
}

function updateBuildingRoutePanel() {
  const route = findBuildingRoute();
  if (!buildingState.selectedRoomId) {
    $('buildingRouteTitle').textContent = 'Choose a classroom';
    $('buildingRouteText').textContent = 'Set the student’s current classroom to calculate the shortest safe route through a staircase to a ground-floor exit.';
    $('buildingRouteDistance').textContent = '--';
    $('buildingRouteSteps').innerHTML = '<li>Awaiting room selection</li>';
    $('mapRouteStatus').textContent = 'ROUTE READY';
    return;
  }

  if (!route) {
    $('buildingRouteTitle').textContent = 'No safe route available';
    $('buildingRouteText').textContent = 'The current restricted zone blocks every route. Clear the hazard or assign emergency staff guidance.';
    $('buildingRouteDistance').textContent = 'BLOCKED';
    $('buildingRouteSteps').innerHTML = '<li>All known routes are unavailable.</li>';
    $('mapRouteStatus').textContent = 'ROUTE BLOCKED';
    return;
  }

  const destination = buildingGraph.nodes[route.path.at(-1)];
  const startNode = buildingGraph.nodes[buildingState.selectedRoomId];
  $('buildingRouteTitle').textContent = destination.label;
  $('buildingRouteText').textContent = startNode.label + ' → ' + destination.label + '. The route avoids the restricted zone and uses the lowest-cost safe path.';
  $('buildingRouteDistance').textContent = Math.round(route.cost) + ' units';
  $('buildingRouteSteps').innerHTML = routeSteps(route).map(step => '<li>' + step + '</li>').join('');
  $('mapRouteStatus').textContent = 'A* ROUTE ACTIVE';
}

function updateFloorAlertPanel() {
  const floorName = buildingFloorName(buildingState.selectedFloor);
  $('floorAlertTitle').textContent = floorName + ' digital alert';
  $('floorAlertText').textContent = 'Ready to broadcast a training evacuation message to all occupants on ' + floorName + '.';
}

function refreshBuildingCommandCenter() {
  renderFloorTabs();
  renderMultiFloorMap();
  updateBuildingRoutePanel();
  updateFloorAlertPanel();
}

function applyBuildingLocation() {
  const selectedRoom = $('buildingRoomSelect').value;
  if (!selectedRoom) {
    $('floorMapLegend').textContent = 'Choose a classroom before calculating a route.';
    return;
  }
  buildingState.selectedRoomId = selectedRoom;
  buildingState.selectedFloor = Number($('buildingFloorSelect').value);
  refreshBuildingCommandCenter();
}

function applyBuildingHazard() {
  const floor = Number($('hazardFloorSelect').value);
  const zone = $('hazardZoneSelect').value;
  buildingState.hazardNodeId = buildingNodeIdForZone(floor, zone);
  buildingState.selectedFloor = floor;
  $('buildingFloorSelect').value = String(floor);
  populateBuildingRoomSelect();
  refreshBuildingCommandCenter();
}

function clearBuildingHazard() {
  buildingState.hazardNodeId = null;
  refreshBuildingCommandCenter();
}

function sendFloorAlert() {
  const floorName = buildingFloorName(buildingState.selectedFloor);
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  $('floorAlertStatus').textContent = 'Training alert sent at ' + time + ': “Disaster and evacuation. Please use the displayed safe route to a ground-floor exit.” This is a digital simulation only.';
  $('floorAlertStatus').classList.add('is-sent');
}

function initializeBuildingCommandCenter() {
  fillBuildingControls();
  $('buildingFloorSelect').addEventListener('change', () => {
    buildingState.selectedFloor = Number($('buildingFloorSelect').value);
    populateBuildingRoomSelect();
    refreshBuildingCommandCenter();
  });
  $('applyBuildingLocation').addEventListener('click', applyBuildingLocation);
  $('applyBuildingHazard').addEventListener('click', applyBuildingHazard);
  $('clearBuildingHazard').addEventListener('click', clearBuildingHazard);
  $('sendFloorAlert').addEventListener('click', sendFloorAlert);
  refreshBuildingCommandCenter();
}

function bfs(from) {
  const destination = targetExit();
  const queue = [from];
  const visited = new Set([key(from.x, from.y)]);
  const parent = {};

  while (queue.length) {
    const current = queue.shift();
    if (samePoint(current, destination)) {
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
  const path = bfs(player);
  const pathKeys = new Set(path.map(point => key(point.x, point.y)));

  layout.forEach((row, y) => [...row].forEach((type, x) => {
    const cell = document.createElement('div');
    cell.className = 'cell ' + (type === 'W' ? 'wall' : type === 'C' ? 'corridor' : 'room');
    if (roomLabels[key(x, y)]) cell.dataset.label = roomLabels[key(x, y)];
    if (samePoint({x, y}, activeScenario.hazard)) {
      cell.classList.add('hazard', 'hazard-' + activeScenario.color);
      cell.dataset.icon = activeScenario.mapIcon;
      cell.dataset.label = activeScenario.mapLabel;
    }
    if (samePoint({x, y}, activeScenario.blocked)) cell.classList.add('blocked');
    if (pathKeys.has(key(x, y)) && !samePoint({x, y}, player)) cell.classList.add('route');
    const exit = exits.find(item => item.x === x && item.y === y);
    if (exit) {
      cell.classList.add('exit');
      if (exit.name === activeScenario.recommendedExit) cell.classList.add('recommended-exit');
    }
    if (samePoint({x, y}, player)) {
      cell.classList.add('player');
      cell.innerHTML = '<span class="player-token"></span>';
    }
    map.append(cell);
  }));

  $('pathLength').textContent = path.length ? Math.max(path.length - 1, 0) + ' steps' : 'No safe path';
  $('routeStatus').textContent = path.length ? 'SAFE ROUTE' : 'NO ROUTE';
  const startingSteps = Math.max(bfs(start).length - 1, 1);
  const travelled = Math.min(100, Math.round(moves / startingSteps * 100));
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
  const directions = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
  const [dx, dy] = directions[direction];
  const next = {x: player.x + dx, y: player.y + dy};

  if (!walkable(next.x, next.y)) {
    mistakes++;
    $('score').innerHTML = Math.max(0, 100 - mistakes * 8) + ' <small>/ 100</small>';
    $('guidanceTitle').textContent = 'Route unavailable';
    $('guidanceText').textContent = 'That direction is unsafe or blocked. Recalculate and follow the highlighted path.';
    return;
  }

  player = next;
  moves++;
  renderMap();
  const exit = exits.find(item => samePoint(item, player));
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
    $('guidanceText').textContent = activeScenario.unsafeGuidance;
  } else {
    choseSafe = true;
    $('guidanceTitle').textContent = 'Good decision';
    $('guidanceText').textContent = activeScenario.safeGuidance;
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
    ? activeScenario.shortName + ' complete. Review your route choices to improve.'
    : 'Excellent work - you made every safety-critical choice.';
  $('routeStatus').textContent = 'EVACUATED';
  $('guidanceTitle').textContent = 'Evacuation complete';
  $('guidanceText').textContent = 'You safely reached ' + exit.name + '. Your result has been recorded.';
  $('progress').style.width = '100%';
  $('progressText').textContent = '100% EVACUATED';
  $('resultModal').hidden = false;
  saveResult({time, score, mistakes, scenario: activeScenario.title, date: new Date().toLocaleDateString()});
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
      scenario: activeScenario.title,
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
      scenario: result.scenario,
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
    chart.append(svgNode('line', {x1: bounds.left, y1: y(score), x2: width - bounds.right, y2: y(score), class: 'chart-grid-line'}));
    chart.append(svgNode('text', {x: bounds.left - 11, y: y(score) + 4, class: 'chart-axis-label', 'text-anchor': 'end'}, String(score)));
  });

  const points = results.map((result, index) => x(index) + ',' + y(result.score)).join(' ');
  const areaPoints = bounds.left + ',' + (height - bounds.bottom) + ' ' + points + ' ' + (width - bounds.right) + ',' + (height - bounds.bottom);
  chart.append(svgNode('polygon', {points: areaPoints, class: 'chart-area'}));
  chart.append(svgNode('polyline', {points, class: 'chart-line'}));

  results.forEach((result, index) => {
    const point = svgNode('circle', {cx: x(index), cy: y(result.score), r: 5, class: 'chart-point'});
    point.append(svgNode('title', {}, 'Drill ' + (index + 1) + ': ' + result.score + ' out of 100'));
    chart.append(point);
    chart.append(svgNode('text', {x: x(index), y: height - 15, class: 'chart-axis-label', 'text-anchor': 'middle'}, 'Drill ' + (index + 1)));
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
    $('insightText').textContent = 'Complete any scenario, then return here to review your safety decisions and evacuation efficiency.';
    $('focusText').textContent = 'Select a scenario, follow the highlighted route, and make the safer decision.';
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
  $('drillContext').textContent = total === 1 ? 'First recorded attempt' : 'Across all scenarios';
  $('scoreContext').textContent = average >= 85 ? 'Strong safety performance' : 'Room to strengthen decisions';
  $('bestContext').textContent = best === 100 ? 'Perfect safety record achieved' : 'Your current personal best';
  $('timeContext').textContent = safest === 0 ? 'Achieved with no mistakes' : 'Keep safety ahead of speed';
  $('chartTrend').textContent = scoreChange > 0 ? '+' + scoreChange + ' points since first drill' : scoreChange < 0 ? scoreChange + ' points since first drill' : 'Steady performance';

  if (average >= 90 && safest === 0) {
    $('insightTitle').textContent = 'Safe choices are becoming a habit';
    $('insightText').textContent = 'Your recent attempts show strong route awareness and reliable hazard avoidance across scenarios.';
    $('focusText').textContent = 'Maintain route accuracy while working on a calmer, faster evacuation.';
  } else if (average >= 75) {
    $('insightTitle').textContent = 'You are building reliable evacuation habits';
    $('insightText').textContent = 'Your performance is on track. Small route and decision improvements can lift your score further.';
    $('focusText').textContent = safest > 0 ? 'Avoid hazard and blocked-route penalties before trying to reduce time.' : 'Try another scenario and aim to improve your evacuation time safely.';
  } else {
    $('insightTitle').textContent = 'Review the safe route before speed';
    $('insightText').textContent = 'Your score suggests that hazards or blocked routes are creating avoidable mistakes.';
    $('focusText').textContent = 'Use the route guidance, identify the current hazard, and choose the safer response.';
  }

  $('analyticsHistory').innerHTML = results.map((result, index) =>
    '<li><span class="attempt-index">#' + (total - index) + '</span><span class="attempt-date">' + (result.scenario || 'Fire drill') + '<small>' + result.date + '</small></span><span class="attempt-time">' + result.time + '</span><span class="attempt-mistakes">' + result.mistakes + ' mistakes</span><b>' + result.score + '/100</b></li>'
  ).join('');
  renderPerformanceChart(orderedResults);
}

function showAnalytics() {
  if (!currentUser) return;
  $('resultModal').hidden = true;
  hideScenarioPicker();
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

function renderScenarioOptions() {
  const options = $('scenarioOptions');
  options.innerHTML = '';
  Object.values(scenarios).forEach(scenario => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scenario-option scenario-' + scenario.color;
    button.dataset.scenario = scenario.id;
    button.setAttribute('aria-pressed', String(scenario.id === activeScenario.id));
    button.innerHTML = '<span class="scenario-icon">' + scenario.icon + '</span><span class="scenario-option-copy"><strong>' + scenario.shortName + '</strong><small>' + scenario.title + '</small></span><span class="scenario-option-route">' + scenario.recommendedExit + '</span>';
    button.addEventListener('click', () => selectScenario(scenario.id));
    options.append(button);
  });
}

function showScenarioPicker() {
  if (!currentUser) return;
  $('resultModal').hidden = true;
  $('scenarioModal').hidden = false;
  document.body.classList.add('scenario-open');
  renderScenarioOptions();
}

function hideScenarioPicker() {
  $('scenarioModal').hidden = true;
  document.body.classList.remove('scenario-open');
}

function selectScenario(scenarioId) {
  activeScenario = scenarios[scenarioId];
  updateScenarioUI();
  hideScenarioPicker();
  showSimulator();
  reset();
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
  $('guidanceTitle').textContent = 'Take ' + activeScenario.recommendedExit;
  $('guidanceText').textContent = activeScenario.routeText;
  $('resultModal').hidden = true;
  document.querySelectorAll('[data-decision]').forEach(button => {
    button.disabled = false;
    button.classList.remove('selected');
  });
  renderMap();
}

document.addEventListener('keydown', event => {
  if (!$('authModal').hidden || !$('scenarioModal').hidden) return;
  const movesByKey = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'};
  if (movesByKey[event.key]) {
    event.preventDefault();
    move(movesByKey[event.key]);
  }
});

document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.move)));
document.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', () => decide(button.dataset.decision, button)));
$('restartButton').addEventListener('click', reset);
$('newDrillButton').addEventListener('click', showScenarioPicker);
$('clearHistory').addEventListener('click', clearHistory);
$('selectDrillButton').addEventListener('click', showScenarioPicker);
$('closeScenarioPicker').addEventListener('click', hideScenarioPicker);
$('analyticsButton').addEventListener('click', showAnalytics);
$('backToSimulator').addEventListener('click', showSimulator);
$('authForm').addEventListener('submit', submitAuth);
$('authSwitch').addEventListener('click', () => setAuthMode($('authForm').dataset.mode === 'login' ? 'register' : 'login'));
$('demoButton').addEventListener('click', continueAsDemo);
$('logoutButton').addEventListener('click', logout);

updateProfile();
updateScenarioUI();
renderHistory();
reset();
initializeBuildingCommandCenter();
if (currentUser) {
  hideAuth();
  loadRemoteHistory();
} else {
  clearInterval(timerId);
  showAuth('login');
}
