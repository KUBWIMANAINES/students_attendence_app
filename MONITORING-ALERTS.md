# Monitoring & Alerts Guide

## GitHub Actions Status Badges

Add these badges to your README.md to display pipeline status:

```markdown
![CI/CD Pipeline](https://github.com/KUBWIMANAINES/students_attendence_app/actions/workflows/ci-cd-pipeline.yml/badge.svg)
[![codecov](https://codecov.io/gh/KUBWIMANAINES/students_attendence_app/branch/main/graph/badge.svg)](https://codecov.io/gh/KUBWIMANAINES/students_attendence_app)
```

## Real-time Monitoring

### GitHub Actions Dashboard
Visit: `https://github.com/KUBWIMANAINES/students_attendence_app/actions`
- View all workflow runs
- Check individual job logs
- See pipeline statistics
- Analyze trends

### Kubernetes Monitoring

#### Basic Health Check
```bash
# Check all resources in production namespace
kubectl get all -n production

# Check pod status
kubectl get pods -n production

# Check recent events
kubectl get events -n production --sort-by='.lastTimestamp'
```

#### Detailed Monitoring
```bash
# Pod logs
kubectl logs -n production -l app=attendance-app --tail=50 -f

# Deployment status
kubectl rollout status deployment/attendance-app -n production

# Describe deployment
kubectl describe deployment attendance-app -n production

# Check resource usage
kubectl top pods -n production
kubectl top nodes
```

#### Pod Details
```bash
# Get pod info
kubectl get pods -n production -o wide

# Exec into pod for debugging
kubectl exec -it <pod-name> -n production -- sh

# Check readiness probes
kubectl get pods -n production -o=jsonpath='{.items[*].status.conditions[?(@.type=="Ready")]}'
```

## Slack Notifications Setup

### Creating a Slack Channel for Alerts

1. In your Slack workspace, click the + icon next to Channels
2. Create a new channel: `#deployments` or `#cicd-alerts`
3. Add the channel name to your webhook

### Customizing Notifications

Edit `.github/workflows/ci-cd-pipeline.yml` to customize Slack messages:

```yaml
- name: 'Custom Slack Notification'
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Custom message here"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Setting Up Advanced Monitoring

### 1. Prometheus for Metrics
```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring

# Access Prometheus UI
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Visit: http://localhost:9090
```

### 2. Grafana for Dashboards
```bash
# Grafana is installed with Prometheus stack
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Visit: http://localhost:3000
# Default: admin/prom-operator
```

### 3. Alert Manager
```bash
# Check AlertManager status
kubectl get alertmanager -n monitoring
kubectl describe alertmanager -n monitoring
```

## Health Check Verification

### Verify Health Endpoints
```bash
# Port forward to the service
kubectl port-forward -n production svc/attendance-app-service 8080:80

# In another terminal, test health endpoint
curl http://localhost:8080/health
# Expected output: {"status":"healthy","timestamp":"2024-12-09T...","uptime":...}
```

### Check Liveness Probe
```bash
# View probe configuration
kubectl get pod -n production -o jsonpath='{.items[0].spec.containers[0].livenessProbe}' | jq
```

## Troubleshooting Failed Deployments

### Check Why Deployment Failed
```bash
# Get deployment status
kubectl get deployment attendance-app -n production -o yaml | grep -A 10 "status:"

# Check recent events
kubectl describe deployment attendance-app -n production | grep -A 20 "Events:"

# View pod events
kubectl describe pod <pod-name> -n production
```

### Common Issues and Solutions

#### ImagePullBackOff
```bash
# Issue: Can't pull Docker image
# Solution: Verify Docker credentials and image exists

# Check if image exists in Docker Hub
docker pull docker.io/your-username/students-attendance-app:latest

# Verify Docker secret (if private registry)
kubectl get secrets -n production
```

#### CrashLoopBackOff
```bash
# Issue: Pod keeps crashing
# Solution: Check logs for errors

kubectl logs <pod-name> -n production
kubectl logs <pod-name> -n production --previous  # Previous crash logs
```

#### Pending Pods
```bash
# Issue: Pod stuck in pending state
# Solution: Check resource availability

# Check node resources
kubectl top nodes
kubectl describe nodes

# Check resource requests
kubectl describe pod <pod-name> -n production | grep "Requests"
```

## Performance Monitoring

### CPU and Memory Usage
```bash
# Real-time usage
kubectl top pods -n production --containers

# Pod resource requests vs usage
kubectl get pods -n production -o json | jq '.items[].spec.containers[] | {name, resources}'
```

### Horizontal Pod Autoscaler Status
```bash
# Check HPA status
kubectl get hpa -n production

# Detailed HPA info
kubectl describe hpa attendance-app-hpa -n production

# Watch HPA metrics
kubectl get hpa -n production --watch
```

## Security Monitoring

### Check Pod Security
```bash
# Verify non-root user
kubectl get pods -n production -o jsonpath='{.items[].spec.securityContext}'

# Check for privilege escalation
kubectl get pods -n production -o jsonpath='{.items[].spec.containers[].securityContext.allowPrivilegeEscalation}'
```

### RBAC Verification
```bash
# Check service account permissions
kubectl get rolebinding -n production

# Check role permissions
kubectl describe role attendance-app-role -n production
```

## Log Aggregation

### View Combined Logs
```bash
# All pod logs with labels
kubectl logs -n production -l app=attendance-app --all-containers=true --timestamps=true -f

# Specific pod logs
kubectl logs -n production deployment/attendance-app --all-containers=true
```

### Set Up Log Forwarding
```bash
# If using ELK stack
helm install elasticsearch elastic/elasticsearch
helm install kibana elastic/kibana
helm install filebeat elastic/filebeat

# Or use CloudWatch (AWS)
# Or use Stackdriver (GCP)
```

## Alerting Rules

### Create AlertManager Config
```yaml
# Save as alertmanager-config.yaml
groups:
  - name: attendance-app
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 10m
        annotations:
          summary: "High error rate detected"
      
      - alert: DeploymentReplicasMismatch
        expr: kube_deployment_spec_replicas != kube_deployment_status_replicas_available
        for: 15m
        annotations:
          summary: "Deployment replicas mismatch"
```

## Dashboard Examples

### Kubernetes Dashboard
```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Create dashboard proxy
kubectl proxy
# Visit: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

## Automated Backup & Recovery

### Backup Deployment Config
```bash
# Export current deployment
kubectl get deployment attendance-app -n production -o yaml > deployment-backup.yaml

# Export all resources
kubectl get all -n production -o yaml > production-backup.yaml
```

### Quick Recovery
```bash
# Reapply deployment
kubectl apply -f deployment-backup.yaml

# Rollback to previous version
kubectl rollout undo deployment/attendance-app -n production

# Check rollout history
kubectl rollout history deployment/attendance-app -n production
```

## Continuous Improvement

### Collect Metrics
- Monitor deployment frequency
- Track mean time to recovery (MTTR)
- Measure error rates
- Check uptime percentage
- Analyze resource utilization

### Review Pipeline Performance
```bash
# GitHub Actions API
curl https://api.github.com/repos/KUBWIMANAINES/students_attendence_app/actions/runs
```

## External Monitoring Tools

- **Datadog**: Full-stack monitoring
- **New Relic**: Application performance
- **Sentry**: Error tracking
- **Splunk**: Log analysis
- **PagerDuty**: Incident management
- **Opsgenie**: Alert management

## Checklist for Monitoring

- [ ] Set up Slack channel for alerts
- [ ] Configure health check endpoints
- [ ] Install Prometheus/Grafana (optional)
- [ ] Verify pod logs are flowing
- [ ] Test pod autoscaling
- [ ] Monitor resource usage
- [ ] Review GitHub Actions logs
- [ ] Set up backup procedures
- [ ] Create runbooks for common issues
- [ ] Schedule regular health checks
