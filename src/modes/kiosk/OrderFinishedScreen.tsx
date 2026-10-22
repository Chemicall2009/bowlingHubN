import React from 'react';
import { LaneState } from '../../types/vidibi';
import { VidibiTheme } from '../../shared/themes/vidibiThemes';
import { CheckCircle2, RotateCcw } from 'lucide-react';

interface OrderFinishedScreenProps {
  lane: LaneState;
  theme: VidibiTheme;
  onCloseToIdle?: () => void;
}

export const OrderFinishedScreen: React.FC<OrderFinishedScreenProps> = ({
  lane,
  theme,
  onCloseToIdle,
}) => {
  const order = lane.current_order;

  // R5: Calculate total score across all games in finished session
  const sessionTotalScores: Record<string, { name: string; score: number }> = {};
  lane.history_games.forEach(hg => {
    hg.players.forEach(p => {
      const pScore = p.total_score + (p.handicap || 0);
      if (!sessionTotalScores[p.id]) {
        sessionTotalScores[p.id] = { name: p.name, score: 0 };
      }
      sessionTotalScores[p.id].score += pScore;
    });
  });
  const sessionPlayersList = Object.values(sessionTotalScores).sort((a, b) => b.score - a.score);

  // Auto-transition to idle after 60s if configured
  React.useEffect(() => {
    if (!onCloseToIdle) return;
    const timer = setTimeout(() => {
      onCloseToIdle();
    }, 60000);
    return () => clearTimeout(timer);
  }, [onCloseToIdle]);

  return (
    <div className={`w-full min-h-screen flex flex-col justify-between p-8 md:p-12 ${theme.bgClass} select-none`}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-black font-black text-2xl flex items-center justify-center">
            {lane.id}
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{lane.name}</h1>
            <p className="text-xs text-zinc-400">Сессия завершена · Итоговые результаты</p>
          </div>
        </div>

        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
          Заказ завершён
        </span>
      </header>

      <main className="my-auto max-w-lg w-full mx-auto flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center mb-6 text-cyan-400 shadow-2xl">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight mb-2">
          Спасибо за игру!
        </h2>
        <p className="text-base text-zinc-300 mb-6 leading-relaxed">
          Время игры на {lane.name} подошло к концу. Пожалуйста, подойдите к стойке администратора для закрытия счёта и сдачи прокатной обуви.
        </p>

        {/* Общий счёт за все партии текущей сессии (R5) */}
        {sessionPlayersList.length > 0 && (
          <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 backdrop-blur-md mb-4 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-2">
              Итоговый счёт за сессию (все партии):
            </div>
            <div className="flex flex-col gap-1.5">
              {sessionPlayersList.map((sp, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-white font-medium">{idx + 1}. {sp.name}</span>
                  <span className="font-mono font-black text-amber-400">{sp.score} очков</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Карточка сведений о сессии */}
        {order && (
          <div className="w-full p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex flex-col gap-3 text-xs mb-8">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-zinc-400">Гость / Компания:</span>
              <span className="font-bold text-white">{order.guest_name}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-zinc-400">Тарифный план:</span>
              <span className="font-semibold text-cyan-300">{order.tariff_name}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-zinc-400">Сыграно партий:</span>
              <span className="font-mono font-bold text-white">{lane.history_games.length}</span>
            </div>
            <div className="flex justify-between text-sm pt-1">
              <span className="text-zinc-300 font-semibold">Итого к оплате:</span>
              <span className="font-mono font-black text-cyan-400 text-base">
                {order.total_cost.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        )}

        {/* Информационный бейдж (Read-only, R6) */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-zinc-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span>Сброс дорожки осуществляется со стойки оператора</span>
        </div>
      </main>

      <footer className="text-center text-xs text-zinc-500 font-mono">
        Боулинг-центр «Страйк Сити» · На базе платформы BowlingHub
      </footer>
    </div>
  );
};
