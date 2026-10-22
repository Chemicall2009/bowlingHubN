/**
 * IAdea XMP-320 Legacy WebKit Scoring Display Application (ES5 Only)
 * Zero ES6/ES7 features: NO let, NO const, NO arrow functions, NO fetch, NO promises.
 */

(function() {
  'use strict';

  // Global State
  window.SCORING_STATE = {
    laneId: 1,
    gameNumber: 1,
    players: [
      { name: 'Иван', scores: new Array(10), totals: new Array(10), totalScore: 0 },
      { name: 'Ольга', scores: new Array(10), totals: new Array(10), totalScore: 0 }
    ],
    activePlayerIdx: 0,
    timeRemainingSec: 1800,
    ws: null,
    reconnectAttempts: 0
  };

  // DOM Elements Initialization
  var laneIdEl = document.getElementById('lane-id-val');
  var gameNumEl = document.getElementById('game-num-val');
  var timerValEl = document.getElementById('timer-val');
  var speedIndicatorEl = document.getElementById('speed-indicator');
  var activePlayerNameEl = document.getElementById('active-player-name');
  var scoreTbodyEl = document.getElementById('score-tbody');
  var videoOverlayEl = document.getElementById('video-overlay');
  var animVideoEl = document.getElementById('anim-video');
  var intermissionOverlayEl = document.getElementById('intermission-overlay');
  var intermissionTitleEl = document.getElementById('intermission-title');
  var intermissionTimerEl = document.getElementById('intermission-timer');

  // Initialize Score Table
  function renderTableStructure() {
    scoreTbodyEl.innerHTML = '';
    for (var p = 0; p < window.SCORING_STATE.players.length; p++) {
      var player = window.SCORING_STATE.players[p];
      var row1 = document.createElement('tr');
      row1.className = (p === window.SCORING_STATE.activePlayerIdx) ? 'active-row' : '';
      row1.id = 'player_row_' + p;

      var nameTd = document.createElement('td');
      nameTd.className = 'player-col';
      nameTd.rowSpan = 2;
      nameTd.innerText = player.name;
      row1.appendChild(nameTd);

      // Frames 1-9 (2 cells each)
      for (var f = 1; f <= 9; f++) {
        var td1 = document.createElement('td');
        td1.id = 'p' + p + '_f' + f + '_1';
        td1.innerText = '';
        row1.appendChild(td1);

        var td2 = document.createElement('td');
        td2.id = 'p' + p + '_f' + f + '_2';
        td2.innerText = '';
        row1.appendChild(td2);
      }

      // Frame 10 (3 cells)
      for (var b = 1; b <= 3; b++) {
        var td10 = document.createElement('td');
        td10.id = 'p' + p + '_f10_' + b;
        td10.innerText = '';
        row1.appendChild(td10);
      }

      var totalTd = document.createElement('td');
      totalTd.className = 'total-col';
      totalTd.rowSpan = 2;
      totalTd.id = 'p' + p + '_total';
      totalTd.innerText = '0';
      row1.appendChild(totalTd);

      scoreTbodyEl.appendChild(row1);

      // Row 2 for frame subtotals
      var row2 = document.createElement('tr');
      row2.className = (p === window.SCORING_STATE.activePlayerIdx) ? 'active-row' : '';
      row2.id = 'player_row_sub_' + p;

      for (var sf = 1; sf <= 10; sf++) {
        var subTd = document.createElement('td');
        subTd.colSpan = (sf === 10) ? 3 : 2;
        subTd.id = 'p' + p + '_sub_f' + sf;
        subTd.innerText = '';
        row2.appendChild(subTd);
      }

      scoreTbodyEl.appendChild(row2);
    }
  }

  // WebSocket Connection with fallback & reconnect
  function initWebSocket() {
    var wsProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
    var wsUrl = wsProtocol + window.location.hostname + ':8000/ws/iaea/' + window.SCORING_STATE.laneId;

    try {
      window.SCORING_STATE.ws = new WebSocket(wsUrl);

      window.SCORING_STATE.ws.onopen = function() {
        console.log('[XMP320] WebSocket connected');
        window.SCORING_STATE.reconnectAttempts = 0;
      };

      window.SCORING_STATE.ws.onmessage = function(event) {
        try {
          var msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (err) {
          console.error('[XMP320] Message parse error:', err);
        }
      };

      window.SCORING_STATE.ws.onclose = function() {
        console.warn('[XMP320] WebSocket closed. Reconnecting in 5s...');
        scheduleReconnect();
      };

      window.SCORING_STATE.ws.onerror = function(err) {
        console.error('[XMP320] WebSocket error:', err);
      };
    } catch (e) {
      console.error('[XMP320] WebSocket init failed:', e);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    window.SCORING_STATE.reconnectAttempts++;
    var timeout = Math.min(5000 * window.SCORING_STATE.reconnectAttempts, 30000);
    
    // Save state to localStorage before reconnect
    try {
      localStorage.setItem('xmp320_state', JSON.stringify(window.SCORING_STATE));
    } catch (ex) {}

    setTimeout(initWebSocket, timeout);
  }

  // Handle incoming protocol messages
  function handleServerMessage(msg) {
    if (!msg || !msg.action) return;

    if (msg.action === 'update_score') {
      // msg: { frame, ball, score, total, player_idx }
      var cellId = 'p' + msg.player_idx + '_f' + msg.frame + '_' + msg.ball;
      var cellEl = document.getElementById(cellId);
      if (cellEl) cellEl.innerText = msg.score;

      var subId = 'p' + msg.player_idx + '_sub_f' + msg.frame;
      var subEl = document.getElementById(subId);
      if (subEl) subEl.innerText = msg.total;

      var totalEl = document.getElementById('p' + msg.player_idx + '_total');
      if (totalEl && msg.grand_total) totalEl.innerText = msg.grand_total;
    } 
    else if (msg.action === 'play_video') {
      // msg: { type: 'strike' | 'spare' | 'gutter' | 'foul' | 'split' }
      playVideoOverlay(msg.type);
    } 
    else if (msg.action === 'show_speed') {
      // msg: { value: '28.4' }
      speedIndicatorEl.innerText = msg.value;
    } 
    else if (msg.action === 'SHOW_INTERMISSION_NEW_GAME') {
      // msg: { seconds_left, next_game_num }
      intermissionTitleEl.innerText = 'Подготовка партии №' + msg.next_game_num;
      intermissionTimerEl.innerText = 'Осталось: ' + msg.seconds_left + ' сек';
      intermissionOverlayEl.style.display = 'block';
    } 
    else if (msg.action === 'START_NEW_GAME_RESET') {
      intermissionOverlayEl.style.display = 'none';
      gameNumEl.innerText = msg.game_number;
      renderTableStructure();
    } 
    else if (msg.action === 'RESTORE_GAME') {
      if (msg.game_data) {
        window.SCORING_STATE = msg.game_data;
        renderTableStructure();
      }
    } 
    else if (msg.action === 'set_theme') {
      // msg: { theme: 'classic' | 'cartoon' | 'cosmic' }
      document.body.className = 'theme-' + msg.theme;
    } 
    else if (msg.action === 'update_players') {
      // msg: { players: [...] }
      window.SCORING_STATE.players = msg.players;
      renderTableStructure();
    }
  }

  // Fullscreen Video Overlay playback
  function playVideoOverlay(type) {
    var videoSrc = 'assets/videos/' + type + '.mp4';
    animVideoEl.src = videoSrc;
    animVideoEl.currentTime = 0;
    videoOverlayEl.style.display = 'block';
    
    animVideoEl.play();

    animVideoEl.onended = function() {
      videoOverlayEl.style.display = 'none';
      animVideoEl.currentTime = 0;
    };
  }

  // Timer Tick
  setInterval(function() {
    if (window.SCORING_STATE.timeRemainingSec > 0) {
      window.SCORING_STATE.timeRemainingSec--;
      var m = Math.floor(window.SCORING_STATE.timeRemainingSec / 60);
      var s = window.SCORING_STATE.timeRemainingSec % 60;
      timerValEl.innerText = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }
  }, 1000);

  // Initialization on load
  window.onload = function() {
    renderTableStructure();
    initWebSocket();
    console.log('[XMP320] Scoring display initialized successfully.');
  };

})();
