/**
 * Flat WebSocket Hub (Frozen Contract - Variant 2)
 * All event fields are placed at the TOP LEVEL.
 * Strictly NO `payload` wrapper envelope allowed!
 */

import { FlatWsEvent, LaneState } from '../types/vidibi';

export type WsClientListener = (event: FlatWsEvent) => void;

export class WebSocketHub {
  private listeners: Set<WsClientListener> = new Set();
  private laneSubscribers: Map<number, Set<WsClientListener>> = new Map();
  private eventHistory: FlatWsEvent[] = [];
  private maxHistoryLength = 200;

  /**
   * Subscribe a listener function to receive WS events
   */
  public subscribe(listener: WsClientListener, laneId?: number): () => void {
    if (laneId !== undefined) {
      if (!this.laneSubscribers.has(laneId)) {
        this.laneSubscribers.set(laneId, new Set());
      }
      this.laneSubscribers.get(laneId)!.add(listener);
    } else {
      this.listeners.add(listener);
    }

    return () => {
      if (laneId !== undefined) {
        this.laneSubscribers.get(laneId)?.delete(listener);
      } else {
        this.listeners.delete(listener);
      }
    };
  }

  /**
   * Broadcast flat WS event (Variant 2)
   */
  public broadcast(event: FlatWsEvent): void {
    // Ensure standard timestamp and flat top-level structure
    if (!event.ts) {
      event.ts = Date.now();
    }

    // Retain event in circular buffer for debug/audit
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.pop();
    }

    // Broadcast to global listeners (Operator dashboards, monitors)
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[WsHub] Error invoking global listener:', err);
      }
    });

    // Broadcast to lane kiosk subscribers
    if (event.lane_id === 0) {
      // Broadcast rule: lane_id=0 is dispatched to ALL kiosk lane subscribers
      this.laneSubscribers.forEach(subscribers => {
        subscribers.forEach(listener => {
          try {
            listener(event);
          } catch (err) {
            console.error('[WsHub] Error invoking broadcast lane listener:', err);
          }
        });
      });
    } else if (event.lane_id && this.laneSubscribers.has(event.lane_id)) {
      this.laneSubscribers.get(event.lane_id)!.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          console.error(`[WsHub] Error invoking lane ${event.lane_id} listener:`, err);
        }
      });
    }
  }

  /**
   * Helper: Broadcast complete lane state synchronization
   */
  public broadcastLaneSync(lane: LaneState): void {
    this.broadcast({
      type: 'lane_state_sync',
      lane_id: lane.id,
      ts: Date.now(),
      lane,
    });
  }

  public getHistory(laneId?: number): FlatWsEvent[] {
    if (laneId !== undefined) {
      return this.eventHistory.filter(e => e.lane_id === laneId);
    }
    return this.eventHistory;
  }
}

export const wsHub = new WebSocketHub();
