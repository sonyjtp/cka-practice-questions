# 🌐 CoreDNS

> **CKA Exam Domain:** Networking  
> **Topic:** CoreDNS architecture, configuration, DNS resolution, troubleshooting  
> **Total Questions:** 6

---

## ⏱️ Time Guide

| Difficulty | Recommended Time |
|------------|-----------------|
| 🟢 Easy    | 4–6 minutes     |
| 🟡 Medium  | 6–8 minutes     |
| 🔴 Hard    | 8–10 minutes    |

---

> ℹ️ **Scope Note:** CoreDNS is the default DNS server in Kubernetes (since 1.13). CKA tests understanding of how DNS resolution works for pods and services, how to inspect and modify CoreDNS config, and how to troubleshoot DNS failures.

---

## 🟢 Easy Questions

---

### Question 1 — Inspect CoreDNS Deployment
> ⏱️ **Recommended Time: 4 minutes**

Locate the CoreDNS deployment, identify its ClusterIP, and verify it is healthy.

<details>
<summary>✅ Answer</summary>

```bash
# CoreDNS runs as a Deployment in kube-system
kubectl get deployment coredns -n kube-system
# NAME      READY   UP-TO-DATE   AVAILABLE
# coredns   2/2     2            2

# CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns
# NAME                    READY   STATUS    RESTARTS
# coredns-xxxxxx-aaaaa    1/1     Running   0
# coredns-xxxxxx-bbbbb    1/1     Running   0

# CoreDNS Service (kube-dns)
kubectl get svc kube-dns -n kube-system
# NAME       TYPE        CLUSTER-IP   PORT(S)
# kube-dns   ClusterIP   10.96.0.10   53/UDP,53/TCP,9153/TCP

# This IP (10.96.0.10) is injected into every pod's /etc/resolv.conf
kubectl exec <any-pod> -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5

# Check CoreDNS health endpoint
kubectl exec -n kube-system <coredns-pod> -- wget -qO- http://localhost:8080/health
# OK

# Check CoreDNS readiness
kubectl exec -n kube-system <coredns-pod> -- wget -qO- http://localhost:8181/ready
# OK

# View CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

> **Key Concept:** CoreDNS is exposed as a Service named `kube-dns` (name kept for backward compatibility) with a stable ClusterIP. This IP is set in every pod's `/etc/resolv.conf` as the `nameserver`. Every DNS query from a pod goes to CoreDNS first. CoreDNS runs as 2 replicas by default for high availability.

</details>

---

### Question 2 — Perform DNS Lookups from a Pod
> ⏱️ **Recommended Time: 5 minutes**

From inside a pod, resolve a Service name, a pod name, and an external domain.

<details>
<summary>✅ Answer</summary>

```bash
# Launch a test pod with DNS tools
kubectl run dns-test --image=busybox:1.28 --restart=Never -- sleep 3600
kubectl exec -it dns-test -- sh

# Resolve a Service (same namespace)
nslookup kubernetes
# Server: 10.96.0.10
# Address: 10.96.0.10:53
# Name: kubernetes.default.svc.cluster.local
# Address: 10.96.0.1

# Resolve a Service (different namespace)
nslookup web-svc.production.svc.cluster.local
# Address: 10.96.45.12

# Resolve a StatefulSet pod
nslookup mysql-0.mysql.default.svc.cluster.local
# Address: 10.244.1.5   ← direct pod IP

# Resolve external domain
nslookup google.com
# Address: 142.250.80.46

# Using dig (if available)
kubectl run dig-test --image=tutum/dnsutils --restart=Never -- sleep 3600
kubectl exec dig-test -- dig kubernetes.default.svc.cluster.local
kubectl exec dig-test -- dig +short google.com

# Check all DNS search domains
kubectl exec dns-test -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# search default.svc.cluster.local svc.cluster.local cluster.local
# options ndots:5
```

> **Key Concept:** DNS resolution order for a query like `web-svc`: (1) `web-svc.default.svc.cluster.local` — found, return ClusterIP. If not found, tries next search domain. For external names like `google.com`, CoreDNS forwards to upstream resolvers (configured in Corefile). The `ndots:5` option controls when a name is treated as absolute vs relative.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Inspect and Modify the CoreDNS Corefile
> ⏱️ **Recommended Time: 7 minutes**

View the CoreDNS configuration (Corefile) and add a custom stub zone to forward DNS queries for `internal.example.com` to a custom DNS server at `10.0.0.100`.

<details>
<summary>✅ Answer</summary>

```bash
# CoreDNS config is stored in a ConfigMap
kubectl get configmap coredns -n kube-system -o yaml
```

Default Corefile:
```
.:53 {
    errors                          # log errors
    health {                        # health endpoint on :8080
        lameduck 5s
    }
    ready                           # readiness endpoint on :8181
    kubernetes cluster.local in-addr.arpa ip6.arpa {  # handle k8s DNS
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153                # metrics endpoint
    forward . /etc/resolv.conf {   # forward external queries to host DNS
        max_concurrent 1000
    }
    cache 30                        # cache responses for 30s
    loop                            # detect forwarding loops
    reload                          # auto-reload config
    loadbalance                     # round-robin DNS responses
}
```

```bash
# Add a stub zone for internal.example.com
kubectl edit configmap coredns -n kube-system
```

Updated Corefile (add before the closing `}`):
```
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
        max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}

# ADD THIS BLOCK for custom stub zone:
internal.example.com:53 {
    errors
    cache 30
    forward . 10.0.0.100            # forward to custom DNS server
}
```

```bash
# CoreDNS auto-reloads (reload plugin) — no restart needed
# Verify by checking logs
kubectl logs -n kube-system -l k8s-app=kube-dns | grep "Reloading"
# [INFO] Reloading complete

# Test the stub zone
kubectl exec dns-test -- nslookup app.internal.example.com
# Should resolve via 10.0.0.100
```

> **Key Concept:** The Corefile is the CoreDNS configuration file. Each `zone:port { plugins }` block handles DNS queries for that zone. The `kubernetes` plugin handles all `.cluster.local` queries. The `forward` plugin handles everything else by forwarding to upstream resolvers. Adding a stub zone routes specific domains to a custom DNS server — useful for hybrid cloud setups where some domains are resolved by on-premises DNS.

</details>

---

### Question 4 — Scale CoreDNS for High Load
> ⏱️ **Recommended Time: 6 minutes**

The cluster is experiencing DNS resolution timeouts under high load. Scale up CoreDNS and configure it appropriately.

<details>
<summary>✅ Answer</summary>

```bash
# Check current CoreDNS replicas
kubectl get deployment coredns -n kube-system
# NAME      READY   UP-TO-DATE   AVAILABLE
# coredns   2/2     2            2

# Check CoreDNS resource usage
kubectl top pods -n kube-system -l k8s-app=kube-dns
# NAME                  CPU(cores)   MEMORY(bytes)
# coredns-xxxx-aaaaa    98m          45Mi   ← high CPU!

# Scale up CoreDNS
kubectl scale deployment coredns -n kube-system --replicas=4

# Verify
kubectl get pods -n kube-system -l k8s-app=kube-dns
# 4 pods Running

# Set resource requests/limits for CoreDNS
kubectl patch deployment coredns -n kube-system --type=json -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/resources",
    "value": {
      "requests": {"cpu": "100m", "memory": "70Mi"},
      "limits":   {"cpu": "200m", "memory": "170Mi"}
    }
  }
]'

# Configure HPA for automatic scaling
kubectl autoscale deployment coredns -n kube-system \
  --min=2 --max=6 --cpu-percent=70

# Tune cache TTL in Corefile (reduce upstream load)
kubectl edit configmap coredns -n kube-system
# Change: cache 30  →  cache 300   (cache for 5 minutes)

# Restart CoreDNS to apply resource changes
kubectl rollout restart deployment coredns -n kube-system
kubectl rollout status deployment coredns -n kube-system
```

> **Key Concept:** CoreDNS scaling is straightforward — it's a Deployment, so `kubectl scale` works directly. DNS is a critical path for every service call in the cluster, so DNS latency directly impacts application performance. Common tuning: increase replicas, raise cache TTL, set proper resource limits. The `cache` plugin stores responses to avoid repeated upstream lookups — increasing TTL reduces load at the cost of slightly stale responses.

</details>

---

## 🔴 Hard Questions

---

### Question 5 — Troubleshoot DNS Resolution Failure
> ⏱️ **Recommended Time: 9 minutes**

Pods cannot resolve service names. `nslookup kubernetes` returns `SERVFAIL` or times out. Diagnose and fix.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify CoreDNS pods are running
kubectl get pods -n kube-system -l k8s-app=kube-dns
# NAME                READY   STATUS             RESTARTS
# coredns-xxxx-aaaa   0/1     CrashLoopBackOff   5        ← problem!

# Step 2 — Check CoreDNS logs
kubectl logs -n kube-system <coredns-pod> --previous
# [ERROR] plugin/errors: 2 SERVFAIL
# [FATAL] Failed to initialize server: listen tcp :53: bind: permission denied

# Step 3 — Check CoreDNS configmap for syntax errors
kubectl get configmap coredns -n kube-system -o yaml
# Look for mismatched braces, invalid plugin names

# Fix config syntax errors:
kubectl edit configmap coredns -n kube-system
# Restart after fix:
kubectl rollout restart deployment coredns -n kube-system

# Step 4 — Check if kube-dns Service has correct endpoints
kubectl get endpoints kube-dns -n kube-system
# NAME       ENDPOINTS
# kube-dns   <none>    ← no endpoints!

# CoreDNS pods exist but endpoints empty → label mismatch
kubectl get pods -n kube-system -l k8s-app=kube-dns --show-labels
kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.selector}'
# {"k8s-app":"kube-dns"}

# If labels don't match, fix pod labels or service selector

# Step 5 — Check pod's resolv.conf
kubectl exec <pod> -- cat /etc/resolv.conf
# nameserver 10.96.0.10   ← is this the correct CoreDNS ClusterIP?

kubectl get svc kube-dns -n kube-system
# CLUSTER-IP: 10.96.0.10  ← must match!

# Step 6 — Test direct DNS query to CoreDNS IP
kubectl exec <pod> -- nslookup kubernetes 10.96.0.10
# If this works but nslookup kubernetes fails → resolv.conf wrong IP

# Step 7 — Check for DNS loop (loop plugin issue)
kubectl logs -n kube-system <coredns-pod> | grep "Loop"
# [WARNING] loop: Loop (127.0.0.1 -> 10.96.0.10 -> 127.0.0.1) detected
# Fix: edit /etc/resolv.conf on the node to remove 127.0.0.1 as nameserver
# OR disable loop plugin in Corefile (not recommended)

# Step 8 — Test external DNS forwarding
kubectl exec <pod> -- nslookup google.com
# If cluster DNS works but external fails → forward upstream issue
# Check CoreDNS forward plugin target:
kubectl get configmap coredns -n kube-system -o yaml | grep forward
# forward . /etc/resolv.conf   ← check node's /etc/resolv.conf
ssh <node> cat /etc/resolv.conf
```

DNS troubleshooting checklist:
```
1. CoreDNS pods Running?          kubectl get pods -n kube-system -l k8s-app=kube-dns
2. CoreDNS logs errors?           kubectl logs -n kube-system <coredns-pod>
3. kube-dns endpoints populated?  kubectl get endpoints kube-dns -n kube-system
4. Pod's resolv.conf correct?     kubectl exec <pod> -- cat /etc/resolv.conf
5. Direct DNS query works?        kubectl exec <pod> -- nslookup svc <CoreDNS-IP>
6. Corefile syntax valid?         kubectl get cm coredns -n kube-system -o yaml
7. DNS loop detected?             kubectl logs coredns | grep Loop
```

> **Key Concept:** DNS failures in Kubernetes cascade widely — service discovery, image pulls (by hostname), and any application using DNS hostnames all break. The most common causes are: (1) CoreDNS pods crashing (check logs), (2) Corefile syntax error after editing, (3) DNS forwarding loop (node's `/etc/resolv.conf` contains `127.0.0.1` which routes back to CoreDNS). Always test with direct IP (`nslookup svc <CoreDNS-IP>`) to isolate whether the issue is with CoreDNS itself or the pod's resolv.conf.

</details>

---

### Question 6 — Configure Pod-Level DNS Settings
> ⏱️ **Recommended Time: 8 minutes**

Configure a pod with custom DNS settings: use a custom nameserver, add extra search domains, and set `ndots` to 2.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-dns-pod
spec:
  dnsPolicy: None          # disable default DNS — use dnsConfig only
  dnsConfig:
    nameservers:
    - 10.96.0.10           # CoreDNS (keep cluster DNS)
    - 8.8.8.8              # Google DNS as fallback
    searches:
    - default.svc.cluster.local
    - svc.cluster.local
    - cluster.local
    - mycompany.internal   # custom search domain
    options:
    - name: ndots
      value: "2"           # treat names with <2 dots as relative
    - name: timeout
      value: "5"
    - name: attempts
      value: "2"
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
```

`dnsPolicy` options:

| Policy | Behaviour |
|--------|-----------|
| `ClusterFirst` | CoreDNS first, then node DNS (default) |
| `ClusterFirstWithHostNet` | Same as ClusterFirst but for hostNetwork pods |
| `Default` | Inherit node's `/etc/resolv.conf` (NOT cluster DNS) |
| `None` | Fully custom — must provide `dnsConfig` |

```bash
kubectl apply -f custom-dns-pod.yaml

# Verify resolv.conf
kubectl exec custom-dns-pod -- cat /etc/resolv.conf
# nameserver 10.96.0.10
# nameserver 8.8.8.8
# search default.svc.cluster.local svc.cluster.local cluster.local mycompany.internal
# options ndots:2 timeout:5 attempts:2

# With ndots:2, "app.svc" has 1 dot → treated as relative → tries search domains
# "app.svc.cluster.local" has 3 dots → treated as absolute → no search domain appended

# Test
kubectl exec custom-dns-pod -- nslookup kubernetes
# Resolves via 10.96.0.10 (cluster DNS)
kubectl exec custom-dns-pod -- nslookup google.com
# Resolves via 8.8.8.8 if CoreDNS forward fails
```

> **Key Concept:** `dnsPolicy: None` with `dnsConfig` gives full control over a pod's DNS. The default `ClusterFirst` means CoreDNS is queried first for everything — if it can't resolve (external names), it forwards to upstream. Setting `ndots:2` (vs default `5`) makes fewer unnecessary search-domain lookups for external names — `google.com` has 1 dot, so with `ndots:2` it's tried as absolute immediately without first trying `google.com.default.svc.cluster.local`. This reduces DNS latency for applications that frequently query external hostnames.

</details>

---

## 📌 Quick Reference

### CoreDNS Key Commands

```bash
# CoreDNS status
kubectl get deployment coredns -n kube-system
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl get svc kube-dns -n kube-system

# CoreDNS config
kubectl get configmap coredns -n kube-system -o yaml
kubectl edit configmap coredns -n kube-system

# CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system <coredns-pod> --previous

# Scale CoreDNS
kubectl scale deployment coredns -n kube-system --replicas=4

# Restart CoreDNS
kubectl rollout restart deployment coredns -n kube-system
```

### DNS Testing from Pod

```bash
kubectl run dns-test --image=busybox:1.28 --restart=Never -- sleep 3600
kubectl exec dns-test -- nslookup <service>
kubectl exec dns-test -- nslookup <service>.<namespace>
kubectl exec dns-test -- nslookup <service> <CoreDNS-IP>   # direct query
kubectl exec dns-test -- cat /etc/resolv.conf
```

### DNS Name Formats

```
Service:             <svc>.<ns>.svc.cluster.local
StatefulSet Pod:     <pod>.<svc>.<ns>.svc.cluster.local
Pod by IP:           <ip-dashes>.<ns>.pod.cluster.local
```

### Corefile Structure

```
<zone>:<port> {
    kubernetes cluster.local ...   # k8s DNS
    forward . /etc/resolv.conf     # external DNS
    cache 30                       # response cache TTL
    health                         # :8080/health
    ready                          # :8181/ready
    prometheus :9153               # metrics
}
```

### Related Topics

- 🔗 [Service Networking](./service-networking.md) — DNS names for services
- 🔗 [Pod Networking](./pod-networking.md) — resolv.conf injection
- 🔗 [Cluster Networking](./cluster-networking.md) — kube-proxy and networking fundamentals
