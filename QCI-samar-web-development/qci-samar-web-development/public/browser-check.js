/*
 * Runs before the app bundle (classic script, so even very old browsers run it).
 * The bundle targets Chrome/Edge 107+, Firefox 104+ and Safari 15.4+; on anything
 * older it fails to parse and the loading screen would spin forever. Show a clear
 * message instead.
 */
(function () {
  var supported = false;
  try {
    supported =
      'noModule' in HTMLScriptElement.prototype &&
      typeof structuredClone === 'function' &&
      typeof Object.hasOwn === 'function' &&
      typeof Array.prototype.findLast === 'function' &&
      !!(window.CSS && CSS.supports && CSS.supports('height', '1dvh'));
  } catch (_unsupported) {
    supported = false;
  }
  if (supported) {
    return;
  }
  window.__SAMAR_UNSUPPORTED_BROWSER__ = true;
  var show = function () {
    var loader = document.getElementById('app-loader');
    if (!loader) {
      return;
    }
    loader.innerHTML =
      '<img src="/samarLogo.webp" alt="SAMAR" style="width:120px;height:auto" />' +
      '<div style="max-width:420px;padding:0 24px;text-align:center;font-family:Arial,sans-serif;color:#252f4a">' +
      '<p style="font-size:18px;font-weight:bold;margin:0 0 8px">Please update your browser</p>' +
      '<p style="font-size:15px;line-height:1.5;margin:0">The SAMAR portal needs a recent version of Chrome, Edge, Firefox or Safari ' +
      '(Chrome/Edge 107+, Firefox 104+, Safari 15.4+ / iOS 15.4+). Please update your browser or open the portal in another one.</p>' +
      '</div>';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
