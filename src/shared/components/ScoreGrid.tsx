import React from 'react';
import { Player } from '../../types/vidibi';
import { VidibiTheme } from '../themes/vidibiThemes';

interface ScoreGridProps {
  players: Player[];
  activePlayerIndex: number;
  theme: VidibiTheme;
  interactive?: boolean;
  onFrameClick?: (player: Player, frameIndex: number, rollIndex: number) => void;
  sessionTotalScores?: Record<string, number>;
}

export const ScoreGrid: React.FC<ScoreGridProps> = ({
  players,
  activePlayerIndex,
  theme,
  interactive = false,
  onFrameClick,
  sessionTotalScores,
}) => {
  const showSessionTotal = Boolean(sessionTotalScores && Object.keys(sessionTotalScores).length > 0);

  return (
    <div className="w-full overflow-x-auto select-none rounded-xl border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className={`${theme.scoreGridHeader} border-b border-white/10 text-xs md:text-sm tracking-wider uppercase`}>
            <th className="py-3 px-4 text-left font-semibold w-44">Боулер / Игрок</th>
            <th className="py-3 px-2 font-semibold">ГДКП</th>
            {Array.from({ length: 9 }).map((_, i) => (
              <th key={i} className="py-3 px-2 font-semibold w-14">
                {i + 1}
              </th>
            ))}
            <th className="py-3 px-2 font-semibold w-24">10</th>
            <th className="py-3 px-4 font-bold text-right w-20">Партия</th>
            {showSessionTotal && (
              <th className="py-3 px-4 font-bold text-right w-24 text-amber-400 border-l border-white/10">
                Всего
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((player, pIdx) => {
            const isActive = pIdx === activePlayerIndex;

            return (
              <tr
                key={player.id}
                className={`border-b border-white/5 transition-all duration-200 ${
                  isActive
                    ? 'bg-white/10 font-medium ring-1 ring-inset ring-cyan-400/50'
                    : 'hover:bg-white/5'
                }`}
              >
                {/* Имя игрока и статистика */}
                <td className="py-3 px-4 text-left">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: player.color || '#38bdf8' }}
                    />
                    <div className="truncate">
                      <div className="font-semibold text-sm md:text-base text-white flex items-center gap-2">
                        <span>{player.name}</span>
                        {isActive && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            Бросок
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                        <span>{player.strikes_count} страйк(ов)</span>
                        <span>·</span>
                        <span>{player.spares_count} спэр(ов)</span>
                        {player.avg_speed_mps > 0 && (
                          <>
                            <span>·</span>
                            <span>{player.avg_speed_mps} м/с</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Гандикап */}
                <td className="py-3 px-2 text-zinc-400 font-mono text-xs md:text-sm">
                  +{player.handicap}
                </td>

                {/* Фреймы 1 - 9 */}
                {Array.from({ length: 9 }).map((_, fIdx) => {
                  const frame = player.frames[fIdx];
                  const isCurrentFrame = isActive && player.current_frame_index === fIdx;
                  const roll1 = frame?.rolls?.[0];
                  const roll2 = frame?.rolls?.[1];

                  return (
                    <td
                      key={fIdx}
                      className={`p-1 relative border-l border-white/10 transition-colors ${
                        isCurrentFrame ? 'bg-cyan-500/15 ring-2 ring-cyan-400/60 ring-inset' : ''
                      }`}
                    >
                      <div className="flex flex-col h-14 justify-between">
                        {/* Верхние ячейки бросков */}
                        <div className="flex h-7 border-b border-white/10 text-xs font-mono">
                          {/* 1-й бросок */}
                          <div
                            onClick={() => interactive && onFrameClick?.(player, fIdx, 0)}
                            className={`w-1/2 flex items-center justify-center border-r border-white/10 ${
                              interactive ? 'cursor-pointer hover:bg-white/10' : ''
                            } ${
                              roll1 === 'X'
                                ? theme.strikeColor
                                : frame?.is_split
                                ? 'text-amber-400 font-bold'
                                : 'text-zinc-200'
                            }`}
                          >
                            {roll1 === 'X' ? 'X' : roll1 !== undefined ? roll1 : ''}
                          </div>

                          {/* 2-й бросок */}
                          <div
                            onClick={() => interactive && onFrameClick?.(player, fIdx, 1)}
                            className={`w-1/2 flex items-center justify-center ${
                              interactive ? 'cursor-pointer hover:bg-white/10' : ''
                            } ${
                              roll2 === '/'
                                ? theme.spareColor
                                : roll2 === 'F'
                                ? 'text-rose-500 font-bold'
                                : 'text-zinc-200'
                            }`}
                          >
                            {roll2 !== undefined ? roll2 : ''}
                          </div>
                        </div>

                        {/* Накопительный счёт фрейма */}
                        <div className="h-7 flex items-center justify-center font-bold text-sm md:text-base text-white font-mono">
                          {frame?.score !== null && frame?.score !== undefined ? frame.score : ''}
                        </div>
                      </div>
                    </td>
                  );
                })}

                {/* 10-й Фрейм (3 броска) */}
                <td
                  className={`p-1 relative border-l border-white/10 transition-colors ${
                    isActive && player.current_frame_index === 9 ? 'bg-cyan-500/15 ring-2 ring-cyan-400/60 ring-inset' : ''
                  }`}
                >
                  <div className="flex flex-col h-14 justify-between">
                    <div className="flex h-7 border-b border-white/10 text-xs font-mono">
                      {/* 1-й бросок */}
                      <div
                        onClick={() => interactive && onFrameClick?.(player, 9, 0)}
                        className={`w-1/3 flex items-center justify-center border-r border-white/10 ${
                          interactive ? 'cursor-pointer hover:bg-white/10' : ''
                        } ${
                          player.frames[9]?.rolls?.[0] === 'X'
                            ? theme.strikeColor
                            : 'text-zinc-200'
                        }`}
                      >
                        {player.frames[9]?.rolls?.[0] ?? ''}
                      </div>

                      {/* 2-й бросок */}
                      <div
                        onClick={() => interactive && onFrameClick?.(player, 9, 1)}
                        className={`w-1/3 flex items-center justify-center border-r border-white/10 ${
                          interactive ? 'cursor-pointer hover:bg-white/10' : ''
                        } ${
                          player.frames[9]?.rolls?.[1] === 'X'
                            ? theme.strikeColor
                            : player.frames[9]?.rolls?.[1] === '/'
                            ? theme.spareColor
                            : 'text-zinc-200'
                        }`}
                      >
                        {player.frames[9]?.rolls?.[1] ?? ''}
                      </div>

                      {/* 3-й бросок */}
                      <div
                        onClick={() => interactive && onFrameClick?.(player, 9, 2)}
                        className={`w-1/3 flex items-center justify-center ${
                          interactive ? 'cursor-pointer hover:bg-white/10' : ''
                        } ${
                          player.frames[9]?.rolls?.[2] === 'X'
                            ? theme.strikeColor
                            : player.frames[9]?.rolls?.[2] === '/'
                            ? theme.spareColor
                            : 'text-zinc-200'
                        }`}
                      >
                        {player.frames[9]?.rolls?.[2] ?? ''}
                      </div>
                    </div>

                    <div className="h-7 flex items-center justify-center font-bold text-sm md:text-base text-white font-mono">
                      {player.frames[9]?.score !== null && player.frames[9]?.score !== undefined
                        ? player.frames[9].score
                        : ''}
                    </div>
                  </div>
                </td>

                {/* Итоговый счёт за партию */}
                <td className="py-3 px-4 text-right border-l border-white/10">
                  <div className="text-xl md:text-2xl font-black font-mono text-cyan-400">
                    {player.total_score + player.handicap}
                  </div>
                  {player.handicap > 0 && (
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Без ГДКП: {player.total_score}
                    </div>
                  )}
                </td>

                {/* Общий счёт за все партии сессии (R5) */}
                {showSessionTotal && (
                  <td className="py-3 px-4 text-right border-l border-white/10 bg-amber-500/5">
                    <div className="text-xl md:text-2xl font-black font-mono text-amber-400">
                      {(sessionTotalScores?.[player.id] !== undefined
                        ? sessionTotalScores[player.id]
                        : sessionTotalScores?.[player.name] !== undefined
                        ? sessionTotalScores[player.name]
                        : (player.total_score + player.handicap))}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      сессия
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
