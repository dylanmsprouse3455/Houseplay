(function () {
  "use strict";

  const HousePlay = window.HousePlay = window.HousePlay || {};

  // Add or rename chores here. Keep each id unique so saved records stay stable.
  const chores = [
    { id: "cat-boxes", name: "Cat boxes", icon: "paw" },
    { id: "load-dishes", name: "Load dishes", icon: "dishes" },
    { id: "unload-dishes", name: "Unload dishes", icon: "dishes" },
    { id: "organize-kitchen-table", name: "Organize kitchen table", icon: "table" },
    { id: "sweep-front-room-floor", name: "Sweep front-room floor", icon: "broom" },
    { id: "make-the-bed", name: "Make the bed", icon: "bed" },
    { id: "clean-the-bathroom", name: "Clean the bathroom", icon: "sparkle" },
    { id: "load-laundry", name: "Load laundry", icon: "laundry" },
    { id: "clean-the-couch", name: "Clean the couch", icon: "couch" },
    { id: "fold-put-away-clothes", name: "Fold and put away clothes", icon: "shirt" }
  ];

  // Wheel choices are data-driven. New choices can be added without changing wheel logic.
  const pleasureOutcomes = [
    {
      id: "naked-caged-cuddles",
      label: "Naked caged cuddles",
      detail: "Locked",
      lockMode: "locked"
    },
    {
      id: "unlocked-soft-teasing",
      label: "Unlocked soft teasing",
      detail: "Unlocked",
      lockMode: "unlocked"
    },
    {
      id: "give-dylan-head",
      label: "Give Dylan head",
      detail: "Always locked",
      lockMode: "locked"
    },
    {
      id: "hard-bondage-teasing",
      label: "Hard bondage teasing",
      detail: "Lock status chosen by the wheel",
      lockMode: "random"
    },
    {
      id: "kinky-photos",
      label: "Kinky photos",
      detail: "Locked",
      lockMode: "locked"
    }
  ];

  const punishmentOutcomes = [
    {
      id: "cold-water-punishment",
      label: "Cold water punishment",
      detail: "Dylan marks it complete",
      effectType: "cold-water"
    },
    {
      id: "lose-one-point",
      label: "Lose 1 point",
      detail: "Applied immediately",
      effectType: "lose-point"
    },
    {
      id: "lose-one-coke-week",
      label: "Lose one Coke for that week",
      detail: "3 free Cokes daily for 7 days",
      effectType: "reduced-coke"
    },
    {
      id: "plug-two-hours",
      label: "Plug in for 2 hours",
      detail: "Two-hour timer",
      effectType: "plug-timer"
    },
    {
      id: "locked-another-twelve",
      label: "Locked for another 12 hours",
      detail: "Adds 12 hours of minimum lock time",
      effectType: "lock-extension"
    }
  ];

  HousePlay.Config = {
    APP_NAME: "HousePlay",
    VERSION: 3,
    STORAGE_KEY: "houseplay-v3",
    LEGACY_KEYS: ["houseplay-public-v1"],
    ADMIN_HASH: "c103df72e15cf510fd1acdd2fa2e71fdb7fb3ebf72441fd79d8aa1bee87169fd",
    REQUIRED_TASK_COUNT: 2,
    CHORE_POINT_VALUE: 1,
    WATER_POINT_VALUE: 1,
    POINTS_PER_TICKET: 10,
    STANDARD_COKE_ALLOWANCE: 4,
    REDUCED_COKE_ALLOWANCE: 3,
    COKE_EXTRA_COST: 2,
    STANDARD_SPIN_COST: 1,
    GUARANTEED_PLEASURE_COST: 5,
    REDUCED_COKE_DURATION_MS: 7 * 24 * 60 * 60 * 1000,
    PLUG_DURATION_MS: 2 * 60 * 60 * 1000,
    LOCK_EXTENSION_MS: 12 * 60 * 60 * 1000,
    labels: {
      requiredToday: "Required Today",
      cokesToday: "Today’s Cokes",
      waterToday: "Water",
      activeEffects: "Current Wheel Effects"
    },
    chores,
    pleasureOutcomes,
    punishmentOutcomes
  };
})();
