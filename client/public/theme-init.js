// Runs before the app draws, so a saved light/dark choice shows from the first frame.
(function () {
  try {
    var t = localStorage.getItem('pocketless-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      var c = t === 'dark' ? '#1A1320' : '#43144F';
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i += 1) metas[i].setAttribute('content', c);
    }
  } catch {
    // Storage blocked: follow the phone.
  }
})();
