# 📌 Certificate & TLS Troubleshooting

> **CKA Exam Domain:** Troubleshooting  
> **Topic:** Certificate & TLS Issues  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Check Certificate Expiration
> ⏱️ **Recommended Time: 5 minutes**

How do you check if Kubernetes certificates are expired or expiring soon?

<details>
<summary>✅ Answer</summary>

```bash
# Check certificate expiration using kubeadm
kubeadm certs check-expiration

# Check specific certificate files
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A2 validity

openssl x509 -in /etc/kubernetes/pki/ca.crt -text -noout | grep -A2 validity

# Check all certificates at once
find /etc/kubernetes/pki -name "*.crt" | while read cert; do
  echo "$cert:"; openssl x509 -in "$cert" -noout -dates
done

# Check kubelet client certificate
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -text -noout | grep -A2 validity

# Check certificate signing requests (CSR)
kubectl get csr
kubectl describe csr <csr-name>
```

**Key Concept:** Use `kubeadm certs check-expiration` to get a quick overview. For manual checks, use `openssl x509 -text -noout` to inspect certificate details.

</details>

---

### Question 2 — Identify Certificate-Related API Server Errors
> ⏱️ **Recommended Time: 5 minutes**

Kubectl returns certificate verification errors. How do you troubleshoot certificate issues in kubeconfig?

<details>
<summary>✅ Answer</summary>

```bash
# Check kubeconfig cert references
kubectl config view
cat ~/.kube/config

# Decode and verify certificates from kubeconfig
kubectl config view --raw | grep -i certificate

# Extract certificate from kubeconfig and verify
kubectl config view --raw | grep client-certificate-data | head -1 | \
  awk '{print $2}' | base64 -d | openssl x509 -text -noout

# Test certificate verification
curl --cacert /etc/kubernetes/pki/ca.crt \
  --cert /etc/kubernetes/pki/apiserver-kubelet-client.crt \
  --key /etc/kubernetes/pki/apiserver-kubelet-client.key \
  https://localhost:6443/api/v1

# Check if certificate matches key
openssl x509 -noout -modulus -in /etc/kubernetes/pki/apiserver.crt | openssl md5
openssl rsa -noout -modulus -in /etc/kubernetes/pki/apiserver.key | openssl md5
# Should match if cert and key are paired
```

**Common Errors:**
- `certificate not valid` — Cert not valid yet or expired
- `certificate verify failed` — CA certificate mismatch
- `unknown certificate` — Wrong certificate is being used

**Key Concept:** Use `openssl` to verify certificate validity, expiration, and that the cert/key pair match.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Renew Kubelet Client Certificate
> ⏱️ **Recommended Time: 5 minutes**

A kubelet certificate is expiring. How do you manually renew it?

<details>
<summary>✅ Answer</summary>

```bash
# Check kubelet certificate expiration
ssh <worker-node>
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -text -noout | grep -A2 validity

# Method 1: Let kubelet auto-renew (wait for expiration)
# Kubelet rotates certificates automatically before expiration

# Method 2: Force kubelet to rotate certificate
systemctl restart kubelet

# After restart, check new certificate
ls -la /var/lib/kubelet/pki/
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -text -noout | grep -A2 validity

# If rotation failed, manually approve CSR
kubectl get csr
kubectl certificate approve <csr-name>

# Restart kubelet again
systemctl restart kubelet
```

**Key Concept:** Kubelet automatically rotates certificates. If rotation fails, check pending CSRs and manually approve them with `kubectl certificate approve`.

</details>

---

### Question 4 — Debug Certificate Authority (CA) Issues
> ⏱️ **Recommended Time: 10 minutes**

Workers can't communicate with control plane due to "invalid certificate" errors. Troubleshoot CA certificate mismatches.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Verify CA certificates match across nodes
openssl x509 -in /etc/kubernetes/pki/ca.crt -text -noout | grep -i "Public-Key"

# On worker node, check CA is trusted
cat /var/lib/kubelet/kubeconfig | grep certificate-authority-data | \
  awk '{print $2}' | base64 -d | openssl x509 -text -noout

# 2. Compare CA certificates
# On control plane:
base64 -w0 /etc/kubernetes/pki/ca.crt

# On worker node search kubeconfig for certificate-authority-data and compare

# 3. Check if kubelet is using correct CA
ps aux | grep kubelet | grep ca-file

# 4. View kubelet config
cat /etc/kubernetes/kubelet.conf | grep certificate-authority-data | \
  awk '{print $2}' | base64 -d | openssl x509 -text -noout

# 5. Check logs
journalctl -u kubelet -n 50 | grep -i certificate

# 6. Verify API server certificate is signed by CA
openssl verify -CAfile /etc/kubernetes/pki/ca.crt /etc/kubernetes/pki/apiserver.crt
```

**Troubleshooting Steps:**
```bash
# If CA doesn't match, regenerate worker certificates
kubeadm token create --print-join-command
# Run this command on worker to rejoin cluster

# Or manually bootstrap worker with correct CA
scp /etc/kubernetes/pki/ca.crt <worker>:/etc/kubernetes/pki/ca.crt
systemctl restart kubelet
```

**Key Concept:** All components must use the same CA certificate. If workers can't reach control plane, verify the CA certificate is identical across all nodes.

</details>

---

### Question 5 — Fix Kubelet TLS Bootstrap Issues
> ⏱️ **Recommended Time: 10 minutes**

A new worker node fails to join the cluster with TLS bootstrap errors. Troubleshoot the bootstrap process.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check if bootstrap token exists
kubectl get nodes
kubectl get secrets -n kube-system | grep bootstrap

# 2. On worker node, check bootstrap kubeconfig
cat /etc/kubernetes/bootstrap-kubelet.conf
ls -la /var/lib/kubelet/pki/

# 3. Check kubelet service status
ssh <worker>
systemctl status kubelet
journalctl -u kubelet -n 100

# 4. Verify bootstrap token is valid
TOKEN=$(cat /etc/kubernetes/bootstrap-kubelet.conf | grep token | head -1 | awk '{print $2}')
echo $TOKEN

# 5. Check for pending CSRs
kubectl get csr

# 6. If CSRs are pending, approve them
kubectl certificate approve <csr-name>
kubectl certificate approve --all  # Approve all

# 7. Verify hostname/IP matches
# On worker:
hostname
hostname -I

# Verify in kubeconfig
cat /var/lib/kubelet/kubeconfig | grep server
```

**Common Issues:**
- **Invalid bootstrap token** — Token expired or incorrect
- **CSR not approved** — CSRs stuck in pending state
- **Hostname resolution fails** — Worker can't reach API server by name/IP
- **Clock skew** — Time differences between nodes

**Fixes:**
```bash
# Regenerate bootstrap token
kubeadm token create --print-join-command

# On worker, reset and rejoin
systemctl stop kubelet
rm -rf /var/lib/kubelet/pki/ /etc/kubernetes/

# Run join command from control plane
kubeadm join ... (from --print-join-command output)

# Verify worker joined
kubectl get nodes -o wide
```

**Key Concept:** TLS bootstrap requires valid tokens, approved CSRs, and valid DNS/IP resolution. Check each component in order.

</details>

---

### Question 6 — Recreate Cluster Certificates
> ⏱️ **Recommended Time: 15 minutes**

You need to regenerate all cluster certificates after security audit. Show how to safely recreate certificates without disrupting the cluster.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Backup current certificates
cp -r /etc/kubernetes/pki /etc/kubernetes/pki.backup

# 2. Backup etcd
ETCDCTL_API=3 etcdctl snapshot save /tmp/etcd-backup.db

# 3. Check certificate expiration before regenerating
kubeadm certs check-expiration

# 4. Regenerate all certificates
kubeadm certs renew all

# 5. Verify new certificates
kubeadm certs check-expiration

# 6. Update kubeconfig files
kubeadm kubeconfig user --org=system:masters --client-name=admin > /etc/kubernetes/admin.conf
kubeadm kubeconfig user --org=system:nodes --client-name=system:node:$(hostname) > /etc/kubernetes/kubelet.conf

# 7. Restart control plane pods (if using static pods)
systemctl restart kubelet

# Wait for API server to restart
sleep 30
kubectl get nodes

# 8. On worker nodes, restart kubelet
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' | grep -v master); do
  ssh $node "sudo systemctl restart kubelet"
done

# 9. Verify cluster is healthy
kubectl cluster-info
kubectl get nodes
kubectl get pods -A
```

**Safe Rollback Procedure:**
```bash
# If issues arise, restore from backup
cp -r /etc/kubernetes/pki.backup/* /etc/kubernetes/pki/
systemctl restart kubelet
sleep 30
```

**Verification Steps:**
```bash
# Check all nodes are ready
kubectl get nodes

# Check system pods are running
kubectl get pods -n kube-system

# Test API connectivity
curl -k https://localhost:6443 --cert /etc/kubernetes/pki/apiserver-kubelet-client.crt \
  --key /etc/kubernetes/pki/apiserver-kubelet-client.key \
  --cacert /etc/kubernetes/pki/ca.crt

# Verify certificate chain
openssl verify -CAfile /etc/kubernetes/pki/ca.crt /etc/kubernetes/pki/apiserver.crt
```

**Key Concept:** Certificate renewal requires restarting kubelet to pick up new certs. Always backup before regenerating, and verify cluster health after the process.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Front Proxy & Aggregation Layer Certificate Issues
> ⏱️ **Recommended Time: 10 minutes**

API aggregation is failing with "authentication handshake failed". Troubleshoot front-proxy and aggregation layer certificates.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check front-proxy certificates exist
ls -la /etc/kubernetes/pki/front-proxy-*

# 2. Verify front-proxy CA and client cert
openssl x509 -in /etc/kubernetes/pki/front-proxy-ca.crt -text -noout
openssl x509 -in /etc/kubernetes/pki/front-proxy-client.crt -text -noout

# 3. Check API server logs
kubectl logs -n kube-system -l component=kube-apiserver | grep -i "proxy\|aggregation"

# 4. Verify kube-controller-manager is running
kubectl get pods -n kube-system -l component=kube-controller-manager

# 5. Check aggregation layer configuration
kubectl get apiservices

# 6. Test if aggregation is working
kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1

# 7. Check for cert/key mismatch
# Verify matching modulus
openssl x509 -in /etc/kubernetes/pki/front-proxy-client.crt -noout -modulus | openssl md5
openssl rsa -in /etc/kubernetes/pki/front-proxy-client.key -noout -modulus | openssl md5
```

**Renewal:**
```bash
# Renew front-proxy certificates
kubeadm certs renew front-proxy-client

# Restart API server
systemctl restart kubelet

# Verify aggregation works
kubectl get apiservices
```

**Key Concept:** Front-proxy certificates are used for API aggregation. Verify they're valid and the cert/key pair matches.

</details>

---

### Question 8 — Service Account Token Issues
> ⏱️ **Recommended Time: 10 minutes**

Pods can't authenticate to the API server with service account tokens. Debug token validity and signing certificate issues.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Check service account exists
kubectl get serviceaccounts -A
kubectl describe sa <sa-name> -n <namespace>

# 2. View token in pod
kubectl exec <pod> -n <namespace> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token

# 3. Decode and verify token
TOKEN=$(kubectl exec <pod> -n <namespace> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token)
# Note: JWTs have 3 parts separated by dots
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .

# 4. Check service account signing key
ls -la /etc/kubernetes/pki/sa.*

# 5. Verify token signature
openssl x509 -in /etc/kubernetes/pki/sa.pub -text -noout

# 6. Check volume mount in pod
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A5 serviceAccountToken

# 7. Test API authentication with token
TOKEN=$(kubectl exec <pod> -n <namespace> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CA=$(kubectl exec <pod> -n <namespace> -- cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt)

curl --cacert <(echo "$CA") -H "Authorization: Bearer $TOKEN" \
  https://kubernetes.default.svc/api/v1/namespaces

# 8. Check RBAC permissions
kubectl describe rolebinding <binding> -n <namespace>
kubectl get clusterrolebinding -o wide | grep <sa-name>
```

**Troubleshooting:**
```bash
# If token won't mount, check sa secret
kubectl get secrets -n <namespace> | grep <sa-name>

# If secret missing, recreate it
kubectl delete secret <sa-token-secret> -n <namespace>
# Token will be auto-recreated

# Verify token in new secret
kubectl get secret <new-sa-token> -n <namespace> -o jsonpath='{.data.token}' | base64 -d | wc -c
```

**Key Concept:** Service account tokens are JWT signed by the SA signing key. Verify the signing certificates match, the token is valid, and RBAC permissions are correct.

</details>

---

