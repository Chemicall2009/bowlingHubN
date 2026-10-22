import { LaneState, SystemSettings, Tariff, VidibiThemeId } from '../types/vidibi';
import { gameService } from './services/gameService';
import { orderService } from './services/orderService';
import { playerService } from './services/playerService';
import { mqttService } from './mqttService';
import { wsHub } from './wsHub';

export class BowlingHubStore {
  public lanes: Map<number, LaneState> = new Map();
  public settings: SystemSettings;

  constructor() {
    (globalThis as Record<string, unknown>).__hubStore = this;
    this.settings = {
      center_name: 'Боулинг-центр «Страйк Сити»',
      total_lanes: 6,
      currency: '₽',
      default_theme: 'midnight_oled',
      mqtt_broker_host: 'mosquitto',
      mqtt_broker_port: 1883,
      mqtt_connected: true,
      cv_confidence_threshold: 0.85,
      auto_advance_game: true,
      sound_effects_enabled: true,
      tariffs: [
        {
          id: 'tariff-std-hour',
          name: 'Стандартный (почасовой)',
          type: 'hourly',
          price: 1800.0,
          currency: '₽',
          description: 'Стандартный тариф открытой игры в боулинг',
          is_active: true,
        },
        {
          id: 'tariff-vip-hour',
          name: 'VIP Космический УФ',
          type: 'hourly',
          price: 2500.0,
          currency: '₽',
          description: 'VIP-зона с ультрафиолетовой подсветкой и улучшенной зоной отдыха',
          is_active: true,
        },
        {
          id: 'tariff-per-game',
          name: 'Поигровой (за партию)',
          type: 'per_game',
          price: 350.0,
          currency: '₽',
          description: 'Оплата за каждый 10-фреймовый матч на игрока',
          is_active: true,
        },
      ],
      display: {
        pin_labels_visible: true,
        pin_labels_style: 'number',
        pin_labels_size: 'md',
        pin_labels_color: '#ffffff',
        pin_labels_on_kiosk: false,
        pin_labels_on_operator: true,
      },
    };

    this.initLanes();
    this.hookMqtt();
  }

  private initLanes() {
    for (let id = 1; id <= 48; id++) {
      const isEnabled = id <= this.settings.total_lanes;
      const lane: LaneState = {
        id,
        name: `Дорожка ${id}`,
        enabled: isEnabled,
        phase: 'idle',
        current_order: null,
        current_game: null,
        history_games: [],
        active_theme: id === 1 ? 'midnight_oled' : id === 2 ? 'cyberpunk_neon' : 'retro_vintage',
        bumpers_up: false,
        foul_line_active: true,
        pinspotter_state: 'ready',
        bollift_state: 'running',
        current_pin_state: {
          pins: [true, true, true, true, true, true, true, true, true, true],
          is_split: false,
          is_washout: false,
          pins_standing_count: 10,
        },
        last_throw: null,
        ball_speed_mps: 7.14,
        connected_devices: mqttService.getConnectedDevices().filter(d => d.lane_id === id),
      };

      // Начальная демонстрационная игра на Дорожке 1
      if (id === 1) {
        const player1 = playerService.createPlayer('Александр Орлов', 0, '#38bdf8');
        const player2 = playerService.createPlayer('Елена Смирнова', 10, '#ec4899');
        const tariff = this.settings.tariffs[0];
        orderService.createOrder(lane, tariff, 'Александр и друзья', 60, 2, 'time');
        gameService.startNewGame(lane, [player1, player2]);

        // Симуляция начального броска
        gameService.handleThrow(lane, [1, 2, 3, 5, 8, 9, 10], false, 7.8);
      }

      this.lanes.set(id, lane);
    }
  }

  private hookMqtt() {
    mqttService.registerHardwareEventHandler((topic, payload) => {
      const rawLaneId = payload.lane_id;
      const laneId = typeof rawLaneId === 'string' ? parseInt(rawLaneId, 10) : typeof rawLaneId === 'number' ? rawLaneId : 1;
      const lane = this.lanes.get(laneId);
      if (!lane) return;

      if (topic.includes('/sensor/foul')) {
        lane.foul_line_active = true;
      }
    });
  }

  public getLane(id: number): LaneState | undefined {
    return this.lanes.get(id);
  }

  public getAllLanes(): LaneState[] {
    return Array.from(this.lanes.values());
  }

  public setLaneTheme(laneId: number, themeId: VidibiThemeId): void {
    const lane = this.lanes.get(laneId);
    if (!lane) return;
    lane.active_theme = themeId;
    wsHub.broadcast({
      type: 'theme_changed',
      lane_id: laneId,
      ts: Date.now(),
      theme_id: themeId,
    });
    wsHub.broadcastLaneSync(lane);
  }

  public toggleBumpers(laneId: number, isUp: boolean): void {
    const lane = this.lanes.get(laneId);
    if (!lane) return;
    lane.bumpers_up = isUp;
    mqttService.setBumper(laneId, isUp);
    wsHub.broadcastLaneSync(lane);
  }

  public resetLane(laneId: number): LaneState | undefined {
    const lane = this.lanes.get(laneId);
    if (!lane) return undefined;

    const previousPhase = lane.phase;
    lane.current_order = null;
    lane.current_game = null;
    lane.phase = 'idle';
    lane.bumpers_up = false;
    lane.foul_line_active = true;
    lane.pinspotter_state = 'ready';
    lane.bollift_state = 'running';
    lane.current_pin_state = {
      pins: [true, true, true, true, true, true, true, true, true, true],
      is_split: false,
      is_washout: false,
      pins_standing_count: 10,
    };
    lane.last_throw = null;

    // Trigger hardware resets
    mqttService.triggerPinspotterReset(laneId);
    mqttService.setBumper(laneId, false);

    // Broadcast WS event
    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'idle',
      previous_phase: previousPhase,
    });
    wsHub.broadcastLaneSync(lane);

    return lane;
  }

  public updateSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.settings = { ...this.settings, ...newSettings };
    const total = newSettings.total_lanes_count ?? newSettings.general?.total_lanes_count ?? newSettings.total_lanes ?? this.settings.total_lanes;
    if (total !== undefined) {
      this.settings.total_lanes = total;
      for (let id = 1; id <= total; id++) {
        let lane = this.lanes.get(id);
        if (!lane) {
          lane = {
            id,
            name: `Дорожка ${id}`,
            enabled: true,
            phase: 'idle',
            current_order: null,
            current_game: null,
            history_games: [],
            active_theme: id === 1 ? 'midnight_oled' : 'cyberpunk_neon',
            bumpers_up: false,
            foul_line_active: true,
            pinspotter_state: 'ready',
            bollift_state: 'running',
            current_pin_state: {
              pins: [true, true, true, true, true, true, true, true, true, true],
              is_split: false,
              is_washout: false,
              pins_standing_count: 10,
            },
            last_throw: null,
            ball_speed_mps: null,
            connected_devices: mqttService.getConnectedDevices().filter(d => d.lane_id === id),
          };
          this.lanes.set(id, lane);
        } else {
          lane.enabled = true;
        }
      }
      for (let id = total + 1; id <= 48; id++) {
        const lane = this.lanes.get(id);
        if (lane) {
          lane.enabled = false;
        }
      }
    }
    if (newSettings.display) {
      wsHub.broadcast({
        type: 'display_settings_changed',
        lane_id: 0,
        ts: Date.now(),
        settings: this.settings.display,
      });
    }
    return this.settings;
  }
}

export const hubStore = new BowlingHubStore();
