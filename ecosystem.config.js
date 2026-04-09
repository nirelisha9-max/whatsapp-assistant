module.exports = {
  apps: [
    {
      name: "whatsapp-assistant",
      script: "dist/index.js",
      cwd: __dirname,
      env_file: ".env",
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
    },
  ],
};
