# 📌 Static Pods

> **CKA Exam Domain:** Scheduling  
> **Topic:** Static Pods  
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

### Question 1 — Identify the Static Pod Directory
> ⏱️ **Recommended Time: 4 minutes**

Find the directory where static pod manifests are stored on the control plane node.

<details>
<summary>✅ Answer</summary>

```bash
# Option 1 — check the kubelet config file for staticPodPath
cat /var/lib/kubelet/config.yaml | grep staticPodPath

# Option 2 — check the kubelet service args
ps aux | grep kubelet | grep static-pod-path

# Option 3 — check the kubelet drop-in or service file
cat /etc/kubernetes/kubelet.conf
systemctl status kubelet
```

The default static pod path is usually:

```
/etc/kubernetes/manifests/
```

You can verify the existing control plane static pods are there:

```bash
ls /etc/kubernetes/manifests/
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
```

> **Key Concept:** The `staticPodPath` in the kubelet configuration defines where it watches for static pod manifests. The kubelet automatically creates, updates, and deletes pods based on files in this directory — no API server involvement is needed.

</details>

---

### Question 2 — Create a Static Pod
> ⏱️ **Recommended Time: 5 minutes**

Create a static pod named `static-nginx` using the `nginx:alpine` image on the control plane node.

<details>
<summary>✅ Answer</summary>

```bash
# Find the static pod path (usually /etc/kubernetes/manifests)
cat /var/lib/kubelet/config.yaml | grep staticPodPath
```

Create the manifest directly in the static pod directory:

```bash
cat <<EOF > /etc/kubernetes/manifests/static-nginx.yaml
apiVersion: v1
kind: Pod
metadata:
  name: static-nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:alpine
EOF
```

```bash
# The kubelet will pick it up automatically — verify within a few seconds
kubectl get pods

# The pod name will be suffixed with the node name, e.g.:
# static-nginx-controlplane
```

> **Key Concept:** Static pods are managed directly by the kubelet on a node, not through the API server. The kubelet creates a **mirror pod** in the API server so the pod appears in `kubectl get pods`, but it cannot be deleted via `kubectl delete pod` — you must remove the manifest file.

</details>

---

### Question 3 — Identify Static Pods in the Cluster
> ⏱️ **Recommended Time: 4 minutes**

List all static pods currently running in the cluster and explain how to identify them.

<details>
<summary>✅ Answer</summary>

```bash
# Static pods have the node name appended to their pod name
kubectl get pods -A

# Look for pods whose names end with the node/host name, e.g.:
# kube-apiserver-controlplane
# kube-scheduler-controlplane
# kube-controller-manager-controlplane
# etcd-controlplane

# Confirm by checking the ownerReferences — static pods are owned by a Node, not a ReplicaSet
kubectl get pod kube-apiserver-controlplane -n kube-system -o yaml | grep -A 5 ownerReferences
```

Expected output:
```yaml
ownerReferences:
- apiVersion: v1
  controller: true
  kind: Node
  name: controlplane
```

> **Key Concept:** Static pods can be identified by two characteristics: their name is suffixed with the node name (e.g., `-controlplane`), and their `ownerReferences` points to a `Node` object rather than a `ReplicaSet` or `DaemonSet`.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Delete a Static Pod
> ⏱️ **Recommended Time: 6 minutes**

A static pod named `static-busybox-controlplane` is running on the control plane node. Delete it permanently.

<details>
<summary>✅ Answer</summary>

```bash
# Attempting to delete via kubectl will NOT work permanently
# The kubelet will recreate it immediately from the manifest file
kubectl delete pod static-busybox-controlplane
# (pod will come back)

# The correct way: remove the manifest file from the static pod directory
# First, find the static pod path
cat /var/lib/kubelet/config.yaml | grep staticPodPath

# Remove the manifest
rm /etc/kubernetes/manifests/static-busybox.yaml

# Verify the pod is gone and does not come back
kubectl get pods
```

> **Key Concept:** Static pods **cannot** be deleted via `kubectl delete pod` — the kubelet will immediately recreate them. To permanently delete a static pod, remove its manifest file from the `staticPodPath` directory on the node. The kubelet detects the file removal and terminates the pod.

</details>

---

### Question 5 — Create a Static Pod on a Worker Node
> ⏱️ **Recommended Time: 8 minutes**

Create a static pod named `static-monitor` using the `busybox:1.28` image on `node01` (a worker node). The pod should run `sleep 3600`.

<details>
<summary>✅ Answer</summary>

```bash
# 1. SSH into node01
ssh node01

# 2. Find the static pod path on this node
cat /var/lib/kubelet/config.yaml | grep staticPodPath
# If not set, check:
ps aux | grep kubelet | grep static-pod-path
```

```bash
# 3. Create the manifest in the static pod directory on node01
cat <<EOF > /etc/kubernetes/manifests/static-monitor.yaml
apiVersion: v1
kind: Pod
metadata:
  name: static-monitor
  namespace: default
spec:
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF
```

```bash
# 4. Exit back to the control plane and verify
exit
kubectl get pods -o wide

# The pod will appear as static-monitor-node01
```

> **Key Concept:** Static pods can be created on **any** node that runs a kubelet — not just the control plane. The process is the same: place the manifest in the node's `staticPodPath`. The kubelet on that node manages the pod and the API server shows a mirror pod suffixed with that node's name.

</details>

---

### Question 6 — Modify a Static Pod
> ⏱️ **Recommended Time: 7 minutes**

The static pod `static-nginx-controlplane` is currently using the `nginx:1.21` image. Update it to use `nginx:alpine`.

<details>
<summary>✅ Answer</summary>

```bash
# Edit the manifest file directly on the node
vi /etc/kubernetes/manifests/static-nginx.yaml
```

Change the image field:

```yaml
containers:
- name: nginx
  image: nginx:alpine   # updated from nginx:1.21
```

```bash
# Save and exit — the kubelet detects the change and recreates the pod automatically
# Verify the new image is in use
kubectl describe pod static-nginx-controlplane | grep Image

# Or watch the pod restart
kubectl get pod static-nginx-controlplane -w
```

> **Key Concept:** To update a static pod, edit its manifest file on the node. The kubelet watches the `staticPodPath` directory for changes and will automatically delete and recreate the pod with the new spec. There is no `kubectl apply` or `kubectl set image` for static pods.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Troubleshoot a Broken Static Pod
> ⏱️ **Recommended Time: 10 minutes**

The `kube-scheduler` static pod on the control plane is not running. New pods are stuck in `Pending` state.

1. Identify the root cause
2. Fix the issue and restore the scheduler

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check the scheduler pod status
kubectl get pods -n kube-system | grep scheduler

# If the pod is missing or in CrashLoopBackOff / Error state:
kubectl describe pod kube-scheduler-controlplane -n kube-system

# Check for events indicating why it failed
kubectl get events -n kube-system --sort-by='.lastTimestamp' | grep scheduler
```

```bash
# 2. Check the static pod manifest directly
cat /etc/kubernetes/manifests/kube-scheduler.yaml

# Common issues to look for:
# - Wrong image tag
# - Typo in a flag (e.g., --config pointing to a non-existent file)
# - Incorrect volume mount path
# - Missing or wrong kubeconfig path
```

```bash
# 3. Check kubelet logs for manifest errors
journalctl -u kubelet | grep scheduler | tail -20

# 4. Fix the manifest — for example, correcting a bad image:
vi /etc/kubernetes/manifests/kube-scheduler.yaml
```

After saving the fix:

```bash
# The kubelet will automatically restart the scheduler pod
kubectl get pods -n kube-system -w

# Verify the scheduler is running
kubectl get pods -n kube-system | grep scheduler

# Confirm pending pods now get scheduled
kubectl get pods -A | grep Pending
```

> **Key Concept:** The control plane components (`kube-apiserver`, `kube-scheduler`, `kube-controller-manager`, `etcd`) are all static pods managed by the kubelet. If one is broken, fix its manifest in `/etc/kubernetes/manifests/`. Always check `kubectl describe pod`, `kubectl get events`, and `journalctl -u kubelet` together to diagnose static pod failures.

</details>

---

## 📌 Quick Reference

| Concept | Description |
|---------|-------------|
| Static Pod | A pod managed directly by the kubelet, not the API server |
| `staticPodPath` | Directory the kubelet watches for manifests (default: `/etc/kubernetes/manifests/`) |
| Mirror Pod | Read-only API server representation of a static pod (cannot be deleted via `kubectl`) |
| Name suffix | Static pod names are always suffixed with the node name (e.g., `pod-name-controlplane`) |
| `ownerReferences.kind: Node` | How to confirm a pod is a static pod via `kubectl get pod -o yaml` |

### Useful Commands

```bash
# Find the static pod path
cat /var/lib/kubelet/config.yaml | grep staticPodPath

# List static pod manifests
ls /etc/kubernetes/manifests/

# Create a static pod (drop manifest into the directory)
cp my-pod.yaml /etc/kubernetes/manifests/

# Delete a static pod (remove the manifest file)
rm /etc/kubernetes/manifests/my-pod.yaml

# Edit a static pod
vi /etc/kubernetes/manifests/my-pod.yaml

# Identify static pods (name ends with node name)
kubectl get pods -A | grep controlplane

# Confirm ownerReference is a Node
kubectl get pod <pod-name> -n kube-system -o yaml | grep -A 5 ownerReferences

# Check kubelet logs for manifest errors
journalctl -u kubelet -f
```

### Static Pod vs DaemonSet — Cheat Sheet

```
Static Pod   →  Managed by kubelet directly; no scheduler or controller; no rolling updates
DaemonSet    →  Managed by the API server; supports rolling updates, selectors, tolerations
```

### Related Topics

- 🔗 [DaemonSets](./daemonsets.md) — API-server managed alternative for running a pod on every node
