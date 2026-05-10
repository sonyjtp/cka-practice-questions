# 📊 Logging & Monitoring

> **CKA Exam Domain:** Logging & Monitoring  
> **Topic:** Logging & Monitoring  
> **Total Questions:** 8

---

## 🟢 Easy Questions

---

### Question 1 — View Logs of a Running Pod
> ⏱️ **Recommended Time: 4 minutes**

A Pod named `web-app` is running in the `default` namespace. Retrieve the last 50 lines of its logs and follow them in real time.

<details>
<summary>✅ Answer</summary>

```bash
# Tail the last 50 lines
kubectl logs web-app --tail=50

# Follow (stream) logs in real time
kubectl logs web-app --tail=50 --follow
```

> **Key Concept:** `kubectl logs` is the primary way to retrieve container stdout/stderr in Kubernetes. `--tail=N` limits the output to the last N lines, and `--follow` (or `-f`) streams new log entries as they arrive — similar to `tail -f` on a file.

</details>

---

### Question 2 — View Logs of a Specific Container in a Multi-Container Pod
> ⏱️ **Recommended Time: 5 minutes**

A Pod named `multi-app` in the `default` namespace has two containers: `frontend` and `backend`. Retrieve the logs from only the `backend` container.

<details>
<summary>✅ Answer</summary>

```bash
# Specify the container with -c
kubectl logs multi-app -c backend

# Follow logs from the specific container
kubectl logs multi-app -c backend --follow
```

> **Key Concept:** When a Pod has multiple containers, you must specify which container's logs to fetch using `-c <container-name>`. Omitting `-c` in a multi-container Pod will return an error asking you to specify a container.

</details>

---

### Question 3 — View Logs of a Previously Crashed Container
> ⏱️ **Recommended Time: 5 minutes**

A Pod named `crash-app` in the `default` namespace has been restarting. Retrieve the logs from the **previous** (crashed) container instance to diagnose the failure.

<details>
<summary>✅ Answer</summary>

```bash
# Retrieve logs from the previous container run
kubectl logs crash-app --previous

# Combine with --tail to limit output
kubectl logs crash-app --previous --tail=100
```

> **Key Concept:** `--previous` (or `-p`) fetches the logs from the last terminated instance of a container. This is extremely useful for diagnosing crash-loops (CrashLoopBackOff) because the current container may have already restarted and its logs are empty.

</details>

---

## 🟡 Medium Questions

---

### Question 4 — Monitor Node and Pod Resource Usage
> ⏱️ **Recommended Time: 6 minutes**

The `metrics-server` is installed in the cluster. Perform the following:

1. Show CPU and memory usage for all **nodes**.
2. Show CPU and memory usage for all **pods** in the `kube-system` namespace, sorted by CPU consumption.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Node-level resource usage
kubectl top nodes

# 2. Pod-level resource usage in kube-system, sorted by CPU
kubectl top pods -n kube-system --sort-by=cpu
```

> **Key Concept:** `kubectl top` relies on the **Metrics Server** to report real-time resource consumption. `--sort-by=cpu` or `--sort-by=memory` ranks the output. Without the Metrics Server, `kubectl top` will return an error. This is the main tool examiners test for identifying resource-hungry pods.

</details>

---

### Question 5 — Retrieve Application Logs from All Pods Matching a Label
> ⏱️ **Recommended Time: 7 minutes**

A Deployment named `api-server` in the `production` namespace has multiple replicas, all labeled `app=api-server`. Stream the logs from **all** matching pods simultaneously, and prefix each line with the pod name.

<details>
<summary>✅ Answer</summary>

```bash
# Stream logs from all pods matching the label selector
kubectl logs -l app=api-server -n production --follow --prefix

# Limit to last 20 lines per pod (useful when replicas are large)
kubectl logs -l app=api-server -n production --tail=20 --prefix
```

> **Key Concept:** Passing a label selector with `-l` to `kubectl logs` fetches logs from all matching pods at once. `--prefix` prepends the pod name to each log line so you can identify which pod produced which output. This is essential for debugging distributed applications with many replicas.

</details>

---

### Question 6 — Identify the Node Consuming the Most Memory
> ⏱️ **Recommended Time: 6 minutes**

Using `kubectl top`, identify which node in the cluster is consuming the **most memory** and output only that node's name and memory usage.

<details>
<summary>✅ Answer</summary>

```bash
# List all nodes sorted by memory
kubectl top nodes --sort-by=memory

# The first row after the header is the highest memory consumer
# To extract just the top result
kubectl top nodes --sort-by=memory | head -2
```

> **Key Concept:** `kubectl top nodes --sort-by=memory` ranks nodes by memory consumption in descending order. The first data row is the heaviest consumer. In an exam scenario, you may be asked to record this value into a file:
>
> ```bash
> kubectl top nodes --sort-by=memory | head -2 | tail -1 > /opt/outputs/high-memory-node.txt
> ```

</details>

---

## 🔴 Hard Questions

---

### Question 7 — Investigate a CrashLoopBackOff Pod and Write Logs to a File
> ⏱️ **Recommended Time: 9 minutes**

A Pod named `failing-job` in the `default` namespace is in `CrashLoopBackOff`. Do the following:

1. Identify the exit code of the last crashed container.
2. Save the logs from the **previous** container instance to `/opt/logs/failing-job.log`.

<details>
<summary>✅ Answer</summary>

```bash
# 1. Identify the exit code of the last crash
kubectl describe pod failing-job | grep -A 10 "Last State"

# Example output:
#   Last State:  Terminated
#     Reason:    Error
#     Exit Code: 1
#     ...

# 2. Save previous container logs to a file
kubectl logs failing-job --previous > /opt/logs/failing-job.log

# Verify the file was written
cat /opt/logs/failing-job.log
```

> **Key Concept:** `kubectl describe pod` reveals the exit code under `Last State: Terminated → Exit Code`. Common codes: `0` = success, `1` = generic error, `137` = OOMKilled (killed by the kernel due to memory limit), `143` = graceful termination (SIGTERM). Combining `--previous` with output redirection (`>`) is a common CKA task pattern.

</details>

---

### Question 8 — Configure a Sidecar Container for Log Forwarding
> ⏱️ **Recommended Time: 10 minutes**

An application Pod named `app-with-logs` in the `default` namespace writes logs to the file `/var/log/app/app.log` inside its main container (`app`). Add a **sidecar container** named `log-forwarder` using the `busybox:1.28` image that reads and streams the same log file to its stdout, so `kubectl logs` can be used to view the application logs.

<details>
<summary>✅ Answer</summary>

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logs
  namespace: default
spec:
  volumes:
  - name: shared-logs
    emptyDir: {}

  containers:
  - name: app
    image: busybox:1.28
    command: ["sh", "-c", "mkdir -p /var/log/app && while true; do echo \"$(date) INFO application running\" >> /var/log/app/app.log; sleep 5; done"]
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app

  - name: log-forwarder
    image: busybox:1.28
    command: ["sh", "-c", "tail -F /var/log/app/app.log"]
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app
```

```bash
kubectl apply -f app-with-logs.yaml

# View the application logs via the sidecar
kubectl logs app-with-logs -c log-forwarder --follow
```

> **Key Concept:** This is the **sidecar logging pattern**. The main container writes logs to a shared `emptyDir` volume. The sidecar container mounts the same volume and uses `tail -F` to stream the log file to its own stdout, making it accessible via `kubectl logs`. This is the standard Kubernetes pattern when an application cannot write directly to stdout/stderr.

</details>

---

## 📌 Quick Reference

| Concept                              | Description                                              |
|--------------------------------------|----------------------------------------------------------|
| `kubectl logs <pod>`                 | Fetch stdout/stderr logs from a pod                      |
| `--tail=N`                           | Show only the last N lines                               |
| `--follow` / `-f`                    | Stream logs in real time                                 |
| `--previous` / `-p`                  | Fetch logs from the previously crashed container         |
| `-c <container>`                     | Select a specific container in a multi-container pod     |
| `-l <selector>`                      | Fetch logs from all pods matching a label                |
| `--prefix`                           | Prefix each log line with the pod name (use with `-l`)   |
| `kubectl top nodes`                  | Show CPU/memory usage per node (requires Metrics Server) |
| `kubectl top pods`                   | Show CPU/memory usage per pod (requires Metrics Server)  |
| `--sort-by=cpu` / `--sort-by=memory` | Sort `kubectl top` output                                |

### Useful Commands

```bash
# Logs — basic
kubectl logs <pod> -n <namespace>

# Logs — last N lines, streamed
kubectl logs <pod> --tail=50 --follow

# Logs — specific container
kubectl logs <pod> -c <container>

# Logs — previous crashed instance
kubectl logs <pod> --previous

# Logs — all pods matching a label, with pod-name prefix
kubectl logs -l app=<label> --prefix --follow

# Save logs to file
kubectl logs <pod> --previous > /path/to/file.log

# Resource usage — nodes
kubectl top nodes
kubectl top nodes --sort-by=memory
kubectl top nodes --sort-by=cpu

# Resource usage — pods
kubectl top pods -n <namespace>
kubectl top pods -n <namespace> --sort-by=cpu

# Describe a pod to check exit codes and events
kubectl describe pod <pod> -n <namespace>
```

### Exit Code Cheat Sheet

```
0    → Container exited successfully
1    → Generic application error
137  → OOMKilled — container exceeded its memory limit
143  → Graceful shutdown via SIGTERM
126  → Command found but not executable
127  → Command not found
```

### Related Topics

- 🔗 [DaemonSets](../scheduling/daemonsets.md) — commonly used to deploy log collectors (e.g., Fluentd, Filebeat) on every node
- 🔗 [Resource Requests & Limits](../scheduling/resource-requests-limits-quotas.md) — memory limits directly cause OOMKill (exit code 137)
- 🔗 [Static Pods](../scheduling/static-pods.md) — control plane component logs are accessible via `kubectl logs` on static pods
