import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { X, ArrowRight, ShieldAlert } from 'lucide-react';

interface TransferOrderModalProps {
  currentLaneId: number;
  onClose: () => void;
  onTransferred?: (newLaneId: number) => void;
}

export const TransferOrderModal: React.FC<TransferOrderModalProps> = ({ currentLaneId, onClose, onTransferred }) => {
  const { lanes, transferOrder, setSelectedLaneId } = useBowlingStore();
  const availableLanes = lanes.filter(l => l.enabled !== false && l.id !== currentLaneId && (l.phase === 'idle' || l.phase === 'order_finished'));

  const [targetLaneId, setTargetLaneId] = useState<number>(availableLanes[0]?.id || 1);
  const [error, setError] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!targetLaneId) {
      setError('Выберите целевую дорожку');
      return;
    }
    try {
      transferOrder(currentLaneId, targetLaneId);
      setSelectedLaneId(targetLaneId);
      if (onTransferred) {
        onTransferred(targetLaneId);
      }

      try {
        await fetch(`/api/lanes/${currentLaneId}/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_lane_id: targetLaneId }),
        });
      } catch {
        // store updated
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка переноса заказа');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-black text-white mb-1">Перенос заказа и игры</h3>
        <p className="text-xs text-zinc-400 mb-5">
          Перемещение текущего заказа, игроков и протокола со всеми фреймами на другую дорожку.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {availableLanes.length === 0 ? (
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-400 mb-5">
            Нет свободных дорожек для переноса заказа.
          </div>
        ) : (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Выберите целевую свободную дорожку:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableLanes.map(lane => (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => setTargetLaneId(lane.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    targetLaneId === lane.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold text-sm">{lane.name}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Свободна</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={availableLanes.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-colors"
          >
            <span>Перенести на дорожку {targetLaneId}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
