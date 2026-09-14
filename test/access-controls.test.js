// Run the standalone login enhancement with invented input in an isolated DOM.
// Flask tests check the actual template and gate; these tests exercise browser
// interactions without a live password, network request or database connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await readFile(new URL('../backend/access.js', import.meta.url), 'utf8');

// The form mirrors only the public controls' IDs. No production secret is used.
function loginPage(t, html = `<form id="access-login-form">
  <label for="website-password">Website password</label>
  <input id="website-password" name="password" type="password" required autocomplete="current-password">
  <button id="password-toggle" type="button" aria-controls="website-password" aria-pressed="false" hidden>Show password</button>
  <p id="caps-lock-status" role="status" aria-live="polite" data-state="unknown" hidden></p>
  <button type="submit">Open FixForward</button>
</form>`) {
  const dom = new JSDOM(html, { url: 'https://fixforward.test/login', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  dom.window.eval(source);
  const { document } = dom.window;
  return { window: dom.window, document, input: document.querySelector('#website-password'),
    toggle: document.querySelector('#password-toggle'), status: document.querySelector('#caps-lock-status'),
    form: document.querySelector('#access-login-form') };
}

// A controlled keyboard event reports the actual modifier API result. Letter
// case is deliberately independent: Shift can produce capitals with Caps Lock off.
function reportCaps(page, caps, { type = 'keyup', key = 'a', code = 'KeyA', unsupported = false } = {}) {
  const event = new page.window.KeyboardEvent(type, { key, code, bubbles: true });
  Object.defineProperty(event, 'getModifierState', { value: unsupported ? undefined : name => name === 'CapsLock' && caps });
  page.input.dispatchEvent(event);
}

test('login: password starts masked and Caps Lock is unknown until keyboard evidence', t => {
  const page = loginPage(t);
  assert.equal(page.input.type, 'password');
  assert.equal(page.toggle.hidden, false);
  assert.equal(page.toggle.type, 'button');
  assert.equal(page.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(page.status.dataset.state, 'unknown');
  assert.doesNotMatch(page.status.textContent, /Caps Lock\s*(?:is|:)\s*off/i);
  assert.notEqual(page.document.activeElement, page.input, 'Loading must not automatically open a tablet keyboard');
});

test('login: Show and Hide retain the exact password and never submit the form', t => {
  const page = loginPage(t);
  const invented = '  AbC-Test!  ';
  page.input.value = invented;
  page.input.focus();
  page.input.setSelectionRange(2, 5);
  let submissions = 0;
  page.form.addEventListener('submit', event => { event.preventDefault(); submissions += 1; });
  page.toggle.click();
  assert.equal(page.input.type, 'text');
  assert.equal(page.input.value, invented);
  assert.equal(page.input.selectionStart, 2);
  assert.equal(page.input.selectionEnd, 5);
  assert.equal(page.toggle.getAttribute('aria-pressed'), 'true');
  assert.match(page.toggle.textContent, /Hide password/i);
  page.toggle.click();
  assert.equal(page.input.type, 'password');
  assert.equal(page.input.value, invented);
  assert.equal(page.toggle.getAttribute('aria-pressed'), 'false');
  assert.match(page.toggle.textContent, /Show password/i);
  assert.equal(submissions, 0);
  assert.equal(page.window.localStorage.length, 0);
  assert.equal(page.window.sessionStorage.length, 0);
});

test('login: Caps Lock reports both states and does not mistake Shift capitals for Caps Lock', t => {
  const page = loginPage(t);
  reportCaps(page, true);
  assert.equal(page.status.dataset.state, 'on');
  assert.match(page.status.textContent, /Caps Lock.*on/i);
  reportCaps(page, false, { key: 'A' });
  assert.equal(page.status.dataset.state, 'off');
  assert.match(page.status.textContent, /Caps Lock.*off/i);
  reportCaps(page, true, { type: 'keydown' });
  assert.equal(page.status.dataset.state, 'on');
});

test('login: leaving the window hides the password and invalidates stale Caps Lock state', t => {
  const page = loginPage(t);
  page.input.value = 'invented-value';
  reportCaps(page, true);
  page.toggle.click();
  page.window.dispatchEvent(new page.window.Event('blur'));
  assert.equal(page.input.type, 'password');
  assert.equal(page.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(page.status.dataset.state, 'unknown');
  assert.equal(page.input.value, 'invented-value');
  page.window.dispatchEvent(new page.window.Event('focus'));
  assert.equal(page.status.dataset.state, 'unknown');
  reportCaps(page, false);
  assert.equal(page.status.dataset.state, 'off');
});

test('login: submit masks visible text while preserving the exact value for normal authentication', t => {
  const page = loginPage(t);
  page.input.value = '  Exact Test Value  ';
  page.toggle.click();
  page.form.addEventListener('submit', event => event.preventDefault());
  page.form.dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(page.input.type, 'password');
  assert.equal(page.input.value, '  Exact Test Value  ');
  assert.equal(new page.window.FormData(page.form).get('password'), '  Exact Test Value  ');
});

test('login: unavailable modifier detection never falsely reports Caps Lock off', t => {
  const page = loginPage(t);
  reportCaps(page, false, { unsupported: true });
  assert.ok(['unknown', 'unsupported'].includes(page.status.dataset.state));
  assert.doesNotMatch(page.status.textContent, /Caps Lock\s*(?:is|:)\s*off/i);
  page.toggle.click();
  assert.equal(page.input.type, 'text', 'Visibility remains usable on unsupported keyboards');
});

test('login: pages without the login form tolerate the helper without creating controls', t => {
  const page = loginPage(t, '<main><h1>Website unavailable</h1></main>');
  assert.equal(page.document.querySelector('input'), null);
  assert.equal(page.document.querySelector('button'), null);
});

test('login: touch typing without physical modifier evidence does not claim Caps Lock is off', t => {
  const page = loginPage(t);
  const touch = new page.window.Event('pointerdown', { bubbles: true });
  Object.defineProperty(touch, 'pointerType', { value: 'touch' });
  page.input.dispatchEvent(touch);
  reportCaps(page, false, { code: '' });
  assert.equal(page.status.dataset.state, 'unsupported');
  reportCaps(page, false, { code: 'KeyA' });
  assert.equal(page.status.dataset.state, 'off', 'An attached physical keyboard can resume reporting');
});
