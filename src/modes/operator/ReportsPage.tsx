import React from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { BarChart3, Trophy, DollarSign, Users, Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { lanes, settings } = useBowlingStore();

  const totalRevenue = lanes.reduce((acc, l) => acc + (l.current_order?.total_cost || 0), 0);
  const totalGamesPlayed = lanes.reduce((acc, l) => acc + l.history_games.length + (l.current_game ? 1 : 0), 0);
  const totalActivePlayers = lanes.reduce((acc, l) => acc + (l.current_game?.players.length || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Финансовые и сменные отчёты</h1>
            <p className="text-xs text-zinc-400">Журнал загрузки дорожек, статистика сыгранных партий и выручка</p>
          </div>
        </div>

        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lanes, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `bowlinghub-shift-report-${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-xl border border-zinc-700 transition-colors"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Экспорт отчёта JSON</span>
        </button>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Выручка за смену</span>
            <div className="text-3xl font-black font-mono text-cyan-400 mt-1">
              {totalRevenue.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Валюта учёта: {settings.currency}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Сыграно партий</span>
            <div className="text-3xl font-black font-mono text-white mt-1">
              {totalGamesPlayed}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">По всем дорожкам</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-zinc-400">Активных гостей</span>
            <div className="text-3xl font-black font-mono text-emerald-400 mt-1">
              {totalActivePlayers}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Играют прямо сейчас</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Таблица по дорожкам */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
          Детализация по дорожкам
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Дорожка</th>
                <th className="py-2.5 px-3">Фаза</th>
                <th className="py-2.5 px-3">Гость / Компания</th>
                <th className="py-2.5 px-3">Тариф</th>
                <th className="py-2.5 px-3">Завершено игр</th>
                <th className="py-2.5 px-3 text-right">Начислено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {lanes.map(l => (
                <tr key={l.id} className="hover:bg-zinc-900/40">
                  <td className="py-3 px-3 font-bold text-white font-sans">{l.name}</td>
                  <td className="py-3 px-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
                      {l.phase === 'order_active' ? 'Идёт игра' : l.phase === 'paused' ? 'Пауза' : l.phase === 'between_games' ? 'Итоги игры' : l.phase === 'order_finished' ? 'Завершено' : 'Свободна'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-zinc-300">
                    {l.current_order?.guest_name || '—'}
                  </td>
                  <td className="py-3 px-3 font-sans text-zinc-400">
                    {l.current_order?.tariff_name || '—'}
                  </td>
                  <td className="py-3 px-3 text-zinc-300">{l.history_games.length}</td>
                  <td className="py-3 px-3 text-right font-bold text-cyan-400">
                    {(l.current_order?.total_cost || 0).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
