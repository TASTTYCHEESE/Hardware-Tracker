// Startup safety net: if the app hasn't drawn anything a few seconds after an error (or after
// 15 seconds at all), show what went wrong and a Reload button instead of an empty screen.
(function () {
  var errors = [];
  function show() {
    var root = document.getElementById('root');
    if (!root || root.childElementCount > 0 || document.getElementById('boot-fail')) return;
    var box = document.createElement('div');
    box.id = 'boot-fail';
    box.setAttribute('style', 'font:15px/1.5 system-ui,sans-serif;color:#e6ebf1;padding:24px;max-width:560px;margin:10vh auto');
    var h = document.createElement('h2');
    h.textContent = "Hardware Tracker couldn't start";
    var p = document.createElement('p');
    p.textContent = 'Reload usually fixes it. If it keeps happening, send a screenshot of this screen.';
    var pre = document.createElement('pre');
    pre.setAttribute('style', 'white-space:pre-wrap;font-size:12px;color:#8a96a5;background:#151a21;padding:12px;border-radius:8px');
    pre.textContent = (errors.join('\n') || 'The app took too long to start.') + '\n' + navigator.userAgent;
    var b = document.createElement('button');
    b.textContent = 'Reload';
    b.setAttribute('style', 'font:inherit;padding:10px 18px;border-radius:8px;border:0;background:#5aa9ff;color:#0e1116;margin-right:8px');
    b.onclick = function () { location.reload(); };
    var c = document.createElement('button');
    c.textContent = 'Reset saved data and reload';
    c.setAttribute('style', 'font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #262f3a;background:none;color:#e6ebf1');
    c.onclick = function () {
      try { localStorage.removeItem('hwt-settings'); localStorage.removeItem('hwt-lang'); } catch (e) {}
      try { if (window.caches) caches.keys().then(function (k) { k.forEach(function (n) { caches.delete(n); }); }); } catch (e) {}
      setTimeout(function () { location.reload(); }, 300);
    };
    box.appendChild(h); box.appendChild(p); box.appendChild(pre); box.appendChild(b); box.appendChild(c);
    document.body.appendChild(box);
  }
  window.addEventListener('error', function (e) {
    errors.push(String((e && e.message) || 'Script error') + (e && e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : ''));
    setTimeout(show, 3000);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    errors.push('Unhandled: ' + String((r && r.message) || r));
  });
  window.__hwtBootFail = function (msg) { errors.push(msg); show(); };
  setTimeout(show, 15000);
})();
