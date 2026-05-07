# 🎯 Node Affinity

> **CKA Exam Domain:** Scheduling  
> **Topic:** Node Affinity  
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

### Question 1 — Label a Node and Schedule a Pod with `nodeSelector`
> ⏱️ **Recommended Time: 4 minutes**

A node named `node01` exists in the cluster.

1. Add the label `disktype=ssd` to it
2. Create a pod named `ssd-pod` using the `nginx:alpine` image that is only scheduled on nodes with that label using `nodeSelector`

<details>
<summary>✅ Answer</summary>

```bash
# Label the node
kubectl label node node01 disktype=ssd

# Verify the label
kubectl get node node01 --show-labels
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod
  namespace: default
spec:
  nodeSelector:
    disktype: ssd
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f ssd-pod.yaml

# Verify it lands on node01
kubectl get pod ssd-pod -o wide
```

> **Key Concept:** `nodeSelector` is the simplest form of node constraint. It schedules a pod only on nodes whose labels match the specified key/value pairs. It is the predecessor to Node Affinity.

</details>

---

### Question 2 — Required Node Affinity (`requiredDuringSchedulingIgnoredDuringExecution`)
> ⏱️ **Recommended Time: 5 minutes**

`node02` has the label `environment=production`. Create a pod named `prod-pod` using the `busybox:1.28` image that **must** be scheduled on a node with that label using a `requiredDuringSchedulingIgnoredDuringExecution` node affinity rule.

<details>
<summary>✅ Answer</summary>

```bash
# Label the node if not already done
kubectl label node node02 environment=production
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: prod-pod
  namespace: default
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: environment
            operator: In
            values:
            - production
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f prod-pod.yaml

# Verify it lands on node02
kubectl get pod prod-pod -o wide
kubectl describe pod prod-pod | grep -A 10 Affinity
```

> **Key Concept:** `requiredDuringSchedulingIgnoredDuringExecution` is a **hard** rule — the pod will not be scheduled if no matching node exists. The `IgnoredDuringExecution` part means if the node label changes after the pod is running, the pod is not evicted.

</details>

---

### Question 3 — Preferred Node Affinity (`preferredDuringSchedulingIgnoredDuringExecution`)
> ⏱️ **Recommended Time: 6 minutes**

Create a pod named `preferred-pod` using the `nginx:alpine` image. The pod should **prefer** to be scheduled on a node labelled `zone=us-east-1a`, but must still schedule even if no such node exists. Use a weight of `50`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: preferred-pod
  namespace: default
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 50
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values:
            - us-east-1a
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f preferred-pod.yaml

# Verify the pod is scheduled (it will land somewhere even without a matching node)
kubectl get pod preferred-pod -o wide
kubectl describe pod preferred-pod | grep -A 10 Affinity
```

> **Key Concept:** `preferredDuringSchedulingIgnoredDuringExecution` is a **soft** rule. The scheduler tries to place the pod on a matching node, but falls back to any available node if no match is found. The `weight` (1–100) influences the preference priority.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Node Affinity with Multiple Operators
> ⏱️ **Recommended Time: 7 minutes**

The cluster has nodes with varying labels. Create a pod named `multi-affinity-pod` using the `nginx:alpine` image that must be scheduled on a node that:

- Has label `tier` with value **either** `frontend` **or** `backend`
- Has label `region` that **exists** (any value is acceptable)

<details>
<summary>✅ Answer</summary>

```bash
# Label a node to satisfy both conditions (replace node01 with actual node)
kubectl label node node01 tier=frontend
kubectl label node node01 region=eu-west-1
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-affinity-pod
  namespace: default
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: tier
            operator: In
            values:
            - frontend
            - backend
          - key: region
            operator: Exists
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f multi-affinity-pod.yaml

# Verify scheduling
kubectl get pod multi-affinity-pod -o wide
```

> **Key Concept:** Multiple `matchExpressions` entries within the same `nodeSelectorTerms` item are combined with **AND** logic — all conditions must be satisfied. The `In` operator checks against a list of values; `Exists` only checks that the key is present, regardless of value.

</details>

---

### Question 5 — Node Affinity with `NotIn` and `DoesNotExist`
> ⏱️ **Recommended Time: 7 minutes**

Create a pod named `excluded-pod` using the `busybox:1.28` image that must **avoid** nodes where:

- Label `environment` is `development` or `testing`
- Label `maintenance` exists (regardless of value)

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: excluded-pod
  namespace: default
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: environment
            operator: NotIn
            values:
            - development
            - testing
          - key: maintenance
            operator: DoesNotExist
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f excluded-pod.yaml

# Verify the pod is scheduled on a non-development, non-maintenance node
kubectl get pod excluded-pod -o wide
kubectl describe pod excluded-pod | grep -A 12 Affinity
```

> **Key Concept:** `NotIn` excludes nodes whose label value matches any item in the list. `DoesNotExist` excludes nodes that have the specified key at all. These are useful for keeping workloads away from degraded or non-production nodes.

</details>

---

### Question 6 — Multiple `nodeSelectorTerms` (OR Logic)
> ⏱️ **Recommended Time: 8 minutes**

Create a pod named `or-affinity-pod` using the `nginx:alpine` image that can be scheduled on a node that meets **either** of the following conditions:

- Has label `gpu=true`
- Has label `high-memory=true`

<details>
<summary>✅ Answer</summary>

```bash
# Label nodes to test (replace node names as appropriate)
kubectl label node node01 gpu=true
kubectl label node node02 high-memory=true
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: or-affinity-pod
  namespace: default
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: gpu
            operator: In
            values:
            - "true"
        - matchExpressions:
          - key: high-memory
            operator: In
            values:
            - "true"
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f or-affinity-pod.yaml

# Verify the pod is scheduled on either node
kubectl get pod or-affinity-pod -o wide
```

> **Key Concept:** Multiple entries in `nodeSelectorTerms` are combined with **OR** logic — a node only needs to satisfy **one** of the term sets. This is distinct from multiple `matchExpressions` within a single term, which are ANDed together.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Combined Required and Preferred Affinity Rules
> ⏱️ **Recommended Time: 9 minutes**

Create a Deployment named `tiered-deploy` in the `default` namespace using the `nginx:alpine` image with 3 replicas that:

1. **Must** be scheduled on nodes labelled `tier=backend` (required rule)
2. **Prefers** nodes additionally labelled `zone=us-east-1a` with a weight of `80`, and `zone=us-east-1b` with a weight of `20`

<details>
<summary>✅ Answer</summary>

```bash
# Label nodes (replace node names as appropriate)
kubectl label node node01 tier=backend zone=us-east-1a
kubectl label node node02 tier=backend zone=us-east-1b
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiered-deploy
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tiered-deploy
  template:
    metadata:
      labels:
        app: tiered-deploy
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: tier
                operator: In
                values:
                - backend
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 80
            preference:
              matchExpressions:
              - key: zone
                operator: In
                values:
                - us-east-1a
          - weight: 20
            preference:
              matchExpressions:
              - key: zone
                operator: In
                values:
                - us-east-1b
      containers:
      - name: nginx
        image: nginx:alpine
```

```bash
kubectl apply -f tiered-deploy.yaml

# Verify replicas land on backend-labelled nodes, preferring us-east-1a
kubectl get pods -l app=tiered-deploy -o wide
```

> **Key Concept:** `required` and `preferred` rules can be combined in a single `nodeAffinity` block. The required rule acts as a hard filter while the preferred rules rank the remaining eligible nodes by weight. Higher weight = stronger preference.

</details>

---

### Question 8 — Node Affinity + Taints and Tolerations Together
> ⏱️ **Recommended Time: 10 minutes**

You have two nodes:
- `node-gpu` — tainted with `hardware=gpu:NoSchedule` and labelled `hardware=gpu`
- `node-cpu` — no taints, labelled `hardware=cpu`

Create a Deployment named `gpu-affinity-deploy` in the `default` namespace using the `nginx:alpine` image with 2 replicas that:

1. **Tolerates** the `hardware=gpu:NoSchedule` taint
2. **Must** schedule only on `node-gpu` using a `requiredDuringSchedulingIgnoredDuringExecution` node affinity rule matching `hardware=gpu`

Then explain why using **only** a toleration — without the affinity rule — would be insufficient.

<details>
<summary>✅ Answer</summary>

```bash
# Setup (if not already done)
kubectl taint node node-gpu hardware=gpu:NoSchedule
kubectl label node node-gpu hardware=gpu
kubectl label node node-cpu hardware=cpu
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-affinity-deploy
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gpu-affinity-deploy
  template:
    metadata:
      labels:
        app: gpu-affinity-deploy
    spec:
      tolerations:
      - key: "hardware"
        operator: "Equal"
        value: "gpu"
        effect: "NoSchedule"
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: hardware
                operator: In
                values:
                - gpu
      containers:
      - name: nginx
        image: nginx:alpine
```

```bash
kubectl apply -f gpu-affinity-deploy.yaml

# Verify both replicas land on node-gpu
kubectl get pods -l app=gpu-affinity-deploy -o wide
```

**Why a toleration alone is insufficient:**

A toleration only **allows** a pod to be scheduled on a tainted node — it does not **force** it there. Without the node affinity rule, the scheduler is free to place the pods on `node-cpu` (which has no taint), meaning GPU workloads could end up on non-GPU hardware. The affinity rule **attracts** the pods to `node-gpu` and guarantees placement.

> **Key Concept:** Taints/tolerations and node affinity are complementary mechanisms. Use taints to **repel** unwanted pods from a node and node affinity to **attract** the right pods to it. Together they implement a reliable dedicated-node pattern.

</details>

---

## 📌 Quick Reference

| Rule Type | Behaviour |
|-----------|-----------|
| `requiredDuringSchedulingIgnoredDuringExecution` | **Hard** rule — pod will not schedule if no node matches |
| `preferredDuringSchedulingIgnoredDuringExecution` | **Soft** rule — scheduler prefers matching nodes, falls back if none exist |
| `nodeSelectorTerms` (multiple entries) | Combined with **OR** — node must satisfy at least one term |
| `matchExpressions` (multiple entries in one term) | Combined with **AND** — node must satisfy all expressions |

### Operators

| Operator | Behaviour |
|----------|-----------|
| `In` | Label value must match one of the listed values |
| `NotIn` | Label value must not match any of the listed values |
| `Exists` | Label key must be present (any value) |
| `DoesNotExist` | Label key must not be present |
| `Gt` | Label value must be greater than the specified value (numeric strings) |
| `Lt` | Label value must be less than the specified value (numeric strings) |

### Useful Commands

```bash
# Label a node
kubectl label node <node-name> key=value

# Remove a node label
kubectl label node <node-name> key-

# View all node labels
kubectl get nodes --show-labels

# View a specific node's labels
kubectl describe node <node-name> | grep -A 10 Labels

# Check pod affinity rules
kubectl describe pod <pod-name> | grep -A 20 Affinity

# Find nodes matching a label selector
kubectl get nodes -l hardware=gpu
```

### `nodeSelector` vs Node Affinity — Cheat Sheet

```
nodeSelector          →  Simple key=value match, no operators, hard rule only
nodeAffinity required →  Hard rule with full operator support (In, NotIn, Exists, …)
nodeAffinity preferred →  Soft rule with weights — pod still schedules if no match
```

### Related Topics

- 🔗 [Taints and Tolerations](./taints-and-tolerations.md) — complementary scheduling mechanism; see **Question 8** for a combined example
