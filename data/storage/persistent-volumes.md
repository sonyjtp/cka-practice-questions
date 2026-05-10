# 💾 Persistent Volumes & Persistent Volume Claims

> **CKA Exam Domain:** Storage  
> **Topic:** Persistent Volumes (PV) and Persistent Volume Claims (PVC)  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Create a PersistentVolume with hostPath
> ⏱️ **Recommended Time: 5 minutes**

Create a PersistentVolume named `pv-hostpath` with the following properties:

- Capacity: `1Gi`
- Access mode: `ReadWriteOnce`
- Reclaim policy: `Retain`
- Storage class: `manual`
- Host path: `/mnt/data`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-hostpath
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
```

```bash
kubectl apply -f pv-hostpath.yaml

# Verify
kubectl get pv pv-hostpath
# STATUS should be Available
kubectl describe pv pv-hostpath
```

> **Key Concept:** A PersistentVolume is a **cluster-scoped** resource (no namespace). `hostPath` binds storage to a specific node's filesystem — suitable for single-node clusters and labs but not for production multi-node clusters. The PV starts in `Available` status and transitions to `Bound` once a matching PVC claims it.

</details>

---

### Question 2 — Create a PVC and Bind It to a PV
> ⏱️ **Recommended Time: 5 minutes**

Create a PersistentVolumeClaim named `pvc-hostpath` in the `default` namespace that binds to the PV `pv-hostpath` created in Q1.

- Storage request: `500Mi`
- Access mode: `ReadWriteOnce`
- Storage class: `manual`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-hostpath
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 500Mi
```

```bash
kubectl apply -f pvc-hostpath.yaml

# Verify the PVC is Bound
kubectl get pvc pvc-hostpath
# STATUS should be Bound

# Verify the PV now shows Bound as well
kubectl get pv pv-hostpath
# STATUS: Bound, CLAIM: default/pvc-hostpath
```

Binding rules:
- PVC `storage request` ≤ PV `capacity`
- PVC `accessModes` must match PV `accessModes`
- PVC `storageClassName` must match PV `storageClassName`
- PV must be in `Available` status

> **Key Concept:** PVC binding is **automatic** when a matching PV exists. Kubernetes selects the smallest PV that satisfies the PVC request. The PVC is namespaced; the PV is cluster-scoped. Once bound, the PV is exclusively reserved for that PVC — no other PVC can claim it until it is released and reclaimed.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Mount a PVC into a Pod
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `pvc-pod` in the `default` namespace that mounts the PVC `pvc-hostpath` at `/data` inside a `busybox:1.28` container. The container should write the current date to `/data/output.txt` and then sleep.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pvc-pod
  namespace: default
spec:
  volumes:
  - name: storage
    persistentVolumeClaim:
      claimName: pvc-hostpath    # reference the PVC by name

  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "date > /data/output.txt && sleep 3600"]
    volumeMounts:
    - name: storage
      mountPath: /data
```

```bash
kubectl apply -f pvc-pod.yaml

# Verify pod is Running
kubectl get pod pvc-pod

# Verify data was written
kubectl exec pvc-pod -- cat /data/output.txt

# The file persists on the node at /mnt/data/output.txt
```

> **Key Concept:** Pods reference PVCs by name under `spec.volumes[].persistentVolumeClaim.claimName`. The PVC must be in the **same namespace** as the Pod. The data written to the mounted path persists beyond the Pod's lifecycle — if the Pod is deleted and recreated with the same PVC, the data is still there.

</details>

---

### Question 4 — PVC with Specific StorageClass and Access Mode
> ⏱️ **Recommended Time: 6 minutes**

Create a PVC named `db-pvc` in the `database` namespace with:

- Storage request: `2Gi`
- Access mode: `ReadWriteOnce`
- StorageClass: `fast-ssd`

Then create a Pod named `db-pod` in the same namespace that mounts the PVC at `/var/lib/postgresql`.

<details>
<summary>✅ Answer</summary>

```yaml
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-pvc
  namespace: database
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 2Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
  namespace: database
spec:
  volumes:
  - name: db-storage
    persistentVolumeClaim:
      claimName: db-pvc

  containers:
  - name: postgres
    image: busybox:1.28
    command: ["sleep", "3600"]
    volumeMounts:
    - name: db-storage
      mountPath: /var/lib/postgresql
```

```bash
kubectl apply -f db-pvc-pod.yaml

# Check PVC status
kubectl get pvc db-pvc -n database
# If fast-ssd StorageClass supports dynamic provisioning → Bound immediately
# If no matching PV and no dynamic provisioning → Pending

# Check pod status
kubectl get pod db-pod -n database
```

Access mode reference:

| Mode               | Short | Description                           |
|--------------------|-------|---------------------------------------|
| `ReadWriteOnce`    | RWO   | One node can mount read-write         |
| `ReadOnlyMany`     | ROX   | Many nodes can mount read-only        |
| `ReadWriteMany`    | RWX   | Many nodes can mount read-write       |
| `ReadWriteOncePod` | RWOP  | Only one pod cluster-wide (K8s 1.22+) |

> **Key Concept:** When a `storageClassName` refers to a StorageClass that has a **provisioner**, PVCs are dynamically provisioned — no pre-created PV is needed. The StorageClass provisioner creates a PV automatically when the PVC is created. This is the standard behaviour in cloud environments (GKE, EKS, AKS).

</details>

---

### Question 5 — Expand a PVC
> ⏱️ **Recommended Time: 7 minutes**

A PVC named `app-pvc` in the `default` namespace was created with `1Gi`. Expand it to `2Gi`. The StorageClass supports volume expansion.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify the StorageClass allows expansion
kubectl get storageclass $(kubectl get pvc app-pvc -o jsonpath='{.spec.storageClassName}') \
  -o jsonpath='{.allowVolumeExpansion}'
# Must return: true

# Step 2 — Check current PVC size
kubectl get pvc app-pvc

# Step 3 — Patch the PVC to request more storage
kubectl patch pvc app-pvc \
  --type merge \
  -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'

# OR edit directly
kubectl edit pvc app-pvc
# Change: storage: 1Gi → storage: 2Gi

# Step 4 — Monitor the resize
kubectl get pvc app-pvc --watch
# Conditions will show FileSystemResizePending then the size updates

# Step 5 — For some volume types, a pod restart is required to complete filesystem resize
kubectl delete pod <pod-using-pvc>
kubectl apply -f <pod-manifest>

# Verify final size
kubectl get pvc app-pvc
# CAPACITY should now show 2Gi
```

> **Key Concept:** PVC expansion requires `allowVolumeExpansion: true` on the StorageClass. You can only **increase** PVC size — shrinking is not supported. For some volume types (e.g., `ext4` on block devices), the filesystem resize completes only when the pod is restarted. Check the PVC `Conditions` field (`kubectl describe pvc`) for `FileSystemResizePending` — this means the resize is waiting for a pod restart.

</details>

---

### Question 6 — Troubleshoot a PVC Stuck in Pending
> ⏱️ **Recommended Time: 7 minutes**

A PVC named `stuck-pvc` in the `default` namespace is stuck in `Pending`. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Confirm the PVC is Pending
kubectl get pvc stuck-pvc

# Step 2 — Describe to find the reason
kubectl describe pvc stuck-pvc

# Look for events like:
# "no persistent volumes available for this claim and no storage class is set"
# "storageclass.storage.k8s.io "fast-ssd" not found"
# "did not find a suitable PersistentVolume for the claim"

# Step 3a — No StorageClass specified and no matching static PV
# Fix: Create a matching PV manually
kubectl get pv   # check available PVs and their properties

# Step 3b — StorageClass not found
kubectl get storageclass
# Fix: Create the StorageClass or correct the name in the PVC

# Step 3c — StorageClass exists but no matching PV (static provisioning)
# Fix: Create a PV with matching storageClassName, accessModes, and capacity >= PVC request

# Step 3d — StorageClass has no provisioner (and no matching PV)
# Fix: Create a PV manually with the correct storageClassName

# Step 4 — Example fix: create a matching PV
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: fix-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  storageClassName: manual
  hostPath:
    path: /mnt/fix-data
EOF

# Step 5 — Verify PVC binds
kubectl get pvc stuck-pvc
# STATUS should change from Pending → Bound
```

Common causes:

| Symptom in `describe`  | Root Cause                               | Fix                                     |
|------------------------|------------------------------------------|-----------------------------------------|
| No matching PV         | Static PV doesn't exist or doesn't match | Create a matching PV                    |
| StorageClass not found | Wrong `storageClassName`                 | Fix the name or create the StorageClass |
| No provisioner         | StorageClass has no dynamic provisioner  | Add a provisioner or create PV manually |
| Access mode mismatch   | PVC RWX but PV only supports RWO         | Align access modes                      |
| Capacity too small     | PV smaller than PVC request              | Create a larger PV                      |

> **Key Concept:** A PVC stays `Pending` whenever Kubernetes cannot find a suitable PV. The binding algorithm checks: storageClassName match → access mode compatibility → capacity (PV ≥ PVC request). All three must be satisfied. `kubectl describe pvc` always shows the exact reason in the Events section.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Reclaim Policy: Retain vs Delete and Manual Reclaim
> ⏱️ **Recommended Time: 9 minutes**

A PV named `pv-retain` has `persistentVolumeReclaimPolicy: Retain`. The PVC bound to it has been deleted. The PV is now in `Released` status. Manually reclaim the PV so it can be reused by a new PVC.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Confirm the PV is in Released status
kubectl get pv pv-retain
# STATUS: Released   CLAIM: default/old-pvc

# Step 2 — The PV cannot be rebound while it still references the old PVC
kubectl describe pv pv-retain | grep "Claim:"
# Claim: default/old-pvc   ← this claimRef must be removed

# Step 3 — Remove the claimRef to make the PV Available again
kubectl patch pv pv-retain \
  --type json \
  -p '[{"op":"remove","path":"/spec/claimRef"}]'

# Step 4 — Verify PV is now Available
kubectl get pv pv-retain
# STATUS: Available

# Step 5 — A new PVC can now bind to this PV
```

Reclaim policy comparison:

| Policy    | On PVC Delete                         | Data      | PV Status After                    |
|-----------|---------------------------------------|-----------|------------------------------------|
| `Retain`  | PV kept, data preserved               | ✅ Safe    | `Released` (manual cleanup needed) |
| `Delete`  | PV and underlying storage deleted     | ❌ Deleted | PV gone                            |
| `Recycle` | *(Deprecated)* Basic scrub (`rm -rf`) | ❌ Deleted | `Available`                        |

```bash
# Change a PV's reclaim policy
kubectl patch pv pv-retain \
  --type merge \
  -p '{"spec":{"persistentVolumeReclaimPolicy":"Delete"}}'
```

> **Key Concept:** With `Retain`, deleting a PVC does NOT delete the PV or its data — the PV moves to `Released`. However, a `Released` PV cannot be automatically rebound because it still contains the `claimRef` pointing to the old PVC. You must manually remove `spec.claimRef` to return it to `Available`. This is a deliberate safety mechanism to prevent accidental data loss.

</details>

---

### Question 8 — StatefulSet with volumeClaimTemplates
> ⏱️ **Recommended Time: 10 minutes**

Create a StatefulSet named `mysql-ss` in the `default` namespace with:

- `3` replicas using `busybox:1.28`
- Each pod mounts a dedicated `1Gi` PVC at `/var/lib/mysql`
- PVCs should use StorageClass `standard` and access mode `ReadWriteOnce`
- PVCs should be named `mysql-data-mysql-ss-0`, `mysql-data-mysql-ss-1`, `mysql-data-mysql-ss-2` (auto-named by StatefulSet)

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
  namespace: default
spec:
  clusterIP: None
  selector:
    app: mysql
  ports:
  - port: 3306
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql-ss
  namespace: default
spec:
  serviceName: mysql-headless    # required: headless service for stable DNS
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: busybox:1.28
        command: ["sleep", "3600"]
        volumeMounts:
        - name: mysql-data
          mountPath: /var/lib/mysql

  volumeClaimTemplates:          # KEY: creates one PVC per pod automatically
  - metadata:
      name: mysql-data           # PVC names: mysql-data-mysql-ss-0/1/2
    spec:
      accessModes:
      - ReadWriteOnce
      storageClassName: standard
      resources:
        requests:
          storage: 1Gi
```

```bash
kubectl apply -f mysql-ss.yaml

# Pods are created sequentially: mysql-ss-0 → mysql-ss-1 → mysql-ss-2
kubectl get pods -l app=mysql --watch

# Verify PVCs were created automatically (one per pod)
kubectl get pvc
# mysql-data-mysql-ss-0   Bound   ...
# mysql-data-mysql-ss-1   Bound   ...
# mysql-data-mysql-ss-2   Bound   ...

# Each pod has its own exclusive PVC
kubectl exec mysql-ss-0 -- df -h /var/lib/mysql
```

> **Key Concept:** `volumeClaimTemplates` is unique to StatefulSets — it creates a **dedicated PVC per pod** using the naming convention `<template-name>-<statefulset-name>-<ordinal>`. Unlike Deployments (where all pods share the same PVC), each StatefulSet pod gets its own independent storage. These PVCs are **not deleted** when the StatefulSet is deleted — they must be cleaned up manually to preserve data safety.

</details>

---

