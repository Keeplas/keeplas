# Security Policy

## Reporting a Vulnerability

**Do NOT open a GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Keeplas, please report it responsibly:

- **Email:** security@keeplas.com
- **Response time:** Within 48 hours
- **PGP key:** Available on our website

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Supported Versions

| Version    | Supported |
| ---------- | --------- |
| 0.x (beta) | Yes       |

## Security Model

Keeplas uses a zero-knowledge architecture:

- **Master Key** is generated and stays client-side only
- **Recovery Phrase** is displayed once, never stored in plaintext
- **Shamir shards** are encrypted with each contact's public key
- **Vault items** are AES-256-GCM encrypted before leaving the browser
- **Convex** (our backend) never sees any secret in plaintext

## Disclosure Policy

We follow responsible disclosure practices and will credit researchers who report valid vulnerabilities.
