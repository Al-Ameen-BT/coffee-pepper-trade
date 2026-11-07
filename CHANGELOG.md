# Changelog

## 2.1.0 - 2026-11-07

- Show the release version on the sign-in page, in the application sidebar, and in the health response.
- Harden the existing WAF rate limits against forged forwarded IP prefixes and normalize the Nginx proxy chain for local ngrok access.
- Bind the production application listener to loopback so requests pass through Nginx.
- Move the local/direct HTTPS listener to port 3424 and update ngrok upstream guidance.
- Remove the HTTP listener, stop the unused Certbot setup, and verify local HTTPS before reporting deployment success.

## 2.0.0

- Earlier release. Detailed release notes were not recorded.
