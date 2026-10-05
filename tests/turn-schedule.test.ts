import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScheduleState,
  nextTurn,
  recordTurn,
  previewTurns,
  type SchedulePlayer,
} from '../src/utils/turnSchedule';

const mk = (n: number): SchedulePlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, solvedIds: [] }));

for (const n of [3, 4]) {
  test(`${n} players: askers go in seat order and everyone is asked equally every lap`, () => {
    const players = mk(n);
    const state = createScheduleState();
    let from = -1;
    const laps = 5;
    for (let lap = 0; lap < laps; lap++) {
      for (let i = 0; i < n; i++) {
        const turn = nextTurn(players, from, state)!;
        assert.equal(turn.askerIndex, i, 'asker follows seat order');
        assert.notEqual(turn.targetId, turn.askerId, 'never asks themself');
        recordTurn(state, turn);
        from = turn.askerIndex;
      }
      const counts = players.map((p) => state.askedCount[p.id] ?? 0);
      assert.deepEqual(counts, Array(n).fill(lap + 1), `lap ${lap + 1}: equal asked counts`);
    }
  });

  test(`${n} players: over n-1 laps each asker asks every other player exactly once`, () => {
    const players = mk(n);
    const state = createScheduleState();
    const seen: Record<string, Set<string>> = {};
    let from = -1;
    for (let t = 0; t < n * (n - 1); t++) {
      const turn = nextTurn(players, from, state)!;
      recordTurn(state, turn);
      from = turn.askerIndex;
      (seen[turn.askerId] ??= new Set()).add(turn.targetId);
    }
    for (const p of players) assert.equal(seen[p.id].size, n - 1, `${p.id} covered all targets`);
  });
}

test('a solved target is never assigned again and the game ends when everyone solved everyone', () => {
  const players = mk(3);
  const state = createScheduleState();
  let from = -1;
  let turns = 0;
  while (turns < 100) {
    const turn = nextTurn(players, from, state);
    if (!turn) break;
    recordTurn(state, turn);
    from = turn.askerIndex;
    const asker = players[turn.askerIndex];
    assert.ok(!asker.solvedIds.includes(turn.targetId), 'target not already solved');
    // Every question solves the target.
    players[turn.askerIndex] = { ...asker, solvedIds: [...asker.solvedIds, turn.targetId] };
    turns++;
  }
  assert.equal(turns, 6, '3 players x 2 targets');
  assert.equal(nextTurn(players, from, state), null);
});

test('balance is kept when one asker finishes early', () => {
  const players = mk(4);
  players[0] = { id: 'p0', solvedIds: ['p1', 'p2', 'p3'] }; // p0 is done
  const state = createScheduleState();
  let from = -1;
  for (let t = 0; t < 9; t++) {
    const turn = nextTurn(players, from, state)!;
    assert.notEqual(turn.askerId, 'p0', 'finished player is skipped');
    recordTurn(state, turn);
    from = turn.askerIndex;
  }
  const counts = ['p1', 'p2', 'p3'].map((id) => state.askedCount[id] ?? 0);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `counts ${counts} differ by at most 1`);
});

test('previewTurns does not change the real state', () => {
  const players = mk(4);
  const state = createScheduleState();
  const before = JSON.stringify(state);
  const preview = previewTurns(players, -1, state, 6);
  assert.equal(preview.length, 6);
  assert.equal(JSON.stringify(state), before);
});
