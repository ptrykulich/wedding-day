/* Pavlo & Liza — wedding invitation
   - personal greeting from ?guest=…
   - countdown to the ceremony
   - "add to calendar": Google Calendar on Android, .ics elsewhere            */
(function () {
  'use strict';

  var WEDDING_START = new Date('2026-09-11T16:00:00+03:00').getTime();

  /* ---------------------------------------------------------------------
     Greeting
     ?guest=Діма            → "Діма!"
     ?guest=Діма&Таня       → "Діма та Таня!"   (& is allowed for convenience)
     ?guest=Діма,Таня,Оля   → "Діма, Таня та Оля!"
     --------------------------------------------------------------------- */
  function guestNames() {
    var raw = (window.location.search || '').replace(/^\?/, '');
    if (!raw) return [];
    var parts = raw.split('&');
    var names = [];
    var collecting = false;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var eq = part.indexOf('=');
      if (eq === -1) {                 // bare token after guest=, e.g. "&Таня"
        if (collecting && part) names.push(part);
        continue;
      }
      var key = part.slice(0, eq);
      var val = part.slice(eq + 1);
      if (key === 'guest') { collecting = true; if (val) names.push(val); }
      else collecting = false;
    }
    var clean = [];
    names.forEach(function (n) {
      var decoded;
      try { decoded = decodeURIComponent(n.replace(/\+/g, ' ')); } catch (e) { decoded = n; }
      decoded.split(',').forEach(function (s) {
        s = s.trim();
        if (s) clean.push(s.slice(0, 40));
      });
    });
    return clean;
  }

  function renderGreeting() {
    var el = document.getElementById('greeting');
    if (!el) return;
    var names = guestNames();
    if (!names.length) return;
    var text = names.length === 1
      ? names[0]
      : names.slice(0, -1).join(', ') + ' та ' + names[names.length - 1];
    el.textContent = text + '!';
    document.title = text + ' — Pavlo & Liza, 11.09.2026';
  }

  /* ---------------------------------------------------------------------
     Countdown
     --------------------------------------------------------------------- */
  function renderCountdown() {
    var box = document.getElementById('countdown');
    if (!box) return;
    var fields = {
      days: box.querySelector('[data-unit="days"]'),
      hours: box.querySelector('[data-unit="hours"]'),
      minutes: box.querySelector('[data-unit="minutes"]'),
      seconds: box.querySelector('[data-unit="seconds"]')
    };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    function tick() {
      var diff = WEDDING_START - Date.now();
      if (diff <= 0) {
        box.innerHTML = '<p class="countdown__done" style="grid-column: 1 / -1">Сьогодні наш день!</p>';
        clearInterval(timer);
        return;
      }
      fields.days.textContent = String(Math.floor(diff / 86400000));
      fields.hours.textContent = pad(Math.floor(diff / 3600000) % 24);
      fields.minutes.textContent = pad(Math.floor(diff / 60000) % 60);
      fields.seconds.textContent = pad(Math.floor(diff / 1000) % 60);
    }
    var timer = setInterval(tick, 1000);
    tick();
  }

  /* ---------------------------------------------------------------------
     Add to calendar
     Android → Google Calendar template link (opens the app / web form)
     iOS / desktop → static wedding.ics (two events: ceremony + dinner)
     --------------------------------------------------------------------- */
  function setupCalendar() {
    var btn = document.getElementById('add-to-calendar');
    if (!btn) return;
    if (!/Android/i.test(navigator.userAgent)) return; // keep .ics link as is

    var title = encodeURIComponent('Весілля Павла та Лізи');
    var details = encodeURIComponent(
      '16:00 — Церемонія, Центральний РАГС\nhttps://maps.app.goo.gl/GhsCVwM5nMNz5PEAA\n\n' +
      '17:00 — Святкова вечеря, Elissa Bar&Restaurant\nhttps://maps.app.goo.gl/mZnmKt7e6aQjSAtSA'
    );
    var location = encodeURIComponent('Центральний РАГС');
    btn.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + title +
      '&dates=20260911T130000Z/20260911T210000Z' +
      '&details=' + details +
      '&location=' + location +
      '&ctz=Europe/Kyiv';
    btn.target = '_blank';
    btn.rel = 'noopener';
  }

  /* ---------------------------------------------------------------------
     Background music
     Browsers block sound until the visitor interacts with the page, so:
     try to start right away → if blocked, start on the first tap / click.
     The corner button toggles it; an explicit "off" is remembered.
     --------------------------------------------------------------------- */
  function setupMusic() {
    var audio = document.getElementById('bg-music');
    var btn = document.getElementById('music-toggle');
    if (!audio || !btn) return;

    var KEY = 'wedding-music';
    var userOff = false;
    try { userOff = localStorage.getItem(KEY) === 'off'; } catch (e) {}

    var TARGET_VOL = 0.55;
    audio.volume = 0;
    btn.hidden = false;

    function setState(on) {
      btn.classList.toggle('music--on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Вимкнути музику' : 'Увімкнути музику');
    }

    function fadeIn() {
      var v = audio.volume;
      var timer = setInterval(function () {
        v = Math.min(TARGET_VOL, v + 0.05);
        audio.volume = v;                 // iOS ignores volume — harmless
        if (v >= TARGET_VOL || audio.paused) clearInterval(timer);
      }, 120);
    }

    function play() {
      var p = audio.play();
      if (p && typeof p.then === 'function') {
        return p.then(function () { setState(true); fadeIn(); return true; },
                      function () { setState(false); return false; });
      }
      setState(!audio.paused);
      return Promise.resolve(!audio.paused);
    }

    function stop() {
      audio.pause();
      audio.volume = 0;
      setState(false);
    }

    // Start on first interaction anywhere on the page (once).
    var gestures = ['pointerdown', 'touchend', 'keydown'];
    function onFirstGesture(e) {
      if (e && e.target && btn.contains(e.target)) return; // button handles itself
      removeGestures();
      if (!userOff) play();
    }
    function removeGestures() {
      gestures.forEach(function (g) { document.removeEventListener(g, onFirstGesture, true); });
    }
    function armGestures() {
      gestures.forEach(function (g) { document.addEventListener(g, onFirstGesture, true); });
    }

    btn.addEventListener('click', function () {
      removeGestures();
      if (audio.paused) {
        userOff = false;
        try { localStorage.removeItem(KEY); } catch (e) {}
        play();
      } else {
        userOff = true;
        try { localStorage.setItem(KEY, 'off'); } catch (e) {}
        stop();
      }
    });

    setState(false);
    if (userOff) return;

    // Autoplay attempt; if the browser refuses, wait for a gesture.
    play().then(function (ok) { if (!ok) armGestures(); });
  }

  renderGreeting();
  renderCountdown();
  setupCalendar();
  setupMusic();
})();
