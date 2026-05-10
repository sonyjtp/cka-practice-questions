# 🚦 Ingress

> **CKA Exam Domain:** Services & Networking  
> **Topic:** Ingress  
> **Total Questions:** 7

---

> ℹ️ **Scope Note:** Ingress requires an **Ingress Controller** to be installed (e.g., nginx, Traefik, HAProxy). On the CKA exam, an Ingress Controller is pre-installed. The `networking.k8s.io/v1` API (stable since Kubernetes 1.19) is used throughout this file.

---

## 🟢 Easy Questions

---

### Question 1 — Create a Basic Ingress
> ⏱️ **Recommended Time: 5 minutes**

A Service named `web-svc` in the `default` namespace exposes port `80`. Create an Ingress named `web-ingress` that routes **all traffic** for the host `web.example.com` to `web-svc` on port `80`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  namespace: default
spec:
  rules:
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

```bash
kubectl apply -f web-ingress.yaml

# Verify
kubectl get ingress web-ingress
kubectl describe ingress web-ingress

# Test (requires DNS or /etc/hosts entry pointing web.example.com to Ingress Controller IP)
curl http://web.example.com
```

> **Key Concept:** `pathType: Prefix` matches the path and any sub-paths (e.g., `/` matches everything). `pathType: Exact` matches only the exact path. The Ingress resource itself just stores routing rules — the **Ingress Controller** pod (running in the cluster) reads these rules and configures the proxy accordingly.

</details>

---

### Question 2 — Path-Based Routing
> ⏱️ **Recommended Time: 5 minutes**

Create an Ingress named `app-ingress` in the `default` namespace that routes traffic for `app.example.com`:

- `/api` → `api-svc` on port `8080`
- `/web` → `web-svc` on port `80`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: default
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080
      - path: /web
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

```bash
kubectl apply -f app-ingress.yaml

# Verify both paths are listed
kubectl describe ingress app-ingress

# Test routing
curl http://app.example.com/api
curl http://app.example.com/web
```

> **Key Concept:** Multiple paths under the same host are evaluated **in order** — the most specific path wins. With `pathType: Prefix`, `/api` matches `/api`, `/api/`, `/api/v1`, etc. Use `pathType: Exact` if you need to match only `/api` and nothing else. Always list more specific paths before less specific ones.

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Host-Based Routing
> ⏱️ **Recommended Time: 7 minutes**

Create an Ingress named `multi-host-ingress` in the `default` namespace that routes:

- `api.example.com` → `api-svc` on port `8080`
- `web.example.com` → `web-svc` on port `80`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-host-ingress
  namespace: default
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080

  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

```bash
kubectl apply -f multi-host-ingress.yaml

# Verify
kubectl get ingress multi-host-ingress
kubectl describe ingress multi-host-ingress

# Test host-based routing
curl -H "Host: api.example.com" http://<ingress-controller-ip>
curl -H "Host: web.example.com" http://<ingress-controller-ip>
```

> **Key Concept:** Each `rules` entry with a different `host` value creates a virtual host. The Ingress Controller uses the HTTP `Host` header to determine which backend to route to. Requests that don't match any host rule fall through to the **default backend** (if configured) or return 404.

</details>

---

### Question 4 — TLS Termination
> ⏱️ **Recommended Time: 7 minutes**

Configure the Ingress named `secure-ingress` in the `default` namespace to serve `secure.example.com` over HTTPS using TLS. A TLS Secret named `tls-secret` already exists in the `default` namespace containing `tls.crt` and `tls.key`. The backend Service is `secure-svc` on port `443`.

<details>
<summary>✅ Answer</summary>

```bash
# Verify the TLS secret exists
kubectl get secret tls-secret -o yaml
# Should have type: kubernetes.io/tls
# with keys: tls.crt and tls.key
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
  namespace: default
spec:
  tls:
  - hosts:
    - secure.example.com
    secretName: tls-secret     # must be type kubernetes.io/tls

  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-svc
            port:
              number: 443
```

```bash
kubectl apply -f secure-ingress.yaml

# Verify TLS is configured
kubectl describe ingress secure-ingress | grep -A 5 TLS

# Test HTTPS (skip cert verification for self-signed certs)
curl -k https://secure.example.com
```

If you need to create the TLS Secret from certificate files:

```bash
kubectl create secret tls tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n default
```

> **Key Concept:** TLS is terminated at the Ingress Controller — traffic between the client and the controller is encrypted; traffic from the controller to the backend Service may be plain HTTP. The `tls[].hosts` list must include the same hostname as the `rules[].host`. The Secret must be of type `kubernetes.io/tls` and in the **same namespace** as the Ingress resource.

</details>

---

### Question 5 — Default Backend
> ⏱️ **Recommended Time: 6 minutes**

Create an Ingress named `default-backend-ingress` in the `default` namespace that:

- Routes `app.example.com/api` to `api-svc` on port `8080`
- Returns a custom response for **all other unmatched requests** using `fallback-svc` on port `80`

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: default-backend-ingress
  namespace: default
spec:
  defaultBackend:              # catches all unmatched requests
    service:
      name: fallback-svc
      port:
        number: 80

  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080
```

```bash
kubectl apply -f default-backend-ingress.yaml

# Verify
kubectl describe ingress default-backend-ingress

# Test matched route
curl http://app.example.com/api       # → api-svc

# Test unmatched route — goes to fallback-svc
curl http://app.example.com/unknown   # → fallback-svc
curl http://other.example.com         # → fallback-svc (no matching host rule)
```

> **Key Concept:** `spec.defaultBackend` is a catch-all — it handles requests that don't match any rule's host or path. This is different from the **Ingress Controller's** default backend (configured at the controller level). The Ingress-level `defaultBackend` takes precedence for unmatched requests within this specific Ingress resource.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — Troubleshoot Ingress Returning 404 or 502
> ⏱️ **Recommended Time: 9 minutes**

Requests to `app.example.com` via an Ingress named `app-ingress` are returning `404` or `502`. Diagnose and fix the issue.

<details>
<summary>✅ Answer</summary>

```bash
# Step 1 — Verify the Ingress exists and check its rules
kubectl describe ingress app-ingress

# Step 2 — Check the backend Service exists and has endpoints
kubectl get service api-svc
kubectl get endpoints api-svc
# If ENDPOINTS shows <none> → pods not running or label mismatch

# Step 3 — Check Ingress Controller is running
kubectl get pods -n ingress-nginx   # or kube-system depending on install
# If pods are not Running → controller is down

# Step 4 — Check Ingress Controller logs for routing errors
kubectl logs -n ingress-nginx \
  $(kubectl get pods -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx \
  -o jsonpath='{.items[0].metadata.name}')

# Common log errors:
# "no backend" → service name/port wrong in Ingress spec
# "upstream not found" → Service has no endpoints

# Step 5 — Verify the Service name and port match exactly
kubectl get ingress app-ingress -o yaml | grep -A 10 backend
kubectl get service api-svc       # confirm name and port match

# Step 6 — Check the pathType and path
# pathType: Exact for "/" won't match "/api" — use Prefix instead

# Step 7 — Verify the Ingress class (if applicable)
kubectl get ingress app-ingress -o yaml | grep ingressClassName
kubectl get ingressclass
# If ingressClassName doesn't match an available controller → 404

# Step 8 — Test the backend Service directly (bypass Ingress)
kubectl run test --image=busybox:1.28 --restart=Never -- \
  wget -qO- http://api-svc:8080
# If this fails → Service/pod issue; if it works → Ingress misconfiguration
```

Root cause reference:

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| `404` | No matching rule for the host/path | Fix host/path in Ingress spec |
| `404` | Wrong `ingressClassName` | Set correct `ingressClassName` or annotation |
| `502` | Backend Service has no endpoints | Fix Service selector or pod labels |
| `502` | Wrong `targetPort` on Service | Match Service `targetPort` to container port |
| `502` | Backend pods crashing | Fix pod/deployment issues |
| `No Address` | Service doesn't exist | Create the Service |

> **Key Concept:** 404 from an Ingress usually means the routing rule doesn't match (wrong host, wrong path, wrong Ingress class). 502 means the rule matched but the backend is unreachable. Always isolate by testing: Ingress → Service → Pod independently. Use `kubectl describe ingress` to check the `Address` field — if empty, the Ingress Controller hasn't picked up the resource.

</details>

---

### Question 7 — TLS with Path-Based Routing Combined
> ⏱️ **Recommended Time: 10 minutes**

Create an Ingress named `combined-ingress` in the `default` namespace that:

- Serves `app.example.com` over **HTTPS only** using Secret `app-tls`
- Routes `/api` → `api-svc:8080`
- Routes `/static` → `static-svc:80`
- Redirects HTTP to HTTPS using the `nginx.ingress.kubernetes.io/ssl-redirect` annotation
- Has a default backend `fallback-svc:80` for unmatched paths

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: combined-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"      # redirect HTTP → HTTPS
    nginx.ingress.kubernetes.io/use-regex: "false"
spec:
  ingressClassName: nginx

  tls:
  - hosts:
    - app.example.com
    secretName: app-tls

  defaultBackend:
    service:
      name: fallback-svc
      port:
        number: 80

  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080

      - path: /static
        pathType: Prefix
        backend:
          service:
            name: static-svc
            port:
              number: 80
```

```bash
# Create TLS secret if not already present
kubectl create secret tls app-tls \
  --cert=app.crt \
  --key=app.key \
  -n default

kubectl apply -f combined-ingress.yaml

# Verify all rules are configured
kubectl describe ingress combined-ingress

# Test HTTPS routing
curl -k https://app.example.com/api
curl -k https://app.example.com/static

# Test HTTP → HTTPS redirect
curl -v http://app.example.com/api
# Should return 308 Permanent Redirect to https://

# Test default backend
curl -k https://app.example.com/unknown
# → fallback-svc
```

> **Key Concept:** Annotations are controller-specific — `nginx.ingress.kubernetes.io/*` only work with the NGINX Ingress Controller. The `ssl-redirect: "true"` annotation tells NGINX to issue a `308` redirect for any HTTP request. Always pair `tls[].hosts` with the same hostname in `rules[].host` — a mismatch causes TLS to not apply to that host's traffic.

</details>

---

## 📌 Quick Reference

### Ingress Resource Structure

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example
  annotations: {}          # controller-specific settings
spec:
  ingressClassName: nginx  # which controller handles this Ingress
  tls:                     # optional TLS config
  - hosts: [host]
    secretName: tls-secret
  defaultBackend:          # optional catch-all
    service:
      name: fallback-svc
      port:
        number: 80
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix   # Prefix | Exact | ImplementationSpecific
        backend:
          service:
            name: my-svc
            port:
              number: 80
```

### pathType Comparison

| `pathType` | `/foo` matches | `/foo/bar` matches | `/foobar` matches |
|------------|---------------|-------------------|------------------|
| `Prefix` | ✅ | ✅ | ❌ |
| `Exact` | ✅ | ❌ | ❌ |
| `ImplementationSpecific` | Controller-defined | Controller-defined | Controller-defined |

### Common NGINX Ingress Annotations

```yaml
# Force HTTPS redirect
nginx.ingress.kubernetes.io/ssl-redirect: "true"

# Rewrite path (strip prefix before sending to backend)
nginx.ingress.kubernetes.io/rewrite-target: /

# Rate limiting
nginx.ingress.kubernetes.io/limit-rps: "10"

# CORS
nginx.ingress.kubernetes.io/enable-cors: "true"
```

### Useful Commands

```bash
# List all Ingresses
kubectl get ingress -A

# Describe Ingress (shows rules, backends, TLS, address)
kubectl describe ingress <name>

# Check Ingress Controller pods
kubectl get pods -n ingress-nginx

# Check Ingress Controller logs
kubectl logs -n ingress-nginx <controller-pod>

# Create TLS secret from files
kubectl create secret tls <name> --cert=<crt> --key=<key>

# List available IngressClasses
kubectl get ingressclass
```

### Related Topics

- 🔗 [Services](./services.md) — Ingress routes to Services, which route to pods
- 🔗 [Network Policies](./network-policies.md) — control which pods can be reached; works alongside Ingress
- 🔗 [Secrets](../workloads/secrets.md) — TLS certificates are stored as `kubernetes.io/tls` Secrets
