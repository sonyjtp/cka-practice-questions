# 🛡️ Security Contexts

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Pod and Container Security Contexts  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Run a Container as a Non-Root User
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `non-root-pod` in the `default` namespace that runs as user ID `1000` and group ID `3000`. Use `busybox:1.28`.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: non-root-pod
  namespace: default
spec:
  securityContext:          # pod-level: applies to ALL containers
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000           # group for mounted volumes
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
```

```bash
kubectl apply -f non-root-pod.yaml

# Verify the process is running as the specified user
kubectl exec non-root-pod -- id
# uid=1000 gid=3000 groups=3000,2000

kubectl exec non-root-pod -- whoami
# whoami: unknown uid 1000  (no /etc/passwd entry for 1000 in busybox)
```

Pod vs Container security context:

```yaml
spec:
  securityContext:        # pod-level: applies to ALL containers
    runAsUser: 1000
  containers:
  - name: app
    securityContext:      # container-level: overrides pod-level for THIS container
      runAsUser: 2000
```

> **Key Concept:** `securityContext` can be set at both the **pod level** (`spec.securityContext`) and **container level** (`spec.containers[].securityContext`). Container-level settings override pod-level settings for that specific container. `fsGroup` sets the group ownership for mounted volumes — useful to ensure containers can read/write shared volumes.

</details>

---

### Question 2 — Prevent Running as Root
> ⏱️ **Recommended Time: 5 minutes**

Create a Pod named `no-root-pod` that explicitly prevents any container from running as root (UID 0).

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-root-pod
  namespace: default
spec:
  securityContext:
    runAsNonRoot: true    # fails pod if container tries to run as root
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    securityContext:
      runAsUser: 1000     # provide a non-root UID
```

```bash
kubectl apply -f no-root-pod.yaml

# Test — try to create a pod that runs as root (should fail)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: root-attempt
spec:
  securityContext:
    runAsNonRoot: true
  containers:
  - name: app
    image: busybox:1.28   # busybox runs as root by default
    command: ["sleep", "3600"]
EOF

kubectl describe pod root-attempt | grep -A 5 "Events:"
# Error: container has runAsNonRoot and image will run as root
```

> **Key Concept:** `runAsNonRoot: true` is a security guard — it causes the pod to fail at startup if the container would run as UID 0. It does not automatically set a non-root UID; you still need to specify `runAsUser` with a non-zero value (or the image's `USER` instruction must set a non-root user).

</details>

---

## 🟡 Medium Questions

---

### Question 3 — Linux Capabilities
> ⏱️ **Recommended Time: 7 minutes**

Create a Pod named `cap-pod` that:
- Drops **all** Linux capabilities
- Adds back only `NET_BIND_SERVICE` (allows binding to ports below 1024)

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cap-pod
  namespace: default
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    securityContext:
      capabilities:
        drop:
        - ALL                  # drop every capability first
        add:
        - NET_BIND_SERVICE     # then add back only what's needed
```

```bash
kubectl apply -f cap-pod.yaml

# Verify capabilities inside the container
kubectl exec cap-pod -- cat /proc/1/status | grep Cap
# CapPrm: 0000000000000400   (only NET_BIND_SERVICE = bit 10)
# CapEff: 0000000000000400

# Decode capability bitmask
capsh --decode=0000000000000400
# cap_net_bind_service
```

Common Linux capabilities:

| Capability         | Allows                                  |
|--------------------|-----------------------------------------|
| `NET_BIND_SERVICE` | Bind to ports < 1024                    |
| `SYS_PTRACE`       | Debug/trace other processes             |
| `SYS_ADMIN`        | Broad system administration (dangerous) |
| `CHOWN`            | Change file ownership                   |
| `NET_ADMIN`        | Network configuration                   |
| `ALL`              | All capabilities (privileged)           |

> **Key Concept:** Linux capabilities break root's all-or-nothing privilege model into fine-grained units. Best practice is `drop: [ALL]` then `add` back only the specific capabilities the application needs. `SYS_ADMIN` is essentially root — avoid it. Container runtimes grant a default set of capabilities; `drop: ALL` removes even those defaults.

</details>

---

### Question 4 — Read-Only Root Filesystem
> ⏱️ **Recommended Time: 6 minutes**

Create a Pod named `readonly-pod` with a read-only root filesystem. The container still needs to write to `/tmp` — handle this with an `emptyDir` volume.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: readonly-pod
  namespace: default
spec:
  volumes:
  - name: tmp-vol
    emptyDir: {}           # writable scratch space

  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "echo test > /tmp/test.txt && sleep 3600"]
    securityContext:
      readOnlyRootFilesystem: true    # root filesystem is read-only
    volumeMounts:
    - name: tmp-vol
      mountPath: /tmp                # /tmp is writable via emptyDir
```

```bash
kubectl apply -f readonly-pod.yaml

# Verify root fs is read-only
kubectl exec readonly-pod -- touch /newfile
# touch: /newfile: Read-only file system  ✅

# Verify /tmp is writable
kubectl exec readonly-pod -- cat /tmp/test.txt
# test  ✅
```

> **Key Concept:** `readOnlyRootFilesystem: true` prevents the container from writing to its root filesystem — useful to prevent malicious processes from modifying binaries or configs. Applications that need to write temp files must use mounted volumes (`emptyDir` for scratch space, PVCs for persistent data). This is a strong defence-in-depth security measure.

</details>

---

### Question 5 — Privileged vs Non-Privileged Containers
> ⏱️ **Recommended Time: 7 minutes**

Explain the difference between privileged and non-privileged containers. Create one of each and compare what they can do.

<details>
<summary>✅ Answer</summary>

```yaml
# Non-privileged container (default)
apiVersion: v1
kind: Pod
metadata:
  name: normal-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    # securityContext not set — default, non-privileged
---
# Privileged container
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    securityContext:
      privileged: true    # runs with full root capabilities on the HOST
```

```bash
kubectl apply -f normal-pod.yaml
kubectl apply -f privileged-pod.yaml

# Non-privileged: cannot access host devices
kubectl exec normal-pod -- ls /dev | wc -l
# ~15 devices (just what the container needs)

# Privileged: sees ALL host devices
kubectl exec privileged-pod -- ls /dev | wc -l
# 200+ devices (full host device access)

# Non-privileged: cannot load kernel modules
kubectl exec normal-pod -- modprobe nf_conntrack
# modprobe: ERROR: ... Operation not permitted

# Privileged: can load kernel modules
kubectl exec privileged-pod -- modprobe nf_conntrack
# (succeeds)
```

|                   | Non-Privileged     | Privileged                              |
|-------------------|--------------------|-----------------------------------------|
| Host devices      | ❌ No               | ✅ Full access                           |
| Kernel modules    | ❌ No               | ✅ Yes                                   |
| Mount filesystems | ❌ No               | ✅ Yes                                   |
| All capabilities  | ❌ Default set only | ✅ ALL                                   |
| Use case          | Applications       | Node agents, network plugins, debugging |
| Security risk     | Low                | Very High                               |

> **Key Concept:** A privileged container is essentially root on the **host node** — it bypasses all container isolation. Never use `privileged: true` in application workloads. It is only justified for system-level tools (node exporters, CNI plugins, debugging). In the CKA exam, if you see `privileged: true` in a workload, treat it as a misconfiguration.

</details>

---

## 🔴 Hard Questions

---

### Question 6 — AllowPrivilegeEscalation
> ⏱️ **Recommended Time: 8 minutes**

Create a Pod that prevents privilege escalation — the container process cannot gain more privileges than its parent process (i.e., `sudo` and `setuid` binaries are ineffective).

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-escalation-pod
  namespace: default
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false   # prevents gaining new privileges
      runAsNonRoot: true
      runAsUser: 1000
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

```bash
kubectl apply -f no-escalation-pod.yaml

# Verify — try to escalate using su (should fail)
kubectl exec no-escalation-pod -- su root
# su: must be suid to work properly  ← escalation blocked ✅

# This is the recommended "hardened pod" security context
```

The "hardened pod" template — use this as a starting point:

```yaml
securityContext:                        # pod-level
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 3000
  fsGroup: 2000
  seccompProfile:
    type: RuntimeDefault

containers:
- securityContext:                      # container-level
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop:
      - ALL
```

> **Key Concept:** `allowPrivilegeEscalation: false` ensures that no child process can gain more privileges than the container's initial process — `setuid` binaries (like `sudo`, `su`, `passwd`) are effectively neutralised. This is set to `true` by default. It is automatically set to `false` when `privileged: false` and `runAsNonRoot: true` are both set in newer Kubernetes versions.

</details>

---

### Question 7 — Seccomp Profiles
> ⏱️ **Recommended Time: 9 minutes**

Apply the `RuntimeDefault` seccomp profile to a Pod to restrict the syscalls the container can make.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: seccomp-pod
  namespace: default
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault     # use the container runtime's default seccomp profile
  containers:
  - name: app
    image: nginx:alpine
    securityContext:
      allowPrivilegeEscalation: false
```

```bash
kubectl apply -f seccomp-pod.yaml

# Verify the seccomp profile is applied
kubectl get pod seccomp-pod -o jsonpath='{.spec.securityContext.seccompProfile}'
# {"type":"RuntimeDefault"}
```

Seccomp profile types:

```yaml
# Option 1: RuntimeDefault — container runtime's default filtered syscall list
seccompProfile:
  type: RuntimeDefault

# Option 2: Unconfined — no syscall filtering (default if not set)
seccompProfile:
  type: Unconfined

# Option 3: Localhost — use a custom profile file on the node
seccompProfile:
  type: Localhost
  localhostProfile: profiles/my-profile.json
  # File must exist at: /var/lib/kubelet/seccomp/profiles/my-profile.json
```

> **Key Concept:** Seccomp (secure computing mode) restricts which Linux system calls a container can make. `RuntimeDefault` uses the container runtime's built-in profile (e.g., Docker's default seccomp profile), which blocks ~40 dangerous syscalls while allowing everything needed for normal operation. It is a low-risk, high-value security improvement — recommended for all production workloads.

</details>

---

## 📌 Quick Reference

### Security Context Fields

```yaml
# Pod-level (spec.securityContext)
securityContext:
  runAsUser: 1000              # UID to run as
  runAsGroup: 3000             # GID to run as
  runAsNonRoot: true           # fail if UID would be 0
  fsGroup: 2000                # GID for volume ownership
  seccompProfile:
    type: RuntimeDefault

# Container-level (spec.containers[].securityContext)
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  privileged: false
  capabilities:
    drop: [ALL]
    add: [NET_BIND_SERVICE]
```

### Security Hardening Checklist

| Setting                    | Recommended Value | Reason                    |
|----------------------------|-------------------|---------------------------|
| `runAsNonRoot`             | `true`            | Prevent root container    |
| `runAsUser`                | non-zero          | Explicit non-root UID     |
| `allowPrivilegeEscalation` | `false`           | Block sudo/setuid         |
| `readOnlyRootFilesystem`   | `true`            | Prevent filesystem writes |
| `capabilities.drop`        | `[ALL]`           | Least privilege           |
| `privileged`               | `false` (default) | No host access            |
| `seccompProfile.type`      | `RuntimeDefault`  | Restrict syscalls         |

### Useful Commands

```bash
# Check security context of a running pod
kubectl get pod <name> -o jsonpath='{.spec.securityContext}'
kubectl get pod <name> -o jsonpath='{.spec.containers[0].securityContext}'

# Verify UID inside container
kubectl exec <pod> -- id

# Check capabilities
kubectl exec <pod> -- cat /proc/1/status | grep Cap
```

### Related Topics

- 🔗 [Image Security](./image-security.md) — control which images can be pulled
- 🔗 [Network Policies](../networking/network-policies.md) — network-level security complement to pod security contexts
- 🔗 [RBAC](../cluster-architecture/rbac.md) — API-level access control; security contexts control OS-level access
