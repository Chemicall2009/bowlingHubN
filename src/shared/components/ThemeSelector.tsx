import React from 'react';
import { VidibiThemeId } from '../../types/vidibi';
import { VIDIBI_THEMES } from '../themes/vidibiThemes';
import { Palette, Check } from 'lucide-react';

interface ThemeSelectorProps {
  currentThemeId: VidibiThemeId;
  onSelectTheme: (themeId: VidibiThemeId) => void;
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentThemeId,
  onSelectTheme,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const currentTheme = VIDIBI_THEMES[currentThemeId] || VIDIBI_THEMES.midnight_oled;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white border border-white/10 transition-colors"
          title="Сменить тему VIDIBI"
        >
          <Palette className="w-3.5 h-3.5 text-cyan-400" />
          <span className="truncate max-w-[130px]">{currentTheme.name}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-72 p-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
              <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                Выберите тему VIDIBI (10 вариантов)
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {(Object.keys(VIDIBI_THEMES) as VidibiThemeId[]).map(themeKey => {
                  const t = VIDIBI_THEMES[themeKey];
                  const isSelected = themeKey === currentThemeId;

                  return (
                    <button
                      key={themeKey}
                      onClick={() => {
                        onSelectTheme(themeKey);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                        isSelected ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate">
                        <div>{t.name}</div>
                        <div className="text-[10px] text-zinc-500 font-normal truncate">{t.description}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {(Object.keys(VIDIBI_THEMES) as VidibiThemeId[]).map(themeKey => {
        const theme = VIDIBI_THEMES[themeKey];
        const isSelected = themeKey === currentThemeId;

        return (
          <button
            key={themeKey}
            type="button"
            onClick={() => onSelectTheme(themeKey)}
            className={`flex flex-col p-3 rounded-xl text-left border transition-all duration-200 ${
              isSelected
                ? 'border-cyan-400 ring-2 ring-cyan-400/40 bg-zinc-900 shadow-lg shadow-cyan-500/10'
                : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="font-semibold text-xs text-white truncate">{theme.name}</span>
              {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2 leading-relaxed">
              {theme.description}
            </p>
            {/* Превью категории */}
            <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-white/5">
              <span className={`w-3.5 h-3.5 rounded-full ${theme.accentPrimary.split(' ')[0]} border border-white/20`} />
              <span className="text-[10px] font-mono text-zinc-500 uppercase">{theme.category}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
