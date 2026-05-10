# ⚙️ Kubelet Configuration & Node Management

> **CKA Exam Domain:** Cluster Architecture  
> **Topic:** Kubelet configuration, node settings, kubelet startup flags  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Locate and view kubelet configuration
> ⏱️ **Recommended Time: 4 minutes**

Find and examine the kubelet configuration file on a node.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to a worker node
ssh node1

# Kubelet config file is typically at:
cat /var/lib/kubelet/config.yaml

# View key kubelet config sections
cat /var/lib/kubelet/config.yaml | head -30

# Common kubelet config parameters:

# Port for kubelet API
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
port: 10250           # Kubelet API port

# Pod manifest path (static pods)
staticPodPath: /etc/kubernetes/manifests

# Log level
logging:
  format: json
  level: info           # info, warning, error, debug

# Container runtime
containerRuntimeEndpoint: unix:///run/containerd/containerd.sock

# Kubelet name
nodeName: node1

# Register with API server
registerNode: true

# Enabled features
featureGates:
  RotateKubeletServerCertificate: true

# Resource reservation
systemReserved:
  cpu: 100m
  memory: 256Mi
ephemeralStorage: 1Gi

# Eviction thresholds
evictionHard:
  memory.available: 100Mi
  nodefs.available: 10%
```

Common locations:

| Location                                 | Notes                        |
|------------------------------------------|------------------------------|
| `/var/lib/kubelet/config.yaml`           | Main config file             |
| `/var/lib/kubelet/kubeconfig`            | Authentication to API server |
| `/etc/kubernetes/kubelet-env`            | Environment variables        |
| `/etc/systemd/system/kubelet.service.d/` | Systemd overrides            |

> **Key Concept:** Kubelet configuration controls node-level behavior: container runtime, logging, resource reservation, eviction policies. Config file is YAML-based and typically located at `/var/lib/kubelet/config.yaml`.

</details>

---

### Question 2 — View kubelet startup flags
> ⏱️ **Recommended Time: 4 minutes**

Inspect the kubelet process to see which flags are in use.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to node
ssh node1

# View kubelet process and flags
ps aux | grep kubelet | grep -v grep

# Output example:
# root  1234 ... /usr/bin/kubelet \
#   --bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubeconfig \
#   --kubeconfig=/etc/kubernetes/kubelet.conf \
#   --config=/var/lib/kubelet/config.yaml \
#   --container-runtime=remote \
#   --container-runtime-endpoint=unix:///run/containerd/containerd.sock

# Kubelet flags can be provided via:
# 1. Command-line arguments
# 2. Config file (/var/lib/kubelet/config.yaml)
# 3. Environment variables (in service file)

# Check systemd service for flags
cat /etc/systemd/system/kubelet.service
# [Service]
# ExecStart=/usr/bin/kubelet \
#   --config=/var/lib/kubelet/config.yaml

# Check for drop-in configuration directories
ls /etc/systemd/system/kubelet.service.d/
# 10-kubeadm.conf (usually sets --config flag)

# View merged configuration
systemctl show kubelet | grep ExecStart

# Common flags:
# --config=PATH - Use config file (recommended, v1.10+)
# --node-name=NAME - Node name
# --kubeconfig=PATH - Credentials to contact API server
# --container-runtime=remote - Use CRI endpoint
# --pod-manifest-path=PATH - Directory with static pods
# --v=LEVEL - Log verbosity level (0-4)
# --register-node=true - Register with API server
# --allowed-unsafe-sysctls=* - Allow unsafe sysctls
```

> **Key Concept:** Kubelet can be configured via config file (recommended) or command-line flags. Modern kubeadm clusters use config files. Flags can be viewed with `ps aux | grep kubelet`.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Check node resource reservation
> ⏱️ **Recommended Time: 5 minutes**

View and understand system reserved and kube-reserved resources on a node.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to node
ssh node1

# Check kubelet config for reserved resources
cat /var/lib/kubelet/config.yaml | grep -A 10 "systemReserved\|kubeReserved"

# Example output:
# systemReserved:
#   cpu: 100m
#   memory: 256Mi
#   ephemeralStorage: 1Gi
# kubeReserved:
#   cpu: 50m
#   memory: 128Mi

# Check node allocatable
kubectl describe node node1 | grep -A 5 "Allocatable:"
# Allocated = Total - (SystemReserved + KubeReserved + hardEvictionThreshold)

# Example:
# Total:     4 CPU, 8Gi memory
# SystemReserved: 100m, 256Mi (for OS, sshd, etc)
# KubeReserved: 50m, 128Mi (for kubelet, runtime, etc)
# HardEvictionThreshold: 100Mi memory
# Allocatable: ~3700m CPU, ~7.5Gi memory

# Get full node capacity and allocatable
kubectl get node node1 -o jsonpath='{.status.capacity, .status.allocatable}'

# Pretty format
kubectl get node node1 -o yaml | grep -A 10 "capacity:\|allocatable:"
```

Resource reservation breakdown:

```
Total Node Resources = 4 CPU, 8Gi memory

System Reserved (kubelet --system-reserved)
├─ sshd, init, systemd
├─ CPU: 100m, Memory: 256Mi
└─ Purpose: Prevent OS from being starved

Kube Reserved (kubelet --kube-reserved)
├─ kubelet, container runtime, cni
├─ CPU: 50m, Memory: 128Mi
└─ Purpose: Prevent system daemons from OOMing

Hard Eviction Threshold (kubelet --eviction-hard)
├─ memory.available: 100Mi
├─ nodefs.available: 10%
└─ Purpose: Trigger eviction before node runs out

Allocatable (for pod scheduling)
└─ Available for user pods = Total - (Reserved + EvictionThreshold)
   = 4000m - (100m + 50m) = 3850m CPU
   = 8192Mi - (256Mi + 128Mi + 100Mi) = 7.7Gi memory
```

> **Key Concept:** Node resources are divided into reserved (for system/kubelet), hard eviction threshold (safety margin), and allocatable (for pods). Understanding this prevents pod scheduling in situations where the node actually lacks capacity.

</details>

---

### Question 4 — Modify kubelet configuration
> ⏱️ **Recommended Time: 7 minutes**

Update kubelet configuration and restart the kubelet service.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to node
ssh node1

# Step 1: Backup original config
sudo cp /var/lib/kubelet/config.yaml /var/lib/kubelet/config.yaml.backup

# Step 2: Edit kubelet config
sudo vi /var/lib/kubelet/config.yaml

# Example changes:
# 1. Increase log level for debugging
# logging:
#   level: debug    # Changed from info to debug

# 2. Add system reserved resources
# systemReserved:
#   cpu: 200m       # Increased from 100m
#   memory: 512Mi   # Increased from 256Mi

# 3. Change eviction hard threshold
# evictionHard:
#   memory.available: "50Mi"  # Stricter threshold

# Step 3: Restart kubelet
sudo systemctl restart kubelet

# Step 4: Wait for kubelet to come back up
sleep 5
systemctl status kubelet

# Step 5: Verify changes took effect
ps aux | grep kubelet | grep -v grep
# Should show updated flags (if via command line)

# Or check if node status returns to Ready
kubectl get nodes

# Step 6: Monitor kubelet logs for issues
journalctl -u kubelet -f

# If kubelet fails to start, restore from backup
sudo cp /var/lib/kubelet/config.yaml.backup /var/lib/kubelet/config.yaml
sudo systemctl restart kubelet
```

Systemd configuration override (alternative method):

```bash
# Instead of editing config.yaml, create systemd override
sudo mkdir -p /etc/systemd/system/kubelet.service.d/

# Create override file
cat << EOF | sudo tee /etc/systemd/system/kubelet.service.d/10-logging.conf
[Service]
Environment="KUBELET_EXTRA_ARGS=--v=4"
EOF

# Reload systemd and restart
sudo systemctl daemon-reload
sudo systemctl restart kubelet
```

> **Key Concept:** Kubelet configuration changes require restart to take effect. Always backup before modifying. Monitor logs after restart for errors.

</details>

---

### Question 5 — Understand kubelet eviction policies
> ⏱️ **Recommended Time: 7 minutes**

Configure kubelet eviction to trigger pod removal when node resources run low.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to node
ssh node1

# View eviction configuration
cat /var/lib/kubelet/config.yaml | grep -A 20 "eviction"

# Example eviction config:
# evictionHard:
#   memory.available: 100Mi      # Evict pods when <100Mi free
#   nodefs.available: 10%        # Evict pods when <10% disk available
#   imagefs.available: 15%       # Evict pods when <15% image storage
#   pid.available: 10            # Evict pods when <10 PIDs available
#
# evictionSoft:
#   memory.available: 200Mi      # Warning threshold (before hard eviction)
#   nodefs.available: 15%
#
# evictionSoftGracePeriod:       # Grace period before soft eviction
#   memory.available: 2m
#   nodefs.available: 2m
#
# evictionMaxPodGracePeriod: 120 # Max grace period for pod shutdown

# Eviction signals:
evictionSignals:
- memory.available
- nodefs.available
- imagefs.available
- nodefs.inodesFree
- imagefs.inodesFree
- pid.available

# Monitor evictions (when they occur)
journalctl -u kubelet | grep -i "evict"
# Output:
# kubelet: Evicting pod default/my-pod from node node1
# kubelet: Pod evicted due to memory pressure

# Check node conditions indicating pressure
kubectl describe node node1 | grep -E "MemoryPressure|DiskPressure|PIDPressure"

# Expected output when under pressure:
# MemoryPressure   True   KubeletHasInsufficientMemory
# DiskPressure     True   KubeletHasInsufficientDisk

# Eviction order (what gets evicted first):
# 1. Best Effort pods (no resource requests)
# 2. Burstable pods (requests < limits)
# 3. Guaranteed pods (requests == limits)
# Within each tier:
# - Pods furthest over their request get evicted first
```

Eviction configuration example:

```yaml
# Conservative (evict late, when really full)
evictionHard:
  memory.available: "50Mi"
  nodefs.available: "5%"
evictionSoft:
  memory.available: "100Mi"
  nodefs.available: "10%"
evictionSoftGracePeriod:
  memory.available: "5m"
  nodefs.available: "5m"

# Aggressive (evict early to prevent node crash)
evictionHard:
  memory.available: "200Mi"
  nodefs.available: "15%"
evictionSoft:
  memory.available: "400Mi"
  nodefs.available: "20%"
evictionSoftGracePeriod:
  memory.available: "2m"
  nodefs.available: "2m"
```

> **Key Concept:** Eviction prevents node out-of-memory crashes by removing pods when resources run low. Soft eviction gives grace period; hard eviction is immediate. Pod QoS class determines eviction order.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Drain and cordon nodes
> ⏱️ **Recommended Time: 8 minutes**

Use `kubectl drain` and `kubectl cordon` to gracefully remove pods from a node during maintenance.

<details>
<summary>✅ Answer</summary>

```bash
# Scenario: Need to take node1 offline for maintenance

# Step 1: Cordon the node (mark unschedulable, no new pods)
kubectl cordon node1
# node/node1 cordoned

# Verify node is cordoned
kubectl get nodes
# STATUS shows: Ready,SchedulingDisabled

# Step 2: Drain the node (remove existing pods gracefully)
kubectl drain node1 --ignore-daemonsets --delete-emptydir-data

# Flags:
# --ignore-daemonsets - Don't try to remove DaemonSet pods
# --delete-emptydir-data - Allow removal of pods with emptyDir volumes
# --grace-period=30 - Give pods 30 seconds to gracefully shut down
# --timeout=5m - Max time to wait for pod eviction
# --dry-run=client - Preview what would be evicted (safe to test)

# Example: safe test first
kubectl drain node1 --dry-run=client --ignore-daemonsets

# Actual drain
kubectl drain node1 --ignore-daemonsets --delete-emptydir-data --grace-period=60

# Drain only deletes:
# - Deployments, ReplicaSets (pods replaced elsewhere)
# - StatefulSets (drained with PVC preserved)
# - DaemonSets (skipped, recreated on all nodes)
# - Standalone Pods (ERROR - use --force)

# Force evict pods that block drain
kubectl drain node1 --ignore-daemonsets --force --grace-period=0 --timeout=5s

# Step 3: Verify pods are moved
kubectl get pods -o wide | grep -v node1
# Pods should now be on other nodes

# Step 4: Perform maintenance
ssh node1
# Upgrade node OS, kernel, kubelet, etc

# Step 5: Uncordon the node (mark schedulable again)
kubectl uncordon node1
# node/node1 uncordoned

# New pods can now schedule on the node
kubectl get nodes
# STATUS: Ready (no SchedulingDisabled)

# Practical example: Rolling node upgrade

# For each node in the cluster:
for node in $(kubectl get nodes -o name); do
  echo "Processing $node"
  kubectl cordon $node
  kubectl drain $node --ignore-daemonsets --delete-emptydir-data --timeout=5m
  
  # SSH and upgrade
  ssh ${node#node/}
  # apt update && apt upgrade -y
  # systemctl reboot
  
  # Wait for node to come back
  kubectl wait --for=condition=ready node/$node --timeout=300s
  
  kubectl uncordon $node
done
```

Drain vs Cordon:

| Command    | Action              | Pods Removed             |
|------------|---------------------|--------------------------|
| `cordon`   | Mark unschedulable  | No (existing pods stay)  |
| `drain`    | Evict pods + cordon | Yes (pods moved/deleted) |
| `uncordon` | Mark schedulable    | No effect                |

Common drain scenarios:

```bash
# Drain but skip problematic pods
kubectl drain node1 \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --skip-wait-for-delete-timeout=true

# Force drain with no grace period (for hanging pods)
kubectl drain node1 --force --grace-period=0 --timeout=10s

# Drain specific namespace only
kubectl drain node1 -n kube-system --ignore-daemonsets

# Drain and verify
kubectl drain node1 \
  --ignore-daemonsets \
  --delete-emptydir-data \
  && echo "Drain successful" \
  || echo "Drain failed"
```

> **Key Concept:** `cordon` stops new pods from scheduling. `drain` evicts existing pods gracefully. Always drain before node maintenance to avoid abrupt pod termination.

</details>

---

