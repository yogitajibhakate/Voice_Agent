const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '../..');
const uiDir = path.resolve(__dirname, '..');

// Track processes to know if we need to clean them up
let backendStarted = false;
let tunnelProcess = null;
let proxyProcess = null;

function cleanup() {
  if (proxyProcess) {
    try {
      proxyProcess.kill();
    } catch (e) {}
    proxyProcess = null;
  }

  if (tunnelProcess) {
    console.log('\nStopping Serveo SSH tunnel...');
    try {
      // Try to kill the process group
      process.kill(-tunnelProcess.pid);
    } catch (e) {
      try {
        tunnelProcess.kill();
      } catch (err) {}
    }
    tunnelProcess = null;
    console.log('Serveo SSH tunnel stopped.');
  }

  if (backendStarted) {
    console.log('\nStopping backend services...');
    try {
      execSync('bash scripts/stop_services.sh', { cwd: rootDir, stdio: 'inherit' });
      backendStarted = false;
      console.log('Backend services stopped.');
    } catch (e) {
      console.error('Error stopping backend services:', e.message);
    }
  }
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    console.log('Starting Serveo SSH tunnel on port 8000...');
    
    // Spawn ssh tunnel in a new process group so we can clean it up easily
    tunnelProcess = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=60',
      '-R', '80:localhost:8000',
      'serveo.net'
    ], {
      cwd: rootDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resolved = false;
    let errorOutput = '';

    // Listen to stdout to get the forwarding URL
    tunnelProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Tunnel] ${output.trim()}`);
      
      const match = output.match(/Forwarding HTTP traffic from (https:\/\/[a-zA-Z0-9.-]+serveousercontent\.com)/);
      if (match) {
        const tunnelUrl = match[1];
        console.log(`\n[Tunnel] Active Tunnel URL: ${tunnelUrl}\n`);
        resolved = true;
        resolve(tunnelUrl);
      }
    });

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Tunnel Error] ${output.trim()}`);
      errorOutput += output;
    });

    tunnelProcess.on('close', (code) => {
      if (!resolved) {
        reject(new Error(`Tunnel exited with code ${code}. Error: ${errorOutput}`));
      }
    });

    // Timeout if tunnel doesn't resolve in 15 seconds
    setTimeout(() => {
      if (!resolved) {
        reject(new Error('Tunnel startup timed out after 15 seconds.'));
      }
    }, 15000);
  });
}

function updateEnvFile(tunnelUrl) {
  const envPath = path.resolve(rootDir, 'api/.env');
  if (!fs.existsSync(envPath)) {
    console.error(`Error: api/.env not found at ${envPath}`);
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('voice.automationlabs.online')) {
    console.log('BACKEND_API_ENDPOINT is configured to voice.automationlabs.online, skipping Serveo overwrite.');
    return;
  }

  const regex = /^BACKEND_API_ENDPOINT=.*$/m;

  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `BACKEND_API_ENDPOINT="${tunnelUrl}"`);
  } else {
    envContent += `\nBACKEND_API_ENDPOINT="${tunnelUrl}"\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`Successfully updated BACKEND_API_ENDPOINT to "${tunnelUrl}" in api/.env`);
}

async function main() {
  const skipBackend = process.env.SKIP_BACKEND === 'true';

  if (!skipBackend) {
    // 1) Start the public tunnel first
    try {
      const tunnelUrl = await startTunnel();
      updateEnvFile(tunnelUrl);
    } catch (err) {
      console.error('Failed to start Serveo tunnel:', err.message);
      console.warn('Proceeding without updating BACKEND_API_ENDPOINT. Outbound calls might fail.');
    }

    // 2) Ensure Docker services are up
    console.log('Checking local Docker services...');
    try {
      execSync('docker compose version', { stdio: 'ignore' });
      console.log('Ensuring local Docker services (Postgres, Redis, MinIO) are started...');
      execSync('docker compose -f docker-compose-local.yaml up -d', { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {
      console.warn('Warning: Could not start local Docker services via docker compose. Make sure Docker is running if you need local database/services.');
    }

    // 3) Start backend services
    console.log('Starting backend services...');
    try {
      execSync('bash scripts/start_services_dev.sh', { cwd: rootDir, stdio: 'inherit' });
      backendStarted = true;
      console.log('Backend services started successfully!');
    } catch (e) {
      console.error('Error starting backend services:', e.message);
      console.warn('Proceeding to start Next.js frontend, but backend connection might fail.');
    }
  } else {
    console.log('Skipping backend startup (SKIP_BACKEND=true)');
  }

  console.log('Starting Next.js frontend dev server on port 3001...');
  const nextDevArgs = ['next', 'dev', '--turbopack', '-p', '3001'];
  const extraArgs = process.argv.slice(2);
  if (extraArgs.length > 0) {
    nextDevArgs.push(...extraArgs);
  }

  const nextProcess = spawn('npx', ['cross-env', 'NODE_OPTIONS=--enable-source-maps', ...nextDevArgs], {
    cwd: uiDir,
    stdio: 'inherit',
    shell: true
  });

  console.log('Starting HTTP & WebSocket proxy on port 3000...');
  proxyProcess = spawn('node', [path.resolve(uiDir, 'scripts/proxy.js')], {
    cwd: uiDir,
    stdio: 'inherit',
    shell: true
  });

  // Handle termination signals
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  signals.forEach((sig) => {
    process.on(sig, () => {
      console.log(`\nReceived ${sig}, cleaning up...`);
      cleanup();
      process.exit(0);
    });
  });

  process.on('exit', () => {
    cleanup();
  });

  nextProcess.on('exit', (code) => {
    cleanup();
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Failed to run dev server:', err);
  cleanup();
  process.exit(1);
});

