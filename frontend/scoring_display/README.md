# IAdea XMP-320 Scoring Display Module

Модуль предназначен для работы на устаревших аппаратных медиаплеерах **IAdea XMP-320** (Android 4.0–4.4 WebKit, одноядерный ARM 800 MHz, 256–512 MB RAM).

---

## 1. Структура файлов
- `/frontend/scoring_display/index.html` — основная HTML5-страница табло.
- `/frontend/scoring_display/style.css` — стили с поддержкой трех тем (classic, cartoon, cosmic) без использования запрещенных CSS-свойств (Grid, flex gap, variables).
- `/frontend/scoring_display/app.js` — вся логика на **чистом ES5** (`var`, `function`, `XMLHttpRequest`, `WebSocket`), без фреймворков и ES6+.
- `/frontend/scoring_display/assets/videos/` — папка для предзагруженных видеороликов (`strike.mp4`, `spare.mp4`, `gutter.mp4`, `foul.mp4`, `split.mp4`, `intermission.mp4`).

---

## 2. Руководство по сжатию видео через HandBrake под XMP-320
Чтобы видео не вызывало фризов или черного экрана на слабом железе XMP-320, строго соблюдайте параметры кодирования:
- **Container:** MP4
- **Video Codec:** H.264 (x264)
- **Profile:** Baseline (обязательно не Main и не High!)
- **Level:** 3.1
- **Resolution:** 1920 × 1080 (или 1280 × 720)
- **Framerate:** 30 fps (constant)
- **Bitrate:** 4000–5500 kbps (VBR)
- **Audio:** AAC, 128 kbps (или полностью удалить звуковую дорожку для экономии размера).
- **Optimization:** Флаг **FastStart** (moov atom в начале файла) для мгновенного старта воспроизведения без задержки.

---

## 3. Спецификация WebSocket-событий
Подключение: `ws://[server-ip]:8000/ws/iaea/{lane_id}`

### Поддерживаемые действия (`action`):
1. `update_score`:
   ```json
   {"action": "update_score", "frame": 3, "ball": 1, "score": "X", "total": "45", "player_idx": 0, "grand_total": 120}
   ```
2. `play_video`:
   ```json
   {"action": "play_video", "type": "strike"}
   ```
3. `show_speed`:
   ```json
   {"action": "show_speed", "value": "28.4"}
   ```
4. `SHOW_INTERMISSION_NEW_GAME`:
   ```json
   {"action": "SHOW_INTERMISSION_NEW_GAME", "seconds_left": 120, "next_game_num": 2}
   ```
5. `START_NEW_GAME_RESET`:
   ```json
   {"action": "START_NEW_GAME_RESET", "game_number": 2}
   ```
6. `set_theme`:
   ```json
   {"action": "set_theme", "theme": "cosmic"}
   ```
7. `update_players`:
   ```json
   {"action": "update_players", "players": [{"name": "Иван", ...}]}
   ```
