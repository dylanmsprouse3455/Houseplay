(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};
  const Config = HousePlay.Config;
  let currentState;
  let loadWarning = "";

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    const random = Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function getLocalDateKey(value) {
    const date = value instanceof Date ? value : value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateKeyFromTimestamp(timestamp) {
    return getLocalDateKey(new Date(timestamp));
  }

  function isoForLocalDate(dateKey, hour) {
    const parts = String(dateKey).split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return nowIso();
    return new Date(parts[0], parts[1] - 1, parts[2], hour || 12, 0, 0, 0).toISOString();
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function baseState() {
    const createdAt = nowIso();
    return {
      app: Config.APP_NAME,
      version: Config.VERSION,
      meta: {
        createdAt,
        updatedAt: createdAt
      },
      balances: {
        points: 0,
        tickets: 0
      },
      dailyRequired: {},
      submissions: [],
      cokeLogs: [],
      activeEffects: [],
      lock: {
        active: false,
        startedAt: null,
        lockMinimumUntil: null,
        endedAt: null,
        reason: ""
      },
      wheel: {
        pendingSpin: null,
        riskOffer: null,
        lastResult: null
      },
      history: []
    };
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeStatus(value, fallback) {
    const allowed = ["pending", "approved", "denied", "teased", "active", "expired", "completed", "cancelled"];
    return allowed.includes(value) ? value : fallback;
  }

  function resolveTaskId(value) {
    const raw = typeof value === "object" && value ? (value.id || value.taskId || value.name) : value;
    if (!raw) return null;
    const direct = Config.chores.find((task) => task.id === raw);
    if (direct) return direct.id;
    const normalized = String(raw).trim().toLowerCase();
    const byName = Config.chores.find((task) => task.name.toLowerCase() === normalized);
    return byName ? byName.id : null;
  }

  function normalizeRequiredRecord(record, fallbackDate) {
    const source = record || {};
    const values = source.taskIds || source.tasks || source.chores || source.required || (Array.isArray(record) ? record : []);
    const taskIds = (Array.isArray(values) ? values : [])
      .map(resolveTaskId)
      .filter(Boolean)
      .filter((id, index, array) => array.indexOf(id) === index);
    return {
      date: source.date || fallbackDate,
      taskIds,
      generatedAt: source.generatedAt || source.createdAt || nowIso(),
      finalized: Boolean(source.finalized || source.isFinalized),
      finalizedAt: source.finalizedAt || null
    };
  }

  function normalizeDailyRequired(raw) {
    const output = {};
    const source = raw.dailyRequired || raw.dailyRequiredByDate || raw.requiredByDate;

    if (Array.isArray(source)) {
      const key = getLocalDateKey();
      output[key] = normalizeRequiredRecord(source, key);
    } else if (source && typeof source === "object") {
      const looksLikeSingleRecord = Array.isArray(source.taskIds) || Array.isArray(source.tasks) || Array.isArray(source.chores);
      if (looksLikeSingleRecord) {
        const key = source.date || getLocalDateKey();
        output[key] = normalizeRequiredRecord(source, key);
      } else {
        Object.keys(source).forEach((key) => {
          const record = source[key];
          const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : (record && record.date) || null;
          if (dateKey) output[dateKey] = normalizeRequiredRecord(record, dateKey);
        });
      }
    }

    if (!Object.keys(output).length && raw.requiredToday) {
      const key = raw.requiredDate || raw.date || getLocalDateKey();
      output[key] = normalizeRequiredRecord(raw.requiredToday, key);
    }
    return output;
  }

  function normalizeSubmission(item) {
    const timestamp = item.timestamp || item.submittedAt || item.createdAt || nowIso();
    const inferredWater = item.type === "water" || /water/i.test(item.name || item.description || "");
    const type = inferredWater ? "water" : "chore";
    const taskId = type === "chore" ? resolveTaskId(item.taskId || item.choreId || item.name) : null;
    const task = taskId ? Config.chores.find((choice) => choice.id === taskId) : null;
    return {
      id: item.id || createId(type),
      type,
      taskId,
      name: type === "water" ? "Full water bottle" : (item.name || (task && task.name) || "Chore"),
      date: item.date || dateKeyFromTimestamp(timestamp),
      timestamp,
      status: normalizeStatus(item.status, "pending"),
      reviewedAt: item.reviewedAt || null,
      pointsAwarded: Boolean(item.pointsAwarded || item.awarded)
    };
  }

  function normalizeSubmissions(raw) {
    const combined = [];
    if (Array.isArray(raw.submissions)) combined.push(...raw.submissions);
    if (Array.isArray(raw.pending)) combined.push(...raw.pending.map((item) => ({ ...item, status: item.status || "pending" })));
    if (Array.isArray(raw.pendingApprovals)) combined.push(...raw.pendingApprovals.map((item) => ({ ...item, status: item.status || "pending" })));
    const seen = new Set();
    return combined.map(normalizeSubmission).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function normalizeCokeLogs(raw) {
    const source = raw.cokeLogs || raw.cokes || raw.cokeHistory || [];
    const output = [];
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (typeof entry === "string") {
          const parsed = new Date(entry);
          if (!Number.isNaN(parsed.getTime())) output.push(parsed.toISOString());
          return;
        }
        if (entry && typeof entry === "object") {
          const timestamp = entry.timestamp || entry.loggedAt || entry.createdAt || entry.time || (entry.date && isoForLocalDate(entry.date, 12));
          const parsed = new Date(timestamp);
          if (!Number.isNaN(parsed.getTime())) output.push(parsed.toISOString());
        }
      });
    } else if (source && typeof source === "object") {
      Object.keys(source).forEach((dateKey) => {
        const count = Math.max(0, Math.floor(finiteNumber(source[dateKey], 0)));
        for (let index = 0; index < count; index += 1) {
          output.push(isoForLocalDate(dateKey, Math.min(23, 8 + index)));
        }
      });
    }
    return output.sort();
  }

  function normalizeEffect(item) {
    const startedAt = item.startedAt || item.createdAt || nowIso();
    return {
      id: item.id || createId("effect"),
      type: item.type || item.effectType || "manual",
      name: item.name || item.label || item.description || "Wheel effect",
      startedAt,
      expiresAt: item.expiresAt || item.until || item.endAt || null,
      status: normalizeStatus(item.status, "active"),
      sourceSpinId: item.sourceSpinId || item.spinId || null,
      note: item.note || "",
      meta: item.meta && typeof item.meta === "object" ? item.meta : {}
    };
  }

  function normalizeEffects(raw) {
    const source = Array.isArray(raw.activeEffects) ? raw.activeEffects : (Array.isArray(raw.effects) ? raw.effects : []);
    return source.map(normalizeEffect);
  }

  function normalizeLock(raw) {
    const source = raw.lock && typeof raw.lock === "object" ? raw.lock : {};
    const minimum = source.lockMinimumUntil || source.lockUntil || raw.lockMinimumUntil || raw.lockUntil || null;
    const startedAt = source.startedAt || raw.lockStartedAt || null;
    return {
      active: Boolean(source.active ?? raw.lockActive ?? startedAt),
      startedAt,
      lockMinimumUntil: minimum,
      endedAt: source.endedAt || null,
      reason: source.reason || ""
    };
  }

  function normalizeHistoryEntry(item) {
    return {
      id: item.id || createId("history"),
      timestamp: item.timestamp || item.createdAt || item.date || nowIso(),
      type: item.type || item.category || "legacy",
      name: item.name || item.description || item.label || "HousePlay activity",
      pointChange: finiteNumber(item.pointChange ?? item.points ?? item.delta, 0),
      status: item.status || "recorded",
      note: item.note || item.details || ""
    };
  }

  function normalizeHistory(raw) {
    const source = Array.isArray(raw.history) ? raw.history : (Array.isArray(raw.activity) ? raw.activity : []);
    return source.map(normalizeHistoryEntry).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  function migrateState(rawValue) {
    const raw = rawValue && typeof rawValue === "object" ? rawValue : {};
    const defaults = baseState();
    const points = finiteNumber(raw.balances && raw.balances.points, finiteNumber(raw.points ?? raw.pointBalance, 0));
    const tickets = finiteNumber(raw.balances && raw.balances.tickets, finiteNumber(raw.tickets ?? raw.ticketBalance, 0));
    const lock = normalizeLock(raw);
    const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
    const wheel = raw.wheel && typeof raw.wheel === "object" ? raw.wheel : {};

    return {
      ...defaults,
      ...raw,
      app: Config.APP_NAME,
      version: Config.VERSION,
      meta: {
        ...defaults.meta,
        ...meta,
        updatedAt: nowIso()
      },
      balances: {
        points: Math.trunc(points),
        tickets: Math.max(0, Math.trunc(tickets))
      },
      dailyRequired: normalizeDailyRequired(raw),
      submissions: normalizeSubmissions(raw),
      cokeLogs: normalizeCokeLogs(raw),
      activeEffects: normalizeEffects(raw),
      lock,
      wheel: {
        pendingSpin: wheel.pendingSpin || raw.pendingSpin || null,
        riskOffer: wheel.riskOffer || raw.riskOffer || null,
        lastResult: wheel.lastResult || raw.lastWheelResult || null
      },
      history: normalizeHistory(raw)
    };
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function readSavedState() {
    let parsed = null;
    let sourceKey = Config.STORAGE_KEY;
    try {
      const primaryText = localStorage.getItem(Config.STORAGE_KEY);
      if (primaryText) {
        parsed = safeParse(primaryText);
        if (!parsed) loadWarning = "Saved data could not be read. HousePlay opened with safe defaults.";
      }
      if (!parsed) {
        for (const key of Config.LEGACY_KEYS) {
          const legacyText = localStorage.getItem(key);
          const legacy = legacyText ? safeParse(legacyText) : null;
          if (legacy) {
            parsed = legacy;
            sourceKey = key;
            break;
          }
        }
      }
    } catch (error) {
      loadWarning = "Browser storage is unavailable. Changes may not persist.";
    }
    currentState = migrateState(parsed || {});
    if (sourceKey !== Config.STORAGE_KEY || parsed) save(false);
    return currentState;
  }

  function save(emitEvent) {
    if (!currentState) return false;
    currentState.meta.updatedAt = nowIso();
    try {
      localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(currentState));
    } catch (error) {
      loadWarning = "HousePlay could not save to browser storage.";
      return false;
    }
    if (emitEvent !== false) {
      window.dispatchEvent(new CustomEvent("houseplay:statechange", { detail: currentState }));
    }
    return true;
  }

  function addHistory(entry) {
    const item = normalizeHistoryEntry({
      ...entry,
      id: entry.id || createId("history"),
      timestamp: entry.timestamp || nowIso()
    });
    currentState.history.push(item);
    return item;
  }

  function getHistoryNewestFirst() {
    return currentState.history.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  function validateBackup(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value.state && typeof value.state === "object" ? value.state : value;
    if (candidate.app && candidate.app !== Config.APP_NAME) return false;
    const knownProperties = ["balances", "points", "tickets", "dailyRequired", "submissions", "history", "cokeLogs", "cokes", "lock"];
    return knownProperties.some((key) => Object.prototype.hasOwnProperty.call(candidate, key));
  }

  function parseImport(text) {
    const parsed = safeParse(text);
    if (!validateBackup(parsed)) throw new Error("That file is not a valid HousePlay backup.");
    const candidate = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
    return migrateState(candidate);
  }

  function replaceState(nextState, historyNote) {
    currentState = migrateState(nextState);
    if (historyNote) {
      addHistory({
        type: "data-import",
        name: "HousePlay backup imported",
        pointChange: 0,
        status: "completed",
        note: historyNote
      });
    }
    save();
    return currentState;
  }

  function resetState() {
    currentState = baseState();
    addHistory({
      type: "data-reset",
      name: "HousePlay data reset",
      pointChange: 0,
      status: "completed"
    });
    save();
    return currentState;
  }

  function exportObject() {
    return {
      app: Config.APP_NAME,
      version: Config.VERSION,
      exportedAt: nowIso(),
      state: deepClone(currentState)
    };
  }

  function downloadExport() {
    const payload = JSON.stringify(exportObject(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `houseplay-backup-${getLocalDateKey()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  readSavedState();

  HousePlay.State = {
    get: () => currentState,
    baseState,
    migrateState,
    commit: () => save(true),
    save,
    addHistory,
    getHistoryNewestFirst,
    getLocalDateKey,
    dateKeyFromTimestamp,
    nowIso,
    createId,
    deepClone,
    parseImport,
    replaceState,
    resetState,
    exportObject,
    downloadExport,
    getLoadWarning: () => loadWarning
  };
})();
