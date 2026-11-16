# TEST Environment Deployment Runbook (RC01.1)
## RYCOOP Smart Finance — Enterprise Deployment Procedures

---

### 1. Prerequisites & Safety Verification on Target VPS

The target VPS is running Ubuntu 24.04 LTS hosting the live Production RYCOOPWEB application (Nginx on ports 80/443, MySQL on 3306). **The TEST stack must never disrupt these services.**

Run the pre-flight verification script:
```bash
chmod +x scripts/*.sh
bash scripts/vps-check.sh
```
The script uses `ss -tuln` to verify:
- Host ports `8080` and `8443` are free for the TEST stack.
- CPU >= 4 cores, RAM >= 8GB, Disk >= 40GB free.
- Live Production MySQL (3306) and Nginx (80/443) remain isolated.

---

### 2. Configure TEST Environment Secrets (`.env.test`)

> **IMPORTANT:** Never run Docker Compose directly pointing to `env.test.example`. Always create and populate a dedicated `.env.test` file on the VPS:

```bash
cd docker
cp env.test.example .env.test
```

Generate high-entropy random secrets and update `.env.test`:
```bash
# Generate 256-bit JWT secret
openssl rand -hex 32

# Generate internal service secret (minimum 32 characters)
openssl rand -hex 32
```

Configure parameters in `.env.test`:
- `POSTGRES_USER`: Dedicated test username (e.g. `rycoop_test_user`).
- `POSTGRES_PASSWORD`: High-entropy password.
- `INTERNAL_SERVICE_SECRET`: Secret shared between FastAPI and NestJS (>= 32 chars).
- `GOOGLE_CLIENT_ID`: OAuth 2.0 Web Client ID registered in Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 Web Client Secret.
- `WEBAUTHN_RP_ID`: `test.rycoop.coop`.
- `WEBAUTHN_ORIGIN`: `https://test.rycoop.coop`.

---

### 3. Build & Launch TEST Stack with Network Isolation

```bash
cd docker
docker compose --project-name rycoop-smart-finance-test --env-file .env.test up -d --build
```

**Network Isolation Architecture:**
- `ingress_net`: Connects Nginx to Frontend (Public Ingress).
- `app_net`: Connects Nginx to Backend, Frontend to Backend, Analytics to Backend.
- `data_net` (`internal: true`): Connects Backend to PostgreSQL and Redis. **Zero external access to database or cache.**

---

### 4. Health Check Verification

```bash
docker compose --project-name rycoop-smart-finance-test ps
```
Ensure all containers report `(healthy)`:
- `rycoop_test_nginx`
- `rycoop_test_frontend`
- `rycoop_test_backend`
- `rycoop_test_analytics`
- `rycoop_test_postgres`
- `rycoop_test_redis`

---

### 5. Host Nginx Reverse Proxy Routing

On the host VPS Nginx, configure the virtual host for `test.rycoop.coop` to proxy traffic to the TEST stack without modifying the root port 80/443 configurations:

```nginx
server {
    listen 443 ssl http2;
    server_name test.rycoop.coop;

    ssl_certificate /etc/letsencrypt/live/test.rycoop.coop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test.rycoop.coop/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```
