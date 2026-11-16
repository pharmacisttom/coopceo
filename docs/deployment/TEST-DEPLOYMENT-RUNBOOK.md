# TEST Environment Deployment Runbook (RC01)
## RYCOOP Smart Finance — Operational Procedures

---

### 1. Prerequisites & VPS Capacity Verification

Execute the hardened pre-flight audit script on the target VPS:
```bash
chmod +x scripts/*.sh
bash scripts/vps-check.sh
```
Verify:
- CPU cores >= 4, RAM >= 8GB, Disk >= 40GB.
- Test ports `8080` and `8443` are free.
- Live cooperative production ports (80, 443, MySQL 3306) are completely undisturbed.

---

### 2. Configure TEST Environment Secrets

```bash
cp docker/env.test.example docker/.env.test
```
Update configuration parameters:
- `POSTGRES_USER`: Dedicated test username.
- `POSTGRES_PASSWORD`: High-entropy generated password.
- `JWT_SECRET`: 256-bit secret.
- `INTERNAL_SERVICE_SECRET`: Secret shared between FastAPI and NestJS.

---

### 3. Build & Launch TEST Containers

```bash
cd docker
docker compose --project-name rycoop-smart-finance-test --env-file env.test.example up -d --build
```

---

### 4. Health Check Verification

```bash
docker compose --project-name rycoop-smart-finance-test ps
```
Verify all containers report `(healthy)`.

---

### 5. Accessing the Application

- **Direct Port:** `http://127.0.0.1:8080` or `https://127.0.0.1:8443`
- **Host Nginx Proxy (Optional):** Route subdomain `test.rycoop.coop` to `127.0.0.1:8080` via host reverse proxy block without touching port 80/443 root configs.

