# coffee-pepper-trade

## Release version

`package.json` is the release version source. The same version appears on the sign-in page, in the sidebar, and at `/api/health`. For a release, run `npm version <major.minor.patch> --no-git-tag-version`, add a matching `CHANGELOG.md` entry, then run `npm run version:check`, `npm test`, and `npm run build`. Deploy only the tested commit.

## WAF and ngrok

The application uses its existing Express request filter and rate limits, plus Nginx probe blocking and rate limits. Production Express listens on `127.0.0.1:3000`; expose it only through Nginx. The Nginx configuration trusts `X-Forwarded-For` only from a local ngrok agent, uses its final address for rate limits, and sends Express a single verified client IP. Nginx listens for HTTPS on port `3424`; this site has no port 80 or 443 listener. Close inbound TCP 80 in the host firewall and cloud security group, and disable any other service listening on it. Run ngrok on the same host, forwarding public HTTPS to `https://127.0.0.1:3424`; the public ngrok URL stays on standard HTTPS. Set `CLIENT_URL` to the exact public ngrok origin, or to `https://<server-ip>:3424` for direct-IP use, and set `FORCE_HTTPS=true` in an existing `.env`. Open TCP 3424 externally only if direct-IP access is required. A fresh self-signed certificate includes a 127.0.0.1 IP SAN; an existing certificate without that SAN must be renewed deliberately before deployment. Test the real ngrok → Nginx → Express path before opening access to users. A WAF reduces common abuse but does not replace application validation or the remaining security fixes in the production deployment plan.
