# 🗃️ etcd Backup & Restore

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** etcd Backup and Restore using etcdctl  
> **Total Questions:** 7

---

## ⏱️ Time Guide

| Difficulty | Recommended Time |
|------------|-----------------|
| 🟢 Easy    | 4–6 minutes     |
| 🟡 Medium  | 8–10 minutes    |
| 🔴 Hard    | 12–15 minutes   |

---

> ℹ️ **Scope Note:** On the CKA exam, etcd runs as a static pod on the control plane node (stacked topology). All `etcdctl` commands must be run with TLS certificates. The certificates are found at `/etc/kubernetes/pki/etcd/`. Always set `ETCDCTL_API=3` before running any `etcdctl` command.

---

## 🟢 Easy Questions

---

### Question 1 — Check etcd Health and Member List
> ⏱️ **Recommended Time: 4 minutes**

Check the health of the etcd cluster and list all etcd members.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Find etcd connection details from the static pod manifest
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "listen-client|cert-file|key-file|trusted-ca"

# Key values to note:
# --listen-client-urls=https://127.0.0.1:2379
# --cert-file=/etc/kubernetes/pki/etcd/server.crt
# --key-file=/etc/kubernetes/pki/etcd/server.key
# --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt

# Step 2 — Set the API version (always required for etcdctl v3)
export ETCDCTL_API=3

# Step 3 — Check etcd health
etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Expected output:
# https://127.0.0.1:2379 is healthy: successfully committed proposal

# Step 4 — List etcd members
etcdctl member list \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Output:
# <id>, started, controlplane, https://127.0.0.1:2380, https://127.0.0.1:2379, false
```

Shortcut — read all etcd flags at once:

```bash
kubectl describe pod etcd-controlplane -n kube-system | grep -E "cacert|cert|key|endpoints|data-dir"
```

> **Key Concept:** etcd is the **cluster's source of truth** — it stores all Kubernetes objects (pods, secrets, configmaps, etc.). It runs on port `2379` for client traffic and `2380` for peer traffic. All `etcdctl` commands require three TLS flags: `--cacert`, `--cert`, and `--key`. These certificates are always in `/etc/kubernetes/pki/etcd/` on a kubeadm cluster.

</details>

---

### Question 2 — Take an etcd Snapshot
> ⏱️ **Recommended Time: 5 minutes**

Take a snapshot of the etcd database and save it to `/opt/etcd-backup.db`.

<details>
<summary>✅ Answer</summary>

```bash
export ETCDCTL_API=3

etcdctl snapshot save /opt/etcd-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Expected output:
# Snapshot saved at /opt/etcd-backup.db

# Verify the file was created
ls -lh /opt/etcd-backup.db
```

> **Key Concept:** `etcdctl snapshot save` creates a **point-in-time** copy of the entire etcd database. This snapshot contains all Kubernetes objects at the moment of the backup — all namespaces, pods, services, secrets, configmaps, RBAC resources, etc. The backup is a single file and is portable. Always verify the file exists and has a non-zero size after saving.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Verify a Snapshot
> ⏱️ **Recommended Time: 5 minutes**

Verify the integrity and contents of the snapshot at `/opt/etcd-backup.db`.

<details>
<summary>✅ Answer</summary>

```bash
export ETCDCTL_API=3

# Check snapshot status — shows size, revision, total keys
etcdctl snapshot status /opt/etcd-backup.db \
  --write-out=table

# Expected output:
# +----------+----------+------------+------------+
# |   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
# +----------+----------+------------+------------+
# | a1b2c3d4 |    12345 |       1200 |     5.2 MB |
# +----------+----------+------------+------------+

# Check without --write-out=table (CSV format)
etcdctl snapshot status /opt/etcd-backup.db
# a1b2c3d4, 12345, 1200, 5.2 MB

# Verify the file is not empty or corrupted
file /opt/etcd-backup.db
# /opt/etcd-backup.db: data
```

> **Key Concept:** `etcdctl snapshot status` verifies the snapshot file is valid and shows: the hash (integrity check), the revision (etcd version at backup time), total keys stored, and total size. A valid snapshot will have `TOTAL KEYS > 0`. If the file is corrupted or truncated, this command will return an error.

</details>

---

### Question 4 — Restore an etcd Snapshot to a New Data Directory
> ⏱️ **Recommended Time: 8 minutes**

Restore the snapshot at `/opt/etcd-backup.db` to a new data directory at `/var/lib/etcd-restored`.

<details>
<summary>✅ Answer</summary>

```bash
export ETCDCTL_API=3

# Restore the snapshot to a new directory
etcdctl snapshot restore /opt/etcd-backup.db \
  --data-dir=/var/lib/etcd-restored

# Expected output:
# {"level":"info","msg":"restored snapshot","path":"/opt/etcd-backup.db","wal-dir":"/var/lib/etcd-restored/member/wal"}

# Verify the restored data directory was created
ls -la /var/lib/etcd-restored/
# member/
#   ├── snap/
#   └── wal/
```

> **Key Concept:** `etcdctl snapshot restore` creates a **new etcd data directory** from the snapshot — it does NOT restart etcd or affect the running cluster. The restore is a local filesystem operation. After restoring, you must **point etcd to the new data directory** by updating the static pod manifest (covered in Q5). The original data directory remains untouched until you explicitly replace it.

</details>

---

### Question 5 — Update the etcd Static Pod to Use the Restored Data Directory
> ⏱️ **Recommended Time: 10 minutes**

After restoring to `/var/lib/etcd-restored`, update the etcd static pod to use the new data directory so the cluster uses the restored data.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check the current etcd data directory
grep "data-dir" /etc/kubernetes/manifests/etcd.yaml
# --data-dir=/var/lib/etcd

# Step 2 — Edit the etcd static pod manifest
# There are TWO places to update:
# 1. The --data-dir flag in the command
# 2. The hostPath volume mount that maps the data directory

vi /etc/kubernetes/manifests/etcd.yaml
```

Find and update these two sections:

```yaml
# BEFORE:
spec:
  containers:
  - command:
    - etcd
    - --data-dir=/var/lib/etcd          # ← change this
    ...
    volumeMounts:
    - mountPath: /var/lib/etcd          # ← change this
      name: etcd-data
  volumes:
  - hostPath:
      path: /var/lib/etcd               # ← change this
      type: DirectoryOrCreate
    name: etcd-data

# AFTER:
spec:
  containers:
  - command:
    - etcd
    - --data-dir=/var/lib/etcd-restored  # ← updated
    ...
    volumeMounts:
    - mountPath: /var/lib/etcd-restored  # ← updated
      name: etcd-data
  volumes:
  - hostPath:
      path: /var/lib/etcd-restored       # ← updated
      type: DirectoryOrCreate
    name: etcd-data
```

```bash
# Step 3 — kubelet detects the manifest change and restarts the etcd pod automatically
# Wait for etcd to restart (may take 1-2 minutes)
watch kubectl get pods -n kube-system | grep etcd

# Step 4 — Verify etcd is running with the new data directory
kubectl get pods -n kube-system | grep etcd
# etcd-controlplane   1/1   Running

# Step 5 — Verify the cluster is using restored data
kubectl get nodes
kubectl get pods -A
```

If the API server becomes temporarily unavailable during the etcd restart:

```bash
# Check etcd container directly
crictl ps | grep etcd
crictl logs <etcd-container-id>

# Check kubelet logs
journalctl -xeu kubelet | tail -30
```

> **Key Concept:** The etcd static pod manifest has **three places** where the data directory appears: `--data-dir` flag, `volumeMounts[].mountPath`, and `volumes[].hostPath.path`. All three must be updated consistently. kubelet watches `/etc/kubernetes/manifests/` and automatically restarts the etcd pod when the file changes — no manual restart needed.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Full Backup → Simulate Data Loss → Restore → Verify
> ⏱️ **Recommended Time: 15 minutes**

Perform a full etcd backup/restore drill:
1. Take a snapshot of the current cluster state
2. Create a new namespace `test-restore` with a ConfigMap `important-data`
3. Simulate data loss by... well, we'll restore to the point before the namespace was created
4. Restore the snapshot
5. Verify `test-restore` namespace is gone (confirming the restore worked)

<details>
<summary>✅ Answer</summary>

```bash
# ═══════════════════════════════════════
# STEP 1: Take a snapshot (BEFORE creating test resources)
# ═══════════════════════════════════════

export ETCDCTL_API=3

etcdctl snapshot save /opt/pre-test-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

etcdctl snapshot status /opt/pre-test-backup.db --write-out=table
# Verify: TOTAL KEYS > 0

# ═══════════════════════════════════════
# STEP 2: Create resources AFTER the backup
# ═══════════════════════════════════════

kubectl create namespace test-restore
kubectl create configmap important-data \
  --from-literal=key=value \
  -n test-restore

# Confirm resources exist
kubectl get namespace test-restore
kubectl get configmap important-data -n test-restore

# ═══════════════════════════════════════
# STEP 3: Restore the snapshot (to before Step 2)
# ═══════════════════════════════════════

# Restore to a new data directory
etcdctl snapshot restore /opt/pre-test-backup.db \
  --data-dir=/var/lib/etcd-from-backup

# ═══════════════════════════════════════
# STEP 4: Update etcd static pod manifest
# ═══════════════════════════════════════

# Edit /etc/kubernetes/manifests/etcd.yaml
# Update ALL THREE occurrences of the data directory:
sed -i 's|/var/lib/etcd|/var/lib/etcd-from-backup|g' \
  /etc/kubernetes/manifests/etcd.yaml

# Verify the changes
grep "etcd-from-backup" /etc/kubernetes/manifests/etcd.yaml
# Should appear 3 times

# ═══════════════════════════════════════
# STEP 5: Wait for etcd and API server to recover
# ═══════════════════════════════════════

# Monitor etcd pod restart
watch crictl ps | grep etcd

# Wait for API server to become available (may take 1-3 minutes)
kubectl get nodes
# If connection refused, wait and retry

# ═══════════════════════════════════════
# STEP 6: Verify restore worked
# ═══════════════════════════════════════

# The test-restore namespace created AFTER the backup should be GONE
kubectl get namespace test-restore
# Error from server (NotFound): namespaces "test-restore" not found  ✅

# The cluster should be otherwise healthy
kubectl get nodes
kubectl get pods -A | grep -v Running | grep -v Completed
```

> **Key Concept:** This drill proves that etcd backup/restore works. Resources created **after** the snapshot are lost after the restore — this is exactly what you want when recovering from data corruption or accidental deletion. The restore process is: (1) snapshot save, (2) snapshot restore to new directory, (3) update static pod manifest, (4) wait for etcd to restart, (5) verify. Steps 3 and 4 are the most error-prone in the exam.

</details>

---

### Question 7 — Stacked vs External etcd Topology
> ⏱️ **Recommended Time: 12 minutes**

Explain the difference between stacked and external etcd topologies. Identify which topology the current cluster uses and perform a backup accordingly.

<details>
<summary>✅ Answer</summary>

```bash
# ═══════════════════════════════════════
# Identify the topology
# ═══════════════════════════════════════

# Check if etcd is running as a static pod (stacked topology)
kubectl get pods -n kube-system | grep etcd
# etcd-controlplane   1/1   Running  → STACKED (etcd on same node as control plane)

# Check if etcd is external (separate hosts)
grep "etcd" /etc/kubernetes/manifests/kube-apiserver.yaml | grep "etcd-servers"
# --etcd-servers=https://127.0.0.1:2379   → STACKED (localhost)
# --etcd-servers=https://10.0.0.50:2379   → EXTERNAL (different IP)

# For stacked etcd: certificates are in /etc/kubernetes/pki/etcd/
ls /etc/kubernetes/pki/etcd/
# ca.crt  ca.key  healthcheck-client.crt  healthcheck-client.key
# peer.crt  peer.key  server.crt  server.key

# ═══════════════════════════════════════
# Backup: Stacked etcd (kubeadm default)
# ═══════════════════════════════════════

export ETCDCTL_API=3

# Run etcdctl directly on the control plane node
etcdctl snapshot save /opt/stacked-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# ═══════════════════════════════════════
# Backup: External etcd (separate etcd hosts)
# ═══════════════════════════════════════

# Step 1 — Find the external etcd endpoint
grep "etcd-servers" /etc/kubernetes/manifests/kube-apiserver.yaml
# --etcd-servers=https://10.0.0.50:2379

# Step 2 — Find the etcd client certificates used by the API server
grep -A 3 "etcd-cert\|etcd-key\|etcd-cafile" /etc/kubernetes/manifests/kube-apiserver.yaml
# --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
# --etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt
# --etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key

# Step 3 — SSH to the external etcd node and take the backup
ssh etcd-node-01

export ETCDCTL_API=3
etcdctl snapshot save /opt/external-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/etcd/pki/ca.crt \          # certificates on the etcd node
  --cert=/etc/etcd/pki/server.crt \
  --key=/etc/etcd/pki/server.key

# OR from the control plane using the API server client certs:
etcdctl snapshot save /opt/external-backup.db \
  --endpoints=https://10.0.0.50:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \
  --key=/etc/kubernetes/pki/apiserver-etcd-client.key
```

Topology comparison:

| | Stacked etcd | External etcd |
|--|-------------|---------------|
| etcd runs on | Control plane node | Separate dedicated nodes |
| Risk | Control plane failure = etcd failure | Isolated — etcd failure ≠ control plane failure |
| CKA exam | ✅ Default (kubeadm) | Rarely tested |
| Certificates | `/etc/kubernetes/pki/etcd/` | Varies by setup |
| `--etcd-servers` | `https://127.0.0.1:2379` | Remote IP |
| Backup location | Run on control plane | Run on etcd nodes |
| HA setup | Needs multiple control plane nodes | Dedicated etcd cluster (3 or 5 nodes) |

> **Key Concept:** The CKA exam almost always uses **stacked etcd** (kubeadm default). The key to identifying it is: (1) `etcd-controlplane` pod exists in `kube-system`, and (2) `--etcd-servers=https://127.0.0.1:2379` in the apiserver manifest. For external etcd, the certificates used are the **API server's etcd client certificates** (`apiserver-etcd-client.crt/key`), not the etcd server certificates.

</details>

---

## 📌 Quick Reference

### etcdctl Command Template

```bash
export ETCDCTL_API=3

etcdctl <command> \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

### Backup & Restore Commands

```bash
# Save snapshot
etcdctl snapshot save <path> [tls flags]

# Verify snapshot
etcdctl snapshot status <path> --write-out=table

# Restore snapshot
etcdctl snapshot restore <path> --data-dir=<new-dir>
```

### etcd Certificate Locations (kubeadm)

```
/etc/kubernetes/pki/etcd/
├── ca.crt          ← --cacert
├── ca.key
├── server.crt      ← --cert
├── server.key      ← --key
├── peer.crt
├── peer.key
├── healthcheck-client.crt
└── healthcheck-client.key
```

### Three Places to Update in etcd Manifest

```yaml
# /etc/kubernetes/manifests/etcd.yaml
spec:
  containers:
  - command:
    - --data-dir=/var/lib/etcd          # 1. command flag
    volumeMounts:
    - mountPath: /var/lib/etcd          # 2. container mount path
      name: etcd-data
  volumes:
  - hostPath:
      path: /var/lib/etcd               # 3. host path
    name: etcd-data
```

### Full Restore Sequence

```
1. etcdctl snapshot save /opt/backup.db  [tls flags]
2. etcdctl snapshot restore /opt/backup.db --data-dir=/var/lib/etcd-new
3. Edit /etc/kubernetes/manifests/etcd.yaml — update data-dir in 3 places
4. Wait for etcd pod to restart (kubelet detects manifest change)
5. Wait for API server to reconnect to etcd
6. kubectl get nodes  ← verify cluster is healthy
```

### Useful Commands

```bash
# Check etcd pod
kubectl get pod etcd-controlplane -n kube-system
kubectl describe pod etcd-controlplane -n kube-system

# Get etcd flags
grep -E "data-dir|cert|endpoints" /etc/kubernetes/manifests/etcd.yaml

# Check etcd health
etcdctl endpoint health [tls flags]

# List etcd members
etcdctl member list [tls flags]

# Monitor etcd restart after manifest change
watch crictl ps | grep etcd
journalctl -xeu kubelet | tail -20
```

### Related Topics

- 🔗 [kubeadm Cluster Upgrade](./kubeadm-cluster-upgrade.md) — always back up etcd before upgrading
- 🔗 [Static Pods](../scheduling/static-pods.md) — etcd runs as a static pod; kubelet manages it via `/etc/kubernetes/manifests/`
- 🔗 [Encrypting Secrets at Rest](./encrypting-secrets-at-rest.md) — etcd stores all secrets; encryption protects them at the storage layer
