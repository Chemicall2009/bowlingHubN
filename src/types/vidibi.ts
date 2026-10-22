/**
 * CONTRACT.md & topics.h Frozen Types Definition
 * Single source of truth for BowlingHub: backend + operator + VIDIBI kiosk
 */

export type LanePhase =
  | 'idle'
  | 'order_active'
  | 'between_games'
  | 'paused'
  | 'closed'
  | 'order_finished';

export type VidibiThemeId =
  | 'midnight_oled'
  | 'cyberpunk_neon'
  | 'retro_vintage'
  | 'arcade_80s'
  | 'cosmic_bowling'
  | 'clean_minimal_light'
  | 'emerald_lounge'
  | 'sunset_vibes'
  | 'high_contrast'
  | 'steampunk_brass';

export type BindingRole =
  | 'sensor_a'
  | 'sensor_b'
  | 'cv_camera'
  | 'display'
  | 'pinspotter_ctl'
  | 'bollift_ctl'
  | 'foul_line'
  | 'console';

export interface DeviceBinding {
  device_id: string;
  role: BindingRole;
  lane_id: number;
  status: 'online' | 'offline' | 'degraded';
  ip_address?: string;
  firmware_version?: string;
  rssi?: number;
  uptime_sec?: number;
  last_heartbeat_ts: number;
}

export interface PinState {
  /** 1-indexed pin standing status: true = standing, false = fallen. Index 0 is unused or [1..10] array */
  pins: boolean[]; // 10 elements, boolean (true = standing)
  is_split: boolean;
  is_washout: boolean;
  pins_standing_count: number;
}

export interface Throw {
  id: string;
  player_id: string;
  frame_index: number; // 0..9 (Frame 1 to 10)
  roll_index: number;  // 0..2 (1st, 2nd, or 3rd ball in 10th frame)
  pins_fallen: number[]; // e.g. [1, 2, 3, 5]
  pins_knocked_this_roll: number;
  standing_pins_after: boolean[]; // 10 pins
  is_strike: boolean;
  is_spare: boolean;
  is_split: boolean;
  is_foul: boolean;
  is_gutter: boolean;
  ball_speed_mps?: number; // meters per second float
  ball_speed_kmh?: number;
  timestamp: number;
}

export interface Frame {
  frame_number: number; // 1..10
  rolls: (number | 'X' | '/' | '-' | 'F')[];
  raw_rolls: number[]; // actual pin count or 0 for foul
  fouls?: boolean[];
  score: number | null; // cumulative score after bonuses calculated
  is_strike: boolean;
  is_spare: boolean;
  is_split: boolean;
  is_completed: boolean;
}

export interface Player {
  id: string;
  name: string;
  status?: 'active' | 'removed';
  order_index?: number;
  avatar_url?: string;
  color?: string;
  handicap: number;
  frames: Frame[];
  total_score: number;
  current_frame_index: number; // 0..9
  current_roll_index: number;  // 0..2
  strikes_count: number;
  spares_count: number;
  max_speed_mps: number;
  avg_speed_mps: number;
}

export interface Game {
  id: string;
  lane_id: number;
  game_number: number;
  players: Player[];
  active_player_index: number;
  is_completed: boolean;
  started_at: number;
  completed_at?: number;
  winner_id?: string;
  highest_score?: number;
}

export interface Order {
  id: string;
  lane_id: number;
  tariff_id: string;
  tariff_name: string;
  pricing_type: 'time' | 'games';
  duration_minutes?: number;
  duration_min?: number;
  target_games?: number;
  time_remaining_sec: number;
  total_seconds_booked: number;
  started_at: number;
  expires_at: number;
  ends_at?: string;
  updated_at?: string;
  last_resume_at?: string | number;
  elapsed_sec?: number;
  is_paused: boolean;
  paused_at?: number;
  total_cost: number;
  currency: string;
  guest_name: string;
  guest_phone?: string;
  notes?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  metadata?: {
    time_expired?: boolean;
    time_expired_at?: string;
    [key: string]: unknown;
  };
  total_score_json?: Record<string, unknown> | null;
  current_game_id?: string | null;
  games?: Game[];
  players?: Player[];
}

export interface LaneState {
  id: number;
  name: string;
  enabled?: boolean;
  phase: LanePhase;
  current_order: Order | null;
  current_game: Game | null;
  history_games: Game[];
  active_theme: VidibiThemeId;
  bumpers_up: boolean;
  foul_line_active: boolean;
  pinspotter_state: 'idle' | 'sweeping' | 'setting' | 'ready' | 'error';
  bollift_state: 'running' | 'idle' | 'jammed';
  current_pin_state: PinState;
  last_throw: Throw | null;
  ball_speed_mps: number | null;
  connected_devices: DeviceBinding[];
  lane_camera_url?: string;
  camera_calibration?: {
    matrix: number[][];
    calibrated: boolean;
    pin_rois: { pin: number; x: number; y: number; radius: number }[];
  };
}

export interface Tariff {
  id: string;
  name: string;
  type: 'hourly' | 'per_game';
  price: number;
  currency: string;
  description: string;
  is_active: boolean;
}

export interface DisplaySettings {
  pin_labels_visible: boolean;
  pin_labels_style: 'number' | 'position' | 'both' | 'none';
  pin_labels_size: 'sm' | 'md' | 'lg';
  pin_labels_color: string;
  pin_labels_on_kiosk: boolean;
  pin_labels_on_operator: boolean;
}

export interface SystemSettings {
  center_name: string;
  total_lanes: number;
  total_lanes_count?: number;
  general?: {
    total_lanes_count: number;
    center_name?: string;
    currency?: string;
  };
  currency: string;
  default_theme: VidibiThemeId;
  mqtt_broker_host: string;
  mqtt_broker_port: number;
  mqtt_connected: boolean;
  cv_confidence_threshold: number;
  auto_advance_game: boolean;
  sound_effects_enabled: boolean;
  tariffs: Tariff[];
  display: DisplaySettings;
}

// Flat WS Event format (Variant 2 - 16 frozen events + internal sync)
export type WsEventType =
  | 'phase_changed'
  | 'game_started'
  | 'game_finished'
  | 'order_paused'
  | 'order_resumed'
  | 'lane_closed'
  | 'lane_reopened'
  | 'total_score_updated'
  | 'throw_registered'
  | 'player_added'
  | 'player_removed'
  | 'player_renamed'
  | 'anomaly'
  | 'order_finished'
  | 'players_reordered'
  | 'display_settings_changed'
  | 'throw_scored'
  | 'pin_state_updated'
  | 'ball_speed'
  | 'foul_detected'
  | 'order_started'
  | 'order_extended'
  | 'player_switched'
  | 'device_status'
  | 'theme_changed'
  | 'bumper_changed'
  | 'pinspotter_cycle'
  | 'order_transferred'
  | 'lane_state_sync'
  | 'duration_changed'
  | 'wait_for_shot'
  | 'cv_trigger';

export interface PhaseChangedEvent {
  type: 'phase_changed';
  lane_id: number;
  ts: number;
  event_id?: string;
  phase: LanePhase;

  // NEW (optional) — присутствуют только при изменении времени
  order_id?: string;
  duration_min?: number;
  ends_at?: string;
  delta_min?: number;
  elapsed_sec?: number;
  time_expired?: boolean;
}

export interface FlatWsEvent {
  type: WsEventType;
  lane_id: number;
  ts: number;
  // Dynamic flat fields per event type (NO top-level payload envelope)
  [key: string]: unknown;
}
