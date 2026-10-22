import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import {
  Cpu,
  Wifi,
  RotateCcw,
  DownloadCloud,
  Terminal,
  Search,
} from 'lucide-react';

export const EquipmentPage: React.FC = () => {
  const { lanes, devices, scanDevices, pingDevice, rebootDevice, otaUpdateDevice } = useBowlingStore();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [otaFirmwareUrl, setOtaFirmwareUrl] = useState('https://firmware.bowlinghub.local/v2.5.0-bcore.bin');
  const [filterLane, setFilterLane] = useState<string>('all');

  const filteredLanes = lanes.filter(l => (filterLane === 'all' ? true : l.id === parseInt(filterLane, 10)));

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель оборудования */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Инфраструктура дорожек</h1>
            <p className="text-xs text-zinc-400">ТВ панели, FBox (ESP32) и Master PC</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterLane}
            onChange={e => setFilterLane(e.target.value)}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">Все дорожки</option>
            {lanes.map(l => (
              <option key={l.id} value={l.id}>Дорожка {l.id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Сетка оборудования по дорожкам */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredLanes.map(lane => {
          const fbox = devices.find(d => d.lane_id === lane.id && d.role === 'pinspotter_ctl'); // Assuming role 'pinspotter_ctl' is the FBox

          return (
            <div key={lane.id} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
              <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Дорожка {lane.id}</h2>
              
              <div className="grid grid-cols-3 gap-3">
                {/* TV Panel */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">ТВ Панель</span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded">ONLINE</span>
                </div>

                {/* FBox */}
                <div className={`p-3 rounded-xl border flex flex-col items-center gap-2 ${fbox ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-800'}`}>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">FBox</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${fbox?.status === 'online' ? 'text-emerald-400 bg-emerald-950/30' : 'text-rose-400 bg-rose-950/30'}`}>
                    {fbox?.status || 'OFFLINE'}
                  </span>
                </div>

                {/* Master PC */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Master PC</span>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded">ONLINE</span>
                </div>
              </div>

              {/* Calibration & OTA */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                <button 
                  onClick={() => fetch(`/api/fbox/devices/${fbox?.device_id}/ping`, { method: 'POST' })}
                  disabled={!fbox || fbox.status !== 'online'}
                  className="py-2 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-semibold text-white hover:border-cyan-500 transition-colors disabled:opacity-50"
                >
                  Ping
                </button>
                <button 
                  onClick={() => fetch(`/api/fbox/devices/${fbox?.device_id}/reboot`, { method: 'POST' })}
                  disabled={!fbox || fbox.status !== 'online'}
                  className="py-2 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-semibold text-white hover:border-amber-500 transition-colors disabled:opacity-50"
                >
                  Reboot
                </button>
                <button 
                  onClick={() => {
                    const url = prompt("Введите URL прошивки:");
                    if (url) fetch(`/api/fbox/devices/${fbox?.device_id}/ota`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url}) });
                  }}
                  disabled={!fbox || fbox.status !== 'online'}
                  className="py-2 px-3 bg-purple-600/20 border border-purple-500/30 rounded-lg text-xs font-semibold text-purple-300 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                >
                  OTA Update
                </button>
                <button 
                  onClick={() => alert("Firmware v2.0.3 does not support remote config")}
                  className="py-2 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-semibold text-white hover:border-rose-500 transition-colors"
                >
                  Config
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Спецификация топиков MQTT */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Спецификация топиков MQTT и frozen-контракт
            </h2>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">Брокер: mosquitto:1883</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2">
            <span className="text-cyan-300 font-bold">Входящие события (Inbound):</span>
            <ul className="space-y-1 text-zinc-400 text-[11px]">
              <li><code className="text-zinc-200">lane/&#123;id&#125;/sensor/ball_a</code> → Таймштамп датчика А</li>
              <li><code className="text-zinc-200">lane/&#123;id&#125;/sensor/ball_b</code> → Датчик Б и расчёт скорости</li>
              <li><code className="text-zinc-200">lane/&#123;id&#125;/sensor/foul</code> → Оптический датчик заступа</li>
              <li><code className="text-zinc-200">lane/&#123;id&#125;/cv/pins</code> → Битовая маска кеглей DLT-камеры</li>
              <li><code className="text-zinc-200">lane/&#123;id&#125;/pinspotter/cycle_complete</code> → Завершение цикла пинспоттера</li>
              <li><code className="text-zinc-200">fleet/discovery/response</code> → Автообнаружение ESP32</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2">
            <span className="text-purple-300 font-bold">Исходящие команды (Outbound):</span>
            <ul className="space-y-1 text-zinc-400 text-[11px]">
              <li><code className="text-zinc-200">lane/&#123;id&#125;/control/command</code> → Смахнуть / Сброс / Бортики</li>
              <li><code className="text-zinc-200">fleet/discovery/request</code> → Широковещательный поиск устройств</li>
              <li><code className="text-zinc-200">fleet/device/&#123;dev_id&#125;/command</code> → Пинг / Ребут / Прошивка OTA</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
