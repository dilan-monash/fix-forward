# FixForward - Safe Penetration / Security Test Log

> Use only the team-controlled deployed site or an authorised staging deployment. Avoid denial-of-service or destructive database testing.

| Test ID | Date | Release URL/version | Tool | Test performed | Expected safe result | Actual result | Evidence | Finding / action |
|---|---|---|---|---|---|---|---|---|
| SEC-01 | | | Browser DevTools/curl | Request unsupported HTTP methods on `/api/recalls` | Non-GET rejected | | | |
| SEC-02 | | | Browser DevTools | Modify client navigation/hash to open cost screen before safety | App must not claim safety clearance; server exposes no decision write endpoint | | | |
| SEC-03 | | | curl | Send unexpected query strings / long values to public endpoints | No stack trace/secrets; safe error behavior | | | |
| SEC-04 | | | Browser | Inject HTML-like text into brand/model fields | Rendered as text, not script | | | |
| SEC-05 | | | Browser/curl | Simulate recall endpoint failure | Safety remains usable; recall remains unknown | | | |
| SEC-06 | | | Browser | High-risk answer then repair pathway | No community Repair Cafe displayed | | | |
| SEC-07 | | | Header inspector | Inspect CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy | Required headers present | | | |
| SEC-08 | | | Neon SQL console | Inspect app role grants | Only required read privileges | | | |
