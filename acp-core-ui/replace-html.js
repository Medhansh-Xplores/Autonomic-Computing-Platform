const fs = require('fs');

let html = fs.readFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.html', 'utf8');

// Replace all occurrences
html = html.replace(/isAcpAzureContainerAppsFlow\(\)/g, '(isAcpAzureContainerAppsFlow() || isAcpAzureAppServiceFlow())');

// Rename the block header to be generic
html = html.replace('Azure Container Apps Configuration', 'Azure Deployment Configuration');

fs.writeFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.html', html);
