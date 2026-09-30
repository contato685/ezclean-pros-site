# EZ Clean Pros - site (ezcleaning.services)

Static site + Cloudflare Pages Functions, deployed on Cloudflare Pages.

- `deploy/` - deployable package (source of truth for production): `index.html`, `cities/`, `services/`, `subscribed/`, `functions/api/`
- `deploy/functions/api/lead.js` - lead form API (Resend emails, CRM forward, optional SMS)
- `landing-pages/` - build scripts for city/service pages
- `v3`..`v6`, `archive/`, `HTML SITE*` - older iterations, kept for reference

## Secrets
Not in the repo. Configure as Cloudflare Pages secrets (e.g. Resend API key, CRM and SMS credentials). See `deploy/functions/api/lead.js` for the variable names.

## Deploy
```
wrangler pages deploy deploy --project-name <pages-project>
```
