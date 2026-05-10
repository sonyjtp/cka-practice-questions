# 📌 Application & Network Troubleshooting

> **CKA Exam Domain:** Troubleshooting  
> **Topic:** Application Debugging & Networking Issues  
> **Total Questions:** 6

---

## 🟢 Easy Questions

---

### Question 1 — Diagnose OOMKilled Container
> ⏱️ **Recommended Time: 5 minutes**

A container is repeatedly restarting with status `OOMKilled`. How do you investigate memory issues and fix them?

<details>
<summary>✅ Answer</summary>

```bash
# Check pod status and exit codes
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>

# Look for "OOMKilled" in the status or events section
# Exit code 137 (-9) indicates OOM kill

# Check current memory usage
kubectl top pod <pod-name> -n <namespace>
kubectl top nodes

# View resource requests/limits
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A5 resources

# Check kubelet logs for OOM events
ssh <node-name>
journalctl -u kubelet | grep -i oom
```

**Fixes:**
```yaml
# Increase memory limit in pod spec
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"  # Increase this

# Or optimize application to use less memory
# Check application logs for memory leaks
```

**Key Concept:** `OOMKilled` means the container exceeded its memory limit. Use `kubectl top` to check current usage and increase the memory limit in the pod spec.

</details>

---

### Question 2 — Troubleshoot Init Container Failures
> ⏱️ **Recommended Time: 5 minutes**

A pod with init containers is stuck in `Init:0/1` state. How do you debug init container issues?

<details>
<summary>✅ Answer</summary>

```bash
# Check overall pod status
kubectl describe pod <pod-name> -n <namespace>

# View init container logs
kubectl logs <pod-name> -n <namespace> -c <init-container-name>

# View logs from previous runs (if init container crashed)
kubectl logs <pod-name> -n <namespace> -c <init-container-name> --previous

# Check if init container is still running
kubectl get pod <pod-name> -n <namespace> -o yaml

# Debug init container interactively
kubectl debug pod <pod-name> -n <namespace> -it --image=busybox
```

**Common Issues:**
- Init container command/script fails
- Init container hangs waiting for external resource
- Init container exits with non-zero status

**Key Concept:** Init containers must complete successfully before the main pod starts. Check their logs with `kubectl logs -c <init-container-name>` to see errors.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Check Deployment Rollout Status
> ⏱️ **Recommended Time: 5 minutes**

A Deployment isn't ready and pods are not starting. How do you check the rollout status and diagnose the issue?

<details>
<summary>✅ Answer</summary>

```bash
# Check deployment rollout status
kubectl rollout status deployment/<deployment-name> -n <namespace>

# Get deployment details
kubectl get deployment -n <namespace>
kubectl describe deployment <deployment-name> -n <namespace>

# Check replica status
kubectl get replicasets -n <namespace>
kubectl describe replicaset <replicaset-name> -n <namespace>

# View pods created by deployment
kubectl get pods -n <namespace> -l app=<label>

# Check pod events and logs
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>

# View deployment history
kubectl rollout history deployment/<deployment-name> -n <namespace>
```

**Debugging Workflow:**
```bash
# 1. Check current desired vs ready replicas
kubectl get deployment <deployment-name> -n <namespace>

# 2. Check ReplicaSet status
kubectl get rs -n <namespace> -o wide

# 3. Check individual pod status
kubectl get pods -n <namespace> -o wide

# 4. If pods aren't starting, check events
kubectl describe pod <pod-name> -n <namespace>
```

**Key Concept:** A Deployment's status depends on its ReplicaSets and Pods. Use `kubectl get rs` to see replication status and `kubectl describe pod` to debug individual pod failures.

</details>

---

### Question 4 — Debug Ingress Communication
> ⏱️ **Recommended Time: 10 minutes**

An Ingress resource is configured, but external traffic can't reach the backend service. Troubleshoot the connectivity chain.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Verify Ingress exists and has rules
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>

# 2. Check if Ingress controller is running
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx <ingress-controller-pod>

# 3. Verify Ingress has an IP/hostname
kubectl get ingress -n <namespace> -o wide

# 4. Check backend service and its endpoints
kubectl get svc <backend-service> -n <namespace>
kubectl describe svc <backend-service> -n <namespace>
kubectl get endpoints <backend-service> -n <namespace>

# 5. Test connectivity to the service directly
kubectl run -it --rm debug --image=busybox --restart=Never -- sh
wget -O- http://<service-name>.<namespace>.svc.cluster.local:<port>

# 6. Check Ingress backend configuration
kubectl get ingress <ingress-name> -n <namespace> -o yaml

# 7. Verify firewall and network policies
kubectl get networkpolicies -n <namespace>

# 8. Test from outside cluster
curl -H "Host: <hostname>" http://<ingress-ip>
```

**Common Issues:**
- **No Ingress controller** — No ingress-nginx or similar controller running
- **Service not in endpoints** — Pod selector doesn't match or pods aren't ready
- **Ingress rules incorrect** — Wrong service name or port in backend config
- **DNS not resolving** — External hostname not pointing to ingress IP
- **NetworkPolicy blocking** — Policy denies traffic to service

**Key Concept:** Ingress → Service → Endpoints → Pods. Verify each layer by checking Ingress rules, service endpoints, and pod readiness.

</details>

---

### Question 5 — Troubleshoot APIServer Connectivity
> ⏱️ **Recommended Time: 10 minutes**

Kubectl commands are failing with "unable to connect to the server". Diagnose and fix API server access issues.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check current kubeconfig
kubectl config view
kubectl cluster-info

# 2. Verify server certificate
kubectl cluster-info dump | grep -i error

# 3. Test API server connectivity
curl -k https://<api-server-ip>:6443

# 4. Check if API server pod is running
kubectl get pods -n kube-system -l component=kube-apiserver
kubectl logs -n kube-system -l component=kube-apiserver | head -50

# 5. SSH to control plane and check service
ssh <control-plane-node>
systemctl status kube-apiserver
journalctl -u kube-apiserver -n 50

# 6. Check API server port
netstat -tlnp | grep 6443
ss -tlnp | grep 6443

# 7. Verify certificates aren't expired
kubectl get csr
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A2 validity

# 8. Restart API server if needed
systemctl restart kube-apiserver
```

**Common Issues:**
- **API server pod crashed** — Check logs for errors
- **Certificate expired** — Renew certificates with kubeadm
- **Port not listening** — API server not binding to 6443
- **Wrong kubeconfig** — KUBECONFIG pointing to wrong cluster
- **Network issue** — Firewall blocking port 6443

**Fixes:**
```bash
# Update kubeconfig if pointing to wrong server
kubectl config set-cluster <cluster-name> --server=https://<correct-ip>:6443

# Generate new certificates (kubeadm)
kubeadm certs renew all

# Restart all control plane components
systemctl restart kube-apiserver kube-controller-manager kube-scheduler
```

**Key Concept:** "Unable to connect" means kubeconfig is misconfigured or API server is down. Verify kubeconfig and API server status first.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Etcd Backup & Recovery Troubleshooting
> ⏱️ **Recommended Time: 15 minutes**

The etcd database may be corrupted or lost. Demonstrate how to:
1. Verify etcd health
2. Backup etcd
3. Restore from backup

Include troubleshooting steps if restore fails.

<details>
<summary>✅ Answer</summary>

**Step 1: Check etcd Health**

```bash
# Get etcd pod
kubectl get pods -n kube-system -l component=etcd

# SSH to control plane
ssh <control-plane-node>

# Check etcd service
systemctl status etcd
# or if etcd runs as a pod:
docker logs <etcd-container-id>

# Check etcd with etcdctl
export ETCDCTL_API=3
etcdctl --endpoints=127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  member list

etcdctl --endpoints=127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  endpoint health
```

**Step 2: Backup etcd**

```bash
# Take a snapshot
ETCDCTL_API=3 etcdctl --endpoints=127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /backup/etcd-snapshot.db

# Verify snapshot
ETCDCTL_API=3 etcdctl --endpoints=127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot status /backup/etcd-snapshot.db
```

**Step 3: Restore from Backup**

```bash
# Stop etcd and API server
systemctl stop etcd kube-apiserver

# (Or if etcd is a pod, delete it)
kubectl delete pod -n kube-system etcd-<node>

# Restore snapshot
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd-backup

# Replace data directory (backup current first)
mv /var/lib/etcd /var/lib/etcd.backup
mv /var/lib/etcd-backup /var/lib/etcd

# Fix permissions
chown -R etcd:etcd /var/lib/etcd

# Start etcd and verify
systemctl start etcd
systemctl start kube-apiserver

# Verify cluster
kubectl get nodes
```

**Troubleshooting Failed Restore:**

```bash
# 1. Check etcd logs for errors
journalctl -u etcd -n 100

# 2. Verify snapshot wasn't corrupted
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-snapshot.db

# 3. Check data directory permissions
ls -la /var/lib/etcd/

# 4. Verify certificates are correct
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -text -noout

# 5. Check if etcd process can start
/usr/local/bin/etcd --data-dir=/var/lib/etcd

# 6. Review etcd configuration
cat /etc/kubernetes/manifests/etcd.yaml  # if static pod
systemctl cat etcd  # if systemd service
```

**If etcd Won't Start:**

```bash
# Option 1: Use disaster recovery mode
ETCDCTL_API=3 etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd \
  --skip-hash-check  # Only if absolutely necessary

# Option 2: Force new cluster
# Edit /etc/kubernetes/manifests/etcd.yaml or etcd service config
# Add flag: --force-new-cluster
# Start etcd, then remove the flag

# Option 3: Restore to different node
# Copy snapshot, restore on backup node, update kubeconfig
```

**Prevention & Best Practices:**

```bash
# Automated backups (cron job)
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ETCDCTL_API=3 etcdctl snapshot save /backups/etcd-$TIMESTAMP.db

# Verify weekly backups
find /backups -name "etcd-*.db" -mtime +7 -delete

# Test restore procedures regularly
```

**Key Concept:** etcd is the cluster's state store. Regular snapshots are critical. Always verify health before backing up, and test restore procedures in a safe environment before disaster strikes.

</details>

---

