# 🫛 Pod Networking

> **CKA Exam Domain:** Networking  
> **Topic:** Network namespaces, veth pairs, bridge networks, pod-to-pod communication  
> **Total Questions:** 6

---

## ⏱️ Time Guide

| Difficulty | Recommended Time |
|------------|-----------------|
| 🟢 Easy    | 4–6 minutes     |
| 🟡 Medium  | 6–8 minutes     |
| 🔴 Hard    | 8–10 minutes    |

---

> ℹ️ **Scope Note:** CKA expects you to understand how pod networking works under the hood — network namespaces, veth pairs, bridges — and be able to troubleshoot pod connectivity issues. You won't need to set up the full network stack manually, but you must understand it.

---

## 🟢 Easy Questions

---

### Question 1 — Inspect a Pod's Network Namespace
> ⏱️ **Recommended Time: 5 minutes**

Find the network namespace of a running pod and inspect its network interfaces from the host.

<details>
<summary>✅ Answer</summary>

```bash
# Get the pod's node
kubectl get pod <pod-name> -o wide
# NAME       NODE    IP
# my-pod     node1   10.244.0.5

# SSH to the node
ssh node1

# List all network namespaces
ip netns list
# OR via /var/run/netns (may be empty for container runtimes that use different paths)
ls /var/run/netns/

# Find the container's PID using crictl
crictl pods | grep <pod-name>
# POD-ID   my-pod   ...
crictl inspect <POD-ID> | grep pid
# "pid": 12345

# Enter the pod's network namespace using nsenter
nsenter -t 12345 -n ip addr
# 1: lo: <LOOPBACK> 127.0.0.1/8
# 3: eth0@if8: <BROADCAST> 10.244.0.5/24   ← pod's IP

nsenter -t 12345 -n ip route
# default via 10.244.0.1 dev eth0
# 10.244.0.0/24 dev eth0 proto kernel scope link src 10.244.0.5

# Alternative — exec directly into the pod
kubectl exec <pod-name> -- ip addr
kubectl exec <pod-name> -- ip route
kubectl exec <pod-name> -- cat /etc/resolv.conf
```

> **Key Concept:** Every pod runs in its own **Linux network namespace** — an isolated copy of the network stack with its own interfaces, routes, and iptables rules. The pod's `eth0` is one end of a **veth pair**; the other end lives on the host. `nsenter -t <PID> -n` lets you run commands inside a container's network namespace directly from the host — useful when the container image doesn't have tools like `ip` or `netstat`.

</details>

---

### Question 2 — Test Pod-to-Pod Connectivity
> ⏱️ **Recommended Time: 4 minutes**

Verify that two pods on different nodes can communicate directly using their pod IPs.

<details>
<summary>✅ Answer</summary>

```bash
# Get pod IPs
kubectl get pods -o wide
# NAME     IP            NODE
# pod-a    10.244.0.5    node1
# pod-b    10.244.1.7    node2

# Test connectivity from pod-a to pod-b
kubectl exec pod-a -- ping -c 3 10.244.1.7
# PING 10.244.1.7: 56 data bytes
# 64 bytes from 10.244.1.7: icmp_seq=1 ttl=62 time=1.2ms

# Test with curl (if pods run web servers)
kubectl exec pod-a -- curl -s http://10.244.1.7:8080

# Test DNS resolution between pods
kubectl exec pod-a -- nslookup pod-b.default.svc.cluster.local

# If ping fails — check NetworkPolicy
kubectl get networkpolicy -n <namespace>

# Check if pods are on expected nodes
kubectl get pods -o wide --all-namespaces
```

> **Key Concept:** Kubernetes requires all pods to communicate with each other directly using their pod IPs **without NAT** — this is the fundamental Kubernetes networking model. If pod-to-pod connectivity fails across nodes, the CNI plugin's cross-node routing is broken. If it fails within the same node, check the bridge/veth setup. If it fails selectively, a NetworkPolicy is blocking it.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Trace the veth Pair Between Pod and Host
> ⏱️ **Recommended Time: 7 minutes**

For a running pod, identify its veth interface inside the pod and its corresponding peer on the host node.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Find the pod's interface index
kubectl exec <pod-name> -- ip link show eth0
# 3: eth0@if8: <BROADCAST,MULTICAST,UP>
#     ↑ pod's if-index=3, peer if-index=8

# Step 2 — On the host node, find interface with index 8
ssh <node>
ip link | grep "^8:"
# 8: veth3a4b5c6d@if3: <BROADCAST,MULTICAST,UP> master cni0

# The host-side veth name is veth3a4b5c6d
# It is attached to bridge cni0 (master cni0)

# Step 3 — Confirm bridge membership
bridge link show
# 8: veth3a4b5c6d master cni0 state forwarding
# 9: veth7e8f9a0b master cni0 state forwarding

# Step 4 — Show bridge details
ip link show cni0
# cni0: <BROADCAST,MULTICAST,UP> inet 10.244.0.1/24  ← bridge IP (pod gateway)

# Step 5 — Full path visualized
# pod eth0 (10.244.0.5) ↔ veth pair ↔ veth3a4b5c6d (host) → cni0 bridge → routing
```

Network path for same-node pod-to-pod traffic:
```
pod-a eth0 → vethXXXX → cni0 bridge → vethYYYY → pod-b eth0
```

Network path for cross-node pod-to-pod traffic:
```
pod-a eth0 → vethXXXX → cni0 bridge → eth0 (host NIC) → [overlay/BGP] → eth0 (remote host) → cni0 bridge → vethYYYY → pod-b eth0
```

> **Key Concept:** A **veth pair** is like a virtual ethernet cable — packets written to one end appear on the other. The pod's `eth0@if8` shows the peer interface index (8). On the host, `ip link` shows the corresponding `veth...@if3` — the `@if3` is the peer's index inside the pod namespace. This cross-referencing technique is the standard way to trace which veth belongs to which pod.

</details>

---

### Question 4 — Troubleshoot Pod Networking: Pod Can't Reach Other Pods
> ⏱️ **Recommended Time: 8 minutes**

A pod cannot ping other pods. Diagnose the issue systematically.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Basic connectivity test
kubectl exec <pod> -- ping -c 2 <other-pod-ip>
# Request timeout / unreachable

# Step 2 — Check if it's a NetworkPolicy issue
kubectl get networkpolicy -n <namespace>
kubectl describe networkpolicy <name>
# If a policy exists with no ingress/egress rules, all traffic is blocked

# Step 3 — Test within same node vs cross-node
kubectl get pods -o wide
# If same-node fails → bridge/veth issue
# If cross-node fails → CNI overlay/routing issue

# Step 4 — Check pod's routing table
kubectl exec <pod> -- ip route
# Should have: default via <gateway> dev eth0

# Step 5 — Check CNI is running on both nodes
kubectl get pods -n kube-system -l name=weave-net -o wide
# Ensure Running on all nodes

# Step 6 — Check iptables rules on the node (forwarding)
ssh <node>
iptables -L FORWARD | head -20
# Should see ACCEPT rules for pod CIDRs
# If "DROP" or "REJECT" rules present for pod subnets → problem

# Step 7 — Check IP forwarding is enabled
sysctl net.ipv4.ip_forward
# net.ipv4.ip_forward = 1   ← must be 1

# Fix if disabled:
sysctl -w net.ipv4.ip_forward=1
# Make permanent:
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

# Step 8 — Check CNI plugin logs
kubectl logs -n kube-system <cni-pod> -c <cni-container>
```

Common causes:

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All cross-node traffic fails | CNI overlay broken | Restart CNI DaemonSet |
| Selective pods blocked | NetworkPolicy | Review/remove policy |
| All traffic fails | `ip_forward=0` | Enable IP forwarding |
| Same-node fails | Bridge missing/veth disconnected | Restart CNI pod on node |

> **Key Concept:** Systematic pod networking troubleshooting: (1) check NetworkPolicy, (2) isolate same-node vs cross-node, (3) verify IP forwarding enabled, (4) check CNI pods are healthy, (5) check iptables FORWARD chain. `ip_forward` must be `1` — without it, the kernel won't route packets between interfaces (including pod ↔ host traffic).

</details>

---

## 🔴 Hard Questions

---

### Question 5 — Manually Create a Network Namespace and Connect It to a Bridge
> ⏱️ **Recommended Time: 9 minutes**

Simulate what a CNI plugin does: create a network namespace, connect it to a bridge with a veth pair, and verify connectivity.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Create a bridge (simulates cni0)
ip link add v-net-0 type bridge
ip link set v-net-0 up
ip addr add 192.168.15.5/24 dev v-net-0

# Step 2 — Create a network namespace (simulates pod)
ip netns add pod-ns-1

# Step 3 — Create a veth pair
ip link add veth-pod1 type veth peer name veth-bridge1

# Step 4 — Move one end of veth into the pod namespace
ip link set veth-pod1 netns pod-ns-1

# Step 5 — Attach the host-side veth to the bridge
ip link set veth-bridge1 master v-net-0
ip link set veth-bridge1 up

# Step 6 — Configure IP inside the pod namespace
ip netns exec pod-ns-1 ip link set veth-pod1 up
ip netns exec pod-ns-1 ip addr add 192.168.15.2/24 dev veth-pod1
ip netns exec pod-ns-1 ip link set lo up
ip netns exec pod-ns-1 ip route add default via 192.168.15.5

# Step 7 — Verify connectivity
# From host to pod namespace:
ping -c 2 192.168.15.2

# From pod namespace to host bridge:
ip netns exec pod-ns-1 ping -c 2 192.168.15.5

# From pod namespace to another pod namespace (repeat steps 2-6 for pod-ns-2)
ip netns exec pod-ns-1 ping -c 2 192.168.15.3   # pod-ns-2's IP

# Step 8 — Enable NAT for external access
iptables -t nat -A POSTROUTING -s 192.168.15.0/24 -j MASQUERADE
ip netns exec pod-ns-1 ping -c 2 8.8.8.8   # external connectivity
```

> **Key Concept:** This exercise mirrors exactly what a CNI plugin does automatically. The steps are: create namespace → create veth pair → move one end into namespace → attach other end to bridge → assign IPs → add default route. Understanding this manually helps you diagnose CNI failures — if a pod can't reach its gateway, the veth may not be attached to the bridge; if cross-namespace traffic fails, the bridge or routing may be missing.

</details>

---

### Question 6 — Understand pause (infra) Container and Shared Namespaces
> ⏱️ **Recommended Time: 8 minutes**

Explain the role of the `pause` container in pod networking and how containers within a pod share the network namespace.

<details>
<summary>✅ Answer</summary>

```bash
# View pause containers on the node
ssh <node>
crictl ps | grep pause
# CONTAINER   IMAGE                 NAME    POD
# abc123      pause:3.9             pause   my-pod
# def456      pause:3.9             pause   other-pod

# The pause container holds the network namespace
# All other containers in the pod JOIN the pause container's netns

# Inspect pause container's PID
crictl inspect abc123 | grep '"pid"'
# "pid": 4567

# The pause container's network namespace is the pod's network namespace
nsenter -t 4567 -n ip addr
# This shows the same IPs as `kubectl exec <pod> -- ip addr`

# See all containers sharing the same network namespace
# All containers in a pod have the same:
# - IP address
# - Network interfaces
# - /etc/hosts
# - /etc/resolv.conf

# Demonstrate: exec into different containers of same pod
kubectl exec <pod> -c container1 -- ip addr show eth0
kubectl exec <pod> -c container2 -- ip addr show eth0
# Both show the SAME IP and interface

# Containers communicate within a pod via localhost
kubectl exec <pod> -c container1 -- curl localhost:8080
# Reaches container2 if it listens on 8080

# Inspect all processes in pause netns
nsenter -t 4567 -n ss -tlnp
# Shows listening ports from ALL containers in the pod
```

Pod network namespace sharing:
```
┌─────────────────────────────┐
│         Pod                 │
│  ┌──────────────────────┐   │
│  │  Network Namespace   │   │
│  │  IP: 10.244.0.5      │   │
│  │  eth0, lo            │   │
│  └──────────────────────┘   │
│       ↑        ↑       ↑    │
│  [pause]  [app]  [sidecar]  │
│  creates  joins    joins    │
└─────────────────────────────┘
```

> **Key Concept:** The `pause` container (also called the **infra container**) is the first container started in a pod. Its sole purpose is to create and hold the pod's network namespace — it just runs `pause()` system call indefinitely. All other containers in the pod are started with `--network=container:<pause-id>`, joining the existing namespace. This is why all containers in a pod share the same IP, port space, and can communicate via `localhost`. If the pause container dies, the entire pod's network is lost.

</details>

---

## 📌 Quick Reference

### Pod Networking Commands

```bash
# Pod IP and node
kubectl get pods -o wide

# Pod's network interfaces (from inside)
kubectl exec <pod> -- ip addr
kubectl exec <pod> -- ip route
kubectl exec <pod> -- netstat -tlnp   # or ss -tlnp

# Find pod's PID on node
crictl pods | grep <pod-name>
crictl inspect <pod-id> | grep pid

# Enter pod's network namespace from host
nsenter -t <PID> -n ip addr
nsenter -t <PID> -n ip route
nsenter -t <PID> -n ss -tlnp

# Trace veth pair
# In pod: ip link show eth0  → note peer index (e.g., @if8)
# On host: ip link | grep "^8:"  → find veth name
```

### Key File/Directory Locations

```
/var/run/netns/           Network namespace files
/sys/class/net/           Network interfaces on host
/proc/<PID>/net/          Network info for a process's namespace
```

### Networking Model Rules

1. Every pod gets a unique IP
2. Pods communicate without NAT (flat network)
3. Nodes can communicate with all pods without NAT
4. Pod IP is the same from inside and outside the pod

### Related Topics

- 🔗 [CNI](./cni.md) — how pod network interfaces are created
- 🔗 [Cluster Networking](./cluster-networking.md) — cross-node pod communication
- 🔗 [Service Networking](./service-networking.md) — stable IPs via Services
- 🔗 [Network Policies](./network-policies.md) — controlling pod traffic
