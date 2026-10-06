// Iteration 3 local prototype. The screens follow the supplied design export.
// Data is fictional and progress is stored only in this browser.
(() => {
  'use strict';

  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const storageKey = 'fixforward-i3-figma-prototype-v2';
  const defaults = {
    energy: 0,
    level: 1,
    stars: 0,
    appliance: 'Kettle',
    brand: '',
    model: '',
    safety: {},
    finderType: 'repair',
    finderPlace: 0,
    suburb: 'Brunswick VIC 3056',
    cityScore: 25,
    landfill: 75,
    cityUpgrade: 'recovery',
  };

  let state = loadState();
  let promptTimers = [];
  let lastRenderedPath = null;
  let suppressTrailUpdate = false;
  const routeTrail = [];

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    updateProgress();
  }

  function updateProgress() {
    document.querySelector('#energy-count').textContent = state.energy;
    document.querySelector('#level-count').textContent = state.level;
    document.querySelector('#star-count').textContent = state.stars;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  // Optional device details still need a plausible format before they can be saved or used in a lookup.
  function validateDeviceDetail(value, label, kind) {
    if (!value) return '';
    if (value.length < 2 || value.length > 40) return `${label} must be between 2 and 40 characters.`;
    if (!/^[\p{L}\p{N}][\p{L}\p{N}\s.&'’()+/_-]*$/u.test(value)) {
      return `${label} contains unsupported characters.`;
    }
    if (kind === 'brand' && !/\p{L}/u.test(value)) return 'Brand must include at least one letter.';

    const compact = value.toLocaleLowerCase().replace(/[\s.&'’()+/_-]/g, '');
    if (/^(unknown|none|na|test|asd|qwe|zxc|abc|xyz|123)/i.test(compact)) {
      return `${label} looks like placeholder text. Enter the label from the appliance, or leave it blank.`;
    }
    if (/(.)\1{3,}/u.test(compact)) {
      return `${label} has too many repeated characters. Check the appliance label and try again.`;
    }
    if (compact.length >= 6) {
      const pairs = new Map();
      for (let index = 0; index < compact.length - 1; index += 1) {
        const pair = compact.slice(index, index + 2);
        pairs.set(pair, (pairs.get(pair) || 0) + 1);
      }
      if ([...pairs.values()].some(count => count >= 3)) {
        return `${label} looks repetitive. Enter the label from the appliance, or leave it blank.`;
      }
    }
    return '';
  }

  function route(path) {
    location.hash = `#/${path.replace(/^\//, '')}`;
  }

  function currentRoute() {
    return location.hash.replace(/^#\//, '') || 'home';
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  function startHomePromptTour() {
    const coach = document.querySelector('.home-coach');
    if (sessionStorage.getItem('fixforward-home-coach-dismissed') === 'true') coach?.classList.add('dismissed');
    if (sessionStorage.getItem('fixforward-home-prompt-seen') === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('[data-home-card]').forEach((card, index) => {
      promptTimers.push(setTimeout(() => card.classList.add('prompt-preview'), 700 + index * 1050));
      promptTimers.push(setTimeout(() => card.classList.remove('prompt-preview'), 1550 + index * 1050));
    });
    promptTimers.push(setTimeout(() => sessionStorage.setItem('fixforward-home-prompt-seen', 'true'), 5200));
  }

  function award({ energy = 0, stars = 0 } = {}) {
    state.energy += energy;
    state.stars += stars;
    state.level = Math.max(1, Math.floor(state.energy / 50) + 1);
    saveState();
  }

  const button = (label, path, className = 'primary') =>
    `<a class="${className}" href="#/${path}">${label}</a>`;

  // These parent routes are safe fallbacks when a screen is opened directly without in-app history.
  const backTargets = {
    tour: 'home', quest: 'home', fixit: 'quest', 'fixit/right': 'fixit', 'fixit/retry': 'fixit',
    loop: 'quest', 'loop/right': 'loop', 'loop/retry': 'loop', city: 'quest', 'city/play': 'city',
    'city/upgrade': 'city/play', 'city/win': 'city', lens: 'home', 'lens/scan': 'lens',
    'lens/confirm': 'lens', 'lens/impact': 'lens/confirm', 'lens/facts': 'lens/confirm',
    'lens/care': 'lens/confirm', pathway: 'home', 'pathway/not-found': 'pathway',
    'pathway/safety': 'pathway', 'pathway/options': 'pathway/safety', 'pathway/recall': 'pathway',
    finder: 'home', 'finder/location': 'finder', 'finder/results': 'finder/location',
    'finder/place': 'finder/results', about: 'home', privacy: 'about',
  };

  function backNavigation(path) {
    const destination = backTargets[path];
    if (!destination) return '';
    return '<nav class="page-back" aria-label="Page navigation"><button type="button" data-go-back><span aria-hidden="true">←</span> Back</button></nav>';
  }

  function steps(active) {
    return `<div class="steps" aria-label="Your pathway">
      ${['Your item', 'Safety check', 'Your options'].map((label, index) =>
        `<span class="step ${index === active ? 'active' : ''}">${index + 1}&nbsp; ${label}</span>`).join('')}
    </div>`;
  }

  function home() {
    return `<section class="home-story-hero" aria-label="A child and adult learning about electronics together">
      <div class="hero-copy">
        <p class="eyebrow">A small choice can make a big difference</p>
        <h1>Learn about<br><span class="blue-text">e-waste together</span></h1>
        <p class="lead">Play, explore and make better choices about everyday electronics.</p>
        <div class="hero-question"><span aria-hidden="true">💬</span><div><strong>Not sure where to begin?</strong><p>Think of one electronic item at home. Do you want to learn about it, understand it, decide its next step, or find help nearby?</p></div></div>
      </div>
    </section>
    <section class="journey-guide" aria-label="Learn, explore, decide and act">
      <a href="#/quest"><span>1</span><strong>Learn</strong><small>Play with an idea</small></a>
      <i aria-hidden="true"></i>
      <a href="#/lens"><span>2</span><strong>Explore</strong><small>Look inside the story</small></a>
      <i aria-hidden="true"></i>
      <a href="#/pathway"><span>3</span><strong>Decide</strong><small>Choose a safe next step</small></a>
      <i aria-hidden="true"></i>
      <a href="#/finder"><span>4</span><strong>Act</strong><small>Find practical help</small></a>
    </section>
    <div class="home-coach" role="note">
      <span class="coach-avatar" aria-hidden="true">✨</span>
      <div><strong>Try one path</strong><p>Move over a card to reveal a question. Choose the question that sounds most like yours.</p></div>
      <button type="button" data-dismiss-coach aria-label="Dismiss this tip">Got it</button>
    </div>
    <section class="home-actions richer" aria-label="FixForward activities">
      <a class="home-action blue-card" href="#/quest" data-home-card>
        <div class="card-art game-art" aria-hidden="true"><span>★</span><b>+</b><i>↻</i></div>
        <span class="card-stage">Learn</span><h2>FixForward Quest</h2><p>Play games and learn about e-waste.</p>
        <span class="card-prompt">What happens when we repair, reuse or recycle?</span>
      </a>
      <a class="home-action green-card" href="#/lens" data-home-card>
        <div class="card-art lens-art" aria-hidden="true"><span>▰</span><b>⌕</b><i>⚙</i></div>
        <span class="card-stage">Explore</span><h2>FixForward Lens</h2><p>Explore everyday electronics and see what’s inside.</p>
        <span class="card-prompt">What materials and parts might be hiding inside?</span>
      </a>
      <a class="home-action yellow-card" href="#/pathway" data-home-card>
        <div class="card-art pathway-art" aria-hidden="true"><span>◉</span><b>↗</b><i>♻</i></div>
        <span class="card-stage">Decide</span><h2>FixForward Pathway</h2><p>Work out what to do next with your item.</p>
        <span class="card-prompt">Is it safe, repairable, reusable or ready to recycle?</span>
      </a>
      <a class="home-action purple-card" href="#/finder" data-home-card>
        <div class="card-art finder-art" aria-hidden="true"><span>⌖</span><b>♡</b><i>⚒</i></div>
        <span class="card-stage">Act</span><h2>FixForward Finder</h2><p>Find nearby repair, donation and recycling options.</p>
        <span class="card-prompt">Which nearby service has confirmed it accepts your item?</span>
      </a>
    </section>`;
  }

  function tour() {
    const cards = [
      ['Quest', 'Learn through challenges and choices.', 'blue-card'],
      ['Lens', 'Explore a device and discover what is behind it.', 'green-card'],
      ['Pathway', 'Use real information to work out a safe next step.', 'yellow-card'],
      ['Finder', 'Find nearby places when you are ready to act.', 'purple-card'],
    ];
    return `<section class="screen-head"><h1>Quick tour</h1><p class="lead">Just a few pointers, then you’re off.</p></section>
      <div class="tour-grid">${cards.map(([title, copy, colour], index) =>
        `<article class="tour-card ${colour}"><b>${index + 1}</b><h2>${title}</h2><p>${copy}</p></article>`).join('')}</div>
      <div class="actions end">${button('Got it', 'home', 'primary green')}</div>`;
  }

  function questHub() {
    const games = [
      ['Fix-it Station', 'Sort broken or unwanted tech into Repair, Reuse or Recycle.', 'yellow-card', 'fixit'],
      ['Circular Choices', 'Make smart choices and see what happens next.', 'blue-card', 'loop'],
      ['Circular City', 'Upgrade the city until landfill hits zero.', 'orange-card', 'city'],
    ];
    return `<section class="screen-head"><h1>Choose a game</h1></section>
      <div class="game-grid">${games.map(([title, copy, colour, path], index) =>
        `<article class="game-card ${colour}"><span class="round-icon">${index === 0 ? '↻' : index === 1 ? '●' : '◆'}</span><h2>${title}</h2><p>${copy}</p>${button('Play', path)}</article>`).join('')}</div>
      <div class="actions"><a class="secondary" href="discover/">Open the extended Sorting Station</a></div>`;
  }

  function fixit() {
    return `<section class="screen-head compact"><h1>Fix-it Station</h1><p>Where should this go?</p></section>
      <div class="prompt-banner"><div><strong>The phone still works, but the screen is cracked.</strong><p>Pick the best next step.</p></div><span class="device-icon" aria-hidden="true"></span></div>
      <div class="three-grid">
        <button class="choice yellow-card" data-fixit="right"><strong>Repair</strong><span>Fix it and keep using it.</span></button>
        <button class="choice green-card" data-fixit="retry"><strong>Reuse</strong><span>Pass on a working item.</span></button>
        <button class="choice blue-card" data-fixit="retry"><strong>Recycle</strong><span>Recover materials when it cannot be used.</span></button>
      </div>`;
  }

  function fixitResult(correct) {
    return `<section class="screen-head compact"><h1>${correct ? 'Nice choice!' : 'Not quite.'}</h1><p>${correct ? 'A cracked screen can often be repaired while the phone keeps working.' : 'This phone still works. We can keep more value by repairing it first.'}</p></section>
      <div class="feedback-box ${correct ? 'green-card' : 'red-card error'}">
        <span class="feedback-icon">${correct ? '✓' : '!'}</span>
        <h2>${correct ? 'Repair' : 'Try again'}</h2>
        <p>${correct ? 'Fix the screen. Keep the phone. Keep its materials in use.' : 'Hint: the screen is cracked, but the phone still turns on.'}</p>
        ${correct ? '<strong>+10 Sparks</strong>' : ''}
      </div><div class="actions end">${button(correct ? 'Back to games' : 'Back to choices', correct ? 'quest' : 'fixit', correct ? 'primary green' : 'primary')}</div>`;
  }

  function loop() {
    return `<section class="screen-head compact"><h1>Circular Choices</h1></section>
      <div class="prompt-banner center"><strong>Your family has an old laptop that still works.<br>Nobody uses it anymore.<br><br>What keeps the most value in the loop?</strong></div>
      <div class="three-grid">
        <button class="choice green-card" data-loop="right"><strong>Give it to someone who can use it</strong></button>
        <button class="choice red-card" data-loop="retry"><strong>Throw it in the rubbish bin</strong></button>
        <button class="choice yellow-card" data-loop="retry"><strong>Break it apart for fun</strong></button>
      </div>`;
  }

  function loopResult(correct) {
    return `<section class="screen-head compact"><h1>${correct ? 'Yep! Keep it in use.' : 'Almost.'}</h1><p>${correct ? 'A working laptop can be reused before its materials need recycling.' : 'Think about what keeps the whole laptop useful for longest.'}</p></section>
      <div class="feedback-box ${correct ? 'green-card' : 'yellow-card'}">
        <h2>${correct ? 'Reuse keeps the whole product working.' : 'It still works.'}</h2>
        <p>${correct ? 'That saves more value than throwing it away or breaking it down too soon.' : 'Who could use it next?'}</p>
        ${correct ? '<strong>+15 Sparks &nbsp; 🔥 Streak: 2</strong>' : ''}
      </div><div class="actions end">${button(correct ? 'Back to games' : 'Try again', correct ? 'quest' : 'loop', correct ? 'primary green' : 'primary')}</div>`;
  }

  function cityIntro() {
    return `<section class="screen-head compact"><h1>Circular City</h1><p>Turn a waste-heavy city into a city that keeps things in use.</p></section>
      <div class="city-layout"><div class="city-map"><div class="building">Too much landfill</div><div class="building">Not enough repair & reuse</div><div class="building">Things replaced too soon</div></div>
      <aside class="score-panel"><h2>How to win</h2><p>Upgrade the city so people can repair more, share and reuse more, recover materials, and send less to landfill.</p><h3>Goal: 100% circular</h3>${button('Start', 'city/play', 'primary green')}</aside></div>`;
  }

  function cityPlay() {
    return `<section class="screen-head compact"><h1>Circular City</h1><p>Pick one upgrade. Each choice changes your city.</p></section>
      <div class="upgrade-grid">
        <article class="upgrade orange-card"><h2>Old dump</h2><p>Turn it into a Resource Recovery Hub.</p><b>100 coins · +15 circular · −15 landfill</b><div class="actions"><button class="primary orange" data-city-upgrade="recovery">Upgrade</button></div></article>
        <article class="upgrade blue-card"><h2>Old factory</h2><p>Upgrade it to build easier-to-repair tech.</p><b>120 coins · +20 circular · −20 landfill</b><div class="actions"><button class="primary blue" data-city-upgrade="repairable">Upgrade</button></div></article>
        <article class="upgrade green-card"><h2>Empty lot</h2><p>Build a Tool Library for sharing.</p><b>80 coins · +10 circular · −10 landfill</b><div class="actions"><button class="primary green" data-city-upgrade="sharing">Upgrade</button></div></article>
      </div><div class="score-bar">Circular score ${state.cityScore}% → Landfill ${state.landfill}%</div>`;
  }

  function cityUpgrade() {
    const upgrades = {
      recovery: ['The Resource Recovery Hub keeps useful materials out of landfill.', 'Old dump → Resource Recovery Hub', 'Metals, plastics and parts can be recovered instead of buried.'],
      repairable: ['Repairable products can stay useful for longer.', 'Old factory → Repairable technology workshop', 'Products designed for repair are easier to maintain instead of replace.'],
      sharing: ['Sharing helps more people use fewer new products.', 'Empty lot → Tool Library', 'Borrowing useful equipment reduces unnecessary purchases and waste.'],
    };
    const [summary, title, detail] = upgrades[state.cityUpgrade] || upgrades.recovery;
    return `<section class="screen-head compact"><h1>Nice upgrade!</h1><p>${summary}</p></section>
      <div class="feedback-box green-card"><h2>${title}</h2><p>${detail}</p></div>
      <div class="score-bar">Circular score ${state.cityScore}% &nbsp; • &nbsp; Landfill ${state.landfill}%</div>
      <div class="actions end">${state.cityScore >= 100 ? button('See result', 'city/win', 'primary green') : button('Choose another upgrade', 'city/play', 'primary green')}</div>`;
  }

  function cityWin() {
    return `<section class="screen-head compact"><h1>You did it! 🎉</h1><p>Your city keeps products and materials moving instead of wasting them.</p></section>
      <div class="big-result green-card"><strong>100% CIRCULAR</strong><strong>0% LANDFILL</strong><p>🏆 Circular City Builder</p></div>
      <div class="actions end"><button class="primary" data-city-reset>Play again</button></div>`;
  }

  function lensStart() {
    return `<section class="screen-head"><h1>Explore an e-device</h1><p class="lead">Scan one with an adult, or choose from the list.</p></section>
      <div class="two-grid">
        <article class="panel blue-card center"><span class="round-icon">◎</span><h2>Scan with camera</h2><p>Point the camera at a device.</p>${button('Scan', 'lens/scan', 'primary blue')}</article>
        <article class="panel green-card center"><span class="device-icon" aria-hidden="true"></span><h2>Choose a device</h2><p>Phone, tablet, laptop and more.</p>${button('Choose', 'lens/confirm', 'primary green')}</article>
      </div>`;
  }

  function lensScan() {
    return `<section class="screen-head compact"><h1>Try a sample scan</h1><p>Camera demo only. No camera opens and no photo is analysed.</p></section>
      <div class="scan-box"><div class="camera-frame"><strong>Camera preview</strong></div></div>
      <p class="center small">Keep faces and personal details out of the photo.</p>
      <div class="actions end">${button('Choose instead', 'lens', 'secondary')}${button('Use photo', 'lens/confirm', 'primary blue')}</div>`;
  }

  function lensConfirm() {
    return `<section class="screen-head compact"><h1>Explore a sample device</h1><p>This is a fixed example, not a recognition result.</p></section>
      <div class="device-card"><span class="device-icon" aria-hidden="true"></span><div><h2>Example: Tablet</h2><p>Open the sample information to explore this design.</p><div class="actions">${button('Explore the tablet', 'lens/impact', 'primary green')}</div></div></div>`;
  }

  function lensTabs(active) {
    return `<div class="tabs"><a class="${active === 'impact' ? 'active' : ''}" href="#/lens/impact">Impact</a><a class="${active === 'facts' ? 'active' : ''}" href="#/lens/facts">Fun facts</a><a class="${active === 'care' ? 'active' : ''}" href="#/lens/care">Care tips</a></div>`;
  }

  function lensImpact() {
    return `<section class="screen-head compact"><h1>Tablet</h1><p>Hidden cost to nature</p></section>${lensTabs('impact')}
      <div class="lens-layout"><div class="device-card"><span class="device-icon"></span><h2>Tablet</h2></div><div class="metric-grid">
        <article class="metric-card yellow-card"><span>Carbon</span><strong>≈ 400 km</strong><p>Like a long car trip</p></article>
        <article class="metric-card blue-card"><span>Water</span><strong>≈ 80 baths</strong><p>When reliable data exists</p></article>
        <article class="metric-card green-card"><span>Materials</span><strong>Gold + copper</strong><p>Valuable stuff inside</p></article>
      </div></div><div class="alert warning"><strong>Prototype estimates only.</strong> Figures must be linked to reviewed sources before release.</div>`;
  }

  function lensFacts() {
    return `<section class="screen-head compact"><h1>Tablet</h1><p>Fun facts</p></section>${lensTabs('facts')}
      <div class="lens-layout"><div class="device-card"><span class="device-icon"></span><h2>Tablet</h2></div><div class="care-grid">
        <article class="panel yellow-card"><h2>Tiny but valuable</h2><p>Tablets can contain small amounts of gold, copper and other useful materials.</p></article>
        <article class="panel blue-card"><h2>Battery inside</h2><p>Most tablets use a rechargeable lithium-ion battery.</p></article>
        <article class="panel green-card"><h2>Lots of parts</h2><p>Screen, battery, circuit board, metals and plastics all do different jobs.</p></article>
      </div></div>`;
  }

  function lensCare() {
    return `<section class="screen-head compact"><h1>Tablet</h1><p>Care tips</p></section>${lensTabs('care')}
      <div class="lens-layout"><div class="device-card"><span class="device-icon"></span><h2>Tablet</h2></div><div class="care-grid">
        <article class="panel blue-card"><h2>Use a case</h2><p>Help protect the screen from drops.</p></article>
        <article class="panel green-card"><h2>Keep it cool</h2><p>Do not leave it in a hot car or direct sun.</p></article>
        <article class="panel blue-card"><h2>Charge safely</h2><p>Use the right charger. Stop if the battery looks swollen.</p></article>
        <article class="panel green-card"><h2>Need a repair?</h2><p>Ask an adult or a professional.</p></article>
      </div></div>`;
  }

  function pathway() {
    const appliances = ['Kettle', 'Toaster', 'Hair dryer', 'Vacuum', 'Fan', 'Microwave'];
    return `<section class="screen-head compact"><h1>What item do you have?</h1><p class="lead">Choose one we know, or search for your item.</p>${steps(0)}</section>
      <div class="search-row"><div><label for="appliance-search">Search</label><input id="appliance-search" value="${escapeHtml(state.appliance)}" placeholder="Type an appliance name"></div><button class="primary" data-pathway-search>Search</button></div>
      <h3>Popular choices</h3><div class="popular">${appliances.map(name => `<button class="chip-button ${state.appliance === name ? 'active' : ''}" data-appliance="${name}">${name}</button>`).join('')}</div>
      <section class="brand-panel"><h2>Brand or model? <span class="muted">Optional</span></h2><p>This can help us check official recall notices for the right product.</p><div class="brand-fields"><div><label for="brand">Brand</label><input id="brand" value="${escapeHtml(state.brand)}" maxlength="40" autocomplete="organization" aria-describedby="device-details-help device-details-error"></div><div><label for="model">Model number</label><input id="model" value="${escapeHtml(state.model)}" maxlength="40" autocomplete="off" aria-describedby="device-details-help device-details-error"></div></div><p class="small" id="device-details-help">Use 2–40 letters or numbers from the appliance label. Spaces and common model punctuation are allowed.</p><p class="field-error" id="device-details-error" role="alert" aria-live="polite" hidden></p><p class="small"><b class="blue-text">Where can I find the model number?</b> Look for a label on the outside, back or base. Don’t open the device to find it.</p></section>
      <div class="actions end"><button class="primary green" data-pathway-continue>Continue</button></div>`;
  }

  function itemNotFound() {
    return `<section class="screen-head compact"><h1>We couldn’t find that item</h1><p>Try another name, or choose from the list below.</p>${steps(0)}</section>
      <div class="alert warning"><strong>“${escapeHtml(state.appliance)}” isn’t in our device list yet.</strong></div>
      <div class="popular">${['Fan', 'Vacuum', 'Portable heater', 'Hair dryer', 'Other e-device'].map(name => `<button class="chip-button" data-appliance="${name}">${name}</button>`).join('')}</div>
      <div class="actions">${button('Search again', 'pathway', 'primary')}</div>`;
  }

  const safetyQuestions = [
    'Any smoke, fire or burning smell?', 'Any shocks, sparks or damaged wires?',
    'Has water reached electrical parts?', 'Is the plug or power cord badly damaged?',
    'Is it getting much hotter than normal?',
  ];

  function safety() {
    // No recall service runs in this static build; never present its example as a real search result.
    return `<section class="screen-head compact"><h1>Try the safety questions</h1><p>Demo only: no recall search has been performed. A real item's recall status is unknown.</p>${steps(1)}</section>
      <div class="safety-list">${safetyQuestions.map((question, index) => `<div class="safety-row"><span class="safety-number">${index + 1}</span><strong>${question}</strong><span class="segmented">${['Yes', 'No', 'Not sure'].map(answer => `<button class="${state.safety[index] === answer ? 'active' : ''}" data-safety-index="${index}" data-safety-answer="${answer}">${answer}</button>`).join('')}</span></div>`).join('')}</div>
      <div class="actions end"><button class="primary green" data-safety-continue>Continue</button></div>`;
  }

  function options() {
    const uncertain = Object.values(state.safety).some(answer => answer === 'Yes' || answer === 'Not sure');
    const summary = uncertain
      ? 'One or more answers need caution, so get advice before using the item again.'
      : 'Your answers did not show an obvious warning, but this short check cannot guarantee safety.';
    return `<section class="screen-head compact"><h1>Here’s what we know</h1><p>${summary}</p>${steps(2)}</section>
      <div class="alert ${uncertain ? 'warning' : 'success'}"><strong>Safety is ${uncertain ? 'unclear' : 'not currently showing an obvious warning'}.</strong><p>${uncertain ? 'That does not mean something is definitely wrong, but it also does not mean the item is safe.' : 'This check is not a guarantee of safety.'}</p></div>
      <h2>You can still explore your options</h2><div class="three-grid">
        <article class="option-card blue-card"><h2>Ask about repair</h2><p>Find a repair business to contact.</p><button class="primary blue" data-finder-start="repair">Explore</button></article>
        <article class="option-card green-card"><h2>Repair or replace?</h2><p>Compare the cost and what makes sense.</p><button class="primary green" data-demo>Explore</button></article>
        <article class="option-card yellow-card"><h2>Consider recycling</h2><p>Find a place that can handle the item safely.</p>${button('Explore', 'finder', 'primary orange')}</article>
      </div>`;
  }

  function recall() {
    return `<section class="screen-head compact"><h1>Sample recall screen</h1><p>Design example only. No official recall has been checked or matched.</p>${steps(1)}</section>
      <div class="big-result red-card"><p>Example appliance · Sample model</p><h2 class="blue-text">How a recall could appear</h2><p>In a real service, this screen would link to a verified official notice. This demonstration cannot tell you whether an item is recalled.</p><strong>For a real item, check the official Product Safety Australia recall information.</strong><div class="actions"><a class="danger" href="https://www.productsafety.gov.au/recalls" target="_blank" rel="noopener">Open official recall search</a></div></div>`;
  }

  function finder() {
    return `<section class="screen-head compact"><h1>What do you want to find?</h1><p>Choose one, then tell us where to look.</p></section>
      <div class="finder-kinds">${[['repair', 'Repair', 'orange-card'], ['donate', 'Donate or reuse', 'green-card'], ['recycle', 'Recycle', 'blue-card']].map(([value, label, colour]) => `<button class="finder-kind ${colour} ${state.finderType === value ? 'selected' : ''}" data-finder-type="${value}">${label}</button>`).join('')}</div>
      <div class="actions end"><button class="primary green" data-finder-next>Continue</button></div>`;
  }

  function finderLocation() {
    return `<section class="screen-head"><h1>Where are you?</h1><p class="lead">We’ll use this to show places nearby.</p></section>
      <div class="search-row"><input id="finder-location" value="${escapeHtml(state.suburb)}" placeholder="Enter suburb or postcode"><button class="primary" data-finder-search>Search</button></div>
      <div class="actions center"><button class="primary blue" data-current-location>Use current location</button></div><p class="center small">You can change this anytime.</p>`;
  }

  // Provider examples follow the selected service type so results never imply the wrong kind of help.
  const finderProviders = {
    repair: [
      ['Repair Café Brunswick', 'Repairs small electronics.'],
      ['TechFix Community Hub', 'Offers community repair support.'],
      ['Northside Repair Centre', 'Assesses household electronic repairs.'],
    ],
    donate: [
      ['Community Tech Reuse', 'Accepts working devices for reuse.'],
      ['Neighbourhood Donation Hub', 'Collects usable household electronics.'],
      ['Device Reuse Centre', 'Prepares donated devices for another user.'],
    ],
    recycle: [
      ['Council E-waste Drop-off', 'Accepts selected electronics for recycling.'],
      ['Electronics Recycling Hub', 'Collects devices for material recovery.'],
      ['Resource Recovery Centre', 'Handles approved local e-waste items.'],
    ],
  };

  function finderResults() {
    const providers = finderProviders[state.finderType] || finderProviders.repair;
    return `<section class="screen-head compact"><h1>${state.finderType === 'repair' ? 'Repair' : state.finderType === 'donate' ? 'Donation' : 'Recycling'} near ${escapeHtml(state.suburb)}</h1></section>
      <div class="popular"><button class="chip-button ${state.finderType === 'repair' ? 'active' : ''}" data-finder-type="repair">Repair</button><button class="chip-button ${state.finderType === 'donate' ? 'active' : ''}" data-finder-type="donate">Donate</button><button class="chip-button ${state.finderType === 'recycle' ? 'active' : ''}" data-finder-type="recycle">Recycle</button></div>
      <div class="finder-layout"><div class="map" aria-label="Illustrative map"><span class="pin one"></span><span class="pin two"></span><span class="pin three"></span></div><aside><h2>Nearby</h2><div class="places">
        ${providers.map(([name], index) => `<button class="place-card ${index === state.finderPlace ? 'active' : ''}" data-place="${index}"><h3>${name}</h3><p>${[1.2, 1.8, 2.4][index]} km · Details</p></button>`).join('')}
      </div></aside></div><p class="small">Prototype locations are fictional and must be replaced with verified provider data.</p>`;
  }

  function finderPlace() {
    const providers = finderProviders[state.finderType] || finderProviders.repair;
    const [name, service] = providers[state.finderPlace] || providers[0];
    return `<section class="screen-head compact"><h1>${name}</h1></section>
      <div class="alert warning"><strong>Fictional place for design review.</strong> Address, distance and opening hours are examples. No live provider search was performed.</div>
      <div class="finder-layout"><div class="map"><span class="pin one"></span></div><article class="panel"><h2>${name}</h2><p class="blue-text"><b>${[1.2, 1.8, 2.4][state.finderPlace] || 1.2} km away</b></p><p>Open Saturday 10am–2pm</p><p>${service}<br>Check the provider site before you go.</p><div class="actions"><button class="primary blue" data-demo>Directions</button><button class="primary" data-demo>Provider site</button></div></article></div>`;
  }

  function about() {
    return `<section class="screen-head"><h1>Why FixForward exists</h1><p>Helping families make better choices with electronics.</p></section>
      <div class="two-grid"><article class="panel blue-card"><h2>The problem</h2><p>Electronics use valuable materials and energy. When we throw them away too soon, those resources are lost.</p></article><article class="panel green-card"><h2>What we’re here to do</h2><p>FixForward helps children and families understand e-waste, think in a circular way, and make safer household decisions together.</p></article></div>
      <div class="alert warning"><strong>Not-for-profit. Made for learning.</strong><p>FixForward is designed to make trustworthy e-waste information easier to understand, not to sell products or push a brand.</p></div>
      <div class="actions"><a class="text-button" href="#/privacy">Privacy & data</a></div>`;
  }

  function privacy() {
    return `<section class="screen-head"><h1>Your privacy, in plain English</h1><p>You should know what FixForward uses and why.</p></section>
      <div class="privacy-grid"><article class="privacy-card blue-card"><h2>What we may use</h2><ul><li>Location only when you ask Finder to show nearby places.</li><li>A device photo only when you choose to scan an item.</li><li>Device details such as appliance type, brand or model when you enter them.</li></ul></article>
      <article class="privacy-card green-card"><h2>What we ask you not to share</h2><ul><li>Faces or selfies</li><li>Names and contact details</li><li>Personal documents</li><li>Anything you don’t want to share</li></ul></article></div>
      <div class="alert warning center"><strong>The idea is simple: use only what a feature needs, explain why, and keep the rest out.</strong></div>`;
  }

  const views = {
    home, tour, quest: questHub, fixit,
    'fixit/right': () => fixitResult(true), 'fixit/retry': () => fixitResult(false),
    loop, 'loop/right': () => loopResult(true), 'loop/retry': () => loopResult(false),
    city: cityIntro, 'city/play': cityPlay, 'city/upgrade': cityUpgrade, 'city/win': cityWin,
    lens: lensStart, 'lens/scan': lensScan, 'lens/confirm': lensConfirm,
    'lens/impact': lensImpact, 'lens/facts': lensFacts, 'lens/care': lensCare,
    pathway, 'pathway/not-found': itemNotFound, 'pathway/safety': safety,
    'pathway/options': options, 'pathway/recall': recall,
    finder, 'finder/location': finderLocation, 'finder/results': finderResults,
    'finder/place': finderPlace, about, privacy,
  };

  function render() {
    promptTimers.forEach(clearTimeout);
    promptTimers = [];
    const requestedPath = currentRoute();
    const path = views[requestedPath] ? requestedPath : 'home';
    const view = views[path];
    if (lastRenderedPath && lastRenderedPath !== path && !suppressTrailUpdate) routeTrail.push(lastRenderedPath);
    suppressTrailUpdate = false;
    lastRenderedPath = path;
    app.innerHTML = `${backNavigation(path)}${view()}`;
    document.querySelectorAll('[data-nav]').forEach(link => {
      const selected = (link.dataset.nav === 'home' && (path === 'home' || path === 'tour'))
        || (link.dataset.nav === 'about' && (path === 'about' || path === 'privacy'));
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    updateProgress();
    if (path === 'home') startHomePromptTour();
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;

    if (target.hasAttribute('data-go-back')) {
      const fallback = backTargets[currentRoute()] || 'home';
      const destination = routeTrail.pop() || fallback;
      suppressTrailUpdate = true;
      route(destination);
    } else if (target.dataset.fixit) {
      if (target.dataset.fixit === 'right') award({ energy: 10, stars: 1 });
      route(`fixit/${target.dataset.fixit}`);
    } else if (target.dataset.loop) {
      if (target.dataset.loop === 'right') award({ energy: 15, stars: 1 });
      route(`loop/${target.dataset.loop}`);
    } else if (target.hasAttribute('data-city-upgrade')) {
      state.cityUpgrade = target.dataset.cityUpgrade;
      const improvement = { recovery: 15, repairable: 20, sharing: 10 }[state.cityUpgrade] || 10;
      state.cityScore = Math.min(100, state.cityScore + improvement);
      state.landfill = Math.max(0, state.landfill - improvement);
      award({ energy: 10 });
      route('city/upgrade');
    } else if (target.hasAttribute('data-city-reset')) {
      state.cityScore = 25;
      state.landfill = 75;
      state.cityUpgrade = 'recovery';
      saveState();
      route('city');
    } else if (target.dataset.appliance) {
      state.appliance = target.dataset.appliance;
      saveState();
      render();
    } else if (target.hasAttribute('data-pathway-search')) {
      const value = document.querySelector('#appliance-search').value.trim();
      state.appliance = value || 'Unknown item';
      saveState();
      if (!['Kettle', 'Toaster', 'Hair dryer', 'Vacuum', 'Fan', 'Microwave'].includes(state.appliance)) route('pathway/not-found');
      else showToast(`${state.appliance} selected`);
    } else if (target.hasAttribute('data-pathway-continue')) {
      const brandInput = document.querySelector('#brand');
      const modelInput = document.querySelector('#model');
      const errorMessage = document.querySelector('#device-details-error');
      const brand = brandInput.value.trim();
      const model = modelInput.value.trim();
      const brandError = validateDeviceDetail(brand, 'Brand', 'brand');
      const modelError = validateDeviceDetail(model, 'Model number', 'model');
      brandInput.removeAttribute('aria-invalid');
      modelInput.removeAttribute('aria-invalid');
      if (brandError || modelError) {
        const invalidInput = brandError ? brandInput : modelInput;
        invalidInput.setAttribute('aria-invalid', 'true');
        errorMessage.textContent = brandError || modelError;
        errorMessage.hidden = false;
        invalidInput.focus();
        showToast('Check the optional device details before continuing.');
        return;
      }
      errorMessage.hidden = true;
      state.brand = brand;
      state.model = model;
      saveState();
      if (/rhk510/i.test(state.model)) route('pathway/recall');
      else route('pathway/safety');
    } else if (target.dataset.safetyIndex !== undefined) {
      state.safety[target.dataset.safetyIndex] = target.dataset.safetyAnswer;
      saveState();
      render();
    } else if (target.hasAttribute('data-safety-continue')) {
      if (Object.keys(state.safety).length < safetyQuestions.length) showToast('Please answer all five safety questions.');
      else route('pathway/options');
    } else if (target.dataset.finderType) {
      state.finderType = target.dataset.finderType;
      state.finderPlace = 0;
      saveState();
      render();
    } else if (target.dataset.finderStart) {
      state.finderType = target.dataset.finderStart;
      saveState();
      route('finder/location');
    } else if (target.hasAttribute('data-finder-next')) {
      route('finder/location');
    } else if (target.hasAttribute('data-finder-search')) {
      state.suburb = document.querySelector('#finder-location').value.trim() || state.suburb;
      saveState();
      route('finder/results');
    } else if (target.hasAttribute('data-current-location')) {
      showToast('Location is simulated in this local prototype.');
      route('finder/results');
    } else if (target.hasAttribute('data-place')) {
      state.finderPlace = Number(target.dataset.place) || 0;
      saveState();
      route('finder/place');
    } else if (target.hasAttribute('data-demo')) {
      showToast('This external action is disabled in the local prototype.');
    } else if (target.hasAttribute('data-dismiss-coach')) {
      sessionStorage.setItem('fixforward-home-coach-dismissed', 'true');
      target.closest('.home-coach')?.classList.add('dismissed');
    }
  });

  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/home';
  else render();
})();
