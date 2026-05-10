# 🔧 Custom Resource Definitions (CRDs)

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Custom Resource Definitions  
> **Total Questions:** 3

---

## 🟢 Easy Questions

---

### Question 1 — List Custom Resource Definitions
> ⏱️ **Recommended Time: 3 minutes**

Your team has deployed an operator in the cluster that uses Custom Resource Definitions (CRDs). List all CRDs currently installed in the cluster.

<details>
<summary>✅ Answer</summary>

```bash
# List all CRDs in the cluster
kubectl get crd

# Get more detailed information
kubectl get crd -o wide

# Describe a specific CRD
kubectl describe crd <crd-name>
```

**Example output:**
```
NAME                          CREATED AT
certificates.cert-manager.io  2024-01-15T10:30:45Z
issuers.cert-manager.io       2024-01-15T10:30:45Z
```

> **Key Concept:** CRDs are cluster-scoped resources that extend the Kubernetes API. You can query them like any other Kubernetes resource using `kubectl get crd`.

</details>

---


## 🟡 Medium Questions

---

### Question 2 — Create a Custom Resource Instance
> ⏱️ **Recommended Time: 4 minutes**

A CRD for `Database` has been installed in the cluster. Create an instance of this custom resource named `prod-db` in the `production` namespace with the following specifications:
- Database type: PostgreSQL
- Replicas: 3
- Storage size: 100Gi

Use the following template and fill in the required fields.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: database.example.com/v1
kind: Database
metadata:
  name: prod-db
  namespace: production
spec:
  type: PostgreSQL
  replicas: 3
  storage:
    size: 100Gi
```

Apply with:
```bash
kubectl apply -f database.yaml

# Verify creation
kubectl get database -n production
kubectl describe database prod-db -n production
```

**Output:**
```
NAME      AGE
prod-db   2m
```

> **Key Concept:** Once a CRD is registered, you can create instances of that custom resource type just like built-in Kubernetes resources. The `apiVersion` and `kind` must match the CRD definition.

</details>

---

### Question 3 — Create and Apply a Custom Resource Definition
> ⏱️ **Recommended Time: 6 minutes**

Create a CRD that defines a custom resource called `Certificate` with the following properties:
- Kind: `Certificate`
- API Group: `security.example.com`
- API Version: `v1`
- Scope: Namespaced
- Names:
  - Singular: `certificate`
  - Plural: `certificates`
  - Short name: `cert`

Apply the CRD to the cluster and verify it's installed.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: certificates.security.example.com
spec:
  group: security.example.com
  names:
    kind: Certificate
    plural: certificates
    singular: certificate
    shortNames:
    - cert
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              domain:
                type: string
              issuer:
                type: string
```

Apply the CRD:
```bash
kubectl apply -f certificate-crd.yaml

# Verify the CRD is installed
kubectl get crd certificates.security.example.com

# Check CRD details
kubectl describe crd certificates.security.example.com
```

**Output:**
```
NAME                                  CREATED AT
certificates.security.example.com     2024-01-15T11:30:00Z
```

Now you can create instances:
```yaml
apiVersion: security.example.com/v1
kind: Certificate
metadata:
  name: my-cert
spec:
  domain: example.com
  issuer: letsencrypt
```

> **Key Concept:** CRDs are defined using the `CustomResourceDefinition` kind. They extend the Kubernetes API and allow you to create custom resources using `kubectl`. The `scope` determines if the resource is cluster-wide (Cluster) or namespace-specific (Namespaced).

</details>

---


## 🔴 Hard Questions

---

### Question 4 — Troubleshoot CRD and Custom Resource Issues
> ⏱️ **Recommended Time: 8 minutes**

You've deployed a CRD and created a custom resource instance, but when you run `kubectl get myresources`, it returns `no resources found`. However, when you check `kubectl api-resources`, the custom resource is listed. Identify and resolve the issue.

<details>
<summary>✅ Answer</summary>

**Common causes:**

1. **CRD not in correct API group:**
   ```bash
   # Check the apiVersion of your custom resource
   kubectl get myresources.group.name -o yaml
   
   # Verify it matches the CRD's group
   kubectl describe crd myresources.group.name
   ```

2. **Resource isn't created yet in the default namespace:**
   ```bash
   # Check all namespaces
   kubectl get myresources --all-namespaces
   
   # Or check specific namespace
   kubectl get myresources -n <namespace>
   ```

3. **CRD definition issue (scope mismatch):**
   ```bash
   # View CRD details
   kubectl describe crd myresources.group.name
   
   # Check if scope is Namespaced or Cluster
   ```

4. **Custom resource YAML syntax error:**
   ```bash
   # Verify the custom resource YAML
   kubectl apply -f custom-resource.yaml --dry-run=client -o yaml
   
   # Get validation error details
   kubectl describe myresource <name>
   ```

**Resolution steps:**
```bash
# 1. List CRDs to verify installation
kubectl get crd | grep myresources

# 2. Check all custom resources across namespaces
kubectl get myresources.group.name --all-namespaces

# 3. Verify the custom resource YAML matches CRD spec
kubectl get myresource <name> -o yaml

# 4. Check for events or errors
kubectl describe myresource <name>
kubectl get events --sort-by='.lastTimestamp'
```

> **Key Concept:** If `kubectl api-resources` shows your custom resource but `kubectl get` returns nothing, check: (1) the correct API group/version in your manifest, (2) which namespace the resource exists in, and (3) the CRD's scope (Namespaced vs Cluster).

</details>

---

