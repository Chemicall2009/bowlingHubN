import React, { useState } from 'react';
import { Player } from '../../types/vidibi';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { X, Check, ShieldAlert } from 'lucide-react';

interface ScoreCorrectionModalProps {
  laneId: number;
  player: Player;
  frameIndex: number;
  rollIndex: number;
  onClose: () => void;
}

export const ScoreCorrectionModal: React.FC<ScoreCorrectionModalProps> = ({
  laneId,
  player,
  frameIndex: initialFrameIndex,
  rollIndex: initialRollIndex,
  onClose,
}) => {
  const { correctScore } = useBowlingStore();
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(initialFrameIndex);
  const [selectedRollIndex, setSelectedRollIndex] = useState(initialRollIndex);

  const currentVal = player.frames[selectedFrameIndex]?.raw_rolls[selectedRollIndex] ?? 0;
  const isCurrentlyFoul = Boolean(player.frames[selectedFrameIndex]?.fouls?.[selectedRollIndex]);

  const [pinsCount, setPinsCount] = useState<number>(currentVal);
  const [isFoul, setIsFoul] = useState<boolean>(isCurrentlyFoul);

  const handleFrameChange = (newFIdx: number) => {
    setSelectedFrameIndex(newFIdx);
    const newRollIdx = 0;
    setSelectedRollIndex(newRollIdx);
    const val = player.frames[newFIdx]?.raw_rolls[newRollIdx] ?? 0;
    setPinsCount(val);
    setIsFoul(Boolean(player.frames[newFIdx]?.fouls?.[newRollIdx]));
  };

  const handleRollChange = (newRIdx: number) => {
    setSelectedRollIndex(newRIdx);
    const val = player.frames[selectedFrameIndex]?.raw_rolls[newRIdx] ?? 0;
    setPinsCount(val);
    setIsFoul(Boolean(player.frames[selectedFrameIndex]?.fouls?.[newRIdx]));
  };

  const handleSave = async () => {
    correctScore(laneId, player.id, selectedFrameIndex, selectedRollIndex, isFoul ? 0 : pinsCount, isFoul);

    try {
      await fetch(`/api/games/${laneId}/frames/${selectedFrameIndex + 1}/balls/${selectedRollIndex + 1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_pins: isFoul ? 0 : pinsCount,
          pins_after: isFoul ? 0 : pinsCount,
          is_foul: isFoul,
          player_id: player.id,
          is_manual: true,
        }),
      });
    } catch {
      // store already updated
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-white mb-1">Ручная коррекция счёта (USBC)</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Игрок: <span className="text-cyan-300 font-semibold">{player.name}</span>
        </p>

        {/* Выбор фрейма и броска */}
        <div className="mb-4 grid grid-cols-2 gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Фрейм (1..10)</label>
            <select
              value={selectedFrameIndex}
              onChange={e => handleFrameChange(parseInt(e.target.value, 10))}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <option key={i} value={i}>
                  Фрейм {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Бросок</label>
            <div className="flex items-center gap-1">
              {[0, 1, ...(selectedFrameIndex === 9 ? [2] : [])].map(rIdx => (
                <button
                  key={rIdx}
                  type="button"
                  onClick={() => handleRollChange(rIdx)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold font-mono transition-colors border ${
                    selectedRollIndex === rIdx
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                      : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {rIdx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Выбор сбитых кеглей */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Фактическое число сбитых кеглей:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => {
                  setPinsCount(cnt);
                  setIsFoul(false);
                }}
                className={`py-2 rounded-lg text-sm font-bold font-mono transition-colors border ${
                  !isFoul && pinsCount === cnt
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {cnt === 10 ? (selectedFrameIndex === 9 || selectedRollIndex === 0 ? 'X (10)' : '10') : cnt}
              </button>
            ))}
          </div>
        </div>

        {/* Чекбокс фола */}
        <div className="mb-6 p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-semibold text-zinc-300">Зафиксировать заступ (Фол)</span>
          </div>
          <input
            type="checkbox"
            checked={isFoul}
            onChange={e => setIsFoul(e.target.checked)}
            className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
          />
        </div>

        {/* Кнопки сохранения */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Применить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
