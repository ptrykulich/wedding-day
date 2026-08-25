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
     A plain link to the .ics file gets *downloaded* on phones instead of
     opening the calendar, so the button offers explicit choices:
       Google  — the calendar template URL (opens the app on Android)
       Apple   — webcal://, which iOS / macOS hand straight to Calendar
       .ics    — plain download for Outlook and everything else
     --------------------------------------------------------------------- */
  function setupCalendar() {
    var toggle = document.getElementById('cal-toggle');
    var panel = document.getElementById('cal-options');
    var google = document.getElementById('cal-google');
    var apple = document.getElementById('cal-apple');
    if (!toggle || !panel) return;

    var title = encodeURIComponent('Весілля Павла та Лізи');
    var details = encodeURIComponent(
      '16:00 — Церемонія, Центральний РАГС\nhttps://maps.app.goo.gl/GhsCVwM5nMNz5PEAA\n\n' +
      '17:00 — Святкова вечеря, Elissa Bar&Restaurant\nhttps://maps.app.goo.gl/mZnmKt7e6aQjSAtSA'
    );
    var place = encodeURIComponent('Центральний РАГС');
    if (google) {
      google.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + title +
        '&dates=20260911T130000Z/20260911T210000Z' +
        '&details=' + details +
        '&location=' + place +
        '&ctz=Europe/Kyiv';
    }
    if (apple && window.location.host) {
      var dir = window.location.pathname.replace(/[^/]*$/, '');
      apple.href = 'webcal://' + window.location.host + dir + 'wedding.ics';
    }

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () { setOpen(panel.hidden); });
    document.addEventListener('click', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
  }

  /* ---------------------------------------------------------------------
     Background music — on by default
     Phones refuse to start audio before the visitor interacts with the
     page, so we try immediately AND keep listening for the first gesture
     until playback actually succeeds. Only an explicit "off" is remembered.
     --------------------------------------------------------------------- */
  function setupMusic() {
    var audio = document.getElementById('bg-music');
    var btn = document.getElementById('music-toggle');
    if (!audio || !btn) return;

    var KEY = 'wedding-music';
    var userOff = false;
    try { userOff = localStorage.getItem(KEY) === 'off'; } catch (e) {}

    var TARGET_VOL = 0.55;
    var fadeTimer = null;
    audio.volume = 0;
    btn.hidden = false;

    function setState(on) {
      btn.classList.toggle('music--on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Вимкнути музику' : 'Увімкнути музику');
    }

    function fadeIn() {
      clearInterval(fadeTimer);
      var v = audio.volume;
      fadeTimer = setInterval(function () {
        v = Math.min(TARGET_VOL, v + 0.05);
        audio.volume = v;              // iOS ignores volume — harmless
        if (v >= TARGET_VOL || audio.paused) clearInterval(fadeTimer);
      }, 100);
    }

    var GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'];
    var armed = false;
    function onGesture(e) {
      if (e && e.target && btn.contains(e.target)) return;  // button handles itself
      tryPlay();
    }
    function arm() {
      if (armed || userOff) return;
      armed = true;
      GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, true); });
    }
    function disarm() {
      if (!armed) return;
      armed = false;
      GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
    }

    function tryPlay() {
      var p = audio.play();
      if (!p || typeof p.then !== 'function') {
        var ok = !audio.paused;
        if (ok) { disarm(); setState(true); fadeIn(); }
        return Promise.resolve(ok);
      }
      return p.then(function () {
        disarm(); setState(true); fadeIn(); return true;
      }, function () {
        setState(false); arm(); return false;   // stay armed for the next gesture
      });
    }

    function stop() {
      clearInterval(fadeTimer);
      audio.pause();
      audio.volume = 0;
      setState(false);
    }

    btn.addEventListener('click', function () {
      if (audio.paused) {
        userOff = false;
        try { localStorage.removeItem(KEY); } catch (e) {}
        tryPlay();
      } else {
        userOff = true;
        disarm();
        try { localStorage.setItem(KEY, 'off'); } catch (e) {}
        stop();
      }
    });

    setState(false);
    if (userOff) return;

    arm();      // listen from the very first moment — no gap to miss a tap
    tryPlay();  // and still try to start on our own
  }

  renderGreeting();
  renderCountdown();
  setupCalendar();
  setupMusic();
})();
