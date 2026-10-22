import React, { useState } from 'react';
import { AdjustDurationResult } from '../../../backend/services/orderService';
import { Clock, Edit3, Loader2, AlertTriangle } from 'lucide-react';

interface TimeEditorProps {
  orderId: string;
  laneId: number;
  currentEndsAt: string;
  currentDurationMin: number;
  disabled?: boolean;
  onSuccess?: (result: AdjustDurationResult) => void;
  onOptimisticAdjust?: (deltaMin: number) => void;
}

export const TimeEditor: React.FC<TimeEditorProps> = ({
  orderId,
  laneId: _laneId,
  currentEndsAt,
  currentDurationMin,
  disabled = false,
  onSuccess,
  onOptimisticAdjust,
}) => {
  const [loadingDelta, setLoadingDelta] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<string>('15');
  const [pendingConfirm, setPendingConfirm] = useState<{ delta: number; message: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const executeAdjust = async (deltaMin: number, reason?: string) => {
    setLoadingDelta(deltaMin);
    onOptimisticAdjust?.(deltaMin);

    try {
      const res = await fetch(`/api/orders/${orderId}/duration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta_min: deltaMin, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Ошибка корректировки времени');
      }
      showToast(`Время изменено на ${deltaMin > 0 ? `+${deltaMin}` : deltaMin} мин. Очки сохранены.`);
      onSuccess?.(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Ошибка: ${msg}`);
      // Откатить оптимистичное изменение
      onOptimisticAdjust?.(-deltaMin);
    } finally {
      setLoadingDelta(null);
    }
  };

  const handleDeltaClick = (delta: number) => {
    if (disabled || loadingDelta !== null) return;

    const targetEndsAtMs = new Date(currentEndsAt).getTime() + delta * 60_000;
    if (targetEndsAtMs <= Date.now()) {
      setPendingConfirm({
        delta,
        message: 'Уменьшение до отрицательного времени. Заказ будет помечен как истекший. Очки будут сохранены. Продолжить?',
      });
      return;
    }

    if (delta <= -60) {
      setPendingConfirm({
        delta,
        message: `Уменьшение на ${Math.abs(delta)} мин. Подтвердить?`,
      });
      return;
    }

    executeAdjust(delta);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutes, 10);
    if (isNaN(val) || val === 0) return;
    setIsModalOpen(false);
    handleDeltaClick(val);
  };

  const deltas = [-30, -15, -5, -1, 1, 5, 15, 30];

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
      <div className="flex items-center justify-between text-zinc-400">
        <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          Корректировка времени (без сброса счёта)
        </span>
        <span className="font-mono text-[11px]">Длительность: {currentDurationMin} мин</span>
      </div>

      {/* Быстрые кнопки дельты */}
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex items-center gap-1">
          {deltas.slice(0, 4).map(d => (
            <button
              key={d}
              type="button"
              disabled={disabled || loadingDelta !== null}
              onClick={() => handleDeltaClick(d)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-300 hover:text-rose-200 border border-rose-500/20 font-mono font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {loadingDelta === d && <Loader2 className="w-3 h-3 animate-spin" />}
              {d}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-700 mx-1" />

        <div className="flex items-center gap-1">
          {deltas.slice(4).map(d => (
            <button
              key={d}
              type="button"
              disabled={disabled || loadingDelta !== null}
              onClick={() => handleDeltaClick(d)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 hover:text-emerald-200 border border-emerald-500/20 font-mono font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {loadingDelta === d && <Loader2 className="w-3 h-3 animate-spin" />}
              +{d}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={disabled || loadingDelta !== null}
          onClick={() => setIsModalOpen(true)}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 transition-colors ml-auto"
          title="Ввести точное количество минут"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Тост обратной связи */}
      {toastMessage && (
        <div className="text-[11px] font-semibold px-2 py-1 rounded bg-black/60 border border-cyan-500/40 text-cyan-300 animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Подтверждение для критичных операций */}
      {pendingConfirm && (
        <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 flex flex-col gap-2 mt-1">
          <div className="flex items-start gap-2 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{pendingConfirm.message}</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                const d = pendingConfirm.delta;
                setPendingConfirm(null);
                executeAdjust(d);
              }}
              className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Подтвердить
            </button>
          </div>
        </div>
      )}

      {/* Модалка произвольного изменения минут */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCustomSubmit}
            className="w-full max-w-xs p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col gap-4 text-xs"
          >
            <h4 className="font-bold text-white text-sm">Точная корректировка минут</h4>
            <div>
              <label className="text-zinc-400 block mb-1">
                Минуты (+ для добавления, - для вычитания):
              </label>
              <input
                type="number"
                value={customMinutes}
                onChange={e => setCustomMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                min="-240"
                max="240"
                required
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              >
                Применить
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
