# 🔀 Kube-proxy & Service Load Balancing

> **CKA Exam Domain:** Networking  
> **Topic:** Kube-proxy, iptables vs IPVS, service traffic flow, endpoint management  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Understand kube-proxy role
> ⏱️ **Recommended Time: 4 minutes**

Explain what kube-proxy does and locate it on cluster nodes.

<details>
<summary>✅ Answer</summary>

```bash
# Kube-proxy is responsible for:
# 1. Service IP to Pod IP translation (ClusterIP → Pod endpoints)
# 2. Load balancing traffic to pods
# 3. NAT (Network Address Translation)
# 4. Userspace proxying (legacy) or iptables/IPVS (modern)

# Verify kube-proxy is running
kubectl get daemonset -n kube-system | grep kube-proxy
# kube-proxy           3        3        3        3            3           <none>   5m

# Check kube-proxy pod on nodes
kubectl get pods -n kube-system -o wide | grep kube-proxy
# kube-proxy-xxxxx         Ready   1/1     Running   0   5m   node1   ...
# kube-proxy-yyyyy         Ready   1/1     Running   0   5m   node2   ...
# kube-proxy-zzzzz         Ready   1/1     Running   0   5m   node3   ...

# Kube-proxy is a DaemonSet — runs on every node

# Check kube-proxy logs
kubectl logs -n kube-system -l k8s-app=kube-proxy -f

# View kube-proxy configuration
kubectl get daemonset -n kube-system kube-proxy -o yaml | grep -A 20 "args:"
# Look for: --proxy-mode=iptables or --proxy-mode=ipvs

# SSH to node to verify kube-proxy process
ssh node1
ps aux | grep kube-proxy
# Processes typically show: kube-proxy --proxy-mode=iptables (or ipvs)

# Check if iptables rules were created by kube-proxy
sudo iptables -L -n | head -20
# Look for: KUBE-SERVICES, KUBE-SVC-*, KUBE-SEP-*
```

Kube-proxy modes:

| Mode | Method | Performance | Use Case |
|------|--------|-------------|----------|
| **userspace** | Proxy in userspace | Slow (context switching) | Legacy, rarely used |
| **iptables** | Linux netfilter rules | Fast, standard | Most clusters |
| **IPVS** | Linux Virtual Server | Very fast, advanced | High-performance, many services |

> **Key Concept:** Kube-proxy runs as DaemonSet on every node. It implements service networking by creating iptables rules or IPVS rules that translate ClusterIP → Pod IP, distributing traffic across replicas.

</details>

---

### Question 2 — View service endpoints
> ⏱️ **Recommended Time: 4 minutes**

Understand how endpoints represent the pods backing a service.

<details>
<summary>✅ Answer</summary>

```bash
# Create a deployment and service
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: app
        image: busybox:1.28
        command: ["sh", "-c", "while true; do date; sleep 3600; done"]
---
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  selector:
    app: web
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
EOF

# View the service
kubectl get svc web-svc
# NAME      TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
# web-svc   ClusterIP   10.96.123.45    <none>        8080/TCP

# View endpoints (pods backing the service)
kubectl get endpoints web-svc
# NAME      ENDPOINTS                           AGE
# web-svc   10.244.1.5:8080,10.244.2.6:8080...  2m

# More detail
kubectl describe endpoints web-svc
# Name:         web-svc
# Namespace:    default
# Labels:       <none>
# Annotations:  <none>
# Subsets:
#   Addresses:          10.244.1.5, 10.244.2.6, 10.244.3.7
#   NotReadyAddresses:  <none>
#   Ports:
#     Name     Port  Protocol
#     ----     ----  --------
#     <unset>  8080  TCP

# Pod IPs match the Endpoints
kubectl get pods -l app=web -o wide
# NAME            READY   STATUS    IP           NODE
# web-deploy-xxx  1/1     Running   10.244.1.5   node1
# web-deploy-yyy  1/1     Running   10.244.2.6   node2
# web-deploy-zzz  1/1     Running   10.244.3.7   node3

# Endpoints update dynamically as pods are created/destroyed
kubectl scale deployment web-deploy --replicas=5
kubectl get endpoints web-svc
# Endpoints now show 5 pod IPs

# When a pod dies, it's removed from endpoints
kubectl delete pod web-deploy-xxx
kubectl get endpoints web-svc
# Endpoints updated instantly to remove that IP
```

Service vs Endpoints relationship:

```yaml
# Service defines: selector + port mapping
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  selector:
    app: web           # Which pods are "backing" this service
  ports:
  - port: 8080         # Service port
    targetPort: 8080   # Pod port

---
# Endpoints automatically created: Pod IPs + ports
apiVersion: v1
kind: Endpoints
metadata:
  name: web-svc       # Must match service name
subsets:
- addresses:
  - ip: 10.244.1.5    # Pod IP
    targetRef:
      kind: Pod
      name: web-deploy-xxx
  ports:
  - port: 8080        # Pod port
```

> **Key Concept:** Endpoints are automatically created/updated by Kubernetes to track which pods back a service. Kube-proxy watches Endpoints and updates iptables/IPVS accordingly.

</details>

---

### Question 3 — Test service connectivity
> ⏱️ **Recommended Time: 5 minutes**

Verify that services route traffic correctly to backend pods.

<details>
<summary>✅ Answer</summary>

```bash
# From the same deployment above (web-svc with 3 replicas)

# Test: Connect to service ClusterIP from inside cluster
# First, get ClusterIP
kubectl get svc web-svc
# CLUSTER-IP: 10.96.123.45

# Create a debug pod
kubectl run debug --image=busybox:1.28 -it --rm -- sh

# From inside the debug pod:
# Hit the service ClusterIP
wget -O- http://10.96.123.45:8080
# Should see response from one of the backend pods

# Hit multiple times to see load balancing
for i in {1..5}; do wget -O- http://10.96.123.45:8080 2>/dev/null | head -1; done
# Different pod IPs should be served (load balanced)

# Or use service DNS name (from same namespace)
wget -O- http://web-svc:8080
# Same behavior

# From different namespace
wget -O- http://web-svc.default.svc.cluster.local:8080
# Fully qualified DNS name

# Exit debug pod
exit

# Test with kubectl port-forward (simulates traffic to service)
kubectl port-forward svc/web-svc 8080:8080
# From another terminal:
curl http://localhost:8080
# Traffic is forwarded to service and load balanced to pods
```

Service connectivity flow:

```
Client Pod
    ↓ (requests: http://web-svc:8080)
DNS (CoreDNS)
    ↓ (resolves: web-svc → 10.96.123.45)
iptables Rules (on client's node)
    ↓ (redirects: 10.96.123.45:8080 → pod IP + port)
Backend Pod
    ↓ (response)
Client Pod
```

> **Key Concept:** Services provide stable IP + DNS name. Kube-proxy (via iptables/IPVS) handles the routing translation. Test with port-forward or debug pods.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Compare iptables vs IPVS modes
> ⏱️ **Recommended Time: 6 minutes**

Understand the differences between iptables and IPVS kube-proxy modes.

<details>
<summary>✅ Answer</summary>

```bash
# Check which mode your kube-proxy uses
kubectl get daemonset -n kube-system kube-proxy -o yaml | grep "proxy-mode"
# args:
# - --proxy-mode=iptables  (or ipvs)

# IPTABLES MODE (Default):
# ================================

# How it works:
# - Kube-proxy creates iptables rules for each service
# - Rules redirect traffic: ClusterIP → random pod IP
# - No extra routing, uses Linux netfilter

# Verify iptables rules were created
ssh node1
sudo iptables -L -n | grep KUBE-SERVICES
# Chain KUBE-SERVICES (policy ACCEPT)
# ... rules for each service ...

# View rules for specific service
sudo iptables -L -n | grep web-svc
# KUBE-SVC-XXXXXX  (service rule)
# KUBE-SEP-YYYYYYY (pod/endpoint rule)

# iptables mode pros/cons:
# Pros: Simple, no extra components, works everywhere
# Cons: Linear lookup O(n), scales poorly with many services

# IPVS MODE (High-performance):
# ================================

# How it works:
# - Kube-proxy uses IPVS (Linux Virtual Server)
# - O(1) load balancing, highly optimized
# - Requires ipvs kernel module

# Check if IPVS mode is available
sudo modinfo ip_vs

# Switch kube-proxy to IPVS (edit DaemonSet)
kubectl edit daemonset -n kube-system kube-proxy
# Change: args: --proxy-mode=ipvs

# Or check current mode
kubectl get daemonset -n kube-system kube-proxy -o yaml | grep proxy-mode

# IPVS mode pros/cons:
# Pros: O(1) lookup, supports 1000s of services, multiple load balancing algorithms
# Cons: Requires ipvs kernel module, slightly more complex

# View IPVS rules (if in IPVS mode)
ssh node1
sudo ipvsadm -ln
# IP Virtual Server version 1.2.1
# Prot LocalAddress:Port Scheduler Flags
# TCP  10.96.123.45:8080 rr
#   -> 10.244.1.5:8080         (pod 1)
#   -> 10.244.2.6:8080         (pod 2)
#   -> 10.244.3.7:8080         (pod 3)

# IPVS scheduling algorithms:
# rr = round-robin (default)
# lc = least connection
# dh = destination hashing
# sh = source hashing
# sed = shortest expected delay
# nq = never queue
```

Comparison table:

| Aspect | iptables | IPVS |
|--------|----------|------|
| **Complexity** | Simple | Moderate |
| **Performance** | O(n) lookup | O(1) lookup |
| **Service Scale** | ~100 services | 1000+ services |
| **Load Balancing** | Random/RoundRobin | Multiple algorithms |
| **Kernel Module** | netfilter (built-in) | ip_vs (sometimes separate) |
| **Debugging** | `iptables -L` | `ipvsadm -ln` |

> **Key Concept:** iptables is default and simple but scales poorly. IPVS is optimized for scale and performance. Choose based on cluster size and service count.

</details>

---

### Question 5 — Debug service connectivity issues
> ⏱️ **Recommended Time: 7 minutes**

Use diagnostic tools to troubleshoot why service traffic isn't reaching pods.

<details>
<summary>✅ Answer</summary>

```bash
# Scenario: Service created but pods not receiving traffic

# Step 1: Verify service exists
kubectl get svc web-svc
# If not found, create it

# Step 2: Check endpoints are populated
kubectl get endpoints web-svc
# If endpoints empty, no pods selected

# If empty:
kubectl describe service web-svc
# Check spec.selector (does it match pod labels?)
kubectl get pods --show-labels
# Do any pods have matching labels?
# Fix: Update service selector or pod labels

# Step 3: Verify kube-proxy is running
kubectl get pods -n kube-system | grep kube-proxy
# Should show kube-proxy pods

# If not running:
kubectl describe daemonset -n kube-system kube-proxy
# Check for scheduling issues, taints, tolerations

# Step 4: Check iptables rules (iptables mode)
ssh node1
sudo iptables -L -n | grep -A 5 "KUBE-SERVICES"
# Service rules should exist

# Check specific service
sudo iptables -L -n -t nat | grep web-svc
# Should see: web-svc rules

# Step 5: Test from a pod
kubectl run debug --image=busybox:1.28 -it --rm -- sh
# Inside the pod:
wget -O- http://web-svc:8080 -v
# If connection refused: iptables rules not working
# If timeout: DNS not working
# If successful: service working

# Step 6: Check DNS resolution
nslookup web-svc
# Should resolve to service ClusterIP

# If DNS fails:
kubectl get svc -n kube-system | grep coredns
kubectl logs -n kube-system -l k8s-app=kube-dns

# Step 7: Check pod network connectivity
# From node, test direct pod IP
ssh node1
curl http://10.244.1.5:8080
# If fails: pod network issue, CNI problem

# Step 8: View kube-proxy logs
kubectl logs -n kube-system -l k8s-app=kube-proxy -f
# Look for: "Synced", "error", "failed"
```

Service troubleshooting checklist:

```
Service not working?
├─ Service exists?
│  └─ kubectl get svc <service>
├─ Endpoints populated?
│  └─ kubectl get endpoints <service>
│  └─ Pods with matching selector exist?
├─ Kube-proxy running?
│  └─ kubectl get pods -n kube-system -l k8s-app=kube-proxy
├─ DNS working?
│  └─ nslookup <service> (from pod)
├─ iptables rules created?
│  └─ sudo iptables -L -n (on node)
├─ Network connectivity?
│  └─ curl <pod-ip> (from node)
└─ Pod actually listening?
   └─ kubectl exec <pod> -- netstat -tlnp
```

> **Key Concept:** Service debugging: check service → endpoints → kube-proxy → iptables → pod network → pod port. Each layer can fail independently.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Analyze iptables rules for service routing
> ⏱️ **Recommended Time: 8 minutes**

Deep dive into iptables rules created by kube-proxy.

<details>
<summary>✅ Answer</summary>

```bash
# Create service for analysis
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: demo-svc
spec:
  selector:
    app: demo
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
      - name: app
        image: busybox:1.28
        command: ["sh", "-c", "while true; do date; sleep 3600; done"]
EOF

# Get service and pod IPs
kubectl get svc demo-svc
# ClusterIP: 10.96.1.100, Port: 80

kubectl get pods -l app=demo -o wide
# Pod IPs: 10.244.1.10, 10.244.2.20

# SSH to node and examine iptables rules
ssh node1
sudo iptables -L -n -t nat | head -50

# Explanation of iptables chains:
# PREROUTING - processes incoming packets before routing
# OUTPUT - processes locally generated packets
# POSTROUTING - processes packets after routing
# KUBE-SERVICES - entry point for service rules
# KUBE-SVC-XXXX - specific service rules
# KUBE-SEP-YYYY - specific endpoint rules

# View full NAT table
sudo iptables -L -n -t nat

# Find rules for demo-svc
sudo iptables -L -n -t nat | grep -i demo

# More detailed: view rule numbers
sudo iptables -L -n -t nat --line-numbers

# View specific service chain
# Example output:
# Chain KUBE-SVC-DEMO123 (1 references)
# num  target     prot opt source               destination
# 1    KUBE-SEP-POD1 all  --  0.0.0.0/0          0.0.0.0/0            /* demo:default */
# 2    KUBE-SEP-POD2 all  --  0.0.0.0/0          0.0.0.0/0            /* demo:default */

# The rules distribute traffic randomly:
# 1/2 chance to POD1, 1/2 chance to POD2 (load balancing)

# View endpoint chain
# Example:
# Chain KUBE-SEP-POD1 (1 references)
# target     prot opt source               destination
# KUBE-MARK-MASQ all  --  10.244.1.10      0.0.0.0/0
# DNAT       tcp  --  0.0.0.0/0            0.0.0.0/0   /* demo:default */ tcp to:10.244.1.10:8080

# This translates packets: 10.96.1.100:80 → 10.244.1.10:8080

# View NAT statistics (packets through rules)
sudo iptables -L -n -v -t nat | grep -A 20 "KUBE-SVC"
# pkts  target     prot ...

# Test and see packets flowing
# In one terminal:
kubectl run debug --image=busybox:1.28 -it --rm -- sh
# Inside pod:
for i in {1..10}; do wget -q -O- http://demo-svc; done

# In another terminal (on node):
sudo iptables -L -n -v -t nat | grep -A 20 "KUBE-SVC"
# pkts count should increase

# Save and restore iptables rules
sudo iptables-save > /tmp/iptables-backup.txt
sudo iptables-restore /tmp/iptables-backup.txt
```

Common iptables operations:

```bash
# View rules in different formats:
sudo iptables -L -n         # List all rules (filter table)
sudo iptables -L -n -t nat  # List NAT table rules
sudo iptables -L -n -t mangle  # List mangle table rules

# View with packet counts:
sudo iptables -L -n -v

# View with rule numbers:
sudo iptables -L -n --line-numbers

# Search for specific chain:
sudo iptables -L KUBE-SERVICES -n -v

# Save and restore:
sudo iptables-save > backup.txt
sudo iptables-restore backup.txt

# Reset all rules (dangerous!):
sudo iptables -F
sudo iptables -X
```

> **Key Concept:** Kube-proxy creates iptables rules in NAT table. Service IP is DNAT'ed (destination NAT) to pod IP. Rules include randomization for load balancing. Understanding these rules helps diagnose network issues.

</details>

---

## 📌 Quick Reference

```bash
# Check kube-proxy mode and logs
kubectl get daemonset -n kube-system kube-proxy -o yaml | grep proxy-mode
kubectl logs -n kube-system -l k8s-app=kube-proxy -f

# View services and endpoints
kubectl get svc
kubectl get endpoints
kubectl describe endpoints <service>

# Test service connectivity
kubectl run debug --image=busybox:1.28 -it --rm -- sh
# Inside: wget -O- http://<service>:<port>

# Diagnose iptables (on node)
sudo iptables -L -n -t nat | grep KUBE-SERVICES
sudo iptables -L -n -v -t nat | head -30

# Diagnose IPVS (if in IPVS mode)
sudo ipvsadm -ln

# DNS resolution test
nslookup <service>
kubectl run debug --image=busybox:1.28 -it --rm -- nslookup <service>

# View pod listening ports
kubectl exec <pod> -- netstat -tlnp
```

### Related Topics

- 🔗 [Services](./services.md) — Service types and creation
- 🔗 [Service Networking](./service-networking.md) — Advanced service networking
- 🔗 [Network Policies](./network-policies.md) — Traffic control
