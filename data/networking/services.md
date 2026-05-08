# 🌐 Services

> **CKA Exam Domain:** Services & Networking  
> **Topic:** Services  
> **Total Questions:** 8

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

### Question 1 — Create a ClusterIP Service
> ⏱️ **Recommended Time: 5 minutes**

A Deployment named `backend` in the `default` namespace runs pods with the label `app=backend` on port `8080`. Create a `ClusterIP` Service named `backend-svc` that exposes port `80` and forwards traffic to port `8080` on the pods. Verify connectivity from another pod.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
  namespace: default
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
  - port: 80           # port the Service listens on
    targetPort: 8080   # port on the pod
```

```bash
kubectl apply -f backend-svc.yaml

# Verify the Service and its endpoints
kubectl get service backend-svc
kubectl get endpoints backend-svc

# Test connectivity from another pod
kubectl run test-pod --image=busybox:1.28 --restart=Never -- \
  wget -qO- http://backend-svc.default.svc.cluster.local

# Or using the short DNS name (within the same namespace)
kubectl run test-pod --image=busybox:1.28 --restart=Never -- \
  wget -qO- http://backend-svc
```

> **Key Concept:** `ClusterIP` is the default Service type — it gives the Service a stable internal IP reachable only within the cluster. The `selector` matches pods by label; all matched pods become **endpoints**. The DNS name `<service>.<namespace>.svc.cluster.local` is always resolvable from any pod in the cluster.

</details>

---

### Question 2 — Create a NodePort Service
> ⏱️ **Recommended Time: 5 minutes**

Create a `NodePort` Service named `web-nodeport` in the `default` namespace that:

- Selects pods with label `app=web`
- Exposes port `80` on the Service
- Forwards to port `8080` on the pods
- Uses node port `30080`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
  namespace: default
spec:
  type: NodePort
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080    # must be in range 30000–32767; omit to auto-assign
```

```bash
kubectl apply -f web-nodeport.yaml

# Verify
kubectl get service web-nodeport

# Access from outside the cluster using any node's IP
kubectl get nodes -o wide   # get NODE IP
curl http://<NODE-IP>:30080
```

> **Key Concept:** `NodePort` opens a static port on **every node** in the cluster. Traffic hitting `<any-node-IP>:<nodePort>` is forwarded to the Service, then to a pod. Valid node port range is `30000–32767`. If `nodePort` is omitted, Kubernetes assigns one automatically. NodePort is commonly used in on-prem or lab environments where a LoadBalancer is unavailable.

</details>

---

### Question 3 — Expose a Deployment with kubectl expose
> ⏱️ **Recommended Time: 4 minutes**

A Deployment named `api` in the `default` namespace exposes its containers on port `3000`. Imperatively create a `ClusterIP` Service named `api-svc` that exposes port `80` and forwards to port `3000`.

<details>
<summary>✅ Answer</summary>

```bash
# Expose imperatively
kubectl expose deployment api \
  --name=api-svc \
  --port=80 \
  --target-port=3000 \
  --type=ClusterIP

# Verify
kubectl get service api-svc
kubectl describe service api-svc

# Check endpoints are populated
kubectl get endpoints api-svc
```

> **Key Concept:** `kubectl expose` is the fastest way to create a Service in the exam. It automatically copies the Deployment's pod selector labels into the Service. Always verify with `kubectl get endpoints` — if endpoints are empty, the selector is not matching any pods. Specify `--type` explicitly; default is `ClusterIP`.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Create a LoadBalancer Service
> ⏱️ **Recommended Time: 6 minutes**

Create a `LoadBalancer` Service named `web-lb` in the `default` namespace that selects pods with label `app=web`, exposes port `80`, and forwards to port `8080`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-lb
  namespace: default
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 8080
```

```bash
kubectl apply -f web-lb.yaml

# Check the external IP (may show <pending> in bare-metal/lab environments)
kubectl get service web-lb --watch

# In cloud environments (GKE, EKS, AKS), EXTERNAL-IP will be populated
# In lab/bare-metal, it stays <pending> unless MetalLB or similar is installed

# Access via external IP
curl http://<EXTERNAL-IP>:80
```

> **Key Concept:** `LoadBalancer` provisions an external load balancer via the cloud provider (GCP, AWS, Azure). In lab environments without a cloud provider, the `EXTERNAL-IP` stays `<pending>` — this is expected. `LoadBalancer` is a superset of `NodePort`: it also opens a node port and creates a ClusterIP. All three types (ClusterIP, NodePort) are accessible once a LoadBalancer Service is created.

</details>

---

### Question 5 — Create a Headless Service
> ⏱️ **Recommended Time: 7 minutes**

Create a headless Service named `db-headless` in the `default` namespace that selects pods with label `app=db` on port `5432`. Verify that DNS returns individual pod IPs instead of a single ClusterIP.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db-headless
  namespace: default
spec:
  clusterIP: None      # KEY: makes it headless — no ClusterIP assigned
  selector:
    app: db
  ports:
  - port: 5432
    targetPort: 5432
```

```bash
kubectl apply -f db-headless.yaml

# Verify — ClusterIP shows None
kubectl get service db-headless
# NAME          TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)    AGE
# db-headless   ClusterIP   None         <none>        5432/TCP   5s

# DNS lookup returns individual pod IPs (one A record per pod)
kubectl run dns-test --image=busybox:1.28 --restart=Never -- \
  nslookup db-headless.default.svc.cluster.local
# Returns multiple A records, one per matching pod

# For StatefulSets, individual pods are reachable via:
# <pod-name>.<service-name>.<namespace>.svc.cluster.local
```

> **Key Concept:** A headless Service (`clusterIP: None`) does not get a virtual IP. Instead, DNS returns the IPs of all matching pods directly. This is essential for **StatefulSets** where clients need to address individual pods (e.g., database replicas, Kafka brokers). Each StatefulSet pod gets a stable DNS entry: `<pod-name>.<svc-name>.<namespace>.svc.cluster.local`.

</details>

---

### Question 6 — Debug a Service with No Endpoints
> ⏱️ **Recommended Time: 7 minutes**

A Service named `backend-svc` in the `default` namespace has no endpoints and traffic is not reaching any pods. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Confirm no endpoints
kubectl get endpoints backend-svc
# NAME          ENDPOINTS   AGE
# backend-svc   <none>      2m

# Step 2 — Check the Service selector
kubectl get service backend-svc -o yaml | grep -A 5 selector
# selector:
#   app: backend-api    ← what the Service is looking for

# Step 3 — Check labels on the pods
kubectl get pods --show-labels
# NAME            LABELS
# backend-pod-x   app=backend    ← label is "backend", not "backend-api"

# Root cause: selector mismatch

# Step 4a — Fix the Service selector to match pod labels
kubectl patch service backend-svc \
  --type merge \
  -p '{"spec":{"selector":{"app":"backend"}}}'

# OR Step 4b — Fix the pod labels to match the Service selector
kubectl label pod <pod-name> app=backend-api --overwrite

# Step 5 — Verify endpoints are now populated
kubectl get endpoints backend-svc
# NAME          ENDPOINTS           AGE
# backend-svc   10.244.1.5:8080     2m
```

Common causes of empty endpoints:

| Cause | Check | Fix |
|-------|-------|-----|
| Selector mismatch | `kubectl get svc -o yaml` vs `kubectl get pods --show-labels` | Fix selector or pod labels |
| No running pods | `kubectl get pods` | Fix pod/deployment issues |
| Wrong namespace | `kubectl get svc -n <ns>` | Use correct namespace |
| Pod not Ready | `kubectl describe pod` — readiness probe failing | Fix readiness probe |
| `targetPort` wrong | `kubectl describe svc` | Match to container's `containerPort` |

> **Key Concept:** Empty endpoints almost always mean a **label selector mismatch** between the Service and the pods. The Service selector must exactly match the labels on the pod template — check both with `kubectl get service -o yaml` and `kubectl get pods --show-labels`. The second most common cause is pods failing their readiness probe — only Ready pods are added to endpoints.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — ExternalName Service
> ⏱️ **Recommended Time: 8 minutes**

Your application in the `default` namespace needs to connect to an external database at `db.example.com`. Create an `ExternalName` Service named `external-db` so pods can reach it via the stable in-cluster DNS name `external-db.default.svc.cluster.local` without hardcoding the external hostname.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: default
spec:
  type: ExternalName
  externalName: db.example.com   # DNS name to CNAME to
  # No selector — ExternalName doesn't route to pods
```

```bash
kubectl apply -f external-db.yaml

# Verify
kubectl get service external-db
# TYPE         CLUSTER-IP   EXTERNAL-IP     PORT(S)
# ExternalName  <none>       db.example.com  <none>

# From inside a pod, resolve the in-cluster name
kubectl run dns-test --image=busybox:1.28 --restart=Never -- \
  nslookup external-db.default.svc.cluster.local

# Returns a CNAME pointing to db.example.com
# Then resolves db.example.com to its IP

# Application can now use:
# external-db  (same namespace)
# external-db.default.svc.cluster.local  (FQDN)
# Instead of hardcoding db.example.com
```

> **Key Concept:** `ExternalName` Services create a DNS CNAME alias inside the cluster. No proxying or load balancing occurs — it's purely a DNS redirect. This is useful for: (1) abstracting external service hostnames so they can be changed by updating only the Service, (2) migrating services into the cluster by changing the Service type without updating application config.

</details>

---

### Question 8 — Troubleshoot Service Reachable by IP but Not by DNS
> ⏱️ **Recommended Time: 9 minutes**

A Service named `api-svc` in the `default` namespace is reachable via its ClusterIP but DNS resolution of `api-svc` fails from within pods. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Confirm the Service has a ClusterIP and endpoints
kubectl get service api-svc
kubectl get endpoints api-svc

# Step 2 — Verify IP works but DNS doesn't
kubectl run debug --image=busybox:1.28 --restart=Never -it -- sh

# Inside the pod:
wget -qO- http://10.96.x.x      # ClusterIP — works ✅
wget -qO- http://api-svc         # DNS — fails ❌
nslookup api-svc                 # SERVFAIL or timeout

# Step 3 — Check CoreDNS is running
kubectl get pods -n kube-system | grep coredns
# If pods are CrashLoopBackOff or not running → CoreDNS is the issue

# Step 4 — Check CoreDNS logs for errors
kubectl logs -n kube-system -l k8s-app=kube-dns

# Step 5 — Check the pod's /etc/resolv.conf
kubectl exec debug -- cat /etc/resolv.conf
# Should contain:
# nameserver 10.96.0.10        (CoreDNS ClusterIP)
# search default.svc.cluster.local svc.cluster.local cluster.local

# Step 6 — Check the kube-dns Service
kubectl get service kube-dns -n kube-system
# Should be ClusterIP 10.96.0.10 with endpoints pointing to CoreDNS pods

# Step 7 — If CoreDNS is crashed, restart it
kubectl rollout restart deployment coredns -n kube-system

# Step 8 — If resolv.conf is wrong (wrong nameserver), check kubelet config
# The clusterDNS field in kubelet config must match the kube-dns Service ClusterIP
cat /var/lib/kubelet/config.yaml | grep clusterDNS
```

DNS resolution chain:

```
Pod queries "api-svc"
    ↓
/etc/resolv.conf → nameserver = CoreDNS ClusterIP (10.96.0.10)
    ↓
CoreDNS looks up api-svc.default.svc.cluster.local
    ↓
Returns ClusterIP of api-svc
    ↓
kube-proxy routes to pod endpoint
```

> **Key Concept:** Service DNS relies on CoreDNS running in `kube-system`. If IP works but DNS doesn't, the problem is almost always: (1) CoreDNS pods are down/crashing, (2) the `kube-dns` Service has no endpoints, or (3) the pod's `/etc/resolv.conf` is misconfigured (wrong nameserver). Start by checking CoreDNS pod health, then the kube-dns Service, then the pod's resolv.conf.

</details>

---

## 📌 Quick Reference

### Service Types

| Type | Accessible From | Use Case |
|------|----------------|----------|
| `ClusterIP` | Inside cluster only | Internal service-to-service communication |
| `NodePort` | Outside via `<NodeIP>:<NodePort>` | Dev/lab external access, on-prem |
| `LoadBalancer` | Outside via cloud LB IP | Production external access on cloud |
| `ExternalName` | Inside cluster (CNAME) | Alias for external DNS names |
| Headless (`clusterIP: None`) | Inside cluster (pod IPs) | StatefulSets, direct pod addressing |

### Port Fields

```yaml
ports:
- port: 80          # Port the Service listens on (clients connect here)
  targetPort: 8080  # Port on the pod containers
  nodePort: 30080   # Port on every node (NodePort/LoadBalancer only)
  protocol: TCP     # TCP (default), UDP, SCTP
```

### DNS Name Formats

```
<service>                                    → same namespace only
<service>.<namespace>                        → cross-namespace
<service>.<namespace>.svc.cluster.local      → FQDN (always works)
<pod>.<service>.<namespace>.svc.cluster.local → StatefulSet pod (headless)
```

### Useful Commands

```bash
# Expose a deployment as a Service
kubectl expose deployment <name> --port=<port> --target-port=<port> --type=<type>

# List Services
kubectl get services -A

# Check endpoints
kubectl get endpoints <service-name>

# Describe Service (shows selector, ports, endpoints)
kubectl describe service <name>

# Test DNS from inside cluster
kubectl run dns-test --image=busybox:1.28 --restart=Never -- \
  nslookup <service-name>.<namespace>.svc.cluster.local

# Test connectivity from inside cluster
kubectl run curl-test --image=curlimages/curl --restart=Never -- \
  curl -s http://<service-name>.<namespace>.svc.cluster.local
```

### Related Topics

- 🔗 [Network Policies](./network-policies.md) — control which pods can reach a Service
- 🔗 [Ingress](./ingress.md) — HTTP/HTTPS routing to Services from outside the cluster
- 🔗 [Multi-Container Pods](../workloads/multi-container-pods.md) — containers in the same pod communicate via localhost, not Services
