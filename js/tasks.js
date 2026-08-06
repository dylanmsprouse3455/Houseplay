(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};
  const Config = HousePlay.Config;
  const State = HousePlay.State;

  function secureRandomIndex(length) {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function chooseRequiredTasks() {
    const pool = Config.chores.map((task) => task.id);
    const choices = [];
    while (choices.length < Config.REQUIRED_TASK_COUNT && pool.length) {
      const index = secureRandomIndex(pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    return choices;
  }

  function isValidRequiredRecord(record) {
    if (!record || !Array.isArray(record.taskIds)) return false;
    if (record.taskIds.length !== Config.REQUIRED_TASK_COUNT) return false;
    if (new Set(record.taskIds).size !== Config.REQUIRED_TASK_COUNT) return false;
    return record.taskIds.every((id) => Config.chores.some((task) => task.id === id));
  }

  function ensureRequired(dateKey) {
    const state = State.get();
    const key = dateKey || State.getLocalDateKey();
    const existing = state.dailyRequired[key];
    if (isValidRequiredRecord(existing)) return existing;

    const taskIds = chooseRequiredTasks();
    state.dailyRequired[key] = {
      date: key,
      taskIds,
      generatedAt: State.nowIso(),
      finalized: Boolean(existing && existing.finalized),
      finalizedAt: existing && existing.finalizedAt ? existing.finalizedAt : null
    };
    State.commit();
    return state.dailyRequired[key];
  }

  function getRequired(dateKey) {
    return ensureRequired(dateKey || State.getLocalDateKey());
  }

  function getTask(taskId) {
    return Config.chores.find((task) => task.id === taskId) || null;
  }

  function findChoreSubmission(taskId, dateKey) {
    return State.get().submissions.find((item) => item.type === "chore" && item.taskId === taskId && item.date === dateKey) || null;
  }

  function getRequiredProgress(dateKey) {
    const key = dateKey || State.getLocalDateKey();
    const record = getRequired(key);
    const completed = record.taskIds.filter((taskId) => {
      const submission = findChoreSubmission(taskId, key);
      return submission && submission.status === "approved";
    }).length;
    return { completed, total: Config.REQUIRED_TASK_COUNT };
  }

  function logChore(taskId) {
    const state = State.get();
    const task = getTask(taskId);
    const date = State.getLocalDateKey();
    if (!task) return { ok: false, message: "That chore is not available." };
    if (findChoreSubmission(taskId, date)) {
      return { ok: false, message: `${task.name} has already been logged today.` };
    }

    const submission = {
      id: State.createId("chore"),
      type: "chore",
      taskId,
      name: task.name,
      date,
      timestamp: State.nowIso(),
      status: "pending",
      reviewedAt: null,
      pointsAwarded: false
    };
    state.submissions.push(submission);
    State.addHistory({
      type: "chore-submission",
      name: task.name,
      pointChange: 0,
      status: "pending",
      note: "Waiting for Dylan’s review."
    });
    State.commit();
    return { ok: true, submission, message: `${task.name} sent for review.` };
  }

  function logWater() {
    const state = State.get();
    const date = State.getLocalDateKey();
    const submission = {
      id: State.createId("water"),
      type: "water",
      taskId: null,
      name: "Full water bottle",
      date,
      timestamp: State.nowIso(),
      status: "pending",
      reviewedAt: null,
      pointsAwarded: false
    };
    state.submissions.push(submission);
    State.addHistory({
      type: "water-submission",
      name: "Full water bottle submitted",
      pointChange: 0,
      status: "pending",
      note: "No point is awarded until Dylan approves it."
    });
    State.commit();
    return { ok: true, submission, message: "Water bottle sent for approval." };
  }

  function totalStoredValue() {
    const balances = State.get().balances;
    return balances.points + (balances.tickets * Config.POINTS_PER_TICKET);
  }

  function breakTicket(reason, commit) {
    const state = State.get();
    if (state.balances.tickets < 1) return false;
    state.balances.tickets -= 1;
    state.balances.points += Config.POINTS_PER_TICKET;
    State.addHistory({
      type: "ticket-conversion",
      name: "Ticket converted to points",
      pointChange: Config.POINTS_PER_TICKET,
      status: "completed",
      note: reason || "1 ticket became 10 loose points."
    });
    if (commit !== false) State.commit();
    return true;
  }

  function convertPointsToTickets(commit) {
    const state = State.get();
    let converted = 0;
    while (state.balances.points >= Config.POINTS_PER_TICKET) {
      state.balances.points -= Config.POINTS_PER_TICKET;
      state.balances.tickets += 1;
      converted += 1;
      State.addHistory({
        type: "ticket-earned",
        name: "Ticket earned",
        pointChange: -Config.POINTS_PER_TICKET,
        status: "completed",
        note: "10 points automatically became 1 ticket."
      });
    }
    if (commit !== false && converted) State.commit();
    return converted;
  }

  function adjustPoints(amount, details, options) {
    const state = State.get();
    const delta = Math.trunc(Number(amount));
    const info = details || {};
    const settings = options || {};
    if (!Number.isFinite(delta) || delta === 0) return { ok: false, message: "Enter a non-zero point amount." };

    if (delta < 0 && settings.useStoredValue) {
      const cost = Math.abs(delta);
      if (!settings.allowDebt && totalStoredValue() < cost) {
        return { ok: false, message: "Not enough stored points." };
      }
      while (state.balances.points < cost && state.balances.tickets > 0) {
        breakTicket(info.ticketReason || info.name || "Points were needed.", false);
      }
      state.balances.points -= cost;
    } else {
      if (delta < 0 && !settings.allowDebt && state.balances.points < Math.abs(delta)) {
        return { ok: false, message: "Not enough loose points." };
      }
      state.balances.points += delta;
    }

    State.addHistory({
      type: info.type || "point-adjustment",
      name: info.name || (delta > 0 ? "Points added" : "Points removed"),
      pointChange: delta,
      status: info.status || "completed",
      note: info.note || ""
    });

    if (delta > 0) convertPointsToTickets(false);
    if (settings.commit !== false) State.commit();
    return { ok: true, delta };
  }

  function spendStoredPoints(amount, details, options) {
    const cost = Math.max(0, Math.trunc(Number(amount)));
    if (!cost) return { ok: false, message: "The point cost is invalid." };
    return adjustPoints(-cost, details, {
      useStoredValue: true,
      allowDebt: Boolean(options && options.allowDebt),
      commit: !(options && options.commit === false)
    });
  }

  function spendTickets(amount, details, commit) {
    const state = State.get();
    const cost = Math.max(0, Math.trunc(Number(amount)));
    if (!cost || state.balances.tickets < cost) {
      return { ok: false, message: `You need ${cost || 1} ticket${cost === 1 ? "" : "s"}.` };
    }
    state.balances.tickets -= cost;
    State.addHistory({
      type: (details && details.type) || "ticket-spend",
      name: (details && details.name) || "Ticket spent",
      pointChange: 0,
      status: (details && details.status) || "completed",
      note: (details && details.note) || `${cost} ticket${cost === 1 ? "" : "s"} spent.`
    });
    if (commit !== false) State.commit();
    return { ok: true, cost };
  }

  function reviewSubmission(submissionId, decision) {
    const state = State.get();
    const submission = state.submissions.find((item) => item.id === submissionId);
    const allowed = ["approved", "denied", "teased"];
    if (!submission || submission.status !== "pending" || !allowed.includes(decision)) {
      return { ok: false, message: "That submission is no longer pending." };
    }

    submission.status = decision;
    submission.reviewedAt = State.nowIso();

    if (decision === "approved") {
      const value = submission.type === "water" ? Config.WATER_POINT_VALUE : Config.CHORE_POINT_VALUE;
      submission.pointsAwarded = true;
      adjustPoints(value, {
        type: submission.type === "water" ? "water-approval" : "chore-approval",
        name: `${submission.name} approved`,
        status: "approved",
        note: `Dylan approved this ${submission.type}.`
      }, { commit: false });
    } else {
      submission.pointsAwarded = false;
      State.addHistory({
        type: submission.type === "water" ? `water-${decision}` : `chore-${decision}`,
        name: `${submission.name} ${decision === "teased" ? "marked as teased" : "denied"}`,
        pointChange: 0,
        status: decision,
        note: decision === "teased" ? "Logged, but no point was awarded." : "No point was awarded."
      });
    }
    State.commit();
    return { ok: true, message: `${submission.name} ${decision}.` };
  }

  function getApprovedWaterCount(dateKey) {
    const key = dateKey || State.getLocalDateKey();
    return State.get().submissions.filter((item) => item.type === "water" && item.date === key && item.status === "approved").length;
  }

  function getPendingSubmissions() {
    return State.get().submissions.filter((item) => item.status === "pending").sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  function finalizeToday() {
    const state = State.get();
    const date = State.getLocalDateKey();
    const record = ensureRequired(date);
    if (record.finalized) return { ok: false, message: "Today has already been finalized." };

    const missedTasks = record.taskIds.filter((taskId) => {
      const submission = findChoreSubmission(taskId, date);
      return !submission || submission.status !== "approved";
    });

    missedTasks.forEach((taskId) => {
      const task = getTask(taskId);
      spendStoredPoints(1, {
        type: "daily-penalty",
        name: `${task ? task.name : "Required chore"} not completed`,
        status: "deducted",
        note: "Required Today penalty applied during finalization."
      }, { allowDebt: true, commit: false });
    });

    record.finalized = true;
    record.finalizedAt = State.nowIso();
    State.addHistory({
      type: "daily-finalization",
      name: "Today finalized",
      pointChange: 0,
      status: "completed",
      note: missedTasks.length ? `${missedTasks.length} required chore${missedTasks.length === 1 ? "" : "s"} missed.` : "Both required chores were approved."
    });
    State.commit();
    return {
      ok: true,
      missed: missedTasks.length,
      message: missedTasks.length ? `Today finalized. ${missedTasks.length} point${missedTasks.length === 1 ? "" : "s"} deducted.` : "Today finalized with no deductions."
    };
  }

  function manualAdjust(amount, note) {
    const delta = Math.trunc(Number(amount));
    if (!delta) return { ok: false, message: "Enter a non-zero point amount." };
    return adjustPoints(delta, {
      type: "manual-adjustment",
      name: delta > 0 ? "Dylan added points" : "Dylan removed points",
      status: "completed",
      note: note || "Manual Dylan Admin adjustment."
    }, {
      useStoredValue: delta < 0,
      allowDebt: delta < 0,
      commit: true
    });
  }

  HousePlay.Tasks = {
    ensureRequired,
    getRequired,
    getRequiredProgress,
    getTask,
    findChoreSubmission,
    logChore,
    logWater,
    reviewSubmission,
    getApprovedWaterCount,
    getPendingSubmissions,
    totalStoredValue,
    adjustPoints,
    spendStoredPoints,
    spendTickets,
    breakTicket,
    convertPointsToTickets,
    finalizeToday,
    manualAdjust
  };
})();
