// Запуск внутри Telegram как мини-приложения. В обычном браузере этот модуль ничего не делает.
(function () {
  'use strict';
  var inTg = /tgWebApp/.test(location.hash) || !!window.TelegramWebviewProxy;
  var api = window.TG51 = { active: inTg, user: null, ready: false, waiting: [],
    // вызвать fn(user), когда Telegram сообщит, кто открыл игру (или сразу, если уже сообщил)
    onUser: function (fn) { if (api.ready) fn(api.user); else api.waiting.push(fn); } };
  if (!inTg) return;
  document.documentElement.classList.add('tg');
  var s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = function () {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    var safe = function (name) { try { if (typeof tg[name] === 'function') tg[name].apply(tg, [].slice.call(arguments, 1)); } catch (e) { /* старая версия Telegram */ } };
    safe('ready');
    safe('expand');                       // на всю высоту окна
    safe('disableVerticalSwipes');        // жест «потянуть вниз» не закрывает игру и не мешает тянуть карты
    safe('enableClosingConfirmation');    // спросить перед закрытием, чтобы не потерять ход случайно
    safe('setHeaderColor', '#0f2a24');
    safe('setBackgroundColor', '#0f2a24');
    safe('setBottomBarColor', '#0f2a24');
    api.user = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
    api.ready = true;
    api.waiting.splice(0).forEach(function (fn) { try { fn(api.user); } catch (e) { /* не мешаем игре */ } });
  };
  document.head.appendChild(s);
})();
