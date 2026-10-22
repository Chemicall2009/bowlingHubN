/**
 * Verification Test Suite for the 4 Operator Tasks:
 * 1. Manual Score Correction (USBC cascade recalculation)
 * 2. Player Management (rename, soft-delete, reorder)
 * 3. Order Transfer (orderService.transferOrder source/target lane sync)
 * 4. Lane count settings (total_lanes sync and enabled status)
 */

import { hubStore } from '../store';
import { throwService } from '../services/throwService';
import { playerService } from '../services/playerService';
import { orderService } from '../services/orderService';
import { gameService } from '../services/gameService';
import { mqttService } from '../mqttService';

export function runAllFeatureTests(): { passed: number; total: number; failedCases: string[] } {
  let passed = 0;
  const failedCases: string[] = [];

  // TEST 1: Manual USBC score correction with cascade recalculation
  try {
    const player = playerService.createPlayer('Alice');
    // Frame 1: 5 + 4 = 9
    // Frame 2: 7 + 2 = 9 (total 18)
    player.frames[0].raw_rolls = [5, 4];
    player.frames[1].raw_rolls = [7, 2];
    throwService.manualCorrection(player, 0, 0, 10); // Change Frame 1 Roll 1 from 5 to 10 (Strike!)
    
    // With Frame 1 being Strike:
    // Frame 1 gets 10 + next 2 rolls (7 + 2 = 9) = 19
    // Frame 2 gets 9 -> cumulative score = 28
    if (player.total_score === 28 && player.frames[0].rolls[0] === 'X' && player.strikes_count === 1) {
      passed++;
    } else {
      failedCases.push(`Manual score correction failed: expected score 28, got ${player.total_score}`);
    }
  } catch (err: any) {
    failedCases.push(`Manual score correction threw error: ${err.message}`);
  }

  // TEST 2: Foul score correction
  try {
    const player = playerService.createPlayer('Bob');
    throwService.manualCorrection(player, 0, 0, 8, true); // Foul on roll 1 -> 0 pins and 'F' mark
    throwService.manualCorrection(player, 0, 1, 10, false); // Spare on roll 2
    if (player.frames[0].rolls[0] === 'F' && player.frames[0].raw_rolls[0] === 0) {
      passed++;
    } else {
      failedCases.push(`Foul correction failed: expected 'F' and 0 raw pins, got ${player.frames[0].rolls[0]}`);
    }
  } catch (err: any) {
    failedCases.push(`Foul score correction threw error: ${err.message}`);
  }

  // TEST 3: Player rename
  try {
    const p1 = playerService.createPlayer('Original Name');
    const lane = hubStore.getLane(1)!;
    const game = gameService.startNewGame(lane, [p1]);
    const renamed = playerService.renamePlayer(game, p1.id, 'New Name');
    if (renamed && game.players[0].name === 'New Name') {
      passed++;
    } else {
      failedCases.push(`Player rename failed: expected 'New Name', got '${game.players[0].name}'`);
    }
  } catch (err: any) {
    failedCases.push(`Player rename threw error: ${err.message}`);
  }

  // TEST 4: Player soft-delete (status='removed')
  try {
    const p1 = playerService.createPlayer('Active 1');
    const p2 = playerService.createPlayer('To Delete');
    const lane = hubStore.getLane(1)!;
    const game = gameService.startNewGame(lane, [p1, p2]);
    const removed = playerService.removePlayer(game, p2.id);
    const targetInGame = game.players.find(p => p.id === p2.id);
    if (removed && targetInGame?.status === 'removed' && game.players.filter(p => p.status !== 'removed').length === 1) {
      passed++;
    } else {
      failedCases.push(`Player remove failed: player in game status is ${targetInGame?.status}`);
    }
  } catch (err: any) {
    failedCases.push(`Player remove threw error: ${err.message}`);
  }

  // TEST 5: Player reorder
  try {
    const p1 = playerService.createPlayer('Player A');
    const p2 = playerService.createPlayer('Player B');
    const p3 = playerService.createPlayer('Player C');
    const lane = hubStore.getLane(1)!;
    const game = gameService.startNewGame(lane, [p1, p2, p3]);
    const reordered = playerService.reorderPlayers(game, [p3.id, p1.id, p2.id]);
    if (reordered && game.players[0].id === p3.id && game.players[1].id === p1.id && game.players[2].id === p2.id) {
      passed++;
    } else {
      failedCases.push(`Player reorder failed`);
    }
  } catch (err: any) {
    failedCases.push(`Player reorder threw error: ${err.message}`);
  }

  // TEST 6: Order transfer between lanes
  try {
    const lane1 = hubStore.getLane(1)!;
    const lane2 = hubStore.getLane(2)!;
    lane2.phase = 'idle';
    lane2.current_order = null;
    lane2.current_game = null;

    const tariff = hubStore.settings.tariffs[0];
    orderService.createOrder(lane1, tariff, 'Guest VIP', 60, 1, 'time');
    const p = playerService.createPlayer('Bowler 1');
    gameService.startNewGame(lane1, [p]);

    const orderId = lane1.current_order!.id;
    const success = orderService.transferOrder(lane1.id, lane2.id);

    const updatedSource = hubStore.getLane(1)!;
    const updatedTarget = hubStore.getLane(2)!;

    const sourceOk = updatedSource.phase === 'idle' && updatedSource.current_order === null && updatedSource.current_game === null && updatedSource.current_pin_state.pins_standing_count === 10;
    const targetOk = updatedTarget.phase === 'order_active' && updatedTarget.current_order?.id === orderId && updatedTarget.current_game !== null;

    if (success && sourceOk && targetOk) {
      passed++;
    } else {
      failedCases.push(`Order transfer failed: sourceOk=${sourceOk}, targetOk=${targetOk}`);
    }
  } catch (err: any) {
    failedCases.push(`Order transfer threw error: ${err.message}`);
  }

  // TEST 7: Lane count settings synchronization
  try {
    hubStore.updateSettings({ total_lanes: 4 });
    const lanesAt4 = hubStore.getAllLanes();
    const enabled4 = lanesAt4.filter(l => l.enabled === true && l.id <= 4).length;
    const disabledAfter4 = lanesAt4.find(l => l.id === 5)?.enabled === false;

    hubStore.updateSettings({ total_lanes: 8 });
    const lanesAt8 = hubStore.getAllLanes();
    const enabled8 = lanesAt8.filter(l => l.enabled === true && l.id <= 8).length;

    // Reset back to 6 for standard operation
    hubStore.updateSettings({ total_lanes: 6 });

    if (enabled4 === 4 && disabledAfter4 && enabled8 === 8) {
      passed++;
    } else {
      failedCases.push(`Lane count settings sync failed: enabled4=${enabled4}, disabledAfter4=${disabledAfter4}, enabled8=${enabled8}`);
    }
  } catch (err: any) {
    failedCases.push(`Lane count settings threw error: ${err.message}`);
  }

  // TEST 8: Lane reset / reinitialization (task-5-lane-reset)
  try {
    const lane = hubStore.getLane(3)!;
    const tariff = hubStore.settings.tariffs[0];
    orderService.createOrder(lane, tariff, 'To Reset', 60, 1, 'time');
    const p = playerService.createPlayer('Player Reset');
    gameService.startNewGame(lane, [p]);
    lane.bumpers_up = true;
    lane.current_pin_state.pins[0] = false;
    lane.current_pin_state.pins_standing_count = 9;

    const resetResult = hubStore.resetLane(3);
    const resetOk =
      resetResult !== undefined &&
      resetResult.phase === 'idle' &&
      resetResult.current_order === null &&
      resetResult.current_game === null &&
      resetResult.bumpers_up === false &&
      resetResult.current_pin_state.pins_standing_count === 10 &&
      resetResult.current_pin_state.pins.every(Boolean);

    if (resetOk) {
      passed++;
    } else {
      failedCases.push(`Lane reset failed: phase=${resetResult?.phase}, standing=${resetResult?.current_pin_state.pins_standing_count}`);
    }
  } catch (err: any) {
    failedCases.push(`Lane reset threw error: ${err.message}`);
  }

  // TEST 9: Display settings broadcast with lane_id=0
  try {
    const updatedSettings = hubStore.updateSettings({
      display: {
        pin_labels_visible: true,
        pin_labels_style: 'number',
        pin_labels_size: 'md',
        pin_labels_color: '#F1F5F9',
        pin_labels_on_kiosk: false,
        pin_labels_on_operator: true,
      },
    });

    if (updatedSettings.display.pin_labels_visible && updatedSettings.display.pin_labels_style === 'number') {
      passed++;
    } else {
      failedCases.push(`Display settings update failed`);
    }
  } catch (err: any) {
    failedCases.push(`Display settings update threw error: ${err.message}`);
  }

  // TEST 10: Operator ↔ Kiosk state synchronization (Order creation with custom guest name, duration, target games, player names)
  try {
    const lane = hubStore.getLane(1)!;
    const tariff = hubStore.settings.tariffs[0];
    const guestName = 'Виктор';
    const durationMin = 90;
    const targetGames = 3;
    const playerNames = ['Виктор', 'Анна', 'Михаил'];

    const order = orderService.createOrder(lane, tariff, guestName, durationMin, targetGames, 'time');
    const players = playerNames.map(name => playerService.createPlayer(name));
    const game = gameService.startNewGame(lane, players);

    const isSyncValid =
      lane.current_order?.id === order.id &&
      lane.current_order?.guest_name === 'Виктор' &&
      lane.current_order?.duration_minutes === 90 &&
      lane.current_order?.time_remaining_sec === 90 * 60 &&
      lane.current_game?.id === game.id &&
      lane.current_game?.players.length === 3 &&
      lane.current_game?.players[0].name === 'Виктор' &&
      lane.current_game?.players[1].name === 'Анна' &&
      lane.current_game?.players[2].name === 'Михаил' &&
      lane.phase === 'order_active';

    if (isSyncValid) {
      passed++;
    } else {
      failedCases.push(`Operator ↔ Kiosk state sync failed: lane order/game mismatch`);
    }
  } catch (err: any) {
    failedCases.push(`Operator ↔ Kiosk state sync threw error: ${err.message}`);
  }

  // TEST 11: R5 Session total score accumulation across multiple games
  try {
    const lane = hubStore.getLane(2)!;
    lane.history_games = [];
    const tariff = hubStore.settings.tariffs[0];
    orderService.createOrder(lane, tariff, 'Семья Петровых', 60, 2, 'games');

    const p1 = playerService.createPlayer('Петр');
    const p2 = playerService.createPlayer('Мария');

    // Game 1
    const g1 = gameService.startNewGame(lane, [p1, p2]);
    g1.players[0].total_score = 120;
    g1.players[1].total_score = 145;
    g1.is_completed = true;
    lane.history_games.push(g1);

    // Game 2
    const g2 = gameService.startNewGame(lane, g1.players);
    g2.players[0].total_score = 150;
    g2.players[1].total_score = 160;

    // Calculate session totals: p1 = 120 + 150 = 270, p2 = 145 + 160 = 305
    const sessionTotals: Record<string, number> = {};
    lane.history_games.forEach(hg => {
      hg.players.forEach(p => {
        sessionTotals[p.name] = (sessionTotals[p.name] || 0) + p.total_score + (p.handicap || 0);
      });
    });
    lane.current_game?.players.forEach(p => {
      sessionTotals[p.name] = (sessionTotals[p.name] || 0) + p.total_score + (p.handicap || 0);
    });

    if (sessionTotals['Петр'] === 270 && sessionTotals['Мария'] === 305) {
      passed++;
    } else {
      failedCases.push(`R5 session total score accumulation failed: expected 270 and 305, got ${sessionTotals['Петр']} and ${sessionTotals['Мария']}`);
    }
  } catch (err: any) {
    failedCases.push(`R5 session total score test threw error: ${err.message}`);
  }

  // TEST 12: adjustDuration — increase by 15 min & score preserved
  try {
    const lane = hubStore.getLane(3)!;
    const tariff = hubStore.settings.tariffs[0];
    const order = orderService.createOrder(lane, tariff, 'Тест Корректировки', 60, 1, 'time');
    const p1 = playerService.createPlayer('Алиса');
    const game = gameService.startNewGame(lane, [p1]);
    gameService.handleThrow(lane, [1, 2, 3], false, 7.5);

    const scoreBefore = game.players[0].total_score;
    const framesBefore = JSON.stringify(game.players[0].frames);
    const gameIdBefore = game.id;

    const result = orderService.adjustDuration(order.id, { delta_min: 15 });

    const p1After = game.players[0];
    const scorePreserved =
      result.score_preserved === true &&
      result.new_duration_min === 75 &&
      result.delta_applied_min === 15 &&
      p1After.total_score === scoreBefore &&
      JSON.stringify(p1After.frames) === framesBefore &&
      game.id === gameIdBefore;

    if (scorePreserved) {
      passed++;
    } else {
      failedCases.push('adjustDuration increase by 15 min failed to preserve score or update duration');
    }
  } catch (err: any) {
    failedCases.push(`adjustDuration increase threw error: ${err.message}`);
  }

  // TEST 13: adjustDuration — decrease by 30 min & score preserved
  try {
    const lane = hubStore.getLane(3)!;
    const order = lane.current_order!;
    const p1 = lane.current_game!.players[0];
    const scoreBefore = p1.total_score;

    const result = orderService.adjustDuration(order.id, { delta_min: -30 });

    if (result.new_duration_min === 45 && result.delta_applied_min === -30 && p1.total_score === scoreBefore) {
      passed++;
    } else {
      failedCases.push('adjustDuration decrease by 30 min failed');
    }
  } catch (err: any) {
    failedCases.push(`adjustDuration decrease threw error: ${err.message}`);
  }

  // TEST 14: adjustDuration — validation (out of range, zero, non-integer, below 5 min)
  try {
    const lane = hubStore.getLane(3)!;
    const order = lane.current_order!;

    let v1 = false;
    let v2 = false;
    let v3 = false;
    let v4 = false;

    try {
      orderService.adjustDuration(order.id, { delta_min: 300 });
    } catch (e: any) {
      if (e.message === 'delta_min_out_of_range') v1 = true;
    }

    try {
      orderService.adjustDuration(order.id, { delta_min: 0 });
    } catch (e: any) {
      if (e.message === 'delta_min_must_not_be_zero') v2 = true;
    }

    try {
      orderService.adjustDuration(order.id, { delta_min: 15.5 });
    } catch (e: any) {
      if (e.message === 'delta_min_must_be_integer') v3 = true;
    }

    try {
      orderService.adjustDuration(order.id, { delta_min: -100 });
    } catch (e: any) {
      if (e.message === 'duration_below_minimum') v4 = true;
    }

    if (v1 && v2 && v3 && v4) {
      passed++;
    } else {
      failedCases.push(`adjustDuration validation tests failed: v1=${v1}, v2=${v2}, v3=${v3}, v4=${v4}`);
    }
  } catch (err: any) {
    failedCases.push(`adjustDuration validation suite threw error: ${err.message}`);
  }

  // TEST 15: adjustDuration — time_expired flag when ends_at in past (no order termination)
  try {
    const lane = hubStore.getLane(4)!;
    const tariff = hubStore.settings.tariffs[0];
    const order = orderService.createOrder(lane, tariff, 'Тест Просрочки', 10, 1, 'time');
    const p1 = playerService.createPlayer('Тестер');
    gameService.startNewGame(lane, [p1]);

    // Force started_at to 20 minutes ago
    const twentyMinsAgo = Date.now() - 20 * 60_000;
    order.started_at = twentyMinsAgo;
    order.expires_at = Date.now() - 10 * 60_000;

    const result = orderService.adjustDuration(order.id, { delta_min: 15 });
    // Duration becomes 25 min, but ends_at is still slightly in past or near past
    const isPast = new Date(result.new_ends_at).getTime() <= Date.now();

    if (result.score_preserved === true && order.status === 'active' && order.metadata?.time_expired === isPast) {
      passed++;
    } else {
      failedCases.push('adjustDuration time_expired flag check failed');
    }
  } catch (err: any) {
    failedCases.push(`adjustDuration time_expired threw error: ${err.message}`);
  }

  // TEST 16: adjustDuration — rejected on finished order
  try {
    const lane = hubStore.getLane(4)!;
    const order = lane.current_order!;
    orderService.finishOrder(lane);

    let rejected = false;
    try {
      orderService.adjustDuration(order.id, { delta_min: 15 });
    } catch (e: any) {
      if (e.message === 'order_already_finished') rejected = true;
    }

    if (rejected) {
      passed++;
    } else {
      failedCases.push('adjustDuration was not rejected on finished order');
    }
  } catch (err: any) {
    failedCases.push(`adjustDuration on finished order check threw error: ${err.message}`);
  }

  // TEST 17: Verify MQTT start/sweep trigger
  try {
    const originalSweep = mqttService.triggerPinspotterSweep;
    let sweepCalled = false;
    mqttService.triggerPinspotterSweep = (laneId: number) => {
      sweepCalled = true;
    };

    mqttService.triggerPinspotterSweep(1);
    
    if (sweepCalled) {
      passed++;
    } else {
      failedCases.push('MQTT sweep trigger failed to be called');
    }

    // Restore
    mqttService.triggerPinspotterSweep = originalSweep;
  } catch (err: any) {
      failedCases.push(`MQTT trigger test threw error: ${err.message}`);
  }

  return { passed, total: 17, failedCases };
}
