const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

module.exports = {
  apps: [{
    name: "cds-erp",
    script: "./node_modules/.bin/tsx",
    args: "server.ts",
    cwd: "/var/www/cds-erp",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      GEMINI_API_KEY: env.GEMINI_API_KEY || '',
      GROQ_API_KEY: env.GROQ_API_KEY || '',
      OPENAI_API_KEY: env.OPENAI_API_KEY || '',
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || '',
    },
    error_file: "/var/log/cds-erp-error.log",
    out_file: "/var/log/cds-erp-out.log",
    time: true,
  }]
};
