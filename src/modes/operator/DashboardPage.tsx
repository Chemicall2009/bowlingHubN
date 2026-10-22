import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { VIDIBI_THEMES } from '../../shared/themes/vidibiThemes';
import { StartOrderModal } from './StartOrderModal';
import {
  Play,
  Pause,
  Clock,
  Trophy,
  ChevronRight,
  Shield,
  Activity,
  Zap,
} from 'lucide-react';

interface DashboardPageProps {
  onSelectLane: (laneId: number) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectLane }) => {
  const {
    lanes,
    settings,
    pauseOrder,
    resumeOrder,
    extendOrder,
    toggleBumpers,
    recentEvents,
  } = useBowlingStore();

  const [startingOrderLaneId, setStartingOrderLaneId] = useState<number | null>(null);

  // Метрики текущей смены с фильтрацией по total_lanes
  const totalLanes = settings?.total_lanes || 6;
  const enabledLanes = lanes.filter(l => l.enabled !== false && l.id <= totalLanes);
  const activeLanesCount = enabledLanes.filter(l => l.phase === 'order_active').length;
  const occupancyPercent = enabledLanes.length > 0 ? Math.round((activeLanesCount / enabledLanes.length) * 100) : 0;
  const totalShiftRevenue = enabledLanes.reduce((acc, l) => acc + (l.current_order?.total_cost || 0), 0);

  const getGridColsClass = (count: number) => {
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
    if (count <= 6) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
    if (count <= 8) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6';
  };

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'order_active':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Идёт игра
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Пауза
          </span>
        );
      case 'between_games':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            Между партиями
          </span>
        );
      case 'order_finished':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Время истекло
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            Свободна
          </span>
        );
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель KPI смены */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs font-medium text-zinc-400">Занято дорожек</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {activeLanesCount} <span className="text-sm font-normal text-zinc-500">/ {lanes.length}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono text-xs">
            {occupancyPercent}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs font-medium text-zinc-400">Текущая выручка</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
              {totalShiftRevenue.toLocaleString('ru-RU')} ₽
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs font-medium text-zinc-400">Оборудование ESP32</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {lanes.length * 3} <span className="text-xs text-emerald-400 font-normal">в сети</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between shadow-lg">
          <div>
            <div className="text-xs font-medium text-zinc-400">Статус брокера MQTT</div>
            <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Подключен (:1883)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Сетка дорожек */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Матрица дорожек ({enabledLanes.length} дорожек)</span>
          </div>
          <div className="text-xs text-zinc-500">
            Нажмите на карточку дорожки для детального управления, камеры и коррекции счёта
          </div>
        </div>

        <div className={`grid ${getGridColsClass(enabledLanes.length)} gap-4`}>
          {enabledLanes.map(lane => {
            const hasOrder = Boolean(lane.current_order);
            const activePlayer = lane.current_game?.players[lane.current_game.active_player_index];

            return (
              <div
                key={lane.id}
                className="flex flex-col rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 shadow-xl overflow-hidden"
              >
                {/* Заголовок карточки */}
                <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onSelectLane(lane.id)}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-black font-black text-lg flex items-center justify-center shadow-md shadow-cyan-500/20 hover:opacity-90"
                    >
                      {lane.id}
                    </button>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{lane.name}</span>
                        {lane.bumpers_up && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                            Бортики подняты
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5">{getPhaseBadge(lane.phase)}</div>
                    </div>
                  </div>

                  {/* Ссылка на киоск VIDIBI */}
                  <a
                    href={`/kiosk/${lane.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-medium border border-zinc-700 transition-colors"
                  >
                    <span>Экран VIDIBI</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Тело карточки */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  {hasOrder && lane.current_order ? (
                    <div className="flex flex-col gap-3">
                      {/* Информация о госте и таймбанке */}
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <div className="text-zinc-400">Гость / Компания</div>
                          <div className="font-semibold text-white text-sm truncate max-w-[150px]">
                            {lane.current_order.guest_name}
                          </div>
                        </div>

                        {lane.current_order.pricing_type === 'time' ? (
                          <div className="text-right">
                            <div className="text-zinc-400 flex items-center gap-1 justify-end">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Осталось</span>
                            </div>
                            <div className="font-mono font-bold text-base text-cyan-300">
                              {formatSeconds(lane.current_order.time_remaining_sec)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="text-zinc-400">Прогресс партии</div>
                            <div className="font-mono font-bold text-base text-cyan-300">
                              Игра {lane.current_game?.game_number || 1} из {lane.current_order.target_games}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Активный боулер */}
                      {lane.current_game && (
                        <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between">
                          <div>
                            <div className="text-[11px] text-zinc-400">Бросает сейчас</div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>{activePlayer?.name || 'Игрок'}</span>
                              <span className="text-xs text-zinc-400 font-mono">
                                (Фрейм {(activePlayer?.current_frame_index || 0) + 1})
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-zinc-400">Счёт</div>
                            <div className="text-xl font-black font-mono text-cyan-400">
                              {activePlayer?.total_score || 0}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Мини-индикатор стоящих кеглей */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-zinc-400">Стоящие кегли:</span>
                        <div className="flex items-center gap-1">
                          {lane.current_pin_state.pins.map((standing, pIdx) => (
                            <span
                              key={pIdx}
                              className={`w-2.5 h-2.5 rounded-full ${
                                standing ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-zinc-800'
                              }`}
                              title={`Кегля ${pIdx + 1}: ${standing ? 'Стоит' : 'Сбита'}`}
                            />
                          ))}
                          <span className="font-mono text-zinc-300 ml-1 font-semibold">
                            {lane.current_pin_state.pins_standing_count}/10
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Свободная дорожка */
                    <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-500">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-2 text-zinc-600">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-sm text-zinc-300">Дорожка свободна</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Готова к бронированию и открытию</div>
                    </div>
                  )}

                  {/* Быстрые действия */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 gap-2">
                    {hasOrder ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          {lane.phase === 'order_active' ? (
                            <button
                              onClick={() => pauseOrder(lane.id)}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 transition-colors"
                              title="Приостановить сессию"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => resumeOrder(lane.id)}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-colors"
                              title="Возобновить сессию"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => extendOrder(lane.id, 30, 900)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors"
                            title="Добавить 30 минут"
                          >
                            +30м
                          </button>

                          <button
                            onClick={() => toggleBumpers(lane.id, !lane.bumpers_up)}
                            className={`p-2 rounded-lg border transition-colors ${
                              lane.bumpers_up
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-zinc-800 border-transparent text-zinc-400 hover:text-white'
                            }`}
                            title="Бортики для детей"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => onSelectLane(lane.id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span>Управление</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() => setStartingOrderLaneId(lane.id)}
                          className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Открыть сессию</span>
                        </button>
                        <button
                          onClick={() => onSelectLane(lane.id)}
                          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                          title="Управление дорожкой"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Поток аппаратных событий WS в реальном времени */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Поток событий оборудования и WebSocket (Вариант 2, плоский формат)
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">Прямой эфир</span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto font-mono text-xs">
          {recentEvents.slice(0, 8).map((evt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1 px-2.5 rounded bg-zinc-900/60 border border-zinc-800/60 text-zinc-300"
            >
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">Дорожка {evt.lane_id || 1}</span>
                <span className="text-purple-400 font-semibold">{evt.type}</span>
                <span className="text-zinc-500 truncate max-w-md">
                  {JSON.stringify(evt).substring(0, 90)}...
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 shrink-0">
                {new Date(evt.ts).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Модальное окно открытия дорожки */}
      {startingOrderLaneId !== null && (
        <StartOrderModal
          laneId={startingOrderLaneId}
          onClose={() => setStartingOrderLaneId(null)}
        />
      )}
    </div>
  );
};
