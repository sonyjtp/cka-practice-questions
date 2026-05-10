# 🚫 Taints and Tolerations

> **CKA Exam Domain:** Scheduling  
> **Topic:** Taints and Tolerations  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Tainting a Node
> ⏱️ **Recommended Time: 4 minutes**

A node named `node01` exists in the cluster. Add a taint to it with the following properties:
- **Key:** `dedicated`
- **Value:** `gpu`
- **Effect:** `NoSchedule`

Then verify the taint has been applied.

<details>
<summary>✅ Answer</summary>

```bash
# Add the taint to node01
kubectl taint node node01 dedicated=gpu:NoSchedule

# Verify the taint
kubectl describe node node01 | grep -i taint
```

Expected output:
```
Taints: dedicated=gpu:NoSchedule
```

> **Key Concept:** A taint is applied to a node and prevents pods from being scheduled on it unless the pod has a matching toleration. The format is `key=value:Effect`.

</details>

---

### Question 2 — Removing a Taint from a Node
> ⏱️ **Recommended Time: 4 minutes**

`node02` currently has the following taint applied:
- `env=test:NoExecute`

Remove this taint from the node and verify it has been removed.

<details>
<summary>✅ Answer</summary>

```bash
# Remove the taint (append - to the taint specification)
kubectl taint node node02 env=test:NoExecute-

# Verify the taint is removed
kubectl describe node node02 | grep -i taint
```

Expected output:
```
Taints: <none>
```

> **Key Concept:** To remove a taint, use the same `kubectl taint` command with a trailing `-` after the taint specification. The format is `key=value:Effect-`.

</details>

---

### Question 3 — Adding a Toleration to a Pod
> ⏱️ **Recommended Time: 6 minutes**

`node01` has the taint `dedicated=gpu:NoSchedule`. Create a pod named `gpu-pod` using the `nvidia/cuda:11.0-base` image that can be scheduled on this node by adding the appropriate toleration.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
  namespace: default
spec:
  tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
  containers:
  - name: cuda
    image: nvidia/cuda:11.0-base
```

```bash
kubectl apply -f gpu-pod.yaml

# Verify the pod is scheduled (it may be Pending if no GPU resources exist, but the taint should not block it)
kubectl get pod gpu-pod -o wide
kubectl describe pod gpu-pod | grep -A 5 Tolerations
```

> **Key Concept:** A toleration allows (but does not require) a pod to be scheduled on a node with a matching taint. The `operator: Equal` means the key and value must both match.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Taint Effect: NoExecute
> ⏱️ **Recommended Time: 7 minutes**

`node03` is being decommissioned. Apply a taint with effect `NoExecute` to it:
- **Key:** `lifecycle`
- **Value:** `decommissioning`
- **Effect:** `NoExecute`

Then create a pod named `tolerant-pod` using the `busybox:1.28` image with a toleration that allows it to **remain on the node for 60 seconds** after the taint is applied before being evicted.

<details>
<summary>✅ Answer</summary>

```bash
# Taint the node
kubectl taint node node03 lifecycle=decommissioning:NoExecute
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: tolerant-pod
  namespace: default
spec:
  tolerations:
  - key: "lifecycle"
    operator: "Equal"
    value: "decommissioning"
    effect: "NoExecute"
    tolerationSeconds: 60
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f tolerant-pod.yaml

# Verify toleration
kubectl describe pod tolerant-pod | grep -A 8 Tolerations
```

> **Key Concept:** `NoExecute` evicts already-running pods that do not tolerate the taint. The `tolerationSeconds` field defines how long a pod with the toleration can remain on the node before being evicted.

</details>

---

### Question 5 — Toleration with Operator: Exists
> ⏱️ **Recommended Time: 6 minutes**

Create a pod named `wildcard-pod` using the `nginx:alpine` image. The pod should tolerate **any taint** with the key `team` regardless of its value or effect.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: wildcard-pod
  namespace: default
spec:
  tolerations:
  - key: "team"
    operator: "Exists"
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f wildcard-pod.yaml

# Verify toleration
kubectl describe pod wildcard-pod | grep -A 5 Tolerations
```

> **Key Concept:** When `operator` is set to `Exists`, the `value` field must be omitted. The pod will tolerate all taints with the matching key regardless of value or effect. To tolerate **all taints** on any node, omit both `key` and `value` and set `operator: Exists`.

</details>

---

### Question 6 — Checking Why a Pod is Not Scheduling
> ⏱️ **Recommended Time: 8 minutes**

A pod named `stuck-pod` was created in the `default` namespace but remains in `Pending` state. You suspect a taint is preventing it from being scheduled.

1. Identify which node(s) have taints applied
2. Determine the taint preventing `stuck-pod` from scheduling
3. Fix the pod by adding the correct toleration (do **not** remove the taint from the node)

<details>
<summary>✅ Answer</summary>

```bash
# 1. List all nodes and their taints
kubectl describe nodes | grep -E "Name:|Taints:"

# Or use a custom output column
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints

# 2. Check the pod events for scheduling errors
kubectl describe pod stuck-pod | grep -A 10 Events

# You may see something like:
# Warning  FailedScheduling  0/2 nodes are available: 1 node(s) had untolerated taint {key: value}.

# 3. Edit the pod to add the correct toleration
# (Pods cannot be patched in-place for spec changes — export, edit, recreate)
kubectl get pod stuck-pod -o yaml > stuck-pod.yaml
```

Edit `stuck-pod.yaml` to add the toleration matching the identified taint, for example:

```yaml
spec:
  tolerations:
  - key: "key"           # replace with actual taint key
    operator: "Equal"
    value: "value"       # replace with actual taint value
    effect: "NoSchedule" # replace with actual taint effect
```

```bash
kubectl delete pod stuck-pod
kubectl apply -f stuck-pod.yaml

# Verify the pod is now scheduled
kubectl get pod stuck-pod -o wide
```

> **Key Concept:** Use `kubectl describe pod` Events and `kubectl describe node` Taints together to diagnose scheduling failures caused by taints. The control-plane node also has a taint (`node-role.kubernetes.io/control-plane:NoSchedule`) which prevents regular pods from landing on it.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Taints, Tolerations and Node Affinity Together
> ⏱️ **Recommended Time: 10 minutes**

You have two worker nodes:
- `node-gpu` — tainted with `hardware=gpu:NoSchedule` and labelled `hardware=gpu`
- `node-cpu` — no taints, labelled `hardware=cpu`

Create a Deployment named `gpu-workload` in the `default` namespace using the `nginx:alpine` image with 2 replicas that must:

1. **Tolerate** the `hardware=gpu:NoSchedule` taint
2. **Only** schedule on `node-gpu` using a `requiredDuringSchedulingIgnoredDuringExecution` node affinity rule

> 💡 **See also:** [Node Affinity](./node-affinity.md) for deeper coverage of affinity rules and operators.

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
  name: gpu-workload
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: gpu-workload
  template:
    metadata:
      labels:
        app: gpu-workload
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
kubectl apply -f gpu-workload.yaml

# Verify both replicas land on node-gpu
kubectl get pods -l app=gpu-workload -o wide
```

> **Key Concept:** Taints/tolerations and node affinity are complementary. Tolerations allow a pod to **land on** a tainted node but don't force it there. Node affinity **attracts** pods to specific nodes. Used together they implement a reliable dedicated-node pattern.

</details>

---

### Question 8 — Dedicated Node Pattern with NoSchedule and NoExecute
> ⏱️ **Recommended Time: 10 minutes**

You need to set up a **dedicated node** pattern for a critical monitoring stack:

1. Taint `node-monitor` with **both** of the following taints:
   - `dedicated=monitoring:NoSchedule`
   - `dedicated=monitoring:NoExecute`

2. Create a pod named `prometheus` using the `prom/prometheus:latest` image in the `monitoring` namespace that:
   - Tolerates both taints
   - Is guaranteed to be scheduled on `node-monitor` using `nodeSelector`

3. Confirm that a plain `nginx` pod (no tolerations) **cannot** schedule on `node-monitor`

<details>
<summary>✅ Answer</summary>

```bash
# 1. Apply both taints
kubectl taint node node-monitor dedicated=monitoring:NoSchedule
kubectl taint node node-monitor dedicated=monitoring:NoExecute

# Verify both taints
kubectl describe node node-monitor | grep -i taint
```

```bash
# Create the monitoring namespace if it doesn't exist
kubectl create namespace monitoring
```

```yaml
# prometheus pod with both tolerations + nodeSelector
apiVersion: v1
kind: Pod
metadata:
  name: prometheus
  namespace: monitoring
spec:
  nodeSelector:
    kubernetes.io/hostname: node-monitor
  tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "monitoring"
    effect: "NoSchedule"
  - key: "dedicated"
    operator: "Equal"
    value: "monitoring"
    effect: "NoExecute"
  containers:
  - name: prometheus
    image: prom/prometheus:latest
    ports:
    - containerPort: 9090
```

```bash
kubectl apply -f prometheus.yaml

# Verify prometheus schedules on node-monitor
kubectl get pod prometheus -n monitoring -o wide

# 3. Confirm a plain pod cannot schedule on node-monitor
kubectl run test-nginx --image=nginx:alpine --overrides='{
  "spec": { "nodeSelector": { "kubernetes.io/hostname": "node-monitor" } }
}'

# This pod should remain Pending — check why:
kubectl describe pod test-nginx | grep -A 5 Events

# Clean up test pod
kubectl delete pod test-nginx
```

> **Key Concept:** To fully isolate a node, apply **both** `NoSchedule` (prevents new pods from landing) and `NoExecute` (evicts existing pods without tolerations). This is the standard "dedicated node" pattern used for system-critical workloads.

</details>

---

## 📌 Quick Reference

| Concept | Description |
|---------|-------------|
| `NoSchedule` | New pods without a matching toleration will not be scheduled on the node. Existing pods are not affected. |
| `PreferNoSchedule` | The scheduler tries to avoid placing pods without a toleration, but it is not guaranteed. |
| `NoExecute` | New pods without a toleration are not scheduled, **and** existing pods without a toleration are evicted. |
| `operator: Equal` | Toleration matches a taint with the same key, value, and effect. |
| `operator: Exists` | Toleration matches any taint with the given key regardless of value (omit `value` field). |
| `tolerationSeconds` | Used with `NoExecute` — how long a pod can stay on a tainted node before eviction. |

### Useful Commands

```bash
# Add a taint to a node
kubectl taint node <node-name> key=value:Effect

# Remove a taint from a node
kubectl taint node <node-name> key=value:Effect-

# View taints on all nodes
kubectl describe nodes | grep -E "Name:|Taints:"

# View taints with custom columns
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints

# View tolerations on a pod
kubectl describe pod <pod-name> | grep -A 10 Tolerations

# Check why a pod is Pending (taint-related events)
kubectl describe pod <pod-name> | grep -A 10 Events

# View the control-plane node taint (built-in)
kubectl describe node <control-plane-node> | grep Taint
```

### Taint Effects — Cheat Sheet

```
NoSchedule     →  Blocks new pods (existing pods unaffected)
PreferNoSchedule → Soft block for new pods
NoExecute      →  Blocks new pods + evicts existing pods
```

### Related Topics

- 🔗 [Node Affinity](./node-affinity.md) — use alongside taints/tolerations to both repel unwanted pods and attract the right ones; see **Question 7** for a combined example
