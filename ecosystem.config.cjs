module.exports = {
  apps: [
    {
      name: "hill-trade-ledger",
      script: "dist/src/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
