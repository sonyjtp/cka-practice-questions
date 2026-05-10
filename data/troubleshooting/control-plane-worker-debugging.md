# 📌 Control Plane & Worker Node Debugging

> **CKA Exam Domain:** Troubleshooting  
> **Topic:** Control Plane Components & Worker Node Issues  
> **Total Questions:** 9

---

## 🟢 Easy Questions

---

### Question 1 — Check Kubelet Service Status
> ⏱️ **Recommended Time: 5 minutes**

Kubelet is not starting on a worker node. How do you verify the service status and check for startup errors?

<details>
<summary>✅ Answer</summary>

```bash
# SSH to the worker node
ssh <worker-node>

# Check kubelet service status
systemctl status kubelet
service kubelet status

# View kubelet service logs
journalctl -u kubelet -n 50
journalctl -u kubelet --no-pager | tail -100

# Check if kubelet process is running
ps aux | grep kubelet

# Check kubelet configuration
cat /etc/kubernetes/kubelet.conf
systemctl cat kubelet

# Verify kubelet binary exists
which kubelet
ls -la /usr/local/bin/kubelet
```

**Common Startup Issues:**
- Configuration file not found
- Permissions denied on certificate files
- Port 10250 already in use
- cgroup driver mismatch

**Restart kubelet:**
```bash
systemctl restart kubelet
systemctl enable kubelet
```

**Key Concept:** Check service status with `systemctl`, view logs with `journalctl`, and verify configuration files exist and are readable by the kubelet user.

</details>

---

### Question 2 — Verify Kubelet Configuration
> ⏱️ **Recommended Time: 5 minutes**

Kubelet is running but pods aren't starting. Verify kubelet configuration is correct.

<details>
<summary>✅ Answer</summary>

```bash
# Check kubelet flags
ps aux | grep kubelet

# View kubelet config file
cat /etc/kubernetes/kubelet.conf
cat /var/lib/kubelet/kubeconfig

# Check kubelet config directory
ls -la /var/lib/kubelet/

# View registered node properties
kubectl describe node <node-name> | head -30

# Check cgroup driver
docker info | grep -i "cgroup driver"
# or
systemctl cat kubelet | grep -i "cgroup"

# Check kubelet API endpoint
curl http://localhost:10250/api/v1/nodes

# Verify node registration
kubectl get nodes <node-name>
kubectl get nodes <node-name> -o yaml | grep -A5 conditions
```

**Common Configuration Issues:**
- Cgroup driver mismatch (docker vs systemd)
- Wrong kubeconfig path
- Hostname doesn't resolve
- Node port (10250) blocked
- Container runtime not responding

**Key Concept:** Kubelet must have correct kubeconfig, cgroup driver matching container runtime, and valid network connectivity to the API server.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Check API Server Component Status
> ⏱️ **Recommended Time: 5 minutes**

The API server appears down. Show commands to verify it's running and healthy.

<details>
<summary>✅ Answer</summary>

```bash
# SSH to control plane node
ssh <control-plane>

# Check if running as static pod
kubectl get pods -n kube-system -l component=kube-apiserver

# Or if systemd managed
systemctl status kube-apiserver

# View logs
kubectl logs -n kube-system -l component=kube-apiserver | tail -50
# or
journalctl -u kube-apiserver -n 50

# Check if port is listening
netstat -tlnp | grep 6443
ss -tlnp | grep 6443

# Test API connectivity
curl -k https://localhost:6443

# Check API server config
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# Verify certificates
ls -la /etc/kubernetes/pki/apiserver.*
```

**Key Concept:** API server runs as a static pod on control plane. Check pod status with `kubectl`, service logs, and port 6443 listening status.

</details>

---

### Question 4 — Resolve Worker Node NotReady Status
> ⏱️ **Recommended Time: 10 minutes**

A worker node shows `NotReady` status even though the system appears healthy. Systematically diagnose the issue.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check node conditions
kubectl describe node <node-name>
# Look for Ready/MemoryPressure/DiskPressure/PIDPressure conditions

# 2. Check current utilization
kubectl top node <node-name>

# 3. SSH to node and check resources
ssh <node-name>
df -h
free -h
ps aux | head -20

# 4. Check kubelet status
systemctl status kubelet
journalctl -u kubelet -n 100

# 5. Check container runtime
docker ps
docker info
# or
ctr containers list

# 6. Check CNI plugin status
ls -la /opt/cni/bin/
cat /etc/cni/net.d/

# 7. Check kubelet logs for specific errors
journalctl -u kubelet -n 200 | grep -i "error\|warning"

# 8. Restart kubelet to refresh conditions
systemctl restart kubelet
sleep 30

# 9. Verify node is ready
kubectl get node <node-name>
```

**Common Causes:**
- **MemoryPressure** — Not enough available memory
- **DiskPressure** — Disk space low (usually /var filesystem)
- **PIDPressure** — Too many processes on node
- **NotReady** — Kubelet can't start containers or reach API server
- **CNI not ready** — Network plugin not deployed or failing

**Fixes:**
```bash
# For disk pressure
docker image prune -a --force
rm -rf /var/lib/kubelet/pods/*

# For memory pressure
# Kill unnecessary processes or resize node

# For CNI issues
# Check CNI plugin: kubectl get daemonsets -n kube-system
# Restart CNI pods if needed

# Drain node for maintenance if needed
kubectl drain <node-name> --ignore-daemonsets
# After fixing, uncordon
kubectl uncordon <node-name>
```

**Key Concept:** NotReady can have many causes. Check conditions first to identify the specific pressure, then address it (disk cleanup, memory, CNI, kubelet restart).

</details>

---

### Question 5 — Debug Controller Manager Issues
> ⏱️ **Recommended Time: 10 minutes**

Deployments aren't creating replicas and cloud-controller-manager seems offline. Troubleshoot controller manager status.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check controller-manager pod
kubectl get pods -n kube-system -l component=kube-controller-manager
kubectl describe pod -n kube-system -l component=kube-controller-manager

# 2. View logs
kubectl logs -n kube-system -l component=kube-controller-manager | tail -50

# 3. Check replica controller errors
kubectl logs -n kube-system -l component=kube-controller-manager | grep -i "replica"

# 4. Check if cloud controller manager is running
kubectl get pods -n kube-system | grep cloud-controller

# 5. Verify service account for controllers
kubectl get sa -n kube-system
kubectl get clusterrolebinding | grep controller

# 6. Test management operations
# Try creating a deployment
kubectl create deployment test --image=nginx

# Check if ReplicaSet was created
kubectl get rs

# If stuck, check events
kubectl describe deployment test
kubectl describe replicaset <rs-name>

# 7. Check controller-manager kubeconfig
cat /etc/kubernetes/controller-manager.conf

# 8. Restart controller manager
# If running as pod
kubectl delete pod -n kube-system -l component=kube-controller-manager
# Pod will be recreated by kubelet

# 9. Verify it's back online
kubectl get pods -n kube-system -l component=kube-controller-manager
```

**Common Issues:**
- Controller manager pod in CrashLoopBackOff
- RBAC missing for service account
- Can't reach API server
- Out of memory

**Diagnosis:**
```bash
# Check for specific errors
kubectl logs -n kube-system -l component=kube-controller-manager | grep -i "error"

# Check RBAC permissions
kubectl describe clusterrolebinding system:kube-controller-manager
```

**Key Concept:** Controller manager reconciles resource state. If down, no deployments/replicasets/services will be managed. Check pod status and logs first.

</details>

---

### Question 6 — Troubleshoot Scheduler Issues
> ⏱️ **Recommended Time: 10 minutes**

Pods are stuck in `Pending` state even though there's available node capacity. The scheduler may be failing. Diagnose.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check scheduler pod status
kubectl get pods -n kube-system -l component=kube-scheduler
kubectl describe pod -n kube-system -l component=kube-scheduler

# 2. View scheduler logs
kubectl logs -n kube-system -l component=kube-scheduler | tail -100

# 3. Check for scheduling failures
kubectl logs -n kube-system -l component=kube-scheduler | grep -i "failed\|cannot"

# 4. Describe pending pod to see events
kubectl describe pod <pending-pod> -n <namespace>
# Look for "failed to fit" or scheduling errors

# 5. Check node capacity and allocations
kubectl describe nodes | grep -A5 "Allocated resources"
kubectl top nodes

# 6. Check scheduler config
cat /etc/kubernetes/manifests/kube-scheduler.yaml

# 7. Verify service account RBAC
kubectl get clusterrolebinding system:kube-scheduler

# 8. Check if scheduler service is bound
netstat -tlnp | grep 10259  # scheduler port

# 9. Restart scheduler
kubectl delete pod -n kube-system -l component=kube-scheduler

# 10. Monitor scheduling after restart
watch kubectl get pods -n <namespace>
```

**Common Scheduling Issues:**
- **Pod requirements (CPU/memory)** — Request exceeds node capacity
- **Node taints** — Tolerations don't match
- **Affinity rules** — No nodes match pod affinity
- **PVC pending** — Can't bind volume
- **Scheduler offline** — Pod stuck pending indefinitely

**Detailed Diagnosis:**
```bash
# Check why pod is pending
kubectl get pod <pod> -o yaml | grep -A10 containers

# Check node selectors
kubectl get pod <pod> -o yaml | grep -A5 nodeSelector

# Check pod affinity
kubectl get pod <pod> -o yaml | grep -A10 affinity

# Find suitable nodes
kubectl get nodes
kubectl describe node <node-name>
```

**Key Concept:** Scheduler places pods on nodes based on resource requests, node selectors, taints/tolerations, and affinity rules. Pending pods indicate scheduling failure.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Recover Cluster After API Server Crash
> ⏱️ **Recommended Time: 15 minutes**

The API server crashed and won't restart. Demonstrate recovery steps including static pod inspection and recovery.

<details>
<summary>✅ Answer</summary>

```bash
# 1. SSH to control plane and verify API server is down
ssh <control-plane>
kubectl get pods -n kube-system -l component=kube-apiserver
# Should be error or not found

# 2. Check system pod status
systemctl status kubelet

# 3. Examine static pod manifest
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 4. Check API server logs
journalctl -u kubectl --no-pager | head -100
# or check containerd logs
crictl logs <container-id>

# 5. Identify the problem
# Check logs for specific errors: permissions, port conflict, certificate issues

# 6. Common fixes based on error:

# Case 1: Port 6443 already in use
netstat -tlnp | grep 6443
kill -9 <PID>

# Case 2: Certificate error
ls -la /etc/kubernetes/pki/apiserver.*
# Regenerate if corrupted:
kubeadm certs renew apiserver

# Case 3: Out of memory
free -h
# Restart with less memory overhead or increase node resources

# Case 4: PVC mount issue
mount -l | grep etcd

# 7. Remove failed static pod to prevent restart attempts
# (Only if you can't fix it immediately)
mv /etc/kubernetes/manifests/kube-apiserver.yaml \
   /tmp/kube-apiserver.yaml.bak

# 8. Fix the underlying issue

# 9. Restore the manifest
mv /tmp/kube-apiserver.yaml.bak \
   /etc/kubernetes/manifests/kube-apiserver.yaml

# 10. Kubelet will automatically start the pod
sleep 10

# 11. Verify API server is back
kubectl get nodes

# 12. Verify cluster health
kubectl get pods -A
kubectl get events -A --sort-by='.lastTimestamp' | tail -20
```

**Advanced Recovery:**

```bash
# If manifest is corrupted, restore from backup
# Or use minimal config to get cluster accessible first

# Create minimal kube-apiserver.yaml
cat > /etc/kubernetes/manifests/kube-apiserver.yaml <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: kube-apiserver
  namespace: kube-system
spec:
  containers:
  - name: kube-apiserver
    image: <correct-image>
    command:
    - kube-apiserver
    - --advertise-address=<node-ip>
    - --etcd-servers=https://127.0.0.1:2379
    - --etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt
    # ... other required flags
EOF

# Wait for pod to start and then update with full config
```

**Prevention:**
```bash
# Backup API server manifest
cp /etc/kubernetes/manifests/kube-apiserver.yaml \
   /backup/kube-apiserver.yaml.bak

# Monitor API server health
kubectl top pod -n kube-system -l component=kube-apiserver
```

**Key Concept:** Static pods are automatically managed by kubelet. If manifest is wrong, kubelet keeps restarting it. Move manifest temporarily to stop restart cycles, fix the issue, then restore.

</details>

---

### Question 8 — Multi-Component Failure Troubleshooting
> ⏱️ **Recommended Time: 15 minutes**

Multiple control plane components are failing (kubelet, API server, scheduler). Systematically diagnose root cause.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Get quick status overview
ssh <control-plane>

systemctl status kubelet
systemctl status kube-apiserver
systemctl status kube-controller-manager
systemctl status kube-scheduler

# 2. Check system resources first (often root cause)
df -h  # Disk space
free -h  # Memory
top -b -n 1 | head -20  # CPU and processes

# 3. Check recent logs for common thread
journalctl -n 200 --no-pager | grep -i "error\|critical"

# 4. Check kernel logs
dmesg | tail -30

# 5. Verify networking
ping 8.8.8.8
ping <api-server-ip>
netstat -tlnp | head -20

# 6. Specific component checks

# A. Kubelet issues
systemctl status kubelet
journalctl -u kubelet -n 100
ps aux | grep kubelet

# B. API server
journalctl -u kube-apiserver -n 100
netstat -tlnp | grep 6443

# C. Controller manager
journalctl -u kube-controller-manager -n 100

# D. Scheduler
journalctl -u kube-scheduler -n 100

# 7. Identify common root causes

# Disk space problem
du -sh /*
find /var/lib -size +500M

# Memory problem
free -h
dmidecode -t memory

# Certificate expiration
kubeadm certs check-expiration

# Time sync issues
date
ntpq -p

# 8. Address root cause

# For disk space
docker system prune -a
rm -rf /var/lib/kubelet/pods/*

# For memory
systemctl stop kube-controller-manager kube-scheduler
# Run only essential components

# For time skew
ntpdate -s time.google.com

# For certificate expiration
kubeadm certs renew all

# 9. Restart components
systemctl restart kubelet
sleep 30

# 10. Verify recovery
kubectl get nodes
kubectl get pods -A
```

**Systematic Troubleshooting Checklist:**

```bash
# Priority 1: System Resources
- [ ] Disk space (df -h)
- [ ] Memory (free -h)
- [ ] CPU (top)
- [ ] Network (ping, netstat)

# Priority 2: Time Sync
- [ ] date
- [ ] ntpq -p

# Priority 3: Certificates
- [ ] kubeadm certs check-expiration

# Priority 4: Component Logs
- [ ] journalctl -u kubelet
- [ ] journalctl -u kube-apiserver
- [ ] journalctl -u kube-controller-manager
- [ ] journalctl -u kube-scheduler

# Priority 5: Restart Components
- [ ] systemctl restart kubelet
- [ ] Components will cascade start
```

**Key Concept:** Multiple failures often have a common root cause (disk full, time skew, certificates, load). Check system health first, then component-specific logs.

</details>

---

### Question 9 — Diagnose Cluster Communication Breakdown
> ⏱️ **Recommended Time: 15 minutes**

No communication between nodes and control plane. Pods can't reach API server. Troubleshoot network and connection issues.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Test network connectivity
ping <control-plane-ip>
ping <worker-node-ip>

# 2. Check DNS resolution
nslookup kubernetes.default
nslookup <hostname>

# 3. Test API server port accessibility
telnet <api-server-ip> 6443
curl -k https://<api-server-ip>:6443

# 4. From worker node, verify connectivity  
ssh <worker>
ping <control-plane-ip>
curl -k https://<control-plane-ip>:6443

# 5. Check network interfaces
ifconfig
ip link show

# 6. Check firewall rules
sudo ufw status
sudo iptables -L
sudo firewall-cmd --list-all

# 7. Check CNI plugin status
kubectl get pods -n kube-system | grep -i "cni\|flannel\|weave"
kubectl describe daemonset -n kube-system <cni-plugin>

# 8. From pod, verify connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
# Inside pod:
ping <control-plane-ip>
nslookup kubernetes.default
wget -O- http://kubernetes.default.svc

# 9. Check Service networking
kubectl get svc kubernetes -n default -o wide

# 10. Check DNS resolution inside pods
kubectl exec <pod> -- cat /etc/resolv.conf
kubectl exec <pod> -- nslookup kubernetes.default

# 11. Check kube-proxy status
kubectl get pods -n kube-system -l k8s-app=kube-proxy
kubectl logs -n kube-system -l k8s-app=kube-proxy | grep -i error

# 12. Check routing tables
route -n
ip route

# 13. Check iptables rules
sudo iptables -L -t filter | grep -i "kubernetes\|service"
sudo iptables -L -t nat | head -30
```

**Network Troubleshooting Checklist:**

```bash
# Layer 1: Physical/Network
- [ ] Ping control plane
- [ ] Ping worker nodes
- [ ] Check interfaces (ifconfig)
- [ ] Check routing (route -n)

# Layer 2: DNS
- [ ] nslookup kubernetes.default
- [ ] /etc/resolv.conf in pods
- [ ] CoreDNS pod status

# Layer 3: Firewall
- [ ] Ports 6443, 10250 open
- [ ] Security groups allow traffic
- [ ] iptables rules

# Layer 4: CNI
- [ ] CNI pod running
- [ ] Network plugin deployed
- [ ] Pod IP assignment working

# Layer 5: kube-proxy
- [ ] kube-proxy pods running
- [ ] iptables rules present
- [ ] Service endpoints resolving
```

**Common Causes:**
- **Firewall blocking ports** — 6443 (API), 10250 (kubelet)
- **CNI not deployed** — Pods can't get IPs, networks don't exist
- **DNS not working** — CoreDNS down or misconfigured
- **Security groups** — Cloud provider blocking traffic
- **Wrong kubeconfig** — Points to wrong IP/hostname
- **kube-proxy offline** — Service networking broken

**Fixes:**
```bash
# Open firewall ports
sudo ufw allow 6443/tcp
sudo firewall-cmd --permanent --add-port=6443/tcp

# Deploy CNI plugin
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml

# Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# Verify connectivity
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
```

**Key Concept:** Network communication failures usually stem from firewall, CNI not deployed, DNS issues, or misconfigured kube-proxy. Test each layer systematically.

</details>

---

