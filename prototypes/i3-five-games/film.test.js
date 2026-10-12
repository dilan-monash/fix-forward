import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { mountFilm } from './film.js';
import { publicAssets } from './serve.mjs';

const html = await readFile(new URL('./film.html', import.meta.url), 'utf8');
const film = JSON.parse(await readFile(new URL('../i3-family-landing/assets/product-film.json', import.meta.url), 'utf8'));
function player(t) {
  const dom = new JSDOM(html, { url: 'https://fix-forward-iteration-3-r4sh.onrender.com/film.html' });
  t.after(() => dom.window.close());
  const doc = dom.window.document, video = doc.querySelector('video');
  let plays = 0, pauses = 0;
  video.play = () => { plays++; video.dispatchEvent(new dom.window.Event('play')); return Promise.resolve(); };
  video.pause = () => { pauses++; video.dispatchEvent(new dom.window.Event('pause')); };
  return { dom, doc, video, plays: () => plays, pauses: () => pauses };
}

test('standalone film uses only a same-origin external script and named public media', () => {
  const dom = new JSDOM(html), doc = dom.window.document;
  try {
    const scripts = [...doc.querySelectorAll('script')];
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].textContent.trim(), '');
    assert.equal(scripts[0].getAttribute('src'), '/prototypes/i3-five-games/film.js');
    for (const element of doc.querySelectorAll('*')) {
      assert.ok(![...element.attributes].some(attribute => /^on/i.test(attribute.name)), 'no inline event handlers');
    }
    for (const element of doc.querySelectorAll('script[src],source[src],track[src],video[poster]')) {
      assert.ok(publicAssets.has(element.getAttribute('src') || element.getAttribute('poster')));
    }
    assert.ok(publicAssets.has('/prototypes/i3-five-games/film.html'));
    assert.equal(doc.querySelector('source').getAttribute('type'), 'video/mp4');
  } finally { dom.window.close(); }
});

test('external player renders chapters and captions context; only user actions start sound', async t => {
  const p = player(t);
  const mounted = mountFilm(p.doc, { fetcher: async () => ({ ok: true, json: async () => film }) });
  await mounted.ready;
  assert.equal(p.plays(), 0);
  assert.match(p.doc.querySelector('#film-meta').textContent, /1:57.*Captions/);
  assert.equal(p.doc.querySelectorAll('#chapters button').length, film.scenes.length);
  assert.equal(p.doc.querySelectorAll('#transcript h3').length, film.scenes.length);
  p.doc.querySelectorAll('#chapters button')[2].click();
  assert.equal(p.video.currentTime, film.scenes[2].start);
  assert.equal(p.plays(), 1);
  assert.match(p.doc.querySelector('#play-film').textContent, /Pause/);
  p.video.dispatchEvent(new p.dom.window.Event('timeupdate'));
  assert.equal(p.doc.querySelector('#chapters [aria-current]').textContent.includes(film.scenes[2].title), true);
  p.dom.window.dispatchEvent(new p.dom.window.Event('pagehide'));
  assert.equal(p.pauses(), 1);
  p.doc.querySelector('#play-film').click();
  assert.equal(p.plays(), 2, 'controls survive a back/forward-cache return');
  mounted.dispose();
  p.doc.querySelector('#play-film').click();
  assert.equal(p.plays(), 2, 'disposed controls cannot restart audio');
});

test('metadata failure keeps native controls and leaving cancels late chapters', async t => {
  const p = player(t);
  const failed = mountFilm(p.doc, { fetcher: async () => ({ ok: false }) });
  await failed.ready;
  assert.match(p.doc.querySelector('#chapters').textContent, /video controls/);
  assert.equal(p.video.hasAttribute('controls'), true);
  failed.dispose();
  let resolve;
  const pending = mountFilm(p.doc, { fetcher: () => new Promise(done => { resolve = done; }) });
  pending.dispose();
  resolve({ ok: true, json: async () => film });
  await pending.ready;
  assert.equal(p.doc.querySelectorAll('#chapters button').length, 0);
});
