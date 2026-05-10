# 🗂️ ConfigMaps

> **CKA Exam Domain:** Workloads & Scheduling  
> **Topic:** ConfigMaps  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — Create a ConfigMap from Literals
> ⏱️ **Recommended Time: 4 minutes**

Create a ConfigMap named `app-config` in the `default` namespace with the following key-value pairs:

- `APP_ENV=production`
- `APP_PORT=8080`
- `LOG_LEVEL=info`

<details>
<summary>✅ Answer</summary>

```bash
# Imperative — fastest in the exam
kubectl create configmap app-config \
  --from-literal=APP_ENV=production \
  --from-literal=APP_PORT=8080 \
  --from-literal=LOG_LEVEL=info

# Verify
kubectl get configmap app-config -o yaml
```

Equivalent declarative manifest:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  APP_ENV: "production"
  APP_PORT: "8080"
  LOG_LEVEL: "info"
```

> **Key Concept:** ConfigMaps store **non-sensitive** configuration as plain key-value pairs. Unlike Secrets, the values are not encoded. Use `--from-literal` for individual values, `--from-file` for file contents, and `--from-env-file` for `.env`-style files.

</details>

---

### Question 2 — Create a ConfigMap from a File
> ⏱️ **Recommended Time: 5 minutes**

A configuration file exists at `/tmp/app.properties` with the following content:

```
database.url=jdbc:postgresql://db:5432/mydb
database.pool.size=10
```

Create a ConfigMap named `app-properties` in the `default` namespace from this file.

<details>
<summary>✅ Answer</summary>

```bash
# Create the file (if it doesn't exist in the exam environment)
cat <<EOF > /tmp/app.properties
database.url=jdbc:postgresql://db:5432/mydb
database.pool.size=10
EOF

# Create ConfigMap from the file
# The filename becomes the key; file content becomes the value
kubectl create configmap app-properties \
  --from-file=/tmp/app.properties

# Verify — key is the filename "app.properties"
kubectl get configmap app-properties -o yaml
```

```bash
# To use a custom key name instead of the filename:
kubectl create configmap app-properties \
  --from-file=config=/tmp/app.properties
# Key becomes "config" instead of "app.properties"
```

> **Key Concept:** `--from-file` stores the entire file content as the value of a single key. By default the key name is the filename. Use `--from-file=<custom-key>=<file-path>` to override the key name. This is the standard approach for injecting config files (nginx.conf, application.properties) into pods.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Inject All ConfigMap Keys as Environment Variables
> ⏱️ **Recommended Time: 5 minutes**

A ConfigMap named `app-config` exists in the `default` namespace. Create a Pod named `app-pod` using the `busybox:1.28` image that loads **all** keys from the ConfigMap as environment variables and prints them.

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
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "env && sleep 3600"]
    envFrom:
    - configMapRef:
        name: app-config
  restartPolicy: Never
```

```bash
kubectl apply -f app-pod.yaml

# Verify all keys are present as env vars
kubectl exec app-pod -- env | grep -E "APP_ENV|APP_PORT|LOG_LEVEL"
# APP_ENV=production
# APP_PORT=8080
# LOG_LEVEL=info
```

> **Key Concept:** `envFrom.configMapRef` loads **all** keys from a ConfigMap as environment variables in one shot. The key names become the environment variable names directly. If a key name is not a valid env var name (e.g., contains dots like `database.url`), the pod will still start but that key will be skipped — use volume mounts for such keys instead.

</details>

---

### Question 4 — Inject a Specific ConfigMap Key as an Environment Variable
> ⏱️ **Recommended Time: 6 minutes**

A ConfigMap named `app-config` has a key `APP_PORT`. Create a Pod named `port-pod` using the `nginx:alpine` image that injects only the `APP_PORT` key as an environment variable named `SERVER_PORT`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: port-pod
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    env:
    - name: SERVER_PORT            # custom env var name in the container
      valueFrom:
        configMapKeyRef:
          name: app-config         # ConfigMap name
          key: APP_PORT            # key to pull from
```

```bash
kubectl apply -f port-pod.yaml

# Verify
kubectl exec port-pod -- env | grep SERVER_PORT
# SERVER_PORT=8080
```

> **Key Concept:** `valueFrom.configMapKeyRef` injects a **single key** from a ConfigMap under a **custom environment variable name**. Use `optional: true` to prevent pod failure if the ConfigMap or key is missing. This pattern is common when the application expects a specific env var name that differs from the ConfigMap key name.

</details>

---

### Question 5 — Mount a ConfigMap as a Volume
> ⏱️ **Recommended Time: 7 minutes**

A ConfigMap named `app-properties` contains a key `app.properties` with multi-line content. Create a Pod named `config-vol-pod` using the `busybox:1.28` image that mounts the ConfigMap as a volume at `/etc/config/`. Verify the file is accessible inside the container.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-vol-pod
  namespace: default
spec:
  volumes:
  - name: config-vol
    configMap:
      name: app-properties
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "ls /etc/config/ && cat /etc/config/app.properties && sleep 3600"]
    volumeMounts:
    - name: config-vol
      mountPath: /etc/config
```

```bash
kubectl apply -f config-vol-pod.yaml

# Verify file contents
kubectl exec config-vol-pod -- cat /etc/config/app.properties
# database.url=jdbc:postgresql://db:5432/mydb
# database.pool.size=10
```

> **Key Concept:** When a ConfigMap is mounted as a volume, each key becomes a **file** and the value becomes the file content. This is ideal for config files (nginx.conf, application.properties) that applications read from disk. Unlike env vars, volume-mounted ConfigMaps **update automatically** when the ConfigMap is changed (with a short delay of ~1 minute).

</details>

---

### Question 6 — Mount a Specific ConfigMap Key as a File
> ⏱️ **Recommended Time: 7 minutes**

A ConfigMap named `nginx-config` has two keys: `nginx.conf` and `default.conf`. Mount **only** the `nginx.conf` key as a file at `/etc/nginx/nginx.conf` in a Pod named `nginx-pod` using the `nginx:alpine` image.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  namespace: default
spec:
  volumes:
  - name: nginx-conf-vol
    configMap:
      name: nginx-config
      items:                       # select specific keys
      - key: nginx.conf
        path: nginx.conf           # filename inside mountPath
  containers:
  - name: nginx
    image: nginx:alpine
    volumeMounts:
    - name: nginx-conf-vol
      mountPath: /etc/nginx/nginx.conf
      subPath: nginx.conf          # mount as a file, not a directory
```

```bash
kubectl apply -f nginx-pod.yaml

# Verify only the selected key is mounted
kubectl exec nginx-pod -- ls /etc/nginx/
kubectl exec nginx-pod -- cat /etc/nginx/nginx.conf
```

> **Key Concept:** Use `items` to select specific keys and `subPath` to mount a single file rather than replacing the entire directory. Without `subPath`, mounting at `/etc/nginx/nginx.conf` would replace the whole `/etc/nginx/` directory with a directory containing only `nginx.conf`. With `subPath`, only that one file is injected while the rest of the directory remains intact. **Note:** Files mounted with `subPath` do NOT auto-update when the ConfigMap changes.

</details>

---


## 🔴 Hard Questions

---

### Question 7 — Verify Live ConfigMap Update Propagation
> ⏱️ **Recommended Time: 9 minutes**

A Pod named `live-config-pod` using `busybox:1.28` has a ConfigMap named `live-config` mounted as a volume at `/etc/live-config/`. The ConfigMap has a key `log_level` with value `info`. Update the ConfigMap to change `log_level` to `debug` and verify the change propagates into the running Pod without a restart.

<details>
<summary>✅ Answer</summary>

```bash
# Setup — create the ConfigMap and Pod
kubectl create configmap live-config --from-literal=log_level=info
```

```yaml
# live-config-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: live-config-pod
  namespace: default
spec:
  volumes:
  - name: live-vol
    configMap:
      name: live-config
  containers:
  - name: busybox
    image: busybox:1.28
    command: ["sh", "-c", "while true; do cat /etc/live-config/log_level; echo; sleep 5; done"]
    volumeMounts:
    - name: live-vol
      mountPath: /etc/live-config
```

```bash
kubectl apply -f live-config-pod.yaml

# Watch the current value
kubectl exec live-config-pod -- cat /etc/live-config/log_level
# info

# Update the ConfigMap
kubectl create configmap live-config --from-literal=log_level=debug \
  --dry-run=client -o yaml | kubectl apply -f -

# Wait ~60 seconds, then verify the file has updated automatically
kubectl exec live-config-pod -- cat /etc/live-config/log_level
# debug  (no pod restart needed)
```

> **Key Concept:** ConfigMap volume mounts propagate updates to running pods automatically (kubelet syncs every ~1 minute). However, **env vars and `subPath` mounts do NOT update** — those require a pod restart. Applications that read config files on every request or use a file watcher benefit from live updates, while apps that cache config at startup require a restart regardless.

</details>

---

### Question 8 — Immutable ConfigMap
> ⏱️ **Recommended Time: 8 minutes**

Create an immutable ConfigMap named `release-config` in the `production` namespace with `VERSION=2.1.0` and `RELEASE_DATE=2026-05-08`. Demonstrate that updates are blocked and explain how to safely roll out a new version.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: release-config
  namespace: production
immutable: true
data:
  VERSION: "2.1.0"
  RELEASE_DATE: "2026-05-08"
```

```bash
kubectl apply -f release-config.yaml

# Confirm immutability
kubectl get configmap release-config -n production -o jsonpath='{.immutable}'
# true

# Attempt to update — will be REJECTED
kubectl patch configmap release-config -n production \
  --type merge \
  -p '{"data":{"VERSION":"2.2.0"}}'
# Error: configmap "release-config" is immutable

# Safe version rollout:
# 1. Create a new ConfigMap with the updated values
kubectl create configmap release-config-v2 \
  --from-literal=VERSION=2.2.0 \
  --from-literal=RELEASE_DATE=2026-06-01 \
  -n production

# 2. Update the Deployment to reference the new ConfigMap
kubectl set env deployment/my-app --from=configmap/release-config-v2 -n production

# 3. Verify the rollout, then delete the old ConfigMap
kubectl delete configmap release-config -n production
```

> **Key Concept:** Immutable ConfigMaps cannot have their `data` or `binaryData` changed — only metadata updates are allowed. They improve cluster performance at scale because the apiserver and kubelets stop watching them for changes, reducing API server load significantly. The safe rotation pattern mirrors immutable Secrets: create new → update consumers → delete old.

</details>

---

