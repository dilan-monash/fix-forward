/**
 * TEST ONLY: localhost browser usability fixture server.
 *
 * Start: node test_helpers/serve-usability.mjs
 * Open:  http://127.0.0.1:5502/quest and http://127.0.0.1:5502/
 *
 * Serves the current frontend with conspicuous synthetic-data labels. Public
 * API responses are invented fixtures held in memory. It does not load .env,
 * connect to a database, import production backend code, or save user data.
 * This helper is deliberately outside test/ and is not a *.test.js file.
 * Never deploy this server or treat its output as database-connection evidence.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve files from this checkout, not whichever folder the terminal happens to use.
const workspace = fileURLToPath(new URL("../", import.meta.url));
const hostname = "127.0.0.1";
const port = Number(process.env.PORT || 5502);
const marker = "SYNTHETIC USABILITY TEST DATA";
const meta = Object.freeze({
  releaseVersion: marker,
  dataVersion: "test-only-fixtures-v1",
  retrievalDate: "2026-09-11",
  limitation: "Invented fixtures for local interface testing only. No real safety, repair or service claims.",
  synthetic: true
});
const fixtureInfo = `http://${hostname}:${port}/test-fixture-info`;

// Synthetic datasets match the API response shapes so the adult interface can be reviewed offline from Neon.
const recalls = [{
  id: "SYNTHETIC-RECALL-ONLY",
  categoryCodes: ["kettle"],
  brand: "Test Brand",
  productName: "SYNTHETIC TEST kettle — not a real recalled product",
  title: "SYNTHETIC TEST recall — for interface testing only",
  identifiers: [{ type: "model", value: "FF-TEST-42", normalizedValue: "FFTEST42" }],
  noticeUrl: "https://www.productsafety.gov.au/recalls",
  limitation: marker
}];

const evidence = [{
  categoryCode: "kettle",
  sampleSize: 100,
  fixedCount: 60,
  repairableCount: 25,
  endOfLifeCount: 15,
  unclassifiedCount: 0,
  geography: "AU",
  limitation: "SYNTHETIC TEST counts: 60 fixed, 25 repairable, 15 other. Not actual Open Repair Alliance records."
}];

const locations = [
  {
    id: "synthetic-community-event", name: "TEST ONLY — Richmond Community Repair Event",
    pathway: "repair", providerType: "repair_cafe", type: "Synthetic community event",
    latitude: -37.818, longitude: 145.001
  },
  {
    id: "synthetic-repair-business", name: "TEST ONLY — Richmond Appliance Repair Business",
    pathway: "repair", providerType: "repair_service", type: "Synthetic repair business",
    latitude: -37.821, longitude: 145.003
  },
  {
    id: "synthetic-electronics-business", name: "TEST ONLY — Richmond Electronics Repair Business",
    pathway: "repair", providerType: "electronics_repair", type: "Synthetic electronics business",
    latitude: -37.816, longitude: 144.998
  },
  {
    id: "synthetic-recycling-facility", name: "TEST ONLY — Richmond Recycling Facility",
    pathway: "dispose", providerType: "recycling", type: "Synthetic recycling location",
    latitude: -37.825, longitude: 145.005
  }
].map((item) => ({
  ...item,
  suburb: "Richmond", postcode: "3121",
  address: "Synthetic map point — do not visit",
  openingHours: "TEST ONLY — no real opening hours",
  verificationNote: "SYNTHETIC USABILITY TEST DATA. This business or facility does not exist. Do not contact or visit it.",
  sourceRetrievedAt: "2026-09-11",
  sourceUrl: fixtureInfo,
  url: fixtureInfo
}));

const datasets = new Map([
  ["/api/recalls", { meta, recalls }],
  ["/api/sources", { meta, sources: [{
    name: marker, url: fixtureInfo, version: meta.dataVersion,
    retrievalDate: meta.retrievalDate,
    use: "Invented recall, repair history and Richmond locations for local usability tests.",
    limitations: meta.limitation
  }] }],
  ["/api/repair-evidence", { meta, evidence }],
  ["/api/locations", { meta, locations }],
  ["/api/health", { status: "ok", mode: "synthetic-test-only", database: "not-used", ...meta }]
]);

// Return one labelled, non-cached fixture response. HEAD returns headers without a body.
function send(request, response, status, body, type = "text/plain; charset=utf-8", headers = {}) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-FixForward-Data-Mode": "SYNTHETIC-TEST-ONLY",
    ...headers
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

// Handle read-only preview requests: invented APIs first, then a strict public-asset list.
// This deliberately separate helper has no production login and must stay on loopback.
const server = http.createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    send(request, response, 405, "Test server is read-only.");
    return;
  }
  const route = new URL(request.url, `http://${hostname}:${port}`).pathname;
  if (datasets.has(route)) {
    send(request, response, 200, JSON.stringify(datasets.get(route)), "application/json; charset=utf-8");
    return;
  }
  if (route === "/api/ready") {
    send(request, response, 503, JSON.stringify({ status: "not-a-database-check", database: "not-connected", ...meta }), "application/json; charset=utf-8");
    return;
  }
  if (route === "/test-fixture-info") {
    send(request, response, 200,
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${marker}</title><link rel="stylesheet" href="/styles.css"><body class="error-page"><main><p class="eyebrow">TEST ONLY</p><h1>${marker}</h1><p>These locations, repair counts and recall are invented solely to test the interface. No database is connected. No records are saved.</p><p>Recall test: select Kettle, brand Test Brand, model FF-TEST-42. Search Richmond or 3121 to display synthetic service results.</p><a class="button primary" href="/">Return to test app</a></main></body></html>`,
      "text/html; charset=utf-8");
    return;
  }

  // An explicit frontend allowlist prevents accidentally exposing credentials,
  // backend files, local reports, fixtures or any file outside this workspace.
  const permitted = route === "/" || ["/index.html", "/styles.css", "/404.html", "/500.html", "/favicon.svg", "/quest", "/quest/", "/quest/index.html", "/quest/quest.css", "/quest/play-effects.css", "/quest/tablet-play.css", "/quest/game-feel.css", "/quest/clue-play.css", "/quest/family-guide.css", "/quest/visual-play.css", "/quest/word-help.css", "/quest/audio/story-manifest.js", "/quest/audio/KOKORO-LICENSE.txt"].includes(route)
    || /^\/quest\/audio\/[a-f0-9]{16}\.mp3$/.test(route)
    || /^\/(src|quest)\/[a-zA-Z0-9_-]+\.js$/.test(route);
  if (!permitted) { send(request, response, 404, "Not found."); return; }
  const relative = route === "/" ? "index.html" : ["/quest", "/quest/"].includes(route) ? "quest/index.html" : route.slice(1);
  try {
    const extension = path.extname(relative);
    // MP3 is binary. UTF-8 decoding would corrupt a generated story recording.
    let content = await readFile(path.join(workspace, relative), extension === ".mp3" ? undefined : "utf8");
    const type = extension === ".mp3" ? "audio/mpeg" : extension === ".txt" ? "text/plain; charset=utf-8" : extension === ".js" ? "text/javascript; charset=utf-8"
      : extension === ".css" ? "text/css; charset=utf-8" : extension === ".svg" ? "image/svg+xml" : "text/html; charset=utf-8";
    // Tablet audio may ask for a byte range when resuming. Return binary bytes,
    // just as Flask's send_from_directory does in the real application.
    if (extension === '.mp3') {
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        const start = match ? Number(match[1]) : -1;
        const end = match?.[2] ? Math.min(Number(match[2]), content.length - 1) : content.length - 1;
        if (start < 0 || start >= content.length || end < start) {
          send(request, response, 416, '', type, { 'Content-Range': `bytes */${content.length}` }); return;
        }
        send(request, response, 206, content.subarray(start, end + 1), type, { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': end - start + 1 }); return;
      }
      send(request, response, 200, content, type, { 'Accept-Ranges': 'bytes', 'Content-Length': content.length }); return;
    }
    if (relative === "index.html") {
      content = content.replace("<title>", "<title>[SYNTHETIC TEST] ");
      content = content.replace("<body>", `<body><aside aria-label="Synthetic test environment" style="padding:12px 20px;background:#fff1d9;color:#071c49;border-bottom:2px solid #071c49;font:700 14px/1.5 sans-serif;">${marker} · Invented records · No database connected · Do not contact or visit test locations.</aside>`);
    }
    if (relative === "quest/index.html") {
      content = content.replace('</head>', '<meta name="quest-review-fixture" content="synthetic-adult-data"></head>');
    }
    send(request, response, 200, content, type);
  } catch {
    send(request, response, 404, "Not found.");
  }
});

// Bind only to the local machine and print the two comparison URLs.
server.listen(port, hostname, () => {
  console.log(`${marker}: http://${hostname}:${port}/`);
  console.log(`FixForward Quest: http://${hostname}:${port}/quest (authored stories; no API needed)`);
  console.log("Recall fixture: Kettle / Test Brand / FF-TEST-42. Search: Richmond or 3121.");
  console.log("No database connection. Quest progress saves only in this browser. Stop with Ctrl+C.");
});
server.on("error", (error) => { console.error(`Test server could not start: ${error.code}`); process.exitCode = 1; });
// Closing the preview process stops serving files; it does not clear browser storage.
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
