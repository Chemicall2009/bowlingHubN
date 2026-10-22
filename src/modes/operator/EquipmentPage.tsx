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
  const { devices, scanDevices, pingDevice, rebootDevice, otaUpdateDevice } = useBowlingStore();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [otaFirmwareUrl, setOtaFirmwareUrl] = useState('https://firmware.bowlinghub.local/v2.5.0-bcore.bin');
  const [filterLane, setFilterLane] = useState<string>('all');

  const filteredDevices = devices.filter(d => (filterLane === 'all' ? true : d.lane_id === parseInt(filterLane, 10)));

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель оборудования */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Флот контроллеров ESP32 и сеть MQTT</h1>
            <p className="text-xs text-zinc-400">
              Контрактные роли: датчик_А, датчик_Б, камера_CV, пинспоттер, элеватор шаров
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Фильтр по дорожке */}
          <select
            value={filterLane}
            onChange={e => setFilterLane(e.target.value)}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">Все дорожки (1-6)</option>
            <option value="1">Дорожка 1</option>
            <option value="2">Дорожка 2</option>
            <option value="3">Дорожка 3</option>
          </select>

          {/* Сканирование сети */}
          <button
            onClick={scanDevices}
            className="flex items-center gap-2 px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Опросить сеть (Discovery)</span>
          </button>
        </div>
      </div>

      {/* Сетка устройств */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map(device => {
          const isOnline = device.status === 'online';

          return (
            <div
              key={device.device_id}
              className={`p-4 rounded-2xl bg-zinc-950 border transition-all ${
                selectedDevice === device.device_id
                  ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                  : 'border-zinc-800 hover:border-zinc-700'
              } flex flex-col justify-between gap-3 shadow-xl`}
            >
              {/* Заголовок */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold text-white text-xs font-mono">{device.device_id}</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-cyan-300 border border-zinc-700">
                  Дорожка {device.lane_id} · {device.role}
                </span>
              </div>

              {/* Характеристики и телеметрия */}
              <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                <div>
                  <span className="text-zinc-500">IP-адрес:</span>
                  <div className="font-mono text-zinc-300">{device.ip_address || '192.168.1.100'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Прошивка:</span>
                  <div className="font-mono text-zinc-300">{device.firmware_version || 'v2.4.1'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Сигнал Wi-Fi:</span>
                  <div className="font-mono text-emerald-400">{device.rssi || -58} дБм</div>
                </div>
                <div>
                  <span className="text-zinc-500">Аптайм:</span>
                  <div className="font-mono text-zinc-300">{Math.floor((device.uptime_sec || 0) / 60)} мин</div>
                </div>
              </div>

              {/* Кнопки команд */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 gap-1.5">
                <button
                  onClick={() => pingDevice(device.device_id)}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium border border-zinc-800 flex items-center justify-center gap-1 transition-colors"
                  title="Отправить эхо-запрос Ping"
                >
                  <Wifi className="w-3 h-3 text-cyan-400" />
                  <span>Пинг</span>
                </button>

                <button
                  onClick={() => rebootDevice(device.device_id)}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium border border-zinc-800 flex items-center justify-center gap-1 transition-colors"
                  title="Перезагрузить микроконтроллер"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>Ребут</span>
                </button>

                <button
                  onClick={() => otaUpdateDevice(device.device_id, otaFirmwareUrl)}
                  className="flex-1 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-xs font-medium border border-purple-500/30 flex items-center justify-center gap-1 transition-colors"
                  title="Обновление прошивки по воздуху (OTA)"
                >
                  <DownloadCloud className="w-3 h-3" />
                  <span>OTA</span>
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
