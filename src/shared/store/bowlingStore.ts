import { create } from 'zustand';
import { DeviceBinding, FlatWsEvent, LaneState, SystemSettings, VidibiThemeId } from '../../types/vidibi';
import { VIDIBI_THEMES } from '../themes/vidibiThemes';
import { wsHub } from '../../backend/wsHub';
import { hubStore } from '../../backend/store';
import { mqttService } from '../../backend/mqttService';
import { orderService } from '../../backend/services/orderService';
import { gameService } from '../../backend/services/gameService';
import { playerService } from '../../backend/services/playerService';

export interface CelebrationState {
  type: 'strike' | 'spare' | 'split' | 'gutter' | 'turkey' | 'foul' | 'winner';
  active: boolean;
  message: string;
  submessage?: string;
}

export interface BowlingHubState {
  // Состояние оператора и общее
  lanes: LaneState[];
  selectedLaneId: number;
  settings: SystemSettings;
  devices: DeviceBinding[];
  mqttLogs: Record<string, unknown>[];
  recentEvents: FlatWsEvent[];
  isLoading: boolean;
  activeTab: 'dashboard' | 'lane_detail' | 'equipment' | 'settings' | 'reports';

  // Состояние киоска
  kioskLaneId: number;
  celebration: CelebrationState | null;
  soundEffectsEnabled: boolean;

  // Действия - Оператор
  setSelectedLaneId: (id: number) => void;
  setActiveTab: (tab: 'dashboard' | 'lane_detail' | 'equipment' | 'settings' | 'reports') => void;
  refreshLanes: () => void;
  startOrder: (
    laneId: number,
    tariffId: string,
    guestName: string,
    durationMin?: number,
    targetGames?: number,
    pricingType?: 'time' | 'games',
    playerNames?: string[]
  ) => void;
  pauseOrder: (laneId: number) => void;
  resumeOrder: (laneId: number) => void;
  extendOrder: (laneId: number, minutes: number, addedCost?: number) => void;
  finishOrder: (laneId: number) => void;
  closeToIdle: (laneId: number) => void;
  resetLane: (laneId: number) => void;
  setLaneTheme: (laneId: number, themeId: VidibiThemeId) => void;
  toggleBumpers: (laneId: number, isUp: boolean) => void;
  triggerSweep: (laneId: number) => void;
  triggerReset: (laneId: number) => void;
  correctScore: (
    laneId: number,
    playerId: string,
    frameIndex: number,
    rollIndex: number,
    newPins: number,
    isFoul?: boolean
  ) => void;
  simulateThrow: (laneId: number, pinsKnocked: number[], isFoul?: boolean, speedMps?: number) => void;
  addPlayerToGame: (laneId: number, playerName: string, handicap?: number) => void;
  transferOrder: (sourceLaneId: number, targetLaneId: number) => void;
  renamePlayer: (laneId: number, playerId: string, newName: string) => void;
  removePlayer: (laneId: number, playerId: string) => void;
  reorderPlayers: (laneId: number, playerIds: string[]) => void;

  // Действия - Оборудование
  scanDevices: () => void;
  pingDevice: (deviceId: string) => void;
  rebootDevice: (deviceId: string) => void;
  otaUpdateDevice: (deviceId: string, firmwareUrl: string) => void;

  // Действия - Киоск
  setKioskLaneId: (laneId: number) => void;
  dismissCelebration: () => void;
  toggleSoundEffects: () => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
}

// Cross-tab channel for real-time synchronization between /operator and /kiosk/:lane
const crossTabChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('bowlinghub_cross_tab')
  : null;

function syncStateToTabsAndServer(lanes: LaneState[]) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('bowlinghub_lanes_cache', JSON.stringify(lanes));
    } catch {}
  }
  if (crossTabChannel) {
    try {
      crossTabChannel.postMessage({ type: 'lanes_sync', lanes });
    } catch {}
  }
}

function getInitialLanes(): LaneState[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem('bowlinghub_lanes_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((l: LaneState) => hubStore.lanes.set(l.id, l));
          return parsed;
        }
      }
    } catch {}
  }
  return hubStore.getAllLanes();
}

export const useBowlingStore = create<BowlingHubState>((set, get) => {
  // Подписка на плоские события WS (Вариант 2)
  wsHub.subscribe((event: FlatWsEvent) => {
    const state = get();
    const updatedEvents = [event, ...state.recentEvents].slice(0, 50);

    // Forward event across browser tabs if not originated from cross-tab
    if (crossTabChannel && !(event as any)._fromCrossTab && !(event as any)._fromServer) {
      try {
        crossTabChannel.postMessage({
          type: 'ws_event',
          event: { ...event, _fromCrossTab: true },
        });
      } catch {}
    }

    if (event.type === 'lane_state_sync' && event.lane) {
      const syncdLane = event.lane as LaneState;
      set(s => {
        const nextLanes = s.lanes.map(l => (l.id === syncdLane.id ? syncdLane : l));
        syncStateToTabsAndServer(nextLanes);
        return {
          lanes: nextLanes,
          recentEvents: updatedEvents,
        };
      });
    } else if (
      event.type === 'total_score_updated' ||
      event.type === 'throw_registered' ||
      event.type === 'phase_changed' ||
      event.type === 'player_renamed' ||
      event.type === 'player_removed' ||
      event.type === 'players_reordered' ||
      event.type === 'order_transferred' ||
      event.type === 'game_started' ||
      event.type === 'order_started' ||
      event.type === 'order_paused' ||
      event.type === 'order_resumed' ||
      event.type === 'order_extended'
    ) {
      const allLanes = hubStore.getAllLanes();
      syncStateToTabsAndServer(allLanes);
      set({
        lanes: allLanes,
        recentEvents: updatedEvents,
      });
    } else if (event.type === 'throw_scored') {
      if (event.lane_id === state.kioskLaneId) {
        if (event.is_strike) {
          set({
            celebration: {
              type: 'strike',
              active: true,
              message: 'СТРАЙК!',
              submessage: 'ВСЕ 10 КЕГЛЕЙ СБИТЫ',
            },
          });
        } else if (event.is_spare) {
          set({
            celebration: {
              type: 'spare',
              active: true,
              message: 'СПЭР!',
              submessage: 'ЧИСТОЕ ДОБИВАНИЕ',
            },
          });
        } else if (event.is_split) {
          set({
            celebration: {
              type: 'split',
              active: true,
              message: 'СПЛИТ!',
              submessage: 'СЛОЖНАЯ КОМБИНАЦИЯ',
            },
          });
        } else if (event.is_foul) {
          set({
            celebration: {
              type: 'foul',
              active: true,
              message: 'ЗАСТУП ЗА ЛИНИЮ',
              submessage: '0 ОЧКОВ ЗА БРОСОК',
            },
          });
        }
      }
      set({ recentEvents: updatedEvents });
    } else if (event.type === 'game_finished') {
      if (event.lane_id === state.kioskLaneId) {
        set({
          celebration: {
            type: 'winner',
            active: true,
            message: `ПОБЕДИТЕЛЬ: ${event.winner_name || 'ЧЕМПИОН'}!`,
            submessage: `Лучший счёт: ${event.highest_score || 0}`,
          },
        });
      }
      set({ recentEvents: updatedEvents });
    } else if (event.type === 'display_settings_changed') {
      if (event.settings) {
        set(s => ({
          settings: {
            ...s.settings,
            display: { ...s.settings.display, ...(event.settings as any) },
          },
          recentEvents: updatedEvents,
        }));
      } else {
        set({ recentEvents: updatedEvents });
      }
    } else {
      set({ recentEvents: updatedEvents });
    }
  });

  return {
    lanes: getInitialLanes(),
    selectedLaneId: 1,
    settings: hubStore.settings,
    devices: mqttService.getConnectedDevices(),
    mqttLogs: [],
    recentEvents: wsHub.getHistory(),
    isLoading: false,
    activeTab: 'dashboard',
    kioskLaneId: 1,
    celebration: null,
    soundEffectsEnabled: true,

    setSelectedLaneId: (id: number) => set({ selectedLaneId: id }),
    setActiveTab: tab => set({ activeTab: tab }),

    refreshLanes: () => {
      const allLanes = hubStore.getAllLanes();
      set({
        lanes: allLanes,
        devices: mqttService.getConnectedDevices(),
      });
      syncStateToTabsAndServer(allLanes);
    },

    startOrder: (laneId, tariffId, guestName, durationMin = 60, targetGames = 1, pricingType = 'time', playerNames) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      const tariff = hubStore.settings.tariffs.find(t => t.id === tariffId) || hubStore.settings.tariffs[0];

      orderService.createOrder(lane, tariff, guestName, durationMin, targetGames, pricingType);

      const players = (playerNames && playerNames.length > 0)
        ? playerNames.map(name => playerService.createPlayer(name))
        : [playerService.createPlayer(guestName || 'Игрок 1')];

      gameService.startNewGame(lane, players);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);

      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/order/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tariff_id: tariffId,
            guest_name: guestName,
            duration_minutes: durationMin,
            target_games: targetGames,
            pricing_type: pricingType,
            players: playerNames,
          }),
        }).catch(() => {});
      }
    },

    pauseOrder: (laneId: number) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      orderService.pauseOrder(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/order/pause`, { method: 'POST' }).catch(() => {});
      }
    },

    resumeOrder: (laneId: number) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      orderService.resumeOrder(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/order/resume`, { method: 'POST' }).catch(() => {});
      }
    },

    extendOrder: (laneId: number, minutes: number, addedCost = 500) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      orderService.extendOrder(lane, minutes, addedCost);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/order/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minutes, added_cost: addedCost }),
        }).catch(() => {});
      }
    },

    finishOrder: (laneId: number) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      orderService.finishOrder(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/order/finish`, { method: 'POST' }).catch(() => {});
      }
    },

    closeToIdle: (laneId: number) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      orderService.closeToIdle(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/close-to-idle`, { method: 'POST' }).catch(() => {});
      }
    },

    resetLane: (laneId: number) => {
      hubStore.resetLane(laneId);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/reset`, { method: 'POST' }).catch(() => {});
      }
    },

    setLaneTheme: (laneId: number, themeId: VidibiThemeId) => {
      hubStore.setLaneTheme(laneId, themeId);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/lanes/${laneId}/theme`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme_id: themeId }),
        }).catch(() => {});
      }
    },

    toggleBumpers: (laneId: number, isUp: boolean) => {
      hubStore.toggleBumpers(laneId, isUp);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
    },

    triggerSweep: (laneId: number) => {
      mqttService.triggerPinspotterSweep(laneId);
    },

    triggerReset: (laneId: number) => {
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
        const allLanes = hubStore.getAllLanes();
        set({ lanes: allLanes });
        syncStateToTabsAndServer(allLanes);
      }
    },

    correctScore: (laneId, playerId, frameIndex, rollIndex, newPins, isFoul = false) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      gameService.correctFrame(lane, playerId, frameIndex, rollIndex, newPins, isFoul);
      wsHub.broadcast({
        type: 'total_score_updated',
        lane_id: laneId,
        ts: Date.now(),
        player_id: playerId,
      });
      wsHub.broadcastLaneSync(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
    },

    transferOrder: (sourceLaneId: number, targetLaneId: number) => {
      const sourceLane = hubStore.getLane(sourceLaneId);
      const targetLane = hubStore.getLane(targetLaneId);
      if (!sourceLane || !targetLane) return;
      orderService.transferOrder(sourceLane, targetLane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes, selectedLaneId: targetLaneId });
      syncStateToTabsAndServer(allLanes);
    },

    renamePlayer: (laneId: number, playerId: string, newName: string) => {
      const lane = hubStore.getLane(laneId);
      if (!lane || !lane.current_game) return;
      playerService.renamePlayer(lane.current_game, playerId, newName);
      wsHub.broadcast({
        type: 'player_renamed',
        lane_id: laneId,
        ts: Date.now(),
        player_id: playerId,
        new_name: newName,
      });
      wsHub.broadcastLaneSync(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/games/${laneId}/players/${playerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        }).catch(() => {});
      }
    },

    removePlayer: (laneId: number, playerId: string) => {
      const lane = hubStore.getLane(laneId);
      if (!lane || !lane.current_game) return;
      playerService.removePlayer(lane.current_game, playerId);
      wsHub.broadcast({
        type: 'player_removed',
        lane_id: laneId,
        ts: Date.now(),
        player_id: playerId,
      });
      wsHub.broadcastLaneSync(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/games/${laneId}/players/${playerId}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    },

    reorderPlayers: (laneId: number, playerIds: string[]) => {
      const lane = hubStore.getLane(laneId);
      if (!lane || !lane.current_game) return;
      playerService.reorderPlayers(lane.current_game, playerIds);
      wsHub.broadcast({
        type: 'players_reordered',
        lane_id: laneId,
        ts: Date.now(),
        player_ids: playerIds,
      });
      wsHub.broadcastLaneSync(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/games/${laneId}/players/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: playerIds }),
        }).catch(() => {});
      }
    },

    simulateThrow: (laneId, pinsKnocked, isFoul = false, speedMps = 7.2) => {
      const lane = hubStore.getLane(laneId);
      if (!lane) return;
      if (!lane.current_game || lane.current_game.is_completed) {
        const players = lane.current_game && lane.current_game.players.length > 0
          ? lane.current_game.players.map(p => playerService.resetPlayerGame(p))
          : [playerService.createPlayer('Игрок 1')];
        const tariff = hubStore.settings.tariffs[0];
        if (!lane.current_order || lane.current_order.status === 'completed') {
          orderService.createOrder(lane, tariff, 'Быстрая игра', 60, 1, 'time');
        }
        gameService.startNewGame(lane, players);
      }
      gameService.handleThrow(lane, pinsKnocked, isFoul, speedMps);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
      if (typeof fetch !== 'undefined') {
        fetch(`/api/games/${laneId}/throws`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pins_knocked: pinsKnocked,
            is_foul: isFoul,
            speed_mps: speedMps,
          }),
        }).catch(() => {});
      }
    },

    addPlayerToGame: (laneId, playerName, handicap = 0) => {
      const lane = hubStore.getLane(laneId);
      if (!lane || !lane.current_game) return;
      const newPlayer = playerService.createPlayer(playerName, handicap);
      lane.current_game.players.push(newPlayer);
      wsHub.broadcastLaneSync(lane);
      const allLanes = hubStore.getAllLanes();
      set({ lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
    },

    scanDevices: () => {
      mqttService.requestDiscovery();
      set({ devices: mqttService.getConnectedDevices() });
    },

    pingDevice: (deviceId: string) => {
      mqttService.sendPing(deviceId);
      set({ devices: mqttService.getConnectedDevices() });
    },

    rebootDevice: (deviceId: string) => {
      mqttService.sendReboot(deviceId);
      set({ devices: mqttService.getConnectedDevices() });
    },

    otaUpdateDevice: (deviceId: string, firmwareUrl: string) => {
      mqttService.sendOta(deviceId, firmwareUrl);
      set({ devices: mqttService.getConnectedDevices() });
    },

    setKioskLaneId: (laneId: number) => set({ kioskLaneId: laneId }),
    dismissCelebration: () => set({ celebration: null }),
    toggleSoundEffects: () => set(s => ({ soundEffectsEnabled: !s.soundEffectsEnabled })),
    updateSettings: newSettings => {
      const updated = hubStore.updateSettings(newSettings);
      const allLanes = hubStore.getAllLanes();
      set({ settings: updated, lanes: allLanes });
      syncStateToTabsAndServer(allLanes);
    },
  };
});

// Client-side hydration and real-time listeners for cross-tab and server sync
if (typeof window !== 'undefined') {
  if (crossTabChannel) {
    crossTabChannel.onmessage = (event) => {
      if (event.data?.type === 'lanes_sync' && Array.isArray(event.data.lanes)) {
        event.data.lanes.forEach((l: LaneState) => hubStore.lanes.set(l.id, l));
        useBowlingStore.setState({ lanes: event.data.lanes });
      } else if (event.data?.type === 'ws_event' && event.data.event) {
        wsHub.broadcast({ ...event.data.event, _fromCrossTab: true });
      }
    };
  }

  // Hydrate initial state from server
  if (typeof fetch !== 'undefined') {
    fetch('/api/lanes')
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          res.data.forEach((l: LaneState) => hubStore.lanes.set(l.id, l));
          useBowlingStore.setState({ lanes: res.data });
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('bowlinghub_lanes_cache', JSON.stringify(res.data));
          }
        }
      })
      .catch(() => {});
  }

  // Subscribe to real-time events via Server-Sent Events (SSE)
  if (typeof EventSource !== 'undefined') {
    try {
      const sse = new EventSource('/api/events');
      sse.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev && ev.type && ev.type !== 'connected') {
            if (ev.type === 'lane_state_sync' && ev.lane) {
              hubStore.lanes.set(ev.lane.id, ev.lane);
              useBowlingStore.setState(s => ({
                lanes: s.lanes.map(l => (l.id === ev.lane.id ? ev.lane : l)),
              }));
            }
            wsHub.broadcast({ ...ev, _fromServer: true });
          }
        } catch {}
      };
    } catch {}
  }
}
