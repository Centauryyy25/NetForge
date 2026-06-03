module.exports = {
  apps: [
    {
      name: "si-ybynet-web",
      script: "node_modules/.bin/next",
      args: "start -p 8080",
      cwd: "/var/www/si-ybynet",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
    {
      name: "si-ybynet-worker",
      script: "dist/workers/index.js",
      cwd: "/var/www/si-ybynet",
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
