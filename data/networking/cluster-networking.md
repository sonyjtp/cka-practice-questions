# 🌐 Cluster Networking

> **CKA Exam Domain:** Networking  
> **Topic:** Node-to-node communication, cluster network requirements, overlay networks, routing  
> **Total Questions:** 6

---

> ℹ️ **Scope Note:** CKA tests understanding of Kubernetes networking requirements, how nodes communicate, port requirements for cluster components, and troubleshooting node-level connectivity.

---

## 🟢 Easy Questions

---

### Question 1 — Kubernetes Networking Requirements
> ⏱️ **Recommended Time: 4 minutes**

List the fundamental networking requirements that every Kubernetes cluster must satisfy.

<details>
<summary>✅ Answer</summary>

Kubernetes imposes these non-negotiable networking rules:

| Rule                    | Meaning                                      |
|-------------------------|----------------------------------------------|
| Pod-to-pod (same node)  | No NAT — direct communication                |
| Pod-to-pod (cross-node) | No NAT — pods use real IPs                   |
| Node-to-pod             | No NAT — nodes reach pods directly           |
| Pod sees its own IP     | Pod's IP as seen inside = IP as seen outside |

```bash
# Verify pod IPs are routable from nodes
kubectl get pods -o wide
# NAME    IP            NODE
# pod-a   10.244.0.5    node1
# pod-b   10.244.1.7    node2

# From node1, reach pod-b on node2 directly
ssh node1
ping -c 2 10.244.1.7       # must work without NAT
curl http://10.244.1.7:8080

# From node2, reach pod-a on node1
ssh node2
ping -c 2 10.244.0.5

# Nodes must also be reachable from each other
ping -c 2 <node1-ip>
ping -c 2 <node2-ip>
```

> **Key Concept:** Kubernetes does **not** implement networking itself — it delegates to a CNI plugin. But it mandates the above rules. Any CNI plugin (Calico, Weave, Flannel, Cilium) must implement them. The "no NAT" requirement is what makes pod IPs meaningful cluster-wide and enables service discovery.

</details>

---

### Question 2 — Required Ports for Cluster Components
> ⏱️ **Recommended Time: 5 minutes**

List the ports that must be open on control plane and worker nodes for the cluster to function.

<details>
<summary>✅ Answer</summary>

**Control Plane node ports:**

| Port      | Protocol | Component               | Used By                           |
|-----------|----------|-------------------------|-----------------------------------|
| 6443      | TCP      | kube-apiserver          | All                               |
| 2379–2380 | TCP      | etcd                    | kube-apiserver, etcd peers        |
| 10250     | TCP      | kubelet API             | kube-apiserver, kubectl exec/logs |
| 10259     | TCP      | kube-scheduler          | self                              |
| 10257     | TCP      | kube-controller-manager | self                              |

**Worker node ports:**

| Port        | Protocol | Component         | Used By          |
|-------------|----------|-------------------|------------------|
| 10250       | TCP      | kubelet API       | kube-apiserver   |
| 10256       | TCP      | kube-proxy health | load balancers   |
| 30000–32767 | TCP/UDP  | NodePort Services | external clients |

```bash
# Verify ports are open on control plane
ss -tlnp | grep -E "6443|2379|10250|10259|10257"

# Check from a worker node
nc -zv <control-plane-ip> 6443
nc -zv <control-plane-ip> 2379

# Check kubelet port on worker
nc -zv <worker-ip> 10250

# List all listening ports on a node
ss -tlnp
netstat -tlnp

# Check firewall rules (if using ufw)
ufw status
# Check iptables
iptables -L INPUT | grep -E "6443|10250"
```

> **Key Concept:** The most critical port is **6443** (kube-apiserver) — every component and kubectl communicates through it. Port **10250** (kubelet) must be reachable from the control plane for `kubectl exec`, `kubectl logs`, and health checks. etcd port **2379** should only be accessible from the kube-apiserver — exposing it externally is a security risk.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Inspect Node Network Interfaces and Routing
> ⏱️ **Recommended Time: 7 minutes**

Inspect the network configuration of a node: its interfaces, IPs, and routing table. Identify which interface is used for pod-to-pod cross-node traffic.

<details>
<summary>✅ Answer</summary>

```bash
# List all interfaces on the node
ip addr
# 1: lo: 127.0.0.1/8
# 2: eth0: 192.168.1.11/24      ← node's primary interface (inter-node)
# 3: cni0: 10.244.1.1/24        ← CNI bridge (pod gateway on this node)
# 4: flannel.1: 10.244.1.0/32   ← overlay tunnel interface (Flannel VXLAN)
# 5: veth3a4b...                 ← veth for pod-1
# 6: veth7c8d...                 ← veth for pod-2

# View routing table
ip route
# default via 192.168.1.1 dev eth0              ← default route (external)
# 10.244.0.0/24 via 10.244.0.0 dev flannel.1    ← node1's pods via overlay
# 10.244.1.0/24 dev cni0 proto kernel            ← local pods via bridge
# 192.168.1.0/24 dev eth0 proto kernel           ← node subnet

# Identify which interface cross-node pod traffic uses
ip route get 10.244.0.5   # IP of a pod on another node
# 10.244.0.5 via 10.244.0.0 dev flannel.1 src 10.244.1.0
# → uses flannel.1 overlay tunnel

# For Calico in BGP mode (no overlay):
ip route get 10.244.0.5
# 10.244.0.5 via 192.168.1.10 dev eth0
# → uses eth0 directly (BGP route)

# Check which interface kubelet uses (node IP)
kubectl get node <node-name> -o jsonpath='{.status.addresses}'
# [{"address":"192.168.1.11","type":"InternalIP"}]
```

> **Key Concept:** Cross-node pod traffic takes different paths depending on the CNI: **Flannel/Weave** use overlay tunnels (VXLAN) — packets are encapsulated and sent over `eth0`; **Calico in BGP mode** programs direct routes — packets go straight over `eth0` without encapsulation. The `ip route get <pod-ip>` command shows exactly which interface and next-hop will be used for a given destination.

</details>

---

### Question 4 — Troubleshoot Node-to-Node Connectivity
> ⏱️ **Recommended Time: 7 minutes**

Worker node `node2` cannot reach `node1`. Pods on `node2` cannot reach pods on `node1`. Diagnose and fix.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify node status
kubectl get nodes
# node1   Ready    control-plane
# node2   NotReady worker         ← or Ready but pods failing

# Step 2 — Check basic node-to-node ping
ssh node2
ping -c 3 <node1-ip>
# Request timeout → no basic connectivity

# Step 3 — Check network interface on node2
ip addr show eth0
# Is it up? Does it have correct IP?
ip link set eth0 up    # if down

# Step 4 — Check routing
ip route
# Is there a default route?
# Missing default: ip route add default via <gateway>

# Step 5 — Check if it's a firewall issue
iptables -L FORWARD
# REJECT or DROP rules blocking inter-node traffic?

# Fix overly restrictive iptables:
iptables -P FORWARD ACCEPT

# Step 6 — Check overlay tunnel (for Flannel)
ip link show flannel.1
# Is flannel.1 interface present and UP?

# If CNI overlay is broken, restart CNI pod on node2:
kubectl delete pod -n kube-system <flannel-pod-on-node2>

# Step 7 — Check for MTU mismatch (common with overlays)
ip link show eth0 | grep mtu
# mtu 1500
ip link show flannel.1 | grep mtu
# mtu 1450  ← overlay adds 50 bytes header — MTU must be lower

# If MTU mismatch causing fragmentation:
ip link set flannel.1 mtu 1450

# Step 8 — Check kubelet logs for network errors
journalctl -u kubelet -n 50 | grep -i "network\|cni\|error"
```

> **Key Concept:** Node connectivity issues cascade to pod networking. Work from the bottom up: (1) can nodes ping each other? (2) are CNI pods running on both nodes? (3) are overlay interfaces present? (4) are iptables FORWARD rules correct? MTU mismatches are a subtle but common cause of intermittent failures with overlays — TCP connections work (because TCP handles retransmission) but large packets are silently dropped, causing timeouts.

</details>

---

### Question 5 — Understand and Configure kube-proxy Mode
> ⏱️ **Recommended Time: 8 minutes**

Identify the current kube-proxy mode, explain the difference between `iptables` and `ipvs` modes, and switch to `ipvs` mode.

<details>
<summary>✅ Answer</summary>

```bash
# Check current kube-proxy mode
kubectl get configmap kube-proxy -n kube-system -o yaml | grep mode
# mode: ""          ← empty = iptables (default)
# mode: "ipvs"      ← IPVS mode
# mode: "iptables"  ← explicit iptables

# Check from kube-proxy logs
kubectl logs -n kube-system -l k8s-app=kube-proxy | grep "Using"
# Using iptables Proxier
# OR: Using ipvs Proxier

# Verify iptables rules (iptables mode)
iptables -t nat -L KUBE-SERVICES | head -20
# Shows rules for each Service ClusterIP

# Verify IPVS rules (ipvs mode)
ipvsadm -ln
# TCP  10.96.0.1:443 rr
#   -> 192.168.1.10:6443   Masq   1   0   0

# Switch to IPVS mode:

# Step 1 — Load required kernel modules on all nodes
modprobe ip_vs
modprobe ip_vs_rr
modprobe ip_vs_wrr
modprobe ip_vs_sh
modprobe nf_conntrack

# Make permanent
cat >> /etc/modules-load.d/ipvs.conf <<EOF
ip_vs
ip_vs_rr
ip_vs_wrr
ip_vs_sh
nf_conntrack
EOF

# Step 2 — Edit kube-proxy ConfigMap
kubectl edit configmap kube-proxy -n kube-system
# Change: mode: ""  →  mode: "ipvs"

# Step 3 — Restart kube-proxy pods
kubectl rollout restart daemonset kube-proxy -n kube-system

# Step 4 — Verify
kubectl logs -n kube-system -l k8s-app=kube-proxy | grep "Using"
# Using ipvs Proxier
ipvsadm -ln | head -20
```

| Feature                   | iptables                        | IPVS                       |
|---------------------------|---------------------------------|----------------------------|
| Lookup                    | Sequential rules scan           | Hash table O(1)            |
| Scale                     | Degrades with 1000s of services | Handles 10000s of services |
| Load balancing algorithms | Round-robin only                | rr, wrr, lc, sh, sed, nq   |
| Kernel module             | Built-in                        | Requires `ip_vs_*` modules |

> **Key Concept:** Both kube-proxy modes implement Service VIPs (ClusterIPs) by intercepting traffic destined for Service IPs and rewriting it to actual pod IPs. **iptables** mode uses `DNAT` rules — works fine up to ~1000 services. **IPVS** mode uses kernel-level virtual server hashing — better performance and more load balancing algorithms. Most production clusters use IPVS or Cilium's eBPF (which replaces kube-proxy entirely).

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Diagnose a Cluster Networking Issue Using Node Conditions
> ⏱️ **Recommended Time: 9 minutes**

A node shows `NetworkUnavailable=True` condition. Diagnose and resolve it.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check node conditions
kubectl describe node <node-name> | grep -A 20 "Conditions:"
# Type                 Status
# ----                 ------
# NetworkUnavailable   True      ← problem!
# MemoryPressure       False
# DiskPressure         False
# Ready                False

# Get the message for NetworkUnavailable
kubectl get node <node-name> -o jsonpath='{range .status.conditions[?(@.type=="NetworkUnavailable")]}{.message}{"\n"}{end}'
# "flannel does not ensure ip masq"
# OR "CNI plugin not initialized"
# OR "Node does not have a valid IP address"

# Step 2 — Check CNI pod on this node
kubectl get pods -n kube-system -o wide | grep <node-name>
# flannel-xxxxx   0/1   CrashLoopBackOff   <node-name>  ← CNI pod failing!

# Check CNI pod logs
kubectl logs -n kube-system <flannel-pod> --previous
# Error: failed to find plugin "flannel" in path [/opt/cni/bin]
# → CNI binary missing!

# Step 3 — Verify CNI binaries exist on node
ssh <node-name>
ls /opt/cni/bin/
# Only shows: bridge  host-local  loopback  — flannel binary missing!

# Fix — reinstall CNI plugin
kubectl delete pod -n kube-system <flannel-pod>
# DaemonSet will recreate — but if binary is missing, need to reinstall

# For Flannel, reapply the manifest:
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# Step 4 — Check if node needs to be drained and re-joined
# If CNI config is corrupt beyond repair:
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
# Fix the node, then:
kubectl uncordon <node-name>

# Step 5 — Verify NetworkUnavailable clears
kubectl describe node <node-name> | grep NetworkUnavailable
# NetworkUnavailable   False    ← resolved
kubectl get nodes
# <node-name>   Ready   ...
```

`NetworkUnavailable` causes:

| Message                      | Cause                                   | Fix                                       |
|------------------------------|-----------------------------------------|-------------------------------------------|
| `CNI plugin not initialized` | No CNI config in `/etc/cni/net.d/`      | Reinstall/restart CNI DaemonSet           |
| `flannel not in path`        | CNI binary missing from `/opt/cni/bin/` | Reinstall CNI                             |
| `does not ensure ip masq`    | CNI misconfiguration                    | Check CNI pod logs, reapply manifest      |
| After node reboot            | CNI pod not yet started                 | Wait ~60s for DaemonSet pod to initialize |

> **Key Concept:** `NetworkUnavailable=True` is set by the CNI plugin itself (via the Node API) to signal it hasn't finished configuring the node's network. It's **not** set by kubelet — the CNI plugin's node agent sets it to `False` once setup completes. This condition means the CNI DaemonSet pod on that node has not successfully run. Always start debugging by checking the CNI pod on the affected node.

</details>

---

