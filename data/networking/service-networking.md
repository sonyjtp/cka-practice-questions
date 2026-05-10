# 🔀 Service Networking

> **CKA Exam Domain:** Networking  
> **Topic:** ClusterIP, NodePort, LoadBalancer, kube-proxy, iptables/IPVS, Endpoints  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** Services are one of the most heavily tested CKA topics. You must know all Service types, how kube-proxy implements ClusterIP using iptables/IPVS, how Endpoints work, and how to troubleshoot broken service connectivity.

---

## 🟢 Easy Questions

---

### Question 1 — Create Services of Each Type
> ⏱️ **Recommended Time: 5 minutes**

Create a `ClusterIP`, `NodePort`, and `headless` Service for a Deployment named `web` with label `app=web` on port 80.

<details>
<summary>✅ Answer</summary>

```bash
# ClusterIP (default) — internal cluster access only
kubectl expose deployment web --port=80 --target-port=80 --name=web-clusterip
# OR
kubectl create service clusterip web-clusterip --tcp=80:80

# NodePort — accessible via <NodeIP>:<NodePort>
kubectl expose deployment web --port=80 --target-port=80 \
  --type=NodePort --name=web-nodeport

# Headless — no ClusterIP, DNS returns pod IPs directly
kubectl expose deployment web --port=80 --target-port=80 \
  --cluster-ip=None --name=web-headless
```

```yaml
# ClusterIP
apiVersion: v1
kind: Service
metadata:
  name: web-clusterip
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP        # default
---
# NodePort
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080      # optional: specify port (30000-32767)
  type: NodePort
---
# Headless
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
  clusterIP: None        # headless
```

```bash
# Verify
kubectl get svc
# NAME            TYPE        CLUSTER-IP     PORT(S)
# web-clusterip   ClusterIP   10.96.45.12    80/TCP
# web-nodeport    NodePort    10.96.67.89    80:30080/TCP
# web-headless    ClusterIP   None           80/TCP        ← no IP
```

> **Key Concept:** `ClusterIP` is only reachable within the cluster. `NodePort` exposes the service on a static port on every node (useful for external access without a load balancer). `Headless` (clusterIP: None) skips the virtual IP — DNS returns the individual pod IPs directly, enabling clients to connect to specific pods (used by StatefulSets).

</details>

---

### Question 2 — Inspect Service Endpoints
> ⏱️ **Recommended Time: 4 minutes**

Inspect the Endpoints for a Service and explain what they represent.

<details>
<summary>✅ Answer</summary>

```bash
# View endpoints for all services
kubectl get endpoints
# NAME            ENDPOINTS                         AGE
# web-clusterip   10.244.0.5:80,10.244.1.7:80       5m
# web-headless    10.244.0.5:80,10.244.1.7:80       5m
# kubernetes      192.168.1.10:6443                 1d

# View endpoints for a specific service
kubectl get endpoints web-clusterip
kubectl describe endpoints web-clusterip
# Subsets:
#   Addresses:          10.244.0.5,10.244.1.7    ← Ready pods
#   NotReadyAddresses:  10.244.2.3               ← Pod not yet ready
#   Ports:              80/TCP

# If endpoints are empty — no pods match the selector
kubectl get endpoints web-clusterip
# NAME            ENDPOINTS   AGE
# web-clusterip   <none>      5m   ← no matching pods!

# Debug: check service selector vs pod labels
kubectl get svc web-clusterip -o jsonpath='{.spec.selector}'
# {"app":"web"}
kubectl get pods --show-labels | grep "app=web"
# No output → pod labels don't match!

# Fix pod labels
kubectl label pod <pod-name> app=web
```

> **Key Concept:** An `Endpoints` object (automatically created for each Service) lists the IP:port of all **Ready** pods matching the service's `selector`. kube-proxy watches Endpoints to program iptables/IPVS rules. When a Service has no endpoints, traffic to its ClusterIP is dropped. Empty endpoints = either no matching pods, pods not ready, or wrong selector/labels — the most common cause of "Connection refused" to a Service.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Trace How ClusterIP Works with iptables
> ⏱️ **Recommended Time: 8 minutes**

Explain how a ClusterIP Service is implemented by kube-proxy using iptables. Verify the rules on a node.

<details>
<summary>✅ Answer</summary>

```bash
# Get service ClusterIP
kubectl get svc web-clusterip
# NAME            CLUSTER-IP    PORT(S)
# web-clusterip   10.96.45.12   80/TCP

# On a node, view the iptables rules kube-proxy created
iptables -t nat -L KUBE-SERVICES | grep web-clusterip
# KUBE-SVC-XXXX  tcp  10.96.45.12:80  /* default/web-clusterip */

# View the service chain
iptables -t nat -L KUBE-SVC-XXXX
# KUBE-SEP-AAAA  statistic mode random probability 0.5000   ← pod 1 (50%)
# KUBE-SEP-BBBB  statistic mode random probability 1.0000   ← pod 2 (50%)

# View an endpoint chain (DNAT to actual pod IP)
iptables -t nat -L KUBE-SEP-AAAA
# DNAT  tcp  to:10.244.0.5:80   ← rewrite destination to pod IP

# Full traffic flow:
# Client → 10.96.45.12:80 → KUBE-SERVICES → KUBE-SVC-XXXX → KUBE-SEP-AAAA → DNAT → 10.244.0.5:80

# Test the service
kubectl run test --image=busybox:1.28 --restart=Never -- \
  wget -qO- http://10.96.45.12:80
# OR by DNS name
kubectl run test --image=busybox:1.28 --restart=Never -- \
  wget -qO- http://web-clusterip.default.svc.cluster.local

# View KUBE-POSTROUTING (masquerade for traffic leaving the node)
iptables -t nat -L KUBE-POSTROUTING
# MASQUERADE  /* kubernetes service traffic requiring SNAT */
```

Traffic flow:
```
Pod/Client
    ↓
iptables PREROUTING (nat table)
    ↓
KUBE-SERVICES chain
    ↓ (matches 10.96.45.12:80)
KUBE-SVC-XXXX chain (load balancing — random probability)
    ↓ (selects endpoint)
KUBE-SEP-AAAA chain
    ↓
DNAT → 10.244.0.5:80 (actual pod IP)
    ↓
Pod receives traffic
```

> **Key Concept:** ClusterIP is a **virtual IP** — no interface has this IP. kube-proxy programs iptables DNAT rules so that packets destined for the ClusterIP are rewritten to a real pod IP before routing. Load balancing is probabilistic — each `KUBE-SEP-*` chain has a `statistic mode random probability` rule that gives equal probability to each backend. This is why kube-proxy needs to watch Endpoints — every pod add/remove requires updating the probability weights.

</details>

---

### Question 4 — Create a Service for a StatefulSet Using Headless Service
> ⏱️ **Recommended Time: 7 minutes**

Create a headless Service for a StatefulSet `mysql` and demonstrate how each pod gets a stable DNS name.

<details>
<summary>✅ Answer</summary>

```yaml
# Headless service for StatefulSet
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: default
spec:
  clusterIP: None      # headless
  selector:
    app: mysql
  ports:
  - port: 3306
    targetPort: 3306
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql   # must match headless service name
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          value: "password"
        ports:
        - containerPort: 3306
```

```bash
kubectl apply -f mysql-statefulset.yaml

# Pods get predictable names
kubectl get pods -l app=mysql
# mysql-0   Running
# mysql-1   Running
# mysql-2   Running

# Each pod gets a stable DNS name:
# <pod-name>.<service-name>.<namespace>.svc.cluster.local
# mysql-0.mysql.default.svc.cluster.local
# mysql-1.mysql.default.svc.cluster.local
# mysql-2.mysql.default.svc.cluster.local

# Verify DNS resolution from another pod
kubectl run dns-test --image=busybox:1.28 --restart=Never -- \
  nslookup mysql-0.mysql.default.svc.cluster.local
# Server: 10.96.0.10
# Address: 10.96.0.10:53
# Name: mysql-0.mysql.default.svc.cluster.local
# Address: 10.244.1.5   ← direct pod IP (no VIP!)

# Headless service DNS returns ALL pod IPs
nslookup mysql.default.svc.cluster.local
# Address: 10.244.0.5   ← mysql-0
# Address: 10.244.1.6   ← mysql-1
# Address: 10.244.2.7   ← mysql-2
```

> **Key Concept:** Headless Services are essential for StatefulSets. Because `clusterIP: None`, there is no VIP — DNS for the Service returns all pod IPs, and DNS for `<pod>.<service>` returns the specific pod's IP. This gives each pod a stable network identity that persists across restarts (the pod name stays the same). Clients (like MySQL replicas) can address specific pods directly rather than going through a load balancer.

</details>

---

### Question 5 — ExternalName and LoadBalancer Services
> ⏱️ **Recommended Time: 6 minutes**

Create an `ExternalName` service that maps to an external database at `db.example.com`, and explain when `LoadBalancer` type is used.

<details>
<summary>✅ Answer</summary>

```yaml
# ExternalName — maps a service name to an external DNS name
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: default
spec:
  type: ExternalName
  externalName: db.example.com    # no selector, no endpoints
```

```bash
kubectl apply -f external-db.yaml

# DNS lookup of external-db returns a CNAME
kubectl run test --image=busybox:1.28 --restart=Never -- \
  nslookup external-db.default.svc.cluster.local
# external-db.default.svc.cluster.local  canonical name = db.example.com
# Name: db.example.com
# Address: 203.0.113.5

# Pods can now use a cluster-internal name instead of hardcoding external hostname
kubectl exec <pod> -- curl http://external-db:5432
```

```yaml
# LoadBalancer — provisions a cloud load balancer (AWS ELB, GCP LB, etc.)
apiVersion: v1
kind: Service
metadata:
  name: web-lb
spec:
  selector:
    app: web
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

```bash
kubectl apply -f web-lb.yaml

# In a cloud environment, EXTERNAL-IP is assigned
kubectl get svc web-lb
# NAME     TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)
# web-lb   LoadBalancer   10.96.45.12    34.102.150.50    80:31234/TCP
# ↑ ClusterIP still exists    ↑ Cloud LB IP

# In bare-metal (no cloud), EXTERNAL-IP stays <pending>
# Use MetalLB for bare-metal LoadBalancer support
```

Service types summary:

| Type | Access | Use Case |
|------|--------|---------|
| `ClusterIP` | Inside cluster only | Internal microservices |
| `NodePort` | `<NodeIP>:<NodePort>` | Dev/test external access |
| `LoadBalancer` | Cloud LB external IP | Production external access |
| `ExternalName` | DNS CNAME alias | Map to external services |
| Headless | Direct pod IPs | StatefulSets, custom discovery |

> **Key Concept:** `ExternalName` is useful for abstracting external services behind an in-cluster DNS name — if `db.example.com` changes, you update one Service instead of every app config. `LoadBalancer` builds on top of `NodePort` (it still allocates a NodePort) and additionally instructs the cloud provider to create a load balancer pointing to the node IPs on that NodePort.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Troubleshoot: Service Not Reachable
> ⏱️ **Recommended Time: 9 minutes**

A service `web-svc` in the `default` namespace is not reachable. Pods are Running. Systematically diagnose and fix.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify service exists and has a ClusterIP
kubectl get svc web-svc
# NAME      TYPE        CLUSTER-IP    PORT(S)
# web-svc   ClusterIP   10.96.45.12   80/TCP

# Step 2 — Check endpoints (most common cause!)
kubectl get endpoints web-svc
# NAME      ENDPOINTS   AGE
# web-svc   <none>      5m   ← NO endpoints!

# Step 3 — Compare service selector with pod labels
kubectl get svc web-svc -o jsonpath='{.spec.selector}'
# {"app":"web","version":"v1"}

kubectl get pods --show-labels
# NAME    LABELS
# web-0   app=web           ← missing version=v1 label!

# Fix: add missing label to pods
kubectl label pod web-0 version=v1

# Verify endpoints populated
kubectl get endpoints web-svc
# NAME      ENDPOINTS        AGE
# web-svc   10.244.0.5:80    5m  ✅

# Step 4 — Check targetPort matches container port
kubectl get svc web-svc -o jsonpath='{.spec.ports}'
# [{"port":80,"targetPort":8080}]

kubectl get pod web-0 -o jsonpath='{.spec.containers[0].ports}'
# [{"containerPort":80}]  ← container listens on 80, not 8080!

# Fix targetPort
kubectl patch svc web-svc -p '{"spec":{"ports":[{"port":80,"targetPort":80}]}}'

# Step 5 — Test connectivity directly to pod (bypass service)
kubectl exec test-pod -- wget -qO- http://10.244.0.5:80
# Works → pod is fine, issue is service

# Step 6 — Test connectivity via ClusterIP
kubectl exec test-pod -- wget -qO- http://10.96.45.12:80
# If still fails → kube-proxy iptables rules may be stale

# Restart kube-proxy to refresh rules
kubectl rollout restart daemonset kube-proxy -n kube-system

# Step 7 — Test via DNS name
kubectl exec test-pod -- wget -qO- http://web-svc.default.svc.cluster.local
# If DNS fails → CoreDNS issue (see coredns.md)
```

Systematic service troubleshooting checklist:

```
1. kubectl get svc          → service exists? correct port?
2. kubectl get endpoints    → endpoints populated?
3. Compare selector/labels  → do they match?
4. Check targetPort         → matches containerPort?
5. kubectl exec → pod IP    → pod itself works?
6. kubectl exec → ClusterIP → iptables rules correct?
7. kubectl exec → DNS name  → CoreDNS working?
```

> **Key Concept:** 90% of service connectivity issues are caused by: (1) **label/selector mismatch** (empty endpoints), or (2) **wrong targetPort** (endpoints exist but connections refused). Always check endpoints first — if they're empty, nothing else matters. The `targetPort` must match the port the container **actually listens on**, not the service's `port`.

</details>

---

### Question 7 — Understand Service DNS and FQDN
> ⏱️ **Recommended Time: 7 minutes**

Explain the full DNS name format for services and pods, and demonstrate DNS resolution from within a pod.

<details>
<summary>✅ Answer</summary>

```bash
# Service DNS format:
# <service-name>.<namespace>.svc.<cluster-domain>
# Default cluster domain: cluster.local

# Examples:
# web-svc.default.svc.cluster.local          (default namespace)
# web-svc.production.svc.cluster.local       (production namespace)
# kubernetes.default.svc.cluster.local       (kubernetes API service)

# From within the SAME namespace — short names work:
kubectl exec <pod> -- wget -qO- http://web-svc         # same namespace
kubectl exec <pod> -- wget -qO- http://web-svc:80      # with port

# From a DIFFERENT namespace — need namespace in name:
kubectl exec <pod> -n monitoring -- wget -qO- http://web-svc.default
kubectl exec <pod> -n monitoring -- wget -qO- http://web-svc.default.svc.cluster.local

# Check pod's DNS search domains
kubectl exec <pod> -- cat /etc/resolv.conf
# nameserver 10.96.0.10                            ← CoreDNS ClusterIP
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5

# The search domains explain why short names work:
# "web-svc" → tries "web-svc.default.svc.cluster.local" → resolves!

# Pod DNS format (for headless services):
# <pod-name>.<service-name>.<namespace>.svc.<cluster-domain>
# mysql-0.mysql.default.svc.cluster.local

# Pod IP DNS (with dashes instead of dots):
# 10-244-0-5.default.pod.cluster.local

# Resolve the kubernetes API service
kubectl exec <pod> -- nslookup kubernetes.default.svc.cluster.local
# Address: 10.96.0.1

# Resolve a service in another namespace
kubectl exec <pod> -- nslookup web-svc.production.svc.cluster.local
```

DNS name formats:

| Resource | DNS Name |
|----------|---------|
| Service (same ns) | `<svc>` |
| Service (any ns) | `<svc>.<ns>.svc.cluster.local` |
| StatefulSet Pod | `<pod>.<svc>.<ns>.svc.cluster.local` |
| Pod by IP | `<ip-dashes>.<ns>.pod.cluster.local` |

> **Key Concept:** Pods have `/etc/resolv.conf` injected by kubelet with `nameserver <CoreDNS-IP>` and search domains. The `ndots:5` option means any name with fewer than 5 dots is first tried as a relative name (with search domains appended) before being tried as absolute. This is why `web-svc` resolves — it becomes `web-svc.default.svc.cluster.local` via the search domain. Cross-namespace access requires at least the namespace in the name.

</details>

---

## 📌 Quick Reference

### Service Types

```
ClusterIP      Internal VIP — cluster-only access
NodePort       ClusterIP + port on every node (30000-32767)
LoadBalancer   NodePort + cloud load balancer
ExternalName   CNAME alias to external DNS name
Headless       clusterIP: None — direct pod IP DNS
```

### Service Commands

```bash
# Create
kubectl expose deployment <name> --port=<port> --type=<type>
kubectl create service clusterip <name> --tcp=<port>:<targetPort>

# Inspect
kubectl get svc
kubectl get endpoints <svc-name>
kubectl describe svc <svc-name>

# Test from pod
kubectl exec <pod> -- wget -qO- http://<svc-name>
kubectl exec <pod> -- nslookup <svc-name>
kubectl exec <pod> -- cat /etc/resolv.conf

# kube-proxy rules
iptables -t nat -L KUBE-SERVICES | grep <svc-name>
ipvsadm -ln | grep <cluster-ip>
```

### DNS Name Format

```
<service>.<namespace>.svc.cluster.local
<pod>.<service>.<namespace>.svc.cluster.local   (StatefulSet pods)
```

### Related Topics

- 🔗 [CoreDNS](./coredns.md) — DNS server that resolves service names
- 🔗 [Cluster Networking](./cluster-networking.md) — kube-proxy modes
- 🔗 [Ingress](./ingress.md) — HTTP routing on top of Services
- 🔗 [Network Policies](./network-policies.md) — controlling service traffic
