import React from 'react';
import { LaneState } from '../../types/vidibi';
import { VidibiTheme } from '../../shared/themes/vidibiThemes';
import { Trophy, Play } from 'lucide-react';

interface BetweenGamesScreenProps {
  lane: LaneState;
  theme: VidibiTheme;
  onStartNextGame?: () => void;
}

export const BetweenGamesScreen: React.FC<BetweenGamesScreenProps> = ({
  lane,
  theme,
  onStartNextGame,
}) => {
  const lastGame = lane.history_games[lane.history_games.length - 1] || lane.current_game;
  const playersSorted = lastGame?.players ? [...lastGame.players].sort((a, b) => (b.total_score + b.handicap) - (a.total_score + a.handicap)) : [];
  const winner = playersSorted[0];

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
  if (lane.current_game && !lane.history_games.includes(lane.current_game)) {
    lane.current_game.players.forEach(p => {
      const pScore = p.total_score + (p.handicap || 0);
      sessionTotalScores[p.id] = (sessionTotalScores[p.id] || 0) + pScore;
      if (p.name) {
        sessionTotalScores[p.name] = (sessionTotalScores[p.name] || 0) + pScore;
      }
    });
  }

  // R6: TV Panel Auto-advance timer (passive display)
  React.useEffect(() => {
    if (!onStartNextGame) return;
    const timer = setTimeout(() => {
      onStartNextGame();
    }, 15000); // 15 seconds auto-advance to next game if order is active
    return () => clearTimeout(timer);
  }, [onStartNextGame]);

  return (
    <div className={`w-full min-h-screen flex flex-col justify-between p-8 md:p-12 ${theme.bgClass} select-none`}>
      {/* Верхний статус */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-black font-black text-2xl flex items-center justify-center">
            {lane.id}
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{lane.name}</h1>
            <p className="text-xs text-zinc-400">Партия {lastGame?.game_number || 1} завершена · Итоговые результаты</p>
          </div>
        </div>

        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
          Партия завершена
        </span>
      </header>

      {/* Центр экрана: Победитель и Таблица результатов */}
      <main className="my-auto max-w-3xl w-full mx-auto flex flex-col items-center">
        {/* Карточка чемпиона */}
        {winner && (
          <div className="w-full p-6 rounded-3xl bg-gradient-to-b from-amber-500/20 via-yellow-900/10 to-transparent border-2 border-amber-400/40 shadow-2xl flex flex-col items-center text-center mb-8 relative">
            <div className="w-20 h-20 rounded-full bg-amber-400 text-black flex items-center justify-center mb-3 shadow-lg shadow-amber-400/30">
              <Trophy className="w-10 h-10" />
            </div>

            <div className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1">
              Победитель партии
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-2">
              {winner.name}
            </h2>
            <div className="text-2xl font-mono font-black text-amber-400">
              {winner.total_score + winner.handicap} очков
            </div>
            {sessionTotalScores[winner.id] !== undefined && (
              <div className="text-xs font-mono text-zinc-300 mt-1">
                Всего за сессию: <span className="font-bold text-amber-300">{sessionTotalScores[winner.id]}</span> очков
              </div>
            )}
          </div>
        )}

        {/* Таблица игроков с разбивкой за партию и общий счёт сессии (R5) */}
        <div className="w-full flex flex-col gap-2.5 mb-8">
          {playersSorted.map((player, idx) => {
            const playerGameScore = player.total_score + player.handicap;
            const playerSessionScore = sessionTotalScores[player.id] ?? sessionTotalScores[player.name] ?? playerGameScore;

            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 font-mono font-bold text-lg text-zinc-400">
                    #{idx + 1}
                  </span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: player.color || '#38bdf8' }}
                  />
                  <div>
                    <div className="font-bold text-base text-white">{player.name}</div>
                    <div className="text-xs text-zinc-400 flex items-center gap-2">
                      <span>{player.strikes_count} страйк(ов)</span>
                      <span>·</span>
                      <span>{player.spares_count} спэр(ов)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="text-[10px] uppercase text-zinc-400 font-bold">Партия</div>
                    <div className="text-xl font-bold font-mono text-zinc-300">
                      {playerGameScore}
                    </div>
                  </div>
                  <div className="pl-4 border-l border-white/10">
                    <div className="text-[10px] uppercase text-amber-400 font-bold">Всего за сессию</div>
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {playerSessionScore}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Пассивный статус (R6 - No interactive buttons on Kiosk TV) */}
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-zinc-900/80 border border-white/10 text-zinc-300 text-sm font-semibold backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Следующая партия начнётся автоматически или по команде оператора</span>
        </div>
      </main>

      {/* Подвал */}
      <footer className="text-center text-xs text-zinc-500 font-mono">
        Счёт зафиксирован и сохранён в архиве турниров BowlingHub
      </footer>
    </div>
  );
};
