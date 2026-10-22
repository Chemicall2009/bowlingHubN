# BowlingHub Frozen Contracts (CONTRACT.md)

## A. WS-формат MasterPC ↔ frontend (Вариант 2, плоский)
```json
{
  "type": "phase_changed",
  "lane_id": 1,
  "ts": 1728000000000,
  "event_id": "uuid-optional",
  "phase": "order_active"
}
```
Strictly NO `payload` wrapper envelope! All fields at top level.

## B. 16 WS-событий (Frozen WS-контракт, плоские поля)
1. phase_changed
2. game_started
3. game_finished
4. order_paused
5. order_resumed
6. lane_closed
7. lane_reopened
8. total_score_updated
9. throw_registered
10. player_added
11. player_removed
12. player_renamed
13. anomaly
14. order_finished
15. players_reordered
16. display_settings_changed

### Схема display_settings_changed:
```json
{
  "type": "display_settings_changed",
  "lane_id": 0,
  "ts": 1728000000000,
  "settings": {
    "pin_labels_visible": true,
    "pin_labels_style": "number",
    "pin_labels_size": "md",
    "pin_labels_color": "#F1F5F9",
    "pin_labels_on_kiosk": false,
    "pin_labels_on_operator": true
  }
}
```

### Схема players_reordered:
```json
{
  "type": "players_reordered",
  "lane_id": 1,
  "order_id": "uuid",
  "ts": 1728000000000,
  "order": ["player-uuid-1", "player-uuid-2", "player-uuid-3"]
}
```

### ПРАВИЛО BROADCAST (lane_id=0):
События с lane_id=0 обрабатываются ВСЕМИ kiosk-сессиями и ВСЕМИ operator-сессиями, независимо от их текущего lane_id. Это единственное исключение из правила фильтрации по lane_id. Все остальные события с чужим lane_id — отбрасывать с warning в консоль.

## C. Enum'ы
- LanePhase: `idle | order_active | between_games | paused | closed | order_finished`
- ClosedPolicy: `pause | continue | manual`
- VidibiThemeId: `midnight_oled | retro_neon | classic_wood | carbon | arctic | sunset | matrix | royal | minimal_light | high_contrast`
- BindingRole: `sensor_a | sensor_b | cv_camera | display | pinspotter_ctl | bollift_ctl | foul_line | console`
- DeviceType: `sensor_controller | camera | vidibi_display | pinspotter | bollift | gateway | other`

## D. MQTT-контракт ESP ↔ backend
- `lane/{id}/sensor/ball_a`
- `lane/{id}/sensor/ball_b`
- `lane/{id}/pinspotter/status`
- `lane/{id}/pinspotter/cmd`
- `lane/{id}/bollift/cmd`
- `lane/{id}/heartbeat`
- `lane/{id}/connection`
- `lane/{id}/state`
- `lane/{id}/camera/frame`
- `device/{serial}/cmd/reboot`
- `device/{serial}/cmd/update`
- `broadcast/discovery/request`
- `broadcast/discovery/response`
