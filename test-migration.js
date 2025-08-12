#!/usr/bin/env node

/**
 * Test script for validating the complete migration system
 * This script tests various scenarios to ensure end-to-end functionality
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 XLSX to Database Migration System - Test Suite');
console.log('='.repeat(60));

const tests = [
  {
    name: 'CLI Help Display',
    command: ['npm', ['start', '--', '--help']],
    expectSuccess: true,
    description: 'Tests if CLI help is displayed correctly'
  },
  {
    name: 'Environment Validation',
    command: ['npm', ['start', '--', '--config-only', '--verbose']],
    expectSuccess: true,
    description: 'Tests database setup and configuration validation'
  },
  {
    name: 'Invalid Table Name',
    command: ['npm', ['start', '--', '--table', 'invalid_table']],
    expectSuccess: false,
    description: 'Tests error handling for invalid table names'
  },
  {
    name: 'Dry Run - All Tables',
    command: ['npm', ['start', '--', '--dry-run', '--verbose']],
    expectSuccess: true,
    description: 'Tests complete migration pipeline in dry-run mode'
  },
  {
    name: 'Dry Run - Single Table',
    command: ['npm', ['start', '--', '--table', 'rules_worten_pt', '--dry-run', '--verbose']],
    expectSuccess: true,
    description: 'Tests single table migration in dry-run mode'
  }
];

async function runCommand(command, args, timeout = 60000) {
  return new Promise((resolve) => {
    console.log(`\n🔄 Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      process.kill('SIGKILL');
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr + '\nTEST TIMEOUT',
        timedOut: true
      });
    }, timeout);

    process.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        timedOut: false
      });
    });

    process.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + error.message,
        timedOut: false
      });
    });
  });
}

function checkPrerequisites() {
  console.log('\n📋 Checking Prerequisites...');
  
  const checks = [
    {
      name: 'package.json exists',
      check: () => fs.existsSync('package.json')
    },
    {
      name: '.env file exists',
      check: () => fs.existsSync('.env')
    },
    {
      name: 'node_modules exists',
      check: () => fs.existsSync('node_modules')
    },
    {
      name: 'src directory exists',
      check: () => fs.existsSync('src')
    },
    {
      name: 'Built files exist',
      check: () => fs.existsSync('dist') && fs.existsSync('dist/index.js')
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    const passed = check.check();
    console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
    if (!passed) allPassed = false;
  }

  if (!allPassed) {
    console.log('\n❌ Prerequisites check failed. Please run:');
    console.log('   npm install');
    console.log('   npm run build');
    console.log('   cp .env.example .env  # and configure with your settings');
    return false;
  }

  console.log('\n✅ All prerequisites met');
  return true;
}

async function runTests() {
  if (!checkPrerequisites()) {
    process.exit(1);
  }

  console.log('\n🧪 Running Migration System Tests...');
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n📝 Test ${i + 1}/${tests.length}: ${test.name}`);
    console.log(`   ${test.description}`);
    
    const result = await runCommand(test.command[0], test.command[1]);
    
    const passed = result.success === test.expectSuccess;
    
    console.log(`   ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!passed || result.timedOut) {
      console.log(`   Expected success: ${test.expectSuccess}, Got success: ${result.success}`);
      console.log(`   Exit code: ${result.exitCode}`);
      
      if (result.stderr) {
        console.log('   STDERR:');
        console.log('   ' + result.stderr.split('\n').slice(0, 5).join('\n   '));
      }
    }

    results.push({
      test: test.name,
      passed,
      expected: test.expectSuccess,
      actual: result.success,
      exitCode: result.exitCode,
      timedOut: result.timedOut
    });

    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Display final results
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n📊 Overall Results:`);
  console.log(`   ✅ Passed: ${passed}/${tests.length}`);
  console.log(`   ❌ Failed: ${failed}/${tests.length}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`   • ${result.test} (expected: ${result.expected}, got: ${result.actual})`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The migration system is working correctly.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Configure your Google Cloud service account credentials');
    console.log('   2. Set up your database connection in .env');
    console.log('   3. Run a test migration: npm start -- --dry-run --verbose');
    console.log('   4. Execute real migration when ready');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check .env configuration');
    console.log('   2. Verify database connectivity');
    console.log('   3. Ensure Google Cloud credentials are set up');
    console.log('   4. Review logs in the logs/ directory');
  }

  return failed === 0;
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n💥 Test suite crashed:', error.message);
  process.exit(1);
});