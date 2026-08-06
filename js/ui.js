(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};
  const Config = HousePlay.Config;
  const State = HousePlay.State;
  const Tasks = HousePlay.Tasks;
  const Cokes = HousePlay.Cokes;
  const WheelLock = HousePlay.WheelLock;

  let currentScreen = "home";
  let historyFilter = "all";
  let adminUnlocked = false;
  let lastFocusedElement = null;
  let pendingConfirm = null;
  let modalIsCritical = false;
  let wheelRotation = 0;
  let previousBalances = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name, className) {
    const paths = {
      star: '<path d="m12 2.8 2.83 5.73 6.32.92-4.58 4.46 1.08 6.3L12 17.24 6.35 20.2l1.08-6.3-4.58-4.46 6.32-.92L12 2.8Z"></path>',
      ticket: '<path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"></path><path d="M12 7v2M12 11v2M12 15v2"></path>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"></path>',
      unlock: '<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 7.6-1.75M12 14v3"></path>',
      check: '<path d="m5 12 4 4L19 6"></path>',
      clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
      paw: '<path d="M8.2 11.1c1.2-1.4 2.3-2.1 3.8-2.1s2.6.7 3.8 2.1c1.7 2 2.8 3.1 2.3 5-.4 1.6-2 2.4-3.8 1.7-1.5-.6-3.1-.6-4.6 0-1.8.7-3.4-.1-3.8-1.7-.5-1.9.6-3 2.3-5ZM7.4 7.7c-1.3.5-2.8-.5-3.3-2.1-.5-1.7.2-3.3 1.5-3.7 1.3-.4 2.8.5 3.3 2.2.5 1.6-.2 3.2-1.5 3.6ZM16.6 7.7c1.3.5 2.8-.5 3.3-2.1.5-1.7-.2-3.3-1.5-3.7-1.3-.4-2.8.5-3.3 2.2-.5 1.6.2 3.2 1.5 3.6ZM3.8 11.8c-1.2.2-2.4-.9-2.6-2.5C1 7.8 1.8 6.4 3 6.2c1.2-.2 2.4.9 2.6 2.5.2 1.5-.6 2.9-1.8 3.1ZM20.2 11.8c1.2.2 2.4-.9 2.6-2.5.2-1.5-.6-2.9-1.8-3.1-1.2-.2-2.4.9-2.6 2.5-.2 1.5.6 2.9 1.8 3.1Z"></path>',
      dishes: '<path d="M4 13h16a8 8 0 0 1-16 0ZM12 13V5M9 5h6"></path>',
      table: '<path d="M4 10h16M6 10v10M18 10v10M3 6h18v4H3z"></path>',
      broom: '<path d="m14.5 3-5 11M7.5 13l5 2.2-2.2 5-7-3.1L5.5 12l2 .9Z"></path>',
      bed: '<path d="M3 18V8M21 18v-6a3 3 0 0 0-3-3H9v6M3 15h18M6 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>',
      sparkle: '<path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z"></path>',
      laundry: '<rect x="4" y="2.5" width="16" height="19" rx="2"></rect><circle cx="12" cy="13" r="5"></circle><path d="M7 6h.01M10 6h4"></path>',
      couch: '<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M5 19h14a3 3 0 0 0 3-3v-3a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0v3a3 3 0 0 0 3 3ZM6 19v2M18 19v2"></path>',
      shirt: '<path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3a4 4 0 0 1-8 0Z"></path>',
      droplet: '<path d="M12 2.5S5.5 10 5.5 15.2a6.5 6.5 0 1 0 13 0C18.5 10 12 2.5 12 2.5Z"></path>',
      wheel: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v9l6.4 6.4M12 12 5.6 18.4"></path>',
      plus: '<path d="M12 5v14M5 12h14"></path>',
      minus: '<path d="M5 12h14"></path>',
      shield: '<path d="M12 2 4.5 5v5.8c0 4.7 3 8.7 7.5 11.2 4.5-2.5 7.5-6.5 7.5-11.2V5L12 2Z"></path><path d="m9 12 2 2 4-5"></path>',
      flame: '<path d="M13 22c4 0 7-2.9 7-7 0-3.2-1.8-6.4-5.4-9.5.1 2.4-1.1 4.2-2.5 5.2.2-3.7-2-6.6-4.1-8.7.1 4.4-4 7.3-4 12.6C4 18.9 7.6 22 13 22Z"></path>',
      x: '<path d="m6 6 12 12M18 6 6 18"></path>',
      download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"></path>',
      upload: '<path d="M12 17V5M7 10l5-5 5 5M4 20h16"></path>',
      trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"></path>',
      settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"></path>'
    };
    return `<svg class="${escapeHtml(className || "ui-icon")}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
  }

  function taskIcon(iconName) {
    return icon(iconName || "sparkle", "task-svg");
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatMinimum(timestamp) {
    if (!timestamp) return "No minimum lock time";
    return `Minimum until ${formatDateTime(timestamp)}`;
  }

  function statusIcon(status) {
    if (status === "approved") return icon("check");
    if (status === "pending") return icon("clock");
    if (status === "teased") return icon("flame");
    if (status === "denied") return icon("x");
    return icon("plus");
  }

  function renderBalanceCard() {
    const balances = State.get().balances;
    return `
      <article class="glass-card balance-card reveal-card" aria-label="Current balance">
        <div class="balance-side">
          <div class="balance-label">${icon("star", "balance-icon gold-icon")}<span>Points</span></div>
          <strong class="balance-number serif-number" data-balance-points>${balances.points}</strong>
          <span class="balance-caption">Loose balance</span>
        </div>
        <div class="balance-divider" aria-hidden="true"></div>
        <div class="balance-side balance-side-right">
          <div class="balance-label">${icon("ticket", "balance-icon ticket-icon")}<span>Tickets</span></div>
          <strong class="balance-number serif-number" data-balance-tickets>${balances.tickets}</strong>
          <span class="balance-caption">10 points each</span>
        </div>
      </article>`;
  }

  function renderLockCard(compact) {
    const info = WheelLock.getLockInfo();
    const activeLabel = info.active ? (info.forced ? "Minimum lock active" : "Lock is active") : "Lock timer ready";
    const timerValue = info.active ? (info.forced ? WheelLock.formatDuration(info.remainingMs) : WheelLock.formatDuration(info.elapsedMs)) : "00:00:00";
    const timerMode = info.forced ? "lock-remaining" : "lock-elapsed";
    return `
      <article class="glass-card lock-card ${info.active ? "is-timing" : ""} reveal-card ${compact ? "compact-lock" : ""}">
        <div class="lock-card-top">
          <div class="lock-orb ${info.active ? "is-active" : ""}">
            <span>${icon(info.active ? "lock" : "unlock", "lock-orb-icon")}</span>
          </div>
          <div class="lock-summary">
            <span class="eyebrow" data-lock-status>${activeLabel}</span>
            <strong class="lock-time serif-number" data-duration-mode="${timerMode}" data-started-at="${escapeHtml(info.startedAt || "")}" data-until="${escapeHtml(info.lockMinimumUntil || "")}">${timerValue}</strong>
            <span class="muted lock-mode-copy">${info.active && !info.forced ? "Time since the lock started" : info.forced ? "Forced time remaining" : "No active session"}</span>
          </div>
        </div>
        <div class="lock-progress" aria-label="Lock minimum progress">
          <span data-lock-progress style="width:${info.progress.toFixed(1)}%"></span>
        </div>
        <div class="lock-meta-row">
          <span>${info.forced ? formatMinimum(info.lockMinimumUntil) : "Normal unlock is available"}</span>
          ${info.active ? `<span class="status-dot ${info.forced ? "danger" : "gold"}">${info.forced ? "Forced" : "Active"}</span>` : '<span class="status-dot">Inactive</span>'}
        </div>
        ${compact ? "" : `<button class="primary-button ${info.active ? "outline-button" : ""}" type="button" data-action="${info.active ? "request-unlock" : "start-lock"}">${icon(info.active ? "unlock" : "lock")}${info.active ? "Request Unlock" : "Start Lock"}</button>`}
      </article>`;
  }

  function renderMissionRow(taskId, missionNumber) {
    const date = State.getLocalDateKey();
    const task = Tasks.getTask(taskId);
    const submission = Tasks.findChoreSubmission(taskId, date);
    const status = submission ? submission.status : "available";
    const disabled = Boolean(submission);
    return `
      <div class="mission-row status-${escapeHtml(status)}">
        <span class="mission-number">${String(missionNumber).padStart(2, "0")}</span>
        <span class="mission-icon">${taskIcon(task && task.icon)}</span>
        <span class="mission-copy">
          <strong>${escapeHtml(task ? task.name : "Required chore")}</strong>
          <small>${status === "pending" ? "Waiting for Dylan" : status === "approved" ? "Approved" : status === "denied" ? "Denied — no point" : status === "teased" ? "Teased — no point" : "Worth 1 point"}</small>
        </span>
        <button class="mission-action" type="button" data-action="log-chore" data-task-id="${escapeHtml(taskId)}" aria-label="${disabled ? escapeHtml(status) : `Log ${escapeHtml(task ? task.name : "chore")}`}" ${disabled ? "disabled" : ""}>
          ${statusIcon(status)}
        </button>
      </div>`;
  }

  function renderRequiredCard() {
    const record = Tasks.getRequired();
    const progress = Tasks.getRequiredProgress();
    return `
      <article class="glass-card section-card reveal-card">
        <div class="card-heading-row">
          <div>
            <span class="eyebrow">Daily missions</span>
            <h2>${Config.labels.requiredToday}</h2>
          </div>
          <span class="progress-pill">${progress.completed} of ${progress.total} completed</span>
        </div>
        <div class="mission-list">
          ${record.taskIds.map((taskId, index) => renderMissionRow(taskId, index + 1)).join("")}
        </div>
        ${record.finalized ? '<div class="finalized-banner">Today has been finalized.</div>' : ""}
      </article>`;
  }

  function renderCokeCard() {
    const status = Cokes.getTodayStatus();
    const cans = Array.from({ length: Config.STANDARD_COKE_ALLOWANCE }, (_, index) => {
      const used = index < Math.min(status.count, Config.STANDARD_COKE_ALLOWANCE);
      const restricted = index >= status.allowance;
      return `
        <div class="coke-can-slot ${used ? "is-used" : ""} ${restricted ? "is-restricted" : ""}">
          <div class="coke-image-wrap">
            <img src="assets/coke-can.png" alt="" loading="eager">
            ${used ? `<span class="can-check">${icon("check")}</span>` : ""}
            ${restricted ? '<span class="can-cost">2</span>' : ""}
          </div>
          <span>${restricted ? "Paid" : `Free ${index + 1}`}</span>
        </div>`;
    }).join("");
    const summary = status.count < status.allowance
      ? `${status.count} of ${status.allowance} free Cokes used today`
      : `${status.allowance} of ${status.allowance} free Cokes used today${status.extraCount ? ` · ${status.extraCount} extra` : ""}`;
    return `
      <article class="glass-card section-card coke-card reveal-card">
        <div class="card-heading-row">
          <div>
            <span class="eyebrow">Daily allowance</span>
            <h2>${Config.labels.cokesToday}</h2>
          </div>
          <span class="mini-value">${status.freeRemaining} free left</span>
        </div>
        <div class="coke-cans" aria-label="${escapeHtml(summary)}">${cans}</div>
        <p class="card-summary">${summary}</p>
        <p class="rule-note">Every Coke after the free allowance costs exactly ${Config.COKE_EXTRA_COST} points.</p>
        <button class="primary-button coke-button" type="button" data-action="log-coke">${icon("plus")}${escapeHtml(status.buttonLabel)}</button>
      </article>`;
  }

  function renderWaterCard() {
    const approved = Tasks.getApprovedWaterCount();
    const pending = State.get().submissions.filter((item) => item.type === "water" && item.date === State.getLocalDateKey() && item.status === "pending").length;
    return `
      <article class="glass-card section-card water-card reveal-card">
        <div class="water-layout">
          <div class="water-product"><img src="assets/water-bottle.png" alt="Chilled water bottle"></div>
          <div class="water-copy">
            <span class="eyebrow blue-eyebrow">Hydration reward</span>
            <h2>${Config.labels.waterToday}</h2>
            <div class="water-count"><strong class="serif-number">${approved}</strong><span>approved today</span></div>
            <p>Full bottles earn 1 point after Dylan approves them.</p>
          </div>
        </div>
        <button class="primary-button blue-button" type="button" data-action="log-water">${icon("droplet")}${pending ? `Log Water · ${pending} pending` : "Log Water"}</button>
      </article>`;
  }

  function effectDescription(effect) {
    if (!effect.expiresAt) return "Awaiting Dylan";
    const remaining = Math.max(0, new Date(effect.expiresAt).getTime() - Date.now());
    return WheelLock.formatDuration(remaining);
  }

  function renderEffectChip(effect) {
    const iconName = effect.type === "reduced-coke" ? "minus" : effect.type === "plug-timer" ? "clock" : isLockType(effect) ? "lock" : effect.type === "cold-water" ? "droplet" : "flame";
    return `
      <div class="effect-chip" data-effect-id="${escapeHtml(effect.id)}">
        <span class="effect-chip-icon">${icon(iconName)}</span>
        <span><strong>${escapeHtml(effect.name)}</strong><small ${effect.expiresAt ? `data-duration-mode="effect" data-until="${escapeHtml(effect.expiresAt)}"` : ""}>${escapeHtml(effectDescription(effect))}</small></span>
      </div>`;
  }

  function isLockType(effect) {
    return WheelLock.isLockEffect(effect);
  }

  function renderEffectsCard() {
    const effects = WheelLock.getActiveEffects();
    if (!effects.length) return "";
    return `
      <article class="glass-card section-card effects-card reveal-card">
        <div class="card-heading-row">
          <div><span class="eyebrow">Live rules</span><h2>${Config.labels.activeEffects}</h2></div>
          <span class="mini-value crimson">${effects.length} active</span>
        </div>
        <div class="effect-chip-list">${effects.map(renderEffectChip).join("")}</div>
      </article>`;
  }

  function renderHome() {
    const root = document.getElementById("home-content");
    if (!root) return;
    root.innerHTML = `
      <div class="screen-intro">
        <p class="greeting">Dylan <span>×</span> Jamie</p>
        <p class="date-line">${new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
      </div>
      ${renderBalanceCard()}
      ${renderLockCard(false)}
      ${renderRequiredCard()}
      ${renderCokeCard()}
      ${renderWaterCard()}
      ${renderEffectsCard()}`;
  }

  function renderTaskRow(task, requiredIndex) {
    const date = State.getLocalDateKey();
    const submission = Tasks.findChoreSubmission(task.id, date);
    const status = submission ? submission.status : "available";
    return `
      <div class="task-choice status-${escapeHtml(status)}">
        <span class="task-choice-icon">${taskIcon(task.icon)}</span>
        <span class="task-choice-copy">
          <span class="task-title-line"><strong>${escapeHtml(task.name)}</strong>${requiredIndex >= 0 ? `<em>Mission ${requiredIndex + 1}</em>` : ""}</span>
          <small>${status === "available" ? "Submit for 1 point" : status === "pending" ? "Pending Dylan’s review" : status === "approved" ? "Approved · +1 point" : status === "teased" ? "Teased · no point" : "Denied · no point"}</small>
        </span>
        <button class="task-log-button" type="button" data-action="log-chore" data-task-id="${escapeHtml(task.id)}" ${submission ? "disabled" : ""} aria-label="${submission ? escapeHtml(status) : `Log ${escapeHtml(task.name)}`}">${statusIcon(status)}</button>
      </div>`;
  }

  function renderTasks() {
    const root = document.getElementById("tasks-content");
    if (!root) return;
    const required = Tasks.getRequired();
    const progress = Tasks.getRequiredProgress();
    root.innerHTML = `
      <header class="screen-header">
        <span class="eyebrow">Jamie’s missions</span>
        <h1 id="tasks-heading">Tasks</h1>
        <p>Submit each chore once per day. Dylan decides whether it earns the point.</p>
      </header>
      <article class="glass-card task-progress-card reveal-card">
        <div><strong class="serif-number">${progress.completed}/${progress.total}</strong><span>Required approved</span></div>
        <div class="task-progress-track"><span style="width:${(progress.completed / progress.total) * 100}%"></span></div>
      </article>
      <article class="glass-card section-card reveal-card">
        <div class="card-heading-row"><div><span class="eyebrow">All choices</span><h2>Chore Board</h2></div><span class="mini-value">+1 each</span></div>
        <div class="task-choice-list">
          ${Config.chores.map((task) => renderTaskRow(task, required.taskIds.indexOf(task.id))).join("")}
        </div>
      </article>`;
  }

  function renderWheel() {
    const root = document.getElementById("wheel-content");
    if (!root) return;
    const state = State.get();
    const pending = state.wheel.pendingSpin;
    const result = state.wheel.lastResult;
    const risk = state.wheel.riskOffer;
    root.innerHTML = `
      <header class="screen-header centered-header">
        <span class="eyebrow">Fate costs tickets</span>
        <h1 id="wheel-heading">The Wheel</h1>
        <p>Standard spins are a true 50/50 split between pleasure and punishment.</p>
      </header>
      <div class="wheel-ticket-badge">${icon("ticket")}<strong>${state.balances.tickets}</strong><span>available</span></div>
      <div class="wheel-stage">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <div class="wheel-glow" aria-hidden="true"></div>
        <div class="wheel-rotor ${pending ? "is-spinning" : ""}" id="wheel-rotor" style="transform:rotate(${wheelRotation}deg)" role="img" aria-label="Pleasure and punishment wheel">
          <div class="wheel-center"><span>${icon("wheel")}</span><strong>${pending ? "SPINNING" : "HOUSEPLAY"}</strong></div>
          ${Array.from({ length: 10 }, (_, index) => `<span class="wheel-tick" style="--tick:${index}"></span>`).join("")}
        </div>
      </div>
      <div class="wheel-actions">
        <button class="primary-button spin-button" type="button" data-action="spin-standard" ${pending || risk || state.balances.tickets < Config.STANDARD_SPIN_COST ? "disabled" : ""}>${icon("wheel")}Spin · 1 Ticket</button>
        <button class="secondary-button gold-button" type="button" data-action="spin-guaranteed" ${pending || risk || state.balances.tickets < Config.GUARANTEED_PLEASURE_COST ? "disabled" : ""}>${icon("star")}Guaranteed Pleasure · 5</button>
      </div>
      ${risk ? `
        <article class="glass-card risk-card result-rise">
          <span class="eyebrow">Second-ticket risk</span>
          <h2>Risk another ticket?</h2>
          <p>A pleasure result cancels <strong>${escapeHtml(risk.outcome.label)}</strong>. Another punishment makes it double.</p>
          <div class="button-row"><button class="primary-button" type="button" data-action="spin-risk" ${pending || state.balances.tickets < 1 ? "disabled" : ""}>Risk 1 Ticket</button><button class="secondary-button" type="button" data-action="decline-risk">Keep Punishment</button></div>
        </article>` : ""}
      ${result ? `
        <article class="glass-card wheel-result-card result-rise ${result.category}">
          <span class="result-kicker">${escapeHtml(result.headline)}</span>
          <h2>${escapeHtml(result.label)}</h2>
          <p>${escapeHtml(result.detail || (result.category === "pleasure" ? "Enjoy the result." : "The result has been applied."))}</p>
          ${result.resolvedLockMode ? `<span class="result-lock-mode">${icon(result.resolvedLockMode === "locked" ? "lock" : "unlock")}${escapeHtml(result.resolvedLockMode === "locked" ? "Locked result" : "Unlocked result")}</span>` : ""}
        </article>` : ""}
      <article class="glass-card wheel-odds-card reveal-card">
        <div><span>Pleasure</span><strong>50%</strong></div><div class="odds-divider"></div><div><span>Punishment</span><strong>50%</strong></div>
      </article>`;
  }

  function renderLock() {
    const root = document.getElementById("lock-content");
    if (!root) return;
    const info = WheelLock.getLockInfo();
    const lockEffects = WheelLock.getActiveEffects().filter(isLockType);
    root.innerHTML = `
      <header class="screen-header">
        <span class="eyebrow">Persistent timer</span>
        <h1 id="lock-heading">Lock</h1>
        <p>Real timestamps keep the timer accurate even after the browser closes.</p>
      </header>
      ${renderLockCard(true)}
      <div class="lock-detail-grid">
        <article class="glass-card detail-tile"><span>Started</span><strong>${info.startedAt ? formatDateTime(info.startedAt) : "Not active"}</strong></article>
        <article class="glass-card detail-tile"><span>Elapsed</span><strong class="serif-number" data-duration-mode="lock-elapsed" data-started-at="${escapeHtml(info.startedAt || "")}">${WheelLock.formatDuration(info.elapsedMs)}</strong></article>
        <article class="glass-card detail-tile wide"><span>Minimum unlock</span><strong>${info.lockMinimumUntil ? formatDateTime(info.lockMinimumUntil) : "No forced minimum"}</strong></article>
      </div>
      ${lockEffects.length ? `<article class="glass-card section-card"><div class="card-heading-row"><div><span class="eyebrow">Wheel restrictions</span><h2>Active Lock Effects</h2></div></div><div class="effect-chip-list">${lockEffects.map(renderEffectChip).join("")}</div></article>` : ""}
      <article class="glass-card lock-control-card">
        <h2>${info.active ? "Unlock requires Dylan" : "Ready when you are"}</h2>
        <p>${info.forced ? "Jamie cannot end this lock until its minimum time passes. Dylan can use the emergency override if needed." : info.active ? "A normal unlock is permitted, but the request still opens Dylan Admin." : "Starting creates a new timestamped lock session."}</p>
        <button class="primary-button" type="button" data-action="${info.active ? "request-unlock" : "start-lock"}">${icon(info.active ? "unlock" : "lock")}${info.active ? "Request Unlock" : "Start Lock"}</button>
      </article>`;
  }

  function historyCategory(entry) {
    const type = entry.type || "";
    if (/^(chore|water|daily)/.test(type)) return "chores";
    if (/coke/.test(type)) return "cokes";
    if (/^(wheel|effect)/.test(type)) return "wheel";
    if (/^lock/.test(type)) return "lock";
    if (/point|ticket|manual-adjustment/.test(type)) return "points";
    return "other";
  }

  function historyIcon(entry) {
    const category = historyCategory(entry);
    if (category === "chores") return entry.type.startsWith("water") ? "droplet" : "check";
    if (category === "cokes") return "plus";
    if (category === "wheel") return "wheel";
    if (category === "lock") return "lock";
    if (category === "points") return entry.type.includes("ticket") ? "ticket" : "star";
    return "clock";
  }

  function renderHistoryEntry(entry) {
    const delta = Number(entry.pointChange) || 0;
    return `
      <li class="history-entry">
        <span class="history-entry-icon category-${historyCategory(entry)}">${icon(historyIcon(entry))}</span>
        <span class="history-entry-copy">
          <strong>${escapeHtml(entry.name)}</strong>
          <small>${formatDateTime(entry.timestamp)} · ${escapeHtml(entry.status)}</small>
          ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
        </span>
        ${delta ? `<span class="point-delta ${delta > 0 ? "positive" : "negative"}">${delta > 0 ? "+" : ""}${delta}</span>` : ""}
      </li>`;
  }

  function renderHistory() {
    const root = document.getElementById("history-content");
    if (!root) return;
    const filters = [
      ["all", "All"], ["chores", "Chores"], ["cokes", "Cokes"], ["wheel", "Wheel"], ["lock", "Lock"], ["points", "Points & tickets"]
    ];
    const entries = State.getHistoryNewestFirst().filter((entry) => historyFilter === "all" || historyCategory(entry) === historyFilter);
    root.innerHTML = `
      <header class="screen-header">
        <span class="eyebrow">Complete ledger</span>
        <h1 id="history-heading">History</h1>
        <p>Every approval, purchase, conversion, spin, timer, and effect is recorded here.</p>
      </header>
      <div class="filter-scroll" role="group" aria-label="History filters">
        ${filters.map(([value, label]) => `<button class="filter-button ${historyFilter === value ? "is-active" : ""}" type="button" data-action="history-filter" data-filter="${value}">${escapeHtml(label)}</button>`).join("")}
      </div>
      <article class="glass-card history-card">
        ${entries.length ? `<ol class="history-list">${entries.map(renderHistoryEntry).join("")}</ol>` : '<div class="empty-state">No matching history yet.</div>'}
      </article>`;
  }

  function animateBalanceChange() {
    const balances = State.get().balances;
    if (!previousBalances) {
      previousBalances = { ...balances };
      return;
    }
    const pointDelta = balances.points - previousBalances.points;
    const ticketDelta = balances.tickets - previousBalances.tickets;
    previousBalances = { ...balances };
    const layer = document.getElementById("point-float-layer");
    if (!layer || (!pointDelta && !ticketDelta)) return;
    const float = document.createElement("div");
    float.className = `balance-float ${pointDelta < 0 || ticketDelta < 0 ? "negative" : "positive"}`;
    float.textContent = ticketDelta ? `${ticketDelta > 0 ? "+" : ""}${ticketDelta} ticket${Math.abs(ticketDelta) === 1 ? "" : "s"}` : `${pointDelta > 0 ? "+" : ""}${pointDelta} point${Math.abs(pointDelta) === 1 ? "" : "s"}`;
    layer.appendChild(float);
    window.setTimeout(() => float.remove(), 1600);
  }

  function renderAll() {
    renderHome();
    renderTasks();
    renderWheel();
    renderLock();
    renderHistory();
    setScreen(currentScreen, false);
    animateBalanceChange();
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot && modalRoot.dataset.view === "admin") renderAdminModal(true);
  }

  function setScreen(name, focusMain) {
    const valid = ["home", "tasks", "wheel", "lock", "history"];
    currentScreen = valid.includes(name) ? name : "home";
    document.querySelectorAll("[data-screen]").forEach((screen) => {
      const active = screen.dataset.screen === currentScreen;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === currentScreen;
      button.classList.toggle("is-active", active);
      if (button.classList.contains("nav-item")) {
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    if (focusMain !== false) {
      const main = document.getElementById("app-main");
      if (main) main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  function toast(message, type) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast ${type || "info"}`;
    item.innerHTML = `<span>${type === "error" ? icon("x") : icon("check")}</span><p>${escapeHtml(message)}</p>`;
    region.appendChild(item);
    window.setTimeout(() => item.classList.add("is-visible"), 20);
    window.setTimeout(() => {
      item.classList.remove("is-visible");
      window.setTimeout(() => item.remove(), 260);
    }, 3400);
  }

  function modalShell(content, options) {
    const settings = options || {};
    const root = document.getElementById("modal-root");
    lastFocusedElement = settings.preserveFocus ? lastFocusedElement : document.activeElement;
    modalIsCritical = Boolean(settings.critical);
    root.dataset.view = settings.view || "generic";
    root.innerHTML = `
      <div class="modal-backdrop" data-action="${modalIsCritical ? "" : "close-modal"}">
        <section class="modal-panel ${settings.wide ? "wide-modal" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
          ${content}
        </section>
      </div>`;
    document.body.classList.add("modal-open");
    if (!settings.preserveFocus) {
      window.setTimeout(() => {
        const focusTarget = root.querySelector("[autofocus], input, button, select, textarea, [tabindex='0']");
        if (focusTarget) focusTarget.focus();
      }, 0);
    }
  }

  function closeModal() {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    delete root.dataset.view;
    document.body.classList.remove("modal-open");
    modalIsCritical = false;
    pendingConfirm = null;
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
    lastFocusedElement = null;
  }

  function pendingAdminCards() {
    const pending = Tasks.getPendingSubmissions();
    if (!pending.length) return '<div class="admin-empty">Nothing is waiting for review.</div>';
    return pending.map((item) => `
      <div class="admin-review-item">
        <span class="admin-review-icon">${icon(item.type === "water" ? "droplet" : "check")}</span>
        <span class="admin-review-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.type === "water" ? "Water" : "Chore"} · ${formatDateTime(item.timestamp)}</small></span>
        <div class="review-actions">
          <button type="button" class="review-button approve" data-action="review-submission" data-id="${escapeHtml(item.id)}" data-decision="approved" aria-label="Approve ${escapeHtml(item.name)}">${icon("check")}</button>
          <button type="button" class="review-button deny" data-action="review-submission" data-id="${escapeHtml(item.id)}" data-decision="denied" aria-label="Deny ${escapeHtml(item.name)}">${icon("x")}</button>
          ${item.type === "chore" ? `<button type="button" class="review-button tease" data-action="review-submission" data-id="${escapeHtml(item.id)}" data-decision="teased" aria-label="Mark ${escapeHtml(item.name)} as teased">${icon("flame")}</button>` : ""}
        </div>
      </div>`).join("");
  }

  function adminEffects() {
    const effects = WheelLock.getActiveEffects();
    if (!effects.length) return '<div class="admin-empty">No active effects.</div>';
    return effects.map((effect) => `
      <div class="admin-effect-item">
        <span><strong>${escapeHtml(effect.name)}</strong><small ${effect.expiresAt ? `data-duration-mode="effect" data-until="${escapeHtml(effect.expiresAt)}"` : ""}>${escapeHtml(effectDescription(effect))}</small></span>
        <div class="admin-effect-actions">
          ${!effect.expiresAt ? `<button class="small-button" type="button" data-action="complete-effect" data-id="${escapeHtml(effect.id)}">Complete</button>` : ""}
          <button class="small-button danger-text" type="button" data-action="remove-effect" data-id="${escapeHtml(effect.id)}">Remove</button>
        </div>
      </div>`).join("");
  }

  function adminLockHistory() {
    const entries = State.getHistoryNewestFirst().filter((entry) => entry.type.startsWith("lock")).slice(0, 6);
    if (!entries.length) return '<div class="admin-empty">No lock history yet.</div>';
    return `<ol class="mini-history">${entries.map((entry) => `<li><span>${escapeHtml(entry.name)}</span><small>${formatDateTime(entry.timestamp)}</small></li>`).join("")}</ol>`;
  }

  function adminRecentHistory() {
    const entries = State.getHistoryNewestFirst().slice(0, 12);
    if (!entries.length) return '<div class="admin-empty">No history yet.</div>';
    return `<ol class="mini-history">${entries.map((entry) => `<li><span>${escapeHtml(entry.name)}${entry.pointChange ? ` <em>${entry.pointChange > 0 ? "+" : ""}${entry.pointChange}</em>` : ""}</span><small>${formatDateTime(entry.timestamp)}</small></li>`).join("")}</ol>`;
  }

  function renderAdminModal(preserveFocus) {
    if (!adminUnlocked) {
      modalShell(`
        <header class="modal-header">
          <div><span class="eyebrow">Private controls</span><h2 id="modal-title">Dylan Admin</h2></div>
          <button class="modal-close" type="button" data-action="close-modal" aria-label="Close Dylan Admin">${icon("x")}</button>
        </header>
        <form class="admin-login" id="admin-login-form">
          <span class="admin-shield">${icon("shield")}</span>
          <label for="admin-password">Enter admin access code</label>
          <input id="admin-password" name="password" type="password" inputmode="numeric" autocomplete="off" required autofocus>
          <p class="form-message" id="admin-login-message" role="status"></p>
          <button class="primary-button" type="submit">Unlock Dylan Admin</button>
        </form>`, { view: "admin", preserveFocus: Boolean(preserveFocus) });
      return;
    }

    const state = State.get();
    const lock = WheelLock.getLockInfo();
    const required = Tasks.getRequired();
    modalShell(`
      <header class="modal-header sticky-modal-header">
        <div><span class="eyebrow">Control room</span><h2 id="modal-title">Dylan Admin</h2></div>
        <button class="modal-close" type="button" data-action="close-modal" aria-label="Close Dylan Admin">${icon("x")}</button>
      </header>
      <div class="admin-dashboard">
        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Review queue</span><h3>Pending approvals</h3></div><span class="count-badge">${Tasks.getPendingSubmissions().length}</span></div>
          <div class="admin-review-list">${pendingAdminCards()}</div>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Balance control</span><h3>Point adjustment</h3></div><span class="admin-balance">${state.balances.points} pts · ${state.balances.tickets} tix</span></div>
          <form class="admin-inline-form" id="point-adjust-form">
            <label><span>Amount</span><input type="number" name="amount" step="1" placeholder="+1 or -1" required></label>
            <label><span>Note</span><input type="text" name="note" maxlength="120" placeholder="Optional reason"></label>
            <button class="secondary-button" type="submit">Apply</button>
          </form>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Daily close</span><h3>Finalize Today</h3></div></div>
          <p>Each required chore that is not approved deducts 1 point. This can run only once today.</p>
          <button class="secondary-button ${required.finalized ? "disabled-look" : ""}" type="button" data-action="finalize-today" ${required.finalized ? "disabled" : ""}>${required.finalized ? "Already Finalized" : "Finalize Today"}</button>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Lock control</span><h3>${lock.active ? "Active lock" : "Lock is inactive"}</h3></div><span class="status-dot ${lock.forced ? "danger" : "gold"}">${lock.forced ? WheelLock.formatDuration(lock.remainingMs) : lock.active ? "Normal unlock" : "Inactive"}</span></div>
          <div class="admin-lock-actions">
            <button class="secondary-button" type="button" data-action="admin-end-lock" ${!lock.active ? "disabled" : ""}>End Lock Normally</button>
            <button class="danger-button" type="button" data-action="emergency-override" ${!lock.active ? "disabled" : ""}>Emergency Override</button>
          </div>
          <form class="admin-inline-form compact-form" id="add-lock-time-form">
            <label><span>Add minutes</span><input type="number" name="minutes" min="1" step="1" placeholder="60" required></label>
            <button class="secondary-button" type="submit">Add Lock Time</button>
          </form>
          <details class="admin-details"><summary>View lock history</summary>${adminLockHistory()}</details>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Live rules</span><h3>Active effects</h3></div></div>
          <div class="admin-effect-list">${adminEffects()}</div>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Audit trail</span><h3>Recent history</h3></div></div>
          ${adminRecentHistory()}
          <button class="text-button" type="button" data-action="admin-view-history">Open complete history</button>
        </section>

        <section class="admin-section">
          <div class="admin-section-heading"><div><span class="eyebrow">Backup</span><h3>Data controls</h3></div></div>
          <div class="data-button-grid">
            <button class="secondary-button" type="button" data-action="export-data">${icon("download")}Export JSON</button>
            <label class="secondary-button file-button">${icon("upload")}Import JSON<input type="file" id="import-file" accept="application/json,.json"></label>
          </div>
          <button class="danger-button full-width" type="button" data-action="reset-data">${icon("trash")}Full Reset</button>
        </section>

        <button class="lock-admin-button" type="button" data-action="lock-admin">${icon("lock")}Lock Admin</button>
      </div>`, { view: "admin", wide: true, preserveFocus: Boolean(preserveFocus) });
  }

  function openAdmin() {
    renderAdminModal(false);
  }

  function lockAdmin() {
    adminUnlocked = false;
    renderAdminModal(false);
  }

  async function verifyAdmin(value) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Secure browser hashing is unavailable in this preview.");
    const bytes = new TextEncoder().encode(String(value));
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const valid = hash === Config.ADMIN_HASH;
    if (valid) adminUnlocked = true;
    return valid;
  }

  function showConfirm(options) {
    pendingConfirm = {
      onConfirm: options.onConfirm,
      returnToAdmin: Boolean(options.returnToAdmin)
    };
    modalShell(`
      <header class="modal-header">
        <div><span class="eyebrow">Please confirm</span><h2 id="modal-title">${escapeHtml(options.title)}</h2></div>
      </header>
      <div class="confirm-copy"><span class="confirm-icon">${icon(options.danger ? "trash" : "shield")}</span><p>${escapeHtml(options.message)}</p></div>
      <div class="button-row modal-actions">
        <button class="secondary-button" type="button" data-action="cancel-confirm">Cancel</button>
        <button class="${options.danger ? "danger-button" : "primary-button"}" type="button" data-action="confirm-proceed" autofocus>${escapeHtml(options.confirmLabel || "Confirm")}</button>
      </div>`, { critical: Boolean(options.critical), view: "confirm" });
  }

  async function confirmProceed() {
    if (!pendingConfirm) return;
    const action = pendingConfirm.onConfirm;
    const returnToAdmin = pendingConfirm.returnToAdmin;
    closeModal();
    await action();
    if (returnToAdmin && adminUnlocked) openAdmin();
  }

  function cancelConfirm() {
    const returnToAdmin = pendingConfirm && pendingConfirm.returnToAdmin;
    closeModal();
    if (returnToAdmin && adminUnlocked) openAdmin();
  }

  function handleModalKeydown(event) {
    const root = document.getElementById("modal-root");
    if (!root || !root.firstElementChild) return;
    if (event.key === "Escape" && !modalIsCritical) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(root.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex='0']"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function tick() {
    const now = Date.now();
    document.querySelectorAll("[data-duration-mode]").forEach((element) => {
      const mode = element.dataset.durationMode;
      if (mode === "effect" || mode === "lock-remaining") {
        const until = new Date(element.dataset.until).getTime();
        element.textContent = WheelLock.formatDuration(Math.max(0, until - now));
      }
      if (mode === "lock-elapsed") {
        const started = new Date(element.dataset.startedAt).getTime();
        element.textContent = Number.isFinite(started) ? WheelLock.formatDuration(Math.max(0, now - started)) : "00:00:00";
      }
    });
    const info = WheelLock.getLockInfo(now);
    document.querySelectorAll("[data-lock-progress]").forEach((element) => {
      element.style.width = `${info.progress.toFixed(1)}%`;
    });
  }

  function runWheelAnimation() {
    const rotor = document.getElementById("wheel-rotor");
    if (!rotor) return Promise.resolve();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 280 : 3200;
    wheelRotation += (reduced ? 360 : 1800) + Math.floor(Math.random() * 320) + 20;
    rotor.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.08,1)`;
    rotor.getBoundingClientRect();
    rotor.style.transform = `rotate(${wheelRotation}deg)`;
    return new Promise((resolve) => window.setTimeout(resolve, duration + 80));
  }

  function showLoadWarning() {
    const warning = State.getLoadWarning();
    if (warning) toast(warning, "error");
  }

  HousePlay.UI = {
    renderAll,
    setScreen,
    getCurrentScreen: () => currentScreen,
    setHistoryFilter: (value) => { historyFilter = value; renderHistory(); },
    toast,
    openAdmin,
    renderAdminModal,
    lockAdmin,
    verifyAdmin,
    closeModal,
    showConfirm,
    confirmProceed,
    cancelConfirm,
    handleModalKeydown,
    tick,
    runWheelAnimation,
    showLoadWarning,
    isAdminUnlocked: () => adminUnlocked,
    escapeHtml
  };
})();
