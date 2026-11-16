#!/usr/bin/env bash
# ============================================================================
# RYCOOP Smart Finance — VPS Capacity & Environment Pre-Flight Checker
# Rule 1: Validate VPS Capacity and Prerequisites before installation
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}    RYCOOP Smart Finance — VPS Capacity Pre-Flight Audit         ${NC}"
echo -e "${CYAN}=================================================================${NC}"

PASSED=0
WARNINGS=0
FAILED=0

# 1. CPU Check (Minimum 2 Cores, Recommended 4 Cores)
CPU_CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
echo -n "Checking CPU Cores... "
if [ "$CPU_CORES" -ge 4 ]; then
    echo -e "${GREEN}[OK] ($CPU_CORES Cores detected - Recommended)${NC}"
    PASSED=$((PASSED + 1))
elif [ "$CPU_CORES" -ge 2 ]; then
    echo -e "${YELLOW}[WARN] ($CPU_CORES Cores detected - Minimum satisfied)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}[FAIL] ($CPU_CORES Cores detected - Requires at least 2 cores)${NC}"
    FAILED=$((FAILED + 1))
fi

# 2. RAM Memory Check (Minimum 4GB, Recommended 8GB)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
TOTAL_RAM_GB=$(awk "BEGIN {print int($TOTAL_RAM_KB / 1024 / 1024)}")
echo -n "Checking RAM Memory... "
if [ "$TOTAL_RAM_GB" -ge 8 ]; then
    echo -e "${GREEN}[OK] (${TOTAL_RAM_GB}GB detected - Recommended for all services)${NC}"
    PASSED=$((PASSED + 1))
elif [ "$TOTAL_RAM_GB" -ge 4 ]; then
    echo -e "${YELLOW}[WARN] (${TOTAL_RAM_GB}GB detected - Minimum requirement)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}[FAIL] (${TOTAL_RAM_GB}GB detected - Insufficient RAM. Minimum 4GB required)${NC}"
    FAILED=$((FAILED + 1))
fi

# 3. Available Disk Space Check (Minimum 40GB)
FREE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo -n "Checking Free Disk Space (/)... "
if [ "$FREE_DISK_GB" -ge 40 ]; then
    echo -e "${GREEN}[OK] (${FREE_DISK_GB}GB available)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}[FAIL] (${FREE_DISK_GB}GB available - Requires at least 40GB free disk)${NC}"
    FAILED=$((FAILED + 1))
fi

# 4. Docker & Docker Compose Check
echo -n "Checking Docker daemon... "
if command -v docker >/dev/null 2>&1; then
    DOCKER_VER=$(docker --version | awk '{print $3}' | sed 's/,//')
    echo -e "${GREEN}[OK] (Docker $DOCKER_VER)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}[FAIL] (Docker is not installed)${NC}"
    FAILED=$((FAILED + 1))
fi

echo -n "Checking Docker Compose... "
if docker compose version >/dev/null 2>&1; then
    COMPOSE_VER=$(docker compose version | awk '{print $4}')
    echo -e "${GREEN}[OK] (Docker Compose $COMPOSE_VER)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}[FAIL] (Docker Compose plugin is not installed)${NC}"
    FAILED=$((FAILED + 1))
fi

# 5. Check Port Conflicts (80, 443, 3000, 3001, 5432, 6379)
PORTS=(80 443 3000 3001 5432 6379)
echo "Checking Port Availability on Host:"
for PORT in "${PORTS[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo -e "  - Port $PORT: ${YELLOW}[IN USE] Please verify if occupied by legacy RYCOOPWEB${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  - Port $PORT: ${GREEN}[FREE]${NC}"
        PASSED=$((PASSED + 1))
    fi
done

# 6. Verify Production Isolation (Check if running next to existing production)
echo -n "Verifying Production Container Isolation... "
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "rycoopweb_prod|coop_production"; then
    echo -e "${YELLOW}[ALERT] Found active production containers. Ensure network & volumes are isolated!${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}[OK] No conflicting production namespace detected.${NC}"
    PASSED=$((PASSED + 1))
fi

echo -e "\n${CYAN}-----------------------------------------------------------------${NC}"
echo -e "Summary: ${GREEN}$PASSED Passed${NC} | ${YELLOW}$WARNINGS Warnings${NC} | ${RED}$FAILED Failed${NC}"

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}[BLOCKED] VPS Capacity check failed. Please upgrade VPS resources before deploying.${NC}"
    exit 1
else
    echo -e "${GREEN}[READY] VPS Capacity verified. Proceeding with TEST deployment.${NC}"
    exit 0
fi
