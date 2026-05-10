# 🛡️ Admission Controllers

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Admission Controllers  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — List Enabled Admission Controllers
> ⏱️ **Recommended Time: 4 minutes**

Identify which admission controllers are currently enabled on the `kube-apiserver`.

<details>
<summary>✅ Answer</summary>

```bash
# Option 1 — check the kube-apiserver static pod manifest
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -i admission

# Look for flags like:
# --enable-admission-plugins=NodeRestriction,NamespaceLifecycle,...
# --disable-admission-plugins=PodSecurityPolicy,...

# Option 2 — check the running kube-apiserver process
kubectl get pod kube-apiserver-controlplane -n kube-system -o yaml | grep admission

# Option 3 — check the process directly on the node
ps aux | grep kube-apiserver | grep admission
```

Default admission controllers enabled in a kubeadm cluster:
```
NamespaceLifecycle, LimitRanger, ServiceAccount, TaintNodesByCondition,
PriorityClass, DefaultTolerationSeconds, DefaultStorageClass,
StorageObjectInUseProtection, PersistentVolumeClaimResize,
RuntimeClass, CertificateApproval, CertificateSigning,
ClusterTrustBundleAttest, CertificateSubjectRestriction,
DefaultIngressClass, MutatingAdmissionWebhook,
ValidatingAdmissionPolicy, ValidatingAdmissionWebhook,
ResourceQuota, NodeRestriction
```

> **Key Concept:** Admission controllers intercept API server requests **after** authentication and authorisation but **before** the object is persisted. They can validate, mutate, or reject requests. The list of enabled plugins is configured via `--enable-admission-plugins` on the `kube-apiserver`.

</details>

---

### Question 2 — Enable an Admission Controller Plugin
> ⏱️ **Recommended Time: 5 minutes**

Enable the `PodNodeSelector` admission controller plugin on the `kube-apiserver`.

<details>
<summary>✅ Answer</summary>

```bash
# Edit the kube-apiserver static pod manifest
vi /etc/kubernetes/manifests/kube-apiserver.yaml
```

Find the `--enable-admission-plugins` flag and add `PodNodeSelector`:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction,PodNodeSelector
    # ... other flags
```

```bash
# Save and exit — the kubelet will automatically restart the kube-apiserver pod
# Wait for it to come back up
kubectl get pods -n kube-system -w

# Verify the plugin is active
kubectl get pod kube-apiserver-controlplane -n kube-system -o yaml | grep PodNodeSelector
```

> **Key Concept:** Admission controller plugins are enabled/disabled by modifying the `kube-apiserver` static pod manifest at `/etc/kubernetes/manifests/kube-apiserver.yaml`. The kubelet detects the change and restarts the API server automatically. **Always verify the API server comes back up after editing this file.**

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Disable an Admission Controller Plugin
> ⏱️ **Recommended Time: 5 minutes**

The `DefaultStorageClass` admission controller is currently enabled. Disable it on the `kube-apiserver`.

<details>
<summary>✅ Answer</summary>

```bash
# Edit the kube-apiserver static pod manifest
vi /etc/kubernetes/manifests/kube-apiserver.yaml
```

Add the `--disable-admission-plugins` flag:

```yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --enable-admission-plugins=NodeRestriction
    - --disable-admission-plugins=DefaultStorageClass
    # ... other flags
```

```bash
# Wait for the kube-apiserver to restart
kubectl get pods -n kube-system | grep apiserver

# Verify
kubectl get pod kube-apiserver-controlplane -n kube-system -o yaml | grep -i admission
```

> **Key Concept:** Use `--disable-admission-plugins` to turn off a plugin that is enabled by default. You can use both `--enable-admission-plugins` and `--disable-admission-plugins` flags simultaneously on the same `kube-apiserver`.

</details>

---

### Question 4 — NamespaceLifecycle Admission Controller
> ⏱️ **Recommended Time: 6 minutes**

A namespace named `old-project` is in `Terminating` state. A user attempts to create a new pod in this namespace and gets an error. Explain why and what admission controller is responsible.

<details>
<summary>✅ Answer</summary>

```bash
# Attempt to create a pod in a terminating namespace
kubectl run test-pod --image=nginx:alpine -n old-project

# Error:
# Error from server (Forbidden): pods "test-pod" is forbidden:
# unable to create new content in namespace old-project because it is being terminated
```

**Why this happens:**

The `NamespaceLifecycle` admission controller blocks the creation of new resources in a namespace that is in `Terminating` state. It also prevents deletion of the three system namespaces (`default`, `kube-system`, `kube-public`).

```bash
# Check namespace status
kubectl get namespace old-project

# You may see it stuck in Terminating due to finalizers
kubectl describe namespace old-project | grep -A 5 Conditions

# To investigate stuck Terminating namespaces (out of scope for this question):
kubectl get namespace old-project -o yaml | grep finalizers
```

> **Key Concept:** `NamespaceLifecycle` is a built-in admission controller that is enabled by default. It enforces two rules: (1) new resources cannot be created in a terminating namespace, and (2) the `default`, `kube-system`, and `kube-public` namespaces cannot be deleted.

</details>

---

### Question 5 — NodeRestriction Admission Controller
> ⏱️ **Recommended Time: 7 minutes**

Explain the purpose of the `NodeRestriction` admission controller and demonstrate what it prevents.

<details>
<summary>✅ Answer</summary>

**Purpose of NodeRestriction:**

The `NodeRestriction` admission controller limits what a `kubelet` (authenticating as `system:node:<nodeName>`) is allowed to modify. Specifically, it prevents kubelets from:

- Modifying labels with the `node-restriction.kubernetes.io/` prefix on other nodes
- Adding arbitrary labels to nodes outside the allowed set
- Modifying pods not bound to their own node

```bash
# Verify NodeRestriction is enabled
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep NodeRestriction

# Simulate what a kubelet can and cannot do
# (This would be tested by authenticating as a node credential)

# A kubelet CAN label its own node with standard labels:
kubectl label node node01 kubernetes.io/role=worker

# A kubelet CANNOT set restricted labels:
# node-restriction.kubernetes.io/* labels are blocked
```

```bash
# Check if NodeRestriction is in the enabled plugins list
kubectl get pod kube-apiserver-controlplane -n kube-system -o yaml | grep -A 5 enable-admission
```

> **Key Concept:** `NodeRestriction` is a security-focused admission controller that prevents compromised kubelets from escalating privileges by modifying other nodes or pods. It is enabled by default in kubeadm clusters and is important for the CKA security mindset.

</details>

---

### Question 6 — Diagnosing a Request Rejected by an Admission Controller
> ⏱️ **Recommended Time: 8 minutes**

A developer reports that their `kubectl apply` command is being rejected with a `Forbidden` error even though they have the correct RBAC permissions. Describe how to diagnose whether an admission controller is responsible.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check the exact error message
kubectl apply -f deployment.yaml
# Example error:
# Error from server (Forbidden): error when creating "deployment.yaml":
# deployments.apps "my-app" is forbidden: exceeded quota: team-quota,
# requested: requests.cpu=500m, used: requests.cpu=1900m, limited: requests.cpu=2

# 2. The error message usually names the admission controller or quota
# Common patterns:
# "unable to create new content in namespace X because it is being terminated"
#   → NamespaceLifecycle
# "exceeded quota: <quota-name>"
#   → ResourceQuota admission controller
# "maximum memory/cpu usage per Container is X"
#   → LimitRanger admission controller
# "is forbidden: node "<node>" is not allowed to modify..."
#   → NodeRestriction

# 3. Check active ResourceQuotas in the namespace
kubectl describe resourcequota -n <namespace>

# 4. Check active LimitRanges
kubectl describe limitrange -n <namespace>

# 5. Check admission plugins on the API server
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep admission
```

**Admission vs RBAC errors:**

| Error Source         | Message Pattern                                                                  |
|----------------------|----------------------------------------------------------------------------------|
| RBAC                 | `User "X" cannot create resource "Y" in namespace "Z"`                           |
| Admission Controller | `pods "X" is forbidden: exceeded quota / namespace terminating / limit exceeded` |

> **Key Concept:** RBAC errors say the user **cannot** perform an action. Admission controller errors say the request is **forbidden** for policy reasons even though the user has permission. Always read the full error message — it usually names the quota, limitrange, or policy responsible.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Validating vs Mutating Admission Webhooks
> ⏱️ **Recommended Time: 9 minutes**

Explain the difference between `MutatingAdmissionWebhook` and `ValidatingAdmissionWebhook`. A webhook named `pod-policy.example.com` is rejecting pod creation. How would you investigate and temporarily disable it?

<details>
<summary>✅ Answer</summary>

**Key Difference:**

| Type                         | Purpose                                                                               | Order           |
|------------------------------|---------------------------------------------------------------------------------------|-----------------|
| `MutatingAdmissionWebhook`   | **Modifies** the incoming object (e.g., injects sidecars, adds labels, sets defaults) | Runs **first**  |
| `ValidatingAdmissionWebhook` | **Validates** the object and approves or rejects it — cannot modify                   | Runs **second** |

```bash
# 1. List all ValidatingWebhookConfigurations
kubectl get validatingwebhookconfigurations

# 2. List all MutatingWebhookConfigurations
kubectl get mutatingwebhookconfigurations

# 3. Describe the webhook to find its rules and failure policy
kubectl describe validatingwebhookconfiguration pod-policy.example.com

# Look for:
# - Rules: which resources/operations it intercepts
# - FailurePolicy: Fail (blocks requests if webhook is down) or Ignore
# - ClientConfig: the service/URL the webhook calls

# 4. Check if the webhook service is running
kubectl get svc -n <webhook-namespace>
kubectl get pods -n <webhook-namespace>

# 5. Temporarily disable by deleting the webhook configuration
# (Use with caution — this removes the policy enforcement)
kubectl delete validatingwebhookconfiguration pod-policy.example.com

# 6. Alternatively, patch the failurePolicy to Ignore so it doesn't block requests
kubectl patch validatingwebhookconfiguration pod-policy.example.com \
  --type='json' \
  -p='[{"op":"replace","path":"/webhooks/0/failurePolicy","value":"Ignore"}]'
```

> **Key Concept:** Webhooks with `failurePolicy: Fail` will block ALL matching requests if the webhook service is unreachable. This is a common cause of cluster-wide outages. In an exam scenario, if all pod creation is failing with a webhook error, deleting or patching the `ValidatingWebhookConfiguration` is the fastest fix.

</details>

---

### Question 8 — Admission Controller Causing kube-apiserver Failure
> ⏱️ **Recommended Time: 10 minutes**

After editing `/etc/kubernetes/manifests/kube-apiserver.yaml` to enable a new admission plugin, the `kube-apiserver` pod is not coming back up. The cluster is unresponsive.

Diagnose and recover the cluster.

<details>
<summary>✅ Answer</summary>

```bash
# 1. The kube-apiserver is a static pod — check if the kubelet is trying to start it
sudo journalctl -u kubelet | tail -30

# 2. Check the kube-apiserver container logs directly via crictl (not kubectl — API server is down)
sudo crictl ps -a | grep kube-apiserver
sudo crictl logs <container-id>

# Common errors:
# - "unknown admission plugin: BadPluginName"
# - "error parsing flag: invalid value"
# - Syntax error in the YAML manifest

# 3. Inspect the manifest for errors
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 4. Fix the error — e.g., remove the invalid plugin name
vi /etc/kubernetes/manifests/kube-apiserver.yaml

# Example fix — correct the admission plugins flag:
# BEFORE: --enable-admission-plugins=NodeRestriction,InvalidPlugin
# AFTER:  --enable-admission-plugins=NodeRestriction

# 5. Save and wait for the kubelet to restart the kube-apiserver
# Monitor the static pod coming back
sudo crictl ps | grep kube-apiserver

# 6. Once the API server is back, verify with kubectl
kubectl get pods -n kube-system
kubectl cluster-info
```

> **Key Concept:** When the `kube-apiserver` is down, `kubectl` will not work. Use `crictl` (the container runtime CLI) to inspect running containers and read logs directly. Always validate `kube-apiserver.yaml` changes carefully — a typo in an admission plugin name will prevent the API server from starting.

</details>

---

