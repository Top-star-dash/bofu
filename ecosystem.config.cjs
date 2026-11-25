const path = require("node:path");

// pm2 启动配置：RX 服务器上跑 127.0.0.1:3007，由 Apache 反代 bofu.gdruixiang.com
module.exports = {
  apps: [
    {
      name: "bofu",
      cwd: __dirname,
      script: path.join(__dirname, "node_modules/next/dist/bin/next"),
      args: "start --hostname 127.0.0.1 --port 3007",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      out_file: path.join(__dirname, "logs/out.log"),
      error_file: path.join(__dirname, "logs/error.log"),
      time: true,
    },
  ],
};
