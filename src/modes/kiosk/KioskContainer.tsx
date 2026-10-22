import React, { useEffect } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { VIDIBI_THEMES } from '../../shared/themes/vidibiThemes';
import { IdleScreen } from './IdleScreen';
import { GameScreen } from './GameScreen';
import { BetweenGamesScreen } from './BetweenGamesScreen';
import { OrderFinishedScreen } from './OrderFinishedScreen';
import { CelebrationOverlay } from '../../shared/components/CelebrationOverlay';
import { ThemeSelector } from '../../shared/components/ThemeSelector';
import { gameService } from '../../backend/services/gameService';
import { playerService } from '../../backend/services/playerService';
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react';

interface KioskContainerProps {
  laneId: number;
}

export const KioskContainer: React.FC<KioskContainerProps> = ({ laneId }) => {
  const {
    lanes,
    setKioskLaneId,
    celebration,
    dismissCelebration,
    closeToIdle,
  } = useBowlingStore();

  useEffect(() => {
    setKioskLaneId(laneId);
  }, [laneId, setKioskLaneId]);

  const lane = lanes.find(l => l.id === laneId) || lanes[0];
  const theme = VIDIBI_THEMES[lane?.active_theme] || VIDIBI_THEMES.midnight_oled;

  if (!lane) {
    return (
      <div className="w-full h-screen bg-black text-white flex items-center justify-center font-mono">
        Дорожка {laneId} не найдена в системе.
      </div>
    );
  }

  const handleStartNextGame = () => {
    if (lane.current_game) {
      const players = lane.current_game.players.map(p => playerService.resetPlayerGame(p));
      gameService.startNewGame(lane, players);
    }
  };

  return (
    <div className={`relative w-full min-h-screen ${theme.fontFamilyClass}`}>
      {/* Отображение экрана в зависимости от фазы дорожки (Read-Only TV Display R6) */}
      {(() => {
        switch (lane.phase) {
          case 'idle':
          case 'closed':
            return (
              <IdleScreen
                lane={lane}
                theme={theme}
              />
            );

          case 'order_active':
          case 'paused':
            return lane.current_game ? (
              <GameScreen
                lane={lane}
                game={lane.current_game}
                theme={theme}
              />
            ) : (
              <IdleScreen
                lane={lane}
                theme={theme}
              />
            );

          case 'between_games':
            return (
              <BetweenGamesScreen
                lane={lane}
                theme={theme}
                onStartNextGame={handleStartNextGame}
              />
            );

          case 'order_finished':
            return (
              <OrderFinishedScreen
                lane={lane}
                theme={theme}
                onCloseToIdle={() => closeToIdle(lane.id)}
              />
            );

          default:
            return (
              <IdleScreen
                lane={lane}
                theme={theme}
              />
            );
        }
      })()}

      {/* Оверлей анимации страйка / спэра */}
      <CelebrationOverlay
        celebration={celebration}
        onDismiss={dismissCelebration}
      />
      
      {/* FBox Status Indicator */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 text-[10px] font-mono">
        {(() => {
          const fbox = useBowlingStore.getState().devices.find(d => d.lane_id === lane.id && d.role === 'pinspotter_ctl');
          return fbox?.status === 'online' ? (
            <span className="text-emerald-400">● FBox ✓ Lane {lane.id} · RSSI {fbox.rssi} · {fbox.firmware_version}</span>
          ) : (
            <span className="text-rose-400">● FBox ✗ offline</span>
          );
        })()}
      </div>
    </div>
  );
};
