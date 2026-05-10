# 📌 Kustomize

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Kustomize Customization Tool  
> **Total Questions:** 6

---

## 🟢 Easy Questions

---

### Question 1 — Create a Basic Kustomization File
> ⏱️ **Recommended Time: 5 minutes**

Create a `kustomization.yaml` file in a directory that:
- References a base Kubernetes manifest file named `deployment.yaml`
- Includes the namespace `production`
- Applies a common label `app: myapp` to all resources

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: production

resources:
  - deployment.yaml

commonLabels:
  app: myapp
```

**Key Concept:** A `kustomization.yaml` file is the entry point for kustomize. It declares the resources to include and common customizations like namespaces and labels that apply to all manifests.

</details>

---

### Question 2 — Apply a Name Prefix with Kustomize
> ⏱️ **Recommended Time: 5 minutes**

Modify a `kustomization.yaml` to add a prefix `dev-` to the names of all resources.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namePrefix: dev-

resources:
  - deployment.yaml
  - service.yaml
```

When this kustomization is applied, a Deployment named `myapp` becomes `dev-myapp`, and a Service named `app-service` becomes `dev-app-service`.

**Key Concept:** `namePrefix` prepends a string to all resource names, useful for environment-specific naming conventions.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Set Environment Variables with Kustomize
> ⏱️ **Recommended Time: 5 minutes**

Build a `kustomization.yaml` that sets environment variables `ENV=production` and `LOG_LEVEL=info` on Pods via a ConfigMap.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml

configMapGenerator:
  - name: app-env
    literals:
      - ENV=production
      - LOG_LEVEL=info
```

Then reference this ConfigMap in your Deployment via `envFrom: configMapRef`.

**Key Concept:** `configMapGenerator` automatically generates a ConfigMap from literals or files, and kustomize manages naming to ensure rollouts when the config changes.

</details>

---

### Question 4 — Overlay Structure with Dev, Staging, and Production
> ⏱️ **Recommended Time: 10 minutes**

Create a kustomize overlay structure with:
- A `base/` directory containing the common Deployment and Service
- Three overlay directories: `overlays/dev`, `overlays/staging`, `overlays/prod`
- Each overlay sets a different replica count and resource limits

Show the directory structure and one overlay's `kustomization.yaml`.

<details>
<summary>✅ Answer</summary>

Directory structure:
```
.
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

**base/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
```

**overlays/dev/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

replicas:
  - name: myapp
    count: 1

commonLabels:
  env: dev
```

**overlays/prod/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

replicas:
  - name: myapp
    count: 3

commonLabels:
  env: prod

# Can also include resource patches for production-specific configs
```

**Key Concept:** Overlays allow you to maintain a single base configuration and customize it per environment without duplicating manifest files.

</details>

---

### Question 5 — Patch a Container Image with Kustomize
> ⏱️ **Recommended Time: 10 minutes**

Use kustomize to patch a Deployment's container image from `myapp:v1.0` to `myapp:v2.0` in the production overlay without editing the base Deployment.

<details>
<summary>✅ Answer</summary>

**overlays/prod/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

images:
  - name: myapp
    newTag: v2.0
```

Or using a strategic merge patch:

**overlays/prod/deployment-patch.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0
```

**overlays/prod/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

patchesStrategicMerge:
  - deployment-patch.yaml
```

Build with: `kustomize build overlays/prod/`

**Key Concept:** `images` is simpler for tag updates; `patchesStrategicMerge` allows deeper modifications to any field in a resource.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Multi-Overlay Setup with Resource Inheritance and Patching
> ⏱️ **Recommended Time: 15 minutes**

Design a kustomize structure for a microservices application with:
- A `base/` containing a generic Service and Deployment template
- A `common/` overlay that adds monitoring labels and resource requests
- Environment overlays (`dev`, `prod`) that inherit from `common/` and apply environment-specific patches
- The `prod` overlay must set 3 replicas, add pod anti-affinity, and use a different image registry

Provide the complete `kustomization.yaml` files for the prod overlay and common overlay.

<details>
<summary>✅ Answer</summary>

Directory structure:
```
.
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── overlays/
│   ├── common/
│   │   ├── kustomization.yaml
│   │   └── resource-patch.yaml
│   ├── dev/
│   │   └── kustomization.yaml
│   └── prod/
│       ├── kustomization.yaml
│       ├── deployment-patch.yaml
│       └── pod-affinity-patch.yaml
```

**overlays/common/resource-patch.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    metadata:
      labels:
        monitoring: enabled
    spec:
      containers:
        - name: myapp
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

**overlays/common/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

commonLabels:
  managed-by: kustomize

patchesStrategicMerge:
  - resource-patch.yaml
```

**overlays/prod/deployment-patch.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: myapp
          image: prod-registry.com/myapp:v1.0
```

**overlays/prod/pod-affinity-patch.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - myapp
                topologyKey: kubernetes.io/hostname
```

**overlays/prod/kustomization.yaml:**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../common

commonLabels:
  env: prod

patchesStrategicMerge:
  - deployment-patch.yaml
  - pod-affinity-patch.yaml
```

Build with: `kustomize build overlays/prod/ | kubectl apply -f -`

**Key Concept:** Layered kustomization allows you to compose configurations—base → common → environment—reusing policies and avoiding duplication. Multiple patches apply in order, enabling sophisticated multi-environment deployments.

</details>

---

