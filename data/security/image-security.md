# 🔐 Image Security

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Private registries, imagePullSecrets, restricting images  
> **Total Questions:** 6

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

### Question 1 — Create an imagePullSecret for a Private Registry
> ⏱️ **Recommended Time: 5 minutes**

Create a Secret named `registry-secret` in the `default` namespace for authenticating to a private registry at `registry.example.com` with username `admin` and password `secret123`.

<details>
<summary>✅ Answer</summary>

```bash
# Imperative — fastest in the exam
kubectl create secret docker-registry registry-secret \
  --docker-server=registry.example.com \
  --docker-username=admin \
  --docker-password=secret123 \
  --docker-email=admin@example.com \
  -n default

# Verify
kubectl get secret registry-secret -n default
kubectl describe secret registry-secret -n default
# Type: kubernetes.io/dockerconfigjson

# View the secret contents
kubectl get secret registry-secret -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d
# {"auths":{"registry.example.com":{"username":"admin","password":"secret123",...}}}
```

Equivalent declarative (if you already have a `~/.docker/config.json`):

```bash
kubectl create secret generic registry-secret \
  --from-file=.dockerconfigjson=~/.docker/config.json \
  --type=kubernetes.io/dockerconfigjson \
  -n default
```

> **Key Concept:** `kubernetes.io/dockerconfigjson` is the Secret type for registry credentials. It stores a base64-encoded Docker config JSON. The Secret must be in the **same namespace** as the Pod that uses it. `imagePullSecrets` is how you attach this secret to a Pod.

</details>

---

### Question 2 — Use an imagePullSecret in a Pod
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `private-pod` that pulls `registry.example.com/myapp:v1` using the `registry-secret` created in Q1.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-pod
  namespace: default
spec:
  imagePullSecrets:
  - name: registry-secret     # reference the docker-registry secret
  containers:
  - name: app
    image: registry.example.com/myapp:v1
```

```bash
kubectl apply -f private-pod.yaml

# Verify the pod pulls the image successfully
kubectl get pod private-pod
kubectl describe pod private-pod | grep -E "Image:|Pull"
```

> **Key Concept:** `spec.imagePullSecrets` is a list — you can reference multiple pull secrets if the pod uses images from multiple private registries. The kubelet uses these secrets when pulling images for the pod. Without the correct `imagePullSecrets`, pulling from a private registry results in `ErrImagePull` or `ImagePullBackOff`.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Attach imagePullSecret to a ServiceAccount
> ⏱️ **Recommended Time: 7 minutes**

Instead of adding `imagePullSecrets` to every Pod, attach `registry-secret` to the `default` ServiceAccount so all Pods using it automatically get the pull secret.

<details>
<summary>✅ Answer</summary>

```bash
# Patch the default ServiceAccount to include the imagePullSecret
kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "registry-secret"}]}'

# Verify
kubectl get serviceaccount default -o yaml
# imagePullSecrets:
# - name: registry-secret
```

```yaml
# OR edit the ServiceAccount directly
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: default
imagePullSecrets:
- name: registry-secret     # all pods using this SA get this pull secret automatically
```

```bash
# Now create a pod WITHOUT specifying imagePullSecrets
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: auto-pull-pod
spec:
  # No imagePullSecrets needed — inherited from ServiceAccount
  containers:
  - name: app
    image: registry.example.com/myapp:v1
    command: ["sleep", "3600"]
EOF

# The pod still authenticates using registry-secret via the ServiceAccount
kubectl describe pod auto-pull-pod | grep "registry-secret"
```

> **Key Concept:** When you add `imagePullSecrets` to a ServiceAccount, **every Pod using that ServiceAccount automatically inherits the pull secrets** — you don't need to specify them in each Pod spec. This is the recommended approach for namespaces where all workloads pull from the same private registry. The `default` ServiceAccount is used by pods that don't explicitly specify a `serviceAccountName`.

</details>

---

### Question 4 — Use imagePullPolicy Correctly
> ⏱️ **Recommended Time: 6 minutes**

Explain the three `imagePullPolicy` values and configure a Pod to always pull the latest version of an image.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: always-pull-pod
spec:
  containers:
  - name: app
    image: registry.example.com/myapp:latest
    imagePullPolicy: Always     # always pull from registry, never use cached image
```

`imagePullPolicy` values:

| Value | Behaviour | Default When |
|-------|-----------|-------------|
| `Always` | Always pull from registry | Tag is `latest` or not specified |
| `IfNotPresent` | Pull only if not cached on node | Tag is specific (e.g., `v1.2.3`) |
| `Never` | Never pull — must exist on node | Manual/airgapped environments |

```bash
kubectl apply -f always-pull-pod.yaml

# Verify the pull policy
kubectl get pod always-pull-pod -o jsonpath='{.spec.containers[0].imagePullPolicy}'
# Always

# Check pull events
kubectl describe pod always-pull-pod | grep -E "Pull|Image"
# Pulling image "registry.example.com/myapp:latest"
# Successfully pulled image
```

> **Key Concept:** When `image` tag is `latest` or omitted, Kubernetes defaults `imagePullPolicy` to `Always`. For any other tag (e.g., `v1.2.3`), the default is `IfNotPresent`. In production, always use specific tags (not `latest`) with `IfNotPresent` — this ensures reproducible deployments and avoids unexpected updates. Use `Always` only when you intentionally want the latest image on every pod restart.

</details>

---

## 🔴 Hard Questions

---

### Question 5 — Troubleshoot ImagePullBackOff
> ⏱️ **Recommended Time: 8 minutes**

A Pod is stuck in `ImagePullBackOff`. Walk through diagnosing and fixing all possible causes.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Get the exact error
kubectl describe pod <pod-name> | grep -A 10 Events
# Common messages:
# "Failed to pull image: unauthorized: authentication required"
# "Failed to pull image: not found"
# "Failed to pull image: context deadline exceeded" (network issue)
# "Back-off pulling image"

# Step 2A — Wrong image name or tag
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].image}'
# registry.example.com/myapp:v99  ← tag doesn't exist

# Fix: correct the image tag
kubectl set image pod/<pod-name> app=registry.example.com/myapp:v1

# Step 2B — Authentication failure (private registry)
kubectl describe pod <pod-name> | grep "unauthorized"
# Fix: add imagePullSecrets

# Check if the secret exists
kubectl get secret registry-secret
# If missing — create it:
kubectl create secret docker-registry registry-secret \
  --docker-server=registry.example.com \
  --docker-username=admin \
  --docker-password=secret123

# Add to pod spec (requires pod recreation for static pods)
kubectl get pod <pod-name> -o yaml > pod.yaml
# Add imagePullSecrets section, delete old pod, apply new
kubectl delete pod <pod-name>
kubectl apply -f pod.yaml

# Step 2C — Wrong registry credentials in the secret
kubectl get secret registry-secret -o jsonpath='{.data.\.dockerconfigjson}' | \
  base64 -d | python3 -m json.tool
# Verify server/username/password are correct

# Recreate the secret with correct credentials:
kubectl delete secret registry-secret
kubectl create secret docker-registry registry-secret \
  --docker-server=registry.example.com \
  --docker-username=correct-user \
  --docker-password=correct-pass

# Step 2D — Network/DNS issue reaching the registry
kubectl run debug --image=busybox:1.28 --restart=Never -- \
  wget -qO- https://registry.example.com/v2/
# If this fails → DNS or network connectivity issue from within the cluster

# Step 3 — Verify pod recovers
kubectl get pod <pod-name> --watch
```

Root cause table:

| Error | Cause | Fix |
|-------|-------|-----|
| `unauthorized` | No/wrong pull secret | Create/fix `imagePullSecrets` |
| `not found` / `manifest unknown` | Wrong image name or tag | Correct `image` field |
| `context deadline exceeded` | Network can't reach registry | Fix DNS/firewall/proxy |
| `toomanyrequests` | Docker Hub rate limit | Use authenticated pull secret or mirror |
| `ImagePullBackOff` (generic) | Repeated failures, backing off | Check events for root cause |

> **Key Concept:** `ErrImagePull` is the initial failure; `ImagePullBackOff` means Kubernetes is retrying with exponential backoff. Always check `kubectl describe pod` Events for the actual error — the `ImagePullBackOff` status itself doesn't tell you why. The most common causes are: wrong image tag, missing pull secret, and wrong credentials in the pull secret.

</details>

---

### Question 6 — Restrict Images Using an Admission Controller
> ⏱️ **Recommended Time: 9 minutes**

Explain how to restrict which container images can be used in the cluster. Demonstrate using the `--allowed-unsafe-sysctls` approach and describe the role of admission controllers in image security.

<details>
<summary>✅ Answer</summary>

```bash
# Method 1 — OPA/Gatekeeper or Kyverno (policy engines)
# These are not tested in CKA but good to know conceptually

# Method 2 — ImagePolicyWebhook admission controller (CKA-relevant)
# Requires configuring an external webhook that approves/denies image pulls

# Check if ImagePolicyWebhook is enabled
grep "ImagePolicyWebhook" /etc/kubernetes/manifests/kube-apiserver.yaml
# --enable-admission-plugins=...,ImagePolicyWebhook,...

# Method 3 — Restrict to a specific registry using a custom admission webhook
# or by enforcing imagePullPolicy: Always + private registry

# Practical CKA approach — use ValidatingAdmissionWebhook or check current policy
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations

# Method 4 — Node-level: configure containerd to only allow specific registries
cat /etc/containerd/config.toml | grep -A 10 "registry"

# Demonstrate image restriction via namespace labels (Pod Security Admission)
# Restrict privileged containers in a namespace:
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted

# This prevents pods from using:
# - privileged containers
# - root users
# - host namespaces
# - dangerous capabilities

# Test that a privileged pod is rejected:
cat <<EOF | kubectl apply -f - -n production
apiVersion: v1
kind: Pod
metadata:
  name: priv-test
spec:
  containers:
  - name: app
    image: nginx
    securityContext:
      privileged: true
EOF
# Error from server (Forbidden): pods "priv-test" is forbidden:
# violates PodSecurity "restricted:latest"
```

Image security layers:

| Layer | Mechanism | Enforces |
|-------|-----------|---------|
| Pull authentication | `imagePullSecrets` | Only authorised registries |
| Image scanning | External tools (Trivy, Snyk) | No vulnerable images |
| Admission control | `ImagePolicyWebhook`, OPA | Approved images/registries only |
| Pod Security Admission | Namespace labels | No privileged/root containers |
| Runtime security | `securityContext` | OS-level restrictions |

> **Key Concept:** For the CKA, the most testable image security topics are: creating `imagePullSecrets`, attaching them to pods/ServiceAccounts, and troubleshooting `ImagePullBackOff`. Pod Security Admission (replacing Pod Security Policy in Kubernetes 1.25+) is also tested — it uses namespace labels to enforce security standards (`privileged`, `baseline`, `restricted`) across all pods in a namespace.

</details>

---

## 📌 Quick Reference

### Create imagePullSecret

```bash
kubectl create secret docker-registry <name> \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<pass> \
  --docker-email=<email> \
  -n <namespace>
```

### Attach to Pod

```yaml
spec:
  imagePullSecrets:
  - name: <secret-name>
  containers:
  - image: <private-registry>/image:tag
```

### Attach to ServiceAccount (all pods inherit)

```bash
kubectl patch serviceaccount <sa-name> \
  -p '{"imagePullSecrets": [{"name": "<secret-name>"}]}'
```

### imagePullPolicy Summary

```
Always        → always pull (default when tag is "latest")
IfNotPresent  → pull only if not on node (default for specific tags)
Never         → never pull (image must pre-exist on node)
```

### Pod Security Admission Labels

```bash
# Enforce restricted security standard on a namespace
kubectl label namespace <ns> \
  pod-security.kubernetes.io/enforce=restricted

# Standards: privileged | baseline | restricted
# Modes:     enforce | warn | audit
```

### Related Topics

- 🔗 [Security Contexts](./security-contexts.md) — OS-level security settings for containers
- 🔗 [Secrets](../workloads/secrets.md) — imagePullSecrets are a type of Kubernetes Secret
- 🔗 [Admission Controllers](../cluster-architecture/admission-controllers.md) — enforce image policies at the API level
