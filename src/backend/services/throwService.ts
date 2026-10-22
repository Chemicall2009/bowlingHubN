/**
 * USBC Official 10-Frame Bowling Scoring Engine & Throw Service
 * 
 * Rules:
 * - 10 frames per game.
 * - Frames 1-9: 2 rolls max. A strike on roll 1 ends frame (pins=10, score adds next 2 rolls).
 *               A spare on roll 2 ends frame (pins=10, score adds next 1 roll).
 * - Frame 10: up to 3 rolls.
 *             Roll 1 strike -> 2 bonus rolls.
 *             Roll 1+2 spare -> 1 bonus roll.
 *             Roll 1+2 open (<10 pins) -> frame ends after roll 2.
 * - Perfect score = 300 (12 consecutive strikes: 10 frames + 2 bonus in 10th).
 * - Clean game = mark in every frame (all strikes or spares).
 * - Splits & Washouts calculated accurately.
 * - Sensor distance: standard bowling foul-to-pins photo-eye distance = 16.5 meters or sensor A-B interval = 1.5 meters.
 */

import { Frame, PinState, Throw, Player } from '../../types/vidibi';

export interface ScoredGameResult {
  frames: Frame[];
  totalScore: number;
  isComplete: boolean;
  maxPossibleScore: number;
  strikesCount: number;
  sparesCount: number;
  splitsCount: number;
  cleanGame: boolean;
}

export class ThrowService {
  /**
   * Distance between Sensor A and Sensor B in meters (default 1.5m standard timing trap)
   */
  private sensorTrapDistanceMeters = 1.5;

  /**
   * Calculate ball speed in m/s and km/h from sensor A & B timestamp delta
   */
  public calculateBallSpeed(dtMs: number): { speedMps: number; speedKmh: number } {
    if (dtMs <= 0 || dtMs > 10000) {
      return { speedMps: 0, speedKmh: 0 };
    }
    const dtSeconds = dtMs / 1000;
    const speedMps = Number((this.sensorTrapDistanceMeters / dtSeconds).toFixed(2));
    const speedKmh = Number((speedMps * 3.6).toFixed(1));
    return { speedMps, speedKmh };
  }

  /**
   * Determine if remaining standing pins constitute an official split
   * 
   * Official USBC Split Definition:
   * 1. Headpin (#1) MUST be knocked down.
   * 2. At least two pins must be standing.
   * 3. Either:
   *    - At least one pin is missing between two standing pins (e.g. 7-10, 4-6, 5-7, 5-10, 2-7, 3-10, 4-7-10)
   *    - Or at least one pin is missing immediately ahead of a standing pin (e.g. 5-7-10)
   */
  public checkSplit(standingPins: boolean[]): boolean {
    // Pin indexing: 1-indexed (standingPins[0] = Pin 1, standingPins[9] = Pin 10)
    // If pin 1 is standing -> NOT a split (could be washout)
    if (standingPins[0] === true) {
      return false;
    }

    const standingIndices: number[] = [];
    for (let i = 0; i < 10; i++) {
      if (standingPins[i] === true) {
        standingIndices.push(i + 1); // 1..10
      }
    }

    // Need at least 2 pins standing
    if (standingIndices.length < 2) {
      return false;
    }

    // Famous recognized split pin combinations:
    // 7-10, 4-6, 5-7, 5-10, 2-7, 3-10, 4-7-10, 3-6-7-10, 4-6-7-10, 2-4-7-10, 3-5-6-7-10, 2-8-10, 3-7-9, 4-9, 6-8, 5-7-10 (Sour Apple)
    const pinsSet = new Set(standingIndices);

    // Any combo spanning left and right sides without center pins:
    const leftSide = standingIndices.some(p => [2, 4, 7].includes(p));
    const rightSide = standingIndices.some(p => [3, 6, 10].includes(p));
    const centerPins = standingIndices.some(p => [5, 8, 9].includes(p));

    // Classical direct pairs
    if (pinsSet.has(7) && pinsSet.has(10)) return true;
    if (pinsSet.has(4) && pinsSet.has(6)) return true;
    if (pinsSet.has(5) && pinsSet.has(7)) return true;
    if (pinsSet.has(5) && pinsSet.has(10)) return true;
    if (pinsSet.has(2) && pinsSet.has(7) && !pinsSet.has(4)) return true;
    if (pinsSet.has(3) && pinsSet.has(10) && !pinsSet.has(6)) return true;
    if (pinsSet.has(4) && pinsSet.has(9)) return true;
    if (pinsSet.has(6) && pinsSet.has(8)) return true;
    if (pinsSet.has(2) && pinsSet.has(10)) return true;
    if (pinsSet.has(3) && pinsSet.has(7)) return true;

    // Both sides standing without center connection
    if (leftSide && rightSide && !centerPins) {
      return true;
    }

    // Sleeper splits (e.g. 2-8 or 3-9 are NOT splits, but 2-10 is a split)
    return false;
  }

  /**
   * Determine if remaining standing pins constitute a Washout
   * (Pin 1 standing + corner pin standing with missing intermediate pins)
   */
  public checkWashout(standingPins: boolean[]): boolean {
    if (standingPins[0] !== true) return false; // Headpin MUST be standing
    const standing = new Set(standingPins.map((s, idx) => (s ? idx + 1 : 0)).filter(p => p > 0));
    if (standing.size < 2) return false;

    // Washout examples: 1-2-10, 1-2-4-10, 1-3-7, 1-3-6-7
    if (standing.has(1) && standing.has(10) && (standing.has(2) || standing.has(4)) && !standing.has(3) && !standing.has(6)) {
      return true;
    }
    if (standing.has(1) && standing.has(7) && (standing.has(3) || standing.has(6)) && !standing.has(2) && !standing.has(4)) {
      return true;
    }
    return false;
  }

  /**
   * Compute standard USBC Score for all frames in a game
   * Accurately calculates cumulative scores, deferred bonuses for strikes and spares, and 10th frame bonuses.
   */
  public calculateGameScore(frames: Frame[]): ScoredGameResult {
    // Clone frames to avoid mutating input directly
    const scoredFrames: Frame[] = frames.map(f => ({
      frame_number: f.frame_number,
      rolls: [...f.rolls],
      raw_rolls: [...f.raw_rolls],
      fouls: f.fouls ? [...f.fouls] : [],
      score: null,
      is_strike: f.is_strike,
      is_spare: f.is_spare,
      is_split: f.is_split,
      is_completed: f.is_completed,
    }));

    // Flatten all raw rolls with frame markers for clean USBC lookahead
    interface FlatRoll {
      frameIdx: number;
      rollInFrame: number;
      pins: number;
      isFoul: boolean;
      isStrike: boolean;
      isSpare: boolean;
    }

    const flatRolls: FlatRoll[] = [];
    for (let fIdx = 0; fIdx < scoredFrames.length; fIdx++) {
      const f = scoredFrames[fIdx];
      for (let rIdx = 0; rIdx < f.raw_rolls.length; rIdx++) {
        flatRolls.push({
          frameIdx: fIdx,
          rollInFrame: rIdx,
          pins: f.raw_rolls[rIdx] || 0,
          isFoul: Boolean(f.fouls && f.fouls[rIdx]),
          isStrike: fIdx < 9 ? rIdx === 0 && f.raw_rolls[rIdx] === 10 : f.raw_rolls[rIdx] === 10,
          isSpare: fIdx < 9 ? rIdx === 1 && (f.raw_rolls[0] + f.raw_rolls[1] === 10) : rIdx === 1 && f.raw_rolls[0] < 10 && (f.raw_rolls[0] + f.raw_rolls[1] === 10),
        });
      }
    }

    let runningTotal = 0;
    let strikesCount = 0;
    let sparesCount = 0;
    let splitsCount = 0;

    // Calculate score frame by frame
    for (let fIdx = 0; fIdx < 10; fIdx++) {
      const frame = scoredFrames[fIdx];
      if (!frame || frame.raw_rolls.length === 0) {
        continue;
      }

      if (frame.is_split) splitsCount++;

      if (fIdx < 9) {
        // Frames 1 through 9
        if (frame.raw_rolls[0] === 10) {
          // STRIKE
          frame.is_strike = true;
          frame.is_spare = false;
          strikesCount++;

          // Find the flat roll index for this strike
          const rollIndex = flatRolls.findIndex(r => r.frameIdx === fIdx && r.rollInFrame === 0);
          if (rollIndex !== -1 && flatRolls.length >= rollIndex + 3) {
            // We have the next 2 rolls!
            const bonus1 = flatRolls[rollIndex + 1].pins;
            const bonus2 = flatRolls[rollIndex + 2].pins;
            runningTotal += 10 + bonus1 + bonus2;
            frame.score = runningTotal;
            frame.is_completed = true;
          } else {
            // Bonus rolls not completed yet
            frame.is_completed = false;
            frame.score = null;
          }
        } else if (frame.raw_rolls.length >= 2 && (frame.raw_rolls[0] + frame.raw_rolls[1] === 10)) {
          // SPARE
          frame.is_strike = false;
          frame.is_spare = true;
          sparesCount++;

          const rollIndex = flatRolls.findIndex(r => r.frameIdx === fIdx && r.rollInFrame === 1);
          if (rollIndex !== -1 && flatRolls.length >= rollIndex + 2) {
            // We have the next 1 roll!
            const bonus1 = flatRolls[rollIndex + 1].pins;
            runningTotal += 10 + bonus1;
            frame.score = runningTotal;
            frame.is_completed = true;
          } else {
            frame.is_completed = false;
            frame.score = null;
          }
        } else if (frame.raw_rolls.length >= 2) {
          // OPEN FRAME
          frame.is_strike = false;
          frame.is_spare = false;
          runningTotal += frame.raw_rolls[0] + frame.raw_rolls[1];
          frame.score = runningTotal;
          frame.is_completed = true;
        } else {
          // Only 1 ball thrown so far in open frame
          frame.is_completed = false;
          frame.score = null;
        }
      } else {
        // 10TH FRAME (Special 3-ball rules)
        const rolls = frame.raw_rolls;
        const rollCount = rolls.length;

        if (rollCount >= 1 && rolls[0] === 10) {
          frame.is_strike = true;
          strikesCount++;
        }
        if (rollCount >= 2 && rolls[0] < 10 && (rolls[0] + rolls[1] === 10)) {
          frame.is_spare = true;
          sparesCount++;
        }

        if (rolls[0] === 10) {
          // Strike on 1st ball in 10th frame: requires 3 balls total
          if (rollCount >= 3) {
            if (rolls[1] === 10) strikesCount++;
            if (rolls[2] === 10) strikesCount++;
            const sum = rolls[0] + rolls[1] + rolls[2];
            runningTotal += sum;
            frame.score = runningTotal;
            frame.is_completed = true;
          } else {
            frame.is_completed = false;
            frame.score = null;
          }
        } else if (rollCount >= 2 && (rolls[0] + rolls[1] === 10)) {
          // Spare on 2nd ball in 10th frame: requires 3 balls total
          if (rollCount >= 3) {
            if (rolls[2] === 10) strikesCount++;
            const sum = rolls[0] + rolls[1] + rolls[2];
            runningTotal += sum;
            frame.score = runningTotal;
            frame.is_completed = true;
          } else {
            frame.is_completed = false;
            frame.score = null;
          }
        } else if (rollCount >= 2 && (rolls[0] + rolls[1] < 10)) {
          // Open frame in 10th: ended after 2 balls
          runningTotal += rolls[0] + rolls[1];
          frame.score = runningTotal;
          frame.is_completed = true;
        } else {
          frame.is_completed = false;
          frame.score = null;
        }
      }
    }

    // Check if entire 10 frames are complete
    const isComplete = scoredFrames.length === 10 && scoredFrames.every(f => f.is_completed && f.score !== null);
    
    // Check clean game (all 10 frames have strike or spare)
    const cleanGame = scoredFrames.length === 10 && scoredFrames.every(f => f.is_strike || f.is_spare);

    // Calculate maximum possible score remaining
    let maxPossibleScore = runningTotal;
    // If not complete, compute theoretical maximum if all remaining balls are strikes
    // Perfect 300 cap
    if (!isComplete) {
      maxPossibleScore = this.calculateMaxPossibleScore(scoredFrames, flatRolls);
    }

    return {
      frames: scoredFrames,
      totalScore: runningTotal,
      isComplete,
      maxPossibleScore,
      strikesCount,
      sparesCount,
      splitsCount,
      cleanGame
    };
  }

  private calculateMaxPossibleScore(frames: Frame[], currentRolls: { frameIdx: number; pins: number }[]): number {
    // Generate an optimistic game where all unthrown balls from current state are strikes
    const simFrames: Frame[] = [];
    for (let f = 0; f < 10; f++) {
      const existing = frames[f];
      if (existing && existing.raw_rolls.length > 0) {
        if (f < 9) {
          if (existing.raw_rolls[0] === 10) {
            simFrames.push({ ...existing, raw_rolls: [10], rolls: ['X'] });
          } else if (existing.raw_rolls.length === 1) {
            // 2nd ball can be spare (10 - roll1)
            simFrames.push({ ...existing, raw_rolls: [existing.raw_rolls[0], 10 - existing.raw_rolls[0]], rolls: [existing.raw_rolls[0], '/'] });
          } else {
            simFrames.push({ ...existing });
          }
        } else {
          // 10th frame
          if (existing.raw_rolls.length === 1) {
            if (existing.raw_rolls[0] === 10) {
              simFrames.push({ ...existing, raw_rolls: [10, 10, 10], rolls: ['X', 'X', 'X'] });
            } else {
              simFrames.push({ ...existing, raw_rolls: [existing.raw_rolls[0], 10 - existing.raw_rolls[0], 10], rolls: [existing.raw_rolls[0], '/', 'X'] });
            }
          } else if (existing.raw_rolls.length === 2) {
            if (existing.raw_rolls[0] === 10 || existing.raw_rolls[0] + existing.raw_rolls[1] === 10) {
              simFrames.push({ ...existing, raw_rolls: [existing.raw_rolls[0], existing.raw_rolls[1], 10] });
            } else {
              simFrames.push({ ...existing });
            }
          } else {
            simFrames.push({ ...existing });
          }
        }
      } else {
        // Unplayed frame: simulate strike
        if (f < 9) {
          simFrames.push({
            frame_number: f + 1,
            rolls: ['X'],
            raw_rolls: [10],
            score: null,
            is_strike: true,
            is_spare: false,
            is_split: false,
            is_completed: true,
          });
        } else {
          simFrames.push({
            frame_number: 10,
            rolls: ['X', 'X', 'X'],
            raw_rolls: [10, 10, 10],
            score: null,
            is_strike: true,
            is_spare: false,
            is_split: false,
            is_completed: true,
          });
        }
      }
    }

    const simResult = this.calculateGameScore(simFrames);
    return Math.min(300, simResult.totalScore);
  }

  /**
   * Process a single physical or virtual ball throw on a lane
   */
  public processThrow(
    currentPinState: PinState,
    pinsKnocked: number[], // Array of 1-indexed pin numbers, e.g. [1, 2, 3, 5]
    isFoul: boolean,
    ballSpeedMps?: number
  ): {
    pinsFallen: number[];
    pinsKnockedCount: number;
    newPinState: PinState;
    isStrike: boolean;
    isSpare: boolean;
    isSplit: boolean;
    isWashout: boolean;
  } {
    const pinsFallen = isFoul ? [] : [...pinsKnocked];
    const newPinsArray = [...currentPinState.pins]; // 10 booleans

    if (!isFoul) {
      for (const pinNumber of pinsKnocked) {
        if (pinNumber >= 1 && pinNumber <= 10) {
          newPinsArray[pinNumber - 1] = false; // fallen
        }
      }
    }

    const standingCount = newPinsArray.filter(p => p === true).length;
    const isSplit = this.checkSplit(newPinsArray);
    const isWashout = this.checkWashout(newPinsArray);
    const isStrike = standingCount === 0 && currentPinState.pins_standing_count === 10;
    const isSpare = standingCount === 0 && currentPinState.pins_standing_count < 10;

    const newPinState: PinState = {
      pins: newPinsArray,
      is_split: isSplit,
      is_washout: isWashout,
      pins_standing_count: standingCount,
    };

    return {
      pinsFallen,
      pinsKnockedCount: pinsFallen.length,
      newPinState,
      isStrike,
      isSpare,
      isSplit,
      isWashout,
    };
  }

  /**
   * Manual score correction (USBC)
   * Cascade recalculates all frames, bonus rolls, and cumulative scores.
   */
  public manualCorrection(
    player: Player,
    frameIndex: number,
    rollIndex: number,
    newPinCount: number,
    isFoul = false
  ): void {
    if (!player.frames || player.frames.length < 10) {
      player.frames = this.createEmptyFrames();
    }
    const frame = player.frames[frameIndex];
    if (!frame) return;

    if (!frame.raw_rolls) frame.raw_rolls = [];
    if (!frame.rolls) frame.rolls = [];
    if (!frame.fouls) frame.fouls = [];

    while (frame.raw_rolls.length <= rollIndex) {
      frame.raw_rolls.push(0);
    }
    while (frame.rolls.length <= rollIndex) {
      frame.rolls.push(0);
    }
    while (frame.fouls.length <= rollIndex) {
      frame.fouls.push(false);
    }

    const actualPins = isFoul ? 0 : Math.min(Math.max(newPinCount, 0), 10);
    frame.raw_rolls[rollIndex] = actualPins;
    frame.fouls[rollIndex] = isFoul;

    // Recalculate display marks for all rolls in this frame
    if (frameIndex < 9) {
      if (rollIndex === 0 && actualPins === 10 && !isFoul) {
        frame.raw_rolls = [10];
        frame.rolls = ['X'];
        frame.fouls = [false];
        frame.is_strike = true;
        frame.is_spare = false;
        frame.is_completed = true;
      } else {
        frame.rolls[0] = frame.fouls[0] ? 'F' : frame.raw_rolls[0] === 10 ? 'X' : frame.raw_rolls[0];
        if (frame.raw_rolls.length > 1) {
          frame.rolls[1] = frame.fouls[1] ? 'F' : (frame.raw_rolls[0] + frame.raw_rolls[1] === 10) ? '/' : frame.raw_rolls[1];
        }
      }
    } else {
      frame.rolls[0] = frame.fouls[0] ? 'F' : frame.raw_rolls[0] === 10 ? 'X' : frame.raw_rolls[0];
      if (frame.raw_rolls.length > 1) {
        frame.rolls[1] = frame.fouls[1] ? 'F' : frame.raw_rolls[1] === 10 ? 'X' : (frame.raw_rolls[0] < 10 && frame.raw_rolls[0] + frame.raw_rolls[1] === 10) ? '/' : frame.raw_rolls[1];
      }
      if (frame.raw_rolls.length > 2) {
        frame.rolls[2] = frame.fouls[2] ? 'F' : frame.raw_rolls[2] === 10 ? 'X' : (frame.raw_rolls[1] < 10 && frame.raw_rolls[1] + frame.raw_rolls[2] === 10) ? '/' : frame.raw_rolls[2];
      }
    }

    // Cascade recalculation of all 10 frames
    const scored = this.calculateGameScore(player.frames);
    player.frames = scored.frames;
    player.total_score = scored.totalScore;
    player.strikes_count = scored.strikesCount;
    player.spares_count = scored.sparesCount;
  }

  public correctThrow(
    player: Player,
    frameIndex: number,
    rollIndex: number,
    newPinCount: number,
    isFoul = false
  ): void {
    this.manualCorrection(player, frameIndex, rollIndex, newPinCount, isFoul);
  }

  /**
   * Create an empty fresh 10-frame game for a player
   */
  public createEmptyFrames(): Frame[] {
    const frames: Frame[] = [];
    for (let i = 1; i <= 10; i++) {
      frames.push({
        frame_number: i,
        rolls: [],
        raw_rolls: [],
        fouls: [],
        score: null,
        is_strike: false,
        is_spare: false,
        is_split: false,
        is_completed: false,
      });
    }
    return frames;
  }
}

export const throwService = new ThrowService();
