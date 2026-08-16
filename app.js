const STORAGE_KEY = 'scorekeep-game-v1';
const PEOPLE_KEY = 'scorekeep-people-v1';

const $ = (id) => document.getElementById(id);
const setupView = $('setupView');
const gameView = $('gameView');
const winnerView = $('winnerView');
const playersList = $('playersList');
const savedPeopleEl = $('savedPeople');
const savedPeopleGroup = $('savedPeopleGroup');
const scoreInputs = $('scoreInputs');
const standings = $('standings');
const history = $('history');
const historyCard = $('historyCard');

let game = loadGame();
let savedPeople = loadPeople();
let editingRound = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function defaultGame() {
  return { status: 'setup', players: [], roundCount: 13, winMode: 'low', rounds: [] };
}

function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultGame();
  } catch {
    return defaultGame();
  }
}

function loadPeople() {
  try {
    const people = JSON.parse(localStorage.getItem(PEOPLE_KEY));
    return Array.isArray(people) ? people : [];
  } catch {
    return [];
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
}

function savePeople() {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(savedPeople));
}

function currentPlayerNames() {
  return [...document.querySelectorAll('.player-name')]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function addPlayerInput(name = '') {
  const row = document.createElement('div');
  row.className = 'player-row';
  row.innerHTML = `
    <input class="player-name" type="text" maxlength="30" placeholder="Player name" value="${escapeHtml(name)}" />
    <button class="remove-player" type="button" aria-label="Remove player">×</button>`;
  row.querySelector('.remove-player').addEventListener('click', () => {
    if (playersList.children.length > 2) {
      row.remove();
    } else {
      row.querySelector('.player-name').value = '';
    }
    renderSavedPeople();
  });
  row.querySelector('.player-name').addEventListener('input', renderSavedPeople);
  playersList.appendChild(row);
  renderSavedPeople();
}

function renderSavedPeople() {
  savedPeopleGroup.classList.toggle('hidden', savedPeople.length === 0);
  const activeNames = currentPlayerNames().map((name) => name.toLowerCase());

  savedPeopleEl.innerHTML = savedPeople.map((name) => {
    const isAdded = activeNames.includes(name.toLowerCase());
    return `
      <span class="saved-person${isAdded ? ' is-added' : ''}">
        <button class="quick-add-person" type="button" data-name="${escapeHtml(name)}" ${isAdded ? 'disabled' : ''}>${escapeHtml(name)}</button>
        <button class="delete-person" type="button" data-name="${escapeHtml(name)}" aria-label="Delete ${escapeHtml(name)}">×</button>
      </span>`;
  }).join('');

  savedPeopleEl.querySelectorAll('.quick-add-person').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.name;
      const emptyInput = [...document.querySelectorAll('.player-name')].find((input) => !input.value.trim());
      if (emptyInput) {
        emptyInput.value = name;
        renderSavedPeople();
      } else {
        addPlayerInput(name);
      }
    });
  });

  savedPeopleEl.querySelectorAll('.delete-person').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.name;
      savedPeople = savedPeople.filter((person) => person !== name);
      savePeople();
      renderSavedPeople();
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function totals() {
  return game.players.map((player) => ({
    ...player,
    total: game.rounds.reduce((sum, round) => sum + Number(round.scores[player.id] ?? 0), 0),
  }));
}

function rankedPlayers() {
  return totals().sort((a, b) => game.winMode === 'low' ? a.total - b.total : b.total - a.total);
}

function renderStandings(target = standings) {
  target.innerHTML = rankedPlayers().map((player, index) => `
    <div class="standing-row">
      <span class="rank">${index + 1}</span>
      <strong>${escapeHtml(player.name)}</strong>
      <span class="total">${player.total}</span>
    </div>`).join('');
}

function renderHistory() {
  historyCard.classList.toggle('hidden', game.rounds.length === 0);
  history.innerHTML = game.rounds.map((round, index) => `
    <div class="history-round">
      <div class="history-round-head">
        <strong>Round ${index + 1}</strong>
        <button class="edit-round" type="button" data-round="${index}">Edit</button>
      </div>
      ${game.players.map((player) => `
        <div class="history-row"><span>${escapeHtml(player.name)}</span><strong>${round.scores[player.id]}</strong></div>`).join('')}
    </div>`).join('');

  history.querySelectorAll('.edit-round').forEach((button) => {
    button.addEventListener('click', () => {
      editingRound = Number(button.dataset.round);
      renderGame();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function renderScoreInputs(roundIndex) {
  const isEditing = editingRound !== null;
  const existing = isEditing ? (game.rounds[roundIndex]?.scores || {}) : {};

  scoreInputs.innerHTML = game.players.map((player) => `
    <label class="score-entry">
      <strong>${escapeHtml(player.name)}</strong>
      <input type="number" inputmode="numeric" step="1" autocomplete="off" data-player="${player.id}" value="${isEditing ? (existing[player.id] ?? '') : ''}" placeholder="0" aria-label="${escapeHtml(player.name)} score" />
    </label>`).join('');

  if (!isEditing) {
    scoreInputs.querySelectorAll('input[data-player]').forEach((input) => {
      input.value = '';
    });
  }
}

function renderGame() {
  setupView.classList.add('hidden');
  winnerView.classList.add('hidden');
  gameView.classList.remove('hidden');

  const roundIndex = editingRound ?? game.rounds.length;
  $('roundTitle').textContent = editingRound === null ? `Round ${roundIndex + 1} of ${game.roundCount}` : `Edit round ${roundIndex + 1}`;
  $('saveRoundBtn').textContent = editingRound === null ? (roundIndex + 1 === game.roundCount ? 'Finish game' : 'Save round') : 'Save changes';
  $('modeLabel').textContent = game.winMode === 'low' ? 'Lowest wins' : 'Highest wins';
  renderScoreInputs(roundIndex);
  renderStandings();
  renderHistory();
}

function renderWinner() {
  setupView.classList.add('hidden');
  gameView.classList.add('hidden');
  winnerView.classList.remove('hidden');
  const ranking = rankedPlayers();
  const winningScore = ranking[0]?.total ?? 0;
  const winners = ranking.filter((player) => player.total === winningScore);
  $('winnerTitle').textContent = winners.length > 1 ? `${winners.map((p) => p.name).join(' & ')} tie!` : `${winners[0]?.name ?? ''} wins!`;
  $('winnerScore').textContent = `${winningScore} points · ${game.winMode === 'low' ? 'lowest' : 'highest'} score wins`;
  renderStandings($('finalStandings'));
}

function renderSetup() {
  gameView.classList.add('hidden');
  winnerView.classList.add('hidden');
  setupView.classList.remove('hidden');
  playersList.innerHTML = '';
  const names = game.players.length ? game.players.map((p) => p.name) : ['', ''];
  names.forEach(addPlayerInput);
  $('roundCount').value = game.roundCount || 13;
  $('winMode').value = game.winMode || 'low';
  renderSavedPeople();
}

function render() {
  if (game.status === 'playing') renderGame();
  else if (game.status === 'finished') renderWinner();
  else renderSetup();
}

$('addPlayerBtn').addEventListener('click', () => addPlayerInput());

$('savePeopleBtn').addEventListener('click', () => {
  const names = currentPlayerNames();
  if (!names.length) return;

  names.forEach((name) => {
    if (!savedPeople.some((person) => person.toLowerCase() === name.toLowerCase())) {
      savedPeople.push(name);
    }
  });

  savedPeople.sort((a, b) => a.localeCompare(b));
  savePeople();
  renderSavedPeople();
});

$('startGameBtn').addEventListener('click', () => {
  const names = currentPlayerNames();
  if (names.length < 2) return alert('Add at least two players.');
  const roundCount = Math.max(1, Math.min(50, Number($('roundCount').value) || 1));
  game = {
    status: 'playing',
    players: names.map((name) => ({ id: uid(), name })),
    roundCount,
    winMode: $('winMode').value,
    rounds: [],
  };
  editingRound = null;
  saveGame();
  render();
});

$('saveRoundBtn').addEventListener('click', () => {
  const inputs = [...scoreInputs.querySelectorAll('input[data-player]')];
  if (inputs.some((input) => input.value.trim() === '')) return alert('Enter a score for every player.');
  const scores = Object.fromEntries(inputs.map((input) => [input.dataset.player, Number(input.value)]));

  if (editingRound !== null) {
    game.rounds[editingRound] = { scores };
    editingRound = null;
  } else {
    game.rounds.push({ scores });
    if (game.rounds.length >= game.roundCount) game.status = 'finished';
  }
  saveGame();
  render();
});

function confirmNewGame() {
  if (!confirm('Start a new game? Current scores will be cleared.')) return;
  game = defaultGame();
  editingRound = null;
  saveGame();
  render();
}

$('newGameBtn').addEventListener('click', confirmNewGame);
$('freshGameBtn').addEventListener('click', confirmNewGame);

$('playAgainBtn').addEventListener('click', () => {
  game = { ...game, status: 'playing', rounds: [] };
  editingRound = null;
  saveGame();
  render();
});

render();
