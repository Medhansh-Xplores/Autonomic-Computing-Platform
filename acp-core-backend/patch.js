const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/services/terraform.service.js');
let content = fs.readFileSync(file, 'utf8');

// 1. runTerraformDeployment
content = content.replace(/child\.on\("close", async \(code\) => {[\s\S]*?logs\.push\(code === 0 \? "INFRA_CREATED" : "INFRA_FAILED"\);\n\n  }\);/g, `child.on("close", async (code) => {
    const metadataPath = path.join(terraformDir, "metadata.json");
    let nextMetadata = null;
    if (fs.existsSync(metadataPath)) {
      nextMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    }

    if (code === 0) {
      if (nextMetadata) {
        nextMetadata.status = "Active";
        fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
        await saveInfraMetadata(nextMetadata);
      }
      logs.push("INFRA_CREATED");
    } else {
      logs.push("INFRA_FAILED");
      logs.push("ROLLING_BACK...");
      console.log(\`Terraform VPC deployment failed. Running terraform destroy...\`);
      const destroyChild = exec("terraform destroy -auto-approve", {
        cwd: terraformDir,
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          AWS_SESSION_TOKEN: credentials.sessionToken,
          AWS_DEFAULT_REGION: data.region
        }
      });
      destroyChild.stdout.on("data", d => { logs.push(d.toString()); console.log(d.toString()); });
      destroyChild.stderr.on("data", d => { logs.push(d.toString()); console.error(d.toString()); });
      destroyChild.on("close", async (destroyCode) => {
        logs.push("ROLLBACK_COMPLETE");
        if (nextMetadata) {
          nextMetadata.status = "Failed";
          fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
          await saveInfraMetadata(nextMetadata);
        }
      });
    }
  });`);

// 2. runEcsClusterDeployment
content = content.replace(/child\.on\("close", async \(code\) => {[\s\S]*?logs\.push\(code === 0 \? "INFRA_CREATED" : "INFRA_FAILED"\);\n  }\);\n\n};\n\nexports\.deployAwsRds =/g, `child.on("close", async (code) => {
    const metadataPath = path.join(deploymentPath, "metadata.json");
    let nextMetadata = null;
    if (fs.existsSync(metadataPath)) {
      nextMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    }

    if (code === 0) {
      if (nextMetadata) {
        nextMetadata.status = "Active";
        fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
        await saveInfraMetadata(nextMetadata);
      }
      logs.push("INFRA_CREATED");
    } else {
      logs.push("INFRA_FAILED");
      logs.push("ROLLING_BACK...");
      console.log(\`Terraform ECS Cluster deployment failed. Running terraform destroy...\`);
      const destroyChild = exec("terraform destroy -auto-approve", {
        cwd: deploymentPath,
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          AWS_SESSION_TOKEN: credentials.sessionToken,
          AWS_DEFAULT_REGION: data.region
        }
      });
      destroyChild.stdout.on("data", d => { logs.push(d.toString()); console.log(d.toString()); });
      destroyChild.stderr.on("data", d => { logs.push(d.toString()); console.error(d.toString()); });
      destroyChild.on("close", async (destroyCode) => {
        logs.push("ROLLBACK_COMPLETE");
        if (nextMetadata) {
          nextMetadata.status = "Failed";
          fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
          await saveInfraMetadata(nextMetadata);
        }
      });
    }
  });
};

exports.deployAwsRds =`);

// 3. runRdsDeployment
content = content.replace(/child\.on\("close", async \(code\) => {[\s\S]*?logs\.push\(code === 0 \? "INFRA_CREATED" : "INFRA_FAILED"\);\n  }\);\n};\n\nexports\.createECSApp =/g, `child.on("close", async (code) => {
    const metadataPath = path.join(deploymentPath, "metadata.json");
    let nextMetadata = null;
    if (fs.existsSync(metadataPath)) {
      nextMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    }

    if (code === 0) {
      if (nextMetadata) {
        nextMetadata.status = "Active";
        try {
          const { execSync } = require("child_process");
          const outputs = JSON.parse(
            execSync("terraform output -json", { cwd: deploymentPath }).toString()
          );
          if (outputs.rds_endpoint?.value) {
            const [host, port] = outputs.rds_endpoint.value.split(":");
            nextMetadata.rdsEndpoint = host;
            const enginePortMap = { mysql: '3306', postgres: '5432', aurora: '3306' };
            const engineKey = (data.dbEngine || '').toLowerCase();
            const matchedKey = Object.keys(enginePortMap).find(k => engineKey.includes(k));
            nextMetadata.rdsPort = port || enginePortMap[matchedKey] || '3306';
          }
        } catch (e) {
          console.error("Could not capture RDS endpoint:", e.message);
        }
        fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
        await saveInfraMetadata(nextMetadata);
      }
      logs.push("INFRA_CREATED");
    } else {
      logs.push("INFRA_FAILED");
      logs.push("ROLLING_BACK...");
      console.log(\`Terraform RDS deployment failed. Running terraform destroy...\`);
      
      const destroyChild = exec("terraform destroy -auto-approve", {
        cwd: deploymentPath,
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          AWS_SESSION_TOKEN: credentials.sessionToken,
          AWS_DEFAULT_REGION: data.region
        }
      });

      destroyChild.stdout.on("data", d => { logs.push(d.toString()); console.log(d.toString()); });
      destroyChild.stderr.on("data", d => { logs.push(d.toString()); console.error(d.toString()); });

      destroyChild.on("close", async (destroyCode) => {
        logs.push("ROLLBACK_COMPLETE");
        if (nextMetadata) {
          nextMetadata.status = "Failed";
          fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
          await saveInfraMetadata(nextMetadata);
        }
      });
    }
  });
};

exports.createECSApp =`);

// 4. runEcsTerraformDeployment
content = content.replace(/\/\/ ❌ Terraform failed\s+if \(code !== 0\) {[\s\S]*?return reject\(new Error\("ecs-app terraform failed"\)\);\n        }\);\n        return;\n      }/g, `// ❌ Terraform failed
      if (code !== 0) {
        logs.push("INFRA_FAILED");
        logs.push("ROLLING_BACK...");
        const destroyChild = exec("terraform destroy -auto-approve", {
          cwd: deploymentPath,
          env: {
            ...process.env,
            AWS_ACCESS_KEY_ID: credentials.accessKeyId,
            AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
            AWS_SESSION_TOKEN: credentials.sessionToken,
            AWS_DEFAULT_REGION: data.region
          }
        });
        destroyChild.stdout.on("data", d => logs.push(d.toString()));
        destroyChild.stderr.on("data", d => logs.push(d.toString()));
        destroyChild.on("close", () => {
          logs.push("ROLLBACK_COMPLETE");
          try { fs.rmSync(deploymentPath, { recursive: true, force: true }); } catch(e) {}
          return reject(new Error("ecs-app terraform failed"));
        });
        return;
      }`);

// 5. runAzureTerraformDeployment
content = content.replace(/if \(code === 0\) {\s*try {\s*fs\.rmSync\(deploymentPath, { recursive: true, force: true }\);\s*} catch \(e\) {\s*console\.error\("Failed to delete deployment directory:", e\);\s*}\s*resolve\(\);\s*} else {\s*reject\(new Error\(\`Terraform \${typeName} deployment failed with code \${code}\`\)\);\s*}/g, `if (code === 0) {
        try {
          fs.rmSync(deploymentPath, { recursive: true, force: true });
        } catch (e) {
          console.error("Failed to delete deployment directory:", e);
        }
        resolve();
      } else {
        logs.push("ROLLING_BACK...");
        const destroyChild = exec("terraform destroy -auto-approve", { cwd: deploymentPath, env: { ...process.env, ...azureEnv(creds) } });
        destroyChild.stdout.on("data", d => logs.push(d.toString()));
        destroyChild.stderr.on("data", d => logs.push(d.toString()));
        destroyChild.on("close", () => {
          logs.push("ROLLBACK_COMPLETE");
          try { fs.rmSync(deploymentPath, { recursive: true, force: true }); } catch (e) {}
          reject(new Error(\`Terraform \${typeName} deployment failed with code \${code}\`));
        });
      }`);

fs.writeFileSync(file, content);
console.log('Patch complete.');
