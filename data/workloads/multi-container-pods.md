# 🫙 Multi-Container Pods

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Multi-Container Pods  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Create a Pod with Two Containers Sharing a Volume
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `shared-vol-pod` in the `default` namespace with two containers:

- `writer`: uses `busybox:1.28`, writes the current date every 5 seconds to `/shared/date.txt`
- `reader`: uses `busybox:1.28`, runs `tail -F /shared/date.txt`

Both containers share the same `emptyDir` volume mounted at `/shared`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-vol-pod
  namespace: default
spec:
  volumes:
  - name: shared-data
    emptyDir: {}

  containers:
  - name: writer
    image: busybox:1.28
    command: ["sh", "-c", "while true; do date >> /shared/date.txt; sleep 5; done"]
    volumeMounts:
    - name: shared-data
      mountPath: /shared

  - name: reader
    image: busybox:1.28
    command: ["sh", "-c", "tail -F /shared/date.txt"]
    volumeMounts:
    - name: shared-data
      mountPath: /shared
```

```bash
kubectl apply -f shared-vol-pod.yaml

# Verify both containers are running
kubectl get pod shared-vol-pod

# Watch the reader output
kubectl logs shared-vol-pod -c reader --follow
```

> **Key Concept:** Containers within the same pod share the same network namespace (same IP, same ports) and can share storage via `emptyDir` volumes. `emptyDir` is created when the pod is assigned to a node and deleted when the pod is removed. It is stored in memory if `medium: Memory` is set, otherwise on disk.

</details>

---

### Question 2 — Exec into a Specific Container in a Multi-Container Pod
> ⏱️ **Recommended Time: 4 minutes**

A Pod named `multi-pod` in the `default` namespace has two containers: `app` and `sidecar`. Open an interactive shell in the `sidecar` container and verify the hostname.

<details>
<summary>✅ Answer</summary>

```bash
# List containers in the pod
kubectl describe pod multi-pod | grep -A 2 "Containers:"

# Exec into the sidecar container
kubectl exec -it multi-pod -c sidecar -- sh

# Inside the container:
hostname
# multi-pod  (all containers in a pod share the same hostname = pod name)

exit

# Run a one-off command without interactive shell
kubectl exec multi-pod -c sidecar -- hostname
kubectl exec multi-pod -c sidecar -- env
```

> **Key Concept:** When a pod has multiple containers, you **must** specify `-c <container-name>` with `kubectl exec` and `kubectl logs`. All containers in a pod share the same hostname (the pod name) and network namespace — they communicate via `localhost`. Omitting `-c` defaults to the first container defined in the spec.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Sidecar Pattern: Log Forwarder
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `sidecar-pod` in the `default` namespace implementing the **sidecar pattern**:

- `app` container: uses `busybox:1.28`, writes log entries to `/var/log/app/app.log` every 3 seconds
- `log-forwarder` sidecar: uses `busybox:1.28`, streams `/var/log/app/app.log` to its stdout so `kubectl logs` can access app logs

Both share an `emptyDir` volume at `/var/log/app`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sidecar-pod
  namespace: default
spec:
  volumes:
  - name: log-vol
    emptyDir: {}

  containers:
  - name: app
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      mkdir -p /var/log/app
      while true; do
        echo "$(date) INFO app is running" >> /var/log/app/app.log
        sleep 3
      done
    volumeMounts:
    - name: log-vol
      mountPath: /var/log/app

  - name: log-forwarder
    image: busybox:1.28
    command: ["sh", "-c", "tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: log-vol
      mountPath: /var/log/app
```

```bash
kubectl apply -f sidecar-pod.yaml

# Access app logs via the sidecar (app container doesn't write to stdout)
kubectl logs sidecar-pod -c log-forwarder --follow

# The app container logs are empty since it writes to file, not stdout
kubectl logs sidecar-pod -c app
```

> **Key Concept:** The **sidecar pattern** extends the main container's behaviour without modifying it. Common uses: log shipping, metrics collection, TLS termination, config reloading. The sidecar runs alongside the main container for the pod's entire lifetime, unlike init containers which exit before the main container starts.

</details>

---

### Question 4 — Ambassador Pattern: Proxy Container
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `ambassador-pod` in the `default` namespace implementing the **ambassador pattern**:

- `app` container: uses `busybox:1.28`, connects to `localhost:6379` (assumes a Redis proxy is there)
- `redis-proxy` ambassador: uses `busybox:1.28`, simulates a proxy by listening and forwarding (use `nc -l -p 6379` for simulation)

Demonstrate that the `app` container can reach the ambassador via `localhost`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ambassador-pod
  namespace: default
spec:
  containers:
  - name: redis-proxy
    image: busybox:1.28
    command: ["sh", "-c", "while true; do nc -l -p 6379; done"]

  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "sleep 5 && echo 'PING' | nc localhost 6379 && sleep 3600"]
```

```bash
kubectl apply -f ambassador-pod.yaml

# Verify both containers are running
kubectl get pod ambassador-pod

# Check app container logs — it communicates with the proxy via localhost
kubectl logs ambassador-pod -c app

# Check proxy received the connection
kubectl logs ambassador-pod -c redis-proxy
```

> **Key Concept:** The **ambassador pattern** places a proxy container between the main app and an external service. Since all containers in a pod share the same network namespace, the app talks to `localhost:<port>` and the ambassador handles the actual external connection. This decouples connection logic (retries, TLS, routing) from the application code. Real-world examples: Envoy proxy, Redis Sentinel proxy.

</details>

---

### Question 5 — Adapter Pattern: Normalising Output
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `adapter-pod` in the `default` namespace implementing the **adapter pattern**:

- `app` container: uses `busybox:1.28`, writes non-standard log format `TIMESTAMP|LEVEL|MESSAGE` to `/shared/raw.log`
- `adapter` container: uses `busybox:1.28`, reads `/shared/raw.log` and reformats each line to `[LEVEL] MESSAGE` on its stdout

Both share an `emptyDir` volume at `/shared`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: adapter-pod
  namespace: default
spec:
  volumes:
  - name: shared-log
    emptyDir: {}

  containers:
  - name: app
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      while true; do
        echo "$(date +%s)|INFO|application is healthy" >> /shared/raw.log
        echo "$(date +%s)|WARN|high memory usage detected" >> /shared/raw.log
        sleep 5
      done
    volumeMounts:
    - name: shared-log
      mountPath: /shared

  - name: adapter
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      tail -F /shared/raw.log | while read line; do
        level=$(echo "$line" | cut -d'|' -f2)
        message=$(echo "$line" | cut -d'|' -f3)
        echo "[$level] $message"
      done
    volumeMounts:
    - name: shared-log
      mountPath: /shared
```

```bash
kubectl apply -f adapter-pod.yaml

# Raw output from app (pipe-delimited)
kubectl exec adapter-pod -c app -- cat /shared/raw.log

# Normalised output from adapter
kubectl logs adapter-pod -c adapter --follow
# [INFO] application is healthy
# [WARN] high memory usage detected
```

> **Key Concept:** The **adapter pattern** transforms the main container's output into a standardised format expected by external systems (monitoring tools, log aggregators). It keeps the main application unchanged while providing a compatible interface. Other examples: converting Prometheus metrics format, translating between API versions, filtering sensitive fields from logs.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Troubleshoot a Restarting Container in a Multi-Container Pod
> ⏱️ **Recommended Time: 9 minutes**

A Pod named `troubled-pod` in the `default` namespace has two containers: `main-app` and `helper`. The `helper` container keeps restarting. Identify the root cause and fix it.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check pod status
kubectl get pod troubled-pod
# Example: READY 1/2, RESTARTS shows high count on one container

# Step 2 — Identify which container is restarting
kubectl get pod troubled-pod -o jsonpath=\
'{range .status.containerStatuses[*]}{.name}{" restarts: "}{.restartCount}{"\n"}{end}'

# Step 3 — Check the current state and last termination reason
kubectl describe pod troubled-pod | grep -A 15 "helper:"

# Look for:
# Last State: Terminated
#   Reason:    Error / OOMKilled / Completed
#   Exit Code: 1 / 137 / 0

# Step 4 — Read the logs from the failed instance
kubectl logs troubled-pod -c helper --previous

# Step 5 — Common causes and fixes:

# A. OOMKilled (Exit Code 137) → increase memory limit
kubectl get pod troubled-pod -o yaml | grep -A 5 resources

# B. Command exits immediately (Exit Code 0) → add a long-running command
# The container needs a foreground process; e.g., replace `echo done` with `sleep infinity`

# C. Dependency not ready → add a wait loop or use an init container

# Step 6 — Fix by editing the deployment (if managed by one)
kubectl get pod troubled-pod -o yaml > troubled-pod.yaml
# Edit the yaml, fix the issue
kubectl delete pod troubled-pod
kubectl apply -f troubled-pod.yaml
```

Restart reason reference:

| Exit Code | Reason | Fix |
|-----------|--------|-----|
| `0` | Container exited normally (no foreground process) | Add `sleep infinity` or a long-running command |
| `1` | Application error | Check logs, fix the command/config |
| `137` | OOMKilled — exceeded memory limit | Increase memory limit or reduce usage |
| `143` | SIGTERM — graceful shutdown | Check if something is sending kill signals |

> **Key Concept:** In a multi-container pod, one container restarting does not automatically restart others — each container has its own restart counter. Use `kubectl describe pod` to see per-container state and `--previous` to get the logs of the last failed run. A container with `Exit Code: 0` that keeps restarting means it has no long-running foreground process.

</details>

---

### Question 7 — Shared Process Namespace Between Containers
> ⏱️ **Recommended Time: 10 minutes**

Create a Pod named `shared-pid-pod` in the `default` namespace with `shareProcessNamespace: true`. It should have:

- `app` container: uses `nginx:alpine`, runs normally
- `inspector` container: uses `busybox:1.28`, lists all running processes (including nginx) and sleeps

Demonstrate that the `inspector` container can see the `app` container's processes.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-pid-pod
  namespace: default
spec:
  shareProcessNamespace: true      # KEY: all containers share one PID namespace

  containers:
  - name: app
    image: nginx:alpine

  - name: inspector
    image: busybox:1.28
    command: ["sh", "-c", "ps aux && sleep 3600"]
    securityContext:
      capabilities:
        add:
        - SYS_PTRACE              # required to inspect other processes
```

```bash
kubectl apply -f shared-pid-pod.yaml

# Exec into inspector and list all processes — nginx should be visible
kubectl exec shared-pid-pod -c inspector -- ps aux

# Expected output includes nginx processes from the app container:
# PID   USER     COMMAND
# 1     root     /pause
# 8     root     nginx: master process ...
# 15    nobody   nginx: worker process
# 21    root     sh -c ps aux && sleep 3600
# 27    root     sleep 3600

# Without shareProcessNamespace, inspector would only see its own processes
```

Without `shareProcessNamespace`:
```bash
# inspector only sees its own processes
# PID   USER     COMMAND
# 1     root     sh -c ps aux && sleep 3600
# 7     root     sleep 3600
```

> **Key Concept:** By default, each container has its own isolated PID namespace and cannot see other containers' processes. Setting `shareProcessNamespace: true` merges all containers into a single PID namespace — useful for debugging (signal processes, inspect state) and for security tools that need to monitor all processes. Note that PID 1 in a shared namespace is the pause/infra container, not the app.

</details>

---

## 📌 Quick Reference

### Multi-Container Patterns

| Pattern | Purpose | Communication |
|---------|---------|---------------|
| **Sidecar** | Extends main container (logging, metrics, sync) | Shared volume / localhost |
| **Ambassador** | Proxies outbound connections on behalf of main | localhost (shared network) |
| **Adapter** | Normalises main container output for external consumers | Shared volume |

### What Containers in a Pod Share

| Resource | Shared? | Notes |
|----------|---------|-------|
| Network namespace | ✅ Yes | Same IP, communicate via `localhost` |
| `emptyDir` volumes | ✅ When mounted | Must be explicitly mounted in each container |
| PID namespace | ❌ By default | Enable with `shareProcessNamespace: true` |
| Filesystem | ❌ By default | Each container has its own root fs |
| Environment variables | ❌ No | Defined per-container |

### Useful Commands

```bash
# Logs from a specific container
kubectl logs <pod> -c <container>

# Follow logs
kubectl logs <pod> -c <container> --follow

# Exec into a specific container
kubectl exec -it <pod> -c <container> -- sh

# Run a one-off command
kubectl exec <pod> -c <container> -- <command>

# Check per-container restart counts
kubectl get pod <pod> -o jsonpath=\
'{range .status.containerStatuses[*]}{.name}{": "}{.restartCount}{"\n"}{end}'

# Describe pod — shows all container states
kubectl describe pod <pod>
```

### Related Topics

- 🔗 [Init Containers](./init-containers.md) — run before main containers; used for setup tasks
- 🔗 [Logging & Monitoring](../logging-monitoring/logging-and-monitoring.md) — sidecar log forwarder pattern covered in Q8
- 🔗 [ConfigMaps](./configmaps.md) — inject config into specific containers using `envFrom` or volumes
