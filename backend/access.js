/* Standalone, progressively enhanced login controls. Passwords stay only in the
   existing form field: this file never stores, logs, transmits or changes them. */
(() => {
  const form = document.getElementById('access-login-form');
  const password = document.getElementById('website-password');
  const toggle = document.getElementById('password-toggle');
  const capsStatus = document.getElementById('caps-lock-status');
  if (!form || !password || !toggle || !capsStatus) return;

  const pendingMessage = 'Caps Lock: press a letter key to check.';
  const unsupportedMessage = 'This keyboard has not reported Caps Lock. Use Show password to check your typing.';
  let restorePasswordFocus = false;
  let touchKeyboard = false;

  // Change the live region only when the state changes, avoiding repeated
  // screen-reader announcements for every character in the password.
  function showCapsState(state, message) {
    if (capsStatus.dataset.state === state && capsStatus.textContent === message) return;
    capsStatus.dataset.state = state;
    capsStatus.textContent = message;
  }

  // Revealing changes the input type, not its value or autocomplete behaviour.
  // Preserve a selected range/caret when the browser supports it for this field.
  function setPasswordVisible(visible) {
    const start = password.selectionStart;
    const end = password.selectionEnd;
    const direction = password.selectionDirection;
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide password' : 'Show password';
    toggle.setAttribute('aria-pressed', String(visible));
    if (start !== null && end !== null) {
      try { password.setSelectionRange(start, end, direction || 'none'); }
      catch { /* Some mobile browsers do not expose a selectable password caret. */ }
    }
  }

  // Only a real keyboard event can report the modifier. Never guess Caps Lock
  // from uppercase letters: Shift, pasted text and touch keyboards can differ.
  function checkCapsLock(event) {
    if (event.isComposing || event.key === 'Unidentified' || event.key === 'Process'
      || !event.key || typeof event.getModifierState !== 'function') {
      showCapsState('unsupported', unsupportedMessage);
      return;
    }
    try {
      const enabled = event.getModifierState('CapsLock');
      if (typeof enabled !== 'boolean') {
        showCapsState('unsupported', unsupportedMessage);
        return;
      }
      // Some on-screen keyboards return false for every modifier and leave the
      // physical key code empty. That is not enough evidence to claim "off".
      if (touchKeyboard && !event.code && !enabled) {
        showCapsState('unsupported', unsupportedMessage);
        return;
      }
      if (event.code) touchKeyboard = false;
      showCapsState(enabled ? 'on' : 'off', enabled
        ? 'Caps Lock is on. Your keyboard may type CAPITAL letters.'
        : 'Caps Lock is off.');
    } catch {
      showCapsState('unsupported', unsupportedMessage);
    }
  }

  // Leaving the tab masks the field and invalidates old keyboard information:
  // Caps Lock may have changed while the visitor was in another application.
  function resetPrivateControls() {
    setPasswordVisible(false);
    restorePasswordFocus = false;
    showCapsState('unknown', pendingMessage);
  }

  // Remember pointer focus so a touch on Show does not unnecessarily dismiss
  // an already-open keyboard. Keyboard users retain focus on the toggle itself.
  toggle.addEventListener('pointerdown', () => {
    restorePasswordFocus = document.activeElement === password;
  });
  toggle.addEventListener('click', () => {
    setPasswordVisible(password.type === 'password');
    if (restorePasswordFocus) password.focus({ preventScroll: true });
    restorePasswordFocus = false;
  });
  password.addEventListener('keydown', checkCapsLock);
  password.addEventListener('keyup', checkCapsLock);
  password.addEventListener('pointerdown', (event) => {
    // A touch event contains no reliable Caps Lock state. Give a useful fallback
    // until a subsequent keyboard event supplies actual modifier information.
    touchKeyboard = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (touchKeyboard) showCapsState('unsupported', unsupportedMessage);
  });
  form.addEventListener('submit', () => setPasswordVisible(false));
  window.addEventListener('blur', resetPrivateControls);
  window.addEventListener('focus', () => showCapsState('unknown', pendingMessage));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetPrivateControls();
  });

  // Show enhancements only after handlers are ready. Native form validation,
  // autofill and the server's existing CSRF/password checks remain unchanged.
  password.setAttribute('aria-describedby', `${password.getAttribute('aria-describedby') || ''} caps-lock-status`.trim());
  toggle.hidden = false;
  capsStatus.hidden = false;
})();
