import React, { useState } from 'react';
import { useBowlingStore } from '../store/bowlingStore';
import { Zap, Activity, RotateCcw, AlertTriangle, Play, Flame, ShieldAlert } from 'lucide-react';

interface HardwareSimProps {
  laneId: number;
}

export const InteractiveHardwareSim: React.FC<HardwareSimProps> = ({ laneId }) => {
  const { simulateThrow, triggerSweep, triggerReset, lanes } = useBowlingStore();
  const [selectedPins, setSelectedPins] = useState<number[]>([1, 2, 3, 5]);
  const [speedMps, setSpeedMps] = useState(7.5);
  const [isFoul, setIsFoul] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const lane = lanes.find(l => l.id === laneId);

  const handleThrowCustom = () => {
    simulateThrow(laneId, selectedPins, isFoul, speedMps);
  };

  const handleStrike = () => {
    const standing = lane?.current_pin_state.pins
      .map((s, idx) => (s ? idx + 1 : 0))
      .filter(p => p > 0) || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    simulateThrow(laneId, standing, false, 8.2);
  };

  const handleSpare = () => {
    const standing = lane?.current_pin_state.pins
      .map((s, idx) => (s ? idx + 1 : 0))
      .filter(p => p > 0) || [7, 10];
    simulateThrow(laneId, standing, false, 7.6);
  };

  const handleSplit = () => {
    // Оставляет сплит 7-10 (сбивает 1, 2, 3, 4, 5, 6, 8, 9)
    simulateThrow(laneId, [1, 2, 3, 4, 5, 6, 8, 9], false, 7.1);
  };

  const handleGutter = () => {
    simulateThrow(laneId, [], false, 5.8);
  };

  const handleFoul = () => {
    simulateThrow(laneId, [1, 2, 3], true, 6.9);
  };

  const togglePinSelect = (p: number) => {
    if (selectedPins.includes(p)) {
      setSelectedPins(selectedPins.filter(x => x !== p));
    } else {
      setSelectedPins([...selectedPins, p].sort((a, b) => a - b));
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-zinc-950/90 shadow-2xl p-4 text-xs">
      <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white uppercase tracking-wider">
            Симулятор датчиков и бросков (Дорожка {laneId})
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-cyan-400 hover:text-cyan-300 font-medium"
        >
          {isOpen ? 'Компактный вид' : 'Матрица выбора кеглей'}
        </button>
      </div>

      {/* Быстрые кнопки симуляции бросков */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <button
          onClick={handleStrike}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg transition-colors shadow-md shadow-cyan-600/20"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Страйк (X)</span>
        </button>

        <button
          onClick={handleSpare}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Спэр (/)</span>
        </button>

        <button
          onClick={handleSplit}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Сплит 7-10</span>
        </button>

        <button
          onClick={handleGutter}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg transition-colors"
        >
          <span>В желоб (-)</span>
        </button>

        <button
          onClick={handleFoul}
          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Заступ (Фол)</span>
        </button>
      </div>

      {/* Управление механикой пинспоттера */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Пинспоттер:</span>
          <button
            onClick={() => triggerSweep(laneId)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium transition-colors"
          >
            Смахнуть граблями
          </button>
          <button
            onClick={() => triggerReset(laneId)}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Выставить 10 кеглей
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-zinc-300">
            Скорость: {speedMps} м/с ({(speedMps * 3.6).toFixed(1)} км/ч)
          </span>
          <input
            type="range"
            min="3.0"
            max="12.0"
            step="0.1"
            value={speedMps}
            onChange={e => setSpeedMps(parseFloat(e.target.value))}
            className="w-24 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Матрица точного выбора кеглей */}
      {isOpen && (
        <div className="mt-3 p-3 bg-black/50 rounded-lg border border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Выберите точные кегли, которые будут сбиты при броске:</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-rose-400 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFoul}
                  onChange={e => setIsFoul(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                Зафиксировать фол
              </label>
            </div>
          </div>

          {/* Кнопки переключения кеглей */}
          <div className="flex items-center justify-center gap-1.5 py-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => {
              const isSelected = selectedPins.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePinSelect(p)}
                  className={`w-7 h-7 rounded-full font-bold transition-all ${
                    isSelected
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleThrowCustom}
              className="flex items-center gap-2 py-1.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Выполнить бросок (сбить {selectedPins.length} кег.)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
