# 🏷️ Labels, Selectors and Annotations

> **CKA Exam Domain:** Scheduling  
> **Topic:** Labels, Selectors and Annotations  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Adding Labels to a Pod
> ⏱️ **Recommended Time: 4 minutes**

Create a pod named `labeled-pod` using the `nginx:1.21` image in the `default` namespace with the following labels:
- `app=web`
- `env=production`
- `tier=frontend`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: labeled-pod
  namespace: default
  labels:
    app: web
    env: production
    tier: frontend
spec:
  containers:
  - name: nginx
    image: nginx:1.21
```

```bash
kubectl apply -f labeled-pod.yaml

# Verify labels
kubectl get pod labeled-pod --show-labels
```

> **Key Concept:** Labels are key/value pairs attached to objects. They are used to organise and select subsets of objects.

</details>

---

### Question 2 — Querying with Label Selectors
> ⏱️ **Recommended Time: 5 minutes**

The cluster has multiple pods running across different namespaces. Perform the following queries:

1. List all pods in the `default` namespace with label `env=production`
2. List all pods across all namespaces with label `tier=frontend`
3. List all pods with label `env=production` **and** `app=web`

<details>
<summary>✅ Answer</summary>

```bash
# 1. Pods with env=production in default namespace
kubectl get pods -l env=production

# 2. Pods with tier=frontend across all namespaces
kubectl get pods -A -l tier=frontend

# 3. Pods with both env=production AND app=web
kubectl get pods -l env=production,app=web
```

> **Key Concept:** The `-l` flag accepts equality-based selectors (`key=value`) and can be combined with commas for AND logic. The `-A` flag searches across all namespaces.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Adding and Updating Labels Imperatively
> ⏱️ **Recommended Time: 6 minutes**

A pod named `api-pod` is already running in the `default` namespace.

1. Add a label `version=v2` to the pod imperatively (without editing the manifest)
2. Update the existing label `env=staging` to `env=production`
3. Remove the label `debug` from the pod

<details>
<summary>✅ Answer</summary>

```bash
# 1. Add a new label
kubectl label pod api-pod version=v2

# 2. Update an existing label (use --overwrite flag)
kubectl label pod api-pod env=production --overwrite

# 3. Remove a label (use the key followed by a minus sign)
kubectl label pod api-pod debug-

# Verify all changes
kubectl get pod api-pod --show-labels
```

> **Key Concept:** `kubectl label` adds or updates labels. Use `--overwrite` to update an existing label. Append `-` to a key to remove a label.

</details>

---

### Question 4 — Annotations
> ⏱️ **Recommended Time: 7 minutes**

Create a pod named `annotated-pod` using the `busybox:1.28` image in the `default` namespace with the following annotations:
- `description="This pod runs the busybox utility"`
- `owner=team-platform`
- `build-version=1.4.2`

Then, add an additional annotation `last-reviewed=2026-05-07` to the running pod without recreating it.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: annotated-pod
  namespace: default
  annotations:
    description: "This pod runs the busybox utility"
    owner: team-platform
    build-version: "1.4.2"
spec:
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f annotated-pod.yaml

# Add annotation to running pod
kubectl annotate pod annotated-pod last-reviewed=2026-05-07

# Verify annotations
kubectl describe pod annotated-pod | grep -A 5 Annotations
```

> **Key Concept:** Annotations are non-identifying metadata. Unlike labels, they cannot be used in selectors but can store arbitrary information such as tool data, build info, or contact details.

</details>

---

### Question 5 — Set-Based Selectors in a Deployment
> ⏱️ **Recommended Time: 9 minutes**

Create a Deployment named `multi-env-deploy` in the `default` namespace using the `nginx:alpine` image with 3 replicas. The deployment should:

1. Attach labels `app=nginx`, `env=production`, `tier=frontend` to **both** the deployment and its pods
2. Use a **set-based selector** matching pods where `env` is either `production` or `staging`
3. After creation, verify the pod template labels match the selector

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-env-deploy
  namespace: default
  labels:
    app: nginx
    env: production
    tier: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
    matchExpressions:
    - key: env
      operator: In
      values:
      - production
      - staging
  template:
    metadata:
      labels:
        app: nginx
        env: production
        tier: frontend
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
```

```bash
kubectl apply -f multi-env-deploy.yaml

# Verify deployment and pod labels
kubectl get deployment multi-env-deploy --show-labels
kubectl get pods -l app=nginx --show-labels

# Test set-based selector manually
kubectl get pods -l 'env in (production, staging)'
```

> **Key Concept:** `matchExpressions` supports set-based selectors using operators `In`, `NotIn`, `Exists`, and `DoesNotExist`. These are more expressive than simple `matchLabels` equality checks.

</details>

---

### Question 6 — NodeSelector for Scheduling
> ⏱️ **Recommended Time: 9 minutes**

A node in the cluster has been labelled as `disktype=ssd`. Create a pod named `ssd-pod` using the `nginx:latest` image that is **only scheduled on nodes with that label** using `nodeSelector`. Then:

1. Verify the pod lands on the correct node
2. Create a second pod named `ssd-pod-2` that uses a `nodeAffinity` rule (required during scheduling) to achieve the same result

<details>
<summary>✅ Answer</summary>

```bash
# First, label your node if not already done (replace node01 with actual node name)
kubectl label node node01 disktype=ssd
```

```yaml
# ssd-pod using nodeSelector
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod
spec:
  nodeSelector:
    disktype: ssd
  containers:
  - name: nginx
    image: nginx:latest
```

```yaml
# ssd-pod-2 using nodeAffinity (requiredDuringSchedulingIgnoredDuringExecution)
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod-2
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
  containers:
  - name: nginx
    image: nginx:latest
```

```bash
kubectl apply -f ssd-pod.yaml
kubectl apply -f ssd-pod-2.yaml

# Verify both pods land on the SSD node
kubectl get pods ssd-pod ssd-pod-2 -o wide
```

> **Key Concept:** `nodeSelector` is a simple way to constrain pod scheduling using labels. `nodeAffinity` is the more expressive successor — `requiredDuringSchedulingIgnoredDuringExecution` is a hard requirement, while `preferredDuringSchedulingIgnoredDuringExecution` is a soft preference.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Labels, Selectors and Services
> ⏱️ **Recommended Time: 10 minutes**

You have three pods in the `default` namespace:

| Pod Name     | Labels                              |
|--------------|-------------------------------------|
| `pod-v1`     | `app=backend`, `version=v1`         |
| `pod-v2`     | `app=backend`, `version=v2`         |
| `pod-canary` | `app=backend`, `version=v2`, `track=canary` |

1. Create all three pods using the `nginx:alpine` image
2. Create a Service named `backend-svc` that routes traffic to **all three pods**
3. Create a second Service named `canary-svc` that routes traffic **only to `pod-canary`**

<details>
<summary>✅ Answer</summary>

```bash
# Create the three pods
kubectl run pod-v1 --image=nginx:alpine --labels="app=backend,version=v1"
kubectl run pod-v2 --image=nginx:alpine --labels="app=backend,version=v2"
kubectl run pod-canary --image=nginx:alpine --labels="app=backend,version=v2,track=canary"
```

```yaml
# backend-svc — selects all pods with app=backend
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
```

```yaml
# canary-svc — selects only pod-canary using the unique track=canary label
apiVersion: v1
kind: Service
metadata:
  name: canary-svc
spec:
  selector:
    app: backend
    track: canary
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
```

```bash
kubectl apply -f backend-svc.yaml
kubectl apply -f canary-svc.yaml

# Verify each service selects the correct endpoints
kubectl get endpoints backend-svc
kubectl get endpoints canary-svc

# Describe to confirm selector
kubectl describe svc backend-svc
kubectl describe svc canary-svc
```

> **Key Concept:** Services use label selectors to route traffic to matching pods. By adding a unique label (`track=canary`) to a subset of pods you can target them with a separate service — a common pattern in canary deployments.

</details>

---

