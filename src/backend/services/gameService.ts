import { Frame, Game, LaneState, Player, Throw } from '../../types/vidibi';
import { throwService } from './throwService';
import { wsHub } from '../wsHub';

export class GameService {
  /**
   * Initialize a new game on a lane with given players
   */
  public startNewGame(lane: LaneState, players: Player[]): Game {
    const gameId = `gm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const gameNumber = (lane.history_games.length || 0) + 1;

    const initializedPlayers = players.map(p => ({
      ...p,
      frames: throwService.createEmptyFrames(),
      total_score: 0,
      current_frame_index: 0,
      current_roll_index: 0,
      strikes_count: 0,
      spares_count: 0,
    }));

    const game: Game = {
      id: gameId,
      lane_id: lane.id,
      game_number: gameNumber,
      players: initializedPlayers,
      active_player_index: 0,
      is_completed: false,
      started_at: Date.now(),
    };

    lane.current_game = game;
    lane.current_pin_state = {
      pins: [true, true, true, true, true, true, true, true, true, true],
      is_split: false,
      is_washout: false,
      pins_standing_count: 10,
    };
    lane.phase = 'order_active';

    // Broadcast Flat WS events
    wsHub.broadcast({
      type: 'game_started',
      lane_id: lane.id,
      ts: Date.now(),
      game_id: gameId,
      game_number: gameNumber,
      players_count: initializedPlayers.length,
      players: initializedPlayers,
    });

    wsHub.broadcast({
      type: 'player_switched',
      lane_id: lane.id,
      ts: Date.now(),
      player_id: initializedPlayers[0]?.id,
      player_name: initializedPlayers[0]?.name,
      frame_index: 0,
      roll_index: 0,
    });

    wsHub.broadcastLaneSync(lane);
    return game;
  }

  /**
   * Process a roll thrown by the active player
   */
  public handleThrow(
    lane: LaneState,
    pinsKnocked: number[], // e.g. [1, 2, 3, 5]
    isFoul = false,
    ballSpeedMps = 7.14
  ): { throwRecord: Throw; gameCompleted: boolean } {
    if (!lane.current_game || lane.current_game.is_completed) {
      throw new Error('No active game on this lane');
    }

    const game = lane.current_game;
    let player = game.players[game.active_player_index];
    if (!player) {
      game.active_player_index = 0;
      player = game.players[0];
      if (!player) {
        throw new Error('No active player in game');
      }
    }

    // Ensure player has frames initialized
    if (!player.frames || player.frames.length < 10) {
      player.frames = throwService.createEmptyFrames();
    }

    // If active player is already finished (completed 10th frame), find the next uncompleted player
    if (player.current_frame_index >= 10 || (player.current_frame_index === 9 && player.frames[9]?.is_completed)) {
      const uncompletedIdx = game.players.findIndex(p => !p.frames[9]?.is_completed);
      if (uncompletedIdx !== -1) {
        game.active_player_index = uncompletedIdx;
        player = game.players[uncompletedIdx];
      } else {
        // All players are completed!
        this.finishGame(lane);
        return {
          throwRecord: {
            id: `th-${Date.now()}`,
            player_id: player.id,
            frame_index: 9,
            roll_index: 2,
            pins_fallen: [],
            pins_knocked_this_roll: 0,
            standing_pins_after: lane.current_pin_state.pins,
            is_strike: false,
            is_spare: false,
            is_split: false,
            is_foul: false,
            is_gutter: false,
            timestamp: Date.now(),
          },
          gameCompleted: true,
        };
      }
    }

    const frameIdx = Math.min(Math.max(player.current_frame_index || 0, 0), 9);
    const rollIdx = Math.max(player.current_roll_index || 0, 0);
    const frame = player.frames[frameIdx] || (player.frames[frameIdx] = {
      frame_number: frameIdx + 1,
      rolls: [],
      raw_rolls: [],
      fouls: [],
      score: null,
      is_strike: false,
      is_spare: false,
      is_split: false,
      is_completed: false,
    });

    if (!frame.rolls) frame.rolls = [];
    if (!frame.raw_rolls) frame.raw_rolls = [];
    if (!frame.fouls) frame.fouls = [];

    // Compute pin state transition
    const throwResult = throwService.processThrow(
      lane.current_pin_state,
      pinsKnocked,
      isFoul,
      ballSpeedMps
    );

    // Update standing pins on lane
    lane.current_pin_state = throwResult.newPinState;

    // Track speed stats
    if (ballSpeedMps > player.max_speed_mps) player.max_speed_mps = ballSpeedMps;
    player.avg_speed_mps = player.avg_speed_mps > 0
      ? Number(((player.avg_speed_mps + ballSpeedMps) / 2).toFixed(2))
      : ballSpeedMps;

    // Format roll mark for display
    let rollMark: number | 'X' | '/' | '-' | 'F' = throwResult.pinsKnockedCount;
    if (isFoul) {
      rollMark = 'F';
    } else if (frameIdx < 9) {
      // Frames 1..9
      if (rollIdx === 0 && throwResult.isStrike) {
        rollMark = 'X';
      } else if (rollIdx === 1 && throwResult.isSpare) {
        rollMark = '/';
      } else if (throwResult.pinsKnockedCount === 0) {
        rollMark = '-';
      }
    } else {
      // 10th frame
      if (throwResult.isStrike) {
        rollMark = 'X';
      } else if (rollIdx === 1 && (frame.raw_rolls[0] || 0) < 10 && ((frame.raw_rolls[0] || 0) + throwResult.pinsKnockedCount === 10)) {
        rollMark = '/';
      } else if (rollIdx === 2 && (frame.raw_rolls[1] || 0) < 10 && ((frame.raw_rolls[1] || 0) + throwResult.pinsKnockedCount === 10) && (frame.raw_rolls[0] === 10)) {
        rollMark = '/';
      } else if (throwResult.pinsKnockedCount === 0) {
        rollMark = '-';
      }
    }

    // Append to frame rolls
    frame.rolls.push(rollMark);
    frame.raw_rolls.push(throwResult.pinsKnockedCount);
    if (!frame.fouls) frame.fouls = [];
    frame.fouls.push(isFoul);

    if (throwResult.isSplit) {
      frame.is_split = true;
    }

    // Recalculate game scores using USBC engine
    const scoreResult = throwService.calculateGameScore(player.frames);
    player.frames = scoreResult.frames;
    player.total_score = scoreResult.totalScore;
    player.strikes_count = scoreResult.strikesCount;
    player.spares_count = scoreResult.sparesCount;

    // Create throw log record
    const throwRecord: Throw = {
      id: `th-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      player_id: player.id,
      frame_index: frameIdx,
      roll_index: rollIdx,
      pins_fallen: throwResult.pinsFallen,
      pins_knocked_this_roll: throwResult.pinsKnockedCount,
      standing_pins_after: throwResult.newPinState.pins,
      is_strike: throwResult.isStrike,
      is_spare: throwResult.isSpare,
      is_split: throwResult.isSplit,
      is_foul: isFoul,
      is_gutter: throwResult.pinsKnockedCount === 0 && !isFoul,
      ball_speed_mps: ballSpeedMps,
      ball_speed_kmh: Number((ballSpeedMps * 3.6).toFixed(1)),
      timestamp: Date.now(),
    };

    lane.last_throw = throwRecord;
    lane.ball_speed_mps = ballSpeedMps;

    // Broadcast flat throw_scored event
    wsHub.broadcast({
      type: 'throw_scored',
      lane_id: lane.id,
      ts: Date.now(),
      player_id: player.id,
      player_name: player.name,
      frame_index: frameIdx,
      roll_index: rollIdx,
      pins_hit: throwResult.pinsFallen,
      score: throwResult.pinsKnockedCount,
      roll_mark: rollMark,
      is_strike: throwResult.isStrike,
      is_spare: throwResult.isSpare,
      is_split: throwResult.isSplit,
      is_foul: isFoul,
      ball_speed_mps: ballSpeedMps,
      total_score: player.total_score,
      standing_count: throwResult.newPinState.pins_standing_count,
    });

    // Advance frame / roll or player turn
    const shouldAdvanceTurn = this.determineTurnAdvance(player, frameIdx, rollIdx, throwResult.isStrike, throwResult.isSpare);

    if (shouldAdvanceTurn) {
      // Reset full pin deck for next bowler / next frame
      lane.current_pin_state = {
        pins: [true, true, true, true, true, true, true, true, true, true],
        is_split: false,
        is_washout: false,
        pins_standing_count: 10,
      };

      this.advanceToNextBowlerOrFrame(lane);
    } else {
      // 2nd roll in same frame: pin deck retains remaining standing pins
      player.current_roll_index = rollIdx + 1;
      // In 10th frame, if strike or spare was scored, rack is reset for bonus roll
      if (frameIdx === 9 && (throwResult.isStrike || throwResult.isSpare)) {
        lane.current_pin_state = {
          pins: [true, true, true, true, true, true, true, true, true, true],
          is_split: false,
          is_washout: false,
          pins_standing_count: 10,
        };
      }
    }

    // Check if whole game is finished
    const allPlayersCompleted = game.players.every(p => {
      const lastFrame = p.frames[9];
      return lastFrame && lastFrame.is_completed;
    });

    if (allPlayersCompleted) {
      this.finishGame(lane);
      return { throwRecord, gameCompleted: true };
    }

    wsHub.broadcastLaneSync(lane);
    return { throwRecord, gameCompleted: false };
  }

  private determineTurnAdvance(
    player: Player,
    frameIdx: number,
    rollIdx: number,
    isStrike: boolean,
    isSpare: boolean
  ): boolean {
    if (frameIdx < 9) {
      // Frames 1..9: strike ends turn immediately; roll 2 ends turn
      if (rollIdx === 0 && isStrike) return true;
      if (rollIdx >= 1) return true;
      return false;
    }

    // 10th Frame
    const frame = player.frames[9];
    if (!frame) return true;
    const rolls = frame.raw_rolls || [];
    if (rolls.length <= 1) {
      return false; // Always gets at least 2 rolls in 10th
    }
    if (rolls.length === 2) {
      // If open frame in 10th (no strike and no spare) -> game ends
      if (rolls[0] < 10 && (rolls[0] + rolls[1] < 10)) {
        return true;
      }
      return false; // Strike or spare earned 3rd bonus ball
    }
    if (rolls.length >= 3) {
      return true; // 3 balls completed
    }
    return false;
  }

  private advanceToNextBowlerOrFrame(lane: LaneState): void {
    const game = lane.current_game;
    if (!game) return;

    const currentBowler = game.players[game.active_player_index];
    if (currentBowler) {
      if (currentBowler.current_frame_index < 9) {
        currentBowler.current_frame_index++;
        currentBowler.current_roll_index = 0;
      } else {
        // 10th frame completed, keep index capped at 9
        currentBowler.current_roll_index = 0;
      }
    }

    // Move to next player in rotation that hasn't completed their 10th frame
    let nextPlayerIndex = (game.active_player_index + 1) % game.players.length;
    let attempts = 0;
    while (attempts < game.players.length) {
      const candidate = game.players[nextPlayerIndex];
      if (candidate && (!candidate.frames[9] || !candidate.frames[9].is_completed)) {
        break;
      }
      nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
      attempts++;
    }

    game.active_player_index = nextPlayerIndex;
    const nextBowler = game.players[nextPlayerIndex];

    if (nextBowler) {
      wsHub.broadcast({
        type: 'player_switched',
        lane_id: lane.id,
        ts: Date.now(),
        player_id: nextBowler.id,
        player_name: nextBowler.name,
        frame_index: Math.min(nextBowler.current_frame_index || 0, 9),
        roll_index: nextBowler.current_roll_index || 0,
      });
    }
  }

  public finishGame(lane: LaneState): void {
    if (!lane.current_game) return;

    const game = lane.current_game;
    game.is_completed = true;
    game.completed_at = Date.now();

    // Determine winner
    let maxScore = -1;
    let winnerId = '';
    let winnerName = '';

    game.players.forEach(p => {
      const finalScore = p.total_score + p.handicap;
      if (finalScore > maxScore) {
        maxScore = finalScore;
        winnerId = p.id;
        winnerName = p.name;
      }
    });

    game.winner_id = winnerId;
    game.highest_score = maxScore;

    lane.history_games.push(game);
    lane.phase = 'between_games';

    wsHub.broadcast({
      type: 'game_finished',
      lane_id: lane.id,
      ts: Date.now(),
      game_id: game.id,
      winner_id: winnerId,
      winner_name: winnerName,
      highest_score: maxScore,
      players: game.players,
    });

    wsHub.broadcast({
      type: 'phase_changed',
      lane_id: lane.id,
      ts: Date.now(),
      phase: 'between_games',
      previous_phase: 'order_active',
    });

    wsHub.broadcastLaneSync(lane);
  }

  /**
   * Correct a manual score entered by Operator (USBC score override)
   */
  public correctFrame(
    lane: LaneState,
    playerId: string,
    frameIndex: number,
    rollIndex: number,
    newPinCount: number,
    isFoul = false
  ): void {
    if (!lane.current_game) return;
    const player = lane.current_game.players.find(p => p.id === playerId);
    if (!player) return;

    throwService.manualCorrection(player, frameIndex, rollIndex, newPinCount, isFoul);

    wsHub.broadcast({
      type: 'total_score_updated',
      lane_id: lane.id,
      ts: Date.now(),
      game_id: lane.current_game.id,
      player_id: player.id,
      total_score: player.total_score,
    });

    wsHub.broadcast({
      type: 'throw_registered',
      lane_id: lane.id,
      ts: Date.now(),
      game_id: lane.current_game.id,
      player_id: player.id,
      frame_index: frameIndex,
      roll_index: rollIndex,
      pins_knocked: newPinCount,
      is_foul: isFoul,
      is_manual: true,
    });

    wsHub.broadcastLaneSync(lane);
  }
}

export const gameService = new GameService();
