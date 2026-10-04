// PM2 process file for production (CloudPanel / any Linux VPS).
// Start:  pm2 start ecosystem.config.cjs   Reload after deploy:  pm2 reload texonpos
module.exports = {
  apps: [
    {
      name: "texonpos",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      // One instance: the hourly jobs in src/instrumentation.ts run in-process.
      // If you raise instances, set DISABLE_JOBS=1 and call /api/v1/admin/jobs/run from cron instead.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: { NODE_ENV: "production", PORT: "3000" },
      time: true,
    },
  ],
}
