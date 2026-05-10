# 🔒 Network Policies

> **CKA Exam Domain:** Services & Networking  
> **Topic:** Network Policies  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** NetworkPolicies are enforced by the **CNI plugin** (Calico, Cilium, Weave, etc.). If the cluster uses a CNI that does not support NetworkPolicy (e.g., Flannel without an additional policy engine), policies are created but have **no effect**. On the CKA exam, assume the CNI supports NetworkPolicy.

---

## 🟢 Easy Questions

---

### Question 1 — Default Deny-All Ingress to a Namespace
> ⏱️ **Recommended Time: 4 minutes**

Create a NetworkPolicy named `deny-all-ingress` in the `restricted` namespace that blocks **all ingress traffic** to every pod in the namespace. Egress should remain unrestricted.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: restricted
spec:
  podSelector: {}        # selects ALL pods in the namespace
  policyTypes:
  - Ingress              # only restrict ingress; egress is untouched
  # No ingress rules = deny all ingress
```

```bash
kubectl apply -f deny-all-ingress.yaml

# Verify the policy exists
kubectl get networkpolicy -n restricted

# Test — traffic into any pod in 'restricted' should now be blocked
kubectl run test --image=busybox:1.28 --restart=Never -- \
  wget -qO- --timeout=3 http://<pod-ip-in-restricted>
# Should time out
```

> **Key Concept:** An empty `podSelector: {}` selects **all pods** in the namespace. Specifying `policyTypes: [Ingress]` with **no ingress rules** means all ingress is denied. This is the standard "default deny" baseline — apply it first, then add explicit allow rules. Note: if `policyTypes` is omitted, Kubernetes infers it from the presence of `ingress`/`egress` rule blocks.

</details>

---

### Question 2 — Allow Ingress Only from Pods with a Specific Label
> ⏱️ **Recommended Time: 5 minutes**

Pods labelled `app=backend` in the `default` namespace should only accept ingress traffic from pods labelled `app=frontend` in the **same namespace**. All other ingress must be blocked.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend        # policy applies to backend pods
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend   # only allow traffic from frontend pods
```

```bash
kubectl apply -f allow-frontend-to-backend.yaml

# Test from a frontend pod — should succeed
kubectl exec <frontend-pod> -- wget -qO- http://<backend-pod-ip>:8080

# Test from any other pod — should be blocked
kubectl run attacker --image=busybox:1.28 --restart=Never -- \
  wget -qO- --timeout=3 http://<backend-pod-ip>:8080
# Should time out
```

> **Key Concept:** When a NetworkPolicy selects a pod, that pod is **isolated** — only traffic explicitly allowed by an ingress rule is permitted. The `from.podSelector` matches pods **within the same namespace** as the NetworkPolicy by default. To match pods in a different namespace, you must add a `namespaceSelector`.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Allow Ingress from a Specific Namespace
> ⏱️ **Recommended Time: 7 minutes**

Pods labelled `app=api` in the `production` namespace should accept ingress traffic **only from pods in the `monitoring` namespace**. The monitoring namespace has the label `kubernetes.io/metadata.name=monitoring`.

<details>
<summary>✅ Answer</summary>

```bash
# First, verify the monitoring namespace has the required label
kubectl get namespace monitoring --show-labels
# Kubernetes automatically adds kubernetes.io/metadata.name=<name> to all namespaces (v1.21+)
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-monitoring
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: monitoring
```

```bash
kubectl apply -f allow-from-monitoring.yaml

# Test from a pod in the monitoring namespace — should succeed
kubectl exec -n monitoring <monitoring-pod> -- \
  wget -qO- http://<api-pod-ip>

# Test from a pod in default namespace — should be blocked
kubectl run test --image=busybox:1.28 --restart=Never -- \
  wget -qO- --timeout=3 http://<api-pod-ip>
```

> **Key Concept:** `namespaceSelector` matches namespaces by their labels. Since Kubernetes 1.21, every namespace automatically gets the label `kubernetes.io/metadata.name=<namespace-name>` — use this for reliable namespace targeting. A `namespaceSelector` without a `podSelector` allows traffic from **all pods** in the matched namespace.

</details>

---

### Question 4 — Allow Egress to a Specific Pod Only
> ⏱️ **Recommended Time: 7 minutes**

Pods labelled `app=worker` in the `default` namespace should only be able to send egress traffic to pods labelled `app=database`. All other egress (including DNS) should be blocked **except** DNS on UDP port 53.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: worker-egress-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: worker
  policyTypes:
  - Egress
  egress:
  # Allow traffic to database pods
  - to:
    - podSelector:
        matchLabels:
          app: database

  # Allow DNS resolution (without this, name resolution breaks)
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

```bash
kubectl apply -f worker-egress-policy.yaml

# Test from a worker pod — database should be reachable
kubectl exec <worker-pod> -- wget -qO- http://<database-pod-ip>:5432

# Test from a worker pod — other destinations should be blocked
kubectl exec <worker-pod> -- wget -qO- --timeout=3 http://google.com
# Should time out
```

> **Key Concept:** Egress policies control **outbound** traffic from selected pods. Always include a DNS egress rule (UDP/TCP port 53 to kube-system) when restricting egress — without it, pods cannot resolve service names and appear completely broken even if the destination IP is reachable. This is one of the most common NetworkPolicy mistakes in the exam.

</details>

---

### Question 5 — Combined Ingress and Egress Policy
> ⏱️ **Recommended Time: 8 minutes**

Create a NetworkPolicy named `api-policy` in the `default` namespace for pods labelled `app=api` that:

- **Ingress:** Only allows traffic from pods labelled `app=frontend` on port `8080`
- **Egress:** Only allows traffic to pods labelled `app=database` on port `5432`, and DNS (UDP/TCP 53)

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress

  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080

  egress:
  # Allow to database pods on port 5432
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432

  # Allow DNS
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
```

```bash
kubectl apply -f api-policy.yaml

# Verify the policy
kubectl describe networkpolicy api-policy

# Test ingress from frontend — should succeed on port 8080
kubectl exec <frontend-pod> -- wget -qO- http://<api-pod-ip>:8080

# Test egress to database — should succeed
kubectl exec <api-pod> -- wget -qO- http://<db-pod-ip>:5432

# Test blocked paths
kubectl exec <api-pod> -- wget -qO- --timeout=3 http://google.com   # blocked
kubectl run attacker --image=busybox:1.28 --restart=Never -- \
  wget -qO- --timeout=3 http://<api-pod-ip>:8080                    # blocked
```

> **Key Concept:** When both `Ingress` and `Egress` are listed in `policyTypes`, both directions are restricted independently. The `ports` field under an ingress/egress rule limits the allowed port — omitting `ports` allows all ports for that rule. A single NetworkPolicy can contain multiple ingress rules and multiple egress rules; traffic is allowed if it matches **any** rule.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Cross-Namespace Policy with Combined Selectors
> ⏱️ **Recommended Time: 9 minutes**

Pods labelled `app=payments` in the `production` namespace should only accept ingress from pods that satisfy **both** conditions simultaneously:
- The pod has label `role=auditor`
- The pod is in a namespace labelled `team=finance`

All other ingress must be blocked.

<details>
<summary>✅ Answer</summary>

```bash
# Label the finance namespace
kubectl label namespace finance team=finance
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payments-ingress-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payments
  policyTypes:
  - Ingress
  ingress:
  - from:
    # A single entry with BOTH selectors = AND logic (must match both)
    - namespaceSelector:
        matchLabels:
          team: finance
      podSelector:
        matchLabels:
          role: auditor
```

```bash
kubectl apply -f payments-ingress-policy.yaml

# Test 1 — auditor pod in finance namespace → ALLOWED
kubectl exec -n finance <auditor-pod> -- \
  wget -qO- http://<payments-pod-ip>

# Test 2 — auditor pod in a different namespace → BLOCKED
kubectl exec -n default <auditor-pod> -- \
  wget -qO- --timeout=3 http://<payments-pod-ip>

# Test 3 — non-auditor pod in finance namespace → BLOCKED
kubectl exec -n finance <non-auditor-pod> -- \
  wget -qO- --timeout=3 http://<payments-pod-ip>
```

**AND vs OR — the critical distinction:**

```yaml
# AND logic — pod must be in finance namespace AND have role=auditor
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        team: finance
    podSelector:           # same list item = AND
      matchLabels:
        role: auditor

# OR logic — pod in finance namespace OR any pod with role=auditor
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        team: finance
  - podSelector:           # separate list item = OR
      matchLabels:
        role: auditor
```

> **Key Concept:** This is one of the most exam-critical NetworkPolicy details. When `namespaceSelector` and `podSelector` are in the **same list item** (same `-` entry), they combine with AND logic. When they are **separate list items** (different `-` entries), they combine with OR logic. Getting this wrong results in either too-permissive or too-restrictive policies.

</details>

---

### Question 7 — Troubleshoot a NetworkPolicy Blocking Expected Traffic
> ⏱️ **Recommended Time: 10 minutes**

Traffic from `frontend` pods to `backend` pods in the `default` namespace is failing. A NetworkPolicy exists but the connection is timing out. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — List all NetworkPolicies in the namespace
kubectl get networkpolicy -n default

# Step 2 — Check which policies affect the backend pods
kubectl describe networkpolicy -n default

# Step 3 — Verify the backend pod labels match the policy's podSelector
kubectl get pods --show-labels | grep backend
# backend-pod   app=backend-service   ← actual label

kubectl get networkpolicy allow-frontend -o yaml | grep -A 5 podSelector
# podSelector:
#   matchLabels:
#     app: backend    ← policy targets "backend" but pod has "backend-service"

# Root cause: podSelector mismatch

# Fix Option A — update the NetworkPolicy to match the actual label
kubectl patch networkpolicy allow-frontend --type merge -p \
  '{"spec":{"podSelector":{"matchLabels":{"app":"backend-service"}}}}'

# Fix Option B — relabel the pods to match the policy
kubectl label pods -l app=backend-service app=backend --overwrite

# Step 4 — Also check the ingress 'from' selector matches frontend pods
kubectl get pods --show-labels | grep frontend
kubectl get networkpolicy allow-frontend -o yaml | grep -A 5 "from:"

# Step 5 — Check for a deny-all policy that might be overriding the allow
kubectl get networkpolicy -n default -o yaml | grep -B 5 "podSelector: {}"
# An empty podSelector {} selects ALL pods — a deny-all blocks everything first

# Step 6 — Verify fix
kubectl exec <frontend-pod> -- wget -qO- http://<backend-pod-ip>:8080
```

Systematic troubleshooting checklist:

| Check | Command |
|-------|---------|
| List all policies | `kubectl get networkpolicy -n <ns>` |
| Check policy details | `kubectl describe networkpolicy <name> -n <ns>` |
| Verify pod labels | `kubectl get pods --show-labels` |
| Check for deny-all | Look for `podSelector: {}` with no rules |
| Verify port in policy | Match `ports[].port` to container's actual port |
| Check CNI supports policies | `kubectl get pods -n kube-system` — look for Calico/Cilium |

> **Key Concept:** NetworkPolicy troubleshooting always follows the same order: (1) list all policies affecting the pod, (2) verify label selectors match actual pod labels, (3) check for a deny-all policy overriding the allow rule, (4) verify ports match. Remember that multiple policies are **additive** — if any policy allows traffic, it is permitted. But a missing allow rule means the traffic is implicitly denied once the pod is selected by any policy.

</details>

---

## 📌 Quick Reference

### AND vs OR Logic (Critical Exam Topic)

```yaml
# AND — same list item (one dash):
from:
- namespaceSelector:
    matchLabels:
      team: finance
  podSelector:          # ← indented under same dash = AND
    matchLabels:
      role: auditor

# OR — separate list items (two dashes):
from:
- namespaceSelector:
    matchLabels:
      team: finance
- podSelector:          # ← new dash = OR
    matchLabels:
      role: auditor
```

### Default Behaviours

| Situation | Default Behaviour |
|-----------|-----------------|
| No NetworkPolicy selects a pod | All ingress and egress allowed |
| A policy selects a pod | Pod is isolated; only explicitly allowed traffic passes |
| Multiple policies select a pod | Union of all rules (additive) |
| `policyTypes: [Ingress]` with no ingress rules | All ingress denied |
| `policyTypes: [Egress]` with no egress rules | All egress denied |

### Common Patterns

```yaml
# Deny all ingress
spec:
  podSelector: {}
  policyTypes: [Ingress]

# Deny all egress
spec:
  podSelector: {}
  policyTypes: [Egress]

# Allow all ingress (explicit)
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress:
  - {}   # empty rule = allow all

# Allow DNS egress only
egress:
- to:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: kube-system
  ports:
  - protocol: UDP
    port: 53
  - protocol: TCP
    port: 53
```

### Useful Commands

```bash
# List all NetworkPolicies
kubectl get networkpolicy -A

# Describe a policy (human-readable)
kubectl describe networkpolicy <name> -n <namespace>

# Check pod labels (for selector matching)
kubectl get pods --show-labels -n <namespace>

# Check namespace labels
kubectl get namespace --show-labels

# Label a namespace
kubectl label namespace <name> <key>=<value>
```

### Related Topics

- 🔗 [Services](./services.md) — NetworkPolicies filter pod-to-pod and pod-to-Service traffic
- 🔗 [Ingress](./ingress.md) — HTTP-level routing; NetworkPolicy operates at L3/L4
- 🔗 [Namespaces](../cluster-architecture/namespaces.md) — namespace labels are used by `namespaceSelector`
