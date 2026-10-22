import React from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { DashboardPage } from './DashboardPage';
import { LaneDetailPage } from './LaneDetailPage';
import { EquipmentPage } from './EquipmentPage';
import { SettingsPage } from './SettingsPage';
import { ReportsPage } from './ReportsPage';
import {
  LayoutDashboard,
  Cpu,
  Settings,
  BarChart3,
  ExternalLink,
  Layers,
} from 'lucide-react';

export const OperatorLayout: React.FC = () => {
  const { activeTab, setActiveTab, selectedLaneId, setSelectedLaneId, settings, lanes } = useBowlingStore();
  const totalLanes = settings?.total_lanes || 6;
  const enabledLanes = lanes.filter(l => l.enabled !== false && l.id <= totalLanes);
  const currentLaneId = selectedLaneId <= totalLanes ? selectedLaneId : (enabledLanes[0]?.id || 1);

  const handleSelectLane = (laneId: number) => {
    setSelectedLaneId(laneId);
    setActiveTab('lane_detail');
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Bar (1 строка, 3 зоны: Бренд — Навигация — Действия) */}
      <header className="w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        {/* Зона 1: Название центра */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-black font-black flex items-center justify-center text-sm shadow-md shadow-cyan-500/20">
            БХ
          </div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-lg font-black tracking-tight text-white hover:text-cyan-300 transition-colors"
          >
            {settings.center_name || 'Боулинг-центр «Страйк Сити»'}
          </button>
        </div>

        {/* Зона 2: Навигационные вкладки оператора */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Панель дорожек</span>
          </button>

          <button
            onClick={() => {
              setSelectedLaneId(currentLaneId);
              setActiveTab('lane_detail');
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'lane_detail'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Дорожка {currentLaneId}</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'equipment'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Оборудование ESP32</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'reports'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Отчёты смены</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Настройки</span>
          </button>
        </nav>

        {/* Зона 3: Быстрый переход в экран киоска VIDIBI */}
        <div className="flex items-center gap-3">
          <a
            href={`/kiosk/${selectedLaneId || 1}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-cyan-300 text-xs font-semibold transition-colors"
          >
            <span>Экран дорожки #{selectedLaneId || 1}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Основная рабочая область */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <DashboardPage onSelectLane={handleSelectLane} />
        )}

        {activeTab === 'lane_detail' && (
          <LaneDetailPage
            laneId={currentLaneId}
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'equipment' && <EquipmentPage />}

        {activeTab === 'settings' && <SettingsPage />}

        {activeTab === 'reports' && <ReportsPage />}
      </main>

      {/* Подвал с системной информацией */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-400">BowlingHub Core v2.4</span>
            <span aria-hidden="true">·</span>
            <span>Движок подсчёта USBC (38/38 тестов пройдено)</span>
            <span aria-hidden="true">·</span>
            <span>Плоский WS-протокол Вариант 2</span>
          </div>

          <div className="font-mono text-[11px] text-zinc-500">
            MQTT-брокер: mosquitto:1883 · Порт сервера: 3000
          </div>
        </div>
      </footer>
    </div>
  );
};
