# 📌 Kubernetes Cluster Troubleshooting

> **CKA Exam Domain:** Troubleshooting  
> **Topic:** Cluster Components & Node Debugging  
> **Total Questions:** 6

---

## 🟢 Easy Questions

---

### Question 1 — Debug a Pending Pod
> ⏱️ **Recommended Time: 5 minutes**

A Pod is stuck in `Pending` state. What commands would you use to investigate the issue?

<details>
<summary>✅ Answer</summary>

```bash
# Describe the pod to see events and status
kubectl describe pod <pod-name> -n <namespace>

# Check node capacity and resource availability
kubectl top nodes
kubectl describe nodes

# Check for resource requests/limits in pod spec
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A5 resources

# View kubelet logs on the node
ssh <node-name>
journalctl -u kubelet -n 50
```

**Key Concept:** `Pending` usually means the scheduler can't find a suitable node. Check events in `kubectl describe pod`, node capacity with `kubectl top nodes`, and ensure the cluster has enough resources.

</details>

---

### Question 2 — Identify a CrashLoopBackOff Pod
> ⏱️ **Recommended Time: 5 minutes**

A Pod is in `CrashLoopBackOff` state. How do you view the container logs to diagnose the issue?

<details>
<summary>✅ Answer</summary>

```bash
# View current logs
kubectl logs <pod-name> -n <namespace>

# View logs from the previous container instance
kubectl logs <pod-name> -n <namespace> --previous

# Follow logs in real-time
kubectl logs <pod-name> -n <namespace> -f

# View logs for a specific container (if multiple containers)
kubectl logs <pod-name> -n <namespace> -c <container-name>

# Get detailed pod information
kubectl describe pod <pod-name> -n <namespace>
```

**Key Concept:** `CrashLoopBackOff` indicates the container is crashing and restarting. Check logs with `kubectl logs --previous` to see the last run before the crash, and examine the pod events with `kubectl describe`.

</details>

---

### Question 3 — Check Node Status
> ⏱️ **Recommended Time: 5 minutes**

A node appears unhealthy. Show the commands to check node status, available resources, and running processes.

<details>
<summary>✅ Answer</summary>

```bash
# View node status and conditions
kubectl get nodes
kubectl describe node <node-name>

# Check node capacity and allocatable resources
kubectl get nodes -o wide
kubectl top node <node-name>

# SSH into the node and check disk/memory
ssh <node-name>

# Check disk usage
df -h

# Check memory usage
free -h

# Check running processes and kubelet
ps aux | grep kubelet
systemctl status kubelet

# Check kubelet logs
journalctl -u kubelet -n 100 --no-pager
```

**Key Concept:** Use `kubectl describe node` to see conditions (Ready, MemoryPressure, DiskPressure, etc.). SSH into the node to verify system resources and kubelet service health.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Troubleshoot Service Connectivity
> ⏱️ **Recommended Time: 10 minutes**

A Service is created, but Pods cannot reach it. Outline the steps to debug the connectivity issue.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Verify service endpoints
kubectl get svc <service-name> -n <namespace>
kubectl describe svc <service-name> -n <namespace>
kubectl get endpoints <service-name> -n <namespace>

# 2. Check if pods match the service selector
kubectl get pods -n <namespace> --show-labels
# Verify labels match service selector

# 3. Test connectivity from a pod
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
wget -O- http://<service-name>:<port>
wget -O- http://<service-ip>:<port>

# 4. Check DNS resolution
nslookup <service-name>
nslookup <service-name>.<namespace>.svc.cluster.local

# 5. Check kube-proxy logs
kubectl logs -n kube-system ds/kube-proxy
# or SSH to node:
journalctl -u kube-proxy -n 50

# 6. Verify firewall rules and network policies
kubectl get networkpolicies -n <namespace>
kubectl describe networkpolicy <policy-name> -n <namespace>
```

**Key Concept:** Service connectivity issues often stem from:
1. **Mismatched labels** — pods don't match service selector
2. **No endpoints** — service selector doesn't match any pods
3. **DNS issues** — CoreDNS misconfiguration or DNSPolicy
4. **NetworkPolicy** — policies blocking traffic
5. **kube-proxy failures** — iptables rules not applied

</details>

---

### Question 5 — Debug Persistent Volume Issues
> ⏱️ **Recommended Time: 10 minutes**

A PersistentVolumeClaim (PVC) is stuck in `Pending` state. How would you troubleshoot this?

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check PVC status
kubectl get pvc -n <namespace>
kubectl describe pvc <pvc-name> -n <namespace>

# 2. Check available PersistentVolumes
kubectl get pv
kubectl describe pv <pv-name>

# 3. Check StorageClass
kubectl get storageclass
kubectl describe storageclass <storage-class-name>

# 4. Look at events for error details
kubectl describe pvc <pvc-name> -n <namespace>  # Check Events section

# 5. If using dynamic provisioning, check provisioner status
kubectl logs -n <provisioner-namespace> <provisioner-pod>

# 6. Verify storage backend accessibility
# For AWS EBS: aws ec2 describe-volumes
# For NFS: mount -t nfs <nfs-server>:<path> /mnt/test

# 7. Check node scheduling if pod using PVC is pending
kubectl describe pvc <pvc-name> -n <namespace>
kubectl describe node <node-name>
```

**Common Issues:**
- **No matching PV** — PV doesn't exist or access modes don't match
- **Provisioner failing** — StorageClass provisioner unavailable
- **Storage backend down** — NFS server offline, EBS inaccessible
- **Access mode mismatch** — PVC requires ReadWriteMany, PV is ReadWriteOnce

**Key Concept:** Check PVC/PV status, verify StorageClass provisioner is running, and validate the storage backend is accessible.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Multi-Issue Cluster Troubleshooting Scenario
> ⏱️ **Recommended Time: 15 minutes**

Your Kubernetes cluster has multiple issues:
1. Some pods are in `ImagePullBackOff` state
2. A node shows `NotReady` status with `DiskPressure: True`
3. A Service's endpoints show `<none>`
4. DNS resolution inside pods is failing

Provide the debugging steps and fixes for each issue.

<details>
<summary>✅ Answer</summary>

**Issue 1: ImagePullBackOff**

Debugging:
```bash
kubectl describe pod <pod-name> -n <namespace>
# Look for Events section mentioning image pull errors

# Check container runtime logs
ssh <node-name>
journalctl -u docker -n 50
# or
journalctl -u containerd -n 50
```

Possible fixes:
```bash
# Verify image exists in registry
docker pull <image-uri>

# Check image pull secrets
kubectl get secrets -n <namespace> | grep docker

# Create secret if needed
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<pass> \
  -n <namespace>

# Update pod spec to use the secret
imagePullSecrets:
  - name: regcred
```

---

**Issue 2: Node NotReady with DiskPressure**

Debugging:
```bash
kubectl describe node <node-name>
# Check Conditions section

ssh <node-name>
df -h
# Check kubelet directory
du -h /var/lib/kubelet/pods/

# Check kubelet logs
journalctl -u kubelet -n 100
```

Fixes:
```bash
# Clean up unused images
docker image prune -a --force

# Clean up kubelet ephemeral storage
rm -rf /var/lib/kubelet/pods/*  # Use with caution!

# Restart kubelet to refresh conditions
systemctl restart kubelet

# Drain node before cleanup (safe approach)
kubectl drain <node-name> --ignore-daemonsets
# After cleanup, uncordon the node
kubectl uncordon <node-name>
```

---

**Issue 3: Service with No Endpoints**

Debugging:
```bash
kubectl get svc -n <namespace>
kubectl get endpoints -n <namespace>

# Check service selector
kubectl get svc <service-name> -o yaml | grep selector

# Check pod labels
kubectl get pods -n <namespace> --show-labels
```

Fixes:
```bash
# Ensure labels match between pods and service selector
# Update pod labels if needed
kubectl label pods <pod-name> -n <namespace> key=value

# Or update service selector to match pod labels
kubectl patch svc <service-name> -n <namespace> -p '{"spec":{"selector":{"app":"myapp"}}}'
```

---

**Issue 4: DNS Resolution Failing**

Debugging:
```bash
# Test DNS from a pod
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
nslookup kubernetes.default
nslookup google.com

# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl get pods -n kube-system -l k8s-app=coredns

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=coredns

# Check pod's DNS config
kubectl exec <pod-name> -n <namespace> -- cat /etc/resolv.conf
```

Fixes:
```bash
# Restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# Check CoreDNS ConfigMap
kubectl get cm -n kube-system coredns
kubectl describe cm coredns -n kube-system

# Verify cluster DNS is accessible
kubectl get svc -n kube-system kube-dns
kubectl get svc -n kube-system coredns

# Set dnsPolicy in pod spec if DNS is working but pod can't resolve
dnsPolicy: ClusterFirst  # default
dnsPolicy: ClusterFirstWithHostNet  # if using host network
```

---

**Comprehensive Debugging Workflow:**

```bash
# 1. Get overall cluster status
kubectl get nodes
kubectl get pods --all-namespaces
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# 2. Check cluster components
kubectl get componentstatuses
kubectl get pods -n kube-system

# 3. For each failing pod:
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --all-containers=true

# 4. For each unhealthy node:
kubectl describe node <node-name>
ssh <node-name>
journalctl -u kubelet
journalctl -u docker  # or containerd

# 5. Verify core services
kubectl get svc -n kube-system
kubectl logs -n kube-system ds/kube-proxy
```

**Key Concept:** Multi-issue debugging requires systematic investigation:
1. **Cluster overview** — nodes, pods, events
2. **Component health** — kubelet, kube-proxy, DNS
3. **Pod-specific issues** — logs, describe, resource needs
4. **Node health** — disk, memory, kubelet status
5. **Network connectivity** — DNS, services, endpoints

Always check recent events first, then drill down into problematic resources.

</details>

---

