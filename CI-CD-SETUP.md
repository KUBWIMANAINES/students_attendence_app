# CI/CD Pipeline Setup Guide

This guide explains how to set up and configure the complete CI/CD pipeline with GitHub Actions, Docker, Kubernetes, and Slack notifications.

## Prerequisites

- GitHub account with repository access
- Docker Hub account
- Kubernetes cluster (EKS, AKS, GKE, or local)
- Slack workspace with webhook capability
- Snyk account for security scanning (optional)

## Step 1: GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### Docker Hub Credentials
- **DOCKER_USERNAME**: Your Docker Hub username
- **DOCKER_PASSWORD**: Your Docker Hub access token

### Kubernetes Configuration
- **KUBE_CONFIG**: Base64 encoded kubeconfig file
  ```bash
  cat ~/.kube/config | base64 | tr -d '\n'
  ```

### Slack Webhook
- **SLACK_WEBHOOK_URL**: Your Slack webhook URL for notifications
  - Go to Slack workspace → Create an app → Enable Incoming Webhooks
  - Create a webhook for your desired channel
  - Copy the webhook URL

### Security Scanning (Optional)
- **SNYK_TOKEN**: Your Snyk API token for security scanning

## Step 2: Kubernetes Setup

### Create the production namespace and deploy
```bash
kubectl apply -f k8s/deployment.yaml
```

### Verify deployment
```bash
kubectl get deployments -n production
kubectl get pods -n production
kubectl get services -n production
```

## Step 3: Update Kubernetes Deployment

Edit `k8s/deployment.yaml` and update:
1. Replace `your-username` in the image field with your Docker Hub username
2. Update database credentials in the Secret section
3. Adjust resource requests/limits as needed
4. Configure health check endpoints in your Express app

Add health check endpoint to your Express app (`index.js`):
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

## Step 4: Create a Health Check Endpoint

Add to your `index.js`:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## Step 5: Set Up Slack Notifications

### Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace
4. Go to "Incoming Webhooks" → Enable it
5. Click "Add New Webhook to Workspace"
6. Select your notification channel
7. Copy the webhook URL to GitHub Secrets

## Pipeline Stages

### 1. **Lint & Code Quality** 
   - Runs ESLint to check code standards
   - Sends Slack notification on success/failure

### 2. **Security Checks**
   - Snyk security scanning for vulnerabilities
   - NPM audit for dependency vulnerabilities
   - Runs in parallel with other jobs

### 3. **Run Tests**
   - Executes Jest test suite
   - Generates coverage reports
   - Uploads to Codecov (optional)

### 4. **Build Docker Image**
   - Builds multi-stage Docker image
   - Pushes to Docker Hub
   - Uses git SHA for tagging

### 5. **Deploy to Kubernetes**
   - Only runs on main branch push
   - Updates deployment with new image
   - Performs rolling update
   - Verifies deployment status

### 6. **Create Release**
   - Generates changelog
   - Creates GitHub release
   - Only on tagged commits

### 7. **Pipeline Summary**
   - Sends final status to Slack
   - Shows all job results

## Local Testing

### Test the pipeline locally (optional)
```bash
# Run linting
npm run lint

# Run tests
npm test

# Build Docker image
docker build -t students-attendance-app:test .

# Run Docker container
docker run -p 3000:3000 students-attendance-app:test
```

## Slack Notification Examples

The pipeline sends notifications at key stages:
- ✅ Linting passed
- ❌ Linting failed
- 🔒 Security checks completed
- 🧪 Tests completed
- 🐳 Docker image built and pushed
- 🚀 Deployment successful/failed
- 📦 Release published
- Pipeline summary with all job statuses

## Troubleshooting

### Deployment fails with "deployment not found"
```bash
# Ensure the deployment exists in Kubernetes
kubectl create deployment attendance-app --image=docker.io/your-username/students-attendance-app:latest -n production
```

### Docker Hub push fails
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets
- Ensure Docker Hub access token is valid
- Check repository is public or you have push access

### Kubernetes deployment fails
- Verify kubeconfig is correctly base64 encoded
- Check RBAC permissions
- Ensure cluster is accessible from GitHub Actions

### Slack notifications not working
- Verify webhook URL is correct
- Check channel is specified in webhook
- Ensure webhook URL is stored in `SLACK_WEBHOOK_URL` secret

## Environment Variables

### Development
```
NODE_ENV=development
PORT=3000
```

### Production (Kubernetes)
- Set in `k8s/deployment.yaml` ConfigMap
- Sensitive data in Secrets (not in git)

## Security Best Practices

1. ✅ Non-root user in Docker container
2. ✅ Read-only root filesystem in Kubernetes
3. ✅ Resource limits and requests set
4. ✅ Liveness and readiness probes configured
5. ✅ Pod Disruption Budget for high availability
6. ✅ RBAC configured for service account
7. ✅ Security scanning with Snyk
8. ✅ Dependency vulnerability checking

## Monitoring & Logs

### View deployment logs
```bash
kubectl logs -n production -l app=attendance-app --tail=100 -f
```

### View GitHub Actions logs
- Go to repository → Actions → select workflow run → view logs

### View deployment status
```bash
kubectl rollout status deployment/attendance-app -n production
kubectl describe deployment attendance-app -n production
```

## Next Steps

1. Customize Slack channel in webhook
2. Set up monitoring (Prometheus/Grafana)
3. Configure auto-scaling thresholds
4. Add staging environment
5. Set up database backups
6. Configure ingress for external access
7. Add distributed tracing (Jaeger)

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Hub Integration](https://docs.docker.com/docker-hub/)
- [Kubernetes Deployment Guide](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Slack API](https://api.slack.com/)
- [ESLint Configuration](https://eslint.org/docs/rules/)
