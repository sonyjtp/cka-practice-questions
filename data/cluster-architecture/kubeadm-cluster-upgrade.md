# ⬆️ Cluster Upgrade with kubeadm

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Upgrading a Kubernetes Cluster with kubeadm  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** The CKA exam tests upgrading a cluster using `kubeadm`. You are expected to upgrade **one minor version at a time** (e.g., 1.29 → 1.30). Skipping versions is not supported. The upgrade order is always: **control plane first, then worker nodes**.

---

## 🟢 Easy Questions

---

### Question 1 — Check Current Version and Available Upgrade Targets
> ⏱️ **Recommended Time: 4 minutes**

Check the current Kubernetes version of all nodes and determine what version the cluster can be upgraded to.

<details>
<summary>✅ Answer</summary>

```bash
# Check current version of all nodes
kubectl get nodes
# NAME           STATUS   ROLES           AGE   VERSION
# controlplane   Ready    control-plane   10d   v1.29.0
# worker-01      Ready    <none>          10d   v1.29.0
# worker-02      Ready    <none>          10d   v1.29.0

# Check what upgrade targets are available
# First, update the package index
apt-get update

# List available kubeadm versions (Debian/Ubuntu)
apt-cache madison kubeadm | head -10
# kubeadm | 1.30.0-1.1 | https://pkgs.k8s.io/...
# kubeadm | 1.29.5-1.1 | https://pkgs.k8s.io/...

# Use kubeadm to show upgrade plan (what versions are available)
kubeadm upgrade plan
# Shows current version, available versions, and component upgrade details

# Example output snippet:
# COMPONENT            CURRENT   TARGET
# kube-apiserver       v1.29.0   v1.30.0
# kube-controller-mgr  v1.29.0   v1.30.0
# kube-scheduler       v1.29.0   v1.30.0
# kube-proxy           v1.29.0   v1.30.0
# CoreDNS              v1.10.1   v1.11.1
# etcd                 3.5.9     3.5.12
```

> **Key Concept:** Always run `kubeadm upgrade plan` before upgrading — it validates the cluster state and shows what can be upgraded. Kubernetes supports upgrading **one minor version at a time** (e.g., 1.29 → 1.30, not 1.29 → 1.31). Patch versions within the same minor can be skipped (e.g., 1.29.0 → 1.29.5 is fine).

</details>

---

### Question 2 — Drain a Node Before Upgrade
> ⏱️ **Recommended Time: 5 minutes**

Before upgrading `worker-01`, safely drain it to evict all workloads and mark it unschedulable.

<details>
<summary>✅ Answer</summary>

```bash
# Drain the node — evicts all pods and marks node as SchedulingDisabled
kubectl drain worker-01 \
  --ignore-daemonsets \       # don't try to evict DaemonSet pods (they're managed separately)
  --delete-emptydir-data      # allow eviction of pods using emptyDir volumes

# Verify node is cordoned (SchedulingDisabled)
kubectl get node worker-01
# STATUS: Ready,SchedulingDisabled

# After upgrade, uncordon to restore scheduling
kubectl uncordon worker-01

# Verify node is schedulable again
kubectl get node worker-01
# STATUS: Ready
```

Drain flags reference:

| Flag                     | Purpose                                           |
|--------------------------|---------------------------------------------------|
| `--ignore-daemonsets`    | Skip DaemonSet pods (always required)             |
| `--delete-emptydir-data` | Evict pods with emptyDir (data will be lost)      |
| `--force`                | Evict unmanaged pods (not backed by a controller) |
| `--grace-period=0`       | Skip graceful termination (use carefully)         |
| `--timeout=60s`          | Fail if drain doesn't complete in time            |

> **Key Concept:** `kubectl drain` = `kubectl cordon` (mark unschedulable) + evict all pods. DaemonSet pods cannot be evicted (they're tied to the node) — `--ignore-daemonsets` is always needed. After the upgrade, **always uncordon** the node or it will remain unschedulable permanently.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Upgrade the Control Plane
> ⏱️ **Recommended Time: 10 minutes**

Upgrade the control plane node from `v1.29.0` to `v1.30.0` using kubeadm.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — SSH to the control plane node
ssh controlplane

# Step 2 — Update the package repository and install the target kubeadm version
# For Kubernetes 1.30 (pkgs.k8s.io format):
apt-get update
apt-cache madison kubeadm | grep 1.30
# Select the exact version, e.g. 1.30.0-1.1

apt-mark unhold kubeadm
apt-get install -y kubeadm=1.30.0-1.1
apt-mark hold kubeadm

# Step 3 — Verify the new kubeadm version
kubeadm version
# kubeadm: v1.30.0

# Step 4 — Check the upgrade plan
kubeadm upgrade plan v1.30.0

# Step 5 — Apply the upgrade (control plane components only)
kubeadm upgrade apply v1.30.0
# Type 'y' when prompted
# This upgrades: kube-apiserver, kube-controller-manager, kube-scheduler, kube-proxy, CoreDNS, etcd

# Step 6 — Verify control plane components are upgraded
kubectl get nodes           # still shows old kubelet version — upgrade kubelet next
kubeadm version
kubectl version
```

> **Key Concept:** `kubeadm upgrade apply` upgrades the **static pod manifests** for control plane components (apiserver, controller-manager, scheduler) and updates the cluster's ConfigMaps. It does NOT upgrade `kubelet` or `kubectl` — those are separate binaries that must be upgraded manually. After `kubeadm upgrade apply`, the node's version in `kubectl get nodes` still shows the old version until kubelet is upgraded.

</details>

---

### Question 4 — Upgrade kubelet and kubectl on the Control Plane Node
> ⏱️ **Recommended Time: 8 minutes**

After running `kubeadm upgrade apply v1.30.0`, upgrade `kubelet` and `kubectl` on the control plane node to `v1.30.0`.

<details>
<summary>✅ Answer</summary>

```bash
# On the control plane node:

# Step 1 — Drain the control plane node (if it runs workloads)
# For single control-plane clusters, use --ignore-daemonsets
kubectl drain controlplane \
  --ignore-daemonsets \
  --delete-emptydir-data

# Step 2 — Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
apt-mark hold kubelet kubectl

# Step 3 — Reload systemd and restart kubelet
systemctl daemon-reload
systemctl restart kubelet

# Step 4 — Uncordon the control plane node
kubectl uncordon controlplane

# Step 5 — Verify the control plane node now shows v1.30.0
kubectl get nodes
# controlplane   Ready   control-plane   v1.30.0  ← updated
# worker-01      Ready   <none>          v1.29.0  ← still old
```

> **Key Concept:** `kubelet` is the node agent — it must be upgraded separately on each node. The version shown in `kubectl get nodes` is the **kubelet version**, not the API server version. Always: (1) upgrade kubeadm, (2) run `kubeadm upgrade apply` or `kubeadm upgrade node`, (3) upgrade kubelet + kubectl, (4) restart kubelet. Using `apt-mark hold/unhold` prevents accidental upgrades during `apt-get upgrade`.

</details>

---

### Question 5 — Upgrade a Worker Node End-to-End
> ⏱️ **Recommended Time: 10 minutes**

Upgrade `worker-01` from `v1.29.0` to `v1.30.0` (control plane is already upgraded).

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — From the control plane: drain the worker node
kubectl drain worker-01 \
  --ignore-daemonsets \
  --delete-emptydir-data

# Step 2 — SSH to the worker node
ssh worker-01

# Step 3 — Upgrade kubeadm on the worker
apt-get update
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.30.0-1.1
apt-mark hold kubeadm

# Step 4 — Run kubeadm upgrade node (NOT upgrade apply — that's only for control plane)
kubeadm upgrade node
# This updates the kubelet configuration for this worker node

# Step 5 — Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
apt-mark hold kubelet kubectl

# Step 6 — Reload and restart kubelet
systemctl daemon-reload
systemctl restart kubelet

# Step 7 — Exit back to control plane and uncordon
exit   # back to control plane
kubectl uncordon worker-01

# Step 8 — Verify
kubectl get nodes
# worker-01   Ready   <none>   v1.30.0  ← upgraded
```

Control plane vs worker node upgrade commands:

| Step             | Control Plane                   | Worker Node                     |
|------------------|---------------------------------|---------------------------------|
| kubeadm command  | `kubeadm upgrade apply v1.30.0` | `kubeadm upgrade node`          |
| Drains itself?   | Manual drain needed             | Manual drain from control plane |
| What it upgrades | Static pod manifests + configs  | Kubelet config only             |

> **Key Concept:** Worker nodes use `kubeadm upgrade node` (not `upgrade apply`). This command updates the local kubelet configuration to match the new version. You must drain the worker **from the control plane** before SSHing into it — you cannot drain a node from itself (the API server is on the control plane).

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Full Cluster Upgrade: Control Plane + 2 Workers
> ⏱️ **Recommended Time: 15 minutes**

Perform a full cluster upgrade from `v1.29.0` to `v1.30.0`. The cluster has one control plane node (`controlplane`) and two worker nodes (`worker-01`, `worker-02`).

<details>
<summary>✅ Answer</summary>

```bash
# ═══════════════════════════════════════
# PHASE 1: Upgrade the Control Plane
# ═══════════════════════════════════════

# 1a. SSH to control plane
ssh controlplane

# 1b. Upgrade kubeadm
apt-get update
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.30.0-1.1
apt-mark hold kubeadm
kubeadm version   # verify: v1.30.0

# 1c. Review upgrade plan
kubeadm upgrade plan v1.30.0

# 1d. Apply the upgrade
kubeadm upgrade apply v1.30.0
# Confirm with 'y'

# 1e. Drain control plane (from control plane itself)
kubectl drain controlplane \
  --ignore-daemonsets \
  --delete-emptydir-data

# 1f. Upgrade kubelet + kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet

# 1g. Uncordon control plane
kubectl uncordon controlplane

# 1h. Verify control plane is v1.30.0
kubectl get nodes
# controlplane   Ready   control-plane   v1.30.0

# ═══════════════════════════════════════
# PHASE 2: Upgrade worker-01
# ═══════════════════════════════════════

# 2a. Drain worker-01 (from control plane)
kubectl drain worker-01 \
  --ignore-daemonsets \
  --delete-emptydir-data

# 2b. SSH to worker-01
ssh worker-01

# 2c. Upgrade kubeadm
apt-get update
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.30.0-1.1
apt-mark hold kubeadm

# 2d. Upgrade node config
kubeadm upgrade node

# 2e. Upgrade kubelet + kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
apt-mark hold kubelet kubectl
systemctl daemon-reload
systemctl restart kubelet

# 2f. Return to control plane and uncordon
exit
kubectl uncordon worker-01
kubectl get nodes   # worker-01 should show v1.30.0

# ═══════════════════════════════════════
# PHASE 3: Upgrade worker-02 (same as worker-01)
# ═══════════════════════════════════════

kubectl drain worker-02 --ignore-daemonsets --delete-emptydir-data
ssh worker-02
apt-get update
apt-mark unhold kubeadm && apt-get install -y kubeadm=1.30.0-1.1 && apt-mark hold kubeadm
kubeadm upgrade node
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
apt-mark hold kubelet kubectl
systemctl daemon-reload && systemctl restart kubelet
exit
kubectl uncordon worker-02

# ═══════════════════════════════════════
# Final Verification
# ═══════════════════════════════════════
kubectl get nodes
# controlplane   Ready   control-plane   v1.30.0
# worker-01      Ready   <none>          v1.30.0
# worker-02      Ready   <none>          v1.30.0
```

> **Key Concept:** Always upgrade **one node at a time** to maintain cluster availability. The upgrade sequence is fixed: (1) control plane kubeadm → (2) `upgrade apply` → (3) control plane kubelet/kubectl → (4) each worker in sequence. Worker nodes are upgraded one at a time so workloads can be rescheduled to the remaining nodes during each drain.

</details>

---

### Question 7 — Troubleshoot a Failed kubeadm upgrade apply
> ⏱️ **Recommended Time: 12 minutes**

`kubeadm upgrade apply v1.30.0` failed mid-way. The API server pod is not starting. Diagnose and recover.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check control plane pod status
kubectl get pods -n kube-system | grep kube-apiserver
# kube-apiserver-controlplane   0/1   CrashLoopBackOff   ...

# If kubectl is unavailable (API server is down), use crictl directly on the node:
crictl ps -a | grep apiserver
crictl logs <container-id>

# Step 2 — Check static pod manifest
cat /etc/kubernetes/manifests/kube-apiserver.yaml
# Look for: wrong image tag, invalid flags, bad configuration

# Step 3 — Check kubelet logs for why the static pod won't start
journalctl -xeu kubelet | tail -50
# Common errors:
# - "failed to pull image" → wrong image tag or no internet access
# - "invalid flag" → kubeadm wrote an unsupported flag for this version
# - "cert error" → certificate issue

# Step 4 — Check if kubeadm left backup manifests
ls /etc/kubernetes/tmp/
# kubeadm-backup-manifests-<timestamp>/
# Contains the pre-upgrade manifests

# Step 5a — If image pull failed, pre-pull the image manually
crictl pull registry.k8s.io/kube-apiserver:v1.30.0
# Then restart kubelet to retry
systemctl restart kubelet

# Step 5b — If manifest is corrupted, restore from backup
cp /etc/kubernetes/tmp/kubeadm-backup-manifests-<timestamp>/kube-apiserver.yaml \
   /etc/kubernetes/manifests/kube-apiserver.yaml
systemctl restart kubelet

# Step 6 — Verify API server recovers
kubectl get nodes
kubectl get pods -n kube-system

# Step 7 — If recovered to old version, retry the upgrade
kubeadm upgrade apply v1.30.0
```

Common failure causes:

| Failure           | Symptom                                | Fix                                                     |
|-------------------|----------------------------------------|---------------------------------------------------------|
| Image pull failed | `ImagePullBackOff` on apiserver pod    | Pre-pull image: `crictl pull <image>`                   |
| Bad manifest      | `CrashLoopBackOff`, kubelet errors     | Restore from `/etc/kubernetes/tmp/` backup              |
| etcd unavailable  | `upgrade apply` hangs/fails at etcd    | Check etcd pod: `kubectl get pod -n kube-system etcd-*` |
| Version skew      | `kubeadm` version doesn't match target | Reinstall correct kubeadm version                       |
| Disk full         | kubelet can't write manifest           | Free disk space on control plane node                   |

> **Key Concept:** `kubeadm upgrade apply` saves backup manifests in `/etc/kubernetes/tmp/kubeadm-backup-manifests-<timestamp>/` before making changes. This is your recovery path if something goes wrong. Static pod manifests live in `/etc/kubernetes/manifests/` — kubelet watches this directory and automatically starts/stops pods when files change. If the API server is down, use `crictl` to inspect containers directly on the node.

</details>

---

## 📌 Quick Reference

### Full Upgrade Sequence (One Minor Version)

```
Control Plane Node:
  1. apt-get install kubeadm=<version>
  2. kubeadm upgrade plan
  3. kubeadm upgrade apply <version>
  4. kubectl drain controlplane --ignore-daemonsets
  5. apt-get install kubelet=<version> kubectl=<version>
  6. systemctl daemon-reload && systemctl restart kubelet
  7. kubectl uncordon controlplane

Each Worker Node (repeat per worker):
  1. kubectl drain <worker> --ignore-daemonsets    ← from control plane
  2. ssh <worker>
  3. apt-get install kubeadm=<version>
  4. kubeadm upgrade node
  5. apt-get install kubelet=<version> kubectl=<version>
  6. systemctl daemon-reload && systemctl restart kubelet
  7. exit
  8. kubectl uncordon <worker>                     ← from control plane
```

### Key Files and Paths

```
/etc/kubernetes/manifests/          Static pod manifests (apiserver, etcd, etc.)
/etc/kubernetes/tmp/                kubeadm upgrade backups
/var/lib/kubelet/config.yaml        kubelet configuration
/etc/apt/sources.list.d/            Kubernetes apt repository config
```

### Useful Commands

```bash
# Check node versions
kubectl get nodes

# Upgrade plan
kubeadm upgrade plan [version]

# Apply upgrade (control plane only)
kubeadm upgrade apply v1.30.0

# Upgrade worker node config
kubeadm upgrade node

# Drain a node
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

# Uncordon a node
kubectl uncordon <node>

# Check kubelet status
systemctl status kubelet
journalctl -xeu kubelet | tail -30

# Hold/unhold package versions
apt-mark hold kubeadm kubelet kubectl
apt-mark unhold kubeadm kubelet kubectl

# Show available versions
apt-cache madison kubeadm
```

### Version Skew Policy

```
kubeadm:  must match target version before running upgrade
kubelet:  can be up to 2 minor versions behind kube-apiserver
kubectl:  can be ±1 minor version from kube-apiserver
```

### Related Topics

- 🔗 [etcd Backup & Restore](./etcd-backup-restore.md) — always back up etcd before a cluster upgrade
- 🔗 [Static Pods](../scheduling/static-pods.md) — control plane components run as static pods managed by kubelet
- 🔗 [Logging & Monitoring](../logging-monitoring/logging-and-monitoring.md) — use `kubectl logs` and `journalctl` to debug upgrade failures
