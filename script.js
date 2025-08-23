(() => {
  // i18n
  const translations = {
    ru: {
      title: "Матрёшки",
      startBtn: "Начать",
      rulesBtn: "Правила",
      backBtn: "Назад",
      resetBtn: "Сброс",
      undoBtn: "Отменить ход",
      rulesTitle: "Правила",
      currentPlayer: "Игрок: ",
      rules:
        "Игроки ходят по очереди. Фигуру можно ставить на пустую клетку или поверх меньшей (включая вражеские). Нельзя ставить на такую же или большую. Каждая фигура используется один раз. Победа — линия из трёх своих фигур по горизонтали, вертикали или диагонали. Ничья — если фигуры закончились без победителя.",
      win: "Игрок %d победил!",
      draw: "Ничья!",
      noMove: "Нет доступных ходов. Ход переходит сопернику."
    },
    en: {
      title: "Matryoshkas",
      startBtn: "Start",
      rulesBtn: "Rules",
      backBtn: "Back",
      resetBtn: "Reset",
      undoBtn: "Undo",
      rulesTitle: "Rules",
      currentPlayer: "Player: ",
      rules:
        "Players take turns. A piece can be placed on an empty cell or over a smaller one (including opponent's). You cannot place on the same or larger size. Each piece is used once. Win by aligning three of your pieces horizontally, vertically, or diagonally. Draw if all pieces are used with no winner.",
      win: "Player %d wins!",
      draw: "Draw!",
      noMove: "No legal moves. Turn passes to the opponent."
    }
  };

  // Game state
  let state = {
    board: Array(9).fill(null), // null | { player: 1|2, size: 1..5 }
    currentPlayer: 1,
    pieces: { 1: [1, 2, 3, 4, 5], 2: [1, 2, 3, 4, 5] },
    lang: localStorage.getItem("matryoshkas.lang") || "ru"
  };

  let selectedPiece = null;
  const history = []; // stack of previous states for undo

  // Helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function cloneState() {
    return JSON.parse(JSON.stringify(state));
  }

  function getSvgPath(player, size) {
    const color = player === 1 ? "black" : "purple";
    return `svg/${color}_${size}.svg`;
  }

  function preloadAssets() {
    [1, 2, 3, 4, 5].forEach((s) => {
      [1, 2].forEach((p) => {
        const img = new Image();
        img.src = getSvgPath(p, s);
      });
    });
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    // Bind events
    $("#start-game-btn").addEventListener("click", startGame);
    $("#back-to-menu").addEventListener("click", backToMenu);
    $("#rules-btn").addEventListener("click", showRules);
    $("#close-modal").addEventListener("click", hideRules);
    $("#rules-modal").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) hideRules();
    });
    $("#language-switcher").addEventListener("change", (e) => {
      state.lang = e.target.value;
      localStorage.setItem("matryoshkas.lang", state.lang);
      updateUI();
    });
    $("#reset-btn").addEventListener("click", resetGame);
    $("#undo-btn").addEventListener("click", undoMove);

    // Initial UI
    updateUI();
    initBoard();
    preloadAssets();

    // Telegram Web App
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  });

  // Screens
  function startGame() {
    $("#main-menu").classList.add("hidden");
    $("#game-container").classList.remove("hidden");
    $("#game-container").classList.add("show");
    resetGame(); // начать чистую партию
  }

  function backToMenu() {
    $("#game-container").classList.remove("show");
    $("#game-container").classList.add("hidden");
    $("#main-menu").classList.remove("hidden");
  }

  // Board
  function initBoard() {
    const boardEl = $("#game-board");
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = String(i);
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", handleCellClick);
      boardEl.appendChild(cell);
    }
    renderBoard();
  }

  function renderBoard() {
    $$("#game-board .cell").forEach((cell) => {
      const i = Number(cell.dataset.index);
      const top = state.board[i];
      cell.innerHTML = "";
      if (top) {
        const img = document.createElement("img");
        img.src = getSvgPath(top.player, top.size);
        img.alt = "Matryoshka";
        img.className = "board-piece placed";
        cell.appendChild(img);
      }
    });
  }

  // UI
  function updateUI() {
    const t = translations[state.lang];
    document.title = t.title;
    $("#title-text").textContent = t.title;
    $("#header-title").textContent = t.title;
    $("#start-game-btn").textContent = t.startBtn;
    $("#rules-btn").textContent = t.rulesBtn;
    $("#back-to-menu").textContent = t.backBtn;
    $("#reset-btn").textContent = t.resetBtn;
    $("#undo-btn").textContent = t.undoBtn;
    $("#rules-title").textContent = t.rulesTitle;
    $("#rules-text").textContent = t.rules;
    $("#current-player").textContent = t.currentPlayer + state.currentPlayer;

    // rebuild pieces area for the current player
    updatePieces();

    // enable/disable undo
    $("#undo-btn").disabled = history.length === 0;
  }

  function canPlace(size) {
    // Можно ходить, если есть пустая клетка или клетка с меньшей верхней фигурой
    if (state.board.some((cell) => cell === null)) return true;
    return state.board.some((cell) => cell && cell.size < size);
  }

  function updatePieces() {
    const wrap = $("#player-pieces");
    wrap.innerHTML = "";
    state.pieces[state.currentPlayer].forEach((size) => {
      const img = document.createElement("img");
      img.src = getSvgPath(state.currentPlayer, size);
      img.alt = "Matryoshka";
      img.className = "piece-img";
      img.dataset.size = String(size);
      if (!canPlace(size)) {
        img.classList.add("disabled");
        img.setAttribute("aria-disabled", "true");
      }
      img.addEventListener("click", (e) => {
        if (img.classList.contains("disabled")) return;
        $$(".piece-img").forEach((p) => p.classList.remove("selected"));
        img.classList.add("selected");
        selectPiece(size);
      });
      wrap.appendChild(img);
    });
  }

  function selectPiece(size) {
    selectedPiece = size;
  }

  function handleCellClick(e) {
    if (!selectedPiece) return;
    const index = Number(e.currentTarget.dataset.index);
    const current = state.board[index];

    if (!current || current.size < selectedPiece) {
      // Save history for undo
      history.push(cloneState());

      // Place piece
      state.board[index] = { player: state.currentPlayer, size: selectedPiece };
      state.pieces[state.currentPlayer] = state.pieces[state.currentPlayer].filter(
        (s) => s !== selectedPiece
      );

      selectedPiece = null;
      renderBoard();

      // Check win/draw, then switch player
      if (checkWin()) return; // game reset inside

      // Pass turn
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;

      // If new player has zero legal moves, auto-pass back
      if (!playerHasAnyMove(state.currentPlayer)) {
        alert(translations[state.lang].noMove);
        state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
      }

      updateUI();
    }
  }

  function playerHasAnyMove(player) {
    // If player has no pieces, no moves
    if (state.pieces[player].length === 0) return false;
    // If empty cells exist, move is possible
    if (state.board.some((c) => c === null)) return true;
    // Otherwise check if any piece can cover a smaller top
    return state.pieces[player].some((size) =>
      state.board.some((c) => c && c.size < size)
    );
  }

  function checkWin() {
    const t = translations[state.lang];
    const L = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];

    for (const [a, b, c] of L) {
      const A = state.board[a], B = state.board[b], C = state.board[c];
      if (A && B && C && A.player === B.player && B.player === C.player) {
        setTimeout(() => {
          alert(t.win.replace("%d", String(A.player)));
          resetGame();
        }, 0);
        return true;
      }
    }

    // Draw when both players have no pieces or no legal moves
    const noPieces = state.pieces[1].length === 0 && state.pieces[2].length === 0;
    const noMoves = !playerHasAnyMove(1) && !playerHasAnyMove(2);
    if (noPieces || noMoves) {
      setTimeout(() => {
        alert(t.draw);
        resetGame();
      }, 0);
      return true;
    }
    return false;
  }

  function resetGame() {
    state.board = Array(9).fill(null);
    state.currentPlayer = 1;
    state.pieces = { 1: [1, 2, 3, 4, 5], 2: [1, 2, 3, 4, 5] };
    selectedPiece = null;
    history.length = 0;
    initBoard();
    updateUI();
  }

  function undoMove() {
    if (history.length === 0) return;
    state = history.pop();
    selectedPiece = null;
    renderBoard();
    updateUI();
  }

  // Rules modal
  function showRules() {
    $("#rules-modal").classList.remove("hidden");
  }
  function hideRules() {
    $("#rules-modal").classList.add("hidden");
  }
})();
