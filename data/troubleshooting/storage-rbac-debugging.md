# 📌 Storage & Access Control Troubleshooting

> **CKA Exam Domain:** Troubleshooting  
> **Topic:** Storage Issues & RBAC/Authorization Problems  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Debug PVC Binding Failures
> ⏱️ **Recommended Time: 5 minutes**

A PersistentVolumeClaim is in `Pending` state. How do you investigate why it's not binding to a PersistentVolume?

<details>
<summary>✅ Answer</summary>

```bash
# Check PVC status
kubectl get pvc -n <namespace>
kubectl get pvc <pvc-name> -n <namespace> -o wide

# Get detailed status
kubectl describe pvc <pvc-name> -n <namespace>
# Look for Events section which shows binding errors

# Check PV availability
kubectl get pv
kubectl describe pv <pv-name>

# Verify labels and selectors
kubectl get pvc <pvc-name> -n <namespace> -o yaml | grep -A5 selector

# Check PV access modes
kubectl get pv -o wide
# Ensure access mode matches PVC request

# Check storage provisioner status
kubectl get storageclass
kubectl describe storageclass <storage-class>

# View provisioner logs if using dynamic provisioning
kubectl logs -n <provisioner-namespace> <provisioner-pod>
```

**Common Issues:**
- **No matching PV** — No PV exists or access mode doesn't match
- **Wrong storage class** — PVC requests SC that doesn't exist
- **Provisioner failed** — Dynamic provisioning error
- **Access mode mismatch** — PVC needs RWX, only RWO PV available

**Key Concept:** PVC binding depends on access mode, storage class, and available capacity. Check events with `kubectl describe pvc` for specific failures.

</details>

---

### Question 2 — Diagnose Pod RBAC Permission Denial
> ⏱️ **Recommended Time: 5 minutes**

A pod receives "forbidden" errors when accessing the API server. How do you verify RBAC permissions?

<details>
<summary>✅ Answer</summary>

```bash
# 1. Identify service account
kubectl get pod <pod-name> -n <namespace> -o yaml | grep serviceAccountName

# 2. Get service account details
kubectl describe sa <sa-name> -n <namespace>

# 3. Check role bindings
kubectl get rolebindings -n <namespace> -o wide
kubectl get clusterrolebindings -o wide | grep <sa-name>

# 4. View role permissions
kubectl describe role <role-name> -n <namespace>
kubectl describe clusterrole <cluster-role-name>

# 5. Check what permissions service account has
kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<sa-name>

# 6. Test specific permission
kubectl auth can-i get pods --as=system:serviceaccount:<namespace>:<sa-name> -n <namespace>
kubectl auth can-i create deployments --as=system:serviceaccount:<namespace>:<sa-name> -n <namespace>

# 7. Check pod logs for exact error
kubectl logs <pod-name> -n <namespace>
# Look for "forbidden" or "permission denied"

# 8. Get service account token
kubectl get secret -n <namespace> $(kubectl get secret -n <namespace> | grep <sa-name> | awk '{print $1}')
```

**Common Issues:**
- **No role binding** — SA exists but has no permissions
- **Wrong namespace** — ClusterRoleBinding exists but in wrong namespace
- **Role too restrictive** — Role lacks required verbs/resources
- **Wrong service account** — Pod using different SA than expected

**Key Concept:** Use `kubectl auth can-i` to test permissions. Service account needs role/rolebinding to access API resources.

</details>

---

### Question 3 — Check StorageClass Provisioner Status
> ⏱️ **Recommended Time: 5 minutes**

Dynamic volume provisioning isn't working. Verify the provisioner is running and responding.

<details>
<summary>✅ Answer</summary>

```bash
# List available storage classes
kubectl get storageclass

# Check provisioner for each SC
kubectl get storageclass -o wide
kubectl describe storageclass <sc-name>

# Find provisioner pod
kubectl get pods --all-namespaces | grep <provisioner-name>

# Check provisioner status
kubectl describe pod -n <provisioner-namespace> <provisioner-pod>
kubectl logs -n <provisioner-namespace> <provisioner-pod> | tail -50

# Verify provisioner rbac
kubectl get clusterrolebinding | grep <provisioner>
kubectl auth can-i create persistentvolumes --as=system:serviceaccount:<namespace>:<sa-name>

# Check PVC events for provisioning errors
kubectl describe pvc <pvc-name> -n <namespace>

# Test provisioning manually
# Create test PVC
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
spec:
  storageClassName: <sc-name>
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
EOF

# Watch for PV creation
kubectl get pvc test-pvc -w
kubectl get pv
```

**Key Concept:** Provisioner pod must be running and have permissions to create PersistentVolumes. Check pod status and logs for errors.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Resolve Volume Mount Failures
> ⏱️ **Recommended Time: 10 minutes**

Pod is in `Pending` or `ContainerCreating` state due to volume mount failures. Diagnose and fix.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check pod status
kubectl describe pod <pod-name> -n <namespace>
# Look for "waiting for volume" or "mount failed" in events

# 2. Check if PVs exist and are bound
kubectl get pv
kubectl get pvc -n <namespace>

# 3. Check volume mount path in pod
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A10 volumes

# 4. SSH to node and check mounts
ssh <worker-node>
mount | grep kubernetes
mount | grep pvc

# 5. Check volume plugin status
ls -la /var/lib/kubelet/pods/

# 6. Check kubelet logs
journalctl -u kubelet -n 200 | grep -i "volume\|mount"

# 7. For NFS volumes, verify nfs connectivity
mount -t nfs <nfs-server>:<path> /mnt/test
# If works, unmount
umount /mnt/test

# 8. For cloud volumes, verify cloud provider
# For AWS EBS:
aws ec2 describe-volumes

# 9. Check volume plugin permissions
ls -la /var/lib/kubelet/plugins/

# 10. Force remount by restarting kubelet
systemctl restart kubelet

# 11. Monitor pod starting
kubectl describe pod <pod-name> -n <namespace> -w
```

**Common Issues:**
- **PVC not bound** — PVC stuck in pending
- **NFS unreachable** — Network or firewall issue
- **Cloud volume unavailable** — Detached or deleted in cloud provider
- **Duplicate mount** — Volume already mounted on another node
- **Permission denied** — Volume path not accessible by container user

**Fixes:**
```bash
# For NFS issues
# Verify NFS server connectivity
showmount -e <nfs-server>

# For EBS volume stuck
aws ec2 detach-volume --volume-id vol-xxx
aws ec2 attach-volume --volume-id vol-xxx --instance-id i-xxx --device /dev/sdf

# For permission issues
kubectl get pod <pod> -o yaml | grep fsUser
# Adjust runAsUser in pod spec if needed
```

**Key Concept:** Volume mount failures usually stem from PVC not bound, remote storage unreachable, or permissions. Check mountability of remote storage first.

</details>

---

### Question 5 — Debug Pod Webhook Denial Errors
> ⏱️ **Recommended Time: 10 minutes**

Pods are failing to create with webhook validation/mutation errors. Troubleshoot admission controllers.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check which admission webhooks are registered
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations

# 2. Get webhook details
kubectl describe validatingwebhookconfigurations <webhook-name>
kubectl describe mutatingwebhookconfigurations <webhook-name>

# 3. Check webhook backend status
# Find the service and pod
kubectl get svc --all-namespaces | grep webhook
kubectl get pods --all-namespaces | grep webhook

# 4. Check webhook pod logs
kubectl logs -n <namespace> <webhook-pod> | tail -100

# 5. Try creating pod with admission review
# Add labels to bypass certain webhooks if needed
kubectl get pod <failing-pod> -o yaml | \
  kubectl apply -f -  # This will show webhook error

# 6. Temporarily disable webhook for testing
kubectl delete validatingwebhookconfigurations <webhook-name>
# Try pod again
kubectl apply -f pod.yaml
# If pod creates successfully, webhook is the issue

# 7. Check webhook certificate
kubectl get secret -n <webhook-namespace> <webhook-crt> -o yaml | \
  grep tls.crt | awk '{print $2}' | base64 -d | \
  openssl x509 -text -noout | grep -A2 validity

# 8. Check webhook configuration rules
kubectl get validatingwebhookconfigurations -o yaml | \
  grep -A20 "rules:*"

# 9. Check webhook failure policy
kubectl get validatingwebhookconfigurations -o yaml | grep failurePolicy
# If Fail, webhook blocks pod creation on error
# If Ignore, webhook errors are ignored
```

**Common Issues:**
- **Webhook timeout** — Webhook service not responding
- **Certificate expired** — Webhook cert validation fails
- **Network issue** — Can't reach webhook endpoint
- **Policy too strict** — Valid pods are rejected
- **Webhook pod crashed** — Service unavailable

**Fixes:**
```bash
# Restart webhook deployment
kubectl rollout restart deployment/<webhook-deployed> -n <namespace>

# Renew webhook certificate
kubectl delete secret -n <namespace> <webhook-crt-secret>
# Certificate will be auto-renewed

# Temporarily disable failing webhook
kubectl patch validatingwebhookconfigurations <webhook-name> \
  --type='json' -p='[{"op": "replace", "path": "/webhooks/0/failurePolicy", "value":"Ignore"}]'

# Delete and redeploy webhook
kubectl delete validatingwebhookconfigurations <webhook-name>
kubectl apply -f webhook-config.yaml
```

**Key Concept:** Webhooks intercept pod creation for validation/mutation. If webhook is down or misconfigured, pod creation fails. Check webhook pod status and certificates.

</details>

---

### Question 6 — Resolve Authorization Policy Conflicts
> ⏱️ **Recommended Time: 10 minutes**

A user has contradictory role bindings. Their permissions seem incorrect. Debug authorization.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Get user information from certificate
# Extract from kubeconfig or API certificate
cat ~/.kube/config | grep client-certificate-data | \
  awk '{print $2}' | base64 -d | \
  openssl x509 -text -noout | grep -A5 "Subject:"

# 2. Check all role bindings for this user
kubectl get rolebindings --all-namespaces -o wide | grep <username>
kubectl get clusterrolebindings -o wide | grep <username>

# 3. View roles and their permissions
kubectl describe role <role-name> -n <namespace>
kubectl describe clusterrole <clusterrole-name>

# 4. Test specific permissions
kubectl auth can-i get pods --as=<user> -n <namespace>
kubectl auth can-i get pods --as=<user> --as-group=<group>

# 5. Check resource access in RBAC
kubectl get roles -n <namespace> -o yaml | \
  grep -A10 "verbs:\|resources:"

# 6. Look for conflicting bindings
# User might be in multiple groups with different perms
kubectl get rolebindings -n <namespace> -o yaml | grep -A5 subjects

# 7. Check RBAC audit logs if available
# Enable RBAC audit at API server level
journalctl -u kube-apiserver | grep "authorization.*denied"

# 8. Test role escalation attempts
kubectl auth can-i create clusterrolebindings --as=<user>
# Should be denied unless explicitly allowed
```

**RBAC Debugging Workflow:**

```bash
# 1. Identify the user
# From certificate or kubeconfig

# 2. Get all bindings affecting user
kubectl get rolebindings,clusterrolebindings --all-namespaces | \
  grep -E "<user>|<group>"

# 3. For each binding, check the role
kubectl get role/<role> -o yaml
kubectl get clusterrole/<role> -o yaml

# 4. Consolidate permissions (Role + ClusterRole)
# User gets union of all permissions from all bindings

# 5. Test with kubectl auth can-i
kubectl auth can-i <verb> <resource> --as=<user> -n <namespace>
```

**Common Issues:**
- **Multiple conflicting bindings** — User in groups with overlapping perms
- **Typo in binding** — User name has typo, binding doesn't apply
- **Namespace confusion** — Role in wrong namespace
- **Group membership missing** — User not in expected group
- **Admin permissions revoked** — Cluster admin removal takes effect

**Fixes:**
```bash
# Add missing role binding
kubectl create rolebinding <binding> \
  --clusterrole=<role> \
  --user=<user> \
  -n <namespace>

# Remove conflicting binding
kubectl delete rolebinding <binding> -n <namespace>

# Check actual permissions
kubectl auth reconcile -f rbac-config.yaml
```

**Key Concept:** RBAC is additive — user gets union of all permissions. Debug by checking all bindings, consolidating roles, and testing with `kubectl auth can-i`.

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Multi-Tier Storage Troubleshooting
> ⏱️ **Recommended Time: 15 minutes**

Complex storage issue: StatefulSet can't mount volumes, some replicas have stale mounts, and provisioner is slowly creating volumes. Diagnose all layers.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check StatefulSet status
kubectl describe statefulset <sts-name> -n <namespace>

# 2. Check individual pod status
kubectl get pods -n <namespace> -o wide -l app=<sts-name>

# 3. Check volume status
kubectl get pvc -n <namespace> | grep <sts-name>
kubectl get pv | grep <namespace>

# 4. Identify stale mounts
# SSH to nodes and check mount points
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | grep -v master); do
  echo "=== $node ==="
  ssh $node "mount | grep kubernetes"
done

# 5. Check provisioner throughput
kubectl logs -n <provisioner-namespace> <provisioner-pod> | \
  grep -i "created\|created volume" | tail -20

# 6. Check volume mount times
kubectl get pvc -n <namespace> -o yaml | grep creationTimestamp

# 7. Identify slow provisioning
# Check if provisioning is throttled
kubectl top pod -n <provisioner-namespace>

# 8. Check for storage backend issues
# For cloud storage:
aws ec2 describe-volumes | grep -i "state\|io"

# For NFS:
ssh <nfs-server> "df -h"
ssh <nfs-server> "iotop -b -o -n 1"

# 9. Check for duplicate mount attempts
journalctl -u kubelet | grep -i "already mounted"

# 10. Examine attachment limits
# For cloud providers, check if attachment limit reached
aws ec2 describe-instances | grep "BlockDeviceMapping" | wc -l

# 11. Force cleanup of stale mounts
ssh <worker-node>
umount /var/lib/kubelet/pods/*/volume-mounts/*

# 12. Restart provisioner to clear queue
kubectl delete pod -n <provisioner-namespace> <provisioner-pod>

# 13. Monitor recovery
watch kubectl get pvc -n <namespace>
watch kubectl get pods -n <namespace>
```

**Systematic Diagnosis:**

```bash
# Layer 1: API Level
- [ ] PVC/PV status (kubectl get/describe)
- [ ] Events (kubectl describe pvc/pod)

# Layer 2: Provisioner Level
- [ ] Provisioner pod running
- [ ] Provisioner logs
- [ ] Provisioner throughput (top, iostat)

# Layer 3: Storage Backend
- [ ] Backend capacity
- [ ] Backend performance
- [ ] Connection issues

# Layer 4: Mount Level
- [ ] Stale mounts (mount output)
- [ ] Mount errors (kubelet logs)
- [ ] Attachment limits
```

**Common Multi-Tier Issues:**
- **Provisioner overloaded** — Processes volumes slowly while others are pending
- **Backend capacity exhausted** — Can't create new volumes
- **Stale mounts blocking new mounts** — Old mount points prevent reuse
- **Cloud attachment limit** — Can't attach more volumes to instance
- **Network congestion** — Slow I/O to storage backend

**Key Concept:** Storage problems often cross multiple layers. Check provisioner, backend, and node-level mounts together.

</details>

---

### Question 8 — RBAC & Network Policy Interaction Debugging
> ⏱️ **Recommended Time: 15 minutes**

A pod has RBAC permissions to access another service, but traffic is blocked. Both RBAC and NetworkPolicy might be involved. Debug the complete auth chain.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Verify RBAC permissions
SOURCE_SA=$(kubectl get pod <source-pod> -n <namespace> -o jsonpath='{.spec.serviceAccountName}')
SOURCE_NS=<namespace>

# 2. Test RBAC accessibility
kubectl auth can-i get services --as=system:serviceaccount:$SOURCE_NS:$SOURCE_SA -n <target-ns>

# 3. Check NetworkPolicy
kubectl get networkpolicies -A
kubectl describe networkpolicy <policy> -n <namespace>

# 4. Trace the policy rules
kubectl get networkpolicy -o yaml | grep -A20 "ingress:\|egress:"

# 5. Test pod-to-service connectivity
# From source pod:
kubectl exec <source-pod> -n <source-ns> -- sh
# Inside pod:
curl -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://<target-svc>.<target-ns>.svc.cluster.local:443/api/v1/namespaces

# 6. Check if traffic is allowed by NetworkPolicy
# Compare pod labels with policy selectors
SOURCE_LABELS=$(kubectl get pod <source-pod> -n <source-ns> --show-labels | tail -1)
echo "Source pod labels: $SOURCE_LABELS"

kubectl get networkpolicy -n <target-ns> -o yaml | \
  grep -B5 -A15 "podSelector:"

# 7. Check if inter-namespace traffic is allowed
# Look for namespaceSelector in NetworkPolicy
kubectl get networkpolicy -o yaml | grep -A5 "namespaceSelector"

# 8. Verify service selector matches target pods
kubectl get svc <service> -n <namespace> -o yaml | grep -A3 selector
kubectl get pods -n <namespace> --show-labels | grep <service-label>

# 9. Check kube-proxy/iptables rules
ssh <worker-node>
iptables -L -t filter | grep -i "<service-ip>\|<pod-ip>"

# 10. Debug complete flow
echo "1. Check RBAC"
kubectl auth can-i <verb> <resource> --as=<sa>

echo "2. Check NetworkPolicy"
kubectl get networkpolicies -n <target-ns> -o wide

echo "3. Test connectivity"
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service>

echo "4. Check service endpoints"
kubectl get endpoints <service> -n <namespace>

echo "5. Check pod labels"
kubectl get pods -n <namespace> --show-labels
```

**Authentication Chain Debugging:**

```bash
# Request Flow:
# 1. Pod makes request using service account token
# 2. API server (or endpoint) validates token → authentication
# 3. API server checks RBAC rules → authorization
# 4. Network policy (netd) checks pod labels → network access

# Debug each step:

# Step 1: Token validity
TOKEN=$(kubectl exec <pod> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token)
# Decode and verify it's for correct service account

# Step 2: RBAC authorization
kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa>

# Step 3: Network connectivity
kubectl exec <source-pod> -- curl https://<target-svc>:443

# Step 4: NetworkPolicy enforcement
kubectl describe networkpolicy <policy> -n <namespace>
```

**Common Multi-Layer Issues:**
- **RBAC allows but NetworkPolicy blocks** — Pod has permission but traffic denied
- **NetworkPolicy allows but RBAC blocks** — Traffic allowed but auth fails
- **Inter-namespace policy** — Missing namespaceSelector allows inter-namespace traffic
- **Default-deny policy** — Implicit deny of all unless explicitly allowed
- **Label mismatch** — Pod labels don't match policy selector

**Fixes:**
```bash
# Add RBAC permission if missing
kubectl create rolebinding <name> \
  --clusterrole=<role> \
  --serviceaccount=<ns>:<sa> \
  -n <target-ns>

# Adjust NetworkPolicy to allow traffic
kubectl patch networkpolicy <policy> -p \
  '{"spec":{"ingress":[{"from":[{"namespaceSelector":{"matchLabels":{"name":"<ns>"}}}]}]}' \
  -n <target-ns>

# Add labels to pods if needed
kubectl label pods <pod> <key>=<value> -n <namespace>
```

**Key Concept:** Pod communication requires BOTH RBAC (API access) AND NetworkPolicy (network access). Debug both independently, then verify together.

</details>

---

