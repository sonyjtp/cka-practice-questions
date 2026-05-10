# 🔁 DaemonSets

> **CKA Exam Domain:** Scheduling  
> **Topic:** DaemonSets  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Create a Basic DaemonSet
> ⏱️ **Recommended Time: 5 minutes**

Create a DaemonSet named `log-collector` in the `default` namespace using the `busybox:1.28` image that runs `sleep 3600` on every node in the cluster.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-collector
  namespace: default
spec:
  selector:
    matchLabels:
      app: log-collector
  template:
    metadata:
      labels:
        app: log-collector
    spec:
      containers:
      - name: busybox
        image: busybox:1.28
        command: ["sleep", "3600"]
```

```bash
kubectl apply -f log-collector.yaml

# Verify one pod per node
kubectl get daemonset log-collector
kubectl get pods -l app=log-collector -o wide
```

> **Key Concept:** A DaemonSet ensures exactly **one pod runs on every node** (or a subset of nodes). When nodes are added to the cluster, pods are automatically scheduled on them. When nodes are removed, those pods are garbage collected.

</details>

---

### Question 2 — Inspect a DaemonSet
> ⏱️ **Recommended Time: 4 minutes**

A DaemonSet named `node-exporter` exists in the `monitoring` namespace. Answer the following:

1. How many pods are running?
2. How many nodes are they scheduled on?
3. What update strategy is configured?

<details>
<summary>✅ Answer</summary>

```bash
# 1 & 2. Check desired, current, ready, and node counts
kubectl get daemonset node-exporter -n monitoring

# Output columns:
# NAME           DESIRED  CURRENT  READY  UP-TO-DATE  AVAILABLE  NODE SELECTOR  AGE

# 3. Check the update strategy
kubectl describe daemonset node-exporter -n monitoring | grep -A 3 "Update Strategy"

# Or via yaml
kubectl get daemonset node-exporter -n monitoring -o yaml | grep -A 5 updateStrategy
```

> **Key Concept:** `kubectl get daemonset` shows the desired/current/ready pod counts. The `DESIRED` count matches the number of eligible nodes. The default update strategy is `RollingUpdate`.

</details>

---

### Question 3 — DaemonSet with Resource Limits
> ⏱️ **Recommended Time: 6 minutes**

Create a DaemonSet named `resource-ds` in the `default` namespace using the `nginx:alpine` image with the following resource constraints per pod:

- **CPU request:** `50m` / **limit:** `100m`
- **Memory request:** `32Mi` / **limit:** `64Mi`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: resource-ds
  namespace: default
spec:
  selector:
    matchLabels:
      app: resource-ds
  template:
    metadata:
      labels:
        app: resource-ds
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        resources:
          requests:
            cpu: "50m"
            memory: "32Mi"
          limits:
            cpu: "100m"
            memory: "64Mi"
```

```bash
kubectl apply -f resource-ds.yaml

# Verify resources
kubectl describe daemonset resource-ds | grep -A 8 Limits
```

> **Key Concept:** Resource requests and limits on DaemonSet pods work exactly like regular pods. Since a DaemonSet pod runs on every node, it is important to keep resource requests low to avoid starving other workloads.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Run a DaemonSet on a Subset of Nodes Using nodeSelector
> ⏱️ **Recommended Time: 7 minutes**

You have nodes labelled `role=worker`. Create a DaemonSet named `worker-agent` in the `default` namespace using the `busybox:1.28` image (running `sleep 3600`) that only runs on those worker nodes.

<details>
<summary>✅ Answer</summary>

```bash
# Label the relevant nodes (if not already done)
kubectl label node node01 role=worker
kubectl label node node02 role=worker
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: worker-agent
  namespace: default
spec:
  selector:
    matchLabels:
      app: worker-agent
  template:
    metadata:
      labels:
        app: worker-agent
    spec:
      nodeSelector:
        role: worker
      containers:
      - name: busybox
        image: busybox:1.28
        command: ["sleep", "3600"]
```

```bash
kubectl apply -f worker-agent.yaml

# Verify pods only land on worker-labelled nodes
kubectl get pods -l app=worker-agent -o wide
```

> **Key Concept:** By adding a `nodeSelector` to a DaemonSet's pod template, you restrict it to a subset of nodes. Only nodes with matching labels will receive a pod. This is commonly used to run agents only on worker nodes and skip the control plane.

</details>

---

### Question 5 — DaemonSet with Tolerations for Tainted Nodes
> ⏱️ **Recommended Time: 7 minutes**

All nodes in the cluster have the taint `dedicated=infra:NoSchedule`. Create a DaemonSet named `infra-agent` in the `default` namespace using the `nginx:alpine` image that can run on **all** nodes including tainted ones.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: infra-agent
  namespace: default
spec:
  selector:
    matchLabels:
      app: infra-agent
  template:
    metadata:
      labels:
        app: infra-agent
    spec:
      tolerations:
      - key: "dedicated"
        operator: "Equal"
        value: "infra"
        effect: "NoSchedule"
      containers:
      - name: nginx
        image: nginx:alpine
```

```bash
kubectl apply -f infra-agent.yaml

# Verify pods run on all nodes including tainted ones
kubectl get pods -l app=infra-agent -o wide
```

> **Key Concept:** DaemonSets do not automatically tolerate custom taints. To run on tainted nodes, add the appropriate `tolerations` to the pod template. Note that DaemonSets automatically tolerate the built-in `node.kubernetes.io/unschedulable` and `node.kubernetes.io/not-ready` taints so they survive node failures.

</details>

---

### Question 6 — Rolling Update a DaemonSet
> ⏱️ **Recommended Time: 8 minutes**

A DaemonSet named `monitoring-agent` in the `default` namespace is currently using the `busybox:1.28` image. Update it to use `busybox:1.35` and verify the rollout completes successfully.

<details>
<summary>✅ Answer</summary>

```bash
# Option 1 — imperative
kubectl set image daemonset monitoring-agent busybox=busybox:1.35

# Option 2 — edit the DaemonSet directly
kubectl edit daemonset monitoring-agent
# Change image: busybox:1.28 → busybox:1.35

# Watch the rollout progress
kubectl rollout status daemonset monitoring-agent

# Verify the new image is running
kubectl describe daemonset monitoring-agent | grep Image

# Rollout history
kubectl rollout history daemonset monitoring-agent

# Rollback if needed
kubectl rollout undo daemonset monitoring-agent
```

> **Key Concept:** DaemonSets support `RollingUpdate` (default) and `OnDelete` update strategies. With `RollingUpdate`, pods are updated one node at a time. With `OnDelete`, pods are only updated when manually deleted. Use `kubectl rollout status` to monitor progress.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — DaemonSet with Node Affinity
> ⏱️ **Recommended Time: 9 minutes**

Create a DaemonSet named `zone-agent` in the `default` namespace using the `nginx:alpine` image that only runs on nodes located in **either** `zone=us-east-1a` **or** `zone=us-west-2a` using node affinity.

<details>
<summary>✅ Answer</summary>

```bash
# Label the relevant nodes
kubectl label node node01 zone=us-east-1a
kubectl label node node02 zone=us-west-2a
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: zone-agent
  namespace: default
spec:
  selector:
    matchLabels:
      app: zone-agent
  template:
    metadata:
      labels:
        app: zone-agent
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: zone
                operator: In
                values:
                - us-east-1a
                - us-west-2a
      containers:
      - name: nginx
        image: nginx:alpine
```

```bash
kubectl apply -f zone-agent.yaml

# Verify pods only run on nodes in those zones
kubectl get pods -l app=zone-agent -o wide
```

> **Key Concept:** Node affinity in a DaemonSet pod template works the same as in a regular pod. Using `operator: In` with multiple values implements OR logic — the DaemonSet pod will run on any node whose `zone` label matches either value.

</details>

---

### Question 8 — Run a DaemonSet on Control Plane Nodes
> ⏱️ **Recommended Time: 10 minutes**

By default, DaemonSets do not schedule pods on control plane nodes due to the built-in taint `node-role.kubernetes.io/control-plane:NoSchedule`. Create a DaemonSet named `control-plane-agent` in the `kube-system` namespace using the `busybox:1.28` image (running `sleep 3600`) that runs on **all** nodes including the control plane.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: control-plane-agent
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: control-plane-agent
  template:
    metadata:
      labels:
        app: control-plane-agent
    spec:
      tolerations:
      - key: "node-role.kubernetes.io/control-plane"
        operator: "Exists"
        effect: "NoSchedule"
      containers:
      - name: busybox
        image: busybox:1.28
        command: ["sleep", "3600"]
```

```bash
kubectl apply -f control-plane-agent.yaml

# Verify pods run on ALL nodes including the control plane
kubectl get pods -l app=control-plane-agent -o wide

# The DESIRED count should equal the total number of nodes (workers + control plane)
kubectl get daemonset control-plane-agent -n kube-system
```

> **Key Concept:** Control plane nodes have the taint `node-role.kubernetes.io/control-plane:NoSchedule` (and sometimes `node-role.kubernetes.io/master:NoSchedule` in older clusters). To schedule a DaemonSet pod there, add a toleration with `operator: Exists` so it matches regardless of the taint's value. This is how system DaemonSets like `kube-proxy` and `fluentd` run on every node.

</details>

---

## 📌 Quick Reference

| Concept | Description |
|---------|-------------|
| DaemonSet | Ensures one pod runs on every (or a subset of) node(s) |
| `nodeSelector` | Restricts the DaemonSet to nodes with matching labels |
| `nodeAffinity` | More expressive node targeting using operators (`In`, `NotIn`, etc.) |
| `tolerations` | Allows the DaemonSet to run on tainted nodes |
| `RollingUpdate` | Default update strategy — updates one node at a time |
| `OnDelete` | Pods are only updated when manually deleted |

### Useful Commands

```bash
# Create a DaemonSet
kubectl apply -f daemonset.yaml

# List DaemonSets
kubectl get daemonsets -A

# Describe a DaemonSet
kubectl describe daemonset <name> -n <namespace>

# Update image
kubectl set image daemonset/<name> <container>=<image>

# Watch rollout
kubectl rollout status daemonset/<name>

# Rollback
kubectl rollout undo daemonset/<name>

# Rollout history
kubectl rollout history daemonset/<name>

# Verify pod distribution across nodes
kubectl get pods -l <label> -o wide
```

### DaemonSet vs Deployment — Cheat Sheet

```
DaemonSet   →  One pod per node; no replica count; used for node-level agents
Deployment  →  Specified replica count; scheduler places pods freely across nodes
```

### Related Topics

- 🔗 [Static Pods](./static-pods.md) — kubelet-managed alternative for running pods on specific nodes without the API server
- 🔗 [Node Affinity](./node-affinity.md) — advanced node targeting used in DaemonSet pod templates
- 🔗 [Taints and Tolerations](./taints-and-tolerations.md) — required when running DaemonSets on tainted nodes
