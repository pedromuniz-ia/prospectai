module.exports = {
  apps: [
    {
      name: "prospectai-web",
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "prospectai-worker",
      script: "node_modules/.bin/tsx",
      args: "src/worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
