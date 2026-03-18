/**
 * setup.ts — Seeds real GitLab issues for demo/judging
 * Run once: npx ts-node src/setup.ts
 *
 * Creates 5 real production-grade issues based on the DevSecOps-BankApp
 * (https://github.com/pooja-bhavani/DevSecOps-Bankapp) — each one is a
 * genuine problem the DevFlow Orchestrator pipeline can diagnose and fix.
 */
import "dotenv/config"
import axios from "axios"

const api = axios.create({
  baseURL: process.env.GITLAB_API_URL || "https://gitlab.com/api/v4",
  headers: { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN },
})
const PROJECT = process.env.GITLAB_PROJECT_ID

const ISSUES = [
  {
    title: "PROD P0: BankApp OOMKilled + CrashLoopBackOff — memory limits missing",
    description: `## Incident Summary
The \`bankapp\` deployment in the \`production\` namespace is in a \`CrashLoopBackOff\` state.
Pods are being OOMKilled repeatedly. No memory limits are set in the Kubernetes deployment manifest.

## Symptoms
- \`kubectl get pods -n production\` shows \`OOMKilled\` exit code 137
- Pod restarts: 8 in the last 30 minutes
- Node memory pressure: 98%
- CPU throttling: 94%

## Root Cause (suspected)
The \`bankapp\` container in \`k8s/deployment.yaml\` has no \`resources.limits\` block.
The JVM heap is unbounded and grows until the node OOM-kills the pod.

## Affected Files
- \`k8s/deployment.yaml\` — missing \`resources.limits.memory\` and \`resources.requests.memory\`
- \`Dockerfile\` — no \`-Xmx\` JVM flag set

## Expected Fix
1. Add \`resources.limits.memory: 512Mi\` and \`resources.requests.memory: 256Mi\` to the deployment
2. Add \`-Xmx384m\` to the JVM startup flags in the Dockerfile
3. Add a \`livenessProbe\` and \`readinessProbe\` to prevent traffic during startup

## Impact
- 100% of production traffic failing (HTTP 5xx rate: 67%)
- SLA breach — P0 incident`,
    labels: ["P0", "production", "kubernetes", "incident"],
  },
  {
    title: "SEC P0: Critical CVEs in base image — CVE-2024-21626 (runc) + CVE-2023-44487 (HTTP/2 Rapid Reset)",
    description: `## Security Alert
Container image scan detected two critical CVEs in the \`bankapp\` production image.

## CVEs Detected

### CVE-2024-21626 — runc container escape (CVSS 8.6)
- **Severity:** Critical
- **Component:** \`runc < 1.1.12\`
- **Impact:** Container escape — attacker can break out of container isolation
- **Current version:** runc 1.1.9 (in base image \`openjdk:17-jdk-slim\`)

### CVE-2023-44487 — HTTP/2 Rapid Reset DDoS (CVSS 7.5)
- **Severity:** High
- **Component:** \`golang.org/x/net < 0.17.0\`
- **Impact:** Remote DoS via HTTP/2 stream cancellation flood

## Affected Files
- \`Dockerfile\` — base image \`openjdk:17-jdk-slim\` pulls vulnerable runc
- \`pom.xml\` / \`build.gradle\` — dependency versions need updating

## Expected Fix
1. Update base image to \`eclipse-temurin:17-jre-alpine\` (patched runc)
2. Update \`golang.org/x/net\` to \`>= 0.17.0\`
3. Re-run \`trivy image\` scan and confirm 0 critical CVEs
4. Add image scanning to CI pipeline to prevent regression

## Compliance Impact
- Fails PCI-DSS requirement 6.3.3 (all software components protected from known vulnerabilities)
- Fails SOC2 CC7.1`,
    labels: ["P0", "security", "CVE", "container"],
  },
  {
    title: "PROD P1: Database connection pool exhausted — 10/10 connections, queries timing out",
    description: `## Incident Summary
The BankApp MySQL connection pool is fully exhausted. All 10 connections are in use.
New requests are queuing and timing out after 30s, causing HTTP 503 errors.

## Symptoms
- \`HikariPool-1 - Connection is not available, request timed out after 30000ms\`
- DB connections: 10/10 (max pool size)
- HTTP 5xx rate: 45% and rising
- Slow query log shows queries taking > 10s

## Root Cause (suspected)
1. \`application.properties\` has \`spring.datasource.hikari.maximum-pool-size=10\` — too low for production load
2. Missing database indexes on \`transactions\` table — full table scans holding connections
3. No connection timeout / idle eviction configured

## Affected Files
- \`src/main/resources/application.properties\` — pool size and timeout config
- \`src/main/resources/db/migration/V1__init.sql\` — missing indexes

## Expected Fix
1. Increase pool size to 25: \`spring.datasource.hikari.maximum-pool-size=25\`
2. Add \`spring.datasource.hikari.connection-timeout=5000\`
3. Add \`spring.datasource.hikari.idle-timeout=300000\`
4. Add index: \`CREATE INDEX idx_transactions_account_id ON transactions(account_id);\`
5. Add index: \`CREATE INDEX idx_transactions_created_at ON transactions(created_at);\`

## Impact
- P1 — partial service degradation
- Transaction failures affecting ~40% of users`,
    labels: ["P1", "production", "database", "performance"],
  },
  {
    title: "COMPLIANCE: Missing GDPR + SOC2 controls — no encryption at rest, no audit log",
    description: `## Compliance Gap Report
Security audit identified critical GDPR and SOC2 compliance gaps in the BankApp.

## Findings

### GDPR Article 32 — Encryption at rest
- **Status:** ❌ FAILING
- PII fields (\`account_number\`, \`ssn\`, \`date_of_birth\`) stored in plaintext in MySQL
- No column-level encryption implemented
- No data masking in API responses

### SOC2 CC6.1 — Logical access controls
- **Status:** ❌ FAILING
- No audit log for sensitive operations (transfers, balance queries)
- JWT tokens have no expiry (\`exp\` claim missing)
- No rate limiting on authentication endpoints

### OWASP ASVS 4.0 Level 2 — V3.3 Session Termination
- **Status:** ❌ FAILING
- Sessions not invalidated on logout
- No concurrent session limits

## Affected Files
- \`src/main/java/com/bankapp/model/User.java\` — PII fields unencrypted
- \`src/main/java/com/bankapp/security/JwtUtil.java\` — missing token expiry
- \`src/main/java/com/bankapp/controller/AuthController.java\` — no rate limiting

## Expected Fix
1. Add \`@Convert(converter = AttributeEncryptor.class)\` to PII fields
2. Set JWT expiry: \`Jwts.builder().setExpiration(new Date(now + 3600000))\`
3. Add Spring Security rate limiting filter
4. Implement audit log table and AOP interceptor for sensitive operations

## Regulatory Risk
- GDPR fine up to €20M or 4% of annual turnover
- SOC2 audit failure`,
    labels: ["compliance", "GDPR", "SOC2", "security"],
  },
  {
    title: "INFRA: K8s deployment missing liveness/readiness probes + HPA not configured",
    description: `## Infrastructure Gap
The BankApp Kubernetes deployment is missing critical reliability configurations.

## Issues Found

### 1. No liveness or readiness probes
\`\`\`
kubectl describe pod bankapp-xxx
# No liveness probe configured
# No readiness probe configured
\`\`\`
Pods receive traffic before Spring Boot is ready (startup takes ~45s).
Unhealthy pods are never restarted automatically.

### 2. No Horizontal Pod Autoscaler
Single replica deployment — no auto-scaling under load.
During peak hours, single pod handles all traffic.

### 3. No PodDisruptionBudget
Rolling updates cause 100% downtime — all pods replaced simultaneously.

### 4. No NetworkPolicy
All pods can communicate with all other pods — violates least-privilege.

## Affected Files
- \`k8s/deployment.yaml\` — missing probes, single replica
- \`k8s/\` — missing \`hpa.yaml\`, \`pdb.yaml\`, \`networkpolicy.yaml\`

## Expected Fix
1. Add readinessProbe: \`httpGet /actuator/health\` with \`initialDelaySeconds: 45\`
2. Add livenessProbe: \`httpGet /actuator/health/liveness\` with \`failureThreshold: 3\`
3. Create \`k8s/hpa.yaml\` — min 2, max 10 replicas, CPU target 70%
4. Create \`k8s/pdb.yaml\` — \`minAvailable: 1\`
5. Create \`k8s/networkpolicy.yaml\` — deny all ingress except from ingress controller

## Impact
- Availability risk during deployments
- No auto-recovery from pod failures
- No scale-out under load`,
    labels: ["infrastructure", "kubernetes", "reliability", "P2"],
  },
]

async function seedIssues() {
  console.log(`\n🌱 Seeding ${ISSUES.length} real issues into GitLab project ${PROJECT}...\n`)

  for (const issue of ISSUES) {
    try {
      const { data } = await api.post(`/projects/${PROJECT}/issues`, {
        title: issue.title,
        description: issue.description,
        labels: issue.labels.join(","),
      })
      console.log(`✅ Created issue #${data.iid}: ${data.title.substring(0, 60)}...`)
      console.log(`   URL: ${data.web_url}\n`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string }
      console.error(`❌ Failed to create issue: ${issue.title.substring(0, 50)}`)
      console.error(`   Error: ${JSON.stringify(e.response?.data || e.message)}\n`)
    }
  }

  console.log("✅ Done! Open your GitLab project and run the pipeline against any issue IID.")
}

seedIssues()
