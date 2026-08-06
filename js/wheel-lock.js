(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};
  const Config = HousePlay.Config;
  const State = HousePlay.State;
  const Tasks = HousePlay.Tasks;

  function randomIndex(length) {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function randomBoolean() {
    return randomIndex(2) === 1;
  }

  function cloneOutcome(source, category) {
    const outcome = { ...source, category };
    if (category === "pleasure") {
      outcome.resolvedLockMode = source.lockMode === "random"
        ? (randomBoolean() ? "locked" : "unlocked")
        : source.lockMode;
      if (source.lockMode === "random") {
        outcome.detail = outcome.resolvedLockMode === "locked" ? "Locked version" : "Unlocked version";
      }
    }
    return outcome;
  }

  function selectOutcome(category) {
    const choices = category === "pleasure" ? Config.pleasureOutcomes : Config.punishmentOutcomes;
    return cloneOutcome(choices[randomIndex(choices.length)], category);
  }

  function addEffect(options, commit) {
    const state = State.get();
    const startedAt = options.startedAt || State.nowIso();
    const expiresAt = options.expiresAt || (options.durationMs ? new Date(new Date(startedAt).getTime() + options.durationMs).toISOString() : null);
    const effect = {
      id: options.id || State.createId("effect"),
      type: options.type,
      name: options.name,
      startedAt,
      expiresAt,
      status: "active",
      sourceSpinId: options.sourceSpinId || null,
      note: options.note || "",
      meta: options.meta || {}
    };
    state.activeEffects.push(effect);
    State.addHistory({
      type: "effect-start",
      name: effect.name,
      pointChange: 0,
      status: "active",
      note: effect.expiresAt ? `Effect active until ${new Date(effect.expiresAt).toLocaleString()}.` : "Effect remains active until Dylan completes it."
    });
    if (commit !== false) State.commit();
    return effect;
  }

  function isLockEffect(effect) {
    return effect.type === "lock-extension" || effect.type === "manual-lock-extension";
  }

  function recomputeLockMinimum() {
    const state = State.get();
    const remaining = state.activeEffects
      .filter((effect) => effect.status === "active" && isLockEffect(effect) && effect.expiresAt)
      .map((effect) => new Date(effect.expiresAt).getTime())
      .filter((time) => Number.isFinite(time) && time > Date.now());
    state.lock.lockMinimumUntil = remaining.length ? new Date(Math.max(...remaining)).toISOString() : null;
  }

  function removeEffect(effectId, options) {
    const state = State.get();
    const settings = options || {};
    const index = state.activeEffects.findIndex((effect) => effect.id === effectId);
    if (index < 0) return false;
    const effect = state.activeEffects[index];
    state.activeEffects.splice(index, 1);
    if (isLockEffect(effect) && settings.recomputeLock !== false) recomputeLockMinimum();
    if (settings.addHistory !== false) {
      State.addHistory({
        type: settings.historyType || "effect-removed",
        name: effect.name,
        pointChange: 0,
        status: settings.status || "completed",
        note: settings.note || "Effect removed by Dylan Admin."
      });
    }
    if (settings.commit !== false) State.commit();
    return true;
  }

  function getActiveEffects() {
    const now = Date.now();
    return State.get().activeEffects.filter((effect) => {
      if (effect.status !== "active") return false;
      if (!effect.expiresAt) return true;
      return new Date(effect.expiresAt).getTime() > now;
    });
  }

  function refreshEffects() {
    const state = State.get();
    const now = Date.now();
    const expired = state.activeEffects.filter((effect) => effect.status === "active" && effect.expiresAt && new Date(effect.expiresAt).getTime() <= now);
    if (!expired.length) {
      if (state.lock.lockMinimumUntil && new Date(state.lock.lockMinimumUntil).getTime() <= now) {
        state.lock.lockMinimumUntil = null;
        State.commit();
      }
      return [];
    }

    expired.forEach((effect) => {
      const index = state.activeEffects.findIndex((item) => item.id === effect.id);
      if (index >= 0) state.activeEffects.splice(index, 1);
      State.addHistory({
        type: "effect-expiration",
        name: effect.name,
        pointChange: 0,
        status: "expired",
        note: "Timed wheel effect expired automatically."
      });
    });
    recomputeLockMinimum();
    State.commit();
    return expired;
  }

  function getLockSnapshot() {
    return State.deepClone(State.get().lock);
  }

  function startLock(reason, options) {
    const state = State.get();
    const settings = options || {};
    if (state.lock.active) return { ok: true, alreadyActive: true };
    state.lock.active = true;
    state.lock.startedAt = State.nowIso();
    state.lock.endedAt = null;
    state.lock.reason = reason || "Started manually";
    State.addHistory({
      type: "lock-start",
      name: "Lock started",
      pointChange: 0,
      status: "active",
      note: state.lock.reason
    });
    if (settings.commit !== false) State.commit();
    return { ok: true, alreadyActive: false };
  }

  function clearLockEffects(note, commit) {
    const state = State.get();
    const lockEffects = state.activeEffects.filter((effect) => isLockEffect(effect));
    lockEffects.forEach((effect) => removeEffect(effect.id, {
      commit: false,
      recomputeLock: false,
      historyType: "effect-removed",
      status: "cancelled",
      note: note || "Lock effect ended."
    }));
    state.lock.lockMinimumUntil = null;
    if (commit !== false && lockEffects.length) State.commit();
    return lockEffects.length;
  }

  function endLock(options) {
    const state = State.get();
    const settings = options || {};
    if (!state.lock.active) return { ok: false, message: "The lock is not active." };
    const minimumTime = state.lock.lockMinimumUntil ? new Date(state.lock.lockMinimumUntil).getTime() : 0;
    if (!settings.force && minimumTime > Date.now()) {
      return { ok: false, message: "The minimum wheel lock time has not passed yet." };
    }

    const startedAt = state.lock.startedAt;
    if (settings.force) clearLockEffects(settings.emergency ? "Removed by emergency override." : "Ended by an unlocked wheel result.", false);
    state.lock.active = false;
    state.lock.endedAt = State.nowIso();
    state.lock.lockMinimumUntil = null;
    state.lock.reason = "";
    State.addHistory({
      type: settings.emergency ? "lock-emergency-override" : "lock-end",
      name: settings.emergency ? "Emergency lock override" : "Lock ended",
      pointChange: 0,
      status: settings.emergency ? "override" : "completed",
      note: settings.reason || (startedAt ? `Lock began ${new Date(startedAt).toLocaleString()}.` : "")
    });
    if (settings.commit !== false) State.commit();
    return { ok: true, message: settings.emergency ? "Emergency override completed." : "Lock ended." };
  }

  function extendLock(durationMs, reason, options) {
    const state = State.get();
    const settings = options || {};
    if (!state.lock.active) startLock(reason || "Wheel lock", { commit: false });
    const existingMinimum = state.lock.lockMinimumUntil ? new Date(state.lock.lockMinimumUntil).getTime() : 0;
    const base = Math.max(Date.now(), Number.isFinite(existingMinimum) ? existingMinimum : 0);
    const minimumUntil = new Date(base + durationMs).toISOString();
    state.lock.lockMinimumUntil = minimumUntil;
    const effect = addEffect({
      type: settings.effectType || "lock-extension",
      name: settings.effectName || "Added lock time",
      expiresAt: minimumUntil,
      sourceSpinId: settings.sourceSpinId || null,
      note: reason || "Minimum lock time extended.",
      meta: { durationMs }
    }, false);
    if (settings.commit !== false) State.commit();
    return { ok: true, effect, minimumUntil };
  }

  function addManualLockTime(minutes) {
    const amount = Math.trunc(Number(minutes));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Enter a positive number of minutes." };
    const result = extendLock(amount * 60 * 1000, "Added in Dylan Admin", {
      effectType: "manual-lock-extension",
      effectName: "Manual lock time",
      commit: true
    });
    return { ...result, message: `${amount} minute${amount === 1 ? "" : "s"} added to the minimum lock.` };
  }

  function getLockInfo(atTime) {
    const state = State.get();
    const now = atTime || Date.now();
    const started = state.lock.startedAt ? new Date(state.lock.startedAt).getTime() : null;
    const minimum = state.lock.lockMinimumUntil ? new Date(state.lock.lockMinimumUntil).getTime() : null;
    const elapsedMs = state.lock.active && started ? Math.max(0, now - started) : 0;
    const remainingMs = state.lock.active && minimum ? Math.max(0, minimum - now) : 0;
    const forced = remainingMs > 0;
    const totalForcedWindow = started && minimum ? Math.max(1, minimum - started) : 1;
    return {
      active: state.lock.active,
      startedAt: state.lock.startedAt,
      lockMinimumUntil: state.lock.lockMinimumUntil,
      elapsedMs,
      remainingMs,
      forced,
      progress: forced ? Math.min(100, Math.max(0, (elapsedMs / totalForcedWindow) * 100)) : (state.lock.active ? 100 : 0),
      reason: state.lock.reason || ""
    };
  }

  function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function applyPleasure(outcome) {
    if (outcome.resolvedLockMode === "locked") {
      startLock(`Wheel pleasure: ${outcome.label}`, { commit: false });
      return { kind: "pleasure-lock", mode: "locked" };
    }
    if (outcome.resolvedLockMode === "unlocked" && State.get().lock.active) {
      endLock({ force: true, reason: `Wheel pleasure: ${outcome.label}`, commit: false });
    }
    return { kind: "pleasure-lock", mode: "unlocked" };
  }

  function applyPunishment(outcome, spinId) {
    const transaction = { id: State.createId("transaction"), changes: [] };
    if (outcome.effectType === "cold-water") {
      const effect = addEffect({
        type: "cold-water",
        name: "Cold water punishment",
        sourceSpinId: spinId,
        note: "Awaiting completion by Dylan."
      }, false);
      transaction.changes.push({ kind: "effect", effectId: effect.id });
    }

    if (outcome.effectType === "lose-point") {
      Tasks.spendStoredPoints(1, {
        type: "wheel-punishment",
        name: "Wheel punishment: lose 1 point",
        status: "deducted",
        note: "Applied automatically by the wheel."
      }, { allowDebt: true, commit: false });
      transaction.changes.push({ kind: "point", amount: 1 });
    }

    if (outcome.effectType === "reduced-coke") {
      const effect = addEffect({
        type: "reduced-coke",
        name: "Reduced Coke allowance",
        durationMs: Config.REDUCED_COKE_DURATION_MS,
        sourceSpinId: spinId,
        note: "Jamie receives 3 free Cokes per day while active."
      }, false);
      transaction.changes.push({ kind: "effect", effectId: effect.id });
    }

    if (outcome.effectType === "plug-timer") {
      const effect = addEffect({
        type: "plug-timer",
        name: "Plug timer",
        durationMs: Config.PLUG_DURATION_MS,
        sourceSpinId: spinId,
        note: "Two-hour countdown."
      }, false);
      transaction.changes.push({ kind: "effect", effectId: effect.id });
    }

    if (outcome.effectType === "lock-extension") {
      const snapshot = getLockSnapshot();
      const result = extendLock(Config.LOCK_EXTENSION_MS, "Wheel punishment: another 12 hours", {
        effectType: "lock-extension",
        effectName: "Added lock time",
        sourceSpinId: spinId,
        commit: false
      });
      transaction.changes.push({ kind: "lock", snapshot, effectId: result.effect.id });
    }
    return transaction;
  }

  function reversePunishment(transaction) {
    const state = State.get();
    if (!transaction || !Array.isArray(transaction.changes)) return;
    transaction.changes.slice().reverse().forEach((change) => {
      if (change.kind === "effect") {
        removeEffect(change.effectId, {
          commit: false,
          historyType: "effect-cancelled",
          status: "cancelled",
          note: "Cancelled by a pleasure result on the risk spin."
        });
      }
      if (change.kind === "point") {
        Tasks.adjustPoints(change.amount, {
          type: "wheel-reversal",
          name: "Punishment point restored",
          status: "cancelled",
          note: "The risk spin landed on pleasure."
        }, { commit: false });
      }
      if (change.kind === "lock") {
        removeEffect(change.effectId, {
          commit: false,
          recomputeLock: false,
          historyType: "effect-cancelled",
          status: "cancelled",
          note: "Lock extension cancelled by the risk spin."
        });
        state.lock = State.deepClone(change.snapshot);
      }
    });
  }

  function prepareSpin(mode) {
    const state = State.get();
    const spinMode = mode || "standard";
    if (state.wheel.pendingSpin) return { ok: false, message: "A wheel spin is already in progress." };
    if (state.wheel.riskOffer && spinMode !== "risk") return { ok: false, message: "Choose whether to risk another ticket first." };

    let cost = Config.STANDARD_SPIN_COST;
    let category;
    if (spinMode === "guaranteed") {
      cost = Config.GUARANTEED_PLEASURE_COST;
      category = "pleasure";
    } else if (spinMode === "risk") {
      if (!state.wheel.riskOffer) return { ok: false, message: "There is no punishment to risk." };
      category = randomBoolean() ? "pleasure" : "punishment";
    } else {
      category = randomBoolean() ? "pleasure" : "punishment";
    }

    const ticketResult = Tasks.spendTickets(cost, {
      type: "ticket-spend",
      name: spinMode === "guaranteed" ? "Guaranteed pleasure spin" : (spinMode === "risk" ? "Risk spin" : "Standard wheel spin"),
      status: "spent",
      note: `${cost} ticket${cost === 1 ? "" : "s"} used.`
    }, false);
    if (!ticketResult.ok) return ticketResult;

    const pendingSpin = {
      id: State.createId("spin"),
      mode: spinMode,
      cost,
      category,
      outcome: selectOutcome(category),
      createdAt: State.nowIso()
    };
    state.wheel.pendingSpin = pendingSpin;
    State.commit();
    return { ok: true, pendingSpin };
  }

  function finalizePendingSpin() {
    const state = State.get();
    const pending = state.wheel.pendingSpin;
    if (!pending) return { ok: false, message: "No wheel spin is waiting." };
    const outcome = pending.outcome;
    const result = {
      id: pending.id,
      timestamp: State.nowIso(),
      mode: pending.mode,
      category: outcome.category,
      label: outcome.label,
      detail: outcome.detail,
      resolvedLockMode: outcome.resolvedLockMode || null,
      headline: ""
    };
    state.wheel.pendingSpin = null;

    if (pending.mode === "risk") {
      const offer = state.wheel.riskOffer;
      if (!offer) return { ok: false, message: "The original punishment is no longer available." };
      if (outcome.category === "pleasure") {
        reversePunishment(offer.transaction);
        applyPleasure(outcome);
        result.headline = "Punishment cancelled";
        State.addHistory({
          type: "wheel-cancellation",
          name: `${outcome.label} cancelled ${offer.outcome.label}`,
          pointChange: 0,
          status: "cancelled",
          note: "The first punishment’s automatic changes were reversed."
        });
      } else {
        applyPunishment(outcome, pending.id);
        result.headline = "Double punishment";
        State.addHistory({
          type: "wheel-double-punishment",
          name: `${offer.outcome.label} + ${outcome.label}`,
          pointChange: 0,
          status: "active",
          note: "Both punishment results remain in effect."
        });
      }
      state.wheel.riskOffer = null;
    } else if (outcome.category === "pleasure") {
      applyPleasure(outcome);
      result.headline = pending.mode === "guaranteed" ? "Guaranteed pleasure" : "Pleasure";
    } else {
      const transaction = applyPunishment(outcome, pending.id);
      result.headline = "Punishment";
      if (state.balances.tickets >= Config.STANDARD_SPIN_COST) {
        state.wheel.riskOffer = {
          id: State.createId("risk"),
          createdAt: State.nowIso(),
          firstSpinId: pending.id,
          outcome,
          transaction
        };
      } else {
        state.wheel.riskOffer = null;
      }
    }

    State.addHistory({
      type: "wheel-spin",
      name: `${result.headline}: ${outcome.label}`,
      pointChange: 0,
      status: outcome.category,
      note: `${pending.mode === "guaranteed" ? "Guaranteed pleasure" : pending.mode === "risk" ? "Second-ticket risk" : "Standard 50/50"} result${result.detail ? ` — ${result.detail}` : ""}.`
    });
    state.wheel.lastResult = result;
    State.commit();
    return { ok: true, result, message: `${result.headline}: ${outcome.label}.` };
  }

  function declineRisk() {
    const state = State.get();
    if (!state.wheel.riskOffer) return { ok: false, message: "There is no risk offer to close." };
    State.addHistory({
      type: "wheel-risk-declined",
      name: "First punishment kept",
      pointChange: 0,
      status: "kept",
      note: state.wheel.riskOffer.outcome.label
    });
    state.wheel.riskOffer = null;
    State.commit();
    return { ok: true, message: "Punishment kept." };
  }

  function completeEffect(effectId) {
    const effect = State.get().activeEffects.find((item) => item.id === effectId);
    if (!effect) return { ok: false, message: "That effect is no longer active." };
    removeEffect(effectId, {
      historyType: "effect-completed",
      status: "completed",
      note: "Marked complete by Dylan."
    });
    return { ok: true, message: `${effect.name} completed.` };
  }

  function adminRemoveEffect(effectId) {
    const effect = State.get().activeEffects.find((item) => item.id === effectId);
    if (!effect) return { ok: false, message: "That effect is no longer active." };
    removeEffect(effectId, {
      historyType: "effect-removed",
      status: "removed",
      note: "Removed by Dylan Admin."
    });
    return { ok: true, message: `${effect.name} removed.` };
  }

  function endLockNormally() {
    return endLock({ force: false, reason: "Ended normally in Dylan Admin." });
  }

  function emergencyOverride() {
    return endLock({ force: true, emergency: true, reason: "Dylan used the emergency override." });
  }

  HousePlay.WheelLock = {
    selectOutcome,
    prepareSpin,
    finalizePendingSpin,
    declineRisk,
    addEffect,
    removeEffect,
    getActiveEffects,
    refreshEffects,
    completeEffect,
    adminRemoveEffect,
    startLock,
    endLock,
    endLockNormally,
    emergencyOverride,
    extendLock,
    addManualLockTime,
    getLockInfo,
    getLockSnapshot,
    formatDuration,
    isLockEffect
  };
})();
