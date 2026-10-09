// Optional photo UI for the adult journey. The policy-controlled SigLIP helper
// is the only default recogniser; this module never loads a remote runtime or
// uploads a photo. A suggestion changes the appliance only after confirmation.
import { APPLIANCE_CLASSES, validatePhotoFile } from "./appliance-classifier.js?v=i3-photo-review-2";
import {
  classifyWithSiglipCandidate,
  friendlySiglipError,
  releaseSiglipModelSession,
  siglipClassifierAvailability,
} from "./siglip-appliance-classifier.js?v=i3-photo-preview-3";

const FIRST_USE_DOWNLOAD = "about 92 MB";

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
    container.removeAttribute("aria-busy");
    container.dataset.photoHelperStatus = "manual";
    if (status) status.textContent = "Choose the appliance below. Your existing selection has been kept.";
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
    container.innerHTML = `<section class="photo-detect-card" aria-labelledby="photo-detect-title">
      <div><p class="eyebrow">${policy.experimental ? "Experimental photo helper" : "Optional photo helper"}</p><h2 id="photo-detect-title">Identify an appliance from a photo</h2>
      <p>Try one clear photo of the whole appliance. This preview may be wrong or unable to suggest a type. It cannot identify faults, check recalls or confirm safety.</p>
      <p class="photo-download-note">First use downloads ${FIRST_USE_DOWNLOAD}. Wi-Fi is recommended.</p>
      <p id="photo-detect-status" role="status" aria-live="polite"></p></div>
      <div class="photo-detect-actions" id="photo-input-controls"></div>
    </section><div id="photo-result"></div>`;
    container.hidden = false;
    container.dataset.photoHelperStatus = "ready";
    status = container.querySelector("#photo-detect-status");
    controls = container.querySelector("#photo-input-controls");
    result = container.querySelector("#photo-result");
    status.textContent = "Photo suggestions can be wrong. You will confirm the appliance yourself. JPG, PNG or WebP · max 10 MB. Processing stays in this browser.";
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
      const progress = Number(event?.progress);
      if (Number.isFinite(progress)) {
        const percentage = Math.max(0, Math.min(100, Math.round(progress)));
        status.textContent = `Loading the photo helper… ${percentage}%. You can still choose manually.`;
      } else {
        status.textContent = "Preparing the photo helper on this device… You can still choose manually.";
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
      container.removeAttribute("aria-busy");
      const validation = validatePhotoFile(file);
      if (!validation.ok) {
        status.textContent = validation.error;
        if (sourceInput) sourceInput.value = "";
        return;
      }
      const requestController = new AbortController();
      activeController = requestController;
      container.setAttribute("aria-busy", "true");
      container.dataset.photoHelperStatus = "busy";
      status.textContent = `Preparing the photo helper (${FIRST_USE_DOWNLOAD} on first use)… You can still choose manually.`;
      try {
        const payload = await recognise(file, {
          onProgress: (event) => showProgress(event, isCurrent),
          signal: requestController.signal,
        });
        if (!isCurrent()) return;
        if (!payload.accepted || !payload.requiresConfirmation) {
          status.textContent = payload.reason === "recognition_paused"
            ? "Photo suggestions are temporarily unavailable. Choose your appliance below."
            : "We could not suggest an appliance from this photo. Try another photo or choose manually.";
          container.dataset.photoHelperStatus = "no-suggestion";
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
          container.dataset.photoHelperStatus = "confirmed";
          status.textContent = `${confirmed.label} selected. Add the brand and model below if you know them.`;
          onConfirm(confirmed);
        });
        result.querySelector("#reject-photo-appliance").addEventListener("click", manualChoice);
        result.querySelector("#change-photo-appliance").addEventListener("click", () => {
          ++generation;
          clearSuggestion();
          status.textContent = "Choose another photo, take a new one, or select your appliance below.";
          container.dataset.photoHelperStatus = "ready";
          fileInput.click();
        });
        status.textContent = "Check the suggestion. Your appliance selection has not changed.";
        container.dataset.photoHelperStatus = "needs-confirmation";
        result.querySelector("h2").focus({ preventScroll: true });
      } catch (error) {
        if (isCurrent()) {
          status.textContent = formatError(error);
          container.dataset.photoHelperStatus = "error";
        }
      } finally {
        if (activeController === requestController) activeController = undefined;
        if (isCurrent()) {
          container.removeAttribute("aria-busy");
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
    ++generation;
    suggestion = null;
    void Promise.resolve().then(releaseSession).catch(() => undefined);
  };
}
