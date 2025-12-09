#!/bin/bash
# Quick setup script for CI/CD pipeline

set -e

echo "🚀 Starting CI/CD Pipeline Setup..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is installed${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}⚠️  kubectl is not installed${NC}"
    echo "Install from: https://kubernetes.io/docs/tasks/tools/"
else
    echo -e "${GREEN}✅ kubectl is installed${NC}"
fi

# Create .env file from example
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file from example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo "   Please update .env with your configuration"
fi

# Test linting
echo -e "${BLUE}🧹 Testing linting...${NC}"
npm run lint
echo -e "${GREEN}✅ Linting passed${NC}"

# Run tests (if available)
if npm test 2>/dev/null; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${BLUE}⚠️  No tests configured or tests failed${NC}"
fi

# Build Docker image
echo -e "${BLUE}🐳 Building Docker image...${NC}"
docker build -t students-attendance-app:local .
echo -e "${GREEN}✅ Docker image built${NC}"

# Test Docker image
echo -e "${BLUE}🧪 Testing Docker image...${NC}"
docker run --rm students-attendance-app:local node --version
echo -e "${GREEN}✅ Docker image test passed${NC}"

# Kubernetes setup (if kubectl is available)
if command -v kubectl &> /dev/null; then
    echo -e "${BLUE}☸️  Setting up Kubernetes manifests...${NC}"
    
    if kubectl cluster-info &> /dev/null; then
        echo "Would you like to deploy to Kubernetes? (y/n)"
        read -r response
        if [[ "$response" == "y" ]]; then
            kubectl apply -f k8s/deployment.yaml
            echo -e "${GREEN}✅ Kubernetes deployment applied${NC}"
            echo ""
            echo "Deployment status:"
            kubectl get deployments -n production
            kubectl get pods -n production
        fi
    else
        echo -e "${BLUE}⚠️  No Kubernetes cluster detected${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup completed!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Update .env with your actual credentials"
echo "2. Set up GitHub repository secrets:"
echo "   - DOCKER_USERNAME"
echo "   - DOCKER_PASSWORD"
echo "   - KUBE_CONFIG (base64 encoded)"
echo "   - SLACK_WEBHOOK_URL"
echo ""
echo "3. Push code to GitHub:"
echo "   git add ."
echo "   git commit -m 'Add CI/CD pipeline'"
echo "   git push origin main"
echo ""
echo "4. Check GitHub Actions for pipeline execution"
echo "5. Monitor Slack for notifications"
echo ""
echo "📚 For more details, see CI-CD-SETUP.md"
