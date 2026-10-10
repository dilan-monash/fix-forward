/** Loopback review server, deliberately separate from Flask/Neon/deployment.
 * Run `node prototypes/i3-world-preview/serve.mjs`, then open localhost:5533.
 * Only this preview, its reused game, and public frontend adapters are exposed. */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const prefix='/prototypes/i3-world-preview/';
const port=Number(process.env.FF_WORLD_PORT||5533);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('FF_WORLD_PORT must be 1024–65535.');
const compressed=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.f32':'application/octet-stream','.onnx':'application/octet-stream','.wasm':'application/wasm'};

// Explore has its own labels and policy. Only the immutable image encoder and
// runtime are reused with Take action; neither recognition policy edits the other.
// Exact filenames keep raw research photos, scripts and model experiments private.
const photoAssets = new Set([
  '/src/photo-helper.css', '/src/explore-photo-helper.css',
  '/model/appliance-siglip/model_manifest.json',
  '/model/appliance-siglip/text-embeddings.json',
  '/model/appliance-siglip/text-embeddings.f32',
  '/model/explore-siglip/model_manifest.json',
  '/model/explore-siglip/text-embeddings.json',
  '/model/explore-siglip/text-embeddings.f32',
  '/vendor/transformers/transformers.min.js',
  '/vendor/transformers/ort-wasm-simd-threaded.jsep.mjs',
  '/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm',
  '/model/appliance-siglip/upstream/siglip2-base-patch32-256/config.json',
  '/model/appliance-siglip/upstream/siglip2-base-patch32-256/preprocessor_config.json',
  '/model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx',
]);

// An allow-list prevents a development server accidentally exposing environment
// files, the Git directory, training photos or other files beside the project.
function allowed(urlPath) {
  return /^\/prototypes\/i3-world-preview\/[\w-]+\.(html|js|css)$/.test(urlPath)
    || /^\/prototypes\/i3-world-preview\/vendor\/(?:three\.(?:core|module)|OrbitControls)\.js$/.test(urlPath)
    || /^\/prototypes\/i3-family-preview\/sorting\.(js|css)$/.test(urlPath)
    || /^\/src\/[\w-]+\.js$/.test(urlPath)
    || urlPath==='/favicon.svg'
    || photoAssets.has(urlPath);
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Permissions-Policy','xr-spatial-tracking=(self)');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
    let requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(requested==='/'){res.writeHead(302,{Location:prefix});res.end();return;}
    if(requested.startsWith('/api/')){
      // Preserve the existing adapter's unavailable state; [] would falsely
      // imply a successful search with no recalls or no providers.
      res.writeHead(503,{'Content-Type':'application/json'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify({error:{code:'preview_data_unavailable',message:'Live records are not connected in this local review.'}}));return;
    }
    // Explicit opt-in development harness. Its generated fixture contains only
    // reviewed public sample photos; it never exposes the dataset or arbitrary
    // local paths. These URLs are not part of Flask's production asset allowlist.
    if(process.env.FF_EXPLORE_TEST_MODE==='1' && requested.startsWith('/__explore-test/')){
      const fixtureFiles = {
        '/__explore-test/': ['test_helpers/explore-ai-smoke.html', 'text/html; charset=utf-8'],
        '/__explore-test/runner.js': ['test_helpers/explore-ai-smoke.js', 'text/javascript; charset=utf-8'],
        '/__explore-test/samples.json': ['tmp/explore-ai32/browser-samples.json', 'application/json'],
      };
      const entry=fixtureFiles[requested];
      if(!entry){res.writeHead(404);res.end();return;}
      const body=await readFile(path.join(root,entry[0]));
      res.writeHead(200,{'Content-Type':entry[1],'Content-Length':body.length});
      res.end(req.method==='HEAD'?undefined:body);return;
    }
    if(requested===prefix)requested+='index.html';
    if(!allowed(requested)){res.writeHead(404);res.end();return;}
    const file=path.resolve(root,'.'+requested);
    if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    const info=await stat(file);
    // Local Three.js is compressed and browser-cached; first paint does not wait
    // for a CDN or model download. Authored files stay uncached while reviewing.
    const isVendor=requested.includes('/vendor/');
    // Compress text, not already-large model binaries. This avoids a second
    // in-memory copy and a long synchronous compression step at first inference.
    const shouldGzip=/\bgzip\b/.test(req.headers['accept-encoding']||'') && /\.(?:html|js|mjs|css|svg|json)$/.test(file);
    let body;
    if(shouldGzip){const key=file+':'+info.mtimeMs;body=compressed.get(key);if(!body){body=gzipSync(await readFile(file));compressed.set(key,body);}res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');}
    else body=await readFile(file);
    if(isVendor)res.setHeader('Cache-Control','public, max-age=86400, immutable');
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Length':body.length});
    res.end(req.method==='HEAD'?undefined:body);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`FixForward 3D world preview: http://localhost:${port}${prefix}`));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'This preview port is already in use. Reuse the running preview or set FF_WORLD_PORT.':'Preview server could not start.');process.exitCode=1;});
