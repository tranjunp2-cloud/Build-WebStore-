# Security Checklist

## Authentication & Authorization
- [ ] No hardcoded API keys, passwords, or secrets.
- [ ] RBAC (Role-Based Access Control) is enforced at the controller/API level.
- [ ] Standard headers (Authorization: Bearer) validation.
- [ ] No sensitive data in logs (PII, tokens).

## Input Validation
- [ ] Zod or equivalent schema validation for ALL external inputs.
- [ ] Sanitize HTML/Markdown to prevent XSS.
- [ ] Avoid `eval()` or `new Function()`.
- [ ] SQL/NoSQL injection prevention (parameterized queries).
- [ ] File upload validation (ext, size, MIME type).

## Network & Infrastructure
- [ ] CORS policies are appropriately restrictive.
- [ ] CSRF protection for sensitive state-changing operations.
- [ ] Rate limiting for public or expensive endpoints.
- [ ] SSL/TLS enforce (HSTS).

## Cryptography
- [ ] Use standard, modern libraries (e.g., SubtleCrypto, bcrypt).
- [ ] No custom crypto implementations.
- [ ] Salted hashes for passwords.
- [ ] Sufficient entropy for random generators.
