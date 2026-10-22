import { Frame, Game, Player } from '../../types/vidibi';
import { throwService } from './throwService';
import { hubStore } from '../store';

export class PlayerService {
  public createPlayer(name: string, handicap = 0, color?: string): Player {
    const id = `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const frames: Frame[] = throwService.createEmptyFrames();

    return {
      id,
      name: name.trim() || 'Player',
      status: 'active',
      handicap,
      color: color || '#38bdf8',
      frames,
      total_score: 0,
      current_frame_index: 0,
      current_roll_index: 0,
      strikes_count: 0,
      spares_count: 0,
      max_speed_mps: 0,
      avg_speed_mps: 0,
    };
  }

  public resetPlayerGame(player: Player): Player {
    return {
      ...player,
      frames: throwService.createEmptyFrames(),
      total_score: 0,
      current_frame_index: 0,
      current_roll_index: 0,
      strikes_count: 0,
      spares_count: 0,
    };
  }

  private resolveGame(orderIdOrGame: string | Game): Game | undefined {
    if (typeof orderIdOrGame !== 'string') {
      return orderIdOrGame;
    }
    const num = parseInt(orderIdOrGame, 10);
    for (const lane of hubStore.getAllLanes()) {
      if (lane.current_order?.id === orderIdOrGame && lane.current_game) {
        return lane.current_game;
      }
      if (lane.current_game?.id === orderIdOrGame) {
        return lane.current_game;
      }
      if (!isNaN(num) && lane.id === num && lane.current_game) {
        return lane.current_game;
      }
    }
    return undefined;
  }

  public renamePlayer(orderIdOrGame: string | Game, playerId: string, newName: string): boolean {
    const game = this.resolveGame(orderIdOrGame);
    if (!game) return false;
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    player.name = newName.trim() || player.name;
    return true;
  }

  public removePlayer(orderIdOrGame: string | Game, playerId: string): boolean {
    const game = this.resolveGame(orderIdOrGame);
    if (!game) return false;
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;
    player.status = 'removed';

    // If removed player was active bowler, shift to next active bowler
    const activePlayers = game.players.filter(p => p.status !== 'removed');
    if (activePlayers.length > 0) {
      const currentActive = game.players[game.active_player_index];
      if (!currentActive || currentActive.status === 'removed') {
        const nextIdx = game.players.findIndex(p => p.status !== 'removed');
        game.active_player_index = nextIdx !== -1 ? nextIdx : 0;
      }
    }
    return true;
  }

  public reorderPlayers(orderIdOrGame: string | Game, playerIds: string[]): boolean {
    const game = this.resolveGame(orderIdOrGame);
    if (!game) return false;
    const currentActivePlayer = game.players[game.active_player_index];
    const playerMap = new Map(game.players.map(p => [p.id, p]));
    const reordered: Player[] = [];
    for (const id of playerIds) {
      const p = playerMap.get(id);
      if (p) {
        reordered.push(p);
        playerMap.delete(id);
      }
    }
    for (const p of playerMap.values()) {
      reordered.push(p);
    }
    reordered.forEach((p, idx) => {
      p.order_index = idx;
    });
    game.players = reordered;

    // Preserve active player index pointing to the same bowler if possible
    if (currentActivePlayer) {
      const newActiveIdx = game.players.findIndex(p => p.id === currentActivePlayer.id);
      if (newActiveIdx !== -1) {
        game.active_player_index = newActiveIdx;
      }
    }
    return true;
  }
}

export const playerService = new PlayerService();
