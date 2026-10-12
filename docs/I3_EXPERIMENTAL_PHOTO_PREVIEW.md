# Iteration 3 experimental photo preview

The user authorised this preview on 10 October 2026 after being told that v3
failed its release gate. The frozen candidate policies and recorded failures are
unchanged. `release_ready` remains false. This feature suggests an appliance
type only; it does not recognise a brand/model, diagnose faults or decide safety.

## What the person sees

Open **Take action -> Check a recall**. The card says **Experimental photo
helper** and offers **Choose photo**, **Take photo** and **Choose manually**.
It discloses a roughly 92 MB first-use download before a file is chosen.
JPG, PNG and WebP are supported, up to 10 MB and 30 megapixels. Image content is
checked before model loading. Photos are processed in the browser, not uploaded.

The selected photo now appears as a local thumbnail with its filename. A bold
status panel distinguishes preparation/download, photo analysis, a suggestion
awaiting confirmation, confirmation and errors using words, icons and colour.
Unreadable files retain their filename but show no broken thumbnail. The real
header/dimensions are checked before preview decoding; replacing the photo,
choosing manually or leaving the page clears its image data. No photo is stored.
The shared styles live in `src/photo-helper.css`; the backend serves only this
named stylesheet, behind the same login gate as the adult form.

A rejected/ambiguous photo offers another photo or manual selection. An accepted
result asks **Could this be a fan?** (or the suggested category). Only **Yes,
select ...** changes the category. Brand, model and recall checks remain separate
user actions. Neither raw scores nor invented confidence percentages are shown.

## Code path for a developer

1. `prototypes/i3-world-preview/action.js` mounts `src/photo-helper.js` in the
   adult recall form. The original adult flow in `src/app.js` reuses this helper.
2. Availability reads `model/appliance-siglip/model_manifest.json` with no-store.
   `validateSiglipPolicy` pins v3's existing class list, margins and asset hashes.
   `canRunSiglipPolicy` requires the explicit preview flag, recognition enabled,
   release-ready false and the I3 hostname or loopback. Main and I2 hostnames fail.
3. Choosing a file calls `classifyWithSiglipCandidate`. It validates content,
   loads only the same-origin SigLIP2 q4 model/runtime, and computes cosine
   margins against the fixed label vectors. All 19 appliance labels compete;
   only v3's 11 enabled winners can produce a suggestion. Unsupported winners
   never fall through to a different enabled category.
4. A fresh policy check after inference honours the kill switch. Abort signals
   and request generations suppress stale results after another photo, manual
   choice or navigation. Model sessions are released when their screen closes.
5. The UI requires a separate confirmation callback to change the category.

Set `recognition_enabled` false and redeploy I3 to pause the helper. Never mark
`release_ready` true merely to expose this preview. No frozen research gate or
accuracy evidence is overwritten by this authorisation.

## Verification and limits

- 59 focused JavaScript checks cover policy scope, frozen thresholds, input
  validation, lazy local-only loading, stale replies, cancellation and explicit
  confirmation, plus the adult action centre.
- 54 backend checks cover authenticated routes, exact model/runtime bytes,
  asset MIME types and adult/Quest entry points without shared database writes.
- A Chrome loopback test ran the actual model on a licensed fan fixture and a
  noise image through the real photo-input handler. The fan required confirmation;
  noise produced no suggestion. Neither inference result was mocked.
- Automated native file-picker selection was blocked by the browser extension's
  file-URL permission. The loopback smoke page fed the public fixture as a File
  through the same change handler. Native picker/camera and physical tablet
  behaviour still require manual checks. These two images do not measure accuracy.
- Hash-pinned files are protected against Git newline conversion. The evaluated
  text-label manifest originally contains CRLF, while upstream JS/configuration
  files contain LF. Preserving each exact byte sequence fixes integrity failures
  across Windows checkouts and Linux deployments without changing model weights.

The existing failed v3 diagnostic remains the relevant accuracy limitation:
11/21 enabled-class images accepted correctly, 10 rejected, all four air-fryer
examples rejected, and insufficient examples in several other categories.
