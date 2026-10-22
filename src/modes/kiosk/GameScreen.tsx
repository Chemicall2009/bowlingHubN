import React from 'react';
import { Game, LaneState } from '../../types/vidibi';
import { VidibiTheme } from '../../shared/themes/vidibiThemes';
import { ScoreGrid } from '../../shared/components/ScoreGrid';
import { PinDeckVisualizer } from '../../shared/components/PinDeckVisualizer';
import { OrderTimer } from '../../shared/components/OrderTimer';
import {
  Gauge,
} from 'lucide-react';

interface GameScreenProps {
  lane: LaneState;
  game: Game;
  theme: VidibiTheme;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  lane,
  game,
  theme,
}) => {
  const activePlayers = game.players.filter(p => p.status !== 'removed');
  const activePlayer = game.players[game.active_player_index] || activePlayers[0] || game.players[0];
  const activePlayerDisplayIndex = activePlayers.findIndex(p => p.id === activePlayer?.id);
  const order = lane.current_order;

  // R5: Calculate total score across all games in current order/session
  const sessionTotalScores: Record<string, number> = {};
  // 1. Sum up finished games from history
  lane.history_games.forEach(hg => {
    hg.players.forEach(p => {
      const pScore = p.total_score + (p.handicap || 0);
      sessionTotalScores[p.id] = (sessionTotalScores[p.id] || 0) + pScore;
      if (p.name) {
        sessionTotalScores[p.name] = (sessionTotalScores[p.name] || 0) + pScore;
      }
    });
  });
  // 2. Add current active game scores
  game.players.forEach(p => {
    const pScore = p.total_score + (p.handicap || 0);
    sessionTotalScores[p.id] = (sessionTotalScores[p.id] || 0) + pScore;
    if (p.name) {
      sessionTotalScores[p.name] = (sessionTotalScores[p.name] || 0) + pScore;
    }
  });

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const ballSpeedKmh = lane.ball_speed_mps ? (lane.ball_speed_mps * 3.6).toFixed(1) : '25.7';

  return (
    <div className={`w-full min-h-screen flex flex-col justify-between p-4 md:p-8 ${theme.bgClass} select-none transition-colors duration-500`}>
      {/* Верхняя панель дорожки и активного игрока */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md shadow-2xl">
        {/* Номер и статус дорожки */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            {lane.id}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{lane.name}</h1>
              {lane.bumpers_up && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Бортики подняты
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">Партия {game.game_number} · Экран VIDIBI High-Definition</p>
          </div>
        </div>

        {/* Баннер активного боулера */}
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-transparent border border-cyan-400/40 shadow-inner">
          <div
            className="w-4 h-4 rounded-full shadow-md shrink-0"
            style={{ backgroundColor: activePlayer?.color || '#38bdf8' }}
          />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-300">
              Сейчас бросает
            </div>
            <div className="text-lg font-black text-white flex items-center gap-2">
              <span>{activePlayer?.name}</span>
              <span className="text-xs font-mono font-normal text-zinc-400">
                (Фрейм {activePlayer?.current_frame_index + 1}, Бросок {activePlayer?.current_roll_index + 1})
              </span>
            </div>
          </div>
        </div>

        {/* Спидометр и остаток времени */}
        <div className="flex items-center gap-4">
          {/* Скорость броска */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-white/10">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[10px] uppercase text-zinc-400 font-semibold">Скорость шара</div>
              <div className="font-mono font-bold text-sm text-white">
                {ballSpeedKmh} <span className="text-[10px] text-zinc-400 font-normal">км/ч</span>
              </div>
            </div>
          </div>

          {/* Таймбанк */}
          {order && order.pricing_type === 'time' && (
            <div className="w-48">
              <OrderTimer
                endsAt={order.ends_at || new Date(order.expires_at).toISOString()}
                durationMin={order.duration_min || order.duration_minutes || Math.round(order.total_seconds_booked / 60)}
                timeExpired={Boolean(order.metadata?.time_expired || order.time_remaining_sec <= 0)}
                size="sm"
              />
            </div>
          )}
        </div>
      </header>

      {/* Основная зона: Счёт и Пиндек */}
      <main className="my-4 grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
        {/* Официальная сетка USBC c общим счётом R5 */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <ScoreGrid
            players={activePlayers}
            activePlayerIndex={activePlayerDisplayIndex !== -1 ? activePlayerDisplayIndex : 0}
            theme={theme}
            sessionTotalScores={sessionTotalScores}
          />
        </div>

        {/* Пиндек с кеглями (в 2 раза меньше) */}
        <div className="flex flex-col items-center justify-center scale-90 lg:scale-100">
          <PinDeckVisualizer
            pinState={lane.current_pin_state}
            theme={theme}
            size="sm"
            context="kiosk"
          />
        </div>
      </main>

      {/* Информационный подвал ТВ-панели (Read-only, R6) */}
      <footer className="p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-zinc-300 font-medium">
            Режим трансляции дорожки {lane.id} · Автоматический подсчёт очков USBC
          </span>
        </div>
        <div className="text-right text-zinc-400 font-mono text-[11px]">
          Управление игрой осуществляется со стойки оператора
        </div>
      </footer>
    </div>
  );
};
