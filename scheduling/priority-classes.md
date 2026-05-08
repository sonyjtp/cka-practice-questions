# 🏆 Priority Classes

> **CKA Exam Domain:** Scheduling  
> **Topic:** Priority Classes  
> **Total Questions:** 9

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

### Question 1 — Create a PriorityClass
> ⏱️ **Recommended Time: 4 minutes**

Create a `PriorityClass` named `high-priority` with a value of `1000000` and the description `"High priority workloads"`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "High priority workloads"
```

```bash
kubectl apply -f high-priority.yaml

# Verify the PriorityClass was created
kubectl get priorityclass high-priority
kubectl describe priorityclass high-priority
```

> **Key Concept:** A `PriorityClass` is a cluster-scoped (non-namespaced) resource. The `value` is an integer — higher values mean higher priority. The scheduler uses this value when deciding which pods to schedule or preempt.

</details>

---

### Question 2 — Assign a PriorityClass to a Pod
> ⏱️ **Recommended Time: 4 minutes**

A `PriorityClass` named `high-priority` already exists in the cluster. Create a pod named `critical-pod` using the `nginx:alpine` image in the `default` namespace that uses this priority class.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: critical-pod
  namespace: default
spec:
  priorityClassName: high-priority
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f critical-pod.yaml

# Verify the priority class is assigned
kubectl describe pod critical-pod | grep -i priority
```

Expected output:
```
Priority:             1000000
Priority Class Name:  high-priority
```

> **Key Concept:** Assign a `PriorityClass` to a pod using the `spec.priorityClassName` field. The scheduler uses the numeric `value` from the `PriorityClass` to rank the pod relative to others in the scheduling queue.

</details>

---

### Question 3 — Inspect Built-in System Priority Classes
> ⏱️ **Recommended Time: 4 minutes**

List all `PriorityClass` objects in the cluster, including the built-in system ones. What are the two built-in system priority classes and what are their values?

<details>
<summary>✅ Answer</summary>

```bash
# List all PriorityClasses
kubectl get priorityclass
```

Expected output includes:
```
NAME                      VALUE        GLOBAL-DEFAULT   AGE
system-cluster-critical   2000000000   false            Xd
system-node-critical      2000001000   false            Xd
```

```bash
# Describe a specific one
kubectl describe priorityclass system-cluster-critical
```

| PriorityClass | Value | Used by |
|---------------|-------|---------|
| `system-node-critical` | `2000001000` | `etcd`, `kubelet`-related pods that must not be evicted |
| `system-cluster-critical` | `2000000000` | `kube-apiserver`, `kube-dns`, `kube-proxy` |

> **Key Concept:** Kubernetes ships with two built-in `PriorityClass` objects for system-critical components. They have very high values to prevent them from being preempted by user workloads. Never assign these to your own application pods.

</details>

---

### Question 4 — Set a Default PriorityClass
> ⏱️ **Recommended Time: 5 minutes**

Create a `PriorityClass` named `default-priority` with a value of `1000` that is automatically applied to **all pods** that do not specify a `priorityClassName`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: default-priority
value: 1000
globalDefault: true
description: "Default priority for all pods that do not specify a priority class"
```

```bash
kubectl apply -f default-priority.yaml

# Verify it is the global default
kubectl get priorityclass
# The GLOBAL-DEFAULT column should show true for default-priority

# Create a pod without a priorityClassName and verify the default is applied
kubectl run test-pod --image=nginx:alpine
kubectl describe pod test-pod | grep -i priority
```

> **Key Concept:** Only **one** `PriorityClass` can have `globalDefault: true` at a time. If you try to create a second one with `globalDefault: true`, it will be rejected. Pods created before the default existed retain a priority of `0`.

</details>

---

## 🟡 Medium Questions

---

### Question 5 — Observe Preemption Behaviour
> ⏱️ **Recommended Time: 7 minutes**

The cluster is fully utilised — all nodes are at capacity with `low-priority` pods (priority value `100`). A new pod named `urgent-pod` using `nginx:alpine` is created with a `PriorityClass` of value `1000000`.

Explain what happens and how to verify preemption occurred.

<details>
<summary>✅ Answer</summary>

**What happens:**

1. `urgent-pod` enters the scheduling queue
2. The scheduler finds no nodes with sufficient free resources
3. The scheduler identifies `low-priority` pods that could be evicted to make room
4. One or more `low-priority` pods are **preempted** (evicted)
5. `urgent-pod` is scheduled on the freed node

```bash
# Set up the priority classes
kubectl apply -f - <<EOF
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: low-priority
value: 100
globalDefault: false
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
EOF

# Check if urgent-pod triggered preemption
kubectl describe pod urgent-pod | grep -A 5 Events

# Look for preempted pods (they will be in Terminating or gone)
kubectl get pods -o wide

# Check events for preemption messages
kubectl get events --sort-by='.lastTimestamp' | grep -i preempt
```

> **Key Concept:** Preemption allows high-priority pods to evict lower-priority pods when the cluster has insufficient resources. The scheduler attempts to preempt the **minimum number** of pods needed. Preempted pods are gracefully terminated (respecting `terminationGracePeriodSeconds`).

</details>

---

### Question 6 — Non-Preempting PriorityClass
> ⏱️ **Recommended Time: 7 minutes**

Create a `PriorityClass` named `batch-priority` with a value of `500000` that **does not preempt** other pods when resources are unavailable. Then create a pod named `batch-pod` using `busybox:1.28` that uses this class.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-priority
value: 500000
preemptionPolicy: Never
globalDefault: false
description: "High value batch jobs that wait rather than preempt"
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: batch-pod
  namespace: default
spec:
  priorityClassName: batch-priority
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f batch-priority.yaml
kubectl apply -f batch-pod.yaml

# Verify the preemptionPolicy
kubectl describe priorityclass batch-priority | grep -i preemption
kubectl describe pod batch-pod | grep -i priority
```

> **Key Concept:** `preemptionPolicy: Never` means the pod will **wait** in the scheduling queue rather than evict lower-priority pods to make room. It still has a high priority value — so it will be scheduled ahead of other pods once resources become naturally available — but it will never forcibly evict others.

</details>

---

### Question 7 — Diagnose Why a Pod Was Preempted
> ⏱️ **Recommended Time: 8 minutes**

A pod named `worker-pod` in the `default` namespace was running but has suddenly disappeared or restarted. You suspect it was preempted by a higher-priority pod.

Investigate and confirm whether preemption was the cause.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check if the pod still exists or has been deleted
kubectl get pod worker-pod
kubectl get pod worker-pod -o wide

# 2. Check pod events for preemption
kubectl describe pod worker-pod | grep -A 10 Events
# Look for: "Preempting" or "Preempted by"

# 3. Check cluster-wide events sorted by time
kubectl get events --sort-by='.lastTimestamp' | grep -i preempt

# 4. Find the pod that caused the preemption (recently created high-priority pod)
kubectl get pods -o custom-columns="NAME:.metadata.name,PRIORITY:.spec.priority,NODE:.spec.nodeName" --sort-by='.spec.priority'

# 5. Check the node where worker-pod was running for resource pressure
kubectl describe node <node-name> | grep -A 10 "Allocated resources"
```

Signs of preemption:
- The pod was `Terminating` or suddenly gone
- Events show `"Preempted"` or `"Preempting"`
- A higher-priority pod appeared on the same node shortly after

> **Key Concept:** Preempted pods are gracefully terminated. Check `kubectl get events` and `kubectl describe pod` for preemption-related messages. The node where the pod ran will also show a new high-priority pod that replaced it.

</details>

---

## 🔴 Hard Questions

---

### Question 8 — Multiple PriorityClasses in a Deployment
> ⏱️ **Recommended Time: 9 minutes**

Create three `PriorityClass` objects:

| Name | Value |
|------|-------|
| `critical` | `1000000` |
| `standard` | `500` |
| `low` | `100` |

Then create three Deployments (`critical-deploy`, `standard-deploy`, `low-deploy`) each with 2 replicas using `nginx:alpine`, each assigned to its respective `PriorityClass`. Verify the priority values are reflected on the pods.

<details>
<summary>✅ Answer</summary>

```yaml
# PriorityClasses
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: critical
value: 1000000
globalDefault: false
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: standard
value: 500
globalDefault: false
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: low
value: 100
globalDefault: false
```

```yaml
# critical-deploy
apiVersion: apps/v1
kind: Deployment
metadata:
  name: critical-deploy
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: critical-deploy
  template:
    metadata:
      labels:
        app: critical-deploy
    spec:
      priorityClassName: critical
      containers:
      - name: nginx
        image: nginx:alpine
```

Repeat the same pattern for `standard-deploy` (priorityClassName: `standard`) and `low-deploy` (priorityClassName: `low`).

```bash
kubectl apply -f priority-classes.yaml
kubectl apply -f critical-deploy.yaml
kubectl apply -f standard-deploy.yaml
kubectl apply -f low-deploy.yaml

# Verify priority values on all pods
kubectl get pods -o custom-columns="NAME:.metadata.name,PRIORITY:.spec.priority" --sort-by='.spec.priority'
```

> **Key Concept:** `priorityClassName` is set in the pod template (`spec.template.spec.priorityClassName`) of a Deployment. The numeric priority value is automatically populated on each pod from the `PriorityClass`. Higher-priority pods will always be scheduled before lower-priority ones when resources are constrained.

</details>

---

### Question 9 — PriorityClass and ResourceQuota Interaction
> ⏱️ **Recommended Time: 10 minutes**

A `ResourceQuota` named `scoped-quota` exists in the `team-b` namespace and restricts pods with `priorityClassName: low` to a maximum of **3 pods**. 

1. Create the `ResourceQuota` with this scope
2. Create a `PriorityClass` named `low` with value `100`
3. Attempt to create 4 pods with this priority class and observe the result

<details>
<summary>✅ Answer</summary>

```bash
kubectl create namespace team-b
```

```yaml
# PriorityClass
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: low
value: 100
globalDefault: false
```

```yaml
# ResourceQuota scoped to low priority pods
apiVersion: v1
kind: ResourceQuota
metadata:
  name: scoped-quota
  namespace: team-b
spec:
  hard:
    pods: "3"
  scopeSelector:
    matchExpressions:
    - operator: In
      scopeName: PriorityClass
      values:
      - low
```

```bash
kubectl apply -f low-pc.yaml
kubectl apply -f scoped-quota.yaml

# Create 4 low-priority pods
for i in 1 2 3 4; do
  kubectl run low-pod-$i --image=nginx:alpine -n team-b \
    --overrides='{"spec":{"priorityClassName":"low"}}'
done

# The 4th pod will be rejected:
# Error: pods "low-pod-4" is forbidden: exceeded quota: scoped-quota,
# requested: pods=1, limited: pods=3

# Check quota usage
kubectl describe resourcequota scoped-quota -n team-b
```

> **Key Concept:** `ResourceQuota` supports `scopeSelector` with `scopeName: PriorityClass` to apply limits **only** to pods of a specific priority class. This lets you cap the number of low-priority pods in a namespace while allowing unlimited high-priority pods — a powerful pattern for batch vs. production workload separation.

</details>

---

## 📌 Quick Reference

| Field | Description |
|-------|-------------|
| `value` | Integer priority — higher = more important (max ~2 billion) |
| `globalDefault: true` | Applied to all pods without a `priorityClassName` (only one allowed) |
| `preemptionPolicy: Never` | Pod waits in queue; does not evict lower-priority pods |
| `preemptionPolicy: PreemptLowerPriority` | Default — pod evicts lower-priority pods to free resources |
| `spec.priorityClassName` | Field on a Pod/Deployment template to assign a `PriorityClass` |

### Built-in System Priority Classes

| Name | Value | Purpose |
|------|-------|---------|
| `system-node-critical` | `2000001000` | Node-level critical components (e.g., `etcd`) |
| `system-cluster-critical` | `2000000000` | Cluster-level critical components (e.g., `kube-dns`) |

### Useful Commands

```bash
# List all PriorityClasses
kubectl get priorityclass

# Describe a PriorityClass
kubectl describe priorityclass <name>

# Check priority on a pod
kubectl describe pod <pod-name> | grep -i priority

# List pods sorted by priority
kubectl get pods -o custom-columns="NAME:.metadata.name,PRIORITY:.spec.priority" --sort-by='.spec.priority'

# Check for preemption events
kubectl get events --sort-by='.lastTimestamp' | grep -i preempt
```

### Priority Value Guidelines

```
2000001000  →  system-node-critical    (built-in, do not use)
2000000000  →  system-cluster-critical (built-in, do not use)
1000000     →  Suggested max for user workloads (critical)
500–100000  →  Standard application range
0           →  Default when no PriorityClass is assigned
```

### Related Topics

- 🔗 [Resource Requests, Limits and Quotas](./resource-requests-limits-quotas.md) — `ResourceQuota` with `scopeSelector` for PriorityClass-scoped limits
- 🔗 [DaemonSets](./daemonsets.md) — system DaemonSets use `system-node-critical` priority
