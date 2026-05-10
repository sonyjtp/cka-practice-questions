# 💾 Container Storage Interface (CSI)

> **CKA Exam Domain:** Storage  
> **Topic:** CSI concepts, CSI-backed StorageClasses, dynamic provisioning, CSIDriver objects  
> **Total Questions:** 6

---

> ℹ️ **Scope Note:** The CKA tests CSI at the **usage level** — understanding what CSI is, how to use CSI-backed StorageClasses, and how dynamic provisioning works through a CSI driver. You are **not** expected to install, develop, or debug CSI drivers themselves.

---

## 🟢 Easy Questions

---

### Question 1 — What is CSI and Why Does It Exist?
> ⏱️ **Recommended Time: 4 minutes**

Explain what the Container Storage Interface (CSI) is, why it was introduced, and how it differs from in-tree volume plugins.

<details>
<summary>✅ Answer</summary>

**CSI (Container Storage Interface)** is a standardised API that allows storage vendors to write plugins (drivers) that work with any container orchestrator — Kubernetes, Mesos, etc. — without modifying core Kubernetes code.

**Before CSI — In-tree volume plugins:**
- Storage drivers (AWS EBS, GCE PD, Azure Disk, etc.) were compiled directly into the Kubernetes binary
- Adding/fixing a storage driver required a Kubernetes release cycle
- Bugs in a storage plugin could crash the kubelet
- Storage vendors had to contribute code to the Kubernetes repo

**After CSI — Out-of-tree plugins:**
- Storage drivers run as separate pods in the cluster
- Vendors can release/update drivers independently of Kubernetes
- Failures in a CSI driver don't affect core Kubernetes components
- Kubernetes deprecated and removed most in-tree plugins in favour of CSI equivalents

```bash
# List installed CSI drivers in the cluster
kubectl get csidrivers
# NAME                         ATTACHREQUIRED   PODINFOONMOUNT   STORAGECAPACITY   ...
# pd.csi.storage.gke.io        true             false            false             ...
# ebs.csi.aws.com              true             false            false             ...

# List CSI node information (per-node driver registration)
kubectl get csinodes
# NAME           DRIVERS
# node01         1

kubectl get csinode node01 -o yaml
```

| | In-Tree Plugin | CSI Driver |
|--|---------------|-----------|
| Location | Compiled into Kubernetes | Runs as pods in cluster |
| Updates | Requires Kubernetes release | Independent release cycle |
| Failure impact | Can crash kubelet | Isolated to driver pods |
| Example | `kubernetes.io/aws-ebs` | `ebs.csi.aws.com` |

> **Key Concept:** CSI decouples storage from Kubernetes. The `CSIDriver` object registers a driver with the cluster. The `CSINode` object records which drivers are available on each node. StorageClasses reference the CSI driver's `provisioner` name to enable dynamic provisioning.

</details>

---

### Question 2 — Identify CSI Objects in the Cluster
> ⏱️ **Recommended Time: 5 minutes**

Inspect the CSI-related objects in the cluster — `CSIDriver`, `CSINode`, and any CSI-backed `StorageClass`.

<details>
<summary>✅ Answer</summary>

```bash
# List all registered CSI drivers
kubectl get csidrivers
kubectl describe csidriver <driver-name>

# CSIDriver example output:
# Name: ebs.csi.aws.com
# Spec:
#   AttachRequired: true        ← volumes must be attached before mounting
#   PodInfoOnMount: false       ← driver doesn't need pod info during mount
#   VolumeLifecycleModes: [Persistent]

# List CSI node registrations
kubectl get csinodes
kubectl describe csinode <node-name>

# CSINode example output:
# Spec:
#   Drivers:
#     Name: ebs.csi.aws.com
#     Node ID: i-0abc123def456     ← node ID in the storage system
#     Topology Keys: [topology.ebs.csi.aws.com/zone]

# Find StorageClasses using CSI provisioners
kubectl get storageclass
# NAME            PROVISIONER             ...
# gp2 (default)   ebs.csi.aws.com         ← CSI-backed
# standard        kubernetes.io/no-provisioner  ← not CSI

kubectl describe storageclass gp2
```

> **Key Concept:** The three CSI-related Kubernetes objects are: **`CSIDriver`** (describes driver capabilities), **`CSINode`** (records driver-to-node mapping), and **`CSIStorageCapacity`** (optional, tracks available storage capacity per topology zone). These are typically managed automatically by the CSI driver's node and controller pods — you rarely create them manually.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Create a StorageClass Using a CSI Provisioner
> ⏱️ **Recommended Time: 7 minutes**

Create a `StorageClass` named `csi-sc` that uses the `ebs.csi.aws.com` CSI driver with `gp3` volume type, `WaitForFirstConsumer` binding mode, and `Delete` reclaim policy.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: csi-sc
provisioner: ebs.csi.aws.com          # CSI driver name
reclaimPolicy: Delete                  # Delete PV when PVC is deleted
volumeBindingMode: WaitForFirstConsumer  # wait until Pod is scheduled before provisioning
allowVolumeExpansion: true             # allow PVC resize
parameters:
  type: gp3                            # driver-specific parameter
  fsType: ext4
```

```bash
kubectl apply -f csi-sc.yaml

# Verify
kubectl get storageclass csi-sc
kubectl describe storageclass csi-sc
# Provisioner: ebs.csi.aws.com
# ReclaimPolicy: Delete
# VolumeBindingMode: WaitForFirstConsumer
# AllowVolumeExpansion: true
```

`volumeBindingMode` options:

| Mode                   | Behaviour                                                                                 |
|------------------------|-------------------------------------------------------------------------------------------|
| `Immediate`            | PV provisioned as soon as PVC is created                                                  |
| `WaitForFirstConsumer` | PV provisioned only when a Pod using the PVC is scheduled — respects topology constraints |

> **Key Concept:** `WaitForFirstConsumer` is the recommended binding mode for CSI drivers in multi-zone clusters — it ensures the volume is created in the same zone as the Pod. `Immediate` can cause scheduling failures if the volume is provisioned in a different zone than where the Pod ends up. The `parameters` block is driver-specific — refer to the driver's documentation for supported keys.

</details>

---

### Question 4 — Dynamic Provisioning with a CSI-backed StorageClass
> ⏱️ **Recommended Time: 7 minutes**

Create a PVC named `csi-pvc` using the `csi-sc` StorageClass (from Q3), then create a Pod named `csi-pod` that mounts it at `/data`.

<details>
<summary>✅ Answer</summary>

```yaml
# PVC using the CSI-backed StorageClass
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: csi-pvc
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: csi-sc         # references the CSI StorageClass
  resources:
    requests:
      storage: 5Gi
---
# Pod that uses the PVC
apiVersion: v1
kind: Pod
metadata:
  name: csi-pod
  namespace: default
spec:
  containers:
  - name: app
    image: nginx:alpine
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: csi-pvc
```

```bash
kubectl apply -f csi-pvc.yaml
kubectl apply -f csi-pod.yaml

# With WaitForFirstConsumer, PVC stays Pending until Pod is scheduled
kubectl get pvc csi-pvc
# NAME      STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
# csi-pvc   Pending                                      csi-sc       ← waiting for consumer

# Once Pod is scheduled, the CSI driver provisions the volume
kubectl get pvc csi-pvc
# NAME      STATUS   VOLUME                                     CAPACITY   STORAGECLASS
# csi-pvc   Bound    pvc-abc123-...                             5Gi        csi-sc

# Check the auto-created PV
kubectl get pv
kubectl describe pv pvc-abc123-...
# Source:
#   Driver: ebs.csi.aws.com
#   VolumeHandle: vol-0abc123def456   ← volume ID in the storage system

# Verify mount inside the Pod
kubectl exec csi-pod -- df -h /data
```

> **Key Concept:** With CSI dynamic provisioning, you **never manually create a PV** — the CSI controller plugin creates the backing storage and PV object automatically when the PVC is bound. The `VolumeHandle` in the PV spec is the storage system's internal ID for the volume (e.g., an AWS EBS volume ID). When the PVC is deleted (and reclaim policy is `Delete`), the CSI driver automatically deletes the backing storage too.

</details>

---

### Question 5 — Resize a CSI-backed PVC
> ⏱️ **Recommended Time: 8 minutes**

Expand the `csi-pvc` PVC from 5Gi to 10Gi (the StorageClass has `allowVolumeExpansion: true`).

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify the StorageClass supports expansion
kubectl get storageclass csi-sc -o jsonpath='{.allowVolumeExpansion}'
# true  ✅

# Step 2 — Edit the PVC to request more storage
kubectl patch pvc csi-pvc -p '{"spec":{"resources":{"requests":{"storage":"10Gi"}}}}'

# OR edit directly
kubectl edit pvc csi-pvc
# Change: storage: 5Gi → storage: 10Gi
```

```yaml
# What the updated PVC spec looks like
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: csi-sc
  resources:
    requests:
      storage: 10Gi    # increased from 5Gi
```

```bash
# Step 3 — Monitor the resize
kubectl get pvc csi-pvc
# STATUS shows "Bound" but CAPACITY still shows 5Gi initially
# Conditions will show FileSystemResizePending

kubectl describe pvc csi-pvc | grep -A 5 Conditions
# Type: FileSystemResizePending  ← waiting for Pod to trigger fs resize

# Step 4 — The filesystem resize happens automatically when the Pod accesses the volume
# (for most CSI drivers with online resize support)
# If not automatic, restart the Pod to trigger filesystem expansion

kubectl delete pod csi-pod
kubectl apply -f csi-pod.yaml

# Step 5 — Verify the resize completed
kubectl get pvc csi-pvc
# CAPACITY: 10Gi  ✅

kubectl exec csi-pod -- df -h /data
# /dev/...  10G  ...
```

> **Key Concept:** PVC expansion happens in two stages: (1) the CSI driver expands the **block device/volume** in the storage backend, then (2) the **filesystem** inside the volume is expanded. Most modern CSI drivers support online filesystem resize (no Pod restart needed). The `FileSystemResizePending` condition means the block device was resized but the filesystem hasn't been expanded yet — this clears once the Pod mounts the volume again.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Troubleshoot a CSI Volume Mount Failure
> ⏱️ **Recommended Time: 9 minutes**

A Pod is stuck in `ContainerCreating` with a CSI volume mount error. Walk through diagnosing and resolving the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check Pod events for the error
kubectl describe pod <pod-name> | grep -A 20 Events
# Common errors:
# "waiting for a volume to be created, either by external provisioner or manually"
# "failed to provision volume with StorageClass"
# "driver name ebs.csi.aws.com not found in the list of registered CSI drivers"
# "timeout waiting for volume to be attached/mounted"

# Step 2 — Check PVC status
kubectl get pvc <pvc-name>
# STATUS: Pending → provisioning failed or waiting for consumer

kubectl describe pvc <pvc-name>
# Look for: FailedBinding, ProvisioningFailed events

# Step 3 — Check if the CSI driver is registered
kubectl get csidrivers
# If driver is missing → CSI driver pods are not running or failed to register

# Step 4 — Check CSI driver pods
kubectl get pods -n kube-system | grep csi
# ebs-csi-controller-xxx   Running  ← controller (provisions volumes)
# ebs-csi-node-xxx         Running  ← node plugin (mounts volumes)

# If pods are not Running:
kubectl logs -n kube-system <csi-controller-pod> -c csi-provisioner
kubectl logs -n kube-system <csi-node-pod> -c ebs-plugin

# Step 5 — Check CSINode registration on the specific node
kubectl describe csinode <node-name>
# If driver is missing from CSINode → node plugin pod crashed or not scheduled on that node

# Step 6 — Check StorageClass references correct provisioner
kubectl get storageclass <sc-name> -o jsonpath='{.provisioner}'
# Must match the name in: kubectl get csidriver

# Step 7 — Check node has required topology labels (for WaitForFirstConsumer)
kubectl get node <node-name> --show-labels | grep topology
```

Common CSI failure causes and fixes:

| Symptom                            | Cause                                   | Fix                                 |
|------------------------------------|-----------------------------------------|-------------------------------------|
| PVC stuck `Pending`                | CSI controller pod not running          | Check/restart CSI controller pods   |
| `driver not found`                 | Node plugin not running on target node  | Check CSI node DaemonSet pods       |
| `volume attachment timeout`        | Cloud API unreachable / IAM permissions | Check cloud credentials/IAM role    |
| `StorageClass not found`           | Wrong `storageClassName` in PVC         | Fix PVC to reference correct SC     |
| `WaitForFirstConsumer` PVC pending | No Pod using the PVC yet                | Normal — create a Pod using the PVC |

> **Key Concept:** CSI drivers have two components: a **controller plugin** (runs as a Deployment — handles volume creation/deletion/attachment) and a **node plugin** (runs as a DaemonSet — handles volume mounting on each node). When troubleshooting, check both. A missing controller means volumes can't be provisioned; a missing node plugin means volumes can't be mounted on that node.

</details>

---

