/** Local-only browser smoke test. Public sample pixels come from an explicit
 * same-origin fixture, not an injected filesystem read or external AI request.
 * Clicking Run calls the exact classifier that the Explore photo UI calls.
 */
import { classifyExplorePhoto, exploreClassifierAvailability, friendlyExploreError, releaseExploreModelSession } from '/src/explore-classifier.js';
const cards = document.querySelector('#cards');
const status = document.querySelector('#status');
const run = document.querySelector('#run');
let samples = [];
try {
  const response = await fetch('/__explore-test/samples.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Samples unavailable');
  samples = await response.json();
  for (const [index, sample] of samples.entries()) {
    const card = document.createElement('article');
    card.dataset.index = index;
    const image = document.createElement('img'); image.src = sample.data_url; image.alt = sample.label;
    const title = document.createElement('h2'); title.textContent = sample.label;
    const result = document.createElement('p'); result.className = 'result'; result.textContent = 'Not checked yet';
    const source = document.createElement('a'); source.href = sample.source_url; source.textContent = sample.license; source.target = '_blank'; source.rel = 'noopener';
    card.append(image, title, result, source); cards.append(card);
  }
  const availability = await exploreClassifierAvailability();
  run.textContent = `Check all ${samples.length} sample photos`;
  run.disabled = !availability.available;
  status.textContent = availability.available ? 'Ready. First use downloads the model; all photos stay in this browser.' : availability.message;
} catch { status.textContent = 'The local evidence fixture could not be loaded.'; }

// Sequential inference avoids racing model sessions or queuing many large photo
// decodes. The expected label is used only to mark the test after recognition.
run.addEventListener('click', async () => {
  run.disabled = true;
  let correct = 0, wrong = 0, rejected = 0, negativeRejected = 0, negativeOffered = 0;
  const cases = [];
  try {
    // Record the actual candidate/policy used by this run. Previous 16-item
    // evidence remains a separate version and must not be relabelled as 32-item.
    const policy = await (await fetch('/model/explore-siglip/model_manifest.json', {cache:'no-store'})).json();
    for (const [index, sample] of samples.entries()) {
      const card = cards.querySelector(`[data-index="${index}"]`);
      const row = card.querySelector('.result'); row.textContent = 'Checking…';
      status.textContent = `Checking ${index + 1} of ${samples.length}: ${sample.label}`;
      const blob = await (await fetch(sample.data_url)).blob();
      const file = new File([blob], `${sample.slug}.jpg`, { type: blob.type });
      const answer = await classifyExplorePhoto(file, { onProgress: event => {
        if (event.stage === 'loading' && Number.isFinite(event.progress)) row.textContent = `Preparing model: ${Math.round(event.progress)}%`;
      } });
      const supported = !sample.kind || sample.kind === 'supported';
      const isCorrect = answer.alternatives.some(item => item.slug === sample.slug);
      const outcome = !supported ? (answer.accepted ? 'wrong' : 'correct') : !answer.accepted ? 'rejected' : isCorrect ? 'correct' : 'wrong';
      card.dataset.result = outcome;
      if (!supported) { if (answer.accepted) negativeOffered++; else negativeRejected++; }
      else if (outcome === 'correct') correct++; else if (outcome === 'wrong') wrong++; else rejected++;
      row.textContent = answer.accepted ? `Suggestion: ${answer.alternatives.map(item => item.label).join(' / ')}` : 'No suggestion; manual choice stays available.';
      cases.push({id:sample.id || sample.slug, expected:sample.slug, kind:sample.kind || 'supported', split:sample.split || 'calibration', accepted:answer.accepted, choices:answer.alternatives.map(item=>item.slug), outcome});
    }
    status.textContent = `Finished: ${correct} correct choice sets, ${wrong} wrong choice sets, ${rejected} supported photos rejected. Controls: ${negativeRejected} rejected, ${negativeOffered} incorrectly offered.`;
    document.querySelector('#report').textContent = JSON.stringify({scope:'Actual Chrome model run; limited development photos',candidate_id:policy.candidate_id,active_count:policy.active_labels.length,acceptance:policy.acceptance,text_manifest_sha256:policy.text_embeddings.manifest_sha256,totals:{correct,wrong,rejected,negativeRejected,negativeOffered},cases},null,2);
  } catch (error) { status.textContent = `Browser check stopped: ${friendlyExploreError(error)}`; }
  finally { run.disabled = false; await releaseExploreModelSession(); }
});
