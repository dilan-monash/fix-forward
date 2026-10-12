/** Loopback-only combined review on 5537. Serve named public assets in place:
 * no credentials, model copies, database connection or deployment side effects. */
import http from 'node:http';
import {createReadStream,existsSync} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const own='/prototypes/i3-five-games/',family='/prototypes/i3-family-landing/';
// The original design checkout reuses its reviewed worktree. A clean release
// clone already contains those sources and model assets at the repository root.
const reviewed=existsSync(path.resolve(root,'tmp/i3-learn-release'))?'tmp/i3-learn-release':'.';
export const publicAssets=new Map();
const expose=(url,file=url.slice(1))=>publicAssets.set(url,path.resolve(root,file));
for(const name of ['index.html','app.js','routes.js','result-reveal.js','film.html','film.js','decide.js','decide.css','site-theme.css','shell.css','landing.js','landing.css','activities.js','activities.css','tutorial-art.js','choices.js','choices-engine.js','choices.css','scrapworks.js','scrapworks.css','scrapworks-art.js','explore.js','explore.css','explore-icons.js'])expose(own+name);
for(const name of ['world.css','explore.js','explore.css','catalogue.js','catalogue-expanded.js','catalogue-part-context.js','models.js','models-expanded-devices.js','models-expanded-large.js','world-engine.js','action.js','action.css','progress.js','fixit.js','fixit.css','fixit-3d.js','fixit-engine.js','fixit-party.js','fixit-sound.js','waste-models.js','scrapworks-engine.js'])expose(own+'reference/'+name);
for(const name of ['photo-helper.js','photo-helper.css','explore-catalogue.js','explore-photo-helper.js','explore-photo-helper.css','explore-classifier.js','siglip-appliance-classifier.js','appliance-classifier.js','appliance-review-policy.js'])expose(own+'support/'+name);
for(const name of ['three.core.js','three.module.js','OrbitControls.js'])expose(own+'reference/vendor/'+name,'prototypes/i3-world-preview/vendor/'+name);
for(const name of ['playroom.js','playroom.css','playroom-engine.js','playroom-materials.js','playroom-materials.css','playroom-care.js','playroom-care.css','playroom-parent.js','playroom-parent.css','clue-lab-world.js'])expose(family+name);
for(const name of ['pip.svg','manrope-latin.woff2','product-film-poster.svg','fixforward-product-film.mp4','fixforward-product-film.vtt','product-film-transcript.txt','product-film.json'])expose(family+'assets/'+name);
// Adult helpers are the exact reviewed I3 versions. Their operational endpoints
// return an explicit unavailable response here, rather than fake empty records.
for(const name of ['data-service.js','data.js','config.js','logic.js','learning.js','icons.js','price-catalogue.js','price-snapshot.js','product-suggestions.js','suburb-index.js','photo-helper.js','photo-helper.css','appliance-classifier.js','siglip-appliance-classifier.js','appliance-review-policy.js'])expose('/src/'+name,reviewed+'/src/'+name);
for(const name of [
  'model/explore-siglip/model_manifest.json','model/explore-siglip/text-embeddings.json','model/explore-siglip/text-embeddings.f32',
  'model/appliance-siglip/model_manifest.json','model/appliance-siglip/text-embeddings.json','model/appliance-siglip/text-embeddings.f32','model/appliance-siglip/upstream/siglip2-base-patch32-256/config.json','model/appliance-siglip/upstream/siglip2-base-patch32-256/preprocessor_config.json',
  'model/appliance-siglip/upstream/siglip2-base-patch32-256/onnx/vision_model.9e82237d9a1d89948502aff9df02129c28698d793e01f15f62e2267682615499_q4.onnx',
  'vendor/transformers/transformers.min.js','vendor/transformers/ort-wasm-simd-threaded.jsep.mjs','vendor/transformers/ort-wasm-simd-threaded.jsep.wasm',
])expose('/'+name,reviewed+'/'+name);
for(const name of ['favicon.svg','404.html','404.css'])expose('/'+name);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.f32':'application/octet-stream'};
export function parseRange(header,size){const m=/^bytes=(\d*)-(\d*)$/.exec(String(header));if(!m||(!m[1]&&!m[2]))return null;let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start<0||start>=size||!m[1]&&Number(m[2])===0)return null;return{start,end};}
export function createFiveGamesServer(){return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-FixForward-Data-Mode','LOCAL-REVIEW-NO-DATABASE');res.setHeader('Permissions-Policy','camera=(self), microphone=(), geolocation=(self), xr-spatial-tracking=()');
  // Preview missing URLs with the same static 404 document as the Flask service.
  const notFound=()=>{res.writeHead(404,{'Content-Type':types['.html']});if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(path.join(root,'404.html'));stream.on('error',()=>res.destroy());stream.pipe(res);};
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    const hostname=new URL('http://'+req.headers.host).hostname;if(!['127.0.0.1','localhost','[::1]'].includes(hostname)){res.writeHead(403);res.end();return;}
    const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
    if(['/','/index.html',own,own.slice(0,-1)].includes(name))name=own+'index.html';if(name==='/film.html')name=own+'film.html';
    if(name.startsWith('/api/')){res.writeHead(503,{'Content-Type':types['.json']});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:{code:'preview_data_unavailable',message:'Live records are not connected in this local review.'}}));return;}
    const file=publicAssets.get(name);if(!file||!file.startsWith(root+path.sep)||await realpath(file)!==file){notFound();return;}
    const info=await stat(file);if(!info.isFile()){notFound();return;}
    let range=null;if(req.headers.range){range=parseRange(req.headers.range,info.size);if(!range){res.writeHead(416,{'Content-Range':'bytes */'+info.size});res.end();return;}}
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':range?range.end-range.start+1:info.size,'Accept-Ranges':'bytes'};if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
    res.writeHead(range?206:200,headers);if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(file,range||{});stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{if(!res.headersSent)notFound();else res.end();}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=createFiveGamesServer();server.listen(5537,'127.0.0.1',()=>console.log('FixForward five-game review: http://127.0.0.1:5537/'));}
