# 🔐 RBAC — Role-Based Access Control

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** RBAC — Roles, ClusterRoles, Bindings, ServiceAccounts  
> **Total Questions:** 9

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

### Question 1 — Create a Role and RoleBinding
> ⏱️ **Recommended Time: 5 minutes**

Create a Role named `pod-reader` in the `default` namespace that allows `get`, `list`, and `watch` on `pods`. Then bind it to the user `jane` using a RoleBinding named `pod-reader-binding`.

<details>
<summary>✅ Answer</summary>

```bash
# Imperative — fastest in the exam
kubectl create role pod-reader \
  --verb=get,list,watch \
  --resource=pods \
  -n default

kubectl create rolebinding pod-reader-binding \
  --role=pod-reader \
  --user=jane \
  -n default
```

Equivalent declarative manifests:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]          # "" = core API group (pods, services, configmaps, etc.)
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: default
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Verify
kubectl get role pod-reader -n default
kubectl get rolebinding pod-reader-binding -n default

# Test the permission
kubectl auth can-i get pods --as=jane -n default
# yes
kubectl auth can-i delete pods --as=jane -n default
# no
```

> **Key Concept:** A **Role** defines permissions within a **single namespace**. A **RoleBinding** grants those permissions to a subject (User, Group, or ServiceAccount) within that same namespace. The `apiGroups: [""]` means the core API group — resources like pods, services, configmaps, secrets. Named API groups like `apps` cover Deployments, ReplicaSets, etc.

</details>

---

### Question 2 — Create a ClusterRole and ClusterRoleBinding
> ⏱️ **Recommended Time: 5 minutes**

Create a ClusterRole named `node-reader` that allows `get`, `list`, and `watch` on `nodes`. Bind it to the user `bob` cluster-wide using a ClusterRoleBinding named `node-reader-binding`.

<details>
<summary>✅ Answer</summary>

```bash
# Imperative
kubectl create clusterrole node-reader \
  --verb=get,list,watch \
  --resource=nodes

kubectl create clusterrolebinding node-reader-binding \
  --clusterrole=node-reader \
  --user=bob
```

```yaml
# Declarative
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-reader-binding
subjects:
- kind: User
  name: bob
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# Verify across all namespaces
kubectl auth can-i list nodes --as=bob
# yes

kubectl auth can-i list nodes --as=bob -n kube-system
# yes  (ClusterRoleBinding grants access cluster-wide, including all namespaces)
```

> **Key Concept:** **ClusterRoles** and **ClusterRoleBindings** are cluster-scoped resources (no namespace). Use them for: (1) cluster-scoped resources like nodes, PVs, namespaces, and (2) granting access across all namespaces at once. A ClusterRole can also be bound with a **RoleBinding** (namespaced) — this grants the ClusterRole's permissions only within that specific namespace.

</details>

---

### Question 3 — Create a ServiceAccount and Bind a Role
> ⏱️ **Recommended Time: 5 minutes**

Create a ServiceAccount named `app-sa` in the `dev` namespace. Create a Role named `configmap-reader` in the `dev` namespace that allows `get` and `list` on `configmaps`. Bind the role to the ServiceAccount.

<details>
<summary>✅ Answer</summary>

```bash
# Create namespace if needed
kubectl create namespace dev

# Create ServiceAccount
kubectl create serviceaccount app-sa -n dev

# Create Role
kubectl create role configmap-reader \
  --verb=get,list \
  --resource=configmaps \
  -n dev

# Bind Role to ServiceAccount
kubectl create rolebinding configmap-reader-binding \
  --role=configmap-reader \
  --serviceaccount=dev:app-sa \
  -n dev
```

```bash
# Verify
kubectl auth can-i get configmaps \
  --as=system:serviceaccount:dev:app-sa \
  -n dev
# yes

kubectl auth can-i delete configmaps \
  --as=system:serviceaccount:dev:app-sa \
  -n dev
# no
```

> **Key Concept:** When binding a role to a ServiceAccount, the subject format is `system:serviceaccount:<namespace>:<name>`. In `kubectl auth can-i`, use `--as=system:serviceaccount:<namespace>:<sa-name>` to test ServiceAccount permissions. ServiceAccounts are namespaced resources and are used by pods to authenticate to the API server.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Grant Access Across Namespaces Using ClusterRole + RoleBinding
> ⏱️ **Recommended Time: 7 minutes**

Create a ClusterRole named `secret-reader` that allows `get` and `list` on `secrets`. Grant this permission to the ServiceAccount `monitoring-sa` in the `monitoring` namespace, but **only within the `production` namespace** (not cluster-wide).

<details>
<summary>✅ Answer</summary>

```bash
# Create ClusterRole (cluster-scoped, reusable)
kubectl create clusterrole secret-reader \
  --verb=get,list \
  --resource=secrets

# Create ServiceAccount in monitoring namespace
kubectl create namespace monitoring
kubectl create serviceaccount monitoring-sa -n monitoring

# Bind ClusterRole via NAMESPACED RoleBinding in production namespace
# This grants access only within production, not cluster-wide
kubectl create rolebinding secret-reader-binding \
  --clusterrole=secret-reader \
  --serviceaccount=monitoring:monitoring-sa \
  -n production
```

```bash
# Verify — can read secrets in production
kubectl auth can-i get secrets \
  --as=system:serviceaccount:monitoring:monitoring-sa \
  -n production
# yes

# Verify — cannot read secrets in default (binding is namespaced to production)
kubectl auth can-i get secrets \
  --as=system:serviceaccount:monitoring:monitoring-sa \
  -n default
# no
```

> **Key Concept:** A **ClusterRole + RoleBinding** combination is a powerful pattern — define permissions once in a ClusterRole, then grant them in specific namespaces via RoleBindings. This is more maintainable than creating identical Roles in each namespace. The key distinction: **ClusterRoleBinding** = cluster-wide access; **RoleBinding referencing ClusterRole** = namespace-scoped access.

</details>

---

### Question 5 — RBAC for Deployments and Other API Groups
> ⏱️ **Recommended Time: 7 minutes**

Create a Role named `deployment-manager` in the `staging` namespace that allows full CRUD (`create`, `get`, `list`, `update`, `patch`, `delete`) on `deployments`. Bind it to user `dev-user`.

<details>
<summary>✅ Answer</summary>

```bash
# Imperative
kubectl create role deployment-manager \
  --verb=create,get,list,update,patch,delete \
  --resource=deployments \
  -n staging

kubectl create rolebinding deployment-manager-binding \
  --role=deployment-manager \
  --user=dev-user \
  -n staging
```

```yaml
# Declarative — note the apiGroup for Deployments
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployment-manager
  namespace: staging
rules:
- apiGroups: ["apps"]       # Deployments are in the "apps" API group
  resources: ["deployments"]
  verbs: ["create", "get", "list", "update", "patch", "delete"]
```

```bash
# Verify
kubectl auth can-i create deployments --as=dev-user -n staging
# yes
kubectl auth can-i delete deployments --as=dev-user -n staging
# yes
kubectl auth can-i create deployments --as=dev-user -n production
# no  (role is namespaced to staging)
```

Common API groups:

| Resource | API Group |
|----------|-----------|
| pods, services, configmaps, secrets, nodes | `""` (core) |
| deployments, replicasets, statefulsets, daemonsets | `"apps"` |
| ingresses | `"networking.k8s.io"` |
| cronjobs, jobs | `"batch"` |
| horizontalpodautoscalers | `"autoscaling"` |
| roles, rolebindings | `"rbac.authorization.k8s.io"` |
| networkpolicies | `"networking.k8s.io"` |

> **Key Concept:** The `apiGroups` field must match the resource's API group — getting this wrong is a common exam mistake. To find the correct API group for any resource: `kubectl api-resources | grep deployments`. The `APIVERSION` column shows `apps/v1` — the group is everything before the `/`, which is `apps`.

</details>

---

### Question 6 — Verify and Audit RBAC Permissions
> ⏱️ **Recommended Time: 6 minutes**

Audit the permissions of ServiceAccount `app-sa` in namespace `dev`. List all roles bound to it and verify specific permissions using `kubectl auth can-i`.

<details>
<summary>✅ Answer</summary>

```bash
# Method 1 — kubectl auth can-i (quickest for specific checks)
kubectl auth can-i get pods \
  --as=system:serviceaccount:dev:app-sa \
  -n dev

kubectl auth can-i list secrets \
  --as=system:serviceaccount:dev:app-sa \
  -n dev

# Method 2 — List all RoleBindings in the namespace and grep for the SA
kubectl get rolebinding -n dev -o yaml | \
  grep -A 5 "serviceaccount"

# Method 3 — Find all RoleBindings referencing a specific ServiceAccount
kubectl get rolebinding -n dev -o json | \
  jq '.items[] | select(.subjects[]? | .name=="app-sa" and .namespace=="dev") | .metadata.name'

# Method 4 — Check ClusterRoleBindings too
kubectl get clusterrolebinding -o json | \
  jq '.items[] | select(.subjects[]? | .name=="app-sa" and .namespace=="dev") | .metadata.name'

# Method 5 — Describe a specific binding to see its role and subjects
kubectl describe rolebinding configmap-reader-binding -n dev

# List all permissions for a role
kubectl describe role configmap-reader -n dev
```

> **Key Concept:** `kubectl auth can-i` is the fastest way to verify permissions in the exam. For auditing, combine it with `kubectl get rolebinding/clusterrolebinding` and grep for the subject. There is no single command that lists all permissions for a ServiceAccount — you must trace through bindings to roles and aggregate the rules manually (or use tools like `kubectl-who-can` in production).

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Assign a ServiceAccount to a Pod and Use It
> ⏱️ **Recommended Time: 8 minutes**

Create a ServiceAccount named `pod-lister-sa` in the `default` namespace. Grant it permission to `list` pods in the `default` namespace. Create a Pod named `sa-pod` that uses this ServiceAccount and verify it can call the Kubernetes API from within the pod.

<details>
<summary>✅ Answer</summary>

```bash
# Create ServiceAccount
kubectl create serviceaccount pod-lister-sa -n default

# Create Role and RoleBinding
kubectl create role pod-lister \
  --verb=list \
  --resource=pods \
  -n default

kubectl create rolebinding pod-lister-binding \
  --role=pod-lister \
  --serviceaccount=default:pod-lister-sa \
  -n default
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sa-pod
  namespace: default
spec:
  serviceAccountName: pod-lister-sa    # assign the ServiceAccount
  containers:
  - name: app
    image: curlimages/curl:latest
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f sa-pod.yaml

# From inside the pod, call the Kubernetes API using the mounted ServiceAccount token
kubectl exec sa-pod -- sh -c '
  TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  NAMESPACE=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)

  curl -s \
    --cacert $CACERT \
    -H "Authorization: Bearer $TOKEN" \
    https://kubernetes.default.svc/api/v1/namespaces/$NAMESPACE/pods \
    | grep '"name"'
'
# Should return pod names — permission granted

# Try listing secrets — should be forbidden (403)
kubectl exec sa-pod -- sh -c '
  TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  curl -s \
    --cacert $CACERT \
    -H "Authorization: Bearer $TOKEN" \
    https://kubernetes.default.svc/api/v1/namespaces/default/secrets
'
# {"kind":"Status","code":403,"reason":"Forbidden",...}
```

> **Key Concept:** Every pod automatically mounts a ServiceAccount token at `/var/run/secrets/kubernetes.io/serviceaccount/`. By default, pods use the `default` ServiceAccount. Explicitly setting `serviceAccountName` allows the pod to authenticate to the API server with specific permissions. Use `automountServiceAccountToken: false` in the pod spec or ServiceAccount to disable this for pods that don't need API access.

</details>

---

### Question 8 — Troubleshoot a Forbidden API Request
> ⏱️ **Recommended Time: 9 minutes**

A pod running with ServiceAccount `app-sa` in namespace `production` is getting `403 Forbidden` when trying to `list configmaps`. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify the ServiceAccount exists
kubectl get serviceaccount app-sa -n production

# Step 2 — Check what the SA can and cannot do
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:production:app-sa \
  -n production
# no  ← confirms the permission is missing

# Step 3 — List RoleBindings for the namespace
kubectl get rolebinding -n production -o wide
# Check if app-sa is bound to any role

# Step 4 — List ClusterRoleBindings referencing the SA
kubectl get clusterrolebinding -o wide | grep app-sa

# Step 5 — If a binding exists, check the role it references
kubectl describe rolebinding <binding-name> -n production
# Check if the role includes configmaps + list verb

# Step 6 — Check the Role's actual rules
kubectl describe role <role-name> -n production
# May find: configmaps is missing, or verb "list" is missing

# Fix A — Role exists but missing configmap permission; update the role
kubectl edit role <role-name> -n production
# Add to rules:
# - apiGroups: [""]
#   resources: ["configmaps"]
#   verbs: ["get", "list"]

# Fix B — No binding exists at all; create role and binding
kubectl create role configmap-reader \
  --verb=get,list \
  --resource=configmaps \
  -n production

kubectl create rolebinding configmap-reader-binding \
  --role=configmap-reader \
  --serviceaccount=production:app-sa \
  -n production

# Step 7 — Verify the fix
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:production:app-sa \
  -n production
# yes
```

> **Key Concept:** The fastest way to debug RBAC is `kubectl auth can-i --as=system:serviceaccount:<ns>:<name>`. Work from the symptom backwards: (1) confirm the permission is denied, (2) find all bindings for the subject, (3) inspect the role's rules. Common mistakes: wrong namespace in the binding, missing verb, wrong resource name (e.g., `pod` instead of `pods`), or wrong API group.

</details>

---

### Question 9 — Restrict a ServiceAccount with ResourceNames
> ⏱️ **Recommended Time: 9 minutes**

Create a Role in the `default` namespace that allows the ServiceAccount `limited-sa` to `get` and `update` **only** the ConfigMap named `app-config` — not any other ConfigMaps.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: specific-configmap-editor
  namespace: default
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]    # restrict to this specific resource name
  verbs: ["get", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: specific-configmap-editor-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: limited-sa
  namespace: default
roleRef:
  kind: Role
  name: specific-configmap-editor
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f specific-configmap-editor.yaml

# Verify — can access app-config
kubectl auth can-i get configmaps/app-config \
  --as=system:serviceaccount:default:limited-sa \
  -n default
# yes

# Verify — cannot access other configmaps
kubectl auth can-i get configmaps/other-config \
  --as=system:serviceaccount:default:limited-sa \
  -n default
# no

# Note: resourceNames restriction does NOT work with "list" or "watch"
# because those operations don't specify a single resource name
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:default:limited-sa \
  -n default
# no  (list/watch cannot be combined with resourceNames)
```

> **Key Concept:** `resourceNames` restricts a rule to specific named instances of a resource. This is useful for least-privilege scenarios — e.g., a pod that should only read one specific Secret or ConfigMap. **Important limitation:** `resourceNames` cannot be used with `list`, `watch`, or `create` verbs, because those operations don't reference a specific resource name.

</details>

---

## 📌 Quick Reference

### Role vs ClusterRole vs Bindings

| Resource | Scope | Use For |
|----------|-------|---------|
| `Role` | Namespace | Permissions within one namespace |
| `ClusterRole` | Cluster | Cluster-scoped resources + cross-namespace reuse |
| `RoleBinding` | Namespace | Grants Role or ClusterRole within one namespace |
| `ClusterRoleBinding` | Cluster | Grants ClusterRole across all namespaces |

### Subject Types

```yaml
subjects:
- kind: User
  name: alice
  apiGroup: rbac.authorization.k8s.io

- kind: Group
  name: dev-team
  apiGroup: rbac.authorization.k8s.io

- kind: ServiceAccount
  name: my-sa
  namespace: default   # required for ServiceAccount
```

### Common Verbs

| Verb | HTTP | Description |
|------|------|-------------|
| `get` | GET | Read a single resource |
| `list` | GET | List all resources |
| `watch` | GET | Stream changes |
| `create` | POST | Create a resource |
| `update` | PUT | Replace a resource |
| `patch` | PATCH | Partially update |
| `delete` | DELETE | Delete a resource |
| `deletecollection` | DELETE | Delete multiple |

### Useful Commands

```bash
# Create Role imperatively
kubectl create role <name> --verb=<verbs> --resource=<resources> -n <ns>

# Create ClusterRole imperatively
kubectl create clusterrole <name> --verb=<verbs> --resource=<resources>

# Create RoleBinding (to Role)
kubectl create rolebinding <name> --role=<role> --user=<user> -n <ns>

# Create RoleBinding (to ClusterRole, namespaced)
kubectl create rolebinding <name> --clusterrole=<cr> --serviceaccount=<ns>:<sa> -n <ns>

# Create ClusterRoleBinding
kubectl create clusterrolebinding <name> --clusterrole=<cr> --user=<user>

# Check permissions
kubectl auth can-i <verb> <resource> --as=<user> -n <ns>
kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa> -n <ns>

# List all RoleBindings
kubectl get rolebinding -A -o wide

# Find API group for a resource
kubectl api-resources | grep <resource>
```

### Related Topics

- 🔗 [ServiceAccounts](./admission-controllers.md) — admission controllers enforce RBAC policies at API level
- 🔗 [Secrets](../workloads/secrets.md) — ServiceAccount tokens are stored as Secrets (pre-1.24) or projected volumes (1.24+)
- 🔗 [Encrypting Secrets at Rest](./encrypting-secrets-at-rest.md) — protect ServiceAccount tokens stored in etcd
