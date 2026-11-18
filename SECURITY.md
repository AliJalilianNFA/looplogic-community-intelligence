# Security and data handling

This is a local hackathon prototype, not a production service.

- The server binds to `127.0.0.1`. Do not expose it directly to the Internet; it has no user authentication, authorization or TLS.
- Keep API keys in environment variables or secret managers, never source control, frontend JS, README examples or browser localStorage.
- Use fabricated resident scenarios only. Do not submit SINs, IDs, income documents, healthcare records or real addresses.
- `cache/` holds public-data downloads locally and is excluded from Git.
- Browser-local tasks/profiles are **not** secure user accounts and may be reset when browser storage is cleared.
- Model-generated material is a draft explanation; do not rely on it for binding eligibility, confirmed availability or government decisions.
- Check provider hours, rules, program deadlines, data licensing and census provenance before publishing claims.

If a credential is accidentally committed, revoke it immediately, purge it from the repository history as appropriate, and issue a replacement. Remove the exposed secret from logs or public artifacts as well.
