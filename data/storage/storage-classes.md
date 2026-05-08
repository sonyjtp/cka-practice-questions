# 🗄️ Storage Classes

> **CKA Exam Domain:** Storage  
> **Topic:** StorageClasses & Dynamic Provisioning  
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

### Question 1 — Inspect StorageClasses and Identify the Default
> ⏱️ **Recommended Time: 4 minutes**

List all StorageClasses in the cluster. Identify which one is the default and what provisioner it uses.

<details>
<summary>✅ Answer</summary>

```bash
# List all StorageClasses
kubectl get storageclass
# or short form
kubectl get sc

# Example output:
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
# standard (default)   k8s.io/minikube-hostpath   Delete       Immediate              false
# fast-ssd             kubernetes.io/no-provisioner  Retain    WaitForFirstConsumer   false

# Identify the default — it has "(default)" in the NAME column

# Get full details of a StorageClass
kubectl describe storageclass standard
kubectl get storageclass standard -o yaml
```

Key fields to note:

| Field | Description |
|-------|-------------|
| `PROVISIONER` | Plugin that creates the underlying storage |
| `RECLAIMPOLICY` | What happens to the PV when PVC is deleted (`Delete`/`Retain`) |
| `VOLUMEBINDINGMODE` | When PV is provisioned (`Immediate`/`WaitForFirstConsumer`) |
| `ALLOWVOLUMEEXPANSION` | Whether PVCs using this class can be resized |

> **Key Concept:** The **default StorageClass** is used when a PVC does not specify a `storageClassName`. It is identified by the annotation `storageclass.kubernetes.io/is-default-class: "true"`. Only one StorageClass should be set as default — if multiple are marked default, PVC behaviour is undefined.

</details>

---

### Question 2 — Create a StorageClass
> ⏱️ **Recommended Time: 5 minutes**

Create a StorageClass named `fast-storage` with:

- Provisioner: `kubernetes.io/no-provisioner` (manual/static provisioning)
- Reclaim policy: `Retain`
- Volume binding mode: `WaitForFirstConsumer`
- Volume expansion: enabled

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: kubernetes.io/no-provisioner   # static provisioning (no dynamic PV creation)
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

```bash
kubectl apply -f fast-storage.yaml

# Verify
kubectl get storageclass fast-storage
kubectl describe storageclass fast-storage
```

> **Key Concept:** `kubernetes.io/no-provisioner` means the StorageClass does **not** dynamically create PVs — you must create PVs manually and set their `storageClassName` to match. This is used in bare-metal or on-prem environments. Cloud providers use their own provisioners (e.g., `kubernetes.io/aws-ebs`, `pd.csi.storage.gke.io`).

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Set a Default StorageClass
> ⏱️ **Recommended Time: 6 minutes**

The cluster currently has no default StorageClass. Set `standard` as the default. Then verify that a PVC created without a `storageClassName` uses it.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Confirm no default exists
kubectl get storageclass
# None should have "(default)" next to the name

# Step 2 — Set standard as default by adding the annotation
kubectl patch storageclass standard \
  --type merge \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Step 3 — Verify
kubectl get storageclass
# standard (default) should now appear

# Step 4 — Create a PVC without storageClassName
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: default-sc-pvc
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  # No storageClassName — uses cluster default
EOF

kubectl get pvc default-sc-pvc -o jsonpath='{.spec.storageClassName}'
# standard   ← automatically assigned the default StorageClass
```

To **remove** the default designation:

```bash
kubectl patch storageclass standard \
  --type merge \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
```

> **Key Concept:** The default StorageClass is applied to PVCs that omit `storageClassName`. This is a cluster-wide setting. If you need to create a PVC that explicitly uses **no** StorageClass (static binding only), set `storageClassName: ""` (empty string) — this prevents the default from being applied.

</details>

---

### Question 4 — Dynamic Provisioning with a StorageClass
> ⏱️ **Recommended Time: 7 minutes**

A StorageClass named `standard` exists with a dynamic provisioner. Create a PVC named `dynamic-pvc` in the `default` namespace using `standard` requesting `2Gi` with `ReadWriteOnce`. Verify the PV is dynamically created and bound.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: standard     # triggers dynamic provisioning
  resources:
    requests:
      storage: 2Gi
```

```bash
kubectl apply -f dynamic-pvc.yaml

# With dynamic provisioning, a PV is created automatically
kubectl get pvc dynamic-pvc
# STATUS: Bound (immediately if bindingMode is Immediate)

# Verify a PV was auto-created
kubectl get pv
# A PV with a generated name should appear, CLAIM: default/dynamic-pvc

# Describe to see provisioner details
kubectl describe pv <auto-generated-pv-name>
```

Static vs Dynamic provisioning:

| | Static Provisioning | Dynamic Provisioning |
|--|---------------------|---------------------|
| PV creation | Manual (admin) | Automatic (provisioner) |
| StorageClass provisioner | `no-provisioner` | Cloud/CSI driver |
| PVC wait time | Until matching PV exists | Near-instant |
| Use case | On-prem, bare-metal | Cloud environments |

> **Key Concept:** Dynamic provisioning is the standard cloud pattern — administrators define StorageClasses, developers create PVCs, and the provisioner handles everything else. The PV is created with the same reclaim policy as the StorageClass. When the PVC is deleted, the dynamically provisioned PV is also deleted (if reclaimPolicy is `Delete`).

</details>

---

### Question 5 — StorageClass Reclaim Policy and Parameters
> ⏱️ **Recommended Time: 7 minutes**

A StorageClass named `slow-hdd` was created with `reclaimPolicy: Delete`. Update it to use `reclaimPolicy: Retain`. Also explain why existing PVs are not affected by this change.

<details>
<summary>✅ Answer</summary>

```bash
# Attempt to patch the reclaimPolicy directly
kubectl patch storageclass slow-hdd \
  --type merge \
  -p '{"reclaimPolicy":"Retain"}'

# Note: StorageClass is mostly immutable after creation
# The above patch works for reclaimPolicy but NOT for provisioner or parameters

# If patch fails, you must delete and recreate:
kubectl get storageclass slow-hdd -o yaml > slow-hdd-sc.yaml
# Edit the file: change reclaimPolicy: Delete → reclaimPolicy: Retain
kubectl delete storageclass slow-hdd
kubectl apply -f slow-hdd-sc.yaml

# Verify
kubectl get storageclass slow-hdd -o jsonpath='{.reclaimPolicy}'
# Retain
```

Why existing PVs are NOT affected:

```bash
# PVs created BEFORE the StorageClass change retain the old policy
kubectl get pv -o custom-columns=\
NAME:.metadata.name,\
RECLAIM:.spec.persistentVolumeReclaimPolicy,\
SC:.spec.storageClassName

# Only PVs created AFTER the StorageClass update inherit the new policy

# To update an existing PV's reclaim policy individually:
kubectl patch pv <pv-name> \
  --type merge \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

> **Key Concept:** The StorageClass `reclaimPolicy` sets the **default** for newly provisioned PVs — it does not retroactively change existing PVs. Each PV stores its own `persistentVolumeReclaimPolicy` at creation time. To change an existing PV's reclaim policy, you must patch the PV directly.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Troubleshoot PVC Pending Due to StorageClass Issues
> ⏱️ **Recommended Time: 9 minutes**

A PVC named `app-pvc` in the `default` namespace is stuck in `Pending`. It references StorageClass `premium-ssd`. Diagnose and fix all possible causes.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Describe the PVC for the exact error
kubectl describe pvc app-pvc

# Step 2 — Check if the StorageClass exists
kubectl get storageclass premium-ssd
# If not found → StorageClass missing

# Fix A — Create the missing StorageClass
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: premium-ssd
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
EOF

# Step 3 — Check if provisioner is working (for dynamic provisioning)
kubectl get pods -n kube-system | grep provisioner
# If provisioner pod is not running → provisioner is broken

# Step 4 — If StorageClass uses no-provisioner, check for a matching static PV
kubectl get pv | grep premium-ssd
# If empty → no PV exists for this StorageClass

# Fix B — Create a matching PV
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: premium-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
  - ReadWriteOnce
  storageClassName: premium-ssd
  persistentVolumeReclaimPolicy: Delete
  hostPath:
    path: /mnt/premium
EOF

# Step 5 — Check for access mode mismatch
kubectl get pvc app-pvc -o jsonpath='{.spec.accessModes}'
kubectl get pv -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.accessModes}{"\n"}{end}'

# Step 6 — Check for capacity mismatch (PV smaller than PVC request)
kubectl get pvc app-pvc -o jsonpath='{.spec.resources.requests.storage}'
kubectl get pv premium-pv -o jsonpath='{.spec.capacity.storage}'

# Step 7 — Verify binding after fixes
kubectl get pvc app-pvc --watch
# Should transition: Pending → Bound
```

Troubleshooting decision tree:

```
PVC Pending
├── StorageClass not found → Create the StorageClass
├── StorageClass has no-provisioner
│   ├── No matching PV → Create PV with matching storageClassName + accessModes + capacity
│   ├── Access mode mismatch → Fix PV or PVC accessModes
│   └── PV too small → Create larger PV
├── StorageClass has dynamic provisioner
│   ├── Provisioner pod not running → Fix provisioner deployment
│   └── bindingMode: WaitForFirstConsumer → Normal: PV created when pod is scheduled
└── Multiple issues → Fix in order: StorageClass → PV → access modes → capacity
```

> **Key Concept:** Always start with `kubectl describe pvc` — the Events section gives the exact reason. The two most common causes are: (1) the StorageClass doesn't exist (typo in the name), and (2) no matching PV exists for a `no-provisioner` StorageClass. With `WaitForFirstConsumer`, the PVC stays `Pending` until a pod requests it — this is **normal** and not an error.

</details>

---

### Question 7 — WaitForFirstConsumer Binding Mode
> ⏱️ **Recommended Time: 9 minutes**

Explain the difference between `Immediate` and `WaitForFirstConsumer` volume binding modes. Create a StorageClass with `WaitForFirstConsumer`, create a PVC, and demonstrate that it only binds when a pod is scheduled.

<details>
<summary>✅ Answer</summary>

```yaml
# StorageClass with WaitForFirstConsumer
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: topology-aware
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer    # KEY
reclaimPolicy: Delete
allowVolumeExpansion: true
```

```yaml
# PVC using the StorageClass
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: topology-pvc
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: topology-aware
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f topology-sc.yaml
kubectl apply -f topology-pvc.yaml

# PVC stays Pending — this is EXPECTED with WaitForFirstConsumer
kubectl get pvc topology-pvc
# STATUS: Pending   ← normal, waiting for a pod

# Create a matching PV (for no-provisioner StorageClass)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: topology-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  storageClassName: topology-aware
  persistentVolumeReclaimPolicy: Delete
  hostPath:
    path: /mnt/topology
EOF

# PVC still Pending — waiting for first consumer (pod)
kubectl get pvc topology-pvc

# Now create a pod that uses the PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: consumer-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: topology-pvc
EOF

# Once the pod is scheduled, the PVC binds
kubectl get pvc topology-pvc --watch
# Pending → Bound  (happens when pod is scheduled to a node)
```

Binding mode comparison:

| | `Immediate` | `WaitForFirstConsumer` |
|--|-------------|------------------------|
| PV provisioned | As soon as PVC is created | When a pod using the PVC is scheduled |
| Topology awareness | ❌ No | ✅ Yes — PV created in the same zone as the pod |
| PVC status before pod | `Bound` | `Pending` |
| Use case | Single-zone clusters, hostPath | Multi-zone clusters, local storage |
| Risk with Immediate | PV may be in wrong zone | None — always co-located |

> **Key Concept:** `WaitForFirstConsumer` solves a topology problem: with `Immediate`, a PV might be provisioned in `zone-a` while the pod gets scheduled in `zone-b` — causing the pod to fail. With `WaitForFirstConsumer`, the scheduler picks the node first, then the PV is provisioned in the same zone. This is the **recommended mode for local storage** (e.g., `local` volumes) and multi-zone cloud clusters.

</details>

---

## 📌 Quick Reference

### StorageClass Fields

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: example
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"  # make default
provisioner: <provisioner-name>       # who creates the PV
reclaimPolicy: Delete                 # Delete | Retain
volumeBindingMode: Immediate          # Immediate | WaitForFirstConsumer
allowVolumeExpansion: true            # allow PVC resize
parameters: {}                        # provisioner-specific settings
```

### Common Provisioners

| Provisioner | Platform |
|-------------|---------|
| `kubernetes.io/no-provisioner` | Static/manual (any) |
| `kubernetes.io/aws-ebs` | AWS (in-tree, deprecated) |
| `ebs.csi.aws.com` | AWS (CSI) |
| `pd.csi.storage.gke.io` | GKE (CSI) |
| `disk.csi.azure.com` | AKS (CSI) |
| `k8s.io/minikube-hostpath` | Minikube |
| `rancher.io/local-path` | Rancher/k3s |

### Volume Binding Mode Decision

```
Multi-zone cluster or local storage?
  YES → WaitForFirstConsumer
  NO  → Immediate (simpler, fine for single-zone)
```

### Useful Commands

```bash
# List StorageClasses
kubectl get sc

# Describe a StorageClass
kubectl describe sc <name>

# Set as default
kubectl patch sc <name> --type merge \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Remove default
kubectl patch sc <name> --type merge \
  -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'

# Check which SC a PVC uses
kubectl get pvc <name> -o jsonpath='{.spec.storageClassName}'
```

### Related Topics

- 🔗 [Persistent Volumes](./persistent-volumes.md) — PV/PVC lifecycle, reclaim policies, static provisioning
- 🔗 [StatefulSets](../workloads/deployment-strategies.md) — `volumeClaimTemplates` use StorageClasses for per-pod PVCs
