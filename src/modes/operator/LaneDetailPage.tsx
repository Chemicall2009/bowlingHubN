import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { VIDIBI_THEMES } from '../../shared/themes/vidibiThemes';
import { ScoreGrid } from '../../shared/components/ScoreGrid';
import { PlayerList } from '../../shared/components/PlayerList';
import { PinDeckVisualizer } from '../../shared/components/PinDeckVisualizer';
import { InteractiveHardwareSim } from '../../shared/components/InteractiveHardwareSim';
import { TimeEditor } from './components/TimeEditor';
import { ScoreCorrectionModal } from './ScoreCorrectionModal';
import { StartOrderModal } from './StartOrderModal';
import { TransferOrderModal } from './TransferOrderModal';
import { Player, VidibiThemeId } from '../../types/vidibi';
import {
  ArrowLeft,
  Play,
  Pause,
  Clock,
  Shield,
  RotateCcw,
  Palette,
  UserPlus,
  ExternalLink,
  SquareCheck,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';

interface LaneDetailPageProps {
  laneId: number;
  onBack: () => void;
}

export const LaneDetailPage: React.FC<LaneDetailPageProps> = ({ laneId, onBack }) => {
  const {
    lanes,
    pauseOrder,
    resumeOrder,
    extendOrder,
    finishOrder,
    closeToIdle,
    resetLane,
    toggleBumpers,
    triggerSweep,
    triggerReset,
    setLaneTheme,
    addPlayerToGame,
    renamePlayer,
    removePlayer,
  } = useBowlingStore();

  const lane = lanes.find(l => l.id === laneId) || lanes[0];
  const theme = VIDIBI_THEMES[lane.active_theme] || VIDIBI_THEMES.midnight_oled;

  // Модальные окна
  const [scoreModalData, setScoreModalData] = useState<{
    player: Player;
    frameIndex: number;
    rollIndex: number;
  } | null>(null);

  const [confirmResetLane, setConfirmResetLane] = useState(false);
  const [isStartOrderOpen, setIsStartOrderOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState(0);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');

  const handleScoreCellClick = (player: Player, frameIndex: number, rollIndex: number) => {
    setScoreModalData({ player, frameIndex, rollIndex });
  };

  const handleAddPlayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    addPlayerToGame(laneId, newPlayerName.trim(), newPlayerHandicap);
    setNewPlayerName('');
    setNewPlayerHandicap(0);
    setIsAddingPlayer(false);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель дорожки */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
            title="Назад к списку дорожек"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{lane.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {lane.phase}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {lane.current_order ? `Гость: ${lane.current_order.guest_name} · ${lane.current_order.tariff_name}` : 'Дорожка свободна для бронирования'}
            </p>
          </div>
        </div>

        {/* Действия справа */}
        <div className="flex items-center gap-2">
          {/* Селектор темы VIDIBI */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <Palette className="w-4 h-4 text-cyan-400" />
            <select
              value={lane.active_theme}
              onChange={e => setLaneTheme(lane.id, e.target.value as VidibiThemeId)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {(Object.keys(VIDIBI_THEMES) as VidibiThemeId[]).map(tId => (
                <option key={tId} value={tId} className="bg-zinc-900 text-white">
                  {VIDIBI_THEMES[tId].name}
                </option>
              ))}
            </select>
          </div>

          {/* Открыть киоск в новой вкладке */}
          <a
            href={`/kiosk/${lane.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors"
          >
            <span>Экран киоска</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Основная сетка страницы дорожки */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая часть: Счёт и симулятор */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Текущая партия */}
          {lane.current_game ? (() => {
            const activePlayers = lane.current_game.players.filter(p => p.status !== 'removed');
            const activePlayer = lane.current_game.players[lane.current_game.active_player_index] || activePlayers[0] || lane.current_game.players[0];
            const activePlayerDisplayIndex = activePlayers.findIndex(p => p.id === activePlayer?.id);

            // R5: Calculate total score across all games in current order/session
            const sessionTotalScores: Record<string, number> = {};
            lane.history_games.forEach(hg => {
              hg.players.forEach(p => {
                const pScore = p.total_score + (p.handicap || 0);
                sessionTotalScores[p.id] = (sessionTotalScores[p.id] || 0) + pScore;
                if (p.name) {
                  sessionTotalScores[p.name] = (sessionTotalScores[p.name] || 0) + pScore;
                }
              });
            });
            lane.current_game.players.forEach(p => {
              const pScore = p.total_score + (p.handicap || 0);
              sessionTotalScores[p.id] = (sessionTotalScores[p.id] || 0) + pScore;
              if (p.name) {
                sessionTotalScores[p.name] = (sessionTotalScores[p.name] || 0) + pScore;
              }
            });

            return (
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      Партия {lane.current_game.game_number} · Протокол счёта USBC
                    </h2>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      (Кликните ячейку или нажмите «Коррекция»)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (activePlayer) {
                          setScoreModalData({
                            player: activePlayer,
                            frameIndex: Math.min(activePlayer.current_frame_index || 0, 9),
                            rollIndex: Math.max(activePlayer.current_roll_index || 0, 0),
                          });
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-colors shadow-sm"
                      title="Ручная коррекция любого фрейма"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Ручная коррекция</span>
                    </button>
                  </div>
                </div>

                {/* Управление списком игроков */}
                <div className="mb-4">
                  <PlayerList
                    laneId={lane.id}
                    players={lane.current_game.players}
                    activePlayerIndex={activePlayerDisplayIndex !== -1 ? activePlayerDisplayIndex : 0}
                    onAddPlayer={(name, hdc) => addPlayerToGame(lane.id, name, hdc)}
                  />
                </div>

                {/* Сетка USBC */}
                <ScoreGrid
                  players={activePlayers}
                  activePlayerIndex={activePlayerDisplayIndex !== -1 ? activePlayerDisplayIndex : 0}
                  theme={theme}
                  interactive={true}
                  onFrameClick={handleScoreCellClick}
                  sessionTotalScores={sessionTotalScores}
                />
              </div>
            );
          })() : (
            <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center flex flex-col items-center justify-center">
              <p className="text-sm text-zinc-400 mb-4">На {lane.name} нет активной игры</p>
              <button
                onClick={() => setIsStartOrderOpen(true)}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Открыть сессию и начать игру</span>
              </button>
            </div>
          )}

          {/* Интерактивный симулятор бросков и датчиков */}
          <InteractiveHardwareSim laneId={lane.id} />
        </div>

        {/* Правая часть: Пиндек и управление сессией */}
        <div className="flex flex-col gap-6">
          {/* Пиндек камеры */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Камера пиндека
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                Скорость: {lane.ball_speed_mps || 7.14} м/с
              </span>
            </div>

            <PinDeckVisualizer
              pinState={lane.current_pin_state}
              theme={theme}
              size="sm"
              interactive={true}
              onTogglePin={pNum => {
                const currentStanding = lane.current_pin_state.pins[pNum - 1];
                const updated = [...lane.current_pin_state.pins];
                updated[pNum - 1] = !currentStanding;
                lane.current_pin_state.pins = updated;
                lane.current_pin_state.pins_standing_count = updated.filter(Boolean).length;
              }}
            />
          </div>

          {/* Управление сессией и техникой */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Управление дорожкой и заказом
            </h3>

            {/* FBox Status Control */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">FBox</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetch(`/api/lanes/${lane.id}/start`, { method: 'POST' })}
                  className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold"
                >
                  СТАРТ
                </button>
                <button
                  onClick={() => fetch(`/api/lanes/${lane.id}/stop`, { method: 'POST' })}
                  className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold"
                >
                  СТОП
                </button>
              </div>
            </div>

            {lane.current_order ? (
              <div className="flex flex-col gap-3">
                {/* Карточка оставшегося времени */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-400">Остаток времени</div>
                    <div className="font-mono text-xl font-bold text-cyan-300">
                      {formatSeconds(lane.current_order.time_remaining_sec)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-400">Стоимость заказа</div>
                    <div className="font-mono text-base font-bold text-white">
                      {lane.current_order.total_cost.toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>

                {/* Кнопки управления временем */}
                <div className="grid grid-cols-2 gap-2">
                  {lane.phase === 'order_active' ? (
                    <button
                      onClick={() => pauseOrder(lane.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Пауза</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => resumeOrder(lane.id)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>Возобновить</span>
                    </button>
                  )}

                  <button
                    onClick={() => extendOrder(lane.id, 30, 900)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>+30 мин (900 ₽)</span>
                  </button>
                </div>

                {/* Панель точной двусторонней корректировки времени (Часть 4) */}
                <TimeEditor
                  orderId={lane.current_order.id}
                  laneId={lane.id}
                  currentEndsAt={lane.current_order.ends_at || new Date(lane.current_order.expires_at).toISOString()}
                  currentDurationMin={lane.current_order.duration_min || lane.current_order.duration_minutes || Math.round(lane.current_order.total_seconds_booked / 60)}
                  disabled={lane.phase === 'order_finished' || lane.phase === 'idle'}
                  onSuccess={(res) => {
                    if (lane.current_order) {
                      lane.current_order.duration_min = res.new_duration_min;
                      lane.current_order.duration_minutes = res.new_duration_min;
                      lane.current_order.ends_at = res.new_ends_at;
                      lane.current_order.expires_at = new Date(res.new_ends_at).getTime();
                    }
                  }}
                />

                {/* Завершение сессии */}
                <button
                  onClick={() => finishOrder(lane.id)}
                  className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <SquareCheck className="w-4 h-4" />
                  <span>Завершить и закрыть заказ</span>
                </button>

                <button
                  onClick={() => setIsTransferOpen(true)}
                  className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                  <span>Перенести заказ на другую дорожку</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsStartOrderOpen(true)}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Открыть новый заказ</span>
              </button>
            )}

            {/* Механическое оборудование */}
            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Оборудование дорожки
              </span>

              <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-white">Детские бортики</span>
                </div>
                <button
                  onClick={() => toggleBumpers(lane.id, !lane.bumpers_up)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    lane.bumpers_up
                      ? 'bg-amber-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {lane.bumpers_up ? 'ПОДНЯТЫ' : 'ОПУЩЕНЫ'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => triggerSweep(lane.id)}
                  className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium transition-colors"
                >
                  Смахнуть граблями
                </button>
                <button
                  onClick={() => triggerReset(lane.id)}
                  className="flex items-center justify-center gap-1 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Выставить 10 кеглей</span>
                </button>
              </div>

              {lane.phase === 'order_finished' && (
                <button
                  onClick={() => closeToIdle(lane.id)}
                  className="w-full mt-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Сбросить дорожку в ожидание
                </button>
              )}

              {/* Полная переинициализация / сброс дорожки */}
              <div className="pt-2 border-t border-zinc-800">
                {confirmResetLane ? (
                  <div className="flex flex-col gap-2 p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs">
                    <span className="text-rose-200 font-semibold text-[11px]">
                      Сбросить дорожку, заказ и кегли в исходное состояние?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetLane(lane.id);
                          setConfirmResetLane(false);
                        }}
                        className="flex-1 py-1 px-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs"
                      >
                        Да, сбросить
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetLane(false)}
                        className="py-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResetLane(true)}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Переинициализировать дорожку</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальные окна */}
      {scoreModalData && (
        <ScoreCorrectionModal
          laneId={lane.id}
          player={scoreModalData.player}
          frameIndex={scoreModalData.frameIndex}
          rollIndex={scoreModalData.rollIndex}
          onClose={() => setScoreModalData(null)}
        />
      )}

      {isStartOrderOpen && (
        <StartOrderModal
          laneId={lane.id}
          onClose={() => setIsStartOrderOpen(false)}
        />
      )}

      {isTransferOpen && (
        <TransferOrderModal
          currentLaneId={lane.id}
          onClose={() => setIsTransferOpen(false)}
        />
      )}
    </div>
  );
};
