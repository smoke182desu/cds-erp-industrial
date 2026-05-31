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
    },
    error_file: "/var/log/cds-erp-error.log",
    out_file: "/var/log/cds-erp-out.log",
    time: true,
  }]
};
