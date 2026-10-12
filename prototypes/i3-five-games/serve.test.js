import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createFiveGamesServer,publicAssets,parseRange} from './serve.mjs';
test('every allowlisted asset exists; public and shared learning imports resolve', async () => {
  for (const [url, file] of publicAssets) {
    assert.ok((await stat(file)).isFile(), url);
    // Shared boards are shipped dependencies, so audit their imports too.
    if (!url.startsWith('/prototypes/') || !file.endsWith('.js')) continue;
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
      const target = match[1];
      if (!target.startsWith('.')) continue;
      const resolved = new URL(target, 'http://localhost' + url).pathname;
      assert.ok(publicAssets.has(resolved), url + ' imports ' + resolved);
    }
  }
});
test('loopback server serves entry, typed modules, unchanged enabled policy, and byte ranges',async t=>{const server=createFiveGamesServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;let response=await fetch(base+'/');assert.equal(response.status,200);assert.match(await response.text(),/i3-five-games\/app.js/);assert.match(response.headers.get('permissions-policy'),/camera=\(self\)/);response=await fetch(base+'/prototypes/i3-five-games/scrapworks-art.js');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);response=await fetch(base+'/model/explore-siglip/model_manifest.json');assert.equal((await response.json()).recognition_enabled,true);response=await fetch(base+'/film.html');assert.equal(response.status,200);response=await fetch(base+'/prototypes/i3-family-landing/assets/fixforward-product-film.mp4',{headers:{Range:'bytes=0-99'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,100);});
test('private files, traversal and writes are refused; data is explicitly unavailable',async t=>{const server=createFiveGamesServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;for(const route of ['/.env','/.git/config','/README.md','/prototypes/i3-five-games/serve.mjs','/prototypes/i3-five-games/choices.test.js','/%2e%2e/.env'])assert.equal((await fetch(base+route)).status,404,route);assert.equal((await fetch(base+'/',{method:'POST'})).status,405);const forbidden=await new Promise((resolve,reject)=>{http.get(base+'/',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(forbidden,403);const response=await fetch(base+'/api/recalls');assert.equal(response.status,503);assert.equal((await response.json()).error.code,'preview_data_unavailable');});
test('seek ranges reject malformed and out-of-file positions',()=>{assert.deepEqual(parseRange('bytes=10-20',100),{start:10,end:20});assert.deepEqual(parseRange('bytes=-10',100),{start:90,end:99});assert.deepEqual(parseRange('bytes=90-',100),{start:90,end:99});for(const range of ['bytes=100-','bytes=-0','bytes=20-10','bytes=1-2,3-4','bytes=-','other'])assert.equal(parseRange(range,100),null);});

test('retired URLs show the real 404 page locally without changing the address', async t => {
  const server=createFiveGamesServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['/legacy','/legacy/','/quest','/quest/index.html?view=parents']){
    const response=await fetch(base+route,{redirect:'manual'});
    assert.equal(response.status,404);assert.equal(response.headers.get('location'),null);
    const html=await response.text();assert.match(html,/Page not found/);assert.match(html,/href="\/404.css"/);
    assert.doesNotMatch(html,/<script|id="preview-app"/);
  }
  const stylesheet=await fetch(base+'/404.css');assert.equal(stylesheet.status,200);assert.match(stylesheet.headers.get('content-type'),/text\/css/);
});
