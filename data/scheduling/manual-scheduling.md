# 🗓️ Manual Scheduling

> **CKA Exam Domain:** Scheduling  
> **Topic:** Manual Scheduling (bypassing the Kubernetes scheduler)  
> **Total Questions:** 9

---

## 🟢 Easy Questions

---

### Question 1 — `nodeName` Direct Assignment
> ⏱️ **Recommended Time: 5 minutes**

Create a pod named `manual-pod` using the `nginx:1.21` image in the `default` namespace that runs on a node named `node01` **without using the Kubernetes scheduler**.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: manual-pod
  namespace: default
spec:
  nodeName: node01
  containers:
  - name: nginx
    image: nginx:1.21
```

```bash
kubectl apply -f manual-pod.yaml
```

> **Key Concept:** Using the `nodeName` field bypasses the scheduler and directly assigns the pod to a specific node.

</details>

---

### Question 2 — Investigating a Pending Pod
> ⏱️ **Recommended Time: 4 minutes**

A pod named `stuck-pod` in the `default` namespace is in a `Pending` state. Investigate and determine why it's not being scheduled.

<details>
<summary>✅ Answer</summary>

```bash
# Check pod status and events
kubectl describe pod stuck-pod

# Look for events such as:
# - "0/3 nodes are available: 3 node(s) had taint that the pod didn't tolerate"
# - Scheduler being disabled
# - Insufficient resources on nodes

# Check if the scheduler is running
kubectl get pods -n kube-system | grep scheduler
```

> **Key Concept:** Understanding why pods remain in `Pending` state — common causes include no scheduler, resource constraints, taints, or node selectors.

</details>

---

### Question 3 — Assigning a `schedulerName` to a Pod
> ⏱️ **Recommended Time: 4 minutes**

Create a pod named `custom-scheduled-pod` using the `nginx:alpine` image in the `default` namespace that explicitly requests to be scheduled by a scheduler named `my-scheduler`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-scheduled-pod
  namespace: default
spec:
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
kubectl apply -f custom-scheduled-pod.yaml

# Verify the schedulerName is set
kubectl describe pod custom-scheduled-pod | grep -i scheduler
```

Expected output:
```
Scheduler: my-scheduler
```

> **Key Concept:** `spec.schedulerName` tells Kubernetes which scheduler should handle this pod. If the named scheduler is not running, the pod will remain in `Pending` state indefinitely. The default value is `default-scheduler` and does not need to be specified explicitly.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Scheduling When Scheduler is Down
> ⏱️ **Recommended Time: 7 minutes**

The Kubernetes scheduler is not running in the cluster. Create a pod named `web-app` using the `nginx:alpine` image that should run on node `controlplane`. Then verify the pod is running on the correct node.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  nodeName: controlplane
  containers:
  - name: nginx
    image: nginx:alpine
```

```bash
# Apply the configuration
kubectl apply -f web-app.yaml

# Verify the pod is on the correct node
kubectl get pod web-app -o wide

# Or check specifically
kubectl get pod web-app -o jsonpath='{.spec.nodeName}'
```

> **Key Concept:** Manual scheduling using `nodeName` when the scheduler is unavailable.

</details>

---

### Question 5 — Manually Scheduling an Existing Pending Pod
> ⏱️ **Recommended Time: 8 minutes**

A pod definition file exists at `/root/mypod.yaml` but the pod is stuck in `Pending` state because the scheduler is down. Manually schedule this pod to run on `node02` **without modifying the original file**.

<details>
<summary>✅ Answer</summary>

```bash
# Method 1: Export, edit, re-apply
kubectl get pod mypod -o yaml > mypod-updated.yaml
# Add nodeName: node02 under spec
kubectl delete pod mypod
kubectl apply -f mypod-updated.yaml

# Method 2: Patch the pod directly
kubectl patch pod mypod -p '{"spec":{"nodeName":"node02"}}'

# Method 3: Create a Binding object
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Binding
metadata:
  name: mypod
target:
  apiVersion: v1
  kind: Node
  name: node02
EOF
```

> **Key Concept:** Multiple methods exist to manually schedule pods — direct assignment, patching, or Binding objects.

</details>

---

### Question 6 — Diagnose a Pod Pending Due to Wrong `schedulerName`
> ⏱️ **Recommended Time: 7 minutes**

A pod named `pending-app` in the `default` namespace has been in `Pending` state for several minutes. The cluster only runs the `default-scheduler`. Identify the root cause and fix it.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check pod events
kubectl describe pod pending-app | grep -A 10 Events

# You will NOT see a FailedScheduling event — the pod is simply ignored
# by default-scheduler because it is waiting for a different scheduler

# 2. Check the schedulerName on the pod
kubectl get pod pending-app -o yaml | grep schedulerName
# Output might show:
#   schedulerName: my-custom-scheduler

# 3. Verify no such scheduler is running
kubectl get pods -n kube-system | grep scheduler
# Only default-scheduler is present

# 4. Fix — update the pod to use default-scheduler
# (Pods cannot be patched for schedulerName in-place — recreate it)
kubectl get pod pending-app -o yaml > pending-app.yaml
```

Edit `pending-app.yaml` — change or remove the `schedulerName`:

```yaml
spec:
  schedulerName: default-scheduler   # fix: was my-custom-scheduler
```

```bash
kubectl delete pod pending-app
kubectl apply -f pending-app.yaml

# Verify it gets scheduled
kubectl get pod pending-app -o wide
```

> **Key Concept:** A pod with a `schedulerName` that does not match any running scheduler will remain in `Pending` state **silently** — there will be no `FailedScheduling` event because no scheduler is even attempting to schedule it. Always check `spec.schedulerName` when a pod is Pending with no events.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Batch Manual Scheduling
> ⏱️ **Recommended Time: 10 minutes**

The default scheduler is not running. You need to manually schedule three pods from the namespace `production`:

- `frontend-pod` → should run on `node01`
- `backend-pod` → should run on `node02`
- `database-pod` → should run on `node02`

All pods are currently in `Pending` state. After scheduling them, create a pod named `test-scheduler` in the `default` namespace with image `busybox:1.28` running `sleep 3600` — this pod should also be manually scheduled to `node01`.

<details>
<summary>✅ Answer</summary>

```bash
# Manually schedule all three pods
kubectl patch pod frontend-pod -n production -p '{"spec":{"nodeName":"node01"}}'
kubectl patch pod backend-pod -n production -p '{"spec":{"nodeName":"node02"}}'
kubectl patch pod database-pod -n production -p '{"spec":{"nodeName":"node02"}}'

# Verify
kubectl get pods -n production -o wide

# Create test-scheduler pod (no nodeName — will wait for scheduler)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-scheduler
  namespace: default
spec:
  nodeName: node01
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF
```

> **Key Concept:** Batch manual scheduling and understanding the difference between scheduler-dependent and manually scheduled pods.

</details>

---

### Question 8 — Binding Object via API
> ⏱️ **Recommended Time: 9 minutes**

Create a Binding object to manually bind a pod named `critical-app` (already created in `default` namespace and in `Pending` state) to a node named `node01`. Use the Binding API object and send it directly to the API server.

<details>
<summary>✅ Answer</summary>

```bash
# Start kubectl proxy
kubectl proxy --port=8001 &

# Create the binding payload
cat <<EOF > binding.json
{
  "apiVersion": "v1",
  "kind": "Binding",
  "metadata": {
    "name": "critical-app"
  },
  "target": {
    "apiVersion": "v1",
    "kind": "Node",
    "name": "node01"
  }
}
EOF

# Send the binding to the API server
curl -X POST http://localhost:8001/api/v1/namespaces/default/pods/critical-app/binding \
  -H "Content-Type: application/json" \
  -d @binding.json

# Alternatively, using kubectl directly
cat <<EOF | kubectl create -f -
apiVersion: v1
kind: Binding
metadata:
  name: critical-app
  namespace: default
target:
  apiVersion: v1
  kind: Node
  name: node01
EOF

# Verify
kubectl get pod critical-app -o wide
```

> **Key Concept:** Understanding the Binding API object and how the scheduler works under the hood to bind pods to nodes.

</details>

---

### Question 9 — Static Pods vs Manual Scheduling
> ⏱️ **Recommended Time: 10 minutes**

You have a static pod definition file at `/etc/kubernetes/manifests/static-web.yaml` on `node01`. The scheduler is disabled.

**Tasks:**
1. SSH to `node01` and identify the static pod
2. Explain why this pod is running despite the scheduler being down
3. Create a pod named `manual-web` with image `nginx:latest` in the `default` namespace that runs on `node01` without using static pod configuration

<details>
<summary>✅ Answer</summary>

```bash
# 1. SSH to node01 and inspect static pod
ssh node01
ls -la /etc/kubernetes/manifests/
cat /etc/kubernetes/manifests/static-web.yaml
exit

# 2. Explanation:
# Static pods are managed directly by the kubelet daemon on the node.
# The kubelet watches /etc/kubernetes/manifests/ and creates pods from
# any YAML files placed there — completely bypassing the API server scheduler.
# This is how core control plane components (etcd, kube-apiserver, etc.) run.

# 3. Create manual-web using nodeName
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: manual-web
  namespace: default
spec:
  nodeName: node01
  containers:
  - name: nginx
    image: nginx:latest
EOF

# Verify both pods
kubectl get pods -o wide | grep -E 'static-web|manual-web'
```

> **Key Concept:** Static pods are managed by the kubelet directly, not the scheduler. They are used for control plane components and persist even when the API server is down.

</details>

---

## 📌 Quick Reference

| Field / Object | Purpose |
|----------------|---------|
| `spec.nodeName` | Directly assign a pod to a node, bypassing the scheduler |
| `spec.schedulerName` | Name of the scheduler responsible for this pod (default: `default-scheduler`) |
| `Binding` object | What the scheduler creates internally to bind pods to nodes |
| `nodeSelector` | Hints to the scheduler to place a pod on nodes with matching labels |
| Static Pod path | `/etc/kubernetes/manifests/` — managed by kubelet, not the scheduler |

### Useful Commands

```bash
# Check if the scheduler is running
kubectl get pods -n kube-system | grep scheduler

# View pod placement
kubectl get pods -o wide

# Check why a pod is Pending
kubectl describe pod <pod-name>

# Check schedulerName on a pod
kubectl get pod <pod-name> -o yaml | grep schedulerName

# Manually assign a node
kubectl patch pod <pod-name> -p '{"spec":{"nodeName":"<node-name>"}}'

# Get pod's assigned node
kubectl get pod <pod-name> -o jsonpath='{.spec.nodeName}'
```

### Pending Pod Diagnosis — Cheat Sheet

```
No FailedScheduling event + schedulerName set  →  Named scheduler is not running
FailedScheduling: insufficient resources       →  Node capacity issue
FailedScheduling: untolerated taint            →  Add toleration or remove taint
FailedScheduling: no matching node             →  Check nodeSelector / node affinity
```
