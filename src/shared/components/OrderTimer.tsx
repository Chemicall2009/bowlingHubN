import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export interface OrderTimerProps {
  endsAt: string;
  durationMin: number;
  elapsedSec?: number;
  timeExpired: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const OrderTimer: React.FC<OrderTimerProps> = ({
  endsAt,
  durationMin,
  timeExpired,
  size = 'md',
}) => {
  const [secondsRemaining, setSecondsRemaining] = React.useState<number>(0);

  React.useEffect(() => {
    const calculateRemaining = () => {
      const endsMs = new Date(endsAt).getTime();
      const diffSec = Math.max(0, Math.round((endsMs - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const formatHMS = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalSec = Math.max(1, durationMin * 60);
  const percent = Math.min(100, Math.max(0, Math.round((secondsRemaining / totalSec) * 100)));

  const sizeClasses = {
    sm: 'text-sm font-bold',
    md: 'text-xl font-black',
    lg: 'text-3xl font-black',
    xl: 'text-5xl font-black',
  }[size];

  if (timeExpired || secondsRemaining <= 0) {
    return (
      <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-950/80 border-2 border-rose-500 animate-pulse text-rose-300">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <span className="text-xs font-bold tracking-wider uppercase">ВРЕМЯ ИСТЕКЛО</span>
        </div>
        <div className={`font-mono text-rose-200 ${sizeClasses}`}>00:00</div>
        <div className="w-full bg-rose-900/40 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="bg-rose-500 h-full w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-3 rounded-2xl bg-zinc-900/90 border border-white/10">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Остаток времени</span>
        </div>
        <span className="text-xs font-mono text-zinc-400">{percent}%</span>
      </div>

      <div className={`font-mono text-white ${sizeClasses}`}>
        {formatHMS(secondsRemaining)}
      </div>

      <div className="w-full bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            percent < 15 ? 'bg-rose-500' : percent < 30 ? 'bg-amber-500' : 'bg-cyan-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
