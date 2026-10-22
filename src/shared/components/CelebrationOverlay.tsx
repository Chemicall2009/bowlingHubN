import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CelebrationState } from '../store/bowlingStore';
import { Flame, Trophy, Zap, AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface CelebrationOverlayProps {
  celebration: CelebrationState | null;
  onDismiss: () => void;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ celebration, onDismiss }) => {
  useEffect(() => {
    if (!celebration || !celebration.active) return;

    if (celebration.type === 'strike' || celebration.type === 'winner' || celebration.type === 'turkey') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#ec4899', '#eab308', '#22c55e', '#a855f7'],
        });
      } catch {
        // Safe fallback if canvas not mounted
      }
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 2800);

    return () => clearTimeout(timer);
  }, [celebration, onDismiss]);

  if (!celebration || !celebration.active) return null;

  const config = {
    strike: {
      icon: Flame,
      bg: 'from-cyan-600/90 to-blue-900/90 border-cyan-400',
      textColor: 'text-cyan-200',
      badgeColor: 'bg-cyan-500 text-black',
    },
    spare: {
      icon: Zap,
      bg: 'from-emerald-600/90 to-teal-900/90 border-emerald-400',
      textColor: 'text-emerald-200',
      badgeColor: 'bg-emerald-400 text-black',
    },
    split: {
      icon: AlertTriangle,
      bg: 'from-amber-600/90 to-red-950/90 border-amber-400',
      textColor: 'text-amber-200',
      badgeColor: 'bg-amber-400 text-black',
    },
    foul: {
      icon: ShieldAlert,
      bg: 'from-rose-700/90 to-red-950/90 border-rose-500',
      textColor: 'text-rose-200',
      badgeColor: 'bg-rose-500 text-white',
    },
    turkey: {
      icon: Flame,
      bg: 'from-fuchsia-600/90 to-purple-950/90 border-fuchsia-400',
      textColor: 'text-fuchsia-200',
      badgeColor: 'bg-fuchsia-400 text-black',
    },
    winner: {
      icon: Trophy,
      bg: 'from-amber-500/90 to-yellow-800/90 border-yellow-300',
      textColor: 'text-yellow-100',
      badgeColor: 'bg-yellow-400 text-black',
    },
    gutter: {
      icon: AlertTriangle,
      bg: 'from-zinc-700/90 to-zinc-950/90 border-zinc-500',
      textColor: 'text-zinc-300',
      badgeColor: 'bg-zinc-600 text-white',
    },
  }[celebration.type] || {
    icon: Flame,
    bg: 'from-cyan-600/90 to-blue-900/90 border-cyan-400',
    textColor: 'text-cyan-200',
    badgeColor: 'bg-cyan-500 text-black',
  };

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-none animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-lg p-8 rounded-3xl bg-gradient-to-b ${config.bg} border-2 shadow-2xl shadow-black/80 flex flex-col items-center text-center transform scale-100 animate-in zoom-in-95 duration-200`}
      >
        <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center mb-4 ring-4 ring-white/20">
          <Icon className="w-10 h-10 text-white animate-bounce" />
        </div>

        <div className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase drop-shadow-lg mb-2">
          {celebration.message}
        </div>

        {celebration.submessage && (
          <div className="text-sm md:text-base font-semibold text-white/90 tracking-wide uppercase">
            {celebration.submessage}
          </div>
        )}
      </div>
    </div>
  );
};
