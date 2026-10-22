import React, { useState } from 'react';
import { useBowlingStore } from '../../shared/store/bowlingStore';
import { ThemeSelector } from '../../shared/components/ThemeSelector';
import { VidibiThemeId } from '../../types/vidibi';
import { Settings, Save, Plus, Trash2, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useBowlingStore();

  const [centerName, setCenterName] = useState(settings.center_name);
  const [totalLanes, setTotalLanes] = useState(settings.total_lanes);
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultTheme, setDefaultTheme] = useState<VidibiThemeId>(settings.default_theme);
  const [mqttHost, setMqttHost] = useState(settings.mqtt_broker_host);
  const [mqttPort, setMqttPort] = useState(settings.mqtt_broker_port);
  const [tariffs, setTariffs] = useState(settings.tariffs);
  const [displaySettings, setDisplaySettings] = useState(settings.display || {
    pin_labels_visible: true,
    pin_labels_style: 'number',
    pin_labels_size: 'md',
    pin_labels_color: '#ffffff',
    pin_labels_on_kiosk: false,
    pin_labels_on_operator: true,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      center_name: centerName,
      total_lanes: totalLanes,
      currency,
      default_theme: defaultTheme,
      mqtt_broker_host: mqttHost,
      mqtt_broker_port: mqttPort,
      tariffs,
      display: displaySettings,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddTariff = () => {
    setTariffs([
      ...tariffs,
      {
        id: `tariff-${Date.now()}`,
        name: 'Новый тариф',
        type: 'hourly',
        price: 2000.0,
        currency,
        description: 'Пользовательский тариф',
        is_active: true,
      },
    ]);
  };

  const handleRemoveTariff = (idx: number) => {
    if (tariffs.length > 1) {
      setTariffs(tariffs.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Верхняя панель */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Настройки боулинг-центра</h1>
            <p className="text-xs text-zinc-400">Тарифы, число дорожек, брокер MQTT и темы киоска VIDIBI</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-colors shadow-lg shadow-cyan-500/20"
        >
          {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Настройки сохранены!' : 'Сохранить изменения'}</span>
        </button>
      </div>

      {/* Форма настроек */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левые 2 колонки: Центр и Тарифы */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Общие параметры */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Общая информация</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Название заведения</label>
                <input
                  type="text"
                  value={centerName}
                  onChange={e => setCenterName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Число дорожек</label>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={totalLanes}
                  onChange={e => setTotalLanes(parseInt(e.target.value, 10) || 6)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Валюта</label>
                <input
                  type="text"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Настройки меток кеглей (Pin Labels) */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Метки кеглей на пиндеке (Pin Labels)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white">Отображать метки</div>
                  <div className="text-[11px] text-zinc-400">Показывать номера/позиции поверх кеглей</div>
                </div>
                <input
                  type="checkbox"
                  checked={displaySettings.pin_labels_visible}
                  onChange={e => setDisplaySettings({ ...displaySettings, pin_labels_visible: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Стиль меток</label>
                <select
                  value={displaySettings.pin_labels_style}
                  onChange={e => setDisplaySettings({ ...displaySettings, pin_labels_style: e.target.value as 'number' | 'position' | 'both' | 'none' })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="number">Только номера (1..10)</option>
                  <option value="position">Позиции (Head, L2, Corner...)</option>
                  <option value="both">Оба (Номер + Позиция)</option>
                  <option value="none">Без меток</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white">У оператора</div>
                  <div className="text-[11px] text-zinc-400">Показывать метки в панели оператора</div>
                </div>
                <input
                  type="checkbox"
                  checked={displaySettings.pin_labels_on_operator}
                  onChange={e => setDisplaySettings({ ...displaySettings, pin_labels_on_operator: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <div className="text-xs font-bold text-white">На киоске VIDIBI</div>
                  <div className="text-[11px] text-zinc-400">Показывать метки на ТВ-экранах дорожки</div>
                </div>
                <input
                  type="checkbox"
                  checked={displaySettings.pin_labels_on_kiosk}
                  onChange={e => setDisplaySettings({ ...displaySettings, pin_labels_on_kiosk: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Список тарифов */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Тарифные планы ({tariffs.length})</h2>
              <button
                type="button"
                onClick={handleAddTariff}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить тариф</span>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {tariffs.map((tariff, idx) => (
                <div key={tariff.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col md:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={tariff.name}
                      onChange={e => {
                        const updated = [...tariffs];
                        updated[idx].name = e.target.value;
                        setTariffs(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="w-full md:w-36">
                    <select
                      value={tariff.type}
                      onChange={e => {
                        const updated = [...tariffs];
                        updated[idx].type = e.target.value as 'hourly' | 'per_game';
                        setTariffs(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none"
                    >
                      <option value="hourly">Почасовой</option>
                      <option value="per_game">За партию</option>
                    </select>
                  </div>

                  <div className="w-full md:w-32 flex items-center gap-1">
                    <input
                      type="number"
                      step="50"
                      value={tariff.price}
                      onChange={e => {
                        const updated = [...tariffs];
                        updated[idx].price = parseFloat(e.target.value) || 0;
                        setTariffs(updated);
                      }}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-mono focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 font-mono">₽</span>
                  </div>

                  {tariffs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTariff(idx)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Удалить тариф"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Превью тем киоска VIDIBI */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Тема экрана VIDIBI по умолчанию (10 вариантов)
            </h2>
            <ThemeSelector
              currentThemeId={defaultTheme}
              onSelectTheme={setDefaultTheme}
            />
          </div>
        </div>

        {/* Правая колонка: MQTT */}
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col gap-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Сеть MQTT брокера</h2>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Хост / Docker-сервис</label>
              <input
                type="text"
                value={mqttHost}
                onChange={e => setMqttHost(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Порт</label>
              <input
                type="number"
                value={mqttPort}
                onChange={e => setMqttPort(parseInt(e.target.value, 10) || 1883)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
              В контейнере Docker приложение автоматически подключается к сервису <code className="text-cyan-300">mosquitto:1883</code>.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
