import React, { useState } from 'react';
import { Player } from '../../types/vidibi';
import { useBowlingStore } from '../store/bowlingStore';
import { Edit2, Trash2, Check, X, ChevronUp, ChevronDown, UserPlus } from 'lucide-react';

interface PlayerListProps {
  laneId: number;
  players: Player[];
  activePlayerIndex?: number;
  onAddPlayer?: (name: string, handicap: number) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  laneId,
  players,
  activePlayerIndex = 0,
  onAddPlayer,
}) => {
  const { renamePlayer, removePlayer, reorderPlayers } = useBowlingStore();
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHandicap, setNewHandicap] = useState(0);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activePlayers = players.filter(p => p.status !== 'removed');

  const handleStartRename = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditPlayerName(p.name);
    setConfirmDeleteId(null);
  };

  const handleSaveRename = (playerId: string) => {
    if (editPlayerName.trim()) {
      renamePlayer(laneId, playerId, editPlayerName.trim());
    }
    setEditingPlayerId(null);
  };

  const handleKeyDownRename = (e: React.KeyboardEvent, playerId: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(playerId);
    } else if (e.key === 'Escape') {
      setEditingPlayerId(null);
    }
  };

  const handleRemove = (p: Player) => {
    removePlayer(laneId, p.id);
    setConfirmDeleteId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...activePlayers];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;
    reorderPlayers(laneId, newOrder.map(p => p.id));
  };

  const handleMoveDown = (index: number) => {
    if (index >= activePlayers.length - 1) return;
    const newOrder = [...activePlayers];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;
    reorderPlayers(laneId, newOrder.map(p => p.id));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    if (onAddPlayer) {
      onAddPlayer(newName.trim(), newHandicap);
    }
    setNewName('');
    setNewHandicap(0);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Шапка списка игроков */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Игроки ({activePlayers.length})
          </span>
          <span className="text-[11px] text-zinc-400">
            (Двойной клик по имени — переименовать)
          </span>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Добавить игрока</span>
        </button>
      </div>

      {/* Форма добавления нового игрока */}
      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 animate-in fade-in duration-150"
        >
          <input
            type="text"
            placeholder="Имя нового игрока"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
            autoFocus
          />
          <input
            type="number"
            placeholder="ГДКП"
            value={newHandicap || ''}
            onChange={e => setNewHandicap(parseInt(e.target.value, 10) || 0)}
            className="w-20 px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors"
          >
            Добавить
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Список игроков */}
      <div className="flex flex-wrap items-center gap-2">
        {activePlayers.map((player, idx) => {
          const isActive = idx === activePlayerIndex;

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                isActive
                  ? 'bg-zinc-900/90 border-cyan-500/50 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Цветовой маркер */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: player.color || '#38bdf8' }}
              />

              {/* Стрелки порядка вверх/вниз */}
              <div className="flex items-center gap-0.5 text-zinc-400">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveUp(idx)}
                  className="p-0.5 hover:text-cyan-400 disabled:opacity-20 disabled:hover:text-zinc-400"
                  title="Поднять выше в очереди"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === activePlayers.length - 1}
                  onClick={() => handleMoveDown(idx)}
                  className="p-0.5 hover:text-cyan-400 disabled:opacity-20 disabled:hover:text-zinc-400"
                  title="Опустить ниже в очереди"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Имя игрока или инпут редактирования */}
              {editingPlayerId === player.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editPlayerName}
                    onChange={e => setEditPlayerName(e.target.value)}
                    onKeyDown={e => handleKeyDownRename(e, player.id)}
                    onBlur={() => handleSaveRename(player.id)}
                    className="px-2 py-0.5 bg-zinc-950 border border-cyan-400 rounded text-xs text-white w-28 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(player.id)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                    title="Сохранить"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlayerId(null)}
                    className="p-1 text-zinc-400 hover:text-white"
                    title="Отмена"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    onDoubleClick={() => handleStartRename(player)}
                    className="font-semibold text-xs text-white cursor-pointer hover:text-cyan-300 select-none"
                    title="Двойной клик для редактирования"
                  >
                    {player.name}
                  </span>

                  {player.handicap > 0 && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      +{player.handicap}
                    </span>
                  )}

                  {isActive && (
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Ход
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStartRename(player)}
                    className="p-0.5 text-zinc-400 hover:text-cyan-400 transition-colors"
                    title="Изменить имя"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {confirmDeleteId === player.id ? (
                    <div className="flex items-center gap-1 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/50 text-[11px]">
                      <span className="text-rose-200">Удалить?</span>
                      <button
                        type="button"
                        onClick={() => handleRemove(player)}
                        className="px-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                      >
                        Да
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1 text-zinc-400 hover:text-white text-[10px]"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(player.id)}
                      className="p-0.5 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Удалить игрока"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
