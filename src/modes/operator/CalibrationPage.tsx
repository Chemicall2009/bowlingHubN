import React, { useState, useRef } from 'react';
import { Camera, Save, RefreshCw, Layers, Zap } from 'lucide-react';

export const CalibrationPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [lanePair, setLanePair] = useState('1-2');

  const handleSnapshot = async () => {
    // Placeholder for API call to capture RTSP snapshot
    setSnapshot('/static/ref_frame.jpg'); 
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <h1 className="text-xl font-black text-white">Калибровка камеры: Дорожки {lanePair}</h1>
        <div className="flex gap-2">
            <button onClick={handleSnapshot} className="px-4 py-2 bg-blue-600 rounded-lg text-white font-bold flex items-center gap-2">
                <Camera size={16}/> Захватить кадр
            </button>
            <button className="px-4 py-2 bg-emerald-600 rounded-lg text-white font-bold flex items-center gap-2">
                <Save size={16}/> Сохранить
            </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3 bg-zinc-900 rounded-2xl border border-zinc-800 p-4 min-h-[600px] flex items-center justify-center">
          {snapshot ? (
            <img src={snapshot} alt="Reference frame" className="max-w-full rounded-lg" />
          ) : (
            <div className="text-zinc-600">Нажмите "Захватить кадр"</div>
          )}
        </div>
        
        <div className="flex flex-col gap-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                <h2 className="text-sm font-bold text-white mb-4">Настройки тайминга</h2>
                <label className="block text-xs text-zinc-400 mb-1">Задержка гарда (T_sweep_ms)</label>
                <input 
                  type="range" min="1000" max="2500" 
                  className="w-full mb-2" 
                  onChange={(e) => console.log('T_sweep_ms:', e.target.value)}
                />
                <div className="text-xs text-cyan-400 font-mono">1500 мс</div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                <h2 className="text-sm font-bold text-white mb-4">Настройки ROI</h2>
                <label className="block text-xs text-zinc-400 mb-1">Размер ROI (пикс)</label>
                <input type="range" min="8" max="32" className="w-full mb-4" />
                
                <label className="block text-xs text-zinc-400 mb-1">Порог (Threshold)</label>
                <input type="range" min="0" max="255" className="w-full mb-4" />
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                <h2 className="text-sm font-bold text-white mb-4">Статус меток</h2>
                <div className="space-y-2">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="text-xs text-zinc-300">Кегля {i+1}: <span className="text-emerald-500">Задана</span></div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
