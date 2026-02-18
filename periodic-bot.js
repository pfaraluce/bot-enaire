require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const CHECK_INTERVAL_MS = (parseInt(process.env.CHECK_INTERVAL_MINUTES) || 60) * 60 * 1000;

let isRunning = false;

function runOnce() {
    if (isRunning) {
        console.log(`[${new Date().toISOString()}] Bot is already running, skipping this interval.`);
        return;
    }
    
    isRunning = true;
    console.log(`[${new Date().toISOString()}] Running periodic check...`);
    const bot = spawn('node', ['bot.js'], { stdio: 'inherit' });
    
    bot.on('exit', (code) => {
        isRunning = false;
        console.log(`[${new Date().toISOString()}] Bot check finished with code ${code}. Next check in ${process.env.CHECK_INTERVAL_MINUTES || 60} minutes.`);
    });
}

// Run immediately on start
runOnce();

// Schedule periodic runs
setInterval(runOnce, CHECK_INTERVAL_MS);

console.log(`Periodic bot started. Running every ${process.env.CHECK_INTERVAL_MINUTES || 60} minutes.`);
