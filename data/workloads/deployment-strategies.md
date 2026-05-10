# 🚀 Deployment Strategies

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Deployment Strategies  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Create a Deployment with a Rolling Update Strategy
> ⏱️ **Recommended Time: 5 minutes**

Create a Deployment named `web-app` in the `default` namespace with the following specification:

- Image: `nginx:1.21`
- Replicas: `4`
- Update strategy: `RollingUpdate`
- `maxUnavailable`: `1`
- `maxSurge`: `1`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  namespace: default
spec:
  replicas: 4
  selector:
    matchLabels:
      app: web-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
```

```bash
kubectl apply -f web-app.yaml

# Verify the strategy
kubectl describe deployment web-app | grep -A 4 "StrategyType"
```

> **Key Concept:** `RollingUpdate` is the **default** strategy. It gradually replaces old pods with new ones. `maxUnavailable` controls how many pods can be down at once; `maxSurge` controls how many extra pods can be created above the desired count during the update. Both accept absolute numbers or percentages (e.g., `25%`).

</details>

---

### Question 2 — Perform an Image Update and Monitor the Rollout
> ⏱️ **Recommended Time: 5 minutes**

A Deployment named `web-app` in the `default` namespace is currently running `nginx:1.21`. Update the image to `nginx:1.25` and monitor the rollout until it completes.

<details>
<summary>✅ Answer</summary>

```bash
# Imperatively update the image
kubectl set image deployment/web-app nginx=nginx:1.25

# Watch the rollout progress
kubectl rollout status deployment/web-app

# Verify the new image is active
kubectl describe deployment web-app | grep Image
```

> **Key Concept:** `kubectl set image` is the fastest way to trigger a rolling update in an exam. `kubectl rollout status` blocks and streams progress until the rollout completes — useful for verifying success. The command exits with code `0` on success and non-zero on failure.

</details>

---

### Question 3 — Recreate Strategy: Replace All Pods at Once
> ⏱️ **Recommended Time: 5 minutes**

Create a Deployment named `batch-processor` in the `default` namespace using image `busybox:1.28` with `3` replicas, configured to use the `Recreate` update strategy.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: batch-processor
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: batch-processor
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        app: batch-processor
    spec:
      containers:
      - name: busybox
        image: busybox:1.28
        command: ["sleep", "3600"]
```

```bash
kubectl apply -f batch-processor.yaml

# Confirm strategy
kubectl get deployment batch-processor -o jsonpath='{.spec.strategy.type}'
```

> **Key Concept:** The `Recreate` strategy **terminates all existing pods before creating new ones**, causing a brief downtime. It is useful when the application cannot run two versions simultaneously (e.g., database schema migrations, singleton processes). There are no `maxUnavailable`/`maxSurge` options for `Recreate`.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Roll Back a Failed Deployment
> ⏱️ **Recommended Time: 7 minutes**

A Deployment named `api-server` in the `default` namespace was recently updated to `nginx:broken-image` and pods are failing to start. Roll back the Deployment to the previous working version and confirm the rollback succeeded.

<details>
<summary>✅ Answer</summary>

```bash
# Check the current rollout status (will show failure)
kubectl rollout status deployment/api-server

# View rollout history
kubectl rollout history deployment/api-server

# Roll back to the immediately previous revision
kubectl rollout undo deployment/api-server

# Watch rollback progress
kubectl rollout status deployment/api-server

# Verify the previous image is restored
kubectl describe deployment api-server | grep Image

# Confirm pod health
kubectl get pods -l app=api-server
```

> **Key Concept:** `kubectl rollout undo` reverts a Deployment to its previous revision. Kubernetes stores revision history (controlled by `revisionHistoryLimit`, default `10`). To roll back to a specific revision: `kubectl rollout undo deployment/<name> --to-revision=<N>`. Always confirm by checking the image and pod status after rollback.

</details>

---

### Question 5 — Pause and Resume a Rollout
> ⏱️ **Recommended Time: 7 minutes**

A Deployment named `frontend` in the `default` namespace has `6` replicas running `nginx:1.21`. You need to make two changes — update the image to `nginx:1.25` and add an environment variable `ENV=production` — but you want to apply both as a **single rollout** rather than two separate ones. Use pause/resume to accomplish this.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Pause the deployment to prevent immediate rollout
kubectl rollout pause deployment/frontend

# 2. Apply the first change — image update
kubectl set image deployment/frontend nginx=nginx:1.25

# 3. Apply the second change — environment variable
kubectl set env deployment/frontend ENV=production

# 4. Resume the deployment — triggers a single rollout with both changes
kubectl rollout resume deployment/frontend

# 5. Monitor the single combined rollout
kubectl rollout status deployment/frontend

# Verify both changes are applied
kubectl describe deployment frontend | grep -E "Image|ENV"
```

> **Key Concept:** Pausing a Deployment prevents any changes from triggering a rollout. You can accumulate multiple `kubectl set` or `kubectl patch` changes while paused, then resume to roll them all out together as one revision. This avoids multiple intermediate rollouts and revision history entries.

</details>

---

### Question 6 — Scale a Deployment and Verify Pod Distribution
> ⏱️ **Recommended Time: 6 minutes**

A Deployment named `web-app` is running in the `default` namespace with `2` replicas. Scale it to `6` replicas imperatively, then verify the pods are spread across multiple nodes.

<details>
<summary>✅ Answer</summary>

```bash
# Scale the deployment
kubectl scale deployment web-app --replicas=6

# Verify the scaling
kubectl get deployment web-app

# Check pod distribution across nodes
kubectl get pods -l app=web-app -o wide

# Output will show NODE column indicating which node each pod is on
```

> **Key Concept:** `kubectl scale` is the fastest imperative way to change replica counts. Pod distribution across nodes is controlled by the scheduler — by default it spreads pods to avoid placing all replicas on one node. Use `kubectl get pods -o wide` to confirm node spread. For guaranteed anti-affinity, use `podAntiAffinity` rules.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Implement a Canary Deployment
> ⏱️ **Recommended Time: 10 minutes**

You have a stable Deployment named `app-stable` in the `default` namespace running `nginx:1.21` with `4` replicas, labeled `app=myapp, track=stable`. Implement a **canary deployment** by creating a second Deployment named `app-canary` running `nginx:1.25` with `1` replica, labeled `app=myapp, track=canary`. Create a Service named `app-svc` that routes traffic to **both** stable and canary pods (approximately 80%/20% split based on replica ratio).

<details>
<summary>✅ Answer</summary>

```yaml
# stable-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-stable
  namespace: default
spec:
  replicas: 4
  selector:
    matchLabels:
      app: myapp
      track: stable
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
```

```yaml
# canary-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-canary
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
      track: canary
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
```

```yaml
# app-svc.yaml — matches BOTH stable and canary pods via the shared label
apiVersion: v1
kind: Service
metadata:
  name: app-svc
  namespace: default
spec:
  selector:
    app: myapp        # matches both stable and canary pods
  ports:
  - port: 80
    targetPort: 80
```

```bash
kubectl apply -f stable-deployment.yaml
kubectl apply -f canary-deployment.yaml
kubectl apply -f app-svc.yaml

# Verify: 5 pods total (4 stable + 1 canary) behind the service
kubectl get pods -l app=myapp --show-labels
kubectl describe service app-svc | grep Endpoints
```

> **Key Concept:** A canary deployment uses **two Deployments sharing a common label** (`app=myapp`) that a single Service selects. Traffic is split proportionally by replica count — 4 stable + 1 canary = ~80%/20% split. To promote the canary, scale it up and scale stable down. To abort, delete the canary Deployment. This pattern requires no special tooling beyond standard Kubernetes resources.

</details>

---

### Question 8 — Control Rolling Update Speed with maxUnavailable and maxSurge
> ⏱️ **Recommended Time: 9 minutes**

A Deployment named `high-availability-app` in the `production` namespace has `10` replicas running `nginx:1.21`. The application must maintain **at least 9 pods running at all times** during an update, and the total pod count must **never exceed 12**. Configure the rolling update strategy accordingly, then trigger an update to `nginx:1.25`.

<details>
<summary>✅ Answer</summary>

```bash
# Constraints:
# - At least 9 pods running → maxUnavailable = 10 - 9 = 1
# - Total never exceed 12  → maxSurge = 12 - 10 = 2

# Patch the deployment strategy
kubectl patch deployment high-availability-app -n production \
  --type='json' \
  -p='[
    {"op": "replace", "path": "/spec/strategy/type", "value": "RollingUpdate"},
    {"op": "replace", "path": "/spec/strategy/rollingUpdate/maxUnavailable", "value": 1},
    {"op": "replace", "path": "/spec/strategy/rollingUpdate/maxSurge", "value": 2}
  ]'

# Verify the strategy is set correctly
kubectl get deployment high-availability-app -n production \
  -o jsonpath='{.spec.strategy.rollingUpdate}'

# Trigger the image update
kubectl set image deployment/high-availability-app nginx=nginx:1.25 -n production

# Monitor the rollout
kubectl rollout status deployment/high-availability-app -n production
```

Alternatively, edit the manifest directly:

```yaml
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1   # 10 - 1 = 9 pods always available ✅
      maxSurge: 2         # 10 + 2 = 12 pods maximum         ✅
```

> **Key Concept:** Work backwards from the constraints to derive the values:
> - **`maxUnavailable`** = `desired replicas` − `minimum required running pods`
> - **`maxSurge`** = `maximum allowed total pods` − `desired replicas`
>
> Both values can be integers or percentages. Setting `maxUnavailable: 0` with `maxSurge: 1` gives a zero-downtime "one extra pod at a time" strategy. Setting `maxSurge: 0` with `maxUnavailable: 1` uses in-place replacement with no extra capacity.

</details>

---

## 📌 Quick Reference

| Strategy | Behaviour | Downtime? | Use Case |
|----------|-----------|-----------|----------|
| `RollingUpdate` | Gradually replaces pods | ❌ No | Most web apps, stateless services |
| `Recreate` | Kills all pods then creates new ones | ✅ Yes | Singleton apps, schema migrations |
| Canary | Two Deployments share a Service | ❌ No | Gradual traffic shifting, A/B testing |

### Rolling Update Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxUnavailable` | `25%` | Max pods that can be **down** during an update |
| `maxSurge` | `25%` | Max **extra** pods above the desired count during an update |

### Useful Commands

```bash
# Create / apply a deployment
kubectl apply -f deployment.yaml

# Update an image
kubectl set image deployment/<name> <container>=<image>

# Monitor a rollout
kubectl rollout status deployment/<name>

# View rollout history
kubectl rollout history deployment/<name>

# View details of a specific revision
kubectl rollout history deployment/<name> --revision=<N>

# Roll back to the previous revision
kubectl rollout undo deployment/<name>

# Roll back to a specific revision
kubectl rollout undo deployment/<name> --to-revision=<N>

# Pause a rollout (batch multiple changes)
kubectl rollout pause deployment/<name>

# Resume a paused rollout
kubectl rollout resume deployment/<name>

# Scale a deployment
kubectl scale deployment/<name> --replicas=<N>

# Patch update strategy
kubectl patch deployment <name> -p '{"spec":{"strategy":{"type":"Recreate"}}}'

# Check current strategy
kubectl get deployment <name> -o jsonpath='{.spec.strategy}'
```

### Strategy Decision Tree

```
Does the app support running two versions simultaneously?
├── YES → Use RollingUpdate (default)
│         ├── Need gradual traffic testing? → Add a Canary Deployment
│         └── Need to batch changes?        → Pause → change → Resume
└── NO  → Use Recreate (accepts brief downtime)
```

### Related Topics

- 🔗 [DaemonSets](../scheduling/daemonsets.md) — also supports `RollingUpdate` and `OnDelete` strategies
- 🔗 [Resource Requests & Limits](../scheduling/resource-requests-limits-quotas.md) — pods that exceed limits during a rollout can cause it to stall
- 🔗 [Labels, Selectors & Annotations](../scheduling/labels-selectors-annotations.md) — canary pattern relies on shared labels and selective Service selectors
