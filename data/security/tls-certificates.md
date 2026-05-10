# 🔒 TLS Certificates & Certificates API

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** TLS Certificates, Server/Client Certs, Certificates API (CSR workflow)  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** Kubernetes uses TLS everywhere — between components, and for user/client authentication. The CA (Certificate Authority) lives at `/etc/kubernetes/pki/ca.crt` and `/etc/kubernetes/pki/ca.key`. The Certificates API allows you to request and approve certificates using Kubernetes itself.

---

## 🟢 Easy Questions

---

### Question 1 — Identify Cluster Certificates
> ⏱️ **Recommended Time: 5 minutes**

List and identify the key TLS certificates used by the Kubernetes control plane components.

<details>
<summary>✅ Answer</summary>

```bash
# List all certificates in the PKI directory
ls /etc/kubernetes/pki/

# Key certificates:
# ca.crt / ca.key                        → Cluster CA (signs all other certs)
# apiserver.crt / apiserver.key          → API server TLS cert (server cert)
# apiserver-kubelet-client.crt/.key      → API server → kubelet (client cert)
# apiserver-etcd-client.crt/.key         → API server → etcd (client cert)
# front-proxy-ca.crt / front-proxy-ca.key
# front-proxy-client.crt/.key            → aggregation layer

ls /etc/kubernetes/pki/etcd/
# ca.crt / ca.key        → etcd CA
# server.crt / server.key
# peer.crt / peer.key
# healthcheck-client.crt/.key

# Inspect a certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -E "Subject:|DNS:|IP:|Issuer:|Not After"
```

Certificate roles:

| Certificate                    | Type   | Used By                          |
|--------------------------------|--------|----------------------------------|
| `apiserver.crt`                | Server | Clients connecting to API server |
| `apiserver-kubelet-client.crt` | Client | API server → kubelet             |
| `apiserver-etcd-client.crt`    | Client | API server → etcd                |
| `etcd/server.crt`              | Server | etcd clients                     |
| `etcd/peer.crt`                | Both   | etcd peer-to-peer                |
| `front-proxy-client.crt`       | Client | Aggregated API servers           |

> **Key Concept:** Kubernetes uses **mutual TLS (mTLS)** — both sides present certificates. Server certs prove identity to clients; client certs prove identity to servers. All certs are signed by the cluster CA (`ca.crt`). The CA cert is the root of trust distributed to all components.

</details>

---

### Question 2 — Inspect a Certificate
> ⏱️ **Recommended Time: 5 minutes**

Inspect the API server certificate. Find its expiry date, Subject, and SANs (Subject Alternative Names).

<details>
<summary>✅ Answer</summary>

```bash
# Inspect the API server certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout

# Key fields to look for:

# Issuer (who signed it)
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -issuer
# issuer=CN=kubernetes

# Subject (who it belongs to)
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -subject
# subject=CN=kube-apiserver

# Expiry date
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -enddate
# notAfter=May  8 00:00:00 2026 GMT

# SANs — DNS names and IPs this cert is valid for
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A 5 "Subject Alternative"
# DNS:controlplane, DNS:kubernetes, DNS:kubernetes.default,
# DNS:kubernetes.default.svc, DNS:kubernetes.default.svc.cluster.local,
# IP Address:10.96.0.1, IP Address:192.168.1.10

# Check all certs and their expiry at once (kubeadm)
kubeadm certs check-expiration
```

> **Key Concept:** The API server certificate must include SANs for every name/IP clients use to reach it — including the service IP (`10.96.0.1`), the node IP, `kubernetes`, `kubernetes.default`, `kubernetes.default.svc`, and `kubernetes.default.svc.cluster.local`. A missing SAN causes TLS verification failures. Use `kubeadm certs check-expiration` to see all cert expiry dates at a glance.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Create a Certificate Signing Request (CSR) for a New User
> ⏱️ **Recommended Time: 7 minutes**

Generate a private key and CSR for a new user `alice` who should have access to the cluster.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Generate a private key for alice
openssl genrsa -out alice.key 2048

# Step 2 — Create a CSR (Certificate Signing Request)
openssl req -new \
  -key alice.key \
  -subj "/CN=alice/O=dev-team" \
  -out alice.csr

# CN (Common Name) = username in Kubernetes
# O (Organization) = group membership in Kubernetes

# Step 3 — View the CSR
openssl req -in alice.csr -text -noout | grep Subject
```

> **Key Concept:** In Kubernetes, the TLS certificate's `CN` (Common Name) field becomes the **username**, and the `O` (Organization) field becomes the **group**. This is how user identity is established — Kubernetes has no internal user database; users are identified purely by their certificate's CN. RBAC then grants permissions to that username/group.

</details>

---

### Question 4 — Submit a CSR Using the Kubernetes Certificates API
> ⏱️ **Recommended Time: 8 minutes**

Submit alice's CSR to the Kubernetes Certificates API and approve it.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Base64-encode the CSR (single line, no newlines)
cat alice.csr | base64 | tr -d '\n'
# Copy the output
```

```yaml
# Step 2 — Create a CertificateSigningRequest object
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: alice-csr
spec:
  request: <base64-encoded-csr-here>
  signerName: kubernetes.io/kube-apiserver-client   # for client auth
  expirationSeconds: 86400                           # 1 day (optional)
  usages:
  - client auth
```

```bash
kubectl apply -f alice-csr.yaml

# Step 3 — View pending CSRs
kubectl get csr
# NAME        AGE   SIGNERNAME                            REQUESTOR   CONDITION
# alice-csr   10s   kubernetes.io/kube-apiserver-client   admin       Pending

# Step 4 — Approve the CSR
kubectl certificate approve alice-csr

# Step 5 — Retrieve the signed certificate
kubectl get csr alice-csr -o jsonpath='{.status.certificate}' | base64 -d > alice.crt

# Step 6 — Verify the certificate
openssl x509 -in alice.crt -text -noout | grep -E "Subject:|Issuer:|Not After"
```

To **deny** a CSR instead:

```bash
kubectl certificate deny alice-csr
```

> **Key Concept:** The Certificates API (`certificates.k8s.io/v1`) lets admins issue certificates using Kubernetes itself — no direct access to the CA key needed. The `signerName: kubernetes.io/kube-apiserver-client` is used for user client certs. Once approved, the signed cert is available in `.status.certificate` (base64-encoded). The **kube-controller-manager** performs the actual signing using the cluster CA.

</details>

---

### Question 5 — Renew Cluster Certificates with kubeadm
> ⏱️ **Recommended Time: 7 minutes**

Check certificate expiry and renew all control plane certificates using kubeadm.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Check all certificate expiry dates
kubeadm certs check-expiration

# Output example:
# CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY
# admin.conf                 May 08, 2026 00:00 UTC   364d            ca
# apiserver                  May 08, 2026 00:00 UTC   364d            ca
# apiserver-etcd-client      May 08, 2026 00:00 UTC   364d            etcd-ca
# apiserver-kubelet-client   May 08, 2026 00:00 UTC   364d            ca
# ...

# Step 2 — Renew all certificates at once
kubeadm certs renew all

# OR renew a specific certificate
kubeadm certs renew apiserver
kubeadm certs renew apiserver-kubelet-client

# Step 3 — Restart control plane static pods to pick up new certs
# Move manifests out and back in to force kubelet to restart them
cd /etc/kubernetes/manifests
mv kube-apiserver.yaml /tmp/
mv kube-controller-manager.yaml /tmp/
mv kube-scheduler.yaml /tmp/
# Wait for pods to stop
sleep 10
mv /tmp/kube-apiserver.yaml .
mv /tmp/kube-controller-manager.yaml .
mv /tmp/kube-scheduler.yaml .

# Step 4 — Update kubeconfig (admin.conf is also renewed)
cp /etc/kubernetes/admin.conf ~/.kube/config

# Verify
kubeadm certs check-expiration
kubectl get nodes
```

> **Key Concept:** kubeadm-provisioned certificates expire after **1 year** by default. `kubeadm certs renew all` renews all certificates but the running static pods still use the old certs in memory — a restart is required. After renewal, always copy the new `admin.conf` to `~/.kube/config`. In production, set up automated renewal before expiry to avoid cluster lockout.

</details>

---

### Question 6 — Manually Sign a Certificate Using the Cluster CA
> ⏱️ **Recommended Time: 9 minutes**

Manually sign alice's CSR using the cluster CA key (bypassing the Certificates API). This simulates what the controller-manager does internally.

<details>
<summary>✅ Answer</summary>

```bash
# Prerequisites: alice.key and alice.csr already created (see Q3)

# Step 1 — Sign the CSR using the cluster CA
openssl x509 -req \
  -in alice.csr \
  -CA /etc/kubernetes/pki/ca.crt \
  -CAkey /etc/kubernetes/pki/ca.key \
  -CAcreateserial \
  -out alice.crt \
  -days 365

# Step 2 — Verify the signed certificate
openssl x509 -in alice.crt -text -noout | grep -E "Issuer:|Subject:|Not After"
# Issuer: CN=kubernetes         ← signed by cluster CA
# Subject: CN=alice, O=dev-team ← alice's identity

# Step 3 — Verify the cert is trusted by the cluster CA
openssl verify -CAfile /etc/kubernetes/pki/ca.crt alice.crt
# alice.crt: OK

# Step 4 — Create kubeconfig for alice using the signed cert
kubectl config set-credentials alice \
  --client-certificate=alice.crt \
  --client-key=alice.key \
  --embed-certs=true

kubectl config set-context alice-context \
  --cluster=kubernetes \
  --user=alice

# Test (alice needs RBAC permissions to do anything useful)
kubectl --context=alice-context get pods
# Error from server (Forbidden) ← cert works, just no permissions yet
```

> **Key Concept:** Manually signing with the CA key is equivalent to what the Certificates API does — the end result is the same. Direct CA signing requires access to `ca.key` (highly sensitive). The Certificates API is the safer, auditable alternative. In either case, the resulting cert must be distributed to the user along with `ca.crt` and a kubeconfig.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Troubleshoot a TLS Certificate Error
> ⏱️ **Recommended Time: 10 minutes**

A component is failing with a TLS error. Walk through diagnosing certificate issues in a Kubernetes cluster.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Identify which component is failing
kubectl get pods -n kube-system
# Look for CrashLoopBackOff or Error

# Step 2 — Check the component logs
kubectl logs -n kube-system kube-apiserver-controlplane
# Look for: "x509: certificate has expired", "certificate signed by unknown authority",
#           "tls: bad certificate", "no such file or directory"

# Step 3 — Check cert expiry
kubeadm certs check-expiration
# RESIDUAL TIME showing "EXPIRED" or negative value → cert expired

# Step 4 — Verify cert SANs match the endpoint being used
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout | grep -A 5 "Subject Alternative"
# If the node IP changed and it's not in the SANs → TLS error

# Step 5 — Verify cert is signed by the expected CA
openssl verify -CAfile /etc/kubernetes/pki/ca.crt /etc/kubernetes/pki/apiserver.crt
# OK → cert is valid
# error → cert/CA mismatch

# Step 6 — Check that cert and key are a matching pair
openssl x509 -noout -modulus -in /etc/kubernetes/pki/apiserver.crt | md5sum
openssl rsa -noout -modulus -in /etc/kubernetes/pki/apiserver.key | md5sum
# Both hashes must match — if they differ, cert and key are mismatched

# Fix — Renew expired cert
kubeadm certs renew apiserver
systemctl restart kubelet

# Fix — Regenerate cert with new SANs (if IP changed)
kubeadm init phase certs apiserver \
  --apiserver-cert-extra-sans=<new-ip>,<new-hostname>
```

Common TLS errors:

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `certificate has expired` | Cert past expiry date | `kubeadm certs renew <cert>` |
| `certificate signed by unknown authority` | CA mismatch or wrong cacert | Verify `--cacert` flag points to correct CA |
| `x509: certificate is valid for X, not Y` | SAN mismatch | Regenerate cert with correct SANs |
| `no such file or directory` | Missing cert file | Check path in component flags |
| `tls: bad certificate` | Cert/key mismatch | Verify cert+key pair with modulus check |

> **Key Concept:** The most common cert issue in production is **expiry** — kubeadm certs expire after 1 year. The second most common is **SAN mismatch** after a node IP change. Always verify three things: (1) cert is not expired, (2) cert SANs include the address being used, (3) cert and key are a matching pair.

</details>

---

