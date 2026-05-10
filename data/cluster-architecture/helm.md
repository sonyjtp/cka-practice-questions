# ⎈ Helm

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration
> **Topic:** Helm
> **Total Questions:** 8

---

> ℹ️ **Scope Note:** Helm is the package manager for Kubernetes. The CKA exam expects you to install, upgrade, roll back, and inspect Helm releases, as well as work with chart repositories. Helm v3 (no Tiller) is used throughout this file.

---

## 🟢 Easy Questions

---

### Question 1 — Add a Helm Repository
> ⏱️ **Recommended Time: 3 minutes**

Add the **Bitnami** Helm chart repository using the URL `https://charts.bitnami.com/bitnami` and name it `bitnami`. Then update your local chart cache.

<details>
<summary>✅ Answer</summary>

```bash
# Add the repository
helm repo add bitnami https://charts.bitnami.com/bitnami

# Update the local cache (fetches latest chart metadata)
helm repo update

# Verify it was added
helm repo list
```

Expected output of `helm repo list`:
```
NAME     URL
bitnami  https://charts.bitnami.com/bitnami
```

> **Key Concept:** `helm repo add` registers a remote chart repository locally. `helm repo update` syncs the local index with the remote — always run this before searching or installing to ensure you get the latest chart versions.

</details>

---

### Question 2 — Search for a Chart
> ⏱️ **Recommended Time: 3 minutes**

Search for all available charts related to `nginx` in your configured repositories. Then show all available versions of the `bitnami/nginx` chart.

<details>
<summary>✅ Answer</summary>

```bash
# Search across all configured repos
helm search repo nginx

# Show all versions of a specific chart (including older ones)
helm search repo bitnami/nginx --versions

# Search Artifact Hub (public registry — requires internet)
helm search hub nginx
```

> **Key Concept:** `helm search repo` searches your locally cached repository indexes. `helm search hub` searches [Artifact Hub](https://artifacthub.io) — the public Helm chart registry. Use `--versions` to list every available chart version, which is useful for pinning to a specific release.

</details>

---

### Question 3 — Install a Helm Chart
> ⏱️ **Recommended Time: 5 minutes**

Install the `bitnami/nginx` chart into the `web` namespace (create the namespace if it does not exist) with the release name `my-nginx`. Verify the release was deployed successfully.

<details>
<summary>✅ Answer</summary>

```bash
# Install the chart — create namespace automatically
helm install my-nginx bitnami/nginx \
  --namespace web \
  --create-namespace

# Verify the release status
helm list -n web
helm status my-nginx -n web

# Verify Kubernetes resources were created
kubectl get all -n web
```

Example output of `helm list`:
```
NAME       NAMESPACE  REVISION  UPDATED       STATUS    CHART         APP VERSION
my-nginx   web        1         2026-05-08    deployed  nginx-15.x.x  1.25.x
```

> **Key Concept:** `helm install <release-name> <chart>` deploys a chart as a **release**. A release is a named instance of a chart running in the cluster. `--create-namespace` is a convenience flag that avoids a separate `kubectl create namespace` step. The release is tracked in a Secret within the namespace.

</details>

---

### Question 4 — Inspect a Helm Release
> ⏱️ **Recommended Time: 4 minutes**

A Helm release named `my-nginx` exists in the `web` namespace.

1. Show the values currently applied to the release
2. Show the Kubernetes manifests that were rendered by the release

<details>
<summary>✅ Answer</summary>

```bash
# 1. Show the values in effect (user-supplied + defaults)
helm get values my-nginx -n web

# Show ALL values including defaults
helm get values my-nginx -n web --all

# 2. Show the rendered Kubernetes manifests
helm get manifest my-nginx -n web

# Other useful get subcommands:
helm get notes my-nginx -n web      # post-install notes
helm get hooks my-nginx -n web      # lifecycle hooks
helm get all my-nginx -n web        # everything combined
```

> **Key Concept:** `helm get` is the primary inspection tool for deployed releases. `helm get values` shows only values that differ from defaults unless `--all` is used. `helm get manifest` shows exactly what Kubernetes manifests were applied — useful for debugging resource configuration.

</details>

---

## 🟡 Medium Questions

---

### Question 5 — Upgrade a Helm Release with Custom Values
> ⏱️ **Recommended Time: 6 minutes**

Upgrade the `my-nginx` release in the `web` namespace to set the replica count to `3` and enable ingress. Pass the values directly on the command line without a values file.

<details>
<summary>✅ Answer</summary>

```bash
# Upgrade with inline value overrides
helm upgrade my-nginx bitnami/nginx \
  --namespace web \
  --set replicaCount=3 \
  --set ingress.enabled=true

# Verify the upgrade
helm list -n web          # REVISION should be 2
helm get values my-nginx -n web

# Verify pod count changed
kubectl get pods -n web
```

> **Key Concept:** `helm upgrade` applies a new configuration to an existing release and increments the revision number. `--set key=value` overrides individual chart values inline. For multiple overrides, use `--set key1=val1,key2=val2` or a values file (`-f values.yaml`). Values passed with `--set` take precedence over those in `-f` files.

</details>

---

### Question 6 — Roll Back a Helm Release
> ⏱️ **Recommended Time: 6 minutes**

The `my-nginx` release in the `web` namespace is currently at revision `3` and is misbehaving. Roll it back to revision `2`. Verify the rollback succeeded.

<details>
<summary>✅ Answer</summary>

```bash
# Check release history first
helm history my-nginx -n web

# Roll back to a specific revision
helm rollback my-nginx 2 -n web

# Or roll back to the previous revision (omit revision number)
helm rollback my-nginx -n web

# Verify — a new revision is created for the rollback
helm history my-nginx -n web
helm list -n web

# Confirm the deployed resources match the expected state
kubectl get pods -n web
```

Example `helm history` output after rollback:
```
REVISION  STATUS      DESCRIPTION
1         superseded  Install complete
2         superseded  Upgrade complete
3         superseded  Upgrade complete
4         deployed    Rollback to 2
```

> **Key Concept:** `helm rollback` does NOT revert to an old revision in-place — it creates a **new revision** that applies the configuration from the target revision. The revision number you specify must exist in the release history. History is retained up to `--history-max` releases (default: 10).

</details>

---

### Question 7 — Install a Chart with a Custom Values File
> ⏱️ **Recommended Time: 7 minutes**

Create a values file at `/tmp/nginx-values.yaml` that sets:

- `replicaCount: 2`
- `service.type: NodePort`
- `service.nodePorts.http: 30090`

Then install the `bitnami/nginx` chart as a release named `custom-nginx` in the `staging` namespace using this values file.

<details>
<summary>✅ Answer</summary>

```bash
# Create the values file
cat <<EOF > /tmp/nginx-values.yaml
replicaCount: 2
service:
  type: NodePort
  nodePorts:
    http: 30090
EOF
```

```bash
# Install using the values file
helm install custom-nginx bitnami/nginx \
  --namespace staging \
  --create-namespace \
  -f /tmp/nginx-values.yaml

# Verify values were applied
helm get values custom-nginx -n staging

# Verify the NodePort
kubectl get service -n staging
```

> **Key Concept:** `-f <file>` (or `--values <file>`) loads a YAML values file. You can pass multiple `-f` flags — later files take precedence over earlier ones. `--set` always takes the highest precedence. Using a values file is preferred over `--set` for multiple settings or complex structures like lists.

</details>

---

## 🔴 Hard Questions

---

### Question 8 — Uninstall a Release and Manage History
> ⏱️ **Recommended Time: 8 minutes**

1. List all Helm releases across all namespaces.
2. Uninstall the `custom-nginx` release from the `staging` namespace but **keep the release history**.
3. Verify the Kubernetes resources are gone but the history is retained.
4. Completely purge the `my-nginx` release from the `web` namespace with no history retained.

<details>
<summary>✅ Answer</summary>

```bash
# 1. List all releases across all namespaces
helm list --all-namespaces
# or short form
helm list -A

# 2. Uninstall but retain history (--keep-history flag)
helm uninstall custom-nginx -n staging --keep-history

# 3. Verify resources are gone but history retained
kubectl get all -n staging            # resources should be gone
helm history custom-nginx -n staging  # history still visible
helm list -n staging                  # status shows "uninstalled"

# 4. Purge completely (default uninstall — no history retained)
helm uninstall my-nginx -n web

# Verify complete removal
helm history my-nginx -n web          # Error: release not found
helm list -n web                      # empty
```

> **Key Concept:** By default, `helm uninstall` removes both the Kubernetes resources AND the release history. Use `--keep-history` to preserve the history (allows rollback or `helm history` after deletion). A release uninstalled with `--keep-history` has status `uninstalled` and can be seen with `helm list --all`. Without `--keep-history`, the release record is fully deleted and cannot be recovered.

</details>
