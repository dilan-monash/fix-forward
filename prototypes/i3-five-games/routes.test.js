import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {normaliseRoute} from './routes.js';

test('old action bookmarks reach Decide without losing appliance or pathway context',()=>{
  assert.equal(normaliseRoute('#action?appliance=kettle&kind=repair'),'decide?appliance=kettle&kind=repair');
  assert.equal(normaliseRoute('#/act?appliance=hairdryer&kind=recycle'),'decide?appliance=hairdryer&kind=recycle');
  for(const route of ['home','decide','explore?view=world','learn?game=fix-it','parents?view=choices']) assert.equal(normaliseRoute('#'+route),route);
  assert.equal(normaliseRoute(''),'home');
});

test('navigation exposes the four destinations without the retired site motion toggle',async()=>{
  const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
  const dom=new JSDOM(html),doc=dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('#ff-nav a')].map(a=>[a.textContent,a.getAttribute('href')]),[['Home','#home'],['Learn together','#learn'],['Explore','#explore'],['Decide','#decide']]);
  assert.equal(doc.querySelector('[data-site-motion]'),null);
  const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/fixforward\.motion-paused/,'an old saved pause no longer disables normal animation');
  const theme=await readFile(new URL('./site-theme.css',import.meta.url),'utf8');
  assert.match(theme,/prefers-reduced-motion:reduce/);
  dom.window.close();
});
