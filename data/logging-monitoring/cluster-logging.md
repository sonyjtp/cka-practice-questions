# 📋 Cluster Logging & Events

> **CKA Exam Domain:** Logging & Monitoring  
> **Topic:** Kubelet logs, API server audit logs, Kubernetes events, system component logging  
> **Total Questions:** 6

---

## ⏱️ Time Guide

| Difficulty | Recommended Time |
|------------|-----------------|
| 🟢 Easy    | 4–6 minutes     |
| 🟡 Medium  | 6–8 minutes     |
| 🔴 Hard    | 8–10 minutes    |

---

## 🟢 Easy Questions

---

### Question 1 — Access kubelet logs
> ⏱️ **Recommended Time: 4 minutes**

View kubelet logs on a node to diagnose node-level issues.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to the node
ssh node1

# View kubelet logs using journalctl
journalctl -u kubelet -n 50
# Shows last 50 lines of kubelet logs

# Follow kubelet logs in real-time
journalctl -u kubelet -f

# View logs from specific time
journalctl -u kubelet --since "2024-05-08 10:00:00"
journalctl -u kubelet --until "2024-05-08 11:00:00"

# View logs with priority filter
journalctl -u kubelet -p err     # Errors only
journalctl -u kubelet -p warn    # Warnings and errors
journalctl -u kubelet -p info    # Info and higher

# Search for specific error in logs
journalctl -u kubelet | grep "error"
journalctl -u kubelet | grep "CrashLoopBackOff"

# View logs with timestamps
journalctl -u kubelet -o short-iso

# Get last N lines
journalctl -u kubelet --no-pager | tail -100

# Clear old logs (if too many)
sudo journalctl --vacuum-size=500M
```

Common kubelet errors:

```
kubelet: Error pulling image: image not found
  → Issue: Container image doesn't exist or wrong registry

kubelet: Failed to create pod sandbox: network plugin error
  → Issue: CNI plugin problem, network not ready

kubelet: evicting pod (memory pressure)
  → Issue: Node running out of memory, pods being evicted

kubelet: E0508 10:15:02.123456 1234 kubelet.go:2367] Failed to sync pod:
  → Issue: Pod sync failure, check pod/container status
```

> **Key Concept:** Kubelet logs are in systemd journal on each node. Use `journalctl -u kubelet` to view. Logs contain container creation, pod scheduling, and node errors.

</details>

---

### Question 2 — View Kubernetes events
> ⏱️ **Recommended Time: 4 minutes**

Understand and retrieve Kubernetes events for pod and node debugging.

<details>
<summary>✅ Answer</summary>

```bash
# View events for all objects in default namespace
kubectl get events
# LAST SEEN   TYPE     REASON                       OBJECT
# 5m          Normal   Scheduled                    pod/my-pod
# 4m          Normal   Pulling                      pod/my-pod
# 4m          Normal   Pulled                       pod/my-pod
# 4m          Normal   Created                      pod/my-pod
# 4m          Normal   Started                      pod/my-pod

# View events in specific namespace
kubectl get events -n kube-system

# View events for specific object
kubectl describe pod my-pod | grep -A 20 "Events:"

# View events sorted by timestamp (most recent first)
kubectl get events --sort-by='.lastTimestamp'

# Watch events in real-time
kubectl get events -w

# Filter events by reason
kubectl get events --field-selector reason=FailedScheduling
kubectl get events --field-selector reason=FailedPullImage

# Filter events by type (Normal or Warning)
kubectl get events --field-selector type=Warning

# Filter events by involved object
kubectl get events --field-selector involvedObject.kind=Pod

# Get all events across all namespaces
kubectl get events -A

# Events with more details
kubectl describe events

# Search events for specific pod
kubectl get events | grep "my-pod"
```

Event types and meanings:

| Type | Meaning | Examples |
|------|---------|----------|
| **Normal** | Expected events, informational | Scheduled, Pulled, Created, Started |
| **Warning** | Something went wrong or is pending | Failed, FailedScheduling, Unhealthy |

Common pod events:

```
Scheduled - Pod assigned to node
Pulling - Container runtime pulling image
Pulled - Image successfully pulled
Created - Container created
Started - Container started
FailedScheduling - Couldn't schedule pod
FailedPullImage - Image pull failed
BackOff - Restarting pod after failure
```

> **Key Concept:** Events are the audit trail of what happened to objects. They're retained for ~1 hour. Use describe or get events to investigate pod failures.

</details>

---

### Question 3 — Understand API server audit logs
> ⏱️ **Recommended Time: 5 minutes**

Locate and interpret API server audit logs for API request tracking.

<details>
<summary>✅ Answer</summary>

```bash
# API audit logs are typically stored in:
# - /var/log/pods/kube-system_kube-apiserver-*/
# - /var/log/audit/ (if configured)

# Check if audit is enabled
kubectl get pods -n kube-system | grep kube-apiserver

# SSH to control plane node
ssh control-plane

# Find audit log files
find /var/log/pods -name "*audit*" 2>/dev/null
# Or
ls /var/log/audit/ 2>/dev/null

# View API server audit policy
cat /etc/kubernetes/audit-policy.yaml

# Example audit policy:
# apiVersion: audit.k8s.io/v1
# kind: Policy
# rules:
# - level: RequestResponse  # Log request and response bodies
#   omitStages:
#   - RequestReceived
#   resources: ["pods", "services"]
# - level: Metadata         # Log metadata only (headers, etc)
#   omitStages:
#   - RequestReceived
# - level: None             # Don't log

# Audit log levels:
# - None: Don't log
# - Metadata: Log metadata (user, resource type, verb, timestamp)
# - RequestResponse: Log metadata + request and response bodies
# - Request: Log metadata and request body only

# View audit logs
tail -f /var/log/audit/audit.log | jq '.'

# Example audit log entry (JSON):
# {
#   "kind": "Event",
#   "apiVersion": "audit.k8s.io/v1",
#   "level": "RequestResponse",
#   "auditID": "abc123def456",
#   "stage": "ResponseComplete",
#   "requestReceivedTimestamp": "2024-05-08T10:15:02.123456Z",
#   "stageTimestamp": "2024-05-08T10:15:02.234567Z",
#   "user": {
#     "username": "system:admin",
#     "uid": "system:admin",
#     "groups": ["system:masters"]
#   },
#   "verb": "create",
#   "objectRef": {
#     "resource": "pods",
#     "namespace": "default",
#     "name": "my-pod"
#   },
#   "requestObject": {...},
#   "responseStatus": {
#     "code": 201
#   }
# }

# Search audit logs for specific action
grep "verb.*delete" /var/log/audit/audit.log | jq '.objectRef'

# Find who deleted a specific pod
grep "\"name\":\"my-pod\"" /var/log/audit/audit.log | grep "delete" | jq '.user'
```

> **Key Concept:** API audit logs record all API requests to the server. Useful for security investigation, compliance, and understanding who did what. Configuration via audit-policy.yaml.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Troubleshoot node status issues using logs
> ⏱️ **Recommended Time: 6 minutes**

Use kubelet and system logs to diagnose why a node is NotReady.

<details>
<summary>✅ Answer</summary>

```bash
# Problem: Node shows NotReady status
kubectl get nodes
# master   Ready    control-plane
# node1    NotReady <none>

# Step 1: Check node conditions
kubectl describe node node1 | grep -A 10 "Conditions:"
# Conditions:
#   Type                 Status  LastHeartbeatTime         LastTransitionTime        Reason
#   ----                 ------  -----------------         ------------------        ------
#   MemoryPressure       False   Mon, 08 May 2024 10:20    Mon, 08 May 2024 10:15    KubeletHasSufficientMemory
#   DiskPressure         False   Mon, 08 May 2024 10:20    Mon, 08 May 2024 10:15    KubeletHasInsufficientDisk
#   PIDPressure          False   Mon, 08 May 2024 10:20    Mon, 08 May 2024 10:15    KubeletHasSufficientPID
#   Ready                False   Mon, 08 May 2024 10:15    Mon, 08 May 2024 10:00    KubeletNotReady

# Step 2: SSH to the node and check kubelet status
ssh node1
systemctl status kubelet

# Output might show:
# ● kubelet.service - Kubernetes Kubelet
#   Loaded: loaded (/lib/systemd/system/kubelet.service; enabled; vendor preset: enabled)
#   Active: failed (Result: exit-code) since Mon 2024-05-08 10:00:00 UTC;
#   Process: 1234 ExecStart=/usr/bin/kubelet ... (code=exited, status=1)

# Step 3: Check kubelet logs
journalctl -u kubelet -n 100 | head -50

# Step 4: Identify the error
# Common NotReady reasons:

# A. Container runtime error:
journalctl -u kubelet | grep -i "runtime"
# kubelet: error: unable to connect to container runtime
# Fix: systemctl restart docker (or containerd)

# B. Network plugin (CNI) not ready:
journalctl -u kubelet | grep -i "network"
# kubelet: E0508 10:00:15.123456    1234 kubelet.go:2367] Failed to get cgroup stats
# Fix: Install/restart CNI plugin DaemonSet

# C. Disk space issue:
journalctl -u kubelet | grep -i "disk"
# kubelet: E0508 10:00:15.123456    1234 kubelet.go:2367] Node is not ready: DiskPressure
# Fix: Free disk space on node

# D. Memory pressure:
journalctl -u kubelet | grep -i "memory"
# kubelet: E0508 10:00:15.123456    1234 kubelet.go:2367] Node is not ready: MemoryPressure
# Fix: Free memory or increase node resources

# E. Kubelet crashing:
ps aux | grep kubelet
# If no kubelet process, it's crashed
# Check why:
journalctl -u kubelet --reverse | head -20
# Fix: systemctl start kubelet

# Step 5: Check system logs for hardware issues
dmesg | tail -50
# Look for: hardware errors, OOM, kernel panics
```

NotReady diagnosis table:

| Condition | Cause | Fix |
|-----------|-------|-----|
| **DiskPressure** | Disk full | Free disk space, increase node storage |
| **MemoryPressure** | Memory low | Free memory, scale pods down |
| **Ready=False** | Kubelet not responding | Restart kubelet, check connectivity |
| **CordonSchedulingDisabled** | Node cordoned | `kubectl uncordon <node>` |
| **NetworkUnavailable** | CNI not ready | Install/restart CNI plugin |

> **Key Concept:** NotReady indicates kubelet not reporting readiness. Check kubelet logs on the node, verify container runtime, CNI, and system resources.

</details>

---

### Question 5 — Monitor and search API audit logs
> ⏱️ **Recommended Time: 7 minutes**

Investigate API audit logs to find security-relevant events.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to control plane
ssh control-plane

# Find audit log location
cat /etc/kubernetes/manifest/kube-apiserver.yaml | grep audit
# Look for: --audit-log-path=/var/log/audit/audit.log

# View recent audit events
tail -f /var/log/audit/audit.log | jq '.'

# Search for specific actions:

# Find all pod deletions
grep "verb.*delete" /var/log/audit/audit.log | jq 'select(.objectRef.resource=="pods")' | \
  jq '{user: .user.username, timestamp: .stageTimestamp, pod: .objectRef.name}'

# Find all successful authentications
grep "\"verb\":\"create\"" /var/log/audit/audit.log | grep "\"kind\":\"Token\"" | \
  jq '{user: .user.username, timestamp: .stageTimestamp}'

# Find failed API requests
grep "\"code\":40" /var/log/audit/audit.log | jq '{user: .user.username, verb: .verb, status: .responseStatus.code}'

# Track RBAC changes
grep "\"resource\":\"roles\"" /var/log/audit/audit.log | grep "verb.*\(create\|update\|delete\)" | \
  jq '{user: .user.username, action: .verb, role: .objectRef.name}'

# Find all cluster admin actions
grep "\"groups\":\[\"system:masters\"\]" /var/log/audit/audit.log | \
  jq '{user: .user.username, action: .verb, resource: .objectRef.resource}'

# Find requests from specific user
grep "\"username\":\"alice\"" /var/log/audit/audit.log | jq '{timestamp, verb, resource: .objectRef.resource}'

# Find requests to modify secrets
grep "\"resource\":\"secrets\"" /var/log/audit/audit.log | grep "verb.*\(create\|update\|patch\)" | \
  jq '{user: .user.username, action: .verb, secret: .objectRef.name, namespace: .objectRef.namespace}'

# Parse human-readable format (if configured)
cat /var/log/audit/audit.log | jq '.[] | "\(.stageTimestamp) \(.user.username) \(.verb) \(.objectRef.resource) \(.objectRef.name)"' -r

# Count events by verb
cat /var/log/audit/audit.log | jq '.verb' | sort | uniq -c | sort -rn

# Find all events for a specific pod across all users
grep "\"name\":\"my-pod\"" /var/log/audit/audit.log | \
  jq 'select(.objectRef.resource=="pods")' | \
  jq '{timestamp: .stageTimestamp, user: .user.username, verb: .verb, status: .responseStatus.code}'
```

Audit log investigation examples:

```bash
# Security incident: Find who accessed sensitive data
grep "\"objectRef\":.*\"namespace\":\"secrets\"" /var/log/audit/audit.log | \
  jq '{user, timestamp: .stageTimestamp, verb, secret: .objectRef.name}'

# Compliance: Find all RBAC modifications
grep "\"resource\":\"\(roles\|rolebindings\|clusterroles\|clusterrolebindings\)\"" /var/log/audit/audit.log | \
  jq '{timestamp: .stageTimestamp, user: .user.username, action: .verb, object: .objectRef.name}'

# Debugging: Find all events for failed pod creation
grep "\"resource\":\"pods\"" /var/log/audit/audit.log | \
  grep "\"verb\":\"create\"" | \
  jq 'select(.responseStatus.code >= 400)' | \
  jq '{user: .user.username, pod: .objectRef.name, error: .responseStatus.message}'
```

> **Key Concept:** API audit logs provide complete API request history. Use for security investigations, compliance audits, and troubleshooting API-related issues.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Correlate logs across multiple components
> ⏱️ **Recommended Time: 8 minutes**

Use kubelet, API server, and event logs together to diagnose complex issues.

<details>
<summary>✅ Answer</summary>

```bash
# Scenario: Pod creation fails silently. Diagnose using multiple log sources.

# Problem: kubectl create pod, but pod doesn't appear
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: mystery-pod
spec:
  containers:
  - name: app
    image: non-existent:latest
EOF

# Pod doesn't appear, or stays Pending

# Step 1: Check events (highest-level logs)
kubectl describe pod mystery-pod
# Events:
#   Warning  FailedPullImage  5s     kubelet  Failed to pull image "non-existent:latest":...

# Step 2: Check API server audit (who/what was requested)
ssh control-plane
grep "mystery-pod" /var/log/audit/audit.log | jq '{user: .user.username, verb: .verb, status: .responseStatus.code}' | head -5

# Step 3: Check kubelet logs on the node (detailed error)
ssh <node-where-pod-is-scheduled>
journalctl -u kubelet | grep -i "mystery-pod"
# kubelet: E0508 10:15:02.123456    1234 kuberuntime_manager.go:234] Failed to start container "app": ...
# kubelet: E0508 10:15:02.234567    1234 kuberuntime_manager.go:456] Failed to pull image "non-existent:latest": image not found

# Step 4: Correlate timestamps
# API audit: 10:15:00 - Pod creation requested
# Kubelet: 10:15:01 - Pod scheduled to node
# Kubelet: 10:15:02 - Image pull failed
# Events: 10:15:02 - FailedPullImage warning

# Root cause: Image doesn't exist

# Step 5: Fix and verify logs confirm success
# Update image to valid one:
kubectl set image pod/mystery-pod app=busybox:1.28

# Verify in logs:
kubectl describe pod mystery-pod | grep -A 10 "Events:"
# Normal   Scheduled   Pod assigned to node
# Normal   Pulling     Pulling image "busybox:1.28"
# Normal   Pulled      Successfully pulled image

journalctl -u kubelet | grep mystery-pod | grep -i "successfully\|started"
# kubelet: E0508 10:20:15.123456    1234 kuberuntime_manager.go:234] Started container "app"
```

Multi-log correlation table:

| Component | What It Shows | When to Check |
|-----------|--------------|---------------|
| **kubectl get events** | User-visible pod events (Scheduled, Pulled, Started, Failed) | First - high-level overview |
| **kubectl describe pod** | Events + object spec (what was requested) | After events, to see config |
| **kubelet logs** | Container runtime details, actual errors (image pull, startup) | When events don't explain why |
| **API audit logs** | Who/what/when of API requests, response codes | For security, permission issues |
| **System logs (dmesg)** | Hardware errors, kernel OOM, network issues | For system-level problems |

Diagnosis workflow:

```
Pod not appearing?
├─ kubectl get events (see what happened)
│  └─ FailedPullImage/FailedScheduling/Pending?
├─ kubectl describe pod (see events + config)
│  └─ Wrong image? Port mismatch? No resources?
├─ journalctl -u kubelet (detailed kubelet view)
│  └─ Container runtime errors, eviction, resource issues
├─ API audit logs (who requested what)
│  └─ Wrong RBAC? API server rejected?
└─ dmesg / system logs (node-level issues)
   └─ Hardware errors, OOM, network down?
```

> **Key Concept:** Multi-component diagnosis: events (what), describe (config), kubelet logs (why), audit logs (who), system logs (hardware). Each provides different context.

</details>

---

## 📌 Quick Reference

```bash
# Kubelet logs
ssh <node>
journalctl -u kubelet -n 50      # Last 50 lines
journalctl -u kubelet -f         # Follow in real-time
journalctl -u kubelet -p err     # Errors only

# Events
kubectl get events               # All events
kubectl get events -w            # Watch events
kubectl describe pod <pod>       # Events for specific pod
kubectl get events --field-selector reason=FailedScheduling

# Node status
kubectl describe node <node>
kubectl get node <node> -o yaml

# API audit logs (on control plane)
ssh control-plane
tail -f /var/log/audit/audit.log | jq '.'
grep "\"verb\":\"delete\"" /var/log/audit/audit.log | jq '.objectRef'

# System logs (on node)
ssh <node>
dmesg | tail -50
systemctl status kubelet
```

### Related Topics

- 🔗 [Application Logging](./application-logging.md) — Pod and container logs
- 🔗 [Troubleshooting](../cluster-architecture/troubleshooting.md) — General debugging approaches
