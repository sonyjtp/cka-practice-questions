# 🔀 Pod Affinity & Anti-affinity

> **CKA Exam Domain:** Scheduling  
> **Topic:** Pod affinity, pod anti-affinity, topology spread constraints  
> **Total Questions:** 7

---

## 🟢 Easy Questions

---

### Question 1 — Create a pod with required pod affinity
> ⏱️ **Recommended Time: 5 minutes**

Schedule a pod on the same node as another pod using pod affinity.

<details>
<summary>✅ Answer</summary>

```bash
# First, create a pod with specific label
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: anchor-pod
  labels:
    tier: frontend
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF

# Wait for anchor pod to be running
kubectl get pod anchor-pod

# Now create a pod with affinity to co-locate with anchor-pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: affinity-pod
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: tier
            operator: In
            values:
            - frontend
        topologyKey: kubernetes.io/hostname
  
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF

# Verify both pods are on same node
kubectl get pods -o wide
# anchor-pod      node1   ...
# affinity-pod    node1   ...  (same node!)

# Explanation:
# podAffinity: "I want to be near this pod"
# labelSelector: Match pods with label tier=frontend
# topologyKey: kubernetes.io/hostname = same host/node
# requiredDuringScheduling... = MUST be on same node
```

Pod affinity types:

| Type | Behavior | Trigger |
|------|----------|---------|
| **requiredDuringScheduling...** | Pod MUST co-locate | Pod fails to schedule if no match |
| **preferredDuringScheduling...** | Pod SHOULD co-locate | Pod still schedules elsewhere if no match |

Topology keys (topologyKey):

| Key | Level | Scope |
|-----|-------|-------|
| `kubernetes.io/hostname` | Node | Pod on same physical node |
| `topology.kubernetes.io/zone` | Zone | Pod in same availability zone |
| `topology.kubernetes.io/region` | Region | Pod in same cloud region |
| `custom-label` | Custom | Any custom node label |

> **Key Concept:** Pod affinity (requiredDuringScheduling) forces co-location; affinity (preferredDuringScheduling) prefers co-location but allows fallback. Always specify topologyKey to define what "co-located" means.

</details>

---

### Question 2 — Create a pod with required pod anti-affinity
> ⏱️ **Recommended Time: 5 minutes**

Spread pods across different nodes using pod anti-affinity.

<details>
<summary>✅ Answer</summary>

```bash
# Create a deployment with pod anti-affinity
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: spread-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: spread
  template:
    metadata:
      labels:
        app: spread
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - spread
            topologyKey: kubernetes.io/hostname
      
      containers:
      - name: app
        image: busybox:1.28
        command: ["sleep", "3600"]
EOF

# Verify pods are on different nodes
kubectl get pods -o wide -l app=spread
# spread-deploy-xxxxx   node1   ...
# spread-deploy-yyyyy   node2   ...
# spread-deploy-zzzzz   node3   ...  (each on different node)

# What happens if we have only 2 nodes but need 3 replicas?
# Pods on nodes: 1 pending (can't schedule - requires 3 different nodes)
kubectl get pods -l app=spread
# READY   STATUS              AGE
# 1/1     Running             1m
# 1/1     Running             1m
# 0/1     Pending             1m   (can't schedule on 3rd unique node)

# Events show:
# Warning  FailedScheduling  pod didn't match pod anti-affinity rules
```

Pod anti-affinity scenarios:

| Scenario | Anti-affinity Type | Effect |
|----------|------------------|--------|
| **High availability** | required | Pods spread across nodes, fails if not possible |
| **Resource efficiency** | preferred | Pods spread when possible, co-locate if needed |
| **Redundancy** | required | Ensures replicas on different nodes |

> **Key Concept:** Pod anti-affinity (required) prevents replicas from scheduling on the same node. Use for HA. Pod anti-affinity (preferred) spreads pods when possible but allows co-location if necessary for scheduling.

</details>

---


## 🟡 Medium Questions

---

### Question 3 — Combine affinity with node affinity
> ⏱️ **Recommended Time: 5 minutes**

Use both pod affinity and node affinity together for advanced scheduling.

<details>
<summary>✅ Answer</summary>

```bash
# Label some nodes
kubectl label nodes node1 workload-type=db
kubectl label nodes node2 workload-type=web

# Create a database pod (on db nodes)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
  labels:
    tier: database
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: workload-type
            operator: In
            values:
            - db
  containers:
  - name: db
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF

# Verify db-pod is on node1 (db node)
kubectl get pod db-pod -o wide
# db-pod   node1   ...

# Create an app pod that must be on same node as db (pod affinity + node affinity)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  affinity:
    # Pod affinity: must be on same node as database
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: tier
            operator: In
            values:
            - database
        topologyKey: kubernetes.io/hostname
    
    # Node affinity: can only run on web nodes
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: workload-type
            operator: In
            values:
            - web
  
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF

# Result: app-pod stays Pending
# Reason: Conflicting requirements
# - Pod affinity wants: node1 (where db-pod is)
# - Node affinity wants: node2 (where workload-type=web)
# No solution exists!

kubectl get pod app-pod
# STATUS: Pending

kubectl describe pod app-pod | grep -A 5 "Warning"
# Warning  FailedScheduling  0/3 nodes available, Conflicting affinity
```

Combining affinity types:

```yaml
affinity:
  nodeAffinity:
    # WHERE: required node affinity
  podAffinity:
    # WITH: required pod affinity
  podAntiAffinity:
    # WITHOUT: pods I don't want near me

# Evaluation order (ALL must be satisfied):
# 1. Node affinity (WHERE can I run)
# 2. Pod affinity (WHO should I be with)
# 3. Pod anti-affinity (WHO should I avoid)
```

> **Key Concept:** When combining affinities, all constraints must be satisfiable. Conflicting constraints (e.g., affinity requiring pod on node1, node affinity excluding node1) cause pending pods.

</details>

---

### Question 4 — Use preferred pod affinity for flexibility
> ⏱️ **Recommended Time: 6 minutes**

Schedule pods with soft affinity preferences that allow fallback.

<details>
<summary>✅ Answer</summary>

```bash
# Create pods with preferred (soft) affinity
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: primary-pod
  labels:
    role: primary
spec:
  containers:
  - name: app
    image: busybox:1.28
    command: ["sleep", "3600"]
EOF

# Create deployment that prefers to run with primary-pod
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: follower-deploy
spec:
  replicas: 5
  selector:
    matchLabels:
      app: follower
  template:
    metadata:
      labels:
        app: follower
    spec:
      affinity:
        podAffinity:
          # Soft affinity: prefer to be with primary-pod
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: role
                  operator: In
                  values:
                  - primary
              topologyKey: kubernetes.io/hostname
      
      containers:
      - name: app
        image: busybox:1.28
        command: ["sleep", "3600"]
EOF

# Result: follower pods try to co-locate with primary
# But if there's no space, they schedule elsewhere
kubectl get pods -o wide
# primary-pod     node1   ...
# follower-deploy-xxxxx   node1   ... (co-located, good!)
# follower-deploy-yyyyy   node1   ... (more co-located)
# follower-deploy-zzzzz   node2   ... (overflow to other node, OK!)
```

Preferred vs Required affinity:

| Type | Requirement | Fallback | Use Case |
|------|-------------|----------|----------|
| **required** | MUST satisfy | Pod stays Pending | Critical co-location |
| **preferred** | SHOULD satisfy | Pod schedules elsewhere | Nice-to-have co-location |

Affinity weight:

```yaml
preferredDuringSchedulingIgnoredDuringExecution:
- weight: 100    # Priority (1-100, higher = more preferred)
  podAffinityTerm: ...

# Scheduler uses weight for tie-breaking:
# - Pod with weight 100 affinity = ranked higher
# - Pod with weight 50 affinity = ranked lower
# - Multiple affinity preferences are summed
```

> **Key Concept:** Preferred affinity enables best-effort scheduling. Pods get weight scores; scheduler picks nodes with highest total weight. Fallback ensures pods always schedule.

</details>

---

### Question 5 — Topology spread with multiple zones
> ⏱️ **Recommended Time: 7 minutes**

Distribute pods evenly across availability zones using topology spread constraints.

<details>
<summary>✅ Answer</summary>

```bash
# Label nodes with zone information (simulating multi-zone cluster)
kubectl label nodes node1 topology.kubernetes.io/zone=zone-a
kubectl label nodes node2 topology.kubernetes.io/zone=zone-b
kubectl label nodes node3 topology.kubernetes.io/zone=zone-c

# Verify labels
kubectl get nodes --show-labels | grep topology

# Create deployment with topology spread
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zone-spread-deploy
spec:
  replicas: 6
  selector:
    matchLabels:
      app: zone-spread
  template:
    metadata:
      labels:
        app: zone-spread
    spec:
      topologySpreadConstraints:
      - maxSkew: 1  # Max difference in pod count per zone
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule  # Fail rather than violate
        labelSelector:
          matchLabels:
            app: zone-spread
      
      containers:
      - name: app
        image: busybox:1.28
        command: ["sleep", "3600"]
EOF

# Result: pods evenly distributed
kubectl get pods -o wide -l app=zone-spread
# zone-spread-deploy-xxxxx   node1 (zone-a)   ...
# zone-spread-deploy-yyyyy   node2 (zone-b)   ...
# zone-spread-deploy-zzzzz   node3 (zone-c)   ...
# zone-spread-deploy-aaaaa   node1 (zone-a)   ... (2 in zone-a)
# zone-spread-deploy-bbbbb   node2 (zone-b)   ... (2 in zone-b)
# zone-spread-deploy-ccccc   node3 (zone-c)   ... (2 in zone-c)

# Verify distribution (maxSkew=1 means each zone has 2 pods, difference is 0)
kubectl get pods -l app=zone-spread -o wide | grep zone-a | wc -l  # 2
kubectl get pods -l app=zone-spread -o wide | grep zone-b | wc -l  # 2
kubectl get pods -l app=zone-spread -o wide | grep zone-c | wc -l  # 2
```

Topology spread constraints:

```yaml
topologySpreadConstraints:
- maxSkew: 1                          # Max difference in pod count
  topologyKey: topology.kubernetes.io/zone  # Spread across zones
  whenUnsatisfiable: DoNotSchedule    # Fail if can't satisfy
  labelSelector:
    matchLabels:
      app: my-app

# whenUnsatisfiable options:
# - DoNotSchedule: Pod stays pending if constraint violated
# - ScheduleAnyway: Pod schedules anyway (constraint violated)
```

Example: 3 zones, 3 replicas

```
maxSkew=1:
Zone-A: 1 pod  ✓
Zone-B: 1 pod  ✓
Zone-C: 1 pod  ✓
Difference: 0 (all zones have 1 pod, satisfied)

maxSkew=2:
Zone-A: 2 pods ✓
Zone-B: 1 pod  ✓
Zone-C: 0 pods ✓
Difference: 2 (satisfied)

maxSkew=1 with 4 replicas (3 zones):
Zone-A: 2 pods ✓
Zone-B: 1 pod  ✓
Zone-C: 1 pod  ✓
Difference: 1 (satisfied)
```

> **Key Concept:** Topology spread constraints ensure even distribution across topology domains (zones, regions). Unlike affinity, spread constraints don't prevent co-location; they minimize imbalance.

</details>

---


## 🔴 Hard Questions

---

### Question 6 — Multi-level topology spread (node + zone)
> ⏱️ **Recommended Time: 8 minutes**

Use multiple topology spread constraints to distribute across both nodes and zones.

<details>
<summary>✅ Answer</summary>

```bash
# Setup: 3 zones, 2 nodes per zone = 6 nodes total
# Label nodes with zone and rack info
for i in {1..2}; do
  kubectl label nodes node$i topology.kubernetes.io/zone=zone-a topology.kubernetes.io/rack=rack-1
done
for i in {3..4}; do
  kubectl label nodes node$i topology.kubernetes.io/zone=zone-b topology.kubernetes.io/rack=rack-2
done
for i in {5..6}; do
  kubectl label nodes node$i topology.kubernetes.io/zone=zone-c topology.kubernetes.io/rack=rack-3
done

# Create deployment with multi-level spread
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-spread-deploy
spec:
  replicas: 6
  selector:
    matchLabels:
      app: multi-spread
  template:
    metadata:
      labels:
        app: multi-spread
    spec:
      topologySpreadConstraints:
      # First constraint: spread across zones
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: multi-spread
      
      # Second constraint: spread across racks within zones
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/rack
        whenUnsatisfiable: DoNotSchedule
        labelSelector:
          matchLabels:
            app: multi-spread
      
      containers:
      - name: app
        image: busybox:1.28
        command: ["sleep", "3600"]
EOF

# Result: pods distributed hierarchically
# Zone constraint distributes across zones
# Rack constraint distributes across racks
kubectl get pods -o wide -l app=multi-spread
# Pod 1 on node1 (zone-a, rack-1)
# Pod 2 on node3 (zone-b, rack-2)  <- different zone+rack
# Pod 3 on node5 (zone-c, rack-3)  <- different zone+rack
# Pod 4 on node2 (zone-a, rack-1)  <- spreads within zone-a
# Pod 5 on node4 (zone-b, rack-2)  <- spreads within zone-b
# Pod 6 on node6 (zone-c, rack-3)  <- spreads within zone-c
```

Multi-constraint strategy:

```
Constraint Priority (evaluated in order):
1. First constraint (zone) - must be satisfied
2. Second constraint (rack) - must be satisfied
3. Both must be satisfied simultaneously

For 6 replicas, 3 zones, 2 racks per zone:
- Zone spread (maxSkew=1): 2 pods per zone
- Rack spread (maxSkew=1): 1 pod per rack (within each zone)
- Result: 1 pod per node (perfect distribution)
```

What happens with conflicting constraints:

```bash
# Conflicting example: too strict
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: impossible-spread
spec:
  replicas: 10
  selector:
    matchLabels:
      app: impossible
  template:
    metadata:
      labels:
        app: impossible
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname  # Each pod on different node
        whenUnsatisfiable: DoNotSchedule
      
      containers:
      - name: app
        image: busybox:1.28
        command: ["sleep", "3600"]
EOF

# Result: only 6 pods schedule (one per node)
# 4 pods stay pending (not enough nodes for maxSkew=1)
kubectl get pods -l app=impossible
# READY   STATUS
# 1/1     Running          (x6 pods, one per node)
# 0/1     Pending          (x4 pods, can't schedule)
```

> **Key Concept:** Multiple topology spread constraints work together (AND logic). All must be satisfied. Use hierarchy (zone before rack, zone before node) for intentional distribution patterns.

</details>

---

