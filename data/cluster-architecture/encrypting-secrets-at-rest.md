# 🔒 Encrypting Secrets at Rest

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Encrypting Secrets at Rest  
> **Total Questions:** 6

---

## ⏱️ Time Guide

| Difficulty | Recommended Time |
|------------|-----------------|
| 🟢 Easy    | 4–6 minutes     |
| 🟡 Medium  | 8–10 minutes    |
| 🔴 Hard    | 10–12 minutes   |

---

## 🟢 Easy Questions

---

### Question 1 — Verify Whether Secrets Are Currently Encrypted at Rest
> ⏱️ **Recommended Time: 5 minutes**

Check whether Secrets are currently encrypted at rest in the cluster by inspecting the kube-apiserver configuration and reading a Secret's raw value from etcd.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check if an EncryptionConfiguration is referenced by kube-apiserver
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep encryption

# If the flag is absent, Secrets are NOT encrypted at rest.
# If present, it looks like:
# --encryption-provider-config=/etc/kubernetes/encryption/encryption-config.yaml

# 2. Read a Secret's raw value directly from etcd to confirm
# First, find an existing secret
kubectl get secrets -A | head -5

# Read the raw etcd entry (requires etcdctl with certs)
ETCDCTL_API=3 etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/<secret-name> | hexdump -C | head -20

# If NOT encrypted: output starts with "/registry/secrets/..." and value is readable
# If encrypted with aescbc: output starts with "k8s:enc:aescbc:v1:..."
```

> **Key Concept:** By default, Secrets are stored **unencrypted** in etcd — only base64-encoded. Anyone with direct etcd access can read all Secret values. Encryption at Rest configures the API server to encrypt Secret data using a provider (e.g., `aescbc`, `aesgcm`) before writing to etcd. The `k8s:enc:aescbc:v1:` prefix in the etcd value confirms encryption is active.

</details>

---

### Question 2 — Understand the EncryptionConfiguration Structure
> ⏱️ **Recommended Time: 4 minutes**

Write a valid `EncryptionConfiguration` manifest that encrypts Secrets using the `aescbc` provider with a 32-byte key, while keeping ConfigMaps unencrypted (identity provider).

<details>
<summary>✅ Answer</summary>

```bash
# Generate a random 32-byte base64-encoded key
head -c 32 /dev/urandom | base64
# Example output: dGhpcyBpcyBhIDMyIGJ5dGUgZW5jcnlwdGlvbiBrZXkhISE=
```

```yaml
# /etc/kubernetes/encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: dGhpcyBpcyBhIDMyIGJ5dGUgZW5jcnlwdGlvbiBrZXkhISE=
  - identity: {}        # fallback: allows reading unencrypted existing secrets

- resources:
  - configmaps
  providers:
  - identity: {}        # configmaps remain unencrypted
```

> **Key Concept:** The `providers` list is ordered — the **first provider is used for encryption** (writes), and all providers are tried in order for **decryption** (reads). Always include `identity: {}` as the last provider so that existing unencrypted Secrets can still be read after enabling encryption. Without it, old Secrets become unreadable until re-encrypted.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Enable Encryption at Rest for Secrets
> ⏱️ **Recommended Time: 10 minutes**

Enable encryption at rest for Secrets on the cluster. The control plane node runs a static pod for `kube-apiserver`. Use `aescbc` with a newly generated 32-byte key and store the configuration at `/etc/kubernetes/encryption/encryption-config.yaml`.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Generate a 32-byte base64 key
head -c 32 /dev/urandom | base64
# Save this value — you'll use it in the config below

# Step 2 — Create the encryption config directory and file
mkdir -p /etc/kubernetes/encryption

cat <<EOF > /etc/kubernetes/encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key1
        secret: <YOUR_BASE64_KEY_HERE>
  - identity: {}
EOF

# Step 3 — Edit the kube-apiserver static pod manifest
vi /etc/kubernetes/manifests/kube-apiserver.yaml
```

Add the following under `spec.containers[0].command`:

```yaml
- --encryption-provider-config=/etc/kubernetes/encryption/encryption-config.yaml
```

Add a `volumeMount` and `volume` so the apiserver can read the file:

```yaml
# Under containers[0].volumeMounts:
- name: encryption-config
  mountPath: /etc/kubernetes/encryption
  readOnly: true

# Under volumes:
- name: encryption-config
  hostPath:
    path: /etc/kubernetes/encryption
    type: DirectoryOrCreate
```

```bash
# Step 4 — Wait for kube-apiserver to restart (kubelet detects the manifest change)
watch kubectl get pods -n kube-system | grep apiserver

# Step 5 — Verify the flag is active
kubectl get pods -n kube-system kube-apiserver-<node> -o yaml | grep encryption
```

> **Key Concept:** The kube-apiserver is a static pod managed by the kubelet. Editing `/etc/kubernetes/manifests/kube-apiserver.yaml` causes the kubelet to automatically recreate it. The encryption config file must be accessible inside the apiserver container via a `hostPath` volume mount. After the apiserver restarts, **only newly written Secrets are encrypted** — existing Secrets must be re-encrypted separately.

</details>

---

### Question 4 — Re-encrypt All Existing Secrets
> ⏱️ **Recommended Time: 8 minutes**

After enabling encryption at rest, existing Secrets in the cluster are still stored unencrypted in etcd. Re-encrypt all existing Secrets across all namespaces so they are encrypted with the new key.

<details>
<summary>✅ Answer</summary>

```bash
# Force a re-write of all Secrets in every namespace
# kubectl replace reads the current value and writes it back — triggering encryption
kubectl get secrets -A -o json | \
  kubectl replace -f -

# Verify a specific secret is now encrypted in etcd
ETCDCTL_API=3 etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/<secret-name> | hexdump -C | head -5

# Encrypted output starts with: k8s:enc:aescbc:v1:key1:...
```

> **Key Concept:** Enabling encryption only affects **new writes**. To encrypt pre-existing Secrets, you must trigger a re-write by reading and replacing them. The `kubectl get | kubectl replace` pipeline is the standard approach. After re-encryption, remove the `identity: {}` provider from the encryption config and restart the apiserver to prevent any unencrypted reads.

</details>

---

## 🔴 Hard Questions

---

### Question 5 — Rotate the Encryption Key
> ⏱️ **Recommended Time: 12 minutes**

The current encryption key (`key1`) needs to be rotated. Generate a new key (`key2`) and perform a zero-downtime key rotation so all Secrets are re-encrypted with the new key, and the old key can be safely removed.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Generate a new 32-byte key
head -c 32 /dev/urandom | base64
# e.g.: aBcDeFgHiJkLmNoPqRsTuVwXyZ012345==
```

**Step 2 — Add `key2` as the new primary (first) provider, keep `key1` for decryption:**

```yaml
# /etc/kubernetes/encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key2                      # NEW key — used for all new writes
        secret: <NEW_BASE64_KEY>
      - name: key1                      # OLD key — still used for decryption
        secret: <OLD_BASE64_KEY>
  - identity: {}
```

```bash
# Step 3 — Restart kube-apiserver to load the new config
# (edit the manifest to trigger kubelet restart, or touch the file)
touch /etc/kubernetes/manifests/kube-apiserver.yaml
watch kubectl get pods -n kube-system | grep apiserver

# Step 4 — Re-encrypt all Secrets with the new key
kubectl get secrets -A -o json | kubectl replace -f -

# Step 5 — Remove key1 and identity from the config now that all Secrets use key2
```

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - aescbc:
      keys:
      - name: key2
        secret: <NEW_BASE64_KEY>
  # key1 and identity removed — old key no longer needed
```

```bash
# Step 6 — Restart kube-apiserver one more time
touch /etc/kubernetes/manifests/kube-apiserver.yaml

# Verify a secret is encrypted with the new key
ETCDCTL_API=3 etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/<secret-name> | strings | head -3
# Should show: k8s:enc:aescbc:v1:key2:...
```

> **Key Concept:** Key rotation is a 3-phase process: (1) add new key as primary while keeping old key for decryption, (2) re-encrypt all Secrets so they use the new key, (3) remove the old key. Skipping phase 2 before removing the old key will make all old Secrets unreadable. Always verify the etcd prefix (`k8s:enc:aescbc:v1:key2:...`) before removing the old key.

</details>

---

### Question 6 — Disable Encryption at Rest and Restore Plain Storage
> ⏱️ **Recommended Time: 10 minutes**

You need to disable encryption at rest for Secrets (e.g., before decommissioning the cluster or migrating to an external KMS). Ensure all Secrets are decrypted back to plain storage in etcd.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Move identity to the FIRST (primary) provider so new writes are unencrypted
# Keep aescbc as the second provider so existing encrypted Secrets can still be read
```

```yaml
# /etc/kubernetes/encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources:
  - secrets
  providers:
  - identity: {}         # NOW primary — new writes are unencrypted
  - aescbc:
      keys:
      - name: key1
        secret: <OLD_BASE64_KEY>   # still needed to decrypt existing Secrets
```

```bash
# Step 2 — Restart kube-apiserver
touch /etc/kubernetes/manifests/kube-apiserver.yaml
watch kubectl get pods -n kube-system | grep apiserver

# Step 3 — Re-write all Secrets so they are stored unencrypted
kubectl get secrets -A -o json | kubectl replace -f -

# Step 4 — Verify a Secret is no longer encrypted in etcd
ETCDCTL_API=3 etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/default/<secret-name> | strings | head -5
# Should NOT show "k8s:enc:aescbc" — plain text is visible

# Step 5 — Remove the --encryption-provider-config flag from kube-apiserver.yaml
# and restart again (or remove the file reference entirely)
```

> **Key Concept:** To disable encryption, move `identity: {}` to the top (primary) position first, then re-write all Secrets so they are stored in plain form. Only after verifying all Secrets are decrypted should you remove the `--encryption-provider-config` flag entirely. Removing the flag before re-writing leaves encrypted Secrets unreadable by the apiserver.

</details>

---

## 📌 Quick Reference

### Encryption Providers

| Provider | Key Size | Notes |
|----------|----------|-------|
| `aescbc` | 16, 24, or 32 bytes | Recommended; CBC mode with PKCS#7 padding |
| `aesgcm` | 16, 24, or 32 bytes | GCM mode; faster but keys should be rotated more frequently |
| `secretbox` | 32 bytes | XSalsa20 + Poly1305 |
| `kms` | N/A (envelope encryption) | Delegates to external KMS (e.g., AWS KMS, Vault) |
| `identity` | None | No encryption — stores plain base64 |

### Provider Order Rules

```
First provider  →  used for WRITES (encryption)
All providers   →  tried in order for READS (decryption)

Always include identity: {} last when enabling encryption
  → allows reading pre-existing unencrypted Secrets during transition
```

### Key Rotation Phases

```
Phase 1: Add new key first, keep old key second → restart apiserver
Phase 2: Re-write all secrets (kubectl get | kubectl replace)
Phase 3: Remove old key → restart apiserver
```

### Useful Commands

```bash
# Generate a 32-byte base64 key
head -c 32 /dev/urandom | base64

# Restart kube-apiserver (static pod)
touch /etc/kubernetes/manifests/kube-apiserver.yaml

# Re-encrypt all secrets across all namespaces
kubectl get secrets -A -o json | kubectl replace -f -

# Read raw etcd value to verify encryption
ETCDCTL_API=3 etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get /registry/secrets/<namespace>/<name> | hexdump -C | head -10

# Check if apiserver has encryption flag
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep encryption
```

### etcd Value Prefixes

```
/registry/secrets/...          → NOT encrypted (plain base64)
k8s:enc:aescbc:v1:key1:...    → Encrypted with aescbc key named key1
k8s:enc:aesgcm:v1:key1:...    → Encrypted with aesgcm key named key1
```

### Related Topics

- 🔗 [Secrets](../workloads/secrets.md) — base64 encoding vs actual encryption
- 🔗 [Admission Controllers](./admission-controllers.md) — control what can be created in the cluster
