#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m', 
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Check environment
if (!process.env.DATABASE_URL) {
  logError('DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runAutoAnswerMigration() {
  log('🤖 Running auto-answer migration...', 'cyan');
  
  return new Promise((resolve, reject) => {
    // Spawn drizzle-kit push with auto-answer
    const child = spawn('npx', ['drizzle-kit', 'push'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: {
        ...process.env,
        CI: 'true',
        FORCE_COLOR: '0'
      }
    });
    
    // Auto-answer "No" to any prompts
    child.stdin.write('n\n');
    child.stdin.end();
    
    child.on('close', (code) => {
      if (code === 0) {
        logSuccess('Migration completed successfully');
        resolve(true);
      } else {
        logError(`Migration failed with exit code ${code}`);
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      logError(`Migration error: ${error.message}`);
      resolve(false);
    });
  });
}

async function main() {
  log('🚀 Starting automated migration with auto-answer...', 'bright');
  
  try {
    const success = await runAutoAnswerMigration();
    
    if (success) {
      logSuccess('🎉 Automated migration completed!');
      process.exit(0);
    } else {
      logError('Migration failed, check logs above');
      process.exit(1);
    }
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();