/**
 * REST API Router for BowlingHub
 * Fully integrated with mqttService, orderService, gameService, playerService, and store.
 */

import { Router } from 'express';
import { hubStore } from './store';
import { mqttService } from './mqttService';
import { orderService } from './services/orderService';
import { gameService } from './services/gameService';
import { playerService } from './services/playerService';
import { throwService } from './services/throwService';
import { wsHub } from './wsHub';
import { LaneState } from '../types/vidibi';

export const apiRouter = Router();

// --- Real-time WS / SSE Event Stream ---
apiRouter.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

  const unsubscribe = wsHub.subscribe(event => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // client connection closed
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

apiRouter.get('/ws', (_req, res) => {
  res.json({
    status: 'ok',
    contract: 'frozen-ws-16-events',
    events_endpoint: '/api/events',
    history_count: wsHub.getHistory().length,
  });
});

// --- Lanes Endpoints ---

apiRouter.get('/lanes', (_req, res) => {
  const lanes = hubStore.getAllLanes();
  res.json({ success: true, count: lanes.length, data: lanes });
});

apiRouter.get('/lanes/:id', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) {
    return res.status(404).json({ success: false, error: `Lane ${laneId} not found` });
  }
  res.json({ success: true, data: lane });
});

// Start Order
apiRouter.post('/lanes/:id/order/start', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) {
    return res.status(404).json({ success: false, error: 'Lane not found' });
  }

  const { tariff_id, guest_name, duration_minutes, target_games, pricing_type, players } = req.body;
  const tariff = hubStore.settings.tariffs.find(t => t.id === tariff_id) || hubStore.settings.tariffs[0];

  const order = orderService.createOrder(
    lane,
    tariff,
    guest_name || 'Guest',
    duration_minutes || 60,
    target_games || 1,
    pricing_type || 'time'
  );

  const playerList = Array.isArray(players) && players.length > 0
    ? players.map((name: string) => playerService.createPlayer(name))
    : [playerService.createPlayer(guest_name || 'Player 1')];

  gameService.startNewGame(lane, playerList);

  res.json({ success: true, order, lane });
});

// Pause / Resume / Finish Order
apiRouter.post('/lanes/:id/order/pause', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  orderService.pauseOrder(lane);
  res.json({ success: true, lane });
});

apiRouter.post('/lanes/:id/order/resume', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  orderService.resumeOrder(lane);
  res.json({ success: true, lane });
});

apiRouter.post('/lanes/:id/order/extend', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  const { minutes = 30, added_cost = 15 } = req.body;
  orderService.extendOrder(lane, minutes, added_cost);
  res.json({ success: true, lane });
});

apiRouter.post('/lanes/:id/order/finish', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  orderService.finishOrder(lane);
  res.json({ success: true, lane });
});

// PATCH /api/orders/:id/duration
apiRouter.patch('/orders/:id/duration', (req, res) => {
  const orderId = req.params.id;
  const { delta_min, ends_at, reason } = req.body || {};

  // Validation
  if (delta_min !== undefined) {
    if (typeof delta_min !== 'number' || !Number.isInteger(delta_min)) {
      return res.status(400).json({
        error: 'delta_min_must_be_integer',
        message: 'delta_min must be an integer',
      });
    }
    if (delta_min < -240 || delta_min > 240) {
      return res.status(400).json({
        error: 'delta_min_out_of_range',
        message: 'delta_min must be within [-240, 240]',
        details: { min: -240, max: 240, provided: delta_min },
      });
    }
    if (delta_min === 0) {
      return res.status(400).json({
        error: 'delta_min_must_not_be_zero',
        message: 'delta_min must not be zero',
      });
    }
  } else if (ends_at !== undefined) {
    if (typeof ends_at !== 'string' || isNaN(new Date(ends_at).getTime())) {
      return res.status(400).json({
        error: 'invalid_ends_at',
        message: 'ends_at must be a valid ISO datetime string',
      });
    }
  } else {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Either delta_min or ends_at must be provided',
    });
  }

  try {
    const input = delta_min !== undefined ? { delta_min, reason } : { ends_at, reason };
    const operatorId = (req.headers['x-operator-id'] as string) || 'operator-1';
    const result = orderService.adjustDuration(orderId, input, operatorId);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'order_not_found') {
      return res.status(404).json({ error: 'order_not_found' });
    }
    if (message === 'order_already_finished') {
      return res.status(409).json({ error: 'order_already_finished' });
    }
    if (message === 'order_not_active') {
      return res.status(409).json({ error: 'order_not_active' });
    }
    if (
      message === 'delta_min_must_be_integer' ||
      message === 'delta_min_out_of_range' ||
      message === 'delta_min_must_not_be_zero' ||
      message === 'invalid_ends_at' ||
      message === 'ends_at_too_far_in_past' ||
      message === 'duration_below_minimum' ||
      message === 'invalid_input'
    ) {
      return res.status(400).json({ error: message });
    }
    if (message === 'score_invariant_violated_during_time_adjust') {
      return res.status(500).json({ error: 'score_invariant_violated_during_time_adjust' });
    }
    return res.status(500).json({ error: 'internal_error', message });
  }
});

apiRouter.post('/lanes/:id/close-to-idle', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  orderService.closeToIdle(lane);
  res.json({ success: true, lane });
});

apiRouter.post('/lanes/:id/reset', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.resetLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  res.json({ success: true, action: 'lane_reset', lane });
});

apiRouter.post('/lanes/:id/reinit', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.resetLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });
  res.json({ success: true, action: 'lane_reinit', lane });
});

// Throws & Game Control
apiRouter.post('/lanes/:id/throw/simulate', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });

  const { pins_knocked = [1, 2, 3], is_foul = false, speed_mps = 7.2 } = req.body;
  try {
    const result = gameService.handleThrow(lane, pins_knocked, is_foul, speed_mps);
    res.json({ success: true, result, lane });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
});

// Score Correction (USBC Override)
const handleFrameCorrection = (req: any, res: any) => {
  const { gameId, id, frameNo, ballNo } = req.params;
  const frameIndex = parseInt(frameNo, 10) - 1;
  const rollIndex = parseInt(ballNo, 10) - 1;
  const { pins_after, new_pins, is_foul, player_id } = req.body;

  let targetLane: LaneState | undefined;
  if (id) {
    targetLane = hubStore.getLane(parseInt(id, 10));
  }
  if (!targetLane && gameId) {
    const num = parseInt(gameId, 10);
    for (const l of hubStore.getAllLanes()) {
      if (l.current_game?.id === gameId || l.history_games.some(g => g.id === gameId) || (!isNaN(num) && l.id === num)) {
        targetLane = l;
        break;
      }
    }
  }
  if (!targetLane || !targetLane.current_game) {
    targetLane = hubStore.getAllLanes().find(l => l.current_game !== null);
  }
  if (!targetLane || !targetLane.current_game) {
    return res.status(404).json({ success: false, error: 'Game not found' });
  }

  const game = targetLane.current_game;
  const targetPlayer = player_id
    ? game.players.find(p => p.id === player_id)
    : game.players[game.active_player_index] || game.players[0];
  if (!targetPlayer) {
    return res.status(404).json({ success: false, error: 'Player not found' });
  }

  let pinCount = 0;
  if (typeof new_pins === 'number') {
    pinCount = new_pins;
  } else if (typeof pins_after === 'number') {
    pinCount = pins_after;
  } else if (Array.isArray(pins_after)) {
    pinCount = pins_after.length;
  }

  throwService.manualCorrection(targetPlayer, frameIndex, rollIndex, pinCount, Boolean(is_foul));

  wsHub.broadcast({
    type: 'total_score_updated',
    lane_id: targetLane.id,
    ts: Date.now(),
    game_id: game.id,
    player_id: targetPlayer.id,
    total_score: targetPlayer.total_score,
  });

  wsHub.broadcast({
    type: 'throw_registered',
    lane_id: targetLane.id,
    ts: Date.now(),
    game_id: game.id,
    player_id: targetPlayer.id,
    frame_index: frameIndex,
    roll_index: rollIndex,
    pins_knocked: pinCount,
    is_foul: Boolean(is_foul),
    is_manual: true,
  });

  wsHub.broadcastLaneSync(targetLane);
  res.json({ success: true, game, player: targetPlayer, lane: targetLane });
};

apiRouter.patch('/games/:gameId/frames/:frameNo/balls/:ballNo', handleFrameCorrection);
apiRouter.post('/games/:gameId/frames/:frameNo/balls/:ballNo', handleFrameCorrection);
apiRouter.patch('/lanes/:id/frames/:frameNo/balls/:ballNo', handleFrameCorrection);
apiRouter.post('/lanes/:id/frames/:frameNo/balls/:ballNo', handleFrameCorrection);

apiRouter.post('/lanes/:id/score/correct', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const lane = hubStore.getLane(laneId);
  if (!lane) return res.status(404).json({ success: false, error: 'Lane not found' });

  const { player_id, frame_index, roll_index, new_pins, is_foul } = req.body;
  gameService.correctFrame(lane, player_id, frame_index, roll_index, new_pins, is_foul);
  res.json({ success: true, lane });
});

// Theme & Hardware controls
apiRouter.post('/lanes/:id/theme', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const { theme_id } = req.body;
  hubStore.setLaneTheme(laneId, theme_id);
  res.json({ success: true, theme_id });
});

apiRouter.post('/lanes/:id/bumpers', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  const { is_up } = req.body;
  hubStore.toggleBumpers(laneId, Boolean(is_up));
  res.json({ success: true, bumpers_up: Boolean(is_up) });
});

apiRouter.post('/lanes/:id/pinspotter/sweep', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  mqttService.triggerPinspotterSweep(laneId);
  res.json({ success: true, action: 'sweep', lane_id: laneId });
});

apiRouter.post('/lanes/:id/pinspotter/reset', (req, res) => {
  const laneId = parseInt(req.params.id, 10);
  mqttService.triggerPinspotterReset(laneId);
  const lane = hubStore.getLane(laneId);
  if (lane) {
    lane.current_pin_state = {
      pins: [true, true, true, true, true, true, true, true, true, true],
      is_split: false,
      is_washout: false,
      pins_standing_count: 10,
    };
    wsHub.broadcastLaneSync(lane);
  }
  res.json({ success: true, action: 'reset', lane_id: laneId });
});

// --- Real Hardware & MQTT Endpoints (Replaced Stubs) ---

apiRouter.get('/devices', (_req, res) => {
  const devices = mqttService.getConnectedDevices();
  res.json({ success: true, count: devices.length, data: devices });
});

apiRouter.post('/mqtt/scan', (_req, res) => {
  const result = mqttService.requestDiscovery();
  res.json(result);
});

apiRouter.post('/admin/devices/scan', (_req, res) => {
  const result = mqttService.requestDiscovery();
  res.json(result);
});

apiRouter.post('/admin/devices/ping-all', (_req, res) => {
  const devices = mqttService.getConnectedDevices();
  devices.forEach(d => mqttService.sendPing(d.device_id));
  res.json({ success: true, pinged_count: devices.length });
});

apiRouter.post('/mqtt/ping', (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ success: false, error: 'device_id is required' });
  const result = mqttService.sendPing(device_id);
  res.json(result);
});

apiRouter.post('/mqtt/reboot', (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ success: false, error: 'device_id is required' });
  const result = mqttService.sendReboot(device_id);
  res.json(result);
});

apiRouter.post('/devices/:id/reboot', (req, res) => {
  const deviceId = req.params.id;
  const result = mqttService.sendReboot(deviceId);
  res.json(result);
});

apiRouter.post('/mqtt/ota', (req, res) => {
  const { device_id, firmware_url } = req.body;
  if (!device_id || !firmware_url) {
    return res.status(400).json({ success: false, error: 'device_id and firmware_url are required' });
  }
  const result = mqttService.sendOta(device_id, firmware_url);
  res.json(result);
});

apiRouter.post('/devices/:id/update', (req, res) => {
  const deviceId = req.params.id;
  const { firmware_url, url } = req.body;
  const targetUrl = firmware_url || url || 'http://update.bcore.local/firmware.bin';
  const result = mqttService.sendOta(deviceId, targetUrl);
  res.json(result);
});

apiRouter.get('/mqtt/logs', (_req, res) => {
  const logs = mqttService.getMessageLog();
  res.json({ success: true, count: logs.length, data: logs });
});

// --- Order Transfer & Player Management ---

const findLaneByOrderOrId = (orderOrLaneId: string): LaneState | undefined => {
  const num = parseInt(orderOrLaneId, 10);
  for (const l of hubStore.getAllLanes()) {
    if (l.current_order?.id === orderOrLaneId) return l;
    if (l.current_game?.id === orderOrLaneId) return l;
    if (!isNaN(num) && l.id === num) return l;
  }
  return undefined;
};

const handleOrderTransfer = (req: any, res: any) => {
  const orderId = req.params.orderId || req.params.id;
  const { target_lane_id } = req.body;
  const targetLaneId = parseInt(target_lane_id, 10);
  const targetLane = hubStore.getLane(targetLaneId);
  if (!targetLane) return res.status(404).json({ success: false, error: 'Target lane not found' });

  let sourceLane = findLaneByOrderOrId(orderId);
  if (!sourceLane) return res.status(404).json({ success: false, error: 'Source order not found on any lane' });

  try {
    orderService.transferOrder(sourceLane, targetLane);
    res.json({ success: true, source_lane_id: sourceLane.id, target_lane_id: targetLane.id });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
};

apiRouter.post('/orders/:orderId/transfer', handleOrderTransfer);
apiRouter.post('/lanes/:id/order/transfer', handleOrderTransfer);
apiRouter.post('/lanes/:id/transfer', handleOrderTransfer);

const handlePlayerRename = (req: any, res: any) => {
  const orderId = req.params.orderId || req.params.id;
  const { playerId } = req.params;
  const { name } = req.body;
  const targetLane = findLaneByOrderOrId(orderId);
  if (!targetLane || !targetLane.current_game) {
    return res.status(404).json({ success: false, error: 'Game not found' });
  }
  const success = playerService.renamePlayer(targetLane.current_game, playerId, name);
  if (success) {
    wsHub.broadcast({
      type: 'player_renamed',
      lane_id: targetLane.id,
      ts: Date.now(),
      player_id: playerId,
      new_name: name,
    });
    wsHub.broadcastLaneSync(targetLane);
  }
  res.json({ success, lane: targetLane });
};

apiRouter.patch('/orders/:orderId/players/:playerId', handlePlayerRename);
apiRouter.patch('/lanes/:id/players/:playerId', handlePlayerRename);

const handlePlayerRemove = (req: any, res: any) => {
  const orderId = req.params.orderId || req.params.id;
  const { playerId } = req.params;
  const targetLane = findLaneByOrderOrId(orderId);
  if (!targetLane || !targetLane.current_game) {
    return res.status(404).json({ success: false, error: 'Game not found' });
  }
  const success = playerService.removePlayer(targetLane.current_game, playerId);
  if (success) {
    wsHub.broadcast({
      type: 'player_removed',
      lane_id: targetLane.id,
      ts: Date.now(),
      player_id: playerId,
    });
    wsHub.broadcastLaneSync(targetLane);
  }
  res.json({ success, lane: targetLane });
};

apiRouter.delete('/orders/:orderId/players/:playerId', handlePlayerRemove);
apiRouter.delete('/lanes/:id/players/:playerId', handlePlayerRemove);

const handlePlayerReorder = (req: any, res: any) => {
  const orderId = req.params.orderId || req.params.id;
  const { order, player_ids } = req.body;
  const targetOrder = Array.isArray(order) ? order : Array.isArray(player_ids) ? player_ids : null;
  const targetLane = findLaneByOrderOrId(orderId);
  if (!targetLane || !targetLane.current_game || !targetOrder) {
    return res.status(400).json({ success: false, error: 'Invalid request' });
  }
  const success = playerService.reorderPlayers(targetLane.current_game, targetOrder);
  if (success) {
    wsHub.broadcast({
      type: 'players_reordered',
      lane_id: targetLane.id,
      ts: Date.now(),
      player_ids: targetOrder,
    });
    wsHub.broadcastLaneSync(targetLane);
  }
  res.json({ success, lane: targetLane });
};

apiRouter.patch('/orders/:orderId/players/reorder', handlePlayerReorder);
apiRouter.patch('/lanes/:id/players/reorder', handlePlayerReorder);

apiRouter.get('/settings', (_req, res) => {
  res.json({ success: true, data: hubStore.settings });
});

apiRouter.get('/settings/general', (_req, res) => {
  res.json({
    success: true,
    data: {
      total_lanes_count: hubStore.settings.total_lanes,
      center_name: hubStore.settings.center_name,
      currency: hubStore.settings.currency,
    },
  });
});

apiRouter.post('/settings/general', (req, res) => {
  const count = req.body.total_lanes_count ?? req.body.general?.total_lanes_count ?? req.body.total_lanes;
  const newSettings = {
    ...req.body,
    total_lanes: count !== undefined ? Number(count) : hubStore.settings.total_lanes,
    total_lanes_count: count !== undefined ? Number(count) : hubStore.settings.total_lanes,
    general: {
      total_lanes_count: count !== undefined ? Number(count) : hubStore.settings.total_lanes,
      center_name: req.body.center_name ?? req.body.general?.center_name ?? hubStore.settings.center_name,
      currency: req.body.currency ?? req.body.general?.currency ?? hubStore.settings.currency,
    },
  };
  const updated = hubStore.updateSettings(newSettings);
  res.json({ success: true, data: updated, lanes: hubStore.getAllLanes() });
});

apiRouter.put('/settings', (req, res) => {
  const count = req.body.total_lanes_count ?? req.body.general?.total_lanes_count ?? req.body.total_lanes;
  const payload = {
    ...req.body,
    ...(count !== undefined ? { total_lanes: Number(count), total_lanes_count: Number(count) } : {}),
  };
  const updated = hubStore.updateSettings(payload);
  res.json({ success: true, data: updated, lanes: hubStore.getAllLanes() });
});

apiRouter.get('/reports/shift', (_req, res) => {
  const lanes = hubStore.getAllLanes();
  let totalRevenue = 0;
  let totalGames = 0;
  let activeLanes = 0;

  lanes.forEach(l => {
    if (l.current_order) totalRevenue += l.current_order.total_cost;
    totalGames += l.history_games.length + (l.current_game ? 1 : 0);
    if (l.phase === 'order_active') activeLanes++;
  });

  res.json({
    success: true,
    data: {
      shift_started: Date.now() - 6 * 3600 * 1000,
      total_revenue: totalRevenue,
      currency: hubStore.settings.currency,
      total_games_played: totalGames,
      active_lanes_count: activeLanes,
      total_lanes: lanes.length,
      occupancy_rate_percent: Math.round((activeLanes / lanes.length) * 100),
      lanes_summary: lanes.map(l => ({
        id: l.id,
        name: l.name,
        phase: l.phase,
        guest: l.current_order?.guest_name || 'None',
        revenue: l.current_order?.total_cost || 0,
      })),
    },
  });
});
