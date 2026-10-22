import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { X, Play, Clock, Trophy, Plus, Trash2 } from 'lucide-react';

interface StartOrderModalProps {
  laneId: number;
  onClose: () => void;
}

export const StartOrderModal: React.FC<StartOrderModalProps> = ({ laneId, onClose }) => {
  const { settings, startOrder } = useBowlingStore();
  const [guestName, setGuestName] = useState('');
  const [selectedTariffId, setSelectedTariffId] = useState(settings.tariffs[0]?.id || '');
  const [pricingType, setPricingType] = useState<'time' | 'games'>('time');
  const [durationMin, setDurationMin] = useState(60);
  const [targetGames, setTargetGames] = useState(2);
  const [players, setPlayers] = useState<string[]>(['Игрок 1', 'Игрок 2']);

  const selectedTariff = settings.tariffs.find(t => t.id === selectedTariffId) || settings.tariffs[0];

  const handleAddPlayer = () => {
    if (players.length < 8) {
      setPlayers([...players, `Игрок ${players.length + 1}`]);
    }
  };

  const handleRemovePlayer = (idx: number) => {
    if (players.length > 1) {
      setPlayers(players.filter((_, i) => i !== idx));
    }
  };

  const handleUpdatePlayerName = (idx: number, name: string) => {
    const updated = [...players];
    updated[idx] = name;
    setPlayers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startOrder(
      laneId,
      selectedTariffId,
      guestName.trim() || players[0] || 'Гость',
      durationMin,
      targetGames,
      pricingType,
      players
    );
    onClose();
  };

  const calculatedCost = pricingType === 'time'
    ? (selectedTariff.price * (durationMin / 60)).toFixed(0)
    : (selectedTariff.price * targetGames * players.length).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
            {laneId}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Открыть сессию (Дорожка {laneId})</h2>
            <p className="text-xs text-zinc-400">Настройка гостей, тарифа и длительности игры</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Имя гостя */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Имя гостя / Название компании
            </label>
            <input
              type="text"
              placeholder="например, Семья Ивановых"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Тип расчёта */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Формат оплаты</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPricingType('time')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  pricingType === 'time'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>По времени (таймбанк)</span>
              </button>
              <button
                type="button"
                onClick={() => setPricingType('games')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  pricingType === 'games'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>По партиям (за игры)</span>
              </button>
            </div>
          </div>

          {/* Выбор тарифа */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Тарифный план</label>
            <select
              value={selectedTariffId}
              onChange={e => setSelectedTariffId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
            >
              {settings.tariffs.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.price.toLocaleString('ru-RU')} ₽ ({t.type === 'hourly' ? 'в час' : 'за партию'})
                </option>
              ))}
            </select>
          </div>

          {/* Длительность или игры */}
          {pricingType === 'time' ? (
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-1">
                <span>Длительность</span>
                <span className="text-cyan-400 font-mono">{durationMin} минут ({(durationMin / 60).toFixed(1)} ч.)</span>
              </div>
              <div className="flex gap-2">
                {[30, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMin(mins)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium border ${
                      durationMin === mins
                        ? 'bg-cyan-500 text-black font-bold border-cyan-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {mins} мин
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-xs font-semibold text-zinc-300 mb-1">
                <span>Количество игр</span>
                <span className="text-cyan-400 font-mono">{targetGames} партий на каждого игрока</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTargetGames(g)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium border ${
                      targetGames === g
                        ? 'bg-cyan-500 text-black font-bold border-cyan-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {g} {g === 1 ? 'игра' : g < 5 ? 'игры' : 'игр'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Список игроков */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Игроки ({players.length})
              </label>
              <button
                type="button"
                onClick={handleAddPlayer}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить игрока</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {players.map((playerName, pIdx) => (
                <div key={pIdx} className="flex items-center gap-2">
                  <span className="w-5 text-xs text-zinc-500 font-mono">{pIdx + 1}.</span>
                  <input
                    type="text"
                    value={playerName}
                    onChange={e => handleUpdatePlayerName(pIdx, e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  {players.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(pIdx)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Итоговая сумма */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400">Стоимость сессии</div>
              <div className="text-xs text-zinc-500 font-mono">
                {players.length} игрок(ов) · {pricingType === 'time' ? `${durationMin} мин` : `${targetGames} игр`}
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400">
              {Number(calculatedCost).toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {/* Кнопки модалки */}
          <div className="flex items-center justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Запустить и открыть дорожку</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
