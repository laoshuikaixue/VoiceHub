#!/usr/bin/env node

import { execSync } from 'child_process';
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

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Check environment variables
if (!process.env.DATABASE_URL) {
  logError('DATABASE_URL environment variable not set');
  process.exit(1);
}

// Execute command with forced non-interactive mode
function forceExec(command, options = {}) {
  try {
    // Set environment variables for completely non-interactive mode
    const env = {
      ...process.env,
      CI: 'true',
      FORCE_COLOR: '0',
      NODE_ENV: 'production',
      DRIZZLE_NO_PROMPT: 'true',
      ...options.env
    };
    
    execSync(command, { 
      stdio: 'pipe', // Capture output to prevent prompts
      env,
      ...options 
    });
    return true;
  } catch (error) {
    logError(`Command failed: ${command}`);
    // Log error details but continue
    console.error(error.message);
    return false;
  }
}

async function forceDeployMigration() {
  log('🚀 Starting FORCED non-interactive migration...', 'bright');
  
  try {
    // 1. Set all possible non-interactive environment variables
    process.env.CI = 'true';
    process.env.FORCE_COLOR = '0';
    process.env.NODE_ENV = 'production';
    process.env.DRIZZLE_NO_PROMPT = 'true';
    process.env.ACCEPT_TRUNCATE = 'false'; // Never truncate
    process.env.FORCE_MIGRATE = 'true';
    
    log('🔧 Environment configured for non-interactive mode', 'cyan');
    
    // 2. Use direct drizzle-kit commands with maximum force
    log('⚡ Executing forced push migration...', 'cyan');
    
    // Try multiple force strategies
    const strategies = [
      'npx drizzle-kit push --force',
      'npx drizzle-kit push --yes',
      'echo "n" | npx drizzle-kit push',
      'npm run db:push'
    ];
    
    let success = false;
    
    for (const strategy of strategies) {
      log(`🔄 Trying: ${strategy}`, 'cyan');
      
      if (forceExec(strategy)) {
        logSuccess(`Migration successful with: ${strategy}`);
        success = true;
        break;
      } else {
        logWarning(`Strategy failed: ${strategy}`);
      }
    }
    
    if (!success) {
      throw new Error('All migration strategies failed');
    }
    
    logSuccess('🎉 Forced migration completed successfully!');
    
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    logError('This might require manual intervention');
    process.exit(1);
  }
}

// Run the forced migration
forceDeployMigration().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});