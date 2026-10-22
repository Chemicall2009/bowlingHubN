import { LaneState, Order, Tariff } from '../../types/vidibi';
import { wsHub } from '../wsHub';

export type AdjustDurationInput =
  | { delta_min: number; reason?: string }
  | { ends_at: string; reason?: string };

export type AdjustDurationResult = {
  order_id: string;
  lane_id: number;
  old_duration_min: number;
  new_duration_min: number;
  old_ends_at: string;
  new_ends_at: string;
  delta_applied_min: number;
  time_expired: boolean;
  score_preserved: true;
};

export class OrderService {
  private activeOrders: Map<string, Order> = new Map();
  private timerInterval?: NodeJS.Timeout;
  private events: Array<{ type: string; order_id: string; lane_id: number; ts: number; payload: Record<string, unknown> }> = [];

  constructor() {
    this.startCountdownLoop();
  }

  public getEvents(orderId?: string) {
    if (!orderId) return this.events;
    return this.events.filter(e => e.order_id === orderId);
  }

  public getOrder(orderId: string): Order | undefined {
    if (this.activeOrders.has(orderId)) {
      return this.activeOrders.get(orderId);
    }
    const hubStoreInstance = (globalThis as unknown as { __hubStore?: { getAllLanes: () => LaneState[] } }).__hubStore;
    if (hubStoreInstance) {
      for (const lane of hubStoreInstance.getAllLanes()) {
        if (lane.current_order?.id === orderId) {
          return lane.current_order;
        }
      }
    }
    return undefined;
  }

  public getLaneForOrder(order: Order): LaneState | undefined {
    const hubStoreInstance = (globalThis as unknown as { __hubStore?: { getLane: (id: number) => LaneState | undefined } }).__hubStore;
    return hubStoreInstance?.getLane(order.lane_id);
  }

  public adjustDuration(
    orderId: string,
    input: AdjustDurationInput,
    operatorId?: string
  ): AdjustDurationResult {
    // 1. Найти заказ по orderId. Если нет → throw new Error('order_not_found')
    const order = this.getOrder(orderId);
    if (!order) {
      throw new Error('order_not_found');
    }

    // 2. Проверить статус заказа:
    // 'active' | 'paused' | 'closed' | 'between_games' → OK
    // 'completed' | 'finished' → throw new Error('order_already_finished')
    // 'idle' → throw new Error('order_not_active')
    const lane = this.getLaneForOrder(order);
    const lanePhase = lane?.phase;

    if (order.status === 'completed' || (order.status as string) === 'finished') {
      throw new Error('order_already_finished');
    }
    if ((order.status as string) === 'idle' || lanePhase === 'idle') {
      throw new Error('order_not_active');
    }

    const oldDurationMin = order.duration_min ?? order.duration_minutes ?? Math.round(order.total_seconds_booked / 60) ?? 60;
    const oldEndsAt = order.ends_at ?? new Date(order.expires_at).toISOString();
    const currentEndsAtMs = order.ends_at ? new Date(order.ends_at).getTime() : order.expires_at;

    let deltaMs = 0;
    let newEndsAt: Date;

    // 3. Вычислить новый ends_at:
    if ('delta_min' in input && input.delta_min !== undefined) {
      if (!Number.isInteger(input.delta_min)) {
        throw new Error('delta_min_must_be_integer');
      }
      if (input.delta_min < -240 || input.delta_min > 240) {
        throw new Error('delta_min_out_of_range');
      }
      if (input.delta_min === 0) {
        throw new Error('delta_min_must_not_be_zero');
      }

      deltaMs = input.delta_min * 60_000;
      newEndsAt = new Date(currentEndsAtMs + deltaMs);
    } else if ('ends_at' in input && input.ends_at !== undefined) {
      newEndsAt = new Date(input.ends_at);
      if (isNaN(newEndsAt.getTime())) {
        throw new Error('invalid_ends_at');
      }
      if (newEndsAt.getTime() < Date.now() - 86_400_000) {
        throw new Error('ends_at_too_far_in_past');
      }
      deltaMs = newEndsAt.getTime() - currentEndsAtMs;
    } else {
      throw new Error('invalid_input');
    }

    // 4. Проверить минимальную длительность:
    const startedAtMs = typeof order.started_at === 'number'
      ? order.started_at
      : new Date(order.started_at).getTime();

    const newDurationMin = Math.round((newEndsAt.getTime() - startedAtMs) / 60_000);
    if (newDurationMin < 5) {
      throw new Error('duration_below_minimum');
    }

    // 5. КРИТИЧНО — СОХРАНЕНИЕ СЧЁТА:
    // Перед изменением зафиксировать снимок
    const currentGames = order.games ?? (lane?.history_games ? (lane.current_game ? [...lane.history_games, lane.current_game] : lane.history_games) : []);
    const currentPlayers = order.players ?? lane?.current_game?.players ?? [];
    const currentGameId = order.current_game_id ?? lane?.current_game?.id ?? null;
    const currentTotalScoreJson = order.total_score_json ?? null;

    const snapshot = {
      total_score_json: currentTotalScoreJson ? JSON.parse(JSON.stringify(currentTotalScoreJson)) : null,
      current_game_id: currentGameId,
      game_count: currentGames.length,
      player_count: currentPlayers.length,
    };

    // 6. Применить изменения ТОЛЬКО к time-полям:
    order.duration_min = newDurationMin;
    order.duration_minutes = newDurationMin;
    order.ends_at = newEndsAt.toISOString();
    order.expires_at = newEndsAt.getTime();
    order.updated_at = new Date().toISOString();

    const deltaAppliedMin = Math.round(deltaMs / 60_000);
    order.total_seconds_booked += deltaAppliedMin * 60;
    order.time_remaining_sec += deltaAppliedMin * 60;

    // 7. Проверка: если новое ends_at уже в прошлом:
    const timeExpired = newEndsAt.getTime() <= Date.now();
    order.metadata = {
      ...(order.metadata ?? {}),
      time_expired: timeExpired,
      ...(timeExpired ? { time_expired_at: new Date().toISOString() } : {}),
    };
    if (timeExpired && order.time_remaining_sec > 0) {
      order.time_remaining_sec = 0;
    }

    // 8. ВЕРИФИКАЦИЯ инварианта (обязательно):
    const afterGames = order.games ?? (lane?.history_games ? (lane.current_game ? [...lane.history_games, lane.current_game] : lane.history_games) : []);
    const afterPlayers = order.players ?? lane?.current_game?.players ?? [];
    const afterGameId = order.current_game_id ?? lane?.current_game?.id ?? null;
    const afterTotalScoreJson = order.total_score_json ?? null;

    const after = {
      total_score_json: JSON.stringify(afterTotalScoreJson),
      current_game_id: afterGameId,
      game_count: afterGames.length,
      player_count: afterPlayers.length,
    };

    if (
      after.total_score_json !== JSON.stringify(snapshot.total_score_json) ||
      after.current_game_id !== snapshot.current_game_id ||
      after.game_count !== snapshot.game_count ||
      after.player_count !== snapshot.player_count
    ) {
      // ОТКАТ
      order.duration_min = oldDurationMin;
      order.duration_minutes = oldDurationMin;
      order.ends_at = oldEndsAt;
      order.expires_at = currentEndsAtMs;
      order.total_score_json = snapshot.total_score_json;
      order.current_game_id = snapshot.current_game_id;
      order.total_seconds_booked -= deltaAppliedMin * 60;
      order.time_remaining_sec -= deltaAppliedMin * 60;
      throw new Error('score_invariant_violated_during_time_adjust');
    }

    // 9. Записать событие в events (append-only):
    this.events.push({
      type: 'duration_changed',
      order_id: orderId,
      lane_id: order.lane_id,
      ts: Date.now(),
      payload: {
        old_duration_min: oldDurationMin,
        new_duration_min: newDurationMin,
        old_ends_at: oldEndsAt,
        new_ends_at: newEndsAt.toISOString(),
        delta_applied_min: deltaAppliedMin,
        time_expired: timeExpired,
        operator_id: operatorId ?? null,
        reason: input.reason ?? null,
        score_preserved: true,
      },
    });

    // 10. WS broadcast:
    const computedElapsed = this.computeElapsedSec(order);
    const resolvedPhase = lane?.phase ?? (order.status === 'paused' ? 'paused' : 'order_active');

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: order.lane_id,
      order_id: orderId,
      ts: Date.now(),
      phase: resolvedPhase,
      duration_min: newDurationMin,
      ends_at: newEndsAt.toISOString(),
      delta_min: deltaAppliedMin,
      elapsed_sec: computedElapsed,
      time_expired: timeExpired,
    });

    if (lane) {
      wsHub.broadcastLaneSync(lane);
    }

    // 11. Вернуть результат:
    return {
      order_id: orderId,
      lane_id: order.lane_id,
      old_duration_min: oldDurationMin,
      new_duration_min: newDurationMin,
      old_ends_at: oldEndsAt,
      new_ends_at: newEndsAt.toISOString(),
      delta_applied_min: deltaAppliedMin,
      time_expired: timeExpired,
      score_preserved: true,
    };
  }

  public computeElapsedSec(order: Order): number {
    const elapsed = order.elapsed_sec ?? 0;
    if (order.status === 'paused' || (order.status as string) === 'closed') {
      return elapsed;
    }
    const lastResume = order.last_resume_at ?? order.started_at;
    const lastResumeMs = typeof lastResume === 'number' ? lastResume : new Date(lastResume).getTime();
    return Math.round((Date.now() - lastResumeMs) / 1000) + elapsed;
  }

  private startCountdownLoop() {
    this.timerInterval = setInterval(() => {
      this.tickTimebanks();
    }, 1000);
  }

  public tickTimebanks(): void {
    const now = Date.now();
    for (const [orderId, order] of this.activeOrders.entries()) {
      if (order.status === 'active' && !order.is_paused && order.pricing_type === 'time') {
        if (order.time_remaining_sec > 0) {
          order.time_remaining_sec -= 1;
        }

        // Check for order expiration
        if (order.time_remaining_sec <= 0) {
          this.expireOrder(order);
        }
      }
    }
  }

  public createOrder(
    lane: LaneState,
    tariff: Tariff,
    guestName: string,
    durationMinutes = 60,
    targetGames = 1,
    pricingType: 'time' | 'games' = 'time',
    guestPhone?: string,
    notes?: string
  ): Order {
    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = Date.now();
    const durationSeconds = durationMinutes * 60;
    const expiresAt = pricingType === 'time' ? now + durationSeconds * 1000 : now + 3 * 3600 * 1000;

    const totalCost = pricingType === 'time'
      ? Number(((tariff.price * (durationMinutes / 60))).toFixed(2))
      : Number((tariff.price * targetGames).toFixed(2));

    const order: Order = {
      id: orderId,
      lane_id: lane.id,
      tariff_id: tariff.id,
      tariff_name: tariff.name,
      pricing_type: pricingType,
      duration_minutes: durationMinutes,
      target_games: targetGames,
      time_remaining_sec: durationSeconds,
      total_seconds_booked: durationSeconds,
      started_at: now,
      expires_at: expiresAt,
      is_paused: false,
      total_cost: totalCost,
      currency: tariff.currency,
      guest_name: guestName.trim() || 'Guest',
      guest_phone: guestPhone,
      notes,
      status: 'active',
    };

    lane.current_order = order;
    lane.phase = 'order_active';
    this.activeOrders.set(orderId, order);

    // Broadcast Flat WS Event (Variant 2)
    wsHub.broadcast({
      type: 'order_started',
      lane_id: lane.id,
      ts: now,
      order_id: orderId,
      tariff_name: tariff.name,
      pricing_type: pricingType,
      time_remaining_sec: durationSeconds,
      guest_name: guestName,
      total_cost: totalCost,
    });

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: now,
      phase: 'order_active',
      previous_phase: 'idle',
    });

    wsHub.broadcastLaneSync(lane);
    return order;
  }

  public pauseOrder(lane: LaneState): void {
    if (!lane.current_order || lane.current_order.status !== 'active') return;
    lane.current_order.is_paused = true;
    lane.current_order.status = 'paused';
    lane.current_order.paused_at = Date.now();
    lane.phase = 'paused';

    wsHub.broadcast({
      type: 'order_paused',
      lane_id: lane.id,
      ts: Date.now(),
      order_id: lane.current_order.id,
      time_remaining_sec: lane.current_order.time_remaining_sec,
    });

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'paused',
      previous_phase: 'order_active',
    });

    wsHub.broadcastLaneSync(lane);
  }

  public resumeOrder(lane: LaneState): void {
    if (!lane.current_order || lane.current_order.status !== 'paused') return;
    lane.current_order.is_paused = false;
    lane.current_order.status = 'active';
    lane.current_order.paused_at = undefined;
    lane.phase = 'order_active';

    wsHub.broadcast({
      type: 'order_resumed',
      lane_id: lane.id,
      ts: Date.now(),
      order_id: lane.current_order.id,
      time_remaining_sec: lane.current_order.time_remaining_sec,
    });

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'order_active',
      previous_phase: 'paused',
    });

    wsHub.broadcastLaneSync(lane);
  }

  public extendOrder(lane: LaneState, additionalMinutes: number, addedCost = 0): void {
    if (!lane.current_order) return;
    const additionalSec = additionalMinutes * 60;
    lane.current_order.time_remaining_sec += additionalSec;
    lane.current_order.total_seconds_booked += additionalSec;
    lane.current_order.expires_at += additionalSec * 1000;
    lane.current_order.total_cost += addedCost;

    wsHub.broadcast({
      type: 'order_extended',
      lane_id: lane.id,
      ts: Date.now(),
      order_id: lane.current_order.id,
      added_minutes: additionalMinutes,
      new_time_remaining_sec: lane.current_order.time_remaining_sec,
      total_cost: lane.current_order.total_cost,
    });

    wsHub.broadcastLaneSync(lane);
  }

  public finishOrder(lane: LaneState): void {
    if (!lane.current_order) return;
    const order = lane.current_order;
    order.status = 'completed';
    lane.phase = 'order_finished';
    this.activeOrders.delete(order.id);

    wsHub.broadcast({
      type: 'order_finished',
      lane_id: lane.id,
      ts: Date.now(),
      order_id: order.id,
      total_cost: order.total_cost,
      games_played: lane.history_games.length,
      guest_name: order.guest_name,
    });

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'order_finished',
      previous_phase: 'order_active',
    });

    wsHub.broadcastLaneSync(lane);
  }

  public closeToIdle(lane: LaneState): void {
    lane.current_order = null;
    lane.current_game = null;
    lane.phase = 'idle';
    lane.current_pin_state = {
      pins: [true, true, true, true, true, true, true, true, true, true],
      is_split: false,
      is_washout: false,
      pins_standing_count: 10,
    };

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'idle',
      previous_phase: 'order_finished',
    });

    wsHub.broadcastLaneSync(lane);
  }

  public transferOrder(
    orderIdOrSource: number | string | LaneState,
    targetLaneIdOrTarget: number | string | LaneState
  ): boolean {
    const hubStoreInstance = (globalThis as unknown as { __hubStore?: { getAllLanes: () => LaneState[]; getLane: (id: number) => LaneState | undefined } }).__hubStore;

    let sourceLane: LaneState | undefined;
    let targetLane: LaneState | undefined;

    if (typeof orderIdOrSource === 'number') {
      sourceLane = hubStoreInstance ? hubStoreInstance.getLane(orderIdOrSource) : undefined;
    } else if (typeof orderIdOrSource === 'string') {
      const orderId = orderIdOrSource;
      const num = parseInt(orderId, 10);
      const allLanes = hubStoreInstance ? hubStoreInstance.getAllLanes() : [];
      sourceLane = allLanes.find(l => l.current_order?.id === orderId || (l.id === num && l.current_order));
      if (!sourceLane && !isNaN(num)) {
        sourceLane = hubStoreInstance ? hubStoreInstance.getLane(num) : undefined;
      }
    } else {
      sourceLane = orderIdOrSource;
    }

    if (typeof targetLaneIdOrTarget === 'number') {
      targetLane = hubStoreInstance ? hubStoreInstance.getLane(targetLaneIdOrTarget) : undefined;
    } else if (typeof targetLaneIdOrTarget === 'string') {
      const targetId = parseInt(targetLaneIdOrTarget, 10);
      targetLane = hubStoreInstance ? hubStoreInstance.getLane(targetId) : undefined;
    } else {
      targetLane = targetLaneIdOrTarget;
    }

    if (!sourceLane || !sourceLane.current_order) {
      throw new Error('Source order not found on any lane');
    }
    if (!targetLane) {
      throw new Error('Target lane not found');
    }
    if (sourceLane.id === targetLane.id) {
      throw new Error('Cannot transfer to the same lane');
    }
    if (targetLane.phase !== 'idle' && targetLane.phase !== 'order_finished') {
      throw new Error('Target lane is not idle or available');
    }

    const order = sourceLane.current_order;
    const game = sourceLane.current_game;
    const previousSourcePhase = sourceLane.phase;

    sourceLane.current_order = null;
    sourceLane.current_game = null;
    sourceLane.phase = 'idle';
    sourceLane.current_pin_state = {
      pins: [true, true, true, true, true, true, true, true, true, true],
      is_split: false,
      is_washout: false,
      pins_standing_count: 10,
    };

    order.lane_id = targetLane.id;
    if (game) {
      game.lane_id = targetLane.id;
    }

    targetLane.current_order = order;
    targetLane.current_game = game;
    targetLane.phase = order.status === 'paused' ? 'paused' : 'order_active';

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: sourceLane.id,
      ts: Date.now(),
      phase: 'idle',
      previous_phase: previousSourcePhase,
    });
    wsHub.broadcastLaneSync(sourceLane);

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: targetLane.id,
      ts: Date.now(),
      phase: targetLane.phase,
      previous_phase: 'idle',
      lane: targetLane,
    });

    wsHub.broadcast({
      type: 'order_transferred',
      lane_id: targetLane.id,
      ts: Date.now(),
      source_lane_id: sourceLane.id,
      target_lane_id: targetLane.id,
      order_id: order.id,
    });
    wsHub.broadcastLaneSync(targetLane);

    return true;
  }

  private expireOrder(order: Order): void {
    order.status = 'completed';
    this.activeOrders.delete(order.id);
  }
}

export const orderService = new OrderService();
