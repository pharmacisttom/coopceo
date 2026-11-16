# Authentication & Session Security Flow
## RYCOOP Smart Finance — Google OIDC & WebAuthn / Passkey Architecture

---

## 1. Google OpenID Connect (OIDC) Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Cooperative User
    participant Browser as Next.js Client
    participant Nest as NestJS Backend
    participant Google as Google OAuth 2.0 Provider
    participant DB as PostgreSQL User Allowlist

    User->>Browser: Clicks "Google Login"
    Browser->>Nest: GET /api/v1/auth/google/url
    Nest->>Nest: Generate random State, Nonce, PKCE Code Verifier & Challenge
    Nest-->>Browser: Returns Auth URL (with hd=rycoop.coop & state)
    Browser->>Google: Redirects user to Google Consent Screen
    User->>Google: Authenticates with @rycoop.coop account
    Google-->>Browser: Redirects to /api/v1/auth/google/callback?code=...&state=...
    Browser->>Nest: POST /api/v1/auth/google/callback { code, state }
    Nest->>Nest: Validate State & PKCE Code Verifier
    Nest->>Google: Exchange authorization code for ID Token
    Google-->>Nest: Returns ID Token (JWT)
    Nest->>Nest: Verify signature, issuer, audience, and email domain (@rycoop.coop)
    Nest->>DB: Verify email exists in local user allowlist & isActive == true
    DB-->>Nest: Returns User record (Role, Department, Permissions)
    Nest->>Nest: Generate cryptographically random Session Token (rotate session)
    Nest-->>Browser: Set-Cookie: rycoop_session=...; HttpOnly; Secure; SameSite=Strict
    Browser-->>User: Redirect to Authenticated Dashboard
```

---

## 2. Security Guarantees & Constraints

1. **Domain Enforcement:**
   - Emails must end strictly with `@rycoop.coop`.
   - Accounts outside this domain (e.g. `@gmail.com` or spoofed domains) are rejected with HTTP 403 Forbidden.
2. **Local User Allowlist:**
   - A successful Google authentication does NOT grant system access unless the email is pre-registered by the Cooperative Administrator.
3. **Session Security:**
   - Session tokens are generated using 48 bytes of cryptographically secure random bytes (`crypto.randomBytes(48).toString('base64url')`).
   - Delivered strictly via `HttpOnly; SameSite=Strict; Secure` cookies.
   - Idle timeout enforced at 30 minutes.
   - Absolute session timeout enforced at 8 hours.

