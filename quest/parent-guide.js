/**
 * Parent-guide content, separate from the child screen controller. This pure
 * renderer returns HTML only: app.js owns navigation, speech, storage and focus.
 * Optional flags describe the current session without exposing the whole save.
 */
import { SOURCES } from './content.js';
import { artwork, scene } from './art.js';

// Treat supplied mission text as text, even if this renderer is reused elsewhere.
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

// Introduce the two existing guides on a dimensional paper stage. The names and
// appliance identities stay visible outside the decorative art, so the greeting
// still makes sense to a screen reader or when a device reduces animation.
function renderFamilyWelcome() {
  return `<section class="q-family-welcome" aria-labelledby="q-family-title">
    <div class="q-family-copy">
      <p class="q-eyebrow">Welcome to FixForward Quest</p>
      <h1 id="q-family-title" data-focus tabindex="-1">For parents and curious families</h1>
      <p class="q-family-lead">Small choices can give things a new story.</p>
      <!-- A practical starting point, not an age gate or a timed learning claim. -->
      <p class="q-family-quick-facts"><strong>Designed for ages 7–12.</strong> Plan for about 5–10 minutes to explore one story, or try a five-picture sorting round. This is a planning guide: children can take their time and stop whenever they like.</p>
      <p>Quest is a picture-story game about caring for the things around us. Your child follows clues, chooses what happens next and discovers why a choice fits. A fan might find a new home. A warning might mean stopping to ask for help.</p>
      <p><strong>Your child is the decision-maker.</strong> They can try again, ask for a hint or hear the words. There is no timer to race.</p>
      <button class="q-button primary" data-picker>Explore the stories <span aria-hidden="true">→</span></button>
      <p class="q-family-screen-note">Stories, sorting and a postcard studio. All the play stays on screen.</p>
    </div>
    <figure class="q-family-art">
      <div class="q-family-world" aria-hidden="true">
        <span class="q-family-orbit q-family-orbit--one"></span><span class="q-family-orbit q-family-orbit--two"></span>
        <span class="q-family-shine q-family-shine--one">✦</span><span class="q-family-shine q-family-shine--two">✧</span><span class="q-family-shine q-family-shine--three">✦</span>
        <div class="q-family-platform"></div>
        <div class="q-family-character q-family-character--pip">${artwork('pip', { expression: 'success' })}</div>
        <div class="q-family-character q-family-character--flo">${artwork('flo')}</div>
        <div class="q-family-greeting">Every thing has a story.</div>
      </div>
      <figcaption><span><b>Pip</b> the toaster</span><span><b>Flo</b> the fan</span><small>Two familiar friends. Different stories to explore.</small></figcaption>
    </figure>
  </section>`;
}

// A single fictional fan example connects the learning steps. Each picture is
// paired with the evidence it represents: the drawing alone never proves that
// a real appliance works or is safe to give away. This preview awards no points.
function renderLearningPath() {
  const steps = [
    { title: 'Look', picture: 'evidence', tone: 'blue', example: 'The story report says: “A trained repairer checked this fan. It works.” Sam’s sharing checks are done, and Bea wants the fan.', practice: 'Your child finds the useful facts.' },
    { title: 'Choose', picture: 'flo', tone: 'mint', example: '“Could someone else use it?” Your child chooses a new home for the working fan.', practice: 'They connect the clue to a next step.' },
    { title: 'Discover', picture: 'postcard', tone: 'sun', example: 'The next picture shows the fan in its new home. A short question asks which clue helped.', practice: 'They see the result and explain their choice.' }
  ];
  return `<section class="q-family-learning" aria-labelledby="q-family-learning-title">
    <div class="q-family-learning-heading"><p class="q-eyebrow">How learning happens</p><h2 id="q-family-learning-title">Play a choice. See its story.</h2><p>Here is one made-up fan story. Different clues can lead to a different ending.</p></div>
    <ol class="q-family-steps">${steps.map((step, index) => `<li data-tone="${step.tone}"><div class="q-family-step-top"><span class="q-family-step-number" aria-hidden="true">${index + 1}</span>${step.picture === 'postcard' ? scene('home', 'fan', 'reuse') : artwork(step.picture)}</div><h3>${step.title}</h3><p>${step.example}</p><p class="q-family-practice">${step.practice}</p></li>`).join('')}</ol>
    <p class="q-family-help-note"><strong>A wrong turn is part of play.</strong> The game explains the clue and invites another try. Hints and retries do not reduce the reward.</p>
  </section>`;
}

// Preview one authored outcome using the same local illustrations as the game.
// app.js switches data-parent-demo-stage and the button label; this helper never
// changes a mission, checks a real appliance or awards progress for watching.
function renderParentDemo() {
  return `<section class="q-parent-demo" data-parent-demo-stage="before" aria-label="Preview a made-up Quest story">
    <p class="q-eyebrow">A little look inside</p><h2>Flo's next chapter</h2>
    <div class="q-parent-demo-pictures" id="q-parent-demo-pictures">
      <div class="q-parent-demo-frame" data-parent-demo-frame="before">${scene('home', 'fan')}<p><b>Before</b> A working fan needs a new home.</p></div>
      <div class="q-parent-demo-frame" data-parent-demo-frame="after">${scene('home', 'fan', 'reuse')}<p><b>After</b> A family welcomes Flo.</p></div>
    </div>
    <p class="q-parent-demo-caption">In this made-up story, a trained repairer has checked Flo. Her sharing checks are done, and Bea wants her. Your child connects both clues to choose a new home.</p>
    <button class="q-button secondary" data-parent-demo aria-pressed="false" aria-controls="q-parent-demo-pictures">See the story change</button>
  </section>`;
}

/**
 * Return a scannable parent guide and optional in-progress story prompt.
 * The app may supply its shared escape helper. Fixed data-* controls use the
 * same existing handlers as the child screens; this module binds no events.
 */
export function renderParentGuide({
  activeMission = null, canContinueMission = false, canContinueSorting = false,
  storageAvailable = true, reviewFixture = false, escape = escapeText
} = {}) {
  // These source links explain general rules. They are not fetched during play
  // and do not imply that UNICEF endorses Quest or validates this age range.
  const sourceLinks = SOURCES.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener">${escape(source.publisher)}: ${escape(source.title)}<span class="q-sr"> (opens in a new tab)</span></a></li>`).join('');
  return `<section class="q-page q-parent-guide">
    <button class="q-back" data-nav="home">← Back to the adventure map</button>
    <!-- Restore the requested family introduction before the preferred purpose section. -->
    ${renderFamilyWelcome()}
    ${renderLearningPath()}
    <!-- Keep the warm illustrated purpose layout chosen by the user. -->
    <section class="q-parent-why q-parent-restored-intro" aria-labelledby="q-parent-purpose-title">
      <p class="q-eyebrow">Why this website?</p>
      <h2 id="q-parent-purpose-title">“Throw it away” is only one possible ending.</h2>
      <p>Children can practise noticing a clue, asking a useful question and choosing a next step. A working item may find another home. A repair needs the right person and evidence. A warning means pause and get help. The story supplies the facts, so children can reason without handling real appliances.</p>
    </section>

    <!-- Each illustration is decorative; the adjacent heading explains the learning aim. -->
    <section class="q-parent-learning" aria-labelledby="q-parent-practice-title">
      <h2 id="q-parent-practice-title">What children practise</h2>
      <div class="q-parent-goals q-parent-restored-goals">
        <article>${artwork('flo')}<h3>Look before deciding</h3><p>The same fan appears in different stories. Its clues change the answer.</p></article>
        <article>${artwork('evidence')}<h3>Explain a choice</h3><p>A short picture question asks which clue mattered.</p></article>
        <article>${artwork('box')}<h3>Give things different paths</h3><p>A toaster and its clean box may need different next steps.</p></article>
        <article>${artwork('flo', { expression: 'thinking' })}<h3>Ask when unsure</h3><p>Missing information is a reason to ask for help.</p></article>
      </div>
    </section>

    <!-- A practical invitation helps parents join in without taking over the child's choices. -->
    <section class="q-parent-restored-join" aria-labelledby="q-parent-join-title">
      <div class="q-parent-restored-companion">${artwork('pip')}</div>
      <div class="q-parent-restored-join-copy">
        <p class="q-eyebrow">A small way to join in</p>
        <h2 id="q-parent-join-title">Let your child lead</h2>
        <p>Ask about the clue, then give your child time to decide. A hint is always available.</p>
        <blockquote>“What did you spot that helped you choose?”</blockquote>
        <button class="q-button secondary" data-picker>Choose a story →</button>
        ${activeMission ? `<div class="q-parent-restored-current"><h3>In this story: ${escape(activeMission.title)}</h3><p>${escape(activeMission.learningGoal)}</p><blockquote>“${escape(activeMission.discussionPrompt)}”</blockquote>${canContinueMission ? '<button class="q-button secondary" data-continue>Return to this story</button>' : ''}</div>` : ''}
      </div>
    </section>

    <!-- The optional preview stays below the purpose and parent invitation; it awards no Sparks. -->
    <section class="q-parent-restored-preview" aria-label="Meet the game and see a story">
      <div class="q-parent-restored-game">
        <p class="q-eyebrow">Meet the adventure</p><h2>Little choices. Different endings.</h2>
        <p><strong>Pip is the toaster. Flo is the fan.</strong> These two story friends guide a picture game about caring for things. Your child finds clues, chooses a plan and sees what happens.</p>
        <p>Stories turn choices into a before-and-after scene. Sorting lets children move an item to a suitable place. My creations keeps the postcards they design. The adventure map is a menu of places to play, not a real map.</p>
        <p>Your child can stop, replay or choose another activity. There is no countdown. A hint or another try never costs points.</p>
        <a class="q-button secondary" href="/" target="_blank" rel="noopener">Help with a real appliance ↗<span class="q-sr"> (opens in a new tab)</span></a>
      </div>
      ${renderParentDemo()}
    </section>

    <details class="q-parent-details"><summary>Safety: the adventure stays on screen</summary>
      <p>Every appliance, check and report in Quest is fictional. Children never need to touch, test, open, repair or move a real appliance or damaged battery to play.</p>
      <p>Warning stories teach children to leave the item alone and tell a trusted adult. A picture cannot confirm safety, diagnose a fault or clear a recall. Use the separate household guide for a real item.</p>
      ${reviewFixture ? '<p class="q-review-note">This local preview uses invented adult test records. They are not real service or recall results. <a href="/test-fixture-info" target="_blank" rel="noopener">About the review data<span class="q-sr"> (opens in a new tab)</span></a>.</p>' : ''}
    </details>
    <details class="q-parent-details"><summary>What do Sparks and levels mean?</summary>
      <p>Sparks mark completed stories, new ideas and correct picture reflections. Four levels celebrate that progress. Hints and retries earn the same rewards. Replaying an earned story does not earn its points again.</p>
      <p>These are game rewards, not a school mark, ability rating or measure of waste saved.</p>
    </details>
    <details class="q-parent-details"><summary>Saving, privacy and read aloud</summary>
      <p>Quest saves progress, designs and settings in this browser. It asks for no player name, birthday, photo or contact details. Quest sends no child scores or play analytics.</p>
      <p>${storageAvailable ? 'Clearing browser data can remove saved progress. Reset my adventure clears the Quest save.' : 'Saving is blocked in this browser. Your child can still play during this visit.'} The household appliance journey is separate.</p>
      <!-- Sound effects and browser speech have separate controls and saved choices. -->
      <p>On a new adventure, game sounds and story reading are ready after the first tap. Saved choices are remembered. Sound mutes the short chimes; Settings can switch automatic reading or supported touch feedback off. Read to me reads the current screen. Winning uses musical chimes, without spoken congratulations. Pause and Resume control reading aloud; Stop ends the reading.</p>
      <!-- Be clear about the story voice's origin and the device-voice fallback.
           Audio playback never asks for a microphone or records the child. -->
      <p>The story voice is made with AI and included with the game. Its words stay visible, too. Other words may use your device's voice, which also helps if a story recording cannot play. Some voices may use an online service.</p>
      <p>Quest does not record your child or send their voice anywhere. Visible words remain if a voice is unavailable. First access needs the website; offline access is not promised.</p>
    </details>
    <details class="q-parent-details"><summary>Where the ideas and rules come from</summary>
      <p>Electrical-safety and waste-service guidance supports the story rules. Paper and cardboard examples use Merri-bek, Victoria rules. An adult still needs to check a real service's acceptance of a particular item.</p>
      <p>UNICEF's RITEC research informs our choices about player control and creativity. It does not endorse Quest or prove that this game improves learning. We have not measured learning improvements or tested this version with children.</p>
      <ul class="q-source-list">${sourceLinks}</ul>
    </details>
    <div class="q-parent-actions"><button class="q-button primary" data-nav="home">Back to the adventure map →</button>${canContinueSorting ? '<button class="q-button secondary" data-nav="sorting">Return to sorting</button>' : ''}</div>
  </section>`;
}
