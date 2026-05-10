# 📋 Application Logging

> **CKA Exam Domain:** Logging & Monitoring  
> **Topic:** Pod logs, multi-container pods, previous pod logs, log aggregation  
> **Total Questions:** 6

---

## 🟢 Easy Questions

---

### Question 1 — View pod logs
> ⏱️ **Recommended Time: 4 minutes**

View logs from a running pod named `app-pod`.

<details>
<summary>✅ Answer</summary>

```bash
# View pod logs (latest lines)
kubectl logs app-pod

# View logs with timestamps
kubectl logs app-pod --timestamps=true

# View last N lines
kubectl logs app-pod --tail=50

# View logs since a specific time
kubectl logs app-pod --since=1h
kubectl logs app-pod --since=2024-05-08T10:00:00Z

# Follow logs in real-time (like tail -f)
kubectl logs -f app-pod

# Get logs from all containers in a pod (even if one crashed)
kubectl logs app-pod --all-containers=true

# Get logs in a specific namespace
kubectl logs app-pod -n production

# Search logs for specific text
kubectl logs app-pod | grep "ERROR"
kubectl logs app-pod | grep -i "warning"
```

Common flags:

| Flag                    | Purpose                                |
|-------------------------|----------------------------------------|
| `-f, --follow`          | Stream logs (like `tail -f`)           |
| `--tail=N`              | Show last N lines                      |
| `--timestamps=true`     | Include timestamps                     |
| `--since=TIME`          | Show logs since timestamp              |
| `--previous`            | Show logs from previous pod restart    |
| `-c, --container=NAME`  | Logs from specific container           |
| `--all-containers=true` | Logs from all containers               |
| `-l, --selector=LABEL`  | Logs from pods matching label selector |
| `--limit-bytes=N`       | Limit output to N bytes                |

> **Key Concept:** `kubectl logs` retrieves stdout/stderr from the container. Logs are stored in `/var/log/containers/` on the node. If a container restarts, previous logs are available with `--previous`.

</details>

---

### Question 2 — View logs from previous pod restart
> ⏱️ **Recommended Time: 4 minutes**

Retrieve logs from a crashed container before it restarted using `--previous` flag.

<details>
<summary>✅ Answer</summary>

```bash
# Create a crashing pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: crashing-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "echo 'App started' && sleep 2 && exit 1"]
  restartPolicy: Always
EOF

# Wait for pod to crash and restart
sleep 5
kubectl get pod crashing-pod
# READY   STATUS    RESTARTS   AGE
# 0/1     Waiting   1          5s    (restarting)

# View logs from current container
kubectl logs crashing-pod
# App started

# View logs from previous restart
kubectl logs crashing-pod --previous
# App started   (from the crashed container)

# If multiple restarts, --previous shows only last restart
# To see all history, check pod events
kubectl describe pod crashing-pod | grep -A 20 "Events:"
# Shows all restart history with timestamps
```

> **Key Concept:** When a container restarts, previous logs are stored separately. Use `--previous` to view the crashed container's logs. This is critical for debugging crash loops.

</details>

---

### Question 3 — View logs from multi-container pods
> ⏱️ **Recommended Time: 5 minutes**

Get logs from specific containers in a multi-container pod.

<details>
<summary>✅ Answer</summary>

```bash
# Create multi-container pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: multi-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "while true; do echo 'APP LOG'; sleep 2; done"]
  - name: sidecar
    image: busybox:1.28
    command: ["sh", "-c", "while true; do echo 'SIDECAR LOG'; sleep 3; done"]
EOF

# View logs from main container
kubectl logs multi-pod -c app

# View logs from sidecar container
kubectl logs multi-pod -c sidecar

# Follow logs from app container
kubectl logs -f multi-pod -c app

# If no container specified (multi-container pod), error occurs
kubectl logs multi-pod
# error: a container name must be specified for pod multi-pod, choose one of: [app sidecar]

# View logs from all containers
kubectl logs multi-pod --all-containers=true

# View logs from all containers with follow
kubectl logs -f multi-pod --all-containers=true
```

> **Key Concept:** Multi-container pods require the `--container` (`-c`) flag to specify which container's logs to view. Use `--all-containers=true` to see logs from all containers interleaved.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Get logs from a Deployment's pods
> ⏱️ **Recommended Time: 6 minutes**

View logs from all pods managed by a Deployment using label selectors.

<details>
<summary>✅ Answer</summary>

```bash
# Create deployment
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: busybox:1.28
        command: ["sh", "-c", "echo 'App starting'; while true; do date; sleep 5; done"]
EOF

# View logs from all deployment pods (using label selector)
kubectl logs -l app=myapp

# Follow logs from all pods (streamed)
kubectl logs -f -l app=myapp

# Logs from all pods with timestamps
kubectl logs -l app=myapp --timestamps=true

# View logs from specific pod in deployment
kubectl logs -l app=myapp -c app

# Get logs from pods that recently crashed
kubectl logs -l app=myapp --previous

# Show only last 20 lines from each pod
kubectl logs -l app=myapp --tail=20

# Combine with grep to search across all pods
kubectl logs -l app=myapp | grep "ERROR"

# Get logs since specific time from all pods
kubectl logs -l app=myapp --since=10m
```

> **Key Concept:** Label selectors (`-l`) let you get logs from multiple pods at once. This is useful for Deployments, DaemonSets, and StatefulSets where multiple instances run with the same labels.

</details>

---

### Question 5 — Troubleshoot pod failures with logs
> ⏱️ **Recommended Time: 7 minutes**

Use logs combined with `describe` to diagnose why a pod is failing.

<details>
<summary>✅ Answer</summary>

```bash
# Create a pod that fails
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: fail-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "echo 'Starting'; sleep 1; echo 'ERROR: Database connection failed'; exit 1"]
  restartPolicy: OnFailure
EOF

# Step 1 — Check pod status
kubectl get pod fail-pod
# READY   STATUS              RESTARTS   AGE
# 0/1     BackOff             1          10s

# Step 2 — Describe for events and status
kubectl describe pod fail-pod
# Events:
#   Normal   Created     10s    kubelet  Created container app
#   Normal   Started     10s    kubelet  Started container app
#   Warning  BackOff     5s     kubelet  Back-off restarting failed container

# Step 3 — View logs from current container
kubectl logs fail-pod
# Starting
# ERROR: Database connection failed

# Step 4 — View logs from previous restart (if restarted)
kubectl logs fail-pod --previous
# (shows same output from first attempt)

# Step 5 — Get container exit code
kubectl get pod fail-pod -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'
# 1  (non-zero exit code = failure)

# Step 6 — Check container restart reason
kubectl get pod fail-pod -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
# Error  (or Completed, OOMKilled, Terminated)

# Diagnostic workflow:
# 1. Phase: Pending/Running/Failed/Succeeded?
# 2. Conditions: PodScheduled/Ready/ContainersReady?
# 3. Events: What happened?
# 4. Container state: Waiting/Running/Terminated?
# 5. Logs: What did the app say?
```

Common failure scenarios with log patterns:

| Log Pattern                    | Likely Cause            | Fix                                 |
|--------------------------------|-------------------------|-------------------------------------|
| **ImagePullBackOff** in events | Image not found         | Correct image name, add pull secret |
| **CrashLoopBackOff**           | App crashing repeatedly | Check logs, fix app startup         |
| **Connection refused** in logs | Service not ready       | Check service, pod endpoints        |
| **OOMKilled** in describe      | Out of memory           | Increase memory limit               |
| **Permission denied** in logs  | Security/RBAC issue     | Check RBAC, security context        |

> **Key Concept:** Combine three tools: `get pod` (quick status), `describe pod` (events), `logs` (app output). This trinity diagnoses ~90% of pod issues.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Access container logs on the node
> ⏱️ **Recommended Time: 8 minutes**

Directly access container logs from the node filesystem when `kubectl logs` is unavailable.

<details>
<summary>✅ Answer</summary>

```bash
# When kubelet/API server is down, access logs directly on node

# Step 1 — SSH to the node
ssh node1

# Step 2 — Container logs are stored in /var/log/containers/
ls -la /var/log/containers/
# pod_name_namespace_container_id-*.log symlinks

# Step 3 — Logs typically symlink to containerd/docker log files
ls -la /var/lib/docker/containers/   # Docker
ls -la /var/lib/containerd/io.containerd.grpc.v1.containers/  # Containerd

# Step 4 — Find specific pod's logs
# Format: /var/log/containers/{namespace}_{pod-name}_{pod-id}/{container-name}-*.log

POD_NAME="my-pod"
NAMESPACE="default"

# Find the container log file
LOG_FILE=$(find /var/log/containers -name "*${POD_NAME}*" -name "*.log" | head -1)
cat $LOG_FILE

# View in real-time
tail -f $LOG_FILE

# Search logs
grep "ERROR" $LOG_FILE
```

Log file locations by container runtime:

| Runtime | Log Location |
|---------|--------------|
| **Docker** | `/var/lib/docker/containers/{container-id}/{container-id}-json.log` |
| **Containerd** | `/var/lib/containerd/io.containerd.grpc.v1.containers/{container-id}/` |
| **CRI-O** | `/var/log/pods/{namespace}_{pod-name}_{pod-id}/{container-name}/` |

```bash
# Find which container runtime is used
ps aux | grep -E "docker|containerd|crio" | grep -v grep

# Get container ID from pod
kubectl get pod my-pod -o jsonpath='{.status.containerStatuses[0].containerID}'
# docker://5d4f7c6b88a9...

# Extract the ID part (without runtime prefix)
CONTAINER_ID="5d4f7c6b88a9..."
cat /var/lib/docker/containers/$CONTAINER_ID/${CONTAINER_ID}-json.log

# Parse JSON log format
cat /var/lib/docker/containers/$CONTAINER_ID/${CONTAINER_ID}-json.log | jq '.'
# Shows stdout/stderr entries with timestamps
```

> **Key Concept:** Node-level log access is emergency/forensic work — when API is down or pod logs are stuck. Logs are JSON-formatted by Docker/Containerd. Container runtime prefix in containerID must be removed to find log file.

</details>

---

## 📌 Quick Reference

```bash
# View logs
kubectl logs <pod-name>                           # View pod logs
kubectl logs <pod-name> -c <container-name>       # Specific container
kubectl logs <pod-name> --previous                # Previous restart logs
kubectl logs <pod-name> --all-containers=true     # All containers
kubectl logs -f <pod-name>                        # Follow logs
kubectl logs <pod-name> --tail=50                 # Last 50 lines
kubectl logs <pod-name> --since=1h                # Last hour
kubectl logs <pod-name> --timestamps=true         # With timestamps
kubectl logs -l <label>=<value>                   # All pods with label
kubectl logs -l <label>=<value> --all-containers  # All containers in labeled pods

# Debugging
kubectl describe pod <pod-name>                   # Events and status
kubectl get pod <pod-name> -o yaml                # Full spec
kubectl exec <pod-name> -- command                # Run command in pod
kubectl port-forward <pod-name> 8080:8080         # Port forward
kubectl attach <pod-name> -it                     # Attach to pod

# Node-level (emergency)
ssh <node-name>
tail -f /var/log/containers/{namespace}_{pod}_{id}/{container}*.log
cat /var/lib/docker/containers/{container-id}/*-json.log | jq '.'
```

### Related Topics

- 🔗 [Pod Fundamentals](./pods.md) — Pod lifecycle, debugging
- 🔗 [Multi-container Pods](./multi-container-pods.md) — Sidecar containers, container communication
