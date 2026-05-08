# 🔧 Init Containers

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Init Containers  
> **Total Questions:** 7

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

### Question 1 — Create a Pod with a Single Init Container
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `web-pod` in the `default` namespace using `nginx:alpine` as the main container. Add an init container named `init-setup` using `busybox:1.28` that writes the text `hello from init` to `/work-dir/index.html`. The main container should serve that file by mounting the same volume at `/usr/share/nginx/html`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  namespace: default
spec:
  volumes:
  - name: work-dir
    emptyDir: {}

  initContainers:
  - name: init-setup
    image: busybox:1.28
    command: ["sh", "-c", "echo 'hello from init' > /work-dir/index.html"]
    volumeMounts:
    - name: work-dir
      mountPath: /work-dir

  containers:
  - name: nginx
    image: nginx:alpine
    volumeMounts:
    - name: work-dir
      mountPath: /usr/share/nginx/html
```

```bash
kubectl apply -f web-pod.yaml

# Wait for init to complete and pod to become Running
kubectl get pod web-pod --watch

# Verify the file was written
kubectl exec web-pod -- cat /usr/share/nginx/html/index.html
# hello from init
```

> **Key Concept:** Init containers run **to completion** before any main container starts. They share volumes with the main container via `emptyDir`, making them ideal for pre-populating files, seeding databases, or downloading configuration. If an init container fails, Kubernetes restarts it (according to the pod's `restartPolicy`) until it succeeds.

</details>

---

### Question 2 — Inspect Init Container Status and Logs
> ⏱️ **Recommended Time: 4 minutes**

A Pod named `app-pod` in the `default` namespace has an init container. Check the status of the init container and retrieve its logs.

<details>
<summary>✅ Answer</summary>

```bash
# Check overall pod status — shows Init container phase
kubectl get pod app-pod

# Possible statuses:
# Init:0/1   → init container not yet started or running
# Init:1/1   → all init containers completed, main starting
# Running    → init completed, main container running

# Detailed init container status
kubectl describe pod app-pod | grep -A 20 "Init Containers"

# Retrieve init container logs (use -c with the init container name)
kubectl logs app-pod -c init-setup

# If init container has already completed, logs are still accessible
kubectl logs app-pod -c init-setup --previous
```

> **Key Concept:** Init container names must be specified with `-c` when fetching logs, just like regular containers. `kubectl describe pod` shows the init container's state (Waiting, Running, Terminated) and exit code under the `Init Containers` section. The pod status `Init:N/M` tells you N of M init containers have completed.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Multiple Sequential Init Containers
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `multi-init-pod` in the `default` namespace with the following:

- **Init container 1** (`init-step1`): uses `busybox:1.28`, writes `step1` to `/data/steps.txt`
- **Init container 2** (`init-step2`): uses `busybox:1.28`, appends `step2` to `/data/steps.txt`
- **Main container** (`app`): uses `busybox:1.28`, runs `cat /data/steps.txt && sleep 3600`

All containers share the same `emptyDir` volume mounted at `/data`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-init-pod
  namespace: default
spec:
  volumes:
  - name: data-vol
    emptyDir: {}

  initContainers:
  - name: init-step1
    image: busybox:1.28
    command: ["sh", "-c", "echo step1 > /data/steps.txt"]
    volumeMounts:
    - name: data-vol
      mountPath: /data

  - name: init-step2
    image: busybox:1.28
    command: ["sh", "-c", "echo step2 >> /data/steps.txt"]
    volumeMounts:
    - name: data-vol
      mountPath: /data

  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "cat /data/steps.txt && sleep 3600"]
    volumeMounts:
    - name: data-vol
      mountPath: /data
```

```bash
kubectl apply -f multi-init-pod.yaml

# Watch init containers run sequentially
kubectl get pod multi-init-pod --watch
# Init:0/2 → Init:1/2 → Init:2/2 → Running

# Verify both steps were written in order
kubectl exec multi-init-pod -- cat /data/steps.txt
# step1
# step2
```

> **Key Concept:** Multiple init containers always run **sequentially in the order they are defined** — never in parallel. Each must exit with code `0` before the next one starts. This makes them ideal for ordered setup tasks like: (1) wait for a dependency, (2) run a migration, (3) seed config files. If any init container fails, the sequence restarts from that failed container.

</details>

---

### Question 4 — Init Container That Waits for a Service
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `dependent-pod` in the `default` namespace that uses an init container named `wait-for-db` to poll until a Service named `db-svc` is resolvable via DNS. Only once the service is available should the main container (`nginx:alpine`) start.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dependent-pod
  namespace: default
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      until nslookup db-svc.default.svc.cluster.local; do
        echo "Waiting for db-svc..."
        sleep 2
      done
      echo "db-svc is available!"

  containers:
  - name: app
    image: nginx:alpine
```

```bash
kubectl apply -f dependent-pod.yaml

# Pod stays in Init:0/1 until db-svc exists
kubectl get pod dependent-pod --watch

# Create the service to unblock the init container
kubectl create service clusterip db-svc --tcp=5432:5432

# Init container will resolve the DNS and exit 0, then main container starts
kubectl logs dependent-pod -c wait-for-db
```

> **Key Concept:** This is one of the most common real-world init container patterns — **dependency waiting**. Using `nslookup` or `wget` in a loop is a reliable way to gate pod startup on external service availability. The full DNS name `<service>.<namespace>.svc.cluster.local` is more reliable than the short name, especially across namespaces.

</details>

---

### Question 5 — Debug a Pod Stuck in Init:0/2
> ⏱️ **Recommended Time: 7 minutes**

A Pod named `broken-init-pod` in the `default` namespace is stuck in `Init:0/2`. Identify the root cause and fix it.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check the pod status
kubectl get pod broken-init-pod
# STATUS: Init:0/2 — first init container has not completed

# Step 2 — Describe the pod to find which init container is failing
kubectl describe pod broken-init-pod | grep -A 30 "Init Containers"

# Look for:
# - State: Waiting (reason: PodInitializing or CrashLoopBackOff)
# - State: Terminated (Exit Code: non-zero)
# - Image pull errors

# Step 3 — Check init container logs
kubectl logs broken-init-pod -c <init-container-name>

# Common root causes and fixes:

# A. Wrong image name → ImagePullBackOff
kubectl describe pod broken-init-pod | grep "Failed to pull image"
# Fix: kubectl edit pod broken-init-pod → correct the image name

# B. Command exits non-zero
kubectl logs broken-init-pod -c init-step1
# Fix: correct the command in the pod spec and recreate the pod

# C. Missing volume or wrong mount path
kubectl describe pod broken-init-pod | grep -i "mount\|volume"
# Fix: verify volume name matches between volumes and volumeMounts

# Step 4 — If the pod spec needs changes, delete and recreate
kubectl delete pod broken-init-pod
kubectl apply -f fixed-init-pod.yaml
```

> **Key Concept:** `Init:0/2` means the first of two init containers has not yet succeeded. Work through the diagnosis in order: (1) `kubectl describe` for state and events, (2) `kubectl logs -c <init-name>` for the actual error output, (3) fix the root cause. Note that init container specs **cannot be edited in-place** on a running pod — you must delete and recreate the pod.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Init Container Populating Config for a Sidecar Pattern
> ⏱️ **Recommended Time: 9 minutes**

Create a Pod named `config-pod` in the `default` namespace with:

- **Init container** (`init-config`): uses `busybox:1.28`, generates a config file at `/etc/app/config.json` with the content `{"env":"production","debug":false}`
- **Main container** (`app`): uses `nginx:alpine`, reads from `/etc/app/config.json`
- **Sidecar container** (`log-watcher`): uses `busybox:1.28`, runs `tail -F /etc/app/config.json`

All three share the same `emptyDir` volume at `/etc/app`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-pod
  namespace: default
spec:
  volumes:
  - name: app-config
    emptyDir: {}

  initContainers:
  - name: init-config
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      mkdir -p /etc/app
      echo '{"env":"production","debug":false}' > /etc/app/config.json
      echo "Config file written:"
      cat /etc/app/config.json
    volumeMounts:
    - name: app-config
      mountPath: /etc/app

  containers:
  - name: app
    image: nginx:alpine
    volumeMounts:
    - name: app-config
      mountPath: /etc/app

  - name: log-watcher
    image: busybox:1.28
    command: ["sh", "-c", "tail -F /etc/app/config.json"]
    volumeMounts:
    - name: app-config
      mountPath: /etc/app
```

```bash
kubectl apply -f config-pod.yaml

# Verify init container ran and file exists
kubectl exec config-pod -c app -- cat /etc/app/config.json
# {"env":"production","debug":false}

# Check sidecar is streaming the file
kubectl logs config-pod -c log-watcher
```

> **Key Concept:** Init containers and regular containers can all share the same `emptyDir` volume. The init container runs first and sets up the shared state, which is then available to all main containers simultaneously when they start. This pattern is commonly used for: generating dynamic configs, fetching secrets from vaults, or compiling assets before the app server starts.

</details>

---

### Question 7 — Native Sidecar with restartPolicy: Always (Kubernetes 1.29+)
> ⏱️ **Recommended Time: 10 minutes**

Kubernetes 1.29 introduced native sidecar support via `restartPolicy: Always` on init containers. Create a Pod named `native-sidecar-pod` in the `default` namespace that uses this pattern to run a log-forwarding sidecar (`log-agent`) that starts **before** the main app container and stays running for the pod's lifetime.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: native-sidecar-pod
  namespace: default
spec:
  volumes:
  - name: shared-logs
    emptyDir: {}

  initContainers:
  # Native sidecar: restartPolicy: Always keeps it running alongside main containers
  - name: log-agent
    image: busybox:1.28
    restartPolicy: Always          # KEY: makes this a native sidecar (K8s 1.29+)
    command: ["sh", "-c", "tail -F /var/log/app/app.log 2>/dev/null || sleep infinity"]
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app

  containers:
  - name: app
    image: busybox:1.28
    command:
    - sh
    - -c
    - |
      mkdir -p /var/log/app
      while true; do
        echo "$(date) - app log entry" >> /var/log/app/app.log
        sleep 3
      done
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
```

```bash
kubectl apply -f native-sidecar-pod.yaml

# The log-agent init container starts first and stays running
kubectl get pod native-sidecar-pod
# READY shows 1/1 (only main containers count toward readiness)

# Verify log-agent is running alongside the main container
kubectl describe pod native-sidecar-pod | grep -A 5 "log-agent"

# View logs from both
kubectl logs native-sidecar-pod -c log-agent
kubectl logs native-sidecar-pod -c app
```

Behaviour differences vs traditional init containers:

| | Traditional Init Container | Native Sidecar (`restartPolicy: Always`) |
|--|---------------------------|------------------------------------------|
| Runs until | Exits (code 0) | Pod terminates |
| Starts before main | ✅ Yes | ✅ Yes |
| Restarts on failure | Per pod `restartPolicy` | Always |
| Counted in READY | ❌ No | ❌ No |
| Kubernetes version | All versions | 1.29+ (stable 1.33) |

> **Key Concept:** Native sidecars solve a longstanding problem: sidecars that need to start before the main container AND run for the pod's full lifetime. With `restartPolicy: Always` on an init container, Kubernetes starts it in init order but keeps it running. The pod is considered ready once all native sidecars are ready AND the main containers are ready. This is the recommended pattern for service meshes, log forwarders, and metric collectors.

</details>

---

## 📌 Quick Reference

### Init Container Lifecycle

```
Pod scheduled
    ↓
Init container 1 runs → must exit 0
    ↓
Init container 2 runs → must exit 0
    ↓
  ... (sequential)
    ↓
All main containers start simultaneously
```

### Pod Init Status Reference

| Status | Meaning |
|--------|---------|
| `Init:0/2` | 0 of 2 init containers completed |
| `Init:1/2` | 1 of 2 init containers completed |
| `Init:CrashLoopBackOff` | An init container is repeatedly failing |
| `Init:Error` | An init container exited with a non-zero code |
| `PodInitializing` | All init containers done, main containers starting |
| `Running` | All init containers done, main containers running |

### Init vs Sidecar vs Main Container

```
Init container   → Runs before main; exits when done; sequential
Sidecar          → Runs alongside main; helper/observer pattern
Main container   → Primary application workload
```

### Useful Commands

```bash
# View init container status
kubectl get pod <name>
kubectl describe pod <name> | grep -A 20 "Init Containers"

# Logs from an init container
kubectl logs <pod> -c <init-container-name>

# Logs from previous failed init container
kubectl logs <pod> -c <init-container-name> --previous

# Watch pod progress through init phases
kubectl get pod <name> --watch

# Delete and recreate pod (required to change init container spec)
kubectl delete pod <name>
kubectl apply -f <manifest>
```

### Related Topics

- 🔗 [Multi-Container Pods](./multi-container-pods.md) — sidecar, ambassador, and adapter patterns for regular containers
- 🔗 [ConfigMaps](./configmaps.md) — alternative to init containers for injecting static config
- 🔗 [Secrets](./secrets.md) — init containers can fetch secrets and write them to shared volumes
