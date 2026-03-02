/**
 * CANONICAL finalization checklist definition — single source of truth for UI.
 * Backend enforces the same logic in functions/mutateEvent.js (FINALIZATION_REQUIRED).
 * Keep these two in sync manually if adding/removing items.
 */
export const FINALIZATION_ITEMS = [
  { key: "contract_signed",         label: "Contract signed",           category: "legal",    blocking: true  },
  { key: "deposit_paid",            label: "Deposit received",          category: "payment",  blocking: true  },
  { key: "planning_complete",       label: "Planning form completed",   category: "planning", blocking: true  },
  { key: "timeline_complete",       label: "Event timeline built",      category: "planning", blocking: true  },
  { key: "music_complete",          label: "Music selections done",     category: "music",    blocking: true  },
  { key: "balance_paid",            label: "Final balance collected",   category: "payment",  blocking: true  },
  { key: "final_call_completed",    label: "Final call completed",      category: "ops",      blocking: true  },
  { key: "assigned_dj",            label: "DJ assigned",               category: "ops",      blocking: true,  isString: true },
  { key: "dj_briefed",             label: "DJ briefed",                category: "ops",      blocking: true  },
  { key: "pronunciation_complete",  label: "Pronunciation list done",   category: "planning", blocking: false },
  { key: "special_songs_complete",  label: "Special songs confirmed",   category: "music",    blocking: false },
  { key: "internal_notes_reviewed", label: "Internal notes reviewed",   category: "ops",      blocking: false },
];