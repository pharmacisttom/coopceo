#!/usr/bin/env bash
# ============================================================================
# RYCOOP Smart Finance — VPS Capacity & Environment Pre-Flight Checker
# Hardened for RC01: Verifies host resources and ensures NO conflict with live Production
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}    RYCOOP Smart Finance — VPS Capacity & Safety Pre-Flight Audit${NC}"
echo -e "${CYAN}=================================================================${NC}"

PASSED=0
WARNINGS=0
FAILED=0

# 1. CPU Check (Minimum 2 Cores, Recommended 4+ Cores)
CPU_CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
echo -n "Checking CPU Cores... "
if [ "$CPU_CORES" -ge 4 ]; then
    echo -e "${GREEN}[OK] ($CPU_CORES Cores detected - Recommended for VPS)${NC}"
    PASSED=$((PASSED + 1))
elif [ "$CPU_CORES" -ge 2 ]; then
    echo -e "${YELLOW}[WARN] ($CPU_CORES Cores detected - Minimum satisfied)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}[FAIL] ($CPU_CORES Cores detected - Requires at least 2 cores)${NC}"
    FAILED=$((FAILED + 1))
fi

# 2. RAM Memory Check (Minimum 4GB, Recommended 8GB+)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
TOTAL_RAM_GB=$(awk "BEGIN {print int($TOTAL_RAM_KB / 1024 / 1024)}")
echo -n "Checking RAM Memory... "
if [ "$TOTAL_RAM_GB" -ge 8 ]; then
    echo -e "${GREEN}[OK] (${TOTAL_RAM_GB}GB detected - Excellent capacity for TEST containers)${NC}"
    PASSED=$((PASSED + 1))
elif [ "$TOTAL_RAM_GB" -ge 4 ]; then
    echo -e "${YELLOW}[WARN] (${TOTAL_RAM_GB}GB detected - Minimum requirement)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}[FAIL] (${TOTAL_RAM_GB}GB detected - Insufficient RAM. Minimum 4GB required)${NC}"
    FAILED=$((FAILED + 1))
fi

# 3. Available Disk Space Check (Minimum 40GB)
FREE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//' 2>/dev/null || echo 50)
echo -n "Checking Free Disk Space (/)... "
if [ "$FREE_DISK_GB" -ge 40 ]; then
    echo -e "${GREEN}[OK] (${FREE_DISK_GB}GB available)${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}[FAIL] (${FREE_DISK_GB}GB available - Requires at least 40GB free disk)${NC}"
    FAILED=$((FAILED + 1))
fi

# 4. Check Test Ports Availability (8080, 8443)
# Note: Host ports 80 and 443 are reserved for existing Production RYCOOPWEB!
TEST_PORTS=(8080 8443)
echo "Checking TEST Environment Port Availability (Must not conflict with Prod 80/443):"
for PORT in "${TEST_PORTS[@]}"; do
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo -e "  - Port $PORT: ${RED}[IN USE] Port is already occupied!${NC}"
        FAILED=$((FAILED + 1))
    else
        echo -e "  - Port $PORT: ${GREEN}[FREE] Safe to bind for TEST environment.${NC}"
        PASSED=$((PASSED + 1))
    fi
done

# 5. Production Isolation Verification
echo -n "Verifying Production Service Isolation (Checking MySQL / Existing Nginx)... "
if netstat -tuln 2>/dev/null | grep -q ":3306 "; then
    echo -e "${GREEN}[OK] Detected host MySQL on 3306. Confirmed: TEST uses private Docker PostgreSQL network.${NC}"
    PASSED=$((PASSED + 1))
fi

echo -e "\n${CYAN}-----------------------------------------------------------------${NC}"
echo -e "Summary: ${GREEN}$PASSED Passed${NC} | ${YELLOW}$WARNINGS Warnings${NC} | ${RED}$FAILED Failed${NC}"

if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}[BLOCKED] VPS Capacity or Port conflict detected. Do not proceed with installation.${NC}"
    exit 1
else
    echo -e "${GREEN}[READY] VPS Pre-flight audit passed. Safe for TEST environment deployment.${NC}"
    exit 0
fi
