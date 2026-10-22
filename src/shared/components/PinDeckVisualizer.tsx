import React from 'react';
import { PinState } from '../../types/vidibi';
import { VidibiTheme } from '../themes/vidibiThemes';
import { useBowlingStore } from '../store/bowlingStore';

interface PinDeckVisualizerProps {
  pinState: PinState;
  theme: VidibiTheme;
  interactive?: boolean;
  onTogglePin?: (pinNumber: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  context?: 'kiosk' | 'operator';
}

export const PinDeckVisualizer: React.FC<PinDeckVisualizerProps> = ({
  pinState,
  theme,
  interactive = false,
  onTogglePin,
  size = 'md',
  context = 'operator',
}) => {
  const storeSettings = useBowlingStore(s => s.settings);
  const displaySettings = storeSettings?.display || {
    pin_labels_visible: true,
    pin_labels_style: 'number',
    pin_labels_size: 'md',
    pin_labels_color: '#ffffff',
    pin_labels_on_kiosk: false,
    pin_labels_on_operator: true,
  };

  const showLabels = context === 'kiosk'
    ? (displaySettings.pin_labels_visible && displaySettings.pin_labels_on_kiosk)
    : (displaySettings.pin_labels_visible && displaySettings.pin_labels_on_operator);

  const labelStyle = displaySettings.pin_labels_style || 'number';

  const pinPositions: Record<number, string> = {
    1: '1',
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
  };

  const pinPositionNames: Record<number, string> = {
    1: 'Head',
    2: 'L2',
    3: 'R3',
    4: 'L4',
    5: 'Mid',
    6: 'R6',
    7: 'Corner',
    8: 'L8',
    9: 'R9',
    10: 'Corner',
  };

  const getPinLabelText = (pinNum: number) => {
    if (!showLabels || labelStyle === 'none') return '';
    if (labelStyle === 'position') return pinPositionNames[pinNum] || `${pinNum}`;
    if (labelStyle === 'both') return `${pinNum} (${pinPositionNames[pinNum] || ''})`;
    return `${pinNum}`;
  };

  // Матрица расположения 10 кеглей: [ряд 4, ряд 3, ряд 2, ряд 1]
  const pinRows = [
    [7, 8, 9, 10],
    [4, 5, 6],
    [2, 3],
    [1],
  ];

  const pinSizes = {
    xs: { pin: 'w-5 h-5 text-[9px]', rowGap: 'gap-1', pinGap: 'gap-1', deck: 'p-1.5 max-w-[150px]' },
    sm: { pin: 'w-6 h-6 text-[10px]', rowGap: 'gap-1.5', pinGap: 'gap-1.5', deck: 'p-2.5 max-w-[190px]' },
    md: { pin: 'w-8 h-8 text-xs font-bold', rowGap: 'gap-2', pinGap: 'gap-2', deck: 'p-3 max-w-[260px]' },
    lg: { pin: 'w-11 h-11 text-sm font-black', rowGap: 'gap-2.5', pinGap: 'gap-2.5', deck: 'p-4 max-w-[340px]' },
  }[size];

  return (
    <div className={`w-full flex flex-col items-center justify-center rounded-2xl ${theme.pinDeckBg} ${pinSizes.deck} shadow-2xl relative overflow-hidden backdrop-blur-md`}>
      {/* Направляющие текстуры дорожки */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Верхний статус пиндека */}
      <div className="w-full flex items-center justify-between mb-3 text-xs z-10 px-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wider uppercase text-zinc-400">Пиндек</span>
          {pinState.is_split && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
              СПЛИТ
            </span>
          )}
          {pinState.is_washout && (
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold text-[10px]">
              ВОШАУТ
            </span>
          )}
        </div>
        <div className="font-mono font-bold text-white text-xs">
          {pinState.pins_standing_count} из 10 стоят
        </div>
      </div>

      {/* Треугольник 10 кеглей */}
      <div className={`flex flex-col items-center ${pinSizes.rowGap} z-10 my-2`}>
        {pinRows.map((row, rIdx) => (
          <div key={rIdx} className={`flex items-center justify-center ${pinSizes.pinGap}`}>
            {row.map(pinNum => {
              const isStanding = pinState.pins[pinNum - 1] === true;
              const isSplitPin = pinState.is_split && isStanding;

              return (
                <button
                  key={pinNum}
                  type="button"
                  onClick={() => interactive && onTogglePin?.(pinNum)}
                  disabled={!interactive}
                  aria-label={`Кегля ${pinNum} ${isStanding ? 'Стоит' : 'Сбита'}`}
                  className={`relative rounded-full flex items-center justify-center transition-all duration-300 transform ${
                    pinSizes.pin
                  } ${
                    isStanding
                      ? isSplitPin
                        ? theme.pinSplitClass
                        : theme.pinStandingClass
                      : theme.pinFallenClass
                  } ${interactive ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}`}
                >
                  {/* Красные шейные полоски кегли */}
                  {isStanding && (
                    <div className="absolute top-1 w-3/4 flex flex-col gap-0.5 items-center pointer-events-none opacity-80">
                      <div className="w-full h-[1.5px] bg-red-600 rounded-full" />
                      <div className="w-full h-[1.5px] bg-red-600 rounded-full" />
                    </div>
                  )}

                  {/* Номер кегли */}
                  <span className="z-10 mt-1">{getPinLabelText(pinNum)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Нижний статус калибровки */}
      <div className="mt-2 text-[10px] text-zinc-500 font-mono tracking-wider text-center">
        {interactive ? 'Нажмите на кеглю для смены статуса DLT' : 'DLT-калибровка камеры активна'}
      </div>
    </div>
  );
};
