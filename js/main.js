(function () {
  "use strict";

  const HousePlay = window.HousePlay;
  const State = HousePlay.State;
  const Tasks = HousePlay.Tasks;
  const Cokes = HousePlay.Cokes;
  const WheelLock = HousePlay.WheelLock;
  const UI = HousePlay.UI;
  let lastDateKey = State.getLocalDateKey();
  let spinBusy = false;

  function showResult(result) {
    UI.toast(result.message || (result.ok ? "Done." : "That action could not be completed."), result.ok ? "success" : "error");
  }

  async function finishPreparedSpin() {
    if (spinBusy || !State.get().wheel.pendingSpin) return;
    spinBusy = true;
    UI.renderAll();
    try {
      await UI.runWheelAnimation();
      const finished = WheelLock.finalizePendingSpin();
      UI.renderAll();
      showResult(finished);
    } catch (error) {
      UI.toast("The wheel could not finish. Try reopening HousePlay.", "error");
    } finally {
      spinBusy = false;
    }
  }

  async function beginSpin(mode) {
    if (spinBusy) return;
    const prepared = WheelLock.prepareSpin(mode);
    if (!prepared.ok) {
      showResult(prepared);
      return;
    }
    await finishPreparedSpin();
  }

  function handleNavigation(target, event) {
    const nav = target.closest("[data-nav]");
    if (!nav) return false;
    event.preventDefault();
    const screen = nav.dataset.nav;
    UI.setScreen(screen);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", `#${screen}`);
    }
    return true;
  }

  function confirmFinalize() {
    UI.showConfirm({
      title: "Finalize today?",
      message: "Each Required Today chore that is not approved will deduct 1 point. This cannot run twice for the same date.",
      confirmLabel: "Finalize Today",
      returnToAdmin: true,
      onConfirm: () => showResult(Tasks.finalizeToday())
    });
  }

  function confirmEmergencyOverride() {
    UI.showConfirm({
      title: "Use emergency override?",
      message: "This ends the lock immediately and removes active minimum-lock effects.",
      confirmLabel: "End Lock Now",
      danger: true,
      critical: true,
      returnToAdmin: true,
      onConfirm: () => showResult(WheelLock.emergencyOverride())
    });
  }

  function confirmEffectRemoval(effectId) {
    const effect = State.get().activeEffects.find((item) => item.id === effectId);
    if (!effect) {
      UI.toast("That effect is no longer active.", "error");
      return;
    }
    UI.showConfirm({
      title: "Remove active effect?",
      message: `${effect.name} will end immediately.`,
      confirmLabel: "Remove Effect",
      danger: true,
      returnToAdmin: true,
      onConfirm: () => showResult(WheelLock.adminRemoveEffect(effectId))
    });
  }

  function confirmReset() {
    UI.showConfirm({
      title: "Reset all HousePlay data?",
      message: "Points, tickets, missions, submissions, Coke logs, effects, lock state, and history will be replaced with a fresh game. Export a backup first if you may need it.",
      confirmLabel: "Full Reset",
      danger: true,
      critical: true,
      returnToAdmin: true,
      onConfirm: () => {
        State.resetState();
        Tasks.ensureRequired();
        UI.toast("HousePlay has been reset.", "success");
      }
    });
  }

  function handleAction(button) {
    const action = button.dataset.action;
    if (!action) return;

    if (action === "open-admin") UI.openAdmin();
    if (action === "close-modal") UI.closeModal();
    if (action === "lock-admin") UI.lockAdmin();
    if (action === "confirm-proceed") UI.confirmProceed();
    if (action === "cancel-confirm") UI.cancelConfirm();

    if (action === "log-chore") showResult(Tasks.logChore(button.dataset.taskId));
    if (action === "log-water") showResult(Tasks.logWater());
    if (action === "log-coke") showResult(Cokes.logCoke());

    if (action === "start-lock") showResult(WheelLock.startLock("Started by Jamie"));
    if (action === "request-unlock") {
      UI.openAdmin();
      UI.toast("Unlock requests are handled in Dylan Admin.", "info");
    }

    if (action === "spin-standard") beginSpin("standard");
    if (action === "spin-guaranteed") beginSpin("guaranteed");
    if (action === "spin-risk") beginSpin("risk");
    if (action === "decline-risk") showResult(WheelLock.declineRisk());

    if (action === "history-filter") UI.setHistoryFilter(button.dataset.filter);
    if (action === "review-submission") showResult(Tasks.reviewSubmission(button.dataset.id, button.dataset.decision));
    if (action === "finalize-today") confirmFinalize();
    if (action === "admin-end-lock") showResult(WheelLock.endLockNormally());
    if (action === "emergency-override") confirmEmergencyOverride();
    if (action === "complete-effect") showResult(WheelLock.completeEffect(button.dataset.id));
    if (action === "remove-effect") confirmEffectRemoval(button.dataset.id);

    if (action === "admin-view-history") {
      UI.closeModal();
      UI.setScreen("history");
      window.history.replaceState(null, "", "#history");
    }
    if (action === "export-data") {
      State.downloadExport();
      UI.toast("Backup downloaded.", "success");
    }
    if (action === "reset-data") confirmReset();
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "admin-login-form") {
      event.preventDefault();
      const input = form.elements.password;
      const message = document.getElementById("admin-login-message");
      try {
        const valid = await UI.verifyAdmin(input.value);
        input.value = "";
        if (valid) {
          UI.renderAdminModal(false);
          UI.toast("Dylan Admin unlocked.", "success");
        } else {
          message.textContent = "Access code not accepted.";
          input.focus();
        }
      } catch (error) {
        message.textContent = error.message;
      }
    }

    if (form.id === "point-adjust-form") {
      event.preventDefault();
      const data = new FormData(form);
      const result = Tasks.manualAdjust(data.get("amount"), String(data.get("note") || "").trim());
      if (result.ok) form.reset();
      showResult(result.ok ? { ...result, message: "Point balance adjusted." } : result);
    }

    if (form.id === "add-lock-time-form") {
      event.preventDefault();
      const data = new FormData(form);
      const result = WheelLock.addManualLockTime(data.get("minutes"));
      if (result.ok) form.reset();
      showResult(result);
    }
  }

  async function handleImport(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const importedState = State.parseImport(text);
      input.value = "";
      UI.showConfirm({
        title: "Import this backup?",
        message: "The current HousePlay data on this device will be replaced by the validated backup.",
        confirmLabel: "Import Backup",
        danger: true,
        critical: true,
        returnToAdmin: true,
        onConfirm: () => {
          State.replaceState(importedState, `Imported from ${file.name}.`);
          Tasks.ensureRequired();
          WheelLock.refreshEffects();
          UI.toast("Backup imported successfully.", "success");
        }
      });
    } catch (error) {
      input.value = "";
      UI.toast(error.message || "That backup could not be imported.", "error");
    }
  }

  function checkLocalDate() {
    const current = State.getLocalDateKey();
    if (current === lastDateKey) return;
    lastDateKey = current;
    Tasks.ensureRequired(current);
    WheelLock.refreshEffects();
    UI.renderAll();
    UI.toast("A new local day started. Today’s missions and Coke allowance are ready.", "success");
  }

  function handleVisibility() {
    if (document.visibilityState !== "visible") return;
    checkLocalDate();
    WheelLock.refreshEffects();
    UI.renderAll();
  }

  function initialize() {
    window.addEventListener("houseplay:statechange", () => UI.renderAll());
    document.addEventListener("click", (event) => {
      if (handleNavigation(event.target, event)) return;
      const actionButton = event.target.closest("[data-action]");
      if (actionButton && actionButton.classList.contains("modal-backdrop") && event.target !== actionButton) return;
      if (actionButton) handleAction(actionButton);
    });
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("change", (event) => {
      if (event.target && event.target.id === "import-file") handleImport(event.target);
    });
    document.addEventListener("keydown", UI.handleModalKeydown);
    document.addEventListener("visibilitychange", handleVisibility);

    Tasks.ensureRequired(lastDateKey);
    WheelLock.refreshEffects();
    const requestedScreen = window.location.hash.replace("#", "");
    UI.renderAll();
    UI.setScreen(requestedScreen || "home", false);
    UI.tick();
    UI.showLoadWarning();

    window.setInterval(() => {
      WheelLock.refreshEffects();
      UI.tick();
    }, 1000);
    window.setInterval(checkLocalDate, 15000);

    if (State.get().wheel.pendingSpin) {
      window.setTimeout(finishPreparedSpin, 450);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
