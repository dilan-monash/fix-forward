/** The standalone player uses an external module so I3's security policy can
 * keep inline scripts blocked. Playback still starts only after a user action. */
export function mountFilm(doc, { fetcher = globalThis.fetch } = {}) {
  const view = doc.defaultView;
  const video = doc.querySelector('#product-film');
  const play = doc.querySelector('#play-film');
  const error = doc.querySelector('#film-error');
  const controller = new view.AbortController();
  const options = { signal: controller.signal };
  let chapterButtons = [], disposed = false;
  const stamp = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const begin = () => Promise.resolve(video.play()).catch(() => { if (!disposed) error.hidden = false; });
  play.addEventListener('click', () => { error.hidden = true; video.paused ? begin() : video.pause(); }, options);
  video.addEventListener('play', () => { play.textContent = 'Ⅱ Pause the film'; }, options);
  video.addEventListener('pause', () => { play.textContent = video.ended ? '↻ Replay the film' : '▶ Play with narration'; }, options);
  video.addEventListener('ended', () => { play.textContent = '↻ Replay the film'; }, options);
  video.addEventListener('error', () => { error.hidden = false; }, options);
  video.addEventListener('timeupdate', () => {
    for (const { button, scene } of chapterButtons) {
      if (video.currentTime >= scene.start && video.currentTime < scene.end) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }, options);
  // Pause on navigation while keeping controls ready if the browser restores
  // this page from its back/forward cache. Explicit disposal cancels metadata.
  const dispose = () => { if (disposed) return; disposed = true; controller.abort(); video.pause(); };
  view.addEventListener('pagehide', () => video.pause(), options);
  const ready = (async () => {
    try {
      const response = await fetcher('/prototypes/i3-family-landing/assets/product-film.json', { signal: controller.signal });
      if (!response.ok) throw new Error('Film details unavailable');
      const film = await response.json();
      if (disposed) return;
      doc.querySelector('#film-meta').textContent = `${stamp(Math.ceil(film.duration))} · 1080p · Australian narration · Captions`;
      const transcript = doc.querySelector('#transcript');
      const chapters = doc.querySelector('#chapters');
      transcript.replaceChildren(); chapters.replaceChildren();
      for (const scene of film.scenes) {
        const button = doc.createElement('button'); button.type = 'button';
        const time = doc.createElement('time'); time.textContent = stamp(scene.start);
        const label = doc.createElement('span'); label.textContent = scene.title;
        button.append(time, label);
        button.addEventListener('click', () => { error.hidden = true; video.currentTime = scene.start; begin(); }, options);
        chapters.append(button); chapterButtons.push({ button, scene });
        const heading = doc.createElement('h3'); heading.textContent = `${stamp(scene.start)} — ${scene.title}`;
        const words = doc.createElement('p'); words.textContent = scene.narration;
        transcript.append(heading, words);
      }
    } catch {
      if (!disposed) doc.querySelector('#chapters').textContent = 'Use the video controls to move through the story.';
    }
  })();
  return { dispose, ready };
}

if (typeof document !== 'undefined') mountFilm(document);
