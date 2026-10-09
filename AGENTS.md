# FixForward development and release policy

## Choose the development checkout first

- Ordinary feature work, fixes and review belong on `iteration-3`, in the `FixForward-Iteration-3-From-Iteration-2` checkout. Its review website is `https://fix-forward-iteration-3-r4sh.onrender.com/`.
- Before editing, check `git branch --show-current`, `git status --short` and `git worktree list`. Preserve uncommitted work; do not reset another checkout or copy an older working folder over this repository.
- If opened on `main`, `iteration-2` or `iteration-1`, do not develop there; move ordinary development to an `iteration-3` checkout before changing files. Main serves `https://fixforward.me/` and stays at the user's approved release.
- Preserve `iteration-2` and its website as the Iteration 2 comparison version, and `iteration-1` and its website as the original comparison version. Do not edit, push or deploy them, or change their Render services, without a specific request.
- `https://fix-forward-iteration-3.onrender.com/` is a separate Render static site that only forwards visitors to the I3 application. Never deploy application changes to it.

## Review and publish Iteration 3

Follow the [README workflow](README.md#development-and-review-workflow). Keep changes and validation in this checkout. Maintain the plain-English comments inside authored HTML, JavaScript, Python, CSS and configuration files when changing the behavior they explain. Explain new functions and non-obvious rules without adding line-by-line noise.

Publish to the I3 website only when the user has authorized publishing that work, and honor any instruction to keep work local or uncommitted. Review the changed files, run the relevant checks, commit the intended files and push only `iteration-3`. Verify the destination remote and branch before pushing. Use Render's Manual Deploy for the reviewed commit on the **fix-forward-iteration-3** Python web service (not the forwarding static site), then verify its deployed commit and adult/Quest routes. Saving files or pushing GitHub code alone does not deploy the website. Do not change a service's branch or deployment settings to bypass this workflow.

On this branch, `render.yaml`, `package.json` and the default `RELEASE_VERSION` identify Iteration 3. Main and Iteration 2 keep their own deployment metadata on their own branches.

## Main requires explicit release approval

Do not edit, merge into, push or deploy `main`, or change Main's Render service, domain or deployment settings, without the user's explicit approval for the reviewed release. Successful tests, approval to update the I3 preview, or approval for a previous Main release do not authorize a new Main promotion. A general request to continue development or update the current review website belongs to I3.

If the user explicitly approves a Main promotion, preserve Git history, promote only the reviewed commit, retain Main's own deployment metadata and verify the resulting application against the approved version. Keep Main's Auto Deploy off and perform only the specifically approved manual deployment. Never force-push or reset Main to make its files match a preview.

## Shared data is not isolated by a Git branch

The websites currently share Neon reference data. Separate branches and Render services do not create separate databases. Do not run imports, migrations, schema changes, destructive maintenance or reference-data writes against the shared database as part of I3 development. The normal application uses read-only data access; keep that boundary intact.

Database development needs an explicitly separate database or Neon branch and a verified target before any write. Changes to shared production data require separate, specific user authorization. Never read or print credentials merely to compare environments, and keep secrets out of source, logs, screenshots and chat.

Report local test results, pushed commits, actual deployments and live checks separately. Dated handover evidence does not prove that the current release or hosting configuration has been verified.
