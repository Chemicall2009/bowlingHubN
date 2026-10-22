import React from 'react';
import { LaneState } from '../../types/vidibi';
import { VidibiTheme } from '../../shared/themes/vidibiThemes';
import { Trophy, QrCode, Sparkles, Play } from 'lucide-react';

interface IdleScreenProps {
  lane: LaneState;
  theme: VidibiTheme;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({ lane, theme }) => {
  return (
    <div className={`w-full h-full min-h-screen flex flex-col justify-between p-8 md:p-12 ${theme.bgClass} relative overflow-hidden select-none`}>
      {/* Фоновое свечение */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Верхний колонтитул */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            {lane.id}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{lane.name}</h1>
            <p className="text-xs text-zinc-400 font-medium">Боулинг-центр «Страйк Сити» · Экран VIDIBI</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            Дорожка свободна
          </span>
          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">Автоматическая система подсчёта очков</div>
        </div>
      </header>

      {/* Центр экрана (Read-only, R6) */}
      <main className="flex flex-col items-center justify-center text-center my-auto z-10">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-3xl bg-zinc-900/90 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-xl ring-4 ring-cyan-400/20">
            <Trophy className="w-14 h-14 text-cyan-400 animate-pulse" />
          </div>
          <Sparkles className="w-6 h-6 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
        </div>

        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white mb-3">
          Добро пожаловать на {lane.name}
        </h2>
        <p className="text-base md:text-lg text-zinc-300 max-w-lg mb-8 leading-relaxed">
          Для начала игры обратитесь к администратору на стойке оператора.
        </p>

        {/* Информационный бейдж ожидания */}
        <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-zinc-900/80 border border-cyan-500/30 text-cyan-300 font-semibold text-sm backdrop-blur-md shadow-lg shadow-cyan-500/10">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Ожидание открытия дорожки оператором</span>
        </div>
      </main>

      {/* Нижняя плашка с QR */}
      <footer className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md z-10 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white text-black">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-white">Меню бара и кухни по QR-коду</div>
            <div className="text-zinc-400 text-[11px]">Заказ напитков и закусок прямо к вашей дорожке</div>
          </div>
        </div>

        <div className="text-right text-zinc-400 font-mono text-[11px]">
          Тема: <span className="text-cyan-300 font-semibold">{theme.name}</span> · Стандарт USBC
        </div>
      </footer>
    </div>
  );
};
