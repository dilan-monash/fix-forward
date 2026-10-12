// These pretend devices respond only to the Clue Lab's state. The shared shell
// owns events and scoring; this renderer never plays audio or handles a real item.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const has = (evidence, key) => Array.isArray(evidence) ? evidence.includes(key) : evidence instanceof Set ? evidence.has(key) : Boolean(evidence?.[key]);
const svg = (body, extra = '') => `<svg class="cl-device-art ${extra}" viewBox="0 0 650 330" aria-hidden="true" focusable="false">${body}</svg>`;

function bench(prefix) {
  return `<defs><linearGradient id="${prefix}-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e7eed8"/><stop offset="1" stop-color="#bbd1ae"/></linearGradient><linearGradient id="${prefix}-screen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#416557"/><stop offset="1" stop-color="#1d4038"/></linearGradient><linearGradient id="${prefix}-table" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff7dc"/><stop offset="1" stop-color="#e0d7b8"/></linearGradient></defs>
  <ellipse cx="325" cy="289" rx="259" ry="27" fill="#2c5a3810"/>
  <path d="M40 252 319 191 612 253 339 316Z" fill="#bed1af"/>
  <path d="m40 244 279-61 293 62-273 63Z" fill="url(#${prefix}-table)" stroke="#d6d5b4" stroke-width="2"/>
  <path d="m40 244 299 64v10L40 255Z" fill="#b7c6a3"/><path d="m339 308 273-63v10l-273 63Z" fill="#a7bf98"/>
  <g opacity=".7"><path d="M80 104h36M98 86v36M535 67h25M547 55v25" stroke="#b5c5a0" stroke-width="2"/><circle cx="129" cy="72" r="4" fill="#d7b65f"/><circle cx="554" cy="142" r="3" fill="#82ac96"/></g>`;
}

function speakerArt({volume = 0, muted = true, working = false} = {}, prefix = 'cl-speaker') {
  const heights = [18,35,54,72,46,30,58,78,44];
  return svg(`${bench(prefix)}
  <ellipse cx="316" cy="258" rx="127" ry="23" fill="#2447331c"/>
  <path d="m222 74 161-25 44 22-159 29Z" fill="#dce8ca" stroke="#66856b" stroke-width="2"/>
  <path d="m383 49 44 22v164l-44 25Z" fill="#7ba28b" stroke="#507d68" stroke-width="2"/>
  <path d="m222 74 161-25v211l-161 19Z" fill="url(#${prefix}-body)" stroke="#527760" stroke-width="3"/>
  <path d="m239 263 125-16" stroke="#fff7df" stroke-width="5" stroke-linecap="round"/>
  <path d="m279 67-1-17q0-15 16-17l31-4q15-2 15 12v16" fill="none" stroke="#527760" stroke-width="9" stroke-linecap="round"/>
  <g class="cl-speaker-cone${working ? ' is-playing' : ''}" style="--cl-level:${volume}"><ellipse cx="304" cy="183" rx="63" ry="65" fill="#4d7867" stroke="#8fad96" stroke-width="6"/><ellipse cx="304" cy="183" rx="49" ry="51" fill="#284e45" stroke="#d5e0bf" stroke-width="2"/><ellipse cx="304" cy="183" rx="26" ry="28" fill="#719a7d"/><path d="M290 167q17-16 30 0" fill="none" stroke="#aec9a0" stroke-width="4" stroke-linecap="round"/></g>
  <path d="m246 105 66-11" stroke="#527b65" stroke-width="6" stroke-linecap="round"/><circle cx="351" cy="88" r="7" fill="${working ? '#d2e698' : '#e5bf6c'}" stroke="#62816b" stroke-width="2"/>
  <g transform="translate(439 115)"><rect x="-10" y="-13" width="139" height="111" rx="16" fill="#f9f9e9" stroke="#b4c9ac" stroke-width="2"/><path d="M4 61h113" stroke="#c2d5b9" stroke-width="2" stroke-dasharray="3 5"/>
  ${heights.map((height, index) => { const h = working ? Math.max(8, height * volume / 3) : 4; return `<rect class="cl-wave-bar${working ? ' is-playing' : ''}" style="--cl-wave-delay:${index * -0.13}s" x="${8+index*11}" y="${61-h/2}" width="6" height="${h}" rx="3" fill="${working ? '#528c68' : '#a8bca0'}"/>`; }).join('')}
  <circle cx="106" cy="4" r="4" fill="${working ? '#70aa70' : '#bdc7ae'}"/><text x="6" y="12" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#4c7158">WAVE CHECK</text></g>
  <g transform="translate(115 185)"><path d="m0 19 37-8 13 9-36 9Z" fill="#e9c36f"/><path d="m0 19 14 10v29L0 48Z" fill="#ca9e4b"/><path d="m14 29 36-9v29l-36 9Z" fill="#e2b762"/><path d="M21 39v9m8-13v11m8-14v10" stroke="#fff1b5" stroke-width="3" stroke-linecap="round"/></g>
  ${muted ? '<g transform="translate(344 227)"><circle r="18" fill="#ffedc3" stroke="#aa813a" stroke-width="2"/><path d="m-7-5 4 0 5-5v20l-5-5h-4Zm13-1 7 12m0-12-7 12" stroke="#846122" stroke-width="2" fill="none" stroke-linecap="round"/></g>' : ''}`);
}

function robotArt({channel = 'A', outcome = '', leftSeen = false, rightSeen = false} = {}) {
  const activeRight = outcome === 'right-moves';
  const activeLeft = outcome === 'left-stuck';
  return svg(`${bench('cl-robot')}
  <path d="m134 236 278-49 102 26-275 55Z" fill="#d2dac4" stroke="#9bb69b" stroke-width="2"/>
  <path d="m164 238 269-47M204 251l272-50" stroke="#8aab8e" stroke-width="3" stroke-dasharray="10 9"/>
  <path d="m459 189 17 11-21 5" fill="none" stroke="#75a285" stroke-width="4" stroke-linecap="round"/>
  <g class="cl-robot-model${activeLeft ? ' cl-wheel-stuck' : ''}">
  <path d="m234 104 124-23 42 18-124 24Z" fill="#ffdf98" stroke="#b4924d" stroke-width="2"/>
  <path d="m234 104 124-23v141l-124 25Z" fill="#ecd096" stroke="#a58446" stroke-width="3"/>
  <path d="m358 81 42 18v126l-42-3Z" fill="#d5ad65" stroke="#a58446" stroke-width="2"/>
  <path d="M305 82V57" stroke="#68866c" stroke-width="6" stroke-linecap="round"/><circle cx="305" cy="48" r="10" fill="${channel === 'B' ? '#9fcaa2' : '#e5b96c'}" stroke="#68866c" stroke-width="3"/>
  <path d="m247 130 96-17v49l-96 19Z" fill="url(#cl-robot-screen)" stroke="#7b8c62" stroke-width="3"/>
  <ellipse cx="270" cy="148" rx="7" ry="9" fill="#e9f3c5"/><ellipse cx="322" cy="138" rx="7" ry="9" fill="#e9f3c5"/>
  <path d="m285 157q11 10 23-3" fill="none" stroke="#acc994" stroke-width="3" stroke-linecap="round"/>
  <rect x="279" y="185" width="34" height="26" rx="7" fill="#f9edc1" stroke="#b49a5c" stroke-width="2"/><text x="296" y="204" text-anchor="middle" fill="#456b56" font-family="system-ui,sans-serif" font-size="19" font-weight="800">B</text>
  <g class="cl-wheel cl-wheel-left${activeLeft ? ' is-stuck' : ''}"><ellipse cx="234" cy="226" rx="19" ry="29" fill="#3d6657" stroke="#24473f" stroke-width="4"/><ellipse cx="234" cy="226" rx="9" ry="17" fill="#89ac8b"/><path d="M234 213v26m-7-13h14" stroke="#d5dfb3" stroke-width="3" stroke-linecap="round"/></g>
  <g class="cl-wheel cl-wheel-right${activeRight ? ' is-moving' : ''}"><ellipse cx="364" cy="225" rx="21" ry="30" fill="#3d6657" stroke="#24473f" stroke-width="4"/><ellipse cx="364" cy="225" rx="11" ry="18" fill="#89ac8b"/><path class="cl-wheel-spoke" d="M364 211v28m-9-14h18" stroke="#d5dfb3" stroke-width="3" stroke-linecap="round"/></g>
  <path d="m232 159-21 14 2 26m186-52 15 13v20" fill="none" stroke="#66836a" stroke-width="9" stroke-linecap="round"/>
  </g>
  <g transform="translate(102 166)"><path d="m0 4 47-9 18 46-46 10Z" fill="#f6f4db" stroke="#9db59a" stroke-width="2"/><text x="25" y="27" fill="#3f7458" text-anchor="middle" font-size="23" font-family="system-ui,sans-serif" font-weight="800">${escape(channel)}</text></g>
  <g transform="translate(465 91)"><rect width="96" height="79" rx="14" fill="#f7f7e4" stroke="#b7c9ad" stroke-width="2"/><text x="15" y="23" font-size="10" font-family="system-ui,sans-serif" fill="#4e745e" font-weight="700">WHEEL CHECK</text><path d="M15 40h22m-22 20h22" stroke="#8fa88f" stroke-width="3" stroke-linecap="round"/><circle cx="68" cy="40" r="8" fill="${leftSeen ? '#f0c374' : '#d9e1c9'}"/><circle cx="68" cy="60" r="8" fill="${rightSeen ? '#8ebc8b' : '#d9e1c9'}"/></g>`);
}

function tabletArt(warning = false) {
  return svg(`${bench('cl-tablet')}
  <ellipse cx="321" cy="258" rx="162" ry="24" fill="#2a4e3620"/>
  <path d="m194 99 211-35 55 152-219 41Z" fill="#71998a" stroke="#3d6c5d" stroke-width="3"/>
  <path d="m241 257 219-41q-4 24-18 28l-193 39Z" fill="#9ab6a2" stroke="#557e6b" stroke-width="3"/>
  <path d="m194 99 47 158 8 26-48-147Z" fill="#517e70"/>
  <path d="m211 111 181-30 48 123-186 36Z" fill="url(#cl-tablet-screen)" stroke="#375e52" stroke-width="3"/>
  <path d="m224 113 81-14-61 122" fill="#96bda714"/>
  <path d="m296 147 48-8 17 47-48 9Z" fill="#547c6926"/>
  <circle cx="300" cy="89" r="3" fill="#d5e0c3"/>
  <path d="m311 249 83-16" stroke="#d8dcb9" stroke-width="3" stroke-linecap="round"/>
  <path class="cl-raised-edge${warning ? ' is-inspected' : ''}" d="m344 264q30-37 72-26" fill="none" stroke="${warning ? '#b97a34' : '#4a6a51'}" stroke-width="8" stroke-linecap="round"/>
  <path d="m344 264q30-20 72-26" fill="none" stroke="#fff2c8" stroke-width="2"/>
  <path d="m443 133 7 18" stroke="#dae7c8" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(98 191)"><rect width="62" height="49" rx="9" fill="#fff1ca" stroke="#cab478" stroke-width="2"/><path d="m31 8 19 30H12Z" fill="#e0b45a"/><path d="M31 17v9m0 5v1" stroke="#785c27" stroke-width="3" stroke-linecap="round"/></g>
  ${warning ? '<g class="cl-warning-halo"><ellipse cx="389" cy="246" rx="64" ry="29" fill="none" stroke="#c58b37" stroke-width="3" stroke-dasharray="6 6" transform="rotate(-14 389 246)"/></g>' : ''}`);
}

function controlHeader(label, detail) { return `<div class="cl-controls-heading"><span>${label}</span><p>${detail}</p></div>`; }
const testIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z" fill="currentColor"/></svg>';

/** A render has no side effects. Evidence is earned by engine experiments,
 * never by selecting a setting or merely seeing an illustration. */
export function renderLabWorld({caseId = 'speaker', controls = {}, evidence = [], result = null, experimentOutcome = '', paused = false} = {}) {
  const outcome = typeof result === 'string' ? result : result?.outcome || '';
  // The shell remembers the latest test for these exact control settings.
  // Choosing a route or opening a hint must not erase an observed response.
  const observation = experimentOutcome || outcome;
  let art, status, panel, tag, extra = '';
  if (caseId === 'robot') {
    const channel = ['A','B','C'].includes(controls.channel) ? controls.channel : 'A';
    const leftSeen = has(evidence, 'robot-left-stuck'), rightSeen = has(evidence, 'robot-right-moves');
    tag = '02 / Wheel test';
    art = robotArt({channel, outcome:observation, leftSeen, rightSeen});
    status = outcome === 'case-solved' && leftSeen && rightSeen ? 'Left wheel stuck. Right wheel moves.' : observation === 'no-signal' ? 'No response on this channel.' : observation === 'left-stuck' ? 'Left wheel: stuck.' : observation === 'right-moves' ? 'Right wheel: moves.' : 'Find the matching channel. Test each wheel.';
    panel = `${controlHeader('YOUR REMOTE', 'Look for the robot’s channel clue.')}<fieldset class="cl-channel-picker"><legend>Remote channel</legend><div>${['A','B','C'].map(value=>`<button type="button" data-lab-action="set-channel" data-value="${value}" aria-pressed="${value===channel}" aria-label="Channel ${value}">${value}</button>`).join('')}</div></fieldset><div class="cl-wheel-tests"><button type="button" data-lab-action="test-left"><span aria-hidden="true">↶</span>Test left wheel</button><button type="button" data-lab-action="test-right"><span aria-hidden="true">↷</span>Test right wheel</button></div><div class="cl-wheel-notebook" aria-label="Wheel observations"><span class="${leftSeen?'is-observed':''}">Left <b>${leftSeen?'Stuck':'Not tested'}</b></span><span class="${rightSeen?'is-observed':''}">Right <b>${rightSeen?'Moves':'Not tested'}</b></span></div>`;
  } else if (caseId === 'tablet') {
    const warning = has(evidence, 'tablet-warning') || ['warning','stop'].includes(outcome);
    tag = '03 / Look closely';
    art = tabletArt(warning);
    status = warning ? 'The edge is lifting. Leave it off.' : 'Something is different along the edge.';
    extra = `<button type="button" class="cl-inspect-hotspot${warning?' is-inspected':''}" data-lab-action="inspect" aria-label="Inspect the raised tablet edge"><span aria-hidden="true">${warning?'!':'⌕'}</span><b>${warning?'Raised edge':'Look at this edge'}</b></button>`;
    panel = `${controlHeader('LOOK BEFORE YOU ACT', 'The screen stays dark.')}<div class="cl-tablet-observation${warning?' is-observed':''}"><span aria-hidden="true">${warning?'!':'⌕'}</span><p>${warning?'A raised edge is a warning clue.':'Find the clue on the tablet’s side.'}</p></div><button type="button" class="cl-world-button" data-lab-action="inspect">Inspect the edge <span aria-hidden="true">⌕</span></button><button type="button" class="cl-world-button cl-wake-button" data-lab-action="wake"><span aria-hidden="true">⏻</span>Try wake button</button><p class="cl-panel-note">A pretend device. Keep real devices closed.</p>`;
  } else {
    const volume = Math.max(0, Math.min(3, Number.isFinite(Number(controls.volume)) ? Number(controls.volume) : 0));
    const muted = controls.muted !== false;
    const working = (observation === 'working' || outcome === 'case-solved' && has(evidence, 'speaker-working')) && !muted && volume > 0;
    tag = '01 / Signal test';
    art = speakerArt({volume, muted, working});
    status = working ? 'A waveform! The speaker responds.' : observation === 'no-signal' ? 'No waveform while mute is on.' : observation === 'quiet' ? 'No waveform at volume zero.' : 'Change a setting, then test.';
    panel = `${controlHeader('THE CONTROL DESK', 'Try a setting. See what changes.')}<label class="cl-volume-control"><span>Volume <output>${volume} / 3</output></span><input type="range" min="0" max="3" step="1" value="${volume}" data-lab-action="set-volume" aria-label="Speaker volume" aria-valuetext="${volume} out of 3" style="--cl-volume:${volume/3*100}%"><span class="cl-volume-ticks" aria-hidden="true"><i>0</i><i>1</i><i>2</i><i>3</i></span></label><button type="button" class="cl-mute-button" data-lab-action="toggle-mute" aria-pressed="${muted}"><span class="cl-switch" aria-hidden="true"><i></i></span><span>Mute ${muted?'on':'off'}</span></button><button type="button" class="cl-world-button cl-test-button" data-lab-action="test">${testIcon}Test the speaker</button><p class="cl-panel-note">Watch the wave. No sound plays.</p>`;
  }
  return `<div class="cl-world cl-world-${escape(caseId)}${paused?' cl-world-paused':''}" data-outcome="${escape(outcome)}"><figure class="cl-stage"><div class="cl-stage-top"><span>${tag}</span><b><i aria-hidden="true"></i> PRETEND DEVICE</b></div><div class="cl-illustration">${art}${extra}</div><figcaption class="cl-stage-status${['working','right-moves'].includes(outcome)?' is-working':['warning','stop','left-stuck'].includes(outcome)?' is-caution':''}"><span class="cl-status-dot" aria-hidden="true"></span>${status}</figcaption></figure><section class="cl-panel-controls" aria-label="${caseId==='robot'?'Robot remote':caseId==='tablet'?'Tablet observation':'Speaker controls'}">${panel}</section></div>`;
}

/** Lightweight original card art shares the visual language, but no controls. */
export function labCardArt() {
  return `<span class="cl-card-art" aria-hidden="true">${speakerArt({volume:2, muted:false, working:false}, 'cl-card-speaker')}<span class="cl-card-glass"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="41" cy="39" r="26" fill="#eef7dacc" stroke="#316a53" stroke-width="8"/><path d="m62 61 24 25" stroke="#cc9e52" stroke-width="15" stroke-linecap="round"/><path d="m28 34 9 9 17-18" fill="none" stroke="#759d65" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span>`;
}
