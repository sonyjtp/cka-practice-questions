# 🔌 CNI & IPAM

> **CKA Exam Domain:** Networking  
> **Topic:** Container Network Interface (CNI), IPAM, CNI plugins, troubleshooting  
> **Total Questions:** 6

---

> ℹ️ **Scope Note:** CKA tests understanding of CNI concepts, where CNI plugins are installed, and troubleshooting pod networking failures caused by CNI misconfigurations. You are not expected to install CNI from scratch but must know how it works.

---

## 🟢 Easy Questions

---

### Question 1 — Identify the CNI Plugin in Use
> ⏱️ **Recommended Time: 4 minutes**

Identify which CNI plugin is currently installed on the cluster and where its configuration is stored.

<details>
<summary>✅ Answer</summary>

```bash
# CNI config files are stored in:
ls /etc/cni/net.d/
# 10-flannel.conflist       ← Flannel
# 10-calico.conflist        ← Calico
# 10-weave.conf             ← Weave
# 10-kindnet.conflist       ← kindnet (kind clusters)

# View the CNI config
cat /etc/cni/net.d/10-calico.conflist

# CNI plugin binaries are stored in:
ls /opt/cni/bin/
# bridge  calico  calico-ipam  flannel  host-local  loopback  portmap  ...

# Check which CNI plugin pods are running
kubectl get pods -n kube-system | grep -E "calico|flannel|weave|cilium|kindnet"
# calico-node-xxxxx   Running   ← Calico DaemonSet

# Check kubelet's CNI configuration
cat /var/lib/kubelet/config.yaml | grep -i cni
# or
systemctl status kubelet | grep cni
ps aux | grep kubelet | grep cni
```

> **Key Concept:** CNI (Container Network Interface) is a specification for network plugins. When a pod is created, kubelet calls the CNI plugin to set up the pod's network interface. CNI config is in `/etc/cni/net.d/` (lowest-numbered file is used first). Plugin binaries are in `/opt/cni/bin/`. Common CKA exam CNI plugins: **Weave**, **Calico**, **Flannel**.

</details>

---

### Question 2 — Understand IPAM (IP Address Management)
> ⏱️ **Recommended Time: 5 minutes**

Explain how pods get their IP addresses and identify the IPAM configuration on the cluster.

<details>
<summary>✅ Answer</summary>

```bash
# View IPAM config in CNI conflist
cat /etc/cni/net.d/10-calico.conflist | grep -A 10 ipam
# "ipam": {
#   "type": "calico-ipam"
# }

# Common IPAM plugins:
# host-local    → allocates IPs from a local range (stored on disk)
# calico-ipam   → Calico's IPAM (pool-based)
# whereabouts   → cluster-wide IPAM

# Check host-local IPAM allocations
ls /var/lib/cni/networks/
cat /var/lib/cni/networks/<network-name>/<ip-address>

# View pod CIDR assigned to each node
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'
# node1   10.244.0.0/24
# node2   10.244.1.0/24
# node3   10.244.2.0/24

# View cluster-wide pod CIDR
kubectl cluster-info dump | grep -i podCIDR
# or check kube-controller-manager
cat /etc/kubernetes/manifests/kube-controller-manager.yaml | grep cluster-cidr
# --cluster-cidr=10.244.0.0/16

# Check a pod's IP
kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'
```

> **Key Concept:** IPAM is the CNI sub-plugin responsible for assigning IP addresses to pods. Each node gets a **podCIDR** subnet from the cluster's `--cluster-cidr`. The IPAM plugin allocates IPs from the node's subnet. `host-local` IPAM stores allocations in files under `/var/lib/cni/networks/` — each file is named after the allocated IP and contains the container ID that owns it.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Install a CNI Plugin (Weave)
> ⏱️ **Recommended Time: 7 minutes**

A new cluster has been bootstrapped with `kubeadm` but nodes are in `NotReady` state because no CNI is installed. Install the Weave CNI plugin.

<details>
<summary>✅ Answer</summary>

```bash
# Verify nodes are NotReady (no CNI)
kubectl get nodes
# NAME     STATUS     ROLES           AGE
# master   NotReady   control-plane   2m
# worker   NotReady   <none>          1m

# Check why nodes are NotReady
kubectl describe node master | grep -A 5 "Conditions"
# Ready   False   KubeletNotReady   container runtime network not ready:
#                 NetworkReady=false reason:NetworkPluginNotReady

# Install Weave CNI
kubectl apply -f https://github.com/weaveworks/weave/releases/download/v2.8.1/weave-daemonset-k8s.yaml

# Verify Weave pods are running
kubectl get pods -n kube-system -l name=weave-net
# NAME              READY   STATUS    RESTARTS
# weave-net-xxxxx   2/2     Running   0

# Nodes should become Ready within ~60 seconds
kubectl get nodes --watch
# master   Ready   control-plane   5m
# worker   Ready   <none>          4m

# Verify CNI config was created
ls /etc/cni/net.d/
# 10-weave.conf

# Verify pod CIDR assignment
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDR}{"\n"}{end}'
```

> **Key Concept:** After `kubeadm init`, nodes remain `NotReady` until a CNI plugin is installed — kubelet reports `NetworkPluginNotReady`. CNI plugins are typically installed as Kubernetes DaemonSets (one pod per node) that configure the host network and write CNI config files. The kubeadm `--pod-network-cidr` flag should match the CNI plugin's expected range (e.g., Weave: `10.32.0.0/12`, Flannel: `10.244.0.0/16`, Calico: `192.168.0.0/16`).

</details>

---

### Question 4 — Troubleshoot CNI / Pod Networking Failure
> ⏱️ **Recommended Time: 8 minutes**

Pods on `node2` are stuck in `ContainerCreating` and the events show a CNI error. Diagnose and fix.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check pod events
kubectl describe pod <pod-name> | grep -A 10 Events
# Warning  FailedCreatePodSandBox  Failed to create pod sandbox:
# rpc error: code = Unknown desc = failed to setup network for sandbox
# "...": error adding container to network "weave": ...

# Step 2 — Check CNI config on the node
ssh node2
ls /etc/cni/net.d/          # should have a CNI config file
ls /opt/cni/bin/            # should have CNI plugin binaries

# Step 3 — Check if CNI DaemonSet pod is running on node2
kubectl get pods -n kube-system -l name=weave-net -o wide
# weave-net-xxxxx   0/2   CrashLoopBackOff   node2  ← problem!

# Step 4 — Check CNI pod logs
kubectl logs -n kube-system weave-net-xxxxx -c weave
# Look for: "Error", "failed", "permission denied"

# Step 5 — Check kubelet logs on node2
ssh node2 journalctl -u kubelet -n 50 | grep -i cni

# Common fixes:

# Fix A — CNI binary missing
ssh node2 ls /opt/cni/bin/
# Copy missing binary from another node or reinstall CNI DaemonSet

# Fix B — CNI config corrupt
ssh node2 cat /etc/cni/net.d/10-weave.conf
# Delete and let CNI DaemonSet recreate it
ssh node2 rm /etc/cni/net.d/10-weave.conf
kubectl delete pod -n kube-system weave-net-<node2-pod>
# DaemonSet recreates the pod which rewrites the CNI config

# Fix C — CNI DaemonSet pod not scheduled on node2
kubectl describe node node2 | grep Taint
# If tainted, remove taint or add toleration to CNI DaemonSet

# Verify fix
kubectl get pods -n kube-system -l name=weave-net -o wide
kubectl get pods -o wide    # new pods on node2 should start
```

> **Key Concept:** CNI failures manifest as `ContainerCreating` stuck pods with "failed to setup network for sandbox" events. The root causes are usually: (1) CNI plugin binary missing from `/opt/cni/bin/`, (2) CNI config missing/corrupt in `/etc/cni/net.d/`, or (3) the CNI DaemonSet pod is not running on that node. Always check the CNI pod logs on the affected node first.

</details>

---

### Question 5 — Inspect CNI Network Interface on a Pod
> ⏱️ **Recommended Time: 8 minutes**

Trace the network path from a pod to the host: find the pod's veth interface, locate its pair on the host, and confirm it's connected to the CNI bridge.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Get pod's node and IP
kubectl get pod <pod-name> -o wide
# NAME       IP           NODE
# my-pod     10.244.1.5   node2

# Step 2 — Check the pod's network interface
kubectl exec <pod-name> -- ip addr
# 1: lo: <LOOPBACK>  127.0.0.1/8
# 3: eth0@if15: <BROADCAST> 10.244.1.5/24   ← pod's eth0, peer index 15

# Step 3 — Find the peer veth on the host
ssh node2
ip link | grep -A 1 "^15:"
# 15: cali1a2b3c4d5e@if3: <BROADCAST> ...  ← Calico veth peer (index 15)
# OR for bridge-based CNI:
# 15: veth1a2b3c4@if3: ...

# Step 4 — Check it's connected to the bridge
bridge link show
# 15: cali1a2b3c4d5e master cni0 state forwarding  ← connected to cni0 bridge
# OR
ip link show cni0
brctl show cni0         # bridge with veth interfaces as ports

# Step 5 — Verify routing
ip route | grep 10.244.1.0
# 10.244.1.0/24 dev cni0 proto kernel scope link src 10.244.1.1
# Traffic for pod subnet goes through cni0 bridge

# Step 6 — Verify cross-node routing (for overlay CNI like Weave/Flannel)
ip route | grep 10.244.2.0
# 10.244.2.0/24 via 192.168.1.12 dev flannel.1 onlink
# OR via tunnel interface (weave, vxlan)
```

> **Key Concept:** Each pod gets a **veth pair** — one end (`eth0`) inside the pod's network namespace, the other end on the host. Host-end veth interfaces are attached to a bridge (`cni0`, `weave`, `cbr0`) or managed directly via routing rules (Calico in BGP mode). Understanding this path is essential for troubleshooting: pod → veth → bridge → routing → tunnel/BGP → remote node → bridge → veth → pod.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Understand CNI Configuration File Structure
> ⏱️ **Recommended Time: 7 minutes**

Write a minimal CNI configuration for a bridge network with host-local IPAM that assigns pods IPs from `10.244.1.0/24`.

<details>
<summary>✅ Answer</summary>

```bash
# CNI config file: /etc/cni/net.d/10-bridge.conf
cat > /etc/cni/net.d/10-bridge.conf <<EOF
{
  "cniVersion": "0.3.1",
  "name": "mynet",
  "type": "bridge",          
  "bridge": "cni0",          
  "isGateway": true,         
  "ipMasq": true,            
  "ipam": {
    "type": "host-local",    
    "subnet": "10.244.1.0/24",
    "routes": [
      { "dst": "0.0.0.0/0" } 
    ]
  }
}
EOF
```

Key fields explained:

| Field         | Value           | Purpose                                           |
|---------------|-----------------|---------------------------------------------------|
| `cniVersion`  | `0.3.1`         | CNI spec version                                  |
| `type`        | `bridge`        | CNI plugin binary to call (`/opt/cni/bin/bridge`) |
| `bridge`      | `cni0`          | Linux bridge to create/use                        |
| `isGateway`   | `true`          | Assign IP to bridge (used as pod gateway)         |
| `ipMasq`      | `true`          | NAT outbound traffic leaving the node             |
| `ipam.type`   | `host-local`    | Use host-local IPAM plugin                        |
| `ipam.subnet` | `10.244.1.0/24` | IP range for this node's pods                     |
| `ipam.routes` | `0.0.0.0/0`     | Default route added inside pod                    |

```bash
# Verify the bridge is created after a pod starts
ip link show cni0
# cni0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ... inet 10.244.1.1/24

# Verify IPAM allocations
ls /var/lib/cni/networks/mynet/
# 10.244.1.2   10.244.1.3   last_reserved_ip.0

# Test: create a pod and check it gets an IP from this range
kubectl run test --image=busybox --command -- sleep 3600
kubectl get pod test -o jsonpath='{.status.podIP}'
# 10.244.1.2
```

> **Key Concept:** CNI config files in `/etc/cni/net.d/` define how pods get network interfaces. The `type` field maps to a binary in `/opt/cni/bin/`. A `.conflist` file chains multiple plugins (e.g., bridge + portmap + bandwidth). Kubernetes calls the CNI plugin via kubelet for every pod add/delete. Understanding the config structure helps you diagnose why pods get wrong IPs or fail to get IPs at all.

</details>

---

