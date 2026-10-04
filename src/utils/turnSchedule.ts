/**
 * Fair turn schedule for the 3–4 player mode.
 *
 * Nobody chooses who they ask. The game decides, so that:
 *  1. Askers take turns in seat order (one question each, then the next player).
 *  2. The person who gets asked is picked automatically: always the unsolved target who has
 *     been asked the FEWEST times so far. Over a full lap every player is asked the same
 *     number of times.
 *  3. Ties are broken by walking the seats in order, starting right after the target this
 *     asker was assigned last time (so the asker cycles through everybody).
 *  4. A target the asker has already solved is never assigned again; players who have solved
 *     everyone are skipped.
 *
 * Pure functions, shared by the server (online rooms) and the same-device arena.
 */

export interface SchedulePlayer {
  id: string;
  /** Ids of the players whose picture this player has already solved. */
  solvedIds: readonly string[];
}

export interface ScheduleState {
  /** How many times each player has been assigned as the target of a question. */
  askedCount: Record<string, number>;
  /** The target this asker was assigned most recently. */
  lastTarget: Record<string, string>;
}

export interface Turn {
  askerIndex: number;
  askerId: string;
  targetId: string;
}

export const createScheduleState = (): ScheduleState => ({ askedCount: {}, lastTarget: {} });

const cloneState = (s: ScheduleState): ScheduleState => ({
  askedCount: { ...s.askedCount },
  lastTarget: { ...s.lastTarget },
});

/** Who `players[askerIndex]` should ask next, or null if they have solved everybody. */
export function pickTarget(
  players: readonly SchedulePlayer[],
  askerIndex: number,
  state: ScheduleState
): string | null {
  const n = players.length;
  const asker = players[askerIndex];
  if (!asker || n < 2) return null;

  const solved = new Set(asker.solvedIds);
  const lastId = state.lastTarget[asker.id];
  const lastIdx = lastId ? players.findIndex((p) => p.id === lastId) : -1;
  // Walk the seats starting just after the previous target (or just after the asker).
  const start = lastIdx >= 0 ? lastIdx : askerIndex;

  let best: string | null = null;
  let bestCount = Infinity;
  for (let step = 1; step <= n; step++) {
    const candidate = players[(start + step) % n];
    if (candidate.id === asker.id || solved.has(candidate.id)) continue;
    const count = state.askedCount[candidate.id] ?? 0;
    if (count < bestCount) {
      best = candidate.id;
      bestCount = count;
    }
  }
  return best;
}

/** The next turn after the asker at `fromIndex` (use -1 to start the game). */
export function nextTurn(
  players: readonly SchedulePlayer[],
  fromIndex: number,
  state: ScheduleState
): Turn | null {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const askerIndex = (((fromIndex + step) % n) + n) % n;
    const targetId = pickTarget(players, askerIndex, state);
    if (targetId) return { askerIndex, askerId: players[askerIndex].id, targetId };
  }
  return null;
}

/** Marks a turn as assigned so the next pick stays balanced. */
export function recordTurn(state: ScheduleState, turn: Turn): void {
  state.askedCount[turn.targetId] = (state.askedCount[turn.targetId] ?? 0) + 1;
  state.lastTarget[turn.askerId] = turn.targetId;
}

/** The next `count` turns, assuming nobody solves anything in between (for the "up next" list). */
export function previewTurns(
  players: readonly SchedulePlayer[],
  fromIndex: number,
  state: ScheduleState,
  count: number
): Turn[] {
  const sim = cloneState(state);
  const out: Turn[] = [];
  let idx = fromIndex;
  for (let i = 0; i < count; i++) {
    const turn = nextTurn(players, idx, sim);
    if (!turn) break;
    recordTurn(sim, turn);
    out.push(turn);
    idx = turn.askerIndex;
  }
  return out;
}
