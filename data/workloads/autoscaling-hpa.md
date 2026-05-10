# 📈 Autoscaling & HPA

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Horizontal Pod Autoscaler (HPA) & Manual Scaling  
> **Total Questions:** 8

---

> ℹ️ **Scope Note:** The CKA exam tests **HPA** (Horizontal Pod Autoscaler) and **manual scaling**. VPA (Vertical Pod Autoscaler) is **not** a CKA topic — it is excluded from this file.

---

## 🟢 Easy Questions

---

### Question 1 — Create an HPA Using kubectl autoscale
> ⏱️ **Recommended Time: 4 minutes**

A Deployment named `web-app` in the `default` namespace is already running. Create a Horizontal Pod Autoscaler that:

- Targets the `web-app` Deployment
- Maintains a minimum of `2` replicas and a maximum of `8` replicas
- Scales when average CPU utilisation exceeds `50%`

<details>
<summary>✅ Answer</summary>

```bash
# Imperative — fastest in the exam
kubectl autoscale deployment web-app \
  --min=2 \
  --max=8 \
  --cpu-percent=50

# Verify
kubectl get hpa web-app
```

Expected output:

```
NAME      REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
web-app   Deployment/web-app   0%/50%    2         8         2          30s
```

> **Key Concept:** `kubectl autoscale` is the fastest way to create an HPA in the exam. It creates an `autoscaling/v2` HPA targeting the named resource. The Metrics Server must be installed for CPU metrics to be collected — without it, `TARGETS` shows `<unknown>/50%`.

</details>

---

### Question 2 — Inspect an HPA
> ⏱️ **Recommended Time: 4 minutes**

An HPA named `web-app` exists in the `default` namespace. Answer the following:

1. What is the current CPU utilisation vs the target?
2. How many replicas are currently running?
3. What are the minimum and maximum replica bounds?

<details>
<summary>✅ Answer</summary>

```bash
# Quick overview
kubectl get hpa web-app

# Detailed view including events and conditions
kubectl describe hpa web-app
```

Key fields from `kubectl get hpa`:

```
NAME      REFERENCE            TARGETS    MINPODS   MAXPODS   REPLICAS   AGE
web-app   Deployment/web-app   23%/50%    2         8         3          5m
```

- **TARGETS** → `current%/target%` — current CPU vs threshold
- **REPLICAS** → current number of running pods
- **MINPODS / MAXPODS** → scaling bounds

```bash
# Check HPA conditions and events for troubleshooting
kubectl describe hpa web-app | grep -A 10 Conditions
kubectl describe hpa web-app | grep -A 10 Events
```

> **Key Concept:** `kubectl get hpa` gives a quick at-a-glance status. `kubectl describe hpa` reveals the full condition list including `AbleToScale`, `ScalingActive`, and `ScalingLimited` — these are the first place to look when an HPA is not behaving as expected.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Manually Scale a Deployment
> ⏱️ **Recommended Time: 4 minutes**

A Deployment named `api-server` in the `production` namespace currently has `3` replicas. Scale it to `6` replicas imperatively, then verify.

<details>
<summary>✅ Answer</summary>

```bash
# Scale imperatively
kubectl scale deployment api-server --replicas=6 -n production

# Verify
kubectl get deployment api-server -n production

# Watch pods come up
kubectl get pods -n production -l app=api-server --watch
```

> **Key Concept:** `kubectl scale` directly sets the `spec.replicas` field. If an HPA is also attached to the same Deployment, it will **override the manual scale** the next time it reconciles — the HPA always wins. To permanently fix replica count, either delete the HPA or set both `--min` and `--max` to the desired value.

</details>

---

### Question 4 — Create an HPA Using a Manifest
> ⏱️ **Recommended Time: 7 minutes**

Create an HPA named `backend-hpa` in the `default` namespace that targets the Deployment `backend`, scales between `3` and `10` replicas, and triggers scale-up when average CPU utilisation exceeds `60%`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

```bash
kubectl apply -f backend-hpa.yaml

# Verify
kubectl get hpa backend-hpa
kubectl describe hpa backend-hpa
```

> **Key Concept:** The `autoscaling/v2` API (stable since Kubernetes 1.23) supports multiple metrics types: `Resource` (CPU/memory), `Pods`, `Object`, and `External`. The `scaleTargetRef` can point to a `Deployment`, `ReplicaSet`, or `StatefulSet`. CPU metrics require the target pods to have **resource requests defined** — without requests, the HPA cannot calculate utilisation percentages.

</details>

---

### Question 5 — Observe HPA Scale-Up Under Load
> ⏱️ **Recommended Time: 8 minutes**

An HPA named `web-app` targets the `web-app` Deployment (min `2`, max `8`, CPU target `50%`). The Deployment currently has `2` replicas. Generate CPU load on the pods and observe the HPA scaling up.

<details>
<summary>✅ Answer</summary>

```bash
# Confirm current state
kubectl get hpa web-app
kubectl get deployment web-app

# Generate CPU load by running an infinite loop in a separate pod
kubectl run load-gen \
  --image=busybox:1.28 \
  --restart=Never \
  -- sh -c "while true; do wget -q -O- http://web-app-svc/; done"

# Watch the HPA in real time — replicas will increase as CPU rises above 50%
kubectl get hpa web-app --watch

# Also watch the Deployment replica count
kubectl get deployment web-app --watch

# Stop the load generator to observe scale-down (takes ~5 min due to cooldown)
kubectl delete pod load-gen
```

> **Key Concept:** HPA scale-up is relatively fast (default: 15-second sync loop). Scale-down is deliberately slow — by default the HPA waits **5 minutes** of sustained low utilisation before scaling down, to avoid flapping. The `--watch` flag on `kubectl get hpa` streams live updates and is the exam-friendly way to observe autoscaling in action.

</details>

---

### Question 6 — Delete an HPA Without Affecting the Deployment
> ⏱️ **Recommended Time: 5 minutes**

An HPA named `web-app` is attached to the `web-app` Deployment. Delete the HPA and confirm that the Deployment and its pods continue running unaffected.

<details>
<summary>✅ Answer</summary>

```bash
# Check current replica count before deletion
kubectl get deployment web-app
kubectl get hpa web-app

# Delete the HPA
kubectl delete hpa web-app

# Verify the HPA is gone
kubectl get hpa

# Verify the Deployment is still running with the same replicas
kubectl get deployment web-app
kubectl get pods -l app=web-app
```

> **Key Concept:** Deleting an HPA does **not** affect the Deployment or its pods. The Deployment retains whatever replica count was last set by the HPA. After deletion, the replica count becomes static — no more automatic scaling. To re-enable autoscaling, create a new HPA targeting the Deployment.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Configure HPA Scale-Down Stabilization Window
> ⏱️ **Recommended Time: 10 minutes**

An HPA named `web-app` is scaling down too aggressively, causing brief traffic drops. Configure the HPA to:

- Still scale **up** as fast as possible (no stabilization)
- Wait at least **3 minutes** of sustained low utilisation before scaling **down**
- Scale down by at most **1 pod per 60 seconds**

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0      # scale up immediately
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15                # allow doubling replicas every 15s
    scaleDown:
      stabilizationWindowSeconds: 180    # wait 3 minutes before scaling down
      policies:
      - type: Pods
        value: 1
        periodSeconds: 60               # remove at most 1 pod per minute
```

```bash
kubectl apply -f web-app-hpa.yaml

# Verify the behavior section is set
kubectl get hpa web-app -o yaml | grep -A 20 behavior
```

> **Key Concept:** The `behavior` field (available in `autoscaling/v2`) gives fine-grained control over scale-up and scale-down policies. `stabilizationWindowSeconds` prevents flapping by requiring the metric to stay below threshold for the full window before acting. `policies` limit the rate of change — `type: Pods` caps by absolute pod count, `type: Percent` caps by percentage of current replicas.

</details>

---

### Question 8 — Troubleshoot an HPA Stuck at \<unknown\> Metrics
> ⏱️ **Recommended Time: 9 minutes**

An HPA named `backend-hpa` in the `default` namespace is showing `<unknown>/60%` for its CPU target and has not scaled despite high traffic. Identify and fix the root causes.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check the HPA status and conditions
kubectl describe hpa backend-hpa

# Look for conditions like:
# - "FailedGetResourceMetric" → Metrics Server not available or pod has no resource requests
# - "ScalingActive: False"    → HPA cannot read metrics

# Step 2 — Check if Metrics Server is running
kubectl get pods -n kube-system | grep metrics-server

# If missing, install it:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Step 3 — Check that the target pods have CPU requests defined
kubectl get deployment backend -o yaml | grep -A 5 resources

# If resources are missing, the HPA cannot compute utilisation — patch it:
kubectl patch deployment backend --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/resources",
    "value": {
      "requests": {"cpu": "100m", "memory": "128Mi"},
      "limits":   {"cpu": "200m", "memory": "256Mi"}
    }
  }
]'

# Step 4 — Verify metrics are now flowing
kubectl top pods -l app=backend
kubectl get hpa backend-hpa --watch
# TARGETS should now show a real percentage instead of <unknown>
```

Root causes summary:

| Symptom                | Root Cause                   | Fix                                        |
|------------------------|------------------------------|--------------------------------------------|
| `<unknown>/60%`        | Metrics Server not installed | Install Metrics Server                     |
| `<unknown>/60%`        | Pod has no CPU `requests`    | Add resource requests to the pod spec      |
| `ScalingActive: False` | Target Deployment not found  | Check `scaleTargetRef` name/namespace      |
| Replicas stuck at min  | CPU below threshold          | Expected behaviour — generate load to test |

> **Key Concept:** The two most common HPA failure modes in the CKA exam are: (1) **Metrics Server not installed** — `kubectl top` also fails in this case, and (2) **missing resource requests on the target pods** — HPA calculates utilisation as `actual usage / requested`, so without a request value the percentage is undefined.

</details>

---

