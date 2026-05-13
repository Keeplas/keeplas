# Release Process

Keeplas follows [Semantic Versioning](https://semver.org/) loosely while in pre-1.0:

- **MAJOR** — once we cut `1.0.0`, breaking changes to public surfaces (CLI scripts, Convex schema migrations that require manual intervention, env keys removed).
- **MINOR** — new user-facing features, additive schema, new env keys with safe defaults.
- **PATCH** — bug fixes, dependency security patches, doc-only changes.

Until `1.0.0`, we may bump `MINOR` for breaking changes — call them out clearly in the changelog under a **Breaking** subsection.

## Steps

1. **Pre-flight** — green CI on `main`, no `[Unreleased]` entries that are still in flight.
2. **Bump** — choose the next version. Update `package.json` `"version"` (root + any workspace package being released).
3. **Changelog** — in `CHANGELOG.md`, move all entries from `[Unreleased]` into a new versioned heading:

   ```markdown
   ## [0.2.0] — 2026-MM-DD
   ```

   Re-create an empty `[Unreleased]` block above it.

4. **Commit** — `chore: release 0.2.0` (or whatever version).
5. **Tag** — `git tag v0.2.0 -m "v0.2.0"`.
6. **Push** — `git push origin main --follow-tags`.
7. **GitHub Release** — `gh release create v0.2.0 --notes-from-tag` (or paste the changelog section manually).

## Changelog discipline

Every PR that ships a user-visible change should add a line to `[Unreleased]`. The categories are:

- **Added** — new features.
- **Changed** — changes to existing functionality.
- **Deprecated** — features marked for removal in a future release.
- **Removed** — features removed in this release.
- **Fixed** — bug fixes.
- **Security** — vulnerabilities patched.

Keep entries past-tense, ≤120 chars per line, contributor-readable (no internal jargon). If a change is invisible to users (refactor, test scaffolding), leave it out.

## Hotfixes

For security or data-corruption issues that can't wait for the next scheduled release:

1. Branch off the tag: `git checkout -b hotfix/x.y.z v<previous-tag>`.
2. Fix, commit, bump PATCH, update changelog under a new versioned heading.
3. Tag and push.
4. Cherry-pick the fix back to `main` if it diverged.
