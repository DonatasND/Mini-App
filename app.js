let tg = null;
let user = null;
let currentSection = "home";

const MATCH_ROUNDS = 3;
const LINES_PER_ROUND = 7;

const PRESTART_COUNTDOWN_SEC = 3;
const INTER_ROUND_COUNTDOWN_SEC = 3;
const MAX_ERRORS_PER_ROUND = 10;

const ratingState = {
  current: 1240,
  lastSeason: 1180
};

const playerState = {
  bpLevel: 4,
  bpProgressPct: 60,
  bpXpToNext: 80
};

const playerStats = {
  pvp: { games: 120, wins: 68 },
  pve: { games: 45, wins: 39 },
  typing: { speed: 320, accuracy: 94 }
};

const prizePoolState = {
  monthTitle: "Март",
  totalStars: 3750,
  dailyFundPart: "10% турнирных матчей",
  passFundPart: "20% оплаты боевого пропуска"
};

const monthlyTop10 = [
  { place: 1, name: "StarLord",   score: 2200 },
  { place: 2, name: "TapMaster",  score: 1950 },
  { place: 3, name: "FundFarmer", score: 1780 },
  { place: 4, name: "ComboKing",  score: 1600 },
  { place: 5, name: "DailyGrinder", score: 1500 },
  { place: 6, name: "RiskTaker",  score: 1420 },
  { place: 7, name: "ClutchPlayer", score: 1350 },
  { place: 8, name: "LateGame",   score: 1275 },
  { place: 9, name: "TapEnjoyer", score: 1190 },
  { place:10, name: "You",        score: 0 }
];

const achievementsUnlocked = [
  { title: "Первый матч", desc: "Сыграть 1 любой матч." },
  { title: "Первые победы", desc: "Выиграть 5 PvP матчей." },
  { title: "Не сдаюсь", desc: "Вернуться после 3 поражений подряд." }
];

const achievementsLocked = [
  { title: "Железный гриндер", desc: "Играть 30 дней подряд без пропусков." },
  { title: "Топ месяца", desc: "Войти в топ-3 по призовому фонду." },
  { title: "PvE мастер", desc: "Выиграть много PvE матчей за звёзды." }
];

const recentMatches = [
  {
    mode: "PvP дуэль",
    result: "win",
    desc: "Победа по времени, соперник отстал на 3.2 с",
    ago: "5 мин назад"
  },
  {
    mode: "Тренировка с ботом",
    result: "lose",
    desc: "Лимит ошибок в 3 раунде",
    ago: "32 мин назад"
  },
  {
    mode: "PvE за звёзды",
    result: "win",
    desc: "Чистая победа без ошибок",
    ago: "Вчера"
  },
  {
    mode: "PvP дуэль",
    result: "lose",
    desc: "Проигрыш в финальной строке",
    ago: "2 дня назад"
  }
];

let activeGameTimer = null;
let preStartTimer = null;
let activeGameState = null;
let inputEnabled = false;

/* HAPTIC */

function triggerKeyHaptics() {
  try {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      const h = window.Telegram.WebApp.HapticFeedback;
      if (typeof h.impactOccurred === "function") {
        h.impactOccurred("light");
      }
    }
    if (window.navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(15);
    }
  } catch (e) {}
}

/* NAV */

function hideBottomNav() {
  const nav = document.querySelector(".bottom-nav");
  if (nav) nav.classList.add("nav-buttons-hidden");
}

function showBottomNav() {
  const nav = document.querySelector(".bottom-nav");
  if (nav) nav.classList.remove("nav-buttons-hidden");
}

/* НОРМАЛИЗАЦИЯ */

function normalizeChar(ch) {
  if (!ch) return "";
  let c = String(ch).toLowerCase();
  if (c === "ё") c = "е";
  return c;
}

function isSameChar(a, b) {
  return normalizeChar(a) === normalizeChar(b);
}

function normalizeText(str) {
  return (str || "")
    .split("")
    .map(normalizeChar)
    .join("");
}

function isSameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

/* INIT */

document.addEventListener("DOMContentLoaded", () => {
  initTelegram();
  initUI();
  renderSection("home");
});

function hideSplashSoon() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("splash-hide");
  }, 1200);
}

function initTelegram() {
  tg = window.Telegram?.WebApp || null;

  const nameEl = document.getElementById("profile-name");
  const avatarEl = document.getElementById("profile-avatar");

  if (!tg) {
    nameEl.textContent = "Локальный режим";
    avatarEl.textContent = "L";
    updateRatingHeader();
    hideSplashSoon();
    return;
  }

  tg.ready();
  tg.expand();

  try {
    tg.requestFullscreen?.();
    tg.setHeaderColor?.("bg_color");
    tg.setHeaderColor?.("#00000000");
    tg.setBackgroundColor?.("#05060a");
  } catch (e) {}

  user = tg.initDataUnsafe?.user || null;

  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    nameEl.textContent = fullName || `ID: ${user.id}`;
    const letter =
      (user.first_name?.[0] ||
        user.last_name?.[0] ||
        user.username?.[0] ||
        "?").toUpperCase();
    avatarEl.textContent = letter;
  } else {
    nameEl.textContent = "Гость";
    avatarEl.textContent = "?";
  }

  tg.MainButton.hide();
  updateRatingHeader();
  hideSplashSoon();
}

function updateRatingHeader() {
  const currEl = document.getElementById("rating-current");
  const lastEl = document.getElementById("rating-last");
  if (currEl) currEl.textContent = ratingState.current;
  if (lastEl) lastEl.textContent = `прошл. сезон: ${ratingState.lastSeason}`;
}

function initUI() {
  document.getElementById("profile-pill").addEventListener("click", () => {
    stopActiveGame();
    currentSection = "profile";
    renderProfile();
  });

  document.querySelectorAll(".nav-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (!section) return;
      setActiveNav(section);
      renderSection(section);
    });
  });

  const fundLabel = document.getElementById("fund-label");
  if (fundLabel) {
    fundLabel.textContent = `Фонд: ${prizePoolState.totalStars}★`;
  }
}

function setActiveNav(section) {
  currentSection = section;
  document.querySelectorAll(".nav-pill").forEach((b) =>
    b.classList.toggle("nav-pill-active", b.dataset.section === section)
  );
  tg?.MainButton?.hide();
}

/* игра — стоп */

function stopActiveGame() {
  if (activeGameTimer) {
    clearInterval(activeGameTimer);
    activeGameTimer = null;
  }
  if (preStartTimer) {
    clearInterval(preStartTimer);
    preStartTimer = null;
  }
  activeGameState = null;
  inputEnabled = false;
  document.body.classList.remove("in-game");
}

/* РЕНДЕР */

function renderSection(section) {
  const card = document.getElementById("main-card");
  if (!card) return;

  stopActiveGame();
  showBottomNav();
  card.classList.remove("game-mode");

  let html = "";

  if (section === "home") {
    html = renderBattlePassIsland() + renderHomeContent();
  } else if (section === "challenges") {
    html = renderChallengesContent();
  } else if (section === "fund") {
    html = renderFundContent();
  }

  card.innerHTML = html;

  attachHomeHandlers();
  attachChallengeHandlers();
  attachFundHandlers();
}

/* Профиль */

function renderProfile() {
  const card = document.getElementById("main-card");
  if (!card) return;

  stopActiveGame();
  showBottomNav();
  card.classList.remove("game-mode");

  const pvpGames = playerStats.pvp.games;
  const pvpWins = playerStats.pvp.wins;
  const pveGames = playerStats.pve.games;
  const pveWins = playerStats.pve.wins;

  const pvpWinrate = pvpGames ? Math.round((pvpWins / pvpGames) * 100) : 0;
  const pveWinrate = pveGames ? Math.round((pveWins / pveGames) * 100) : 0;

  card.innerHTML = `
    <div class="content-block">
      <div class="section-label">Профиль</div>

      <div class="profile-character">
        <div class="character-frame">
          <div class="character-placeholder">
            Здесь будет анимированный персонаж<br/>
            (WebGL / видео / аним. стикер)
          </div>
        </div>
      </div>

      <div class="profile-section-label" style="margin-top:12px;">Последние матчи</div>
      <div class="list-rows">
        ${recentMatches
          .slice(0, 4)
          .map((m) => {
            const tagText = m.result === "win" ? "Победа" : "Поражение";
            const tagEmoji = m.result === "win" ? "✅" : "❌";
            return `
              <div class="row-item">
                <div class="row-main">
                  <div class="row-title">${m.mode}</div>
                  <div class="row-sub">${m.desc} • ${m.ago}</div>
                </div>
                <div class="row-tag">${tagEmoji} ${tagText}</div>
              </div>
            `;
          })
          .join("")}
      </div>

      <div class="profile-section-label" style="margin-top:12px;">Статистика матчей</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">PvP матчи</div>
          <div class="stat-value">${pvpWins} / ${pvpGames}</div>
          <div class="stat-sub">Победы / сыграно • ${pvpWinrate}% винрейт</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">PvE матчи</div>
          <div class="stat-value">${pveWins} / ${pveGames}</div>
          <div class="stat-sub">Победы / сыграно • ${pveWinrate}% винрейт</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Скорость ввода</div>
          <div class="stat-value">${playerStats.typing.speed}</div>
          <div class="stat-sub">симв/мин (средняя скорость нажатия)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Точность ввода</div>
          <div class="stat-value">${playerStats.typing.accuracy}%</div>
          <div class="stat-sub">точность по всем матчам</div>
        </div>
      </div>

      <div class="profile-section-label" style="margin-top:12px;">Витрина достижений</div>
      <div class="showcase-grid">
        ${achievementsUnlocked
          .slice(0, 3)
          .map(
            (a) => `
          <div class="showcase-card">
            <div class="showcase-title">${a.title}</div>
            <div class="showcase-sub">${a.desc}</div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="profile-ach-header">
        <div class="profile-section-label">Достижения</div>
        <button class="profile-ach-link" id="btn-achievements-all">Показать все</button>
      </div>

      <div class="section-label" style="margin-top:6px;">Открытые</div>
      <div class="list-rows">
        ${achievementsUnlocked
          .map(
            (a) => `
          <div class="row-item">
            <div class="row-main">
              <div class="row-title">${a.title}</div>
              <div class="row-sub">${a.desc}</div>
            </div>
            <div class="row-tag">Разблокировано</div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="section-label" style="margin-top:10px;">Ближайшие цели</div>
      <div class="list-rows">
        ${achievementsLocked
          .map(
            (a, idx) => `
          <div class="row-item">
            <div class="row-main">
              <div class="row-title">${a.title}</div>
              <div class="row-sub">${a.desc}</div>
            </div>
            <div class="row-tag">
              ${idx === 0 ? "Ближайшая цель" : "Заблокировано"}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  const allBtn = document.getElementById("btn-achievements-all");
  if (allBtn && tg) {
    allBtn.onclick = () => {
      const all = [...achievementsUnlocked, ...achievementsLocked];
      const text = all
        .map((a, idx) => `${idx + 1}. ${a.title} — ${a.desc}`)
        .join("\n");

      tg.showPopup?.({
        title: "Все достижения",
        message:
          text ||
          "Пока достижений нет. Они появятся, когда игрок начнет играть.",
        buttons: [{ id: "ok", type: "close", text: "Окей" }]
      });
    };
  }
}

/* BP */

function renderBattlePassIsland() {
  const pct = Math.max(0, Math.min(100, playerState.bpProgressPct));
  return `
    <div class="bp-island">
      <div class="bp-block">
        <div class="bp-header">
          <div class="bp-title">Боевой пропуск</div>
          <div class="bp-level">Уровень ${playerState.bpLevel}</div>
        </div>
        <div class="bp-bar">
          <div class="bp-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="bp-sub">${pct}% • ${playerState.bpXpToNext} XP до следующего уровня</div>
      </div>
    </div>
  `;
}

/* Главная */

function renderHomeContent() {
  return `
    <div class="content-block">
      <div class="section-label">Режимы игры</div>

      <div class="mode-grid-two">
        <div class="mode-card" data-mode="training">
          <div class="mode-icon">🎯</div>
          <div class="mode-main">
            <div class="mode-title">Тренировка</div>
            <div class="mode-sub">Игра против бота и приватные матчи.</div>
          </div>
        </div>

        <div class="mode-card" data-mode="pvp">
          <div class="mode-icon">⚔</div>
          <div class="mode-main">
            <div class="mode-title">PvP дуэль</div>
            <div class="mode-sub">Игра против игрока. Влияет на рейтинг.</div>
          </div>
          <div class="mode-tag">PvP</div>
        </div>
      </div>

      <div class="mode-grid-single">
        <div class="mode-card" data-mode="pve-stars">
          <div class="mode-icon">🌟</div>
          <div class="mode-main">
            <div class="mode-title">PvE за звёзды</div>
            <div class="mode-sub">Премиум PvE-режим с повышенными наградами, вход за звёзды.</div>
          </div>
          <div class="mode-tag">★ Premium</div>
        </div>
      </div>
    </div>
  `;
}

/* Меню тренировки */

function renderTrainingMenu() {
  const card = document.getElementById("main-card");
  if (!card) return;

  stopActiveGame();
  showBottomNav();
  card.classList.remove("game-mode");

  card.innerHTML = `
    <div class="game-header">
      <div class="game-title">Тренировка</div>
      <button class="game-back-btn" id="btn-training-back">Назад</button>
    </div>

    <div class="content-block">
      <div class="section-label">Выбор режима</div>

      <div class="list-rows">
        <div class="row-item" id="btn-training-bot">
          <div class="row-main">
            <div class="row-title">Игра против бота</div>
            <div class="row-sub">3 раунда по 7 строк. Без рейтингового риска.</div>
          </div>
        </div>

        <div class="row-item" id="btn-training-private">
          <div class="row-main">
            <div class="row-title">Приватный матч</div>
            <div class="row-sub">До 8 человек по коду комнаты и паролю.</div>
          </div>
          <div class="row-tag">Private</div>
        </div>
      </div>

      <div class="training-extra" id="training-extra"></div>
    </div>
  `;

  attachTrainingMenuHandlers();
}

function attachTrainingMenuHandlers() {
  const backBtn = document.getElementById("btn-training-back");
  const botBtn = document.getElementById("btn-training-bot");
  const privBtn = document.getElementById("btn-training-private");
  const extra = document.getElementById("training-extra");

  if (backBtn) {
    backBtn.onclick = () => {
      renderSection("home");
      setActiveNav("home");
    };
  }

  if (botBtn && extra) {
    botBtn.onclick = () => {
      extra.innerHTML = `
        <div class="training-subtitle">Выбери уровень сложности</div>
        <div class="training-btn-row">
          <button class="training-inline-btn" data-diff="easy">Лёгкая</button>
          <button class="training-inline-btn" data-diff="medium">Средняя</button>
          <button class="training-inline-btn" data-diff="hard">Сложная</button>
        </div>
      `;
      extra.querySelectorAll(".training-inline-btn").forEach((b) => {
        b.onclick = () => {
          const diff = b.dataset.diff;
          startTrainingGame(diff);
        };
      });
    };
  }

  if (privBtn && extra) {
    privBtn.onclick = () => {
      extra.innerHTML = `
        <div class="training-subtitle">Приватный матч</div>
        <div class="training-btn-row">
          <button class="training-inline-btn" id="btn-private-join">Присоединиться</button>
          <button class="training-inline-btn" id="btn-private-create">Создать</button>
        </div>
        <div id="training-private-panel" style="margin-top:8px;"></div>
      `;

      const panel = document.getElementById("training-private-panel");
      const joinBtn = document.getElementById("btn-private-join");
      const createBtn = document.getElementById("btn-private-create");

      if (joinBtn && panel) {
        joinBtn.onclick = () => {
          panel.innerHTML = `
            <div class="training-subtitle">Присоединиться к комнате</div>
            <div class="list-rows">
              <div class="row-item">
                <div class="row-main">
                  <div class="row-title">Код комнаты</div>
                  <div class="row-sub">
                    <input id="join-room-code" type="text" maxlength="4" inputmode="numeric" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(7,10,20,0.9);padding:4px 6px;color:inherit;">
                  </div>
                </div>
              </div>
              <div class="row-item">
                <div class="row-main">
                  <div class="row-title">Пароль</div>
                  <div class="row-sub">
                    <input id="join-room-password" type="password" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(7,10,20,0.9);padding:4px 6px;color:inherit;">
                  </div>
                </div>
              </div>
            </div>
            <button class="btn-secondary" id="btn-private-join-confirm">Присоединиться</button>
          `;

          const confirm = document.getElementById("btn-private-join-confirm");
          if (confirm && tg) {
            confirm.onclick = () => {
              const code = document.getElementById("join-room-code")?.value || "";
              const pass = document.getElementById("join-room-password")?.value || "";
              tg.sendData(
                JSON.stringify({
                  type: "private_join",
                  roomCode: code,
                  password: pass,
                  ts: Date.now()
                })
              );
              tg.showAlert("Запрос на присоединение отправлен боту ✅");
            };
          }
        };
      }

      if (createBtn && panel) {
        createBtn.onclick = () => {
          const roomCode = String(Math.floor(1000 + Math.random() * 9000));
          panel.innerHTML = `
            <div class="training-subtitle">Создание комнаты</div>
            <div class="list-rows">
              <div class="row-item">
                <div class="row-main">
                  <div class="row-title">Код комнаты</div>
                  <div class="row-sub">Поделись с друзьями: <b>${roomCode}</b></div>
                </div>
                <div class="row-tag">до 8 чел.</div>
              </div>
              <div class="row-item">
                <div class="row-main">
                  <div class="row-title">Пароль</div>
                  <div class="row-sub">
                    <input id="create-room-password" type="password" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(7,10,20,0.9);padding:4px 6px;color:inherit;">
                  </div>
                </div>
              </div>
            </div>
            <button class="btn-secondary" id="btn-private-create-confirm">Создать комнату</button>
          `;

          const confirm = document.getElementById("btn-private-create-confirm");
          if (confirm && tg) {
            confirm.onclick = () => {
              const pass = document.getElementById("create-room-password")?.value || "";
              tg.sendData(
                JSON.stringify({
                  type: "private_create",
                  roomCode,
                  password: pass,
                  maxPlayers: 8,
                  ts: Date.now()
                })
              );
              tg.showAlert("Комната создана, ожидаем игроков ✅");
            };
          }
        };
      }
    };
  }
}

/* Челленджи */

function renderChallengesContent() {
  const daily = [
    {
      title: "Сыграть 3 матча",
      desc: "Любые режимы. Даёт +50 к любительскому рейтингу.",
      reward: "+50 рейтинга"
    },
    {
      title: "Выиграть 2 PvP дуэли",
      desc: "Считаются только матчи против игроков.",
      reward: "+100 рейтинга"
    },
    {
      title: "Зайти сегодня",
      desc: "Просто зайди в игру и открой любой экран.",
      reward: "+5★"
    }
  ];

  const weekly = [
    {
      title: "15 матчей за неделю",
      desc: "Любые режимы. Держит активность на уровне.",
      reward: "+200 рейтинга"
    },
    {
      title: "10 побед в PvP",
      desc: "Считаются только победы в дуэлях.",
      reward: "+300 рейтинга"
    },
    {
      title: "3 PvE за звёзды",
      desc: "Играй в премиум PvE режим хотя бы 3 раза.",
      reward: "Редкая косметика"
    },
    {
      title: "7 дней подряд",
      desc: "Не пропускать ни одного дня захода.",
      reward: "+20★"
    },
    {
      title: "1 турнирная неделя",
      desc: "Сыграть хотя бы 5 турнирных матчей.",
      reward: "Эпичная косметика"
    }
  ];

  return `
    <div class="content-block">
      <div class="section-label">Ежедневные челленджи</div>
      <div class="list-rows">
        ${daily
          .map(
            (c, idx) => `
          <div class="row-item" data-challenge-type="daily" data-challenge-index="${idx}">
            <div class="row-main">
              <div class="row-title">${c.title}</div>
              <div class="row-sub">${c.desc}</div>
            </div>
            <div class="row-tag">${c.reward}</div>
          </div>
        `
          )
          .join("")}
      </div>

      <div class="section-label" style="margin-top:10px;">Недельные челленджи</div>
      <div class="list-rows">
        ${weekly
          .map(
            (c, idx) => `
          <div class="row-item" data-challenge-type="weekly" data-challenge-index="${idx}">
            <div class="row-main">
              <div class="row-title">${c.title}</div>
              <div class="row-sub">${c.desc}</div>
            </div>
            <div class="row-tag">${c.reward}</div>
          </div>
        `
          )
          .join("")}
      </div>

      <button class="btn-secondary" id="btn-challenges-info">
        Как челленджи влияют на рейтинг?
      </button>
    </div>
  `;
}

/* Призовой фонд */

function renderFundContent() {
  const top3 = monthlyTop10.slice(0, 3);
  const rest = monthlyTop10.slice(3);

  return `
    <div class="content-block">
      <div class="section-label">Призовой фонд месяца</div>

      <div class="list-rows">
        <div class="row-item">
          <div class="row-main">
            <div class="row-title">${prizePoolState.monthTitle}</div>
            <div class="row-sub">
              Общий фонд: ${prizePoolState.totalStars}★, формируется из:
              ${prizePoolState.dailyFundPart} и ${prizePoolState.passFundPart}.
            </div>
          </div>
          <div class="row-tag">Месяц</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:10px;">Топ-3 за месяц</div>
      <div class="podium">
        <div class="podium-slot podium-2 gold">
          <div class="podium-place">2 место</div>
          <div class="podium-stars">★★★</div>
          <div class="podium-name">${top3[1].name}</div>
          <div class="podium-score">${top3[1].score} очк.</div>
        </div>
        <div class="podium-slot podium-1 gold">
          <div class="podium-place">1 место</div>
          <div class="podium-stars">★★★★★</div>
          <div class="podium-name">${top3[0].name}</div>
          <div class="podium-score">${top3[0].score} очк.</div>
        </div>
        <div class="podium-slot podium-3 gold">
          <div class="podium-place">3 место</div>
          <div class="podium-stars">★★</div>
          <div class="podium-name">${top3[2].name}</div>
          <div class="podium-score">${top3[2].score} очк.</div>
        </div>
      </div>

      <div class="section-label" style="margin-top:10px;">Топ-10 игроков</div>
      <div class="list-rows">
        ${rest
          .map(
            (p) => `
          <div class="row-item">
            <div class="row-main">
              <div class="row-title">#${p.place} • ${p.name}</div>
              <div class="row-sub">Очки за месяц: ${p.score}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>

      <button class="btn-secondary" id="btn-fund-info">
        Как распределяется призовой фонд?
      </button>
    </div>
  `;
}

/* Handlers обычных экранов */

function attachHomeHandlers() {
  if (currentSection !== "home") return;
  const card = document.getElementById("main-card");
  if (!card) return;

  card.querySelectorAll(".mode-card").forEach((el) => {
    el.addEventListener("click", () => {
      const mode = el.dataset.mode;
      if (mode === "training") {
        renderTrainingMenu();
      } else {
        handleStartMode(mode);
      }
    });
  });
}

function handleStartMode(mode) {
  if (!tg) {
    alert("Режим: " + mode + " (логика матча будет через бота)");
    return;
  }

  const map = {
    pvp: "PvP дуэль",
    "pve-stars": "PvE за звёзды"
  };

  tg.showPopup?.({
    title: map[mode] || "Матч",
    message: "Запустить матч в этом режиме (через бота)?",
    buttons: [
      { id: "cancel", type: "cancel", text: "Отмена" },
      { id: "ok", type: "default", text: "Играть" }
    ]
  });

  const cb = (id) => {
    if (id === "ok") {
      tg.sendData(
        JSON.stringify({
          type: "start_match",
          mode,
          rating: ratingState.current,
          ts: Date.now()
        })
      );
      tg.showAlert("Запрос на старт матча отправлен боту ✅");
    }
    tg.offEvent?.("popupClosed", cb);
  };

  tg.onEvent?.("popupClosed", cb);
}

function attachChallengeHandlers() {
  if (currentSection !== "challenges") return;
  const card = document.getElementById("main-card");
  if (!card) return;

  const infoBtn = document.getElementById("btn-challenges-info");
  if (infoBtn && tg) {
    infoBtn.onclick = () => {
      tg.showPopup?.({
        title: "Челленджи и рейтинг",
        message:
          "Ежедневные челленджи дают быстрый буст рейтинга и звёзд.\n" +
          "Недельные удерживают активность и мотивируют возвращаться.\n\n" +
          "Чем стабильнее выполняешь задачи — тем выше позиция в рейтинге за месяц.",
        buttons: [{ id: "ok", type: "close", text: "Понятно" }]
      });
    };
  }
}

function attachFundHandlers() {
  if (currentSection !== "fund") return;
  const card = document.getElementById("main-card");
  if (!card) return;

  const infoBtn = document.getElementById("btn-fund-info");
  if (infoBtn && tg) {
    infoBtn.onclick = () => {
      tg.showPopup?.({
        title: "Распределение фонда",
        message:
          "Призовой фонд месяца распределяется так:\n" +
          "• Топ-3 делят основной пул (например, 50% / 30% / 20%).\n" +
          "• Остальные места в топ-10 могут получать утешительные призы и косметику.\n\n" +
          "Точные проценты и правила можно будет вынести в отдельный экран с политикой наград.",
        buttons: [{ id: "ok", type: "close", text: "Окей" }]
      });
    };
  }
}

/* ГЕНЕРАЦИЯ ТЕКСТОВ */

function generateLine(difficulty, roundIndex) {
  const baseTextsEasy = [
    "кот спит на окне",
    "я люблю забавные мемы",
    "простой текст для разгона",
    "съешь ещё этих булок",
    "легкая разминка перед матчем",
    "кто быстрее печатает текст",
    "спокойный старт тренировки"
  ];

  const baseTextsMid = [
    "настройка скорости печати полезна всем",
    "каждый раунд сложнее прошлого",
    "проверим точность ввода текста внимательнее",
    "кто успеет дописать строку раньше оппонента",
    "быстрые пальцы чаще побеждают в дуэлях",
    "слегка усложнённая строка для разогрева",
    "тренировка помогает держать форму"
  ];

  const baseTextsHard = [
    "сложный текст с пунктуацией проверяет внимательность игрока",
    "когда скорость и точность совпадают результат становится максимальным",
    "игроки соревнуются за призовой фонд и личный рейтинг",
    "ошибка возвращает строку к началу будь аккуратнее с вводом",
    "двойные пробелы и знаки тоже считаются в чистоте текста",
    "финальный раунд решает исход напряженного матча",
    "чем меньше ошибок тем выше итоговый результат"
  ];

  if (difficulty === "easy") {
    return baseTextsEasy[(roundIndex + Math.floor(Math.random() * baseTextsEasy.length)) % baseTextsEasy.length];
  } else if (difficulty === "medium") {
    return baseTextsMid[(roundIndex + Math.floor(Math.random() * baseTextsMid.length)) % baseTextsMid.length];
  } else {
    return baseTextsHard[(roundIndex + Math.floor(Math.random() * baseTextsHard.length)) % baseTextsHard.length];
  }
}

function generateRoundsForTraining(difficulty) {
  const rounds = [];
  for (let r = 0; r < MATCH_ROUNDS; r++) {
    const roundLines = [];
    let diffForRound = difficulty;
    if (difficulty === "easy") {
      diffForRound = r === 0 ? "easy" : r === 1 ? "medium" : "medium";
    } else if (difficulty === "medium") {
      diffForRound = r === 0 ? "medium" : r === 1 ? "medium" : "hard";
    } else {
      diffForRound = r === 0 ? "medium" : "hard";
    }
    for (let i = 0; i < LINES_PER_ROUND; i++) {
      roundLines.push(generateLine(diffForRound, r));
    }
    rounds.push(roundLines);
  }
  return rounds;
}

/* ТРЕНИРОВОЧНЫЙ МАТЧ */

function startTrainingGame(difficulty) {
  stopActiveGame();

  const rounds = generateRoundsForTraining(difficulty);
  const totalChars = rounds.flat().join("").length;

  const BOT_TARGET_TIME = {
    easy: 110,
    medium: 80,
    hard: 55
  };
  const targetTimeSec = BOT_TARGET_TIME[difficulty] || 90;
  const botSpeed = totalChars / (targetTimeSec * 1000);

  activeGameState = {
    mode: "training",
    difficulty,
    rounds,
    roundIndex: 0,
    lineIndex: 0,
    errorsInRound: 0,
    totalErrors: 0,
    startedAt: null,
    finished: false,
    lastInput: "",
    totalMatchChars: totalChars,
    botSpeed,
    botProgressChars: 0,
    pauseTotalMs: 0,
    pauseStartedAt: null,
    inInterRoundPause: false,
    correctCharsTotal: 0,
    typedCharsTotal: 0,
    currentLineCorrectCharsAttempt: 0
  };

  document.body.classList.add("in-game");
  renderGameScreen();
  startPreCountdown();
}

/* MATRIX RAIN */

function initMatrixRain() {
  const island = document.getElementById("matrix-island");
  if (!island) return;

  island.innerHTML = "";
  const chars = "0123456789йцукенгшщзхъфывапролджэячсмитьбю";

  const count = 50;
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.className = "matrix-char";
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.left = Math.random() * 100 + "%";
    span.style.animationDuration = 2 + Math.random() * 3 + "s";
    span.style.animationDelay = Math.random() * 3 + "s";
    island.appendChild(span);
  }
}

/* Рендер экрана игры */

function renderGameScreen() {
  const card = document.getElementById("main-card");
  if (!card || !activeGameState) return;

  hideBottomNav();
  card.classList.add("game-mode");

  const heartsHtml = Array.from({ length: MAX_ERRORS_PER_ROUND }, (_, i) =>
    `<span class="life-heart" data-life="${i}"></span>`
  ).join("");

  card.innerHTML = `
    <div class="game-header">
      <div class="game-title">Тренировка: игра против бота</div>
      <button class="game-back-btn" id="btn-game-exit">В главное меню</button>
    </div>

    <div class="game-stats-row">
      <div class="game-stat">
        <div class="game-stat-label">Раунд</div>
        <div class="game-stat-value" id="game-round">1 / ${MATCH_ROUNDS}</div>
      </div>
      <div class="game-stat">
        <div class="game-stat-label">Скорость</div>
        <div class="game-stat-value" id="game-speed">0 симв/мин</div>
      </div>
      <div class="game-stat">
        <div class="game-stat-label">Точность</div>
        <div class="game-stat-value" id="game-accuracy">100%</div>
      </div>
    </div>

    <div class="game-progress">
      <div class="game-progress-bar">
        <div class="game-progress-fill" id="game-progress-fill-bot"></div>
        <div class="game-progress-fill" id="game-progress-fill"></div>
      </div>
    </div>

    <div class="game-lives">
      <div class="game-lives-label">Жизни</div>
      <div class="game-lives-dots" id="game-lives-dots">
        ${heartsHtml}
      </div>
    </div>

    <div class="game-lines loading">
      <div class="game-line game-line-prev" id="game-line-prev"></div>
      <div class="game-line game-line-current" id="game-line-current"></div>
      <div class="game-line game-line-next" id="game-line-next"></div>
      <div class="game-countdown" id="game-countdown"></div>
    </div>

    <div class="game-keyboard-wrapper">
      <div class="matrix-island" id="matrix-island"></div>
      <div class="game-keyboard" id="game-keyboard">
        <div class="keyboard-plate" id="keyboard-plate">
          <div class="key-row">
            <button class="key-btn" data-key="й">й</button>
            <button class="key-btn" data-key="ц">ц</button>
            <button class="key-btn" data-key="у">у</button>
            <button class="key-btn" data-key="к">к</button>
            <button class="key-btn" data-key="е">е</button>
            <button class="key-btn" data-key="н">н</button>
            <button class="key-btn" data-key="г">г</button>
            <button class="key-btn" data-key="ш">ш</button>
            <button class="key-btn" data-key="щ">щ</button>
            <button class="key-btn" data-key="з">з</button>
            <button class="key-btn" data-key="х">х</button>
            <button class="key-btn" data-key="ъ">ъ</button>
          </div>
          <div class="key-row">
            <button class="key-btn" data-key="ф">ф</button>
            <button class="key-btn" data-key="ы">ы</button>
            <button class="key-btn" data-key="в">в</button>
            <button class="key-btn" data-key="а">а</button>
            <button class="key-btn" data-key="п">п</button>
            <button class="key-btn" data-key="р">р</button>
            <button class="key-btn" data-key="о">о</button>
            <button class="key-btn" data-key="л">л</button>
            <button class="key-btn" data-key="д">д</button>
            <button class="key-btn" data-key="ж">ж</button>
            <button class="key-btn" data-key="э">э</button>
          </div>
          <div class="key-row key-row-third">
            <div class="key-spacer"></div>
            <button class="key-btn" data-key="я">я</button>
            <button class="key-btn" data-key="ч">ч</button>
            <button class="key-btn" data-key="с">с</button>
            <button class="key-btn" data-key="м">м</button>
            <button class="key-btn" data-key="и">и</button>
            <button class="key-btn" data-key="т">т</button>
            <button class="key-btn" data-key="ь">ь</button>
            <button class="key-btn" data-key="б">б</button>
            <button class="key-btn" data-key="ю">ю</button>
            <div class="key-spacer"></div>
          </div>
          <div class="key-row key-row-space">
            <button class="key-btn key-btn-small" data-key=",">,</button>
            <button class="key-btn key-btn-wide" data-key=" ">Пробел</button>
            <button class="key-btn key-btn-small" data-key=".">.</button>
          </div>
        </div>
      </div>
    </div>

    <div class="game-summary" id="game-summary" style="display:none;"></div>
    <div class="game-actions" id="game-actions" style="display:none;">
      <button class="btn-secondary" id="btn-game-restart">Сыграть ещё</button>
      <button class="btn-secondary" id="btn-game-menu">В главное меню</button>
    </div>
  `;

  updateRoundUI();
  updateGameLinesUI(0);
  updateGameProgressUI(0, 0);
  updateLivesUI();
  initMatrixRain();
  attachGameHandlers();
}

/* текущие строки */

function getCurrentLine() {
  return activeGameState.rounds[activeGameState.roundIndex][activeGameState.lineIndex];
}

function getPrevLine() {
  const { roundIndex, lineIndex, rounds } = activeGameState;
  if (roundIndex === 0 && lineIndex === 0) return "";
  if (lineIndex > 0) return rounds[roundIndex][lineIndex - 1];
  return rounds[roundIndex - 1][LINES_PER_ROUND - 1];
}

function getNextLine() {
  const { roundIndex, lineIndex, rounds } = activeGameState;
  if (lineIndex < LINES_PER_ROUND - 1) return rounds[roundIndex][lineIndex + 1];
  if (roundIndex < MATCH_ROUNDS - 1) return rounds[roundIndex + 1][0];
  return "";
}

/* UI строк */

function updateGameLinesUI(typedLength) {
  if (!activeGameState) return;
  const prevEl = document.getElementById("game-line-prev");
  const curEl = document.getElementById("game-line-current");
  const nextEl = document.getElementById("game-line-next");
  if (!prevEl || !curEl || !nextEl) return;

  const prev = getPrevLine();
  const cur = getCurrentLine();
  const next = getNextLine();

  prevEl.textContent = prev || "";
  nextEl.textContent = next || "";

  const charsHtml = cur
    .split("")
    .map((ch, idx) => {
      const safe = ch === " " ? "&nbsp;" : ch;
      const active = idx === typedLength ? " active-char" : "";
      return `<span class="game-scroll-char${active}">${safe}</span>`;
    })
    .join("");

  curEl.innerHTML = `
    <div class="game-scroll-wrapper">
      <div class="game-scroll-marker"></div>
      <div class="game-scroll-viewport">
        <div class="game-scroll-inner" style="transform: translateX(calc(-1ch * ${typedLength}));">
          ${charsHtml}
        </div>
      </div>
    </div>
  `;
}

function updateGameProgressUI(playerRatio, botRatio) {
  const playerBar = document.getElementById("game-progress-fill");
  const botBar = document.getElementById("game-progress-fill-bot");
  if (playerBar) {
    playerBar.style.width = `${Math.max(0, Math.min(1, playerRatio)) * 100}%`;
  }
  if (botBar) {
    botBar.style.width = `${Math.max(0, Math.min(1, botRatio)) * 100}%`;
  }
}

function updateRoundUI() {
  if (!activeGameState) return;
  const roundEl = document.getElementById("game-round");
  if (!roundEl) return;
  roundEl.textContent = `${activeGameState.roundIndex + 1} / ${MATCH_ROUNDS}`;
}

function updateLivesUI() {
  if (!activeGameState) return;
  const dotsWrap = document.getElementById("game-lives-dots");
  if (!dotsWrap) return;
  const hearts = dotsWrap.querySelectorAll(".life-heart");
  hearts.forEach((heart, idx) => {
    heart.classList.toggle("life-heart-lost", idx < activeGameState.errorsInRound);
  });
}

function triggerErrorFlash() {
  const card = document.querySelector(".glass-card");
  if (!card) return;
  card.classList.add("error-flash");
  setTimeout(() => {
    card.classList.remove("error-flash");
  }, 180);
}

/* стартовый флэш */

function triggerStartFlash() {
  const lines = document.querySelector(".game-lines");
  if (!lines) return;
  lines.classList.add("start-flash");
  setTimeout(() => {
    lines.classList.remove("start-flash");
  }, 200);
}

/* COUNTDOWN */

function startPreCountdown() {
  const cdEl = document.getElementById("game-countdown");
  const lines = document.querySelector(".game-lines");
  if (!cdEl || !lines) return;

  inputEnabled = false;
  let left = PRESTART_COUNTDOWN_SEC;
  cdEl.textContent = left;

  if (preStartTimer) clearInterval(preStartTimer);

  preStartTimer = setInterval(() => {
    left -= 1;
    if (left > 0) {
      cdEl.textContent = left;
    } else if (left === 0) {
      cdEl.textContent = "START";
    } else {
      clearInterval(preStartTimer);
      preStartTimer = null;
      cdEl.textContent = "";
      lines.classList.remove("loading");
      triggerStartFlash();
      inputEnabled = true;
      startStatsTimer();
      updateGameLinesUI(0);
    }
  }, 1000);
}

function startStatsTimer() {
  if (!activeGameState) return;
  activeGameState.startedAt = Date.now();
  activeGameState.pauseTotalMs = 0;
  activeGameState.pauseStartedAt = null;
  activeGameState.inInterRoundPause = false;
  activeGameTimer = setInterval(updateGameStatsUI, 200);
}

/* обработчики игры */

function attachGameHandlers() {
  if (!activeGameState) return;

  const exitBtn = document.getElementById("btn-game-exit");
  const restartBtn = document.getElementById("btn-game-restart");
  const menuBtn = document.getElementById("btn-game-menu");
  const keyboard = document.getElementById("game-keyboard");

  activeGameState.lastInput = "";

  if (exitBtn) {
    exitBtn.onclick = () => {
      stopActiveGame();
      const card = document.getElementById("main-card");
      if (card) card.classList.remove("game-mode");
      setActiveNav("home");
      renderSection("home");
    };
  }

  if (restartBtn) {
    restartBtn.onclick = () => {
      startTrainingGame(activeGameState.difficulty);
    };
  }

  if (menuBtn) {
    menuBtn.onclick = () => {
      stopActiveGame();
      const card = document.getElementById("main-card");
      if (card) card.classList.remove("game-mode");
      setActiveNav("home");
      renderSection("home");
    };
  }

  if (keyboard) {
    keyboard.addEventListener("click", (e) => {
      const btn = e.target.closest(".key-btn");
      if (!btn) return;
      if (!activeGameState || activeGameState.finished || !inputEnabled) return;

      const key = btn.dataset.key;
      if (!key) return;

      triggerKeyHaptics();

      const prev = activeGameState.lastInput || "";
      const next = prev + key;

      handleGameInput(next, key);
    });
  }
}

/* ВВОД */

function handleGameInput(value) {
  if (!activeGameState || activeGameState.finished) return;

  const prev = activeGameState.lastInput || "";
  const diffLen = value.length - prev.length;

  activeGameState.typedCharsTotal += 1;

  if (diffLen > 1) return;
  if (diffLen <= 0) return;

  const idx = value.length - 1;
  const target = getCurrentLine();

  if (idx >= 0) {
    const typedChar = value[idx];
    const expectedChar = target[idx];

    if (!isSameChar(typedChar, expectedChar)) {
      activeGameState.errorsInRound += 1;
      activeGameState.totalErrors += 1;

      if (activeGameState.currentLineCorrectCharsAttempt > 0) {
        activeGameState.correctCharsTotal = Math.max(
          0,
          activeGameState.correctCharsTotal - activeGameState.currentLineCorrectCharsAttempt
        );
        activeGameState.currentLineCorrectCharsAttempt = 0;
      }

      triggerErrorFlash();
      updateLivesUI();

      if (activeGameState.errorsInRound >= MAX_ERRORS_PER_ROUND) {
        activeGameState.lastInput = value;
        updateGameStatsUI();
        finishGame(false, "Лимит ошибок в раунде исчерпан");
        return;
      }

      activeGameState.lastInput = "";
      updateGameLinesUI(0);
      updateGameStatsUI();
      return;
    }

    activeGameState.correctCharsTotal += 1;
    activeGameState.currentLineCorrectCharsAttempt += 1;
  }

  activeGameState.lastInput = value;
  updateGameLinesUI(value.length);
  updateGameStatsUI();

  if (isSameText(value, target)) {
    advanceLine();
  }
}

/* переход по строкам/раундам */

function advanceLine() {
  if (!activeGameState) return;

  activeGameState.currentLineCorrectCharsAttempt = 0;

  const isLastLineInRound = activeGameState.lineIndex === LINES_PER_ROUND - 1;
  const isLastRound = activeGameState.roundIndex === MATCH_ROUNDS - 1;

  activeGameState.lastInput = "";

  if (isLastLineInRound && isLastRound) {
    finishGame(true, "Все раунды пройдены");
    return;
  }

  if (isLastLineInRound && !isLastRound) {
    activeGameState.roundIndex += 1;
    activeGameState.lineIndex = 0;
    activeGameState.errorsInRound = 0;
    updateLivesUI();
    updateRoundUI();

    const ratios = getProgressRatios();
    updateGameProgressUI(ratios.player, ratios.bot);
    startInterRoundPause();
    return;
  }

  activeGameState.lineIndex += 1;
  updateRoundUI();
  updateGameLinesUI(0);

  const ratios = getProgressRatios();
  updateGameProgressUI(ratios.player, ratios.bot);
}

/* прогресс */

function getPlayerCorrectChars() {
  if (!activeGameState) return 0;
  return activeGameState.correctCharsTotal;
}

function getProgressRatios() {
  if (!activeGameState || !activeGameState.totalMatchChars) {
    return { player: 0, bot: 0 };
  }
  const correctChars = getPlayerCorrectChars();
  const playerRatio = correctChars / activeGameState.totalMatchChars;
  const botRatio = activeGameState.botProgressChars / activeGameState.totalMatchChars;
  return { player: playerRatio, bot: botRatio };
}

/* статы + бот */

function updateGameStatsUI() {
  if (!activeGameState || !activeGameState.startedAt) return;

  const now = Date.now();

  let elapsedMs =
    now -
    activeGameState.startedAt -
    (activeGameState.pauseTotalMs || 0);

  if (activeGameState.inInterRoundPause && activeGameState.pauseStartedAt) {
    elapsedMs -= (now - activeGameState.pauseStartedAt);
  }
  if (elapsedMs < 0) elapsedMs = 0;

  const elapsedMin = Math.max(elapsedMs / 60000, 0.01);

  const correctChars = getPlayerCorrectChars();
  const totalTyped = activeGameState.typedCharsTotal;
  const speed = Math.round(correctChars / elapsedMin);
  const accuracy =
    totalTyped > 0
      ? Math.round((correctChars / totalTyped) * 100)
      : 100;

  const speedEl = document.getElementById("game-speed");
  const accEl = document.getElementById("game-accuracy");

  if (speedEl) speedEl.textContent = `${speed} симв/мин`;
  if (accEl) accEl.textContent = `${accuracy}%`;

  activeGameState.botProgressChars = Math.min(
    activeGameState.totalMatchChars,
    elapsedMs * activeGameState.botSpeed
  );

  const ratios = getProgressRatios();
  updateGameProgressUI(ratios.player, ratios.bot);

  if (!activeGameState.finished) {
    const playerOnLastRound =
      activeGameState.roundIndex === MATCH_ROUNDS - 1 &&
      activeGameState.lineIndex === LINES_PER_ROUND - 1;
    const playerFinishedLine =
      playerOnLastRound &&
      isSameText(activeGameState.lastInput, getCurrentLine());

    if (
      !playerFinishedLine &&
      activeGameState.botProgressChars >= activeGameState.totalMatchChars
    ) {
      finishGame(false, "Бот завершил текст первым");
    }
  }
}

/* пауза между раундами */

function startInterRoundPause() {
  const lines = document.querySelector(".game-lines");
  const cdEl = document.getElementById("game-countdown");
  if (!lines || !cdEl || !activeGameState) return;

  activeGameState.inInterRoundPause = true;
  activeGameState.pauseStartedAt = Date.now();
  inputEnabled = false;
  lines.classList.add("loading");

  let left = INTER_ROUND_COUNTDOWN_SEC;
  cdEl.textContent = `Раунд ${activeGameState.roundIndex + 1} через ${left}`;

  if (preStartTimer) clearInterval(preStartTimer);

  preStartTimer = setInterval(() => {
    left -= 1;

    if (left > 0) {
      cdEl.textContent = `Раунд ${activeGameState.roundIndex + 1} через ${left}`;
    } else if (left === 0) {
      cdEl.textContent = "START";
    } else {
      clearInterval(preStartTimer);
      preStartTimer = null;

      cdEl.textContent = "";
      if (activeGameState.pauseStartedAt) {
        activeGameState.pauseTotalMs += Date.now() - activeGameState.pauseStartedAt;
        activeGameState.pauseStartedAt = null;
      }
      activeGameState.inInterRoundPause = false;

      lines.classList.remove("loading");
      triggerStartFlash();
      inputEnabled = true;
      updateGameLinesUI(0);
    }
  }, 1000);
}

/* завершение матча */

function finishGame(success, reason) {
  if (!activeGameState || activeGameState.finished) return;
  activeGameState.finished = true;

  if (activeGameTimer) {
    clearInterval(activeGameTimer);
    activeGameTimer = null;
  }
  if (preStartTimer) {
    clearInterval(preStartTimer);
    preStartTimer = null;
  }

  inputEnabled = false;

  const keyboardPlate = document.getElementById("keyboard-plate");
  if (keyboardPlate) {
    keyboardPlate.classList.add("keyboard-hide");
    keyboardPlate.addEventListener(
      "animationend",
      () => {
        keyboardPlate.style.display = "none";
      },
      { once: true }
    );
  }

  const now = Date.now();
  const startedAt = activeGameState.startedAt || now;

  let elapsedMs =
    now -
    startedAt -
    (activeGameState.pauseTotalMs || 0);

  if (activeGameState.inInterRoundPause && activeGameState.pauseStartedAt) {
    elapsedMs -= (now - activeGameState.pauseStartedAt);
  }
  if (elapsedMs < 0) elapsedMs = 0;

  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  const correctChars = getPlayerCorrectChars();
  const totalTyped = activeGameState.typedCharsTotal;
  const speed = elapsedMs > 0 ? Math.round((correctChars / elapsedMs) * 60000) : 0;
  const accuracy =
    totalTyped > 0
      ? Math.round((correctChars / totalTyped) * 100)
      : 100;

  const summaryEl = document.getElementById("game-summary");
  const actionsEl = document.getElementById("game-actions");
  if (summaryEl) {
    summaryEl.style.display = "block";
    summaryEl.innerHTML = `
      ${success ? "Тренировка завершена успешно." : "Матч завершён."}<br/>
      Причина: <b>${reason}</b><br/><br/>
      Скорость: <b>${speed} симв/мин</b><br/>
      Точность: <b>${accuracy}%</b><br/>
      Ошибок за матч: <b>${activeGameState.totalErrors}</b><br/>
      Время (без пауз): <b>${elapsedSec} с</b>
    `;
  }
  if (actionsEl) {
    actionsEl.style.display = "flex";
  }
}
