# 📦 Resource Requests, Limits and Quotas

> **CKA Exam Domain:** Scheduling  
> **Topic:** Resource Requests, Limits and Quotas  
> **Total Questions:** 8

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

### Question 1 — Setting Resource Requests and Limits on a Pod
> ⏱️ **Recommended Time: 4 minutes**

Create a pod named `resource-pod` using the `nginx:alpine` image in the `default` namespace with the following resource constraints:

- **CPU request:** `250m`
- **Memory request:** `64Mi`
- **CPU limit:** `500m`
- **Memory limit:** `128Mi`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-pod
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    resources:
      requests:
        cpu: "250m"
        memory: "64Mi"
      limits:
        cpu: "500m"
        memory: "128Mi"
```

```bash
kubectl apply -f resource-pod.yaml

# Verify resource constraints
kubectl describe pod resource-pod | grep -A 8 Limits
```

> **Key Concept:** `requests` are what the scheduler uses to find a suitable node — the node must have at least this much available. `limits` are the maximum the container is allowed to consume. If a container exceeds its memory limit it is OOMKilled; if it exceeds its CPU limit it is throttled.

</details>

---

### Question 2 — Identifying the QoS Class of a Pod
> ⏱️ **Recommended Time: 5 minutes**

Three pods exist in the `default` namespace:

| Pod | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----|-------------|-----------|----------------|--------------|
| `pod-a` | `500m` | `500m` | `128Mi` | `128Mi` |
| `pod-b` | `250m` | `500m` | `64Mi` | `128Mi` |
| `pod-c` | *(none)* | *(none)* | *(none)* | *(none)* |

Without creating any pods, identify the QoS class that would be assigned to each pod and explain why.

<details>
<summary>✅ Answer</summary>

| Pod | QoS Class | Reason |
|-----|-----------|--------|
| `pod-a` | **Guaranteed** | Requests == Limits for all resources |
| `pod-b` | **Burstable** | Requests < Limits (or only some resources have requests/limits) |
| `pod-c` | **BestEffort** | No requests or limits defined at all |

```bash
# To verify on a running pod:
kubectl describe pod <pod-name> | grep "QoS Class"
```

**QoS Class Priority during eviction:** BestEffort → Burstable → Guaranteed  
Pods with lower priority are evicted first when a node is under memory pressure.

> **Key Concept:** Kubernetes assigns a QoS class automatically based on how requests and limits are configured. **Guaranteed** pods are the safest from eviction. **BestEffort** pods are evicted first. **Burstable** pods fall in between.

</details>

---

### Question 3 — Creating a LimitRange
> ⏱️ **Recommended Time: 6 minutes**

Create a `LimitRange` named `default-limits` in the `dev` namespace that sets the following **default** requests and limits for every container that does not specify its own:

- **Default CPU request:** `100m`
- **Default CPU limit:** `200m`
- **Default memory request:** `64Mi`
- **Default memory limit:** `128Mi`

<details>
<summary>✅ Answer</summary>

```bash
# Create the namespace if it doesn't exist
kubectl create namespace dev
```

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: dev
spec:
  limits:
  - type: Container
    default:
      cpu: "200m"
      memory: "128Mi"
    defaultRequest:
      cpu: "100m"
      memory: "64Mi"
```

```bash
kubectl apply -f default-limits.yaml

# Verify the LimitRange
kubectl describe limitrange default-limits -n dev
```

> **Key Concept:** A `LimitRange` applies default resource requests and limits to containers in a namespace that do not specify their own. This prevents unbounded resource consumption by pods that omit resource fields entirely.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Enforcing Min/Max with LimitRange
> ⏱️ **Recommended Time: 7 minutes**

Create a `LimitRange` named `bounded-limits` in the `staging` namespace that enforces the following constraints on every container:

- **Min CPU:** `50m` | **Max CPU:** `1`
- **Min memory:** `32Mi` | **Max memory:** `512Mi`

Then attempt to create a pod that exceeds the max CPU limit and observe the result.

<details>
<summary>✅ Answer</summary>

```bash
kubectl create namespace staging
```

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: bounded-limits
  namespace: staging
spec:
  limits:
  - type: Container
    min:
      cpu: "50m"
      memory: "32Mi"
    max:
      cpu: "1"
      memory: "512Mi"
```

```bash
kubectl apply -f bounded-limits.yaml
```

Now try to create a pod that exceeds the max CPU:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: over-limit-pod
  namespace: staging
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    resources:
      limits:
        cpu: "2"        # exceeds max of 1
        memory: "128Mi"
```

```bash
kubectl apply -f over-limit-pod.yaml
# Expected error:
# Error: pods "over-limit-pod" is forbidden: maximum cpu usage per Container is 1, but limit is 2.

# Verify the LimitRange is in effect
kubectl describe limitrange bounded-limits -n staging
```

> **Key Concept:** A `LimitRange` with `min` and `max` values acts as a hard guardrail. Any pod or container that violates these bounds is rejected at admission time with a clear error message.

</details>

---

### Question 5 — Creating a ResourceQuota
> ⏱️ **Recommended Time: 7 minutes**

Create a `ResourceQuota` named `team-quota` in the `team-a` namespace that enforces the following limits:

- Max **10 pods**
- Max total CPU requests: **4**
- Max total CPU limits: **8**
- Max total memory requests: **4Gi**
- Max total memory limits: **8Gi**

Then verify the quota is applied and check how much has been consumed.

<details>
<summary>✅ Answer</summary>

```bash
kubectl create namespace team-a
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    limits.cpu: "8"
    requests.memory: "4Gi"
    limits.memory: "8Gi"
```

```bash
kubectl apply -f team-quota.yaml

# View quota usage
kubectl describe resourcequota team-quota -n team-a
```

Expected output shows `Used` vs `Hard` for each resource:
```
Name:            team-quota
Namespace:       team-a
Resource         Used  Hard
--------         ----  ----
limits.cpu       0     8
limits.memory    0     8Gi
pods             0     10
requests.cpu     0     4
requests.memory  0     4Gi
```

> **Key Concept:** A `ResourceQuota` caps the total resource consumption across **all pods** in a namespace. Once the quota is in place, every new pod **must** specify resource requests and limits — otherwise it will be rejected.

</details>

---

### Question 6 — Diagnosing an OOMKilled Pod
> ⏱️ **Recommended Time: 8 minutes**

A pod named `memory-hog` in the `default` namespace keeps restarting. You suspect it is exceeding its memory limit.

1. Confirm the pod is OOMKilled
2. Identify the current memory limit
3. Fix the pod by increasing the memory limit to `256Mi`

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check the pod status and restart count
kubectl get pod memory-hog

# Look for OOMKilled in the last state
kubectl describe pod memory-hog | grep -A 10 "Last State"

# You will see something like:
#   Last State: Terminated
#     Reason:   OOMKilled
#     Exit Code: 137

# 2. Identify the current memory limit
kubectl describe pod memory-hog | grep -A 5 Limits

# 3. Export and edit the pod manifest
kubectl get pod memory-hog -o yaml > memory-hog.yaml
```

Edit `memory-hog.yaml` to increase the memory limit:

```yaml
resources:
  limits:
    memory: "256Mi"   # increased from previous value
```

```bash
kubectl delete pod memory-hog
kubectl apply -f memory-hog.yaml

# Verify it stays Running
kubectl get pod memory-hog
```

> **Key Concept:** Exit code `137` (128 + 9) indicates the process was killed by signal 9 (SIGKILL) due to OOM. Use `kubectl describe pod` and check `Last State.Reason` to confirm. Increasing the memory limit or optimising the application are the two remedies.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — ResourceQuota Blocking a Deployment
> ⏱️ **Recommended Time: 9 minutes**

A `ResourceQuota` named `ns-quota` is active in the `production` namespace with a hard limit of `requests.cpu: 2`. A Deployment named `api-deploy` using the `nginx:alpine` image with 4 replicas is stuck — its pods are not being created.

1. Diagnose why the pods are not scheduling
2. Fix the Deployment so all 4 replicas can run within the existing quota

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check the ReplicaSet events for quota errors
kubectl describe replicaset -n production | grep -A 10 Events

# You will see something like:
# Error creating: pods "api-deploy-xxx" is forbidden:
# exceeded quota: ns-quota, requested: requests.cpu=500m,
# limited: requests.cpu=2

# Check current quota usage
kubectl describe resourcequota ns-quota -n production
```

The quota allows `2` total CPU requests. With 4 replicas each requesting `500m`, the total would be `2000m = 2` — exactly at the limit. If some is already consumed, new pods will be rejected.

```bash
# Check existing resource consumption in the namespace
kubectl get pods -n production -o custom-columns="NAME:.metadata.name,CPU-REQ:.spec.containers[*].resources.requests.cpu"
```

Fix the Deployment by reducing the CPU request per replica so all 4 fit within the quota:

```yaml
resources:
  requests:
    cpu: "400m"     # 4 x 400m = 1600m < 2000m quota
    memory: "64Mi"
  limits:
    cpu: "500m"
    memory: "128Mi"
```

```bash
kubectl set resources deployment api-deploy -n production \
  --requests=cpu=400m,memory=64Mi \
  --limits=cpu=500m,memory=128Mi

# Verify all 4 replicas come up
kubectl get pods -n production
kubectl describe resourcequota ns-quota -n production
```

> **Key Concept:** When a `ResourceQuota` is active, **every** pod must declare resource requests and limits. Quota enforcement happens at pod creation time — the ReplicaSet controller will log quota-exceeded errors in its Events. Always check both `kubectl describe replicaset` events and `kubectl describe resourcequota` to diagnose.

</details>

---

### Question 8 — LimitRange + ResourceQuota Together
> ⏱️ **Recommended Time: 10 minutes**

Set up the `finance` namespace with both a `LimitRange` and a `ResourceQuota`:

**LimitRange** (`finance-limits`):
- Default CPU request: `100m` / limit: `300m`
- Default memory request: `64Mi` / limit: `256Mi`

**ResourceQuota** (`finance-quota`):
- Max pods: `5`
- Max total CPU requests: `500m`
- Max total memory requests: `320Mi`

Then create a pod named `finance-pod` using `nginx:alpine` **without** specifying any resources and verify:
1. The LimitRange defaults were applied to the pod
2. The ResourceQuota usage was updated

<details>
<summary>✅ Answer</summary>

```bash
kubectl create namespace finance
```

```yaml
# finance-limits LimitRange
apiVersion: v1
kind: LimitRange
metadata:
  name: finance-limits
  namespace: finance
spec:
  limits:
  - type: Container
    default:
      cpu: "300m"
      memory: "256Mi"
    defaultRequest:
      cpu: "100m"
      memory: "64Mi"
```

```yaml
# finance-quota ResourceQuota
apiVersion: v1
kind: ResourceQuota
metadata:
  name: finance-quota
  namespace: finance
spec:
  hard:
    pods: "5"
    requests.cpu: "500m"
    requests.memory: "320Mi"
```

```bash
kubectl apply -f finance-limits.yaml
kubectl apply -f finance-quota.yaml

# Create the pod with no resource fields
kubectl run finance-pod --image=nginx:alpine -n finance

# 1. Verify LimitRange defaults were injected
kubectl describe pod finance-pod -n finance | grep -A 8 Limits

# 2. Verify quota consumption was updated
kubectl describe resourcequota finance-quota -n finance
```

Expected quota output after pod creation:
```
Resource          Used   Hard
--------          ----   ----
pods              1      5
requests.cpu      100m   500m
requests.memory   64Mi   320Mi
```

> **Key Concept:** `LimitRange` and `ResourceQuota` work together — the LimitRange injects default requests/limits so pods without explicit resources still satisfy the quota's requirement that all pods declare requests. Without a LimitRange, pods with no resource fields would be **rejected** by the quota.

</details>

---

## 📌 Quick Reference

| Object | Scope | Purpose |
|--------|-------|---------|
| `resources.requests` | Container | Minimum resources guaranteed; used by scheduler for node selection |
| `resources.limits` | Container | Maximum resources allowed; enforced at runtime |
| `LimitRange` | Namespace | Sets default, min, and max resource constraints per container/pod/PVC |
| `ResourceQuota` | Namespace | Caps total resource consumption and object counts across the namespace |

### QoS Classes

| Class | Condition | Eviction Priority |
|-------|-----------|-------------------|
| **Guaranteed** | Requests == Limits for all containers and all resources | Last to be evicted |
| **Burstable** | At least one container has a request or limit set | Middle priority |
| **BestEffort** | No requests or limits set on any container | First to be evicted |

### Useful Commands

```bash
# View resource requests and limits on all pods
kubectl get pods -o custom-columns="NAME:.metadata.name,CPU-REQ:.spec.containers[*].resources.requests.cpu,MEM-REQ:.spec.containers[*].resources.requests.memory"

# Check QoS class of a pod
kubectl describe pod <pod-name> | grep "QoS Class"

# Check for OOMKilled
kubectl describe pod <pod-name> | grep -A 5 "Last State"

# View LimitRange details
kubectl describe limitrange <name> -n <namespace>

# View ResourceQuota usage
kubectl describe resourcequota <name> -n <namespace>

# Set resource requests/limits on a running deployment
kubectl set resources deployment <name> --requests=cpu=100m,memory=64Mi --limits=cpu=200m,memory=128Mi
```

### Common Exit Codes

```
Exit Code 137  →  OOMKilled (memory limit exceeded — killed by SIGKILL)
Exit Code 1    →  Application error (check logs)
Exit Code 0    →  Clean exit
```
