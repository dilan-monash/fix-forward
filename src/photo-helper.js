// Optional photo UI for the adult journey. The policy-controlled SigLIP helper
// is the only default recogniser; this module never loads a remote runtime or
// uploads a photo. A suggestion changes the appliance only after confirmation.
import { APPLIANCE_CLASSES, validatePhotoFile } from "./appliance-classifier.js?v=i3-photo-review-2";
import {
  classifyWithSiglipCandidate,
  friendlySiglipError,
  releaseSiglipModelSession,
  siglipClassifierAvailability,
  validateSiglipPhotoContent,
} from "./siglip-appliance-classifier.js?v=i3-photo-feedback-1";

const FIRST_USE_DOWNLOAD = "about 92 MB";

// A data URL displays the local file under our existing image security policy.
// Check the real image header/dimensions before decoding; never upload or persist it.
async function readPhotoPreview(file, signal, document) {
  await validateSiglipPhotoContent(file);
  if (signal.aborted) throw new Error("Preview cancelled");
  return new Promise((resolve, reject) => {
    const reader = new document.defaultView.FileReader();
    const abort = () => reader.abort();
    const finish = (callback, value) => {
      signal.removeEventListener("abort", abort);
      callback(value);
    };
    reader.onload = () => finish(resolve, reader.result);
    reader.onerror = reader.onabort = () => finish(reject, new Error("Preview unavailable"));
    signal.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(file);
  });
}

// Each rendered screen owns its helper and can dispose it on navigation or a
// manual choice. Injected dependencies let tests control errors and late replies
// without downloading weights, sending photos or pretending to test accuracy.
export function mountPhotoHelper(container, {
  onConfirm = () => {},
  onChooseManually = () => {},
  availability = siglipClassifierAvailability,
  recognise = classifyWithSiglipCandidate,
  formatError = friendlySiglipError,
  releaseSession = releaseSiglipModelSession,
  createPreview = readPhotoPreview,
} = {}) {
  let disposed = false;
  let generation = 0;
  let suggestion = null;
  let status;
  let controls;
  let result;
  let fileInput;
  let cameraInput;
  let activeController;
  let previewController;
  let preview;
  let feedbackTitle;
  let feedbackIcon;
  let progressBar;

  // Keep titles, icons and colours in sync. Words carry the meaning even when
  // someone cannot see colour or has animation disabled. The live region stays
  // outside aria-busy content so progress can be announced during inference.
  const feedback = (state, title, message) => {
    container.dataset.photoHelperStatus = state;
    status.dataset.state = state;
    feedbackTitle.textContent = title;
    feedbackIcon.textContent = ({ busy: "◌", error: "!", confirmed: "✓", "needs-confirmation": "?", "no-suggestion": "?" })[state] || "i";
    status.querySelector(".photo-feedback-message").textContent = message;
    progressBar.hidden = state !== "busy";
    progressBar.removeAttribute("value");
    if (state === "busy") result?.setAttribute("aria-busy", "true");
    else result?.removeAttribute("aria-busy");
  };
  // Replacing a photo or leaving the screen releases the previous image data.
  // A separate preview signal also prevents late FileReader replies after reset.
  const clearPreview = () => {
    previewController?.abort();
    previewController = undefined;
    if (!preview) return;
    preview.querySelector("img")?.removeAttribute("src");
    preview.replaceChildren();
    preview.hidden = true;
  };
  const showPreview = (file, canDisplay) => {
    preview.hidden = false;
    preview.innerHTML = `<img alt="Your selected appliance photo" hidden><figcaption><strong>Selected photo</strong><span class="photo-file-name"></span><span class="photo-preview-note"></span></figcaption>`;
    preview.querySelector(".photo-file-name").textContent = file.name || "Your photo";
    const note = preview.querySelector(".photo-preview-note");
    note.textContent = canDisplay ? "Preparing preview · stays on this device" : "Preview unavailable for this file";
    if (!canDisplay) return;
    const controller = new AbortController();
    previewController = controller;
    const image = preview.querySelector("img");
    const current = () => !disposed && !controller.signal.aborted;
    const unavailable = () => {
      if (!current()) return;
      image.hidden = true;
      image.removeAttribute("src");
      note.textContent = "Preview unavailable for this file";
    };
    image.onload = () => {
      if (!current()) return;
      image.hidden = false;
      note.textContent = "Photo selected · stays on this device";
    };
    image.onerror = unavailable;
    Promise.resolve().then(() => createPreview(file, controller.signal, container.ownerDocument))
      .then((url) => { if (current()) image.src = url; }).catch(unavailable);
  };

  // A new photo, a manual choice or navigation makes the previous request
  // irrelevant. The classifier checks this signal before each expensive stage.
  const cancelActiveRequest = () => {
    activeController?.abort();
    activeController = undefined;
  };

  // A paused experiment should not add a dead card to the adult journey. Keep
  // this region absent until policy permits either release use or the explicitly labelled I3 preview.
  container.replaceChildren();
  container.hidden = true;

  const clearInputs = () => {
    if (fileInput) fileInput.value = "";
    if (cameraInput) cameraInput.value = "";
  };
  // Clear only an unconfirmed photo, never the person's existing manual choice.
  const clearSuggestion = () => {
    suggestion = null;
    result?.replaceChildren();
  };
  const manualChoice = () => {
    cancelActiveRequest();
    ++generation;
    clearSuggestion();
    clearInputs();
    clearPreview();
    container.removeAttribute("aria-busy");
    if (status) feedback("manual", "Choose your appliance", "Choose the appliance below. Your existing selection has been kept.");
    onChooseManually();
  };

  // Initialise controls only after the no-store policy check. A policy/network
  // failure leaves the existing manual journey visible and exposes no debug text.
  Promise.resolve().then(availability).then((policy) => {
    if (disposed) return;
    if (!policy.enabled) {
      container.dataset.photoHelperStatus = policy.reason || "unavailable";
      return;
    }
    // Load one small shared stylesheet for both adult entry points; no new font
    // downloads or UI library are needed for the preview and status hierarchy.
    const document = container.ownerDocument;
    if (!document.getElementById("photo-helper-styles")) {
      const link = document.createElement("link");
      link.id = "photo-helper-styles";
      link.rel = "stylesheet";
      link.href = new URL("./photo-helper.css?v=i3-photo-feedback-1", import.meta.url).href;
      document.head.append(link);
    }
    container.innerHTML = `<section class="photo-detect-card" aria-labelledby="photo-detect-title">
      <div><p class="eyebrow">${policy.experimental ? "Experimental photo helper" : "Optional photo helper"}</p><h2 id="photo-detect-title">Identify an appliance from a photo</h2>
      <p>Try one clear photo of the whole appliance. This preview may be wrong or unable to suggest a type. It cannot identify faults, check recalls or confirm safety.</p>
      <p class="photo-download-note">First use downloads ${FIRST_USE_DOWNLOAD}. Wi-Fi is recommended.</p>
      </div><figure class="photo-selected-preview" id="photo-selected-preview" hidden></figure>
      <div id="photo-detect-status" class="photo-feedback" role="status" aria-live="polite" aria-atomic="true">
        <span class="photo-feedback-icon" aria-hidden="true"></span><div><strong class="photo-feedback-title"></strong><p class="photo-feedback-message"></p></div>
      </div><progress class="photo-progress" aria-label="Photo helper model download" max="100" hidden></progress>
      <div class="photo-detect-actions" id="photo-input-controls"></div>
    </section><div id="photo-result"></div>`;
    container.hidden = false;
    container.dataset.photoHelperStatus = "ready";
    status = container.querySelector("#photo-detect-status");
    controls = container.querySelector("#photo-input-controls");
    result = container.querySelector("#photo-result");
    preview = container.querySelector("#photo-selected-preview");
    feedbackTitle = status.querySelector(".photo-feedback-title");
    feedbackIcon = status.querySelector(".photo-feedback-icon");
    progressBar = container.querySelector(".photo-progress");
    feedback("ready", "Ready for your photo", "JPG, PNG or WebP · max 10 MB. You will confirm any suggestion yourself.");
    controls.innerHTML = `<label class="button secondary photo-camera-button" for="appliance-camera" tabindex="0" role="button" aria-label="Take an appliance photo with the rear camera">Take photo</label>
      <input id="appliance-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
      <label class="photo-dropzone" for="appliance-photo" tabindex="0" role="button" aria-label="Choose an appliance photo">
      <span class="button secondary">Choose photo</span><span>or drag a photo here</span></label>
      <input id="appliance-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <button class="text-button" id="photo-choose-manually" type="button">Choose manually</button>`;
    fileInput = controls.querySelector("#appliance-photo");
    cameraInput = controls.querySelector("#appliance-camera");
    const dropzone = controls.querySelector(".photo-dropzone");
    const cameraButton = controls.querySelector(".photo-camera-button");

    // Translate model-download events into short progress copy. Some runtime
    // events omit a percentage, so the UI still reports that preparation is active.
    const showProgress = (event, isCurrent) => {
      if (!isCurrent()) return;
      if (event?.status === "analysing") {
        feedback("busy", "Checking your photo…", "Looking for the appliance type. You can still choose manually.");
        progressBar.hidden = true;
        return;
      }
      const progress = event?.progress == null ? NaN : Number(event.progress);
      if (Number.isFinite(progress)) {
        const percentage = Math.max(0, Math.min(100, Math.round(progress)));
        feedback("busy", "Loading the photo helper…", `Model download: ${percentage}%. Your photo stays on this device. You can still choose manually.`);
        progressBar.value = percentage;
      } else {
        feedback("busy", "Preparing the photo helper…", "Your photo is selected. You can still choose manually.");
      }
    };

    // The request number protects a newer photo/manual choice from old replies.
    // Selecting a file only produces a review card, never an appliance update.
    const processPhoto = async (file, sourceInput) => {
      if (!file || disposed) return;
      cancelActiveRequest();
      const request = ++generation;
      const isCurrent = () => !disposed && generation === request;
      clearSuggestion();
      clearPreview();
      container.removeAttribute("aria-busy");
      const validation = validatePhotoFile(file);
      showPreview(file, validation.ok);
      if (!validation.ok) {
        feedback("error", "We couldn’t use this file", validation.error);
        if (sourceInput) sourceInput.value = "";
        return;
      }
      const requestController = new AbortController();
      activeController = requestController;
      feedback("busy", "Photo selected · preparing the helper…", `First use downloads ${FIRST_USE_DOWNLOAD}. You can still choose manually.`);
      try {
        const payload = await recognise(file, {
          onProgress: (event) => showProgress(event, isCurrent),
          signal: requestController.signal,
        });
        if (!isCurrent()) return;
        if (!payload.accepted || !payload.requiresConfirmation) {
          feedback("no-suggestion", "No suggestion this time", payload.reason === "recognition_paused"
            ? "Photo suggestions are temporarily unavailable. Choose your appliance below."
            : "We could not suggest an appliance from this photo. Try another photo or choose manually.");
          return;
        }
        const candidate = payload.alternatives?.[0];
        suggestion = APPLIANCE_CLASSES.find((item) => item.slug === candidate?.slug && item.category === candidate?.category);
        if (!suggestion) throw new Error("Unrecognised suggestion");
        // Fixed markup plus textContent prevents a model label becoming HTML.
        result.innerHTML = `<section class="photo-confirm-card" aria-labelledby="photo-result-title">
          <p class="eyebrow">Please check this suggestion</p><h2 id="photo-result-title" tabindex="-1"></h2>
          <p>This may be wrong. Confirm only if it matches your appliance. A photo cannot check its safety or diagnose a fault.</p>
          <div class="photo-confirm-actions"><button class="button primary" id="confirm-photo-appliance" type="button"></button>
          <button class="button secondary" id="reject-photo-appliance" type="button">No, choose manually</button>
          <button class="text-button" id="change-photo-appliance" type="button">Try another photo</button></div>
        </section>`;
        result.querySelector("h2").textContent = `Could this be a ${suggestion.label.toLowerCase()}?`;
        const confirm = result.querySelector("#confirm-photo-appliance");
        confirm.textContent = `Yes, select ${suggestion.label}`;
        confirm.addEventListener("click", () => {
          if (!isCurrent() || !suggestion) return;
          const confirmed = suggestion;
          ++generation;
          clearSuggestion();
          clearInputs();
          feedback("confirmed", `${confirmed.label} selected`, "Add the brand and model below if you know them.");
          onConfirm(confirmed);
        });
        result.querySelector("#reject-photo-appliance").addEventListener("click", manualChoice);
        result.querySelector("#change-photo-appliance").addEventListener("click", () => {
          ++generation;
          clearSuggestion();
          clearPreview();
          feedback("ready", "Choose another photo", "Choose another photo, take a new one, or select your appliance below.");
          fileInput.click();
        });
        feedback("needs-confirmation", "Suggestion ready · please check", "Check the suggestion. Your appliance selection has not changed.");
        result.querySelector("h2").focus({ preventScroll: true });
      } catch (error) {
        if (isCurrent()) {
          feedback("error", error?.code === "invalid_image_content" ? "We couldn’t read this photo" : "Photo check couldn’t finish", formatError(error));
        }
      } finally {
        if (activeController === requestController) activeController = undefined;
        if (isCurrent()) {
          container.removeAttribute("aria-busy");
          result.removeAttribute("aria-busy");
          clearInputs();
        }
      }
    };

    fileInput.addEventListener("change", (event) => processPhoto(event.target.files?.[0], fileInput));
    cameraInput.addEventListener("change", (event) => processPhoto(event.target.files?.[0], cameraInput));
    fileInput.addEventListener("cancel", manualChoice);
    cameraInput.addEventListener("cancel", manualChoice);
    controls.querySelector("#photo-choose-manually").addEventListener("click", manualChoice);
    cameraButton.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); cameraInput.click(); }
    });
    dropzone.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); fileInput.click(); }
    });
    dropzone.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag-over");
      processPhoto(event.dataTransfer.files?.[0]);
    });
  }).catch((error) => {
    if (!disposed) {
      // Availability failures behave like a paused model: the manual route is
      // visible and no raw exception or broken optional control is displayed.
      container.dataset.photoHelperStatus = error?.code || "unavailable";
      container.replaceChildren();
      container.hidden = true;
    }
  });

  // The shared serialization queue waits for an active inference before safely
  // releasing its model session. Disposal is idempotent across repeated renders.
  return () => {
    if (disposed) return;
    disposed = true;
    cancelActiveRequest();
    clearPreview();
    ++generation;
    suggestion = null;
    void Promise.resolve().then(releaseSession).catch(() => undefined);
  };
}
