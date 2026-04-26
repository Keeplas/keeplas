# Contributing to Keeplas

Thank you for your interest in contributing to Keeplas! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/keeplas.git`
3. Install dependencies: `pnpm install`
4. Copy `.env.example` to `.env` and configure
5. Start development: `pnpm dev`

## Development Workflow

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Make your changes
3. Run checks: `pnpm lint && pnpm typecheck && pnpm test`
4. Commit with a clear message
5. Push and open a Pull Request

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- No `any` types — use proper typing
- Comments in English

## Restricted Areas

The following directories require founder approval and cannot be modified by community contributors:

- `packages/crypto/` — Zero-knowledge and encryption code (security-critical)
- `security/` — Audit reports

See `CODEOWNERS` for details.

## Contributor License Agreement

By submitting a pull request, you agree to the terms of our [CLA](CONTRIBUTOR_LICENSE_AGREEMENT.md). This ensures Keeplas Ltd retains the ability to maintain and evolve the project.

## Reporting Security Issues

**Do NOT open a GitHub issue for security vulnerabilities.**

Email: security@keeplas.com

See [SECURITY.md](SECURITY.md) for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.
