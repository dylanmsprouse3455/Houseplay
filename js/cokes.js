(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};
  const Config = HousePlay.Config;
  const State = HousePlay.State;
  const Tasks = HousePlay.Tasks;

  function activeReducedCokeEffects(atTime) {
    const now = atTime || Date.now();
    return State.get().activeEffects.filter((effect) => {
      if (effect.status !== "active" || effect.type !== "reduced-coke") return false;
      return !effect.expiresAt || new Date(effect.expiresAt).getTime() > now;
    });
  }

  function getFreeAllowance(atTime) {
    return activeReducedCokeEffects(atTime).length
      ? Config.REDUCED_COKE_ALLOWANCE
      : Config.STANDARD_COKE_ALLOWANCE;
  }

  function getLogsForDate(dateKey) {
    const key = dateKey || State.getLocalDateKey();
    return State.get().cokeLogs.filter((timestamp) => State.dateKeyFromTimestamp(timestamp) === key);
  }

  function getDailyCount(dateKey) {
    return getLogsForDate(dateKey).length;
  }

  function getTodayStatus() {
    const date = State.getLocalDateKey();
    const count = getDailyCount(date);
    const allowance = getFreeAllowance();
    const freeUsed = Math.min(count, allowance);
    const freeRemaining = Math.max(0, allowance - count);
    const extraCount = Math.max(0, count - allowance);
    return {
      date,
      count,
      allowance,
      freeUsed,
      freeRemaining,
      extraCount,
      nextIsPaid: count >= allowance,
      buttonLabel: count >= allowance
        ? `Log Extra Coke — ${Config.COKE_EXTRA_COST} Points`
        : "Log Coke — Free"
    };
  }

  function logCoke() {
    const state = State.get();
    const status = getTodayStatus();
    const timestamp = State.nowIso();

    if (!status.nextIsPaid) {
      state.cokeLogs.push(timestamp);
      State.addHistory({
        type: "coke-log",
        name: `Free Coke ${status.count + 1} logged`,
        pointChange: 0,
        status: "completed",
        note: `${Math.max(0, status.allowance - status.count - 1)} free Coke${status.allowance - status.count - 1 === 1 ? "" : "s"} remaining today.`
      });
      State.commit();
      return { ok: true, paid: false, message: "Coke logged — free." };
    }

    if (Tasks.totalStoredValue() < Config.COKE_EXTRA_COST) {
      return { ok: false, message: `You need ${Config.COKE_EXTRA_COST} stored points for an extra Coke.` };
    }

    const purchase = Tasks.spendStoredPoints(Config.COKE_EXTRA_COST, {
      type: "extra-coke-purchase",
      name: `Extra Coke ${status.extraCount + 1} purchased`,
      status: "completed",
      note: `Extra Cokes cost exactly ${Config.COKE_EXTRA_COST} points.`
    }, { allowDebt: false, commit: false });

    if (!purchase.ok) return purchase;
    state.cokeLogs.push(timestamp);
    State.commit();
    return { ok: true, paid: true, message: `Extra Coke logged — ${Config.COKE_EXTRA_COST} points used.` };
  }

  HousePlay.Cokes = {
    getFreeAllowance,
    getLogsForDate,
    getDailyCount,
    getTodayStatus,
    logCoke,
    activeReducedCokeEffects
  };
})();
