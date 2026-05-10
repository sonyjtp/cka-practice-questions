# 🔐 Secrets

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** Secrets  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Create a Generic Secret from Literals
> ⏱️ **Recommended Time: 4 minutes**

Create a Secret named `db-secret` in the `default` namespace with the following credentials:

- `DB_USER=admin`
- `DB_PASSWORD=s3cur3p@ss`
- `DB_HOST=mysql-svc`

<details>
<summary>✅ Answer</summary>

```bash
# Imperative — fastest in the exam
kubectl create secret generic db-secret \
  --from-literal=DB_USER=admin \
  --from-literal=DB_PASSWORD=s3cur3p@ss \
  --from-literal=DB_HOST=mysql-svc

# Verify (values are base64-encoded in the output)
kubectl get secret db-secret -o yaml

# Decode a value
kubectl get secret db-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

> **Key Concept:** Secrets store sensitive data as **base64-encoded** strings — this is encoding, NOT encryption. The data is not secure unless encryption at rest is enabled. Use `kubectl create secret generic` for arbitrary key-value pairs. Never hardcode Secret values in pod manifests or version control.

</details>

---

### Question 2 — Create a TLS Secret
> ⏱️ **Recommended Time: 5 minutes**

A TLS certificate (`tls.crt`) and private key (`tls.key`) are located at `/tmp/tls/`. Create a TLS Secret named `webapp-tls` in the `default` namespace from these files.

<details>
<summary>✅ Answer</summary>

```bash
# Generate self-signed cert for testing (if files don't exist)
mkdir -p /tmp/tls
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/tls/tls.key \
  -out /tmp/tls/tls.crt \
  -subj "/CN=webapp.example.com"

# Create the TLS Secret
kubectl create secret tls webapp-tls \
  --cert=/tmp/tls/tls.crt \
  --key=/tmp/tls/tls.key

# Verify — keys are always named tls.crt and tls.key
kubectl get secret webapp-tls -o yaml
```

> **Key Concept:** `kubectl create secret tls` always creates a Secret with exactly two keys: `tls.crt` and `tls.key`. These are the standard key names expected by Ingress controllers and other components. TLS Secrets are of type `kubernetes.io/tls`.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Inject All Secret Keys as Environment Variables
> ⏱️ **Recommended Time: 5 minutes**

A Secret named `db-secret` exists in the `default` namespace. Create a Pod named `db-pod` using the `busybox:1.28` image that loads **all** keys from the Secret as environment variables.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
  namespace: default
spec:
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "env && sleep 3600"]
    envFrom:
    - secretRef:
        name: db-secret
  restartPolicy: Never
```

```bash
kubectl apply -f db-pod.yaml

# Verify — values will appear decoded as plain text inside the container
kubectl exec db-pod -- env | grep -E "DB_USER|DB_PASSWORD|DB_HOST"
```

> **Key Concept:** `envFrom.secretRef` works identically to `envFrom.configMapRef` but for Secrets. Inside the container, the values are **automatically base64-decoded** — the application sees plain text. Note: env vars are visible to anyone who can exec into the pod, so volume mounts are considered more secure for sensitive data.

</details>

---

### Question 4 — Inject a Specific Secret Key as an Environment Variable
> ⏱️ **Recommended Time: 6 minutes**

A Secret named `db-secret` has a key `DB_PASSWORD`. Create a Pod named `app-pod` using the `nginx:alpine` image that injects only the `DB_PASSWORD` key as an environment variable named `DATABASE_PASSWORD`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    env:
    - name: DATABASE_PASSWORD      # name in the container
      valueFrom:
        secretKeyRef:
          name: db-secret          # Secret name
          key: DB_PASSWORD         # key to pull from
```

```bash
kubectl apply -f app-pod.yaml

# Verify
kubectl exec app-pod -- env | grep DATABASE_PASSWORD
# DATABASE_PASSWORD=s3cur3p@ss
```

> **Key Concept:** `valueFrom.secretKeyRef` injects a **single Secret key** under a **custom environment variable name**. Add `optional: true` to prevent the pod from failing if the Secret or key doesn't exist. This is a common exam pattern — know the difference between `configMapKeyRef` and `secretKeyRef`.

</details>

---

### Question 5 — Mount a Secret as a Volume
> ⏱️ **Recommended Time: 7 minutes**

A Secret named `db-secret` exists in the `default` namespace. Create a Pod named `secret-vol-pod` using the `busybox:1.28` image that mounts the entire Secret as a volume at `/etc/db-credentials/`. Verify the files are created with decoded values.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-vol-pod
  namespace: default
spec:
  volumes:
  - name: db-creds-vol
    secret:
      secretName: db-secret
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "ls /etc/db-credentials/ && cat /etc/db-credentials/DB_PASSWORD && sleep 3600"]
    volumeMounts:
    - name: db-creds-vol
      mountPath: /etc/db-credentials
      readOnly: true
```

```bash
kubectl apply -f secret-vol-pod.yaml

# Verify files exist and values are decoded
kubectl exec secret-vol-pod -- ls /etc/db-credentials/
# DB_HOST  DB_PASSWORD  DB_USER

kubectl exec secret-vol-pod -- cat /etc/db-credentials/DB_PASSWORD
# s3cur3p@ss
```

> **Key Concept:** When mounted as a volume, each Secret key becomes a **file** with the decoded value as its content. Files are owned by root and have `0444` permissions by default. Volume-mounted Secrets are considered **more secure** than env vars because they are stored in `tmpfs` (memory), not exposed in the process environment, and can be updated without restarting the pod.

</details>

---

### Question 6 — Create a docker-registry Secret and Use It as an imagePullSecret
> ⏱️ **Recommended Time: 7 minutes**

Your cluster needs to pull images from a private registry at `registry.example.com` using the credentials `user=reguser` and `password=regpass`. Create the appropriate Secret and configure a Pod named `private-pod` to use it.

<details>
<summary>✅ Answer</summary>

```bash
# Create the docker-registry Secret
kubectl create secret docker-registry registry-creds \
  --docker-server=registry.example.com \
  --docker-username=reguser \
  --docker-password=regpass \
  --docker-email=admin@example.com

# Verify — stored as a .dockerconfigjson key
kubectl get secret registry-creds -o yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-pod
  namespace: default
spec:
  imagePullSecrets:
  - name: registry-creds
  containers:
  - name: app
    image: registry.example.com/myapp:latest
```

```bash
kubectl apply -f private-pod.yaml
kubectl describe pod private-pod | grep -A 2 "Image"
```

> **Key Concept:** `kubectl create secret docker-registry` creates a Secret of type `kubernetes.io/dockerconfigjson`. Reference it in a pod's `imagePullSecrets` field to allow pulling from private registries. You can also attach the Secret to a ServiceAccount's `imagePullSecrets` so all pods using that ServiceAccount inherit it automatically.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Mount a Specific Secret Key as a File with Custom Permissions
> ⏱️ **Recommended Time: 9 minutes**

A Secret named `db-secret` has multiple keys. Mount **only** the `DB_PASSWORD` key as a file at `/etc/secrets/password` in a Pod named `selective-secret-pod` using `busybox:1.28`. Set the file permissions to `0400` (read-only for owner).

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: selective-secret-pod
  namespace: default
spec:
  volumes:
  - name: secret-vol
    secret:
      secretName: db-secret
      items:                          # select specific keys
      - key: DB_PASSWORD
        path: password                # filename inside mountPath
        mode: 0400                    # file permission (octal)
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "ls -la /etc/secrets/ && cat /etc/secrets/password && sleep 3600"]
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true
```

```bash
kubectl apply -f selective-secret-pod.yaml

# Verify only the selected key is present and permissions are correct
kubectl exec selective-secret-pod -- ls -la /etc/secrets/
# -r--------  1 root root  10 password

kubectl exec selective-secret-pod -- cat /etc/secrets/password
# s3cur3p@ss
```

> **Key Concept:** The `items` field under a Secret volume lets you select specific keys and set their filename (`path`) and permissions (`mode` in octal). The default permission for Secret volume files is `0644`. Setting `0400` restricts access to the owner only, which is best practice for private keys and passwords. You can also set a default mode for all files via `defaultMode`.

</details>

---

### Question 8 — Immutable Secret
> ⏱️ **Recommended Time: 8 minutes**

Create an immutable Secret named `api-keys` in the `default` namespace with the key `API_KEY=abc123xyz`. Demonstrate that the Secret cannot be modified after creation, and explain how to rotate the key safely.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
  namespace: default
immutable: true
type: Opaque
stringData:                  # stringData auto-encodes to base64
  API_KEY: "abc123xyz"
```

```bash
kubectl apply -f api-keys.yaml

# Verify it is immutable
kubectl get secret api-keys -o jsonpath='{.immutable}'
# true

# Attempt to update — will be REJECTED
kubectl patch secret api-keys \
  --type merge \
  -p '{"stringData":{"API_KEY":"newkey456"}}'
# Error: secret "api-keys" is immutable

# Safe key rotation:
# 1. Create a new secret with the new value
kubectl create secret generic api-keys-v2 --from-literal=API_KEY=newkey456

# 2. Update the Pod/Deployment to reference api-keys-v2
kubectl set env deployment/my-app --from=secret/api-keys-v2

# 3. Once all pods are updated, delete the old secret
kubectl delete secret api-keys
```

> **Key Concept:** Immutable Secrets (and ConfigMaps) cannot have their `data` changed after creation. They improve cluster performance because the apiserver stops watching them for changes, and provide a safety guarantee for critical credentials. Safe rotation requires creating a new Secret with the new value, updating all consumers, then deleting the old Secret — a blue/green approach for credentials.

</details>

---

