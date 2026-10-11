import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createSound} from './reference/fixit-sound.js';
import {mountFixit} from './reference/fixit.js';
test('integrated Fix-it remains silent even if another preview remembered sound on',()=>{let contexts=0,vibrations=0;const win={AudioContext:class{constructor(){contexts++;}},navigator:{vibrate(){vibrations++;}}};const sound=createSound(win,{storage:{getItem:()=> 'on',setItem(){}},silent:true});sound.unlock();sound.setEnabled(true);sound.setMusic(true);sound.music(true);sound.play('win');assert.equal(contexts,0);assert.equal(sound.enabled,false);assert.equal(sound.musicOn,false);sound.buzz(20);assert.equal(vibrations,1);sound.dispose();});
test('parent portal can open the original Fix-it learning record directly',()=>{const dom=new JSDOM('<div id="host"></div>',{url:'http://localhost'});dom.window.matchMedia=()=>({matches:true});const host=dom.window.document.querySelector('#host');const cleanup=mountFixit(host,{initialView:'parents',storage:dom.window.localStorage,reducedMotion:true});assert.match(host.textContent,/What your child sorted/);assert.match(host.textContent,/Nothing recorded yet/);assert.equal(host.querySelector('canvas'),null);cleanup();dom.window.close();});
