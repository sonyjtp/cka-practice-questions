# 🗂️ kubeconfig

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** kubeconfig structure, contexts, users, clusters, switching contexts  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** The default kubeconfig is at `~/.kube/config`. You can specify a different file with `--kubeconfig=<path>` or the `KUBECONFIG` environment variable. On the CKA exam, you frequently switch between clusters using contexts.

---

## 🟢 Easy Questions

---

### Question 1 — Inspect the kubeconfig File
> ⏱️ **Recommended Time: 4 minutes**

View and understand the structure of the current kubeconfig file.

<details>
<summary>✅ Answer</summary>

```bash
# View the current kubeconfig
kubectl config view

# View the raw kubeconfig (with credentials, not redacted)
kubectl config view --raw

# View the actual file
cat ~/.kube/config
```

kubeconfig structure:

```yaml
apiVersion: v1
kind: Config
current-context: dev-cluster          # active context

clusters:                             # cluster endpoints and CA certs
- name: dev-cluster
  cluster:
    server: https://192.168.1.10:6443
    certificate-authority-data: <base64-ca-cert>

users:                                # user credentials
- name: alice
  user:
    client-certificate-data: <base64-cert>
    client-key-data: <base64-key>

contexts:                             # links a cluster + user + (optional) namespace
- name: dev-cluster
  context:
    cluster: dev-cluster
    user: alice
    namespace: development
```

```bash
# List all contexts
kubectl config get-contexts

# Show current context
kubectl config current-context

# List all clusters
kubectl config get-clusters

# List all users
kubectl config get-users
```

> **Key Concept:** A kubeconfig has three sections: **clusters** (API server addresses + CA certs), **users** (credentials — certs, tokens, or auth providers), and **contexts** (a named combination of cluster + user + optional namespace). The `current-context` determines which cluster and user `kubectl` uses by default.

</details>

---

### Question 2 — Switch Between Contexts
> ⏱️ **Recommended Time: 4 minutes**

List all available contexts and switch to a context named `prod-cluster`.

<details>
<summary>✅ Answer</summary>

```bash
# List all contexts (current context marked with *)
kubectl config get-contexts
# CURRENT   NAME           CLUSTER        AUTHINFO   NAMESPACE
# *         dev-cluster    dev-cluster    alice      development
#           prod-cluster   prod-cluster   bob        production
#           staging        staging        carol

# Switch to prod-cluster
kubectl config use-context prod-cluster

# Verify
kubectl config current-context
# prod-cluster

# Run a command in a specific context without switching
kubectl get nodes --context=staging

# Switch back
kubectl config use-context dev-cluster
```

> **Key Concept:** `kubectl config use-context` updates the `current-context` field in `~/.kube/config`. This is the primary way to switch between clusters on the CKA exam — you'll be asked to work on specific clusters by switching contexts. Always verify your current context before running commands that modify cluster state.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Add a New Cluster and User to kubeconfig
> ⏱️ **Recommended Time: 7 minutes**

Add a new cluster `test-cluster` (API server: `https://10.0.0.100:6443`) and user `test-admin` (using cert files) to the kubeconfig. Then create a context linking them.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Add the cluster entry
kubectl config set-cluster test-cluster \
  --server=https://10.0.0.100:6443 \
  --certificate-authority=/path/to/ca.crt \
  --embed-certs=true

# OR without embedding (references the file path instead)
kubectl config set-cluster test-cluster \
  --server=https://10.0.0.100:6443 \
  --certificate-authority=/path/to/ca.crt

# Step 2 — Add the user credentials
kubectl config set-credentials test-admin \
  --client-certificate=/path/to/test-admin.crt \
  --client-key=/path/to/test-admin.key \
  --embed-certs=true

# Step 3 — Create a context linking cluster + user + namespace
kubectl config set-context test-context \
  --cluster=test-cluster \
  --user=test-admin \
  --namespace=default

# Step 4 — Switch to the new context
kubectl config use-context test-context

# Verify
kubectl config get-contexts
kubectl get nodes    # connects to test-cluster as test-admin
```

> **Key Concept:** `--embed-certs=true` base64-encodes the certificate files and stores them inline in the kubeconfig — this makes the kubeconfig self-contained and portable. Without it, the kubeconfig stores file paths, which break if the kubeconfig is moved. On the CKA exam, always use `--embed-certs=true` when adding credentials to ensure they work regardless of file locations.

</details>

---

### Question 4 — Set a Default Namespace for a Context
> ⏱️ **Recommended Time: 6 minutes**

Set the default namespace for the `dev-cluster` context to `development` so that all commands run in that context default to the `development` namespace.

<details>
<summary>✅ Answer</summary>

```bash
# Set default namespace for an existing context
kubectl config set-context dev-cluster \
  --namespace=development

# Verify
kubectl config get-contexts dev-cluster
# CURRENT   NAME         CLUSTER      AUTHINFO   NAMESPACE
# *         dev-cluster  dev-cluster  alice      development  ← set

# Now kubectl commands default to the development namespace
kubectl get pods     # lists pods in development namespace
kubectl get pods -n default    # still works with explicit -n

# Check which namespace you're currently in
kubectl config view --minify | grep namespace
# namespace: development
```

> **Key Concept:** Setting a default namespace in a context avoids having to type `-n <namespace>` repeatedly. `--minify` in `kubectl config view --minify` shows only the active context's config — useful for quickly checking current cluster, user, and namespace without the full kubeconfig output.

</details>

---

### Question 5 — Use Multiple kubeconfig Files
> ⏱️ **Recommended Time: 7 minutes**

You have two kubeconfig files: `~/.kube/config` (dev) and `/tmp/prod-config` (prod). Merge them temporarily and work with both clusters.

<details>
<summary>✅ Answer</summary>

```bash
# Method 1 — Use KUBECONFIG env var to merge multiple files temporarily
export KUBECONFIG=~/.kube/config:/tmp/prod-config

# Now kubectl sees contexts from both files
kubectl config get-contexts
# Shows contexts from both kubeconfig files

# Switch between them normally
kubectl config use-context dev-cluster
kubectl config use-context prod-cluster

# Unset to go back to default
unset KUBECONFIG

# Method 2 — Use --kubeconfig flag for one-off commands
kubectl get nodes --kubeconfig=/tmp/prod-config

# Method 3 — Permanently merge into a single file
KUBECONFIG=~/.kube/config:/tmp/prod-config \
  kubectl config view --flatten > /tmp/merged-config

mv ~/.kube/config ~/.kube/config.bak
mv /tmp/merged-config ~/.kube/config

# Verify merged file
kubectl config get-contexts
```

> **Key Concept:** `KUBECONFIG` accepts a colon-separated list of kubeconfig files — kubectl merges them in memory. This is the cleanest way to work with multiple clusters without modifying your primary kubeconfig. `kubectl config view --flatten` produces a single merged kubeconfig with all certs embedded, suitable for permanent merging.

</details>

---

### Question 6 — Create a kubeconfig for a New User from Scratch
> ⏱️ **Recommended Time: 9 minutes**

User `alice` has been issued a certificate (`alice.crt`, `alice.key`) signed by the cluster CA. Create a complete kubeconfig file for her to access the `prod-cluster` at `https://192.168.1.20:6443`.

<details>
<summary>✅ Answer</summary>

```bash
# Prerequisites: alice.crt, alice.key already exist (see tls-certificates.md)

# Step 1 — Create a new kubeconfig file for alice
KUBECONFIG=/tmp/alice-config kubectl config set-cluster prod-cluster \
  --server=https://192.168.1.20:6443 \
  --certificate-authority=/etc/kubernetes/pki/ca.crt \
  --embed-certs=true

# Step 2 — Add alice's credentials
KUBECONFIG=/tmp/alice-config kubectl config set-credentials alice \
  --client-certificate=alice.crt \
  --client-key=alice.key \
  --embed-certs=true

# Step 3 — Create a context
KUBECONFIG=/tmp/alice-config kubectl config set-context alice@prod-cluster \
  --cluster=prod-cluster \
  --user=alice \
  --namespace=default

# Step 4 — Set the default context
KUBECONFIG=/tmp/alice-config kubectl config use-context alice@prod-cluster

# Step 5 — Verify the kubeconfig
KUBECONFIG=/tmp/alice-config kubectl config view

# Step 6 — Test connectivity (alice needs RBAC permissions to do anything)
KUBECONFIG=/tmp/alice-config kubectl get pods
# Error from server (Forbidden): alice has no permissions yet → certs work ✅
# If "Unable to connect" → server/CA issue

# Distribute /tmp/alice-config to alice
# She places it at ~/.kube/config or uses KUBECONFIG=/tmp/alice-config
```

> **Key Concept:** A kubeconfig is the complete package a user needs: cluster endpoint, CA cert (to trust the API server), and user credentials (to prove identity). The CA cert goes in `clusters[].cluster.certificate-authority-data`; user certs go in `users[].user.client-certificate-data` and `client-key-data`. All are base64-encoded when using `--embed-certs=true`.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Troubleshoot kubeconfig Issues
> ⏱️ **Recommended Time: 9 minutes**

`kubectl get nodes` returns an error. Diagnose and fix kubeconfig-related issues.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Run with verbose output to see what kubeconfig is being used
kubectl get nodes -v=6 2>&1 | head -20
# Shows: Config loaded from file: /root/.kube/config
# Shows: GET https://192.168.1.10:6443/api/v1/nodes

# Common errors and diagnosis:

# Error: "no configuration has been provided"
kubectl config view
# kubeconfig file is empty or KUBECONFIG points to wrong file
# Fix: copy correct kubeconfig
cp /etc/kubernetes/admin.conf ~/.kube/config

# Error: "unable to connect to the server: dial tcp ... connection refused"
kubectl config view | grep server
# server: https://192.168.1.10:6443
# Fix A: check if the IP/port is correct
# Fix B: check if API server is running
kubectl get pods -n kube-system --kubeconfig=/etc/kubernetes/admin.conf

# Error: "x509: certificate signed by unknown authority"
kubectl config view --raw | grep certificate-authority-data | head -1
# Decode and inspect:
kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' \
  | base64 -d | openssl x509 -text -noout | grep "Subject:"
# Fix: update the CA cert in kubeconfig to match the actual cluster CA

# Error: "User "alice" cannot list resource"
# → kubeconfig is correct but alice lacks RBAC permissions
# Fix: create RoleBinding for alice (see rbac.md)

# Error: "current context not set"
kubectl config current-context
# error: current-context is not set
kubectl config use-context <context-name>

# Error: context references non-existent cluster/user
kubectl config get-contexts
kubectl config get-clusters
kubectl config get-users
# Check all names match; fix typos with kubectl config set-context
```

Common kubeconfig issues:

| Error                                           | Cause                               | Fix                                     |
|-------------------------------------------------|-------------------------------------|-----------------------------------------|
| `no configuration provided`                     | Missing/empty kubeconfig            | Copy admin.conf to ~/.kube/config       |
| `connection refused`                            | Wrong server URL or API server down | Verify server address; check API server |
| `x509: certificate signed by unknown authority` | Wrong or missing CA cert            | Update `certificate-authority-data`     |
| `current-context not set`                       | No default context                  | `kubectl config use-context <name>`     |
| `context not found`                             | Wrong context name                  | `kubectl config get-contexts` to list   |
| `Forbidden`                                     | Wrong user or missing RBAC          | Check user identity; add RoleBinding    |

> **Key Concept:** `-v=6` or `-v=9` verbose flags show exactly which kubeconfig file is loaded, which context is active, and the full API request — invaluable for debugging. The most common exam scenario is that the kubeconfig has a wrong server address or the current-context is not set. Always start with `kubectl config view` and `kubectl config current-context`.

</details>

---

