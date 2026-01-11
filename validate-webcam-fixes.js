/**
 * Webcam Component Validation Script
 * 
 * Validates that the webcam components have been properly fixed according to the research patterns.
 * This script checks the implementation structure and key fixes.
 */

import { readFileSync } from 'fs';

// Simple validation checks
const validationResults = {
  cameraPOC: { passed: 0, failed: 0, checks: [] },
  barcodeScanner: { passed: 0, failed: 0, checks: [] }
};

function checkFileExists(filePath, componentName) {
  try {
    readFileSync(filePath, 'utf8');
    console.log(`✅ ${componentName}: File exists`);
    return true;
  } catch (error) {
    console.log(`❌ ${componentName}: File not found - ${error.message}`);
    return false;
  }
}

function validateCameraPOC(content) {
  console.log('\n=== CameraPOC Validation ===');
  
  // Check 1: Video readiness state management
  const hasIsReady = content.includes('isReady') || content.includes('setIsReady');
  validationResults.cameraPOC.checks.push({
    name: 'Video readiness state management',
    passed: hasIsReady
  });
  console.log(`${hasIsReady ? '✅' : '❌'} Video readiness state management: ${hasIsReady ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 2: Proper play() handling with try-catch
  const hasPlayTryCatch = content.includes('try') && content.includes('catch') && content.includes('play()');
  validationResults.cameraPOC.checks.push({
    name: 'Proper play() handling with try-catch',
    passed: hasPlayTryCatch
  });
  console.log(`${hasPlayTryCatch ? '✅' : '❌'} Proper play() handling with try-catch: ${hasPlayTryCatch ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 3: loadedmetadata event handling
  const hasLoadedMetadata = content.includes('loadedmetadata');
  validationResults.cameraPOC.checks.push({
    name: 'loadedmetadata event handling',
    passed: hasLoadedMetadata
  });
  console.log(`${hasLoadedMetadata ? '✅' : '❌'} loadedmetadata event handling: ${hasLoadedMetadata ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 4: canplay event handling
  const hasCanPlay = content.includes('canplay');
  validationResults.cameraPOC.checks.push({
    name: 'canplay event handling',
    passed: hasCanPlay
  });
  console.log(`${hasCanPlay ? '✅' : '❌'} canplay event handling: ${hasCanPlay ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 5: Debug logging for video readiness
  const hasDebugLogging = content.includes('readyState') && content.includes('videoWidth') && content.includes('videoHeight');
  validationResults.cameraPOC.checks.push({
    name: 'Debug logging for video readiness',
    passed: hasDebugLogging
  });
  console.log(`${hasDebugLogging ? '✅' : '❌'} Debug logging for video readiness: ${hasDebugLogging ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 6: Proper video element attributes
  const hasAutoPlay = content.includes('autoPlay');
  const hasPlaysInline = content.includes('playsInline');
  const hasMuted = content.includes('muted');
  const hasVideoAttributes = hasAutoPlay && hasPlaysInline && hasMuted;
  validationResults.cameraPOC.checks.push({
    name: 'Proper video element attributes',
    passed: hasVideoAttributes
  });
  console.log(`${hasVideoAttributes ? '✅' : '❌'} Proper video element attributes: ${hasVideoAttributes ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 7: Timeout handling for video loading
  const hasTimeout = content.includes('setTimeout') && content.includes('10000');
  validationResults.cameraPOC.checks.push({
    name: 'Timeout handling for video loading',
    passed: hasTimeout
  });
  console.log(`${hasTimeout ? '✅' : '❌'} Timeout handling for video loading: ${hasTimeout ? 'FOUND' : 'NOT FOUND'}`);
}

function validateBarcodeScanner(content) {
  console.log('\n=== BarcodeScanner Validation ===');
  
  // Check 1: Fallback constraints
  const hasFallbackConstraints = content.includes('constraintsArray') || content.includes('fallback');
  validationResults.barcodeScanner.checks.push({
    name: 'Fallback constraints for device compatibility',
    passed: hasFallbackConstraints
  });
  console.log(`${hasFallbackConstraints ? '✅' : '❌'} Fallback constraints for device compatibility: ${hasFallbackConstraints ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 2: Proper play() promise handling
  const hasPlayPromise = content.includes('playPromiseRef') || content.includes('play().catch');
  validationResults.barcodeScanner.checks.push({
    name: 'Proper play() promise handling',
    passed: hasPlayPromise
  });
  console.log(`${hasPlayPromise ? '✅' : '❌'} Proper play() promise handling: ${hasPlayPromise ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 3: Video readiness validation function
  const hasIsVideoReady = content.includes('isVideoReady');
  validationResults.barcodeScanner.checks.push({
    name: 'Video readiness validation function',
    passed: hasIsVideoReady
  });
  console.log(`${hasIsVideoReady ? '✅' : '❌'} Video readiness validation function: ${hasIsVideoReady ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 4: loadedmetadata waiting logic
  const hasLoadedMetadataWait = content.includes('loadedmetadata') && content.includes('await new Promise');
  validationResults.barcodeScanner.checks.push({
    name: 'loadedmetadata waiting logic',
    passed: hasLoadedMetadataWait
  });
  console.log(`${hasLoadedMetadataWait ? '✅' : '❌'} loadedmetadata waiting logic: ${hasLoadedMetadataWait ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 5: canplay event handling
  const hasCanPlayWait = content.includes('canplay') && content.includes('await new Promise');
  validationResults.barcodeScanner.checks.push({
    name: 'canplay event handling',
    passed: hasCanPlayWait
  });
  console.log(`${hasCanPlayWait ? '✅' : '❌'} canplay event handling: ${hasCanPlayWait ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 6: Comprehensive video state checking
  const hasVideoStateChecks = content.includes('readyState') && content.includes('stream.active') && content.includes('video.paused');
  validationResults.barcodeScanner.checks.push({
    name: 'Comprehensive video state checking',
    passed: hasVideoStateChecks
  });
  console.log(`${hasVideoStateChecks ? '✅' : '❌'} Comprehensive video state checking: ${hasVideoStateChecks ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 7: Error handling for autoplay
  const hasAutoplayHandling = content.includes('autoplay') || content.includes('NotAllowedError');
  validationResults.barcodeScanner.checks.push({
    name: 'Error handling for autoplay',
    passed: hasAutoplayHandling
  });
  console.log(`${hasAutoplayHandling ? '✅' : '❌'} Error handling for autoplay: ${hasAutoplayHandling ? 'FOUND' : 'NOT FOUND'}`);
  
  // Check 8: Debug logging
  const hasDebugLogs = content.includes('console.debug') && content.includes('Video');
  validationResults.barcodeScanner.checks.push({
    name: 'Debug logging for video operations',
    passed: hasDebugLogs
  });
  console.log(`${hasDebugLogs ? '✅' : '❌'} Debug logging for video operations: ${hasDebugLogs ? 'FOUND' : 'NOT FOUND'}`);
}

function calculateResults(results) {
  results.passed = results.checks.filter(check => check.passed).length;
  results.failed = results.checks.filter(check => !check.passed).length;
}

function printSummary() {
  console.log('\n=== VALIDATION SUMMARY ===');
  
  calculateResults(validationResults.cameraPOC);
  calculateResults(validationResults.barcodeScanner);
  
  const totalPassed = validationResults.cameraPOC.passed + validationResults.barcodeScanner.passed;
  const totalFailed = validationResults.cameraPOC.failed + validationResults.barcodeScanner.failed;
  const totalChecks = validationResults.cameraPOC.checks.length + validationResults.barcodeScanner.checks.length;
  
  console.log(`\n📊 Overall Results:`);
  console.log(`✅ Passed: ${totalPassed}/${totalChecks}`);
  console.log(`❌ Failed: ${totalFailed}/${totalChecks}`);
  
  console.log(`\n📁 CameraPOC:`);
  console.log(`✅ Passed: ${validationResults.cameraPOC.passed}/${validationResults.cameraPOC.checks.length}`);
  console.log(`❌ Failed: ${validationResults.cameraPOC.failed}/${validationResults.cameraPOC.checks.length}`);
  
  console.log(`\n📁 BarcodeScanner:`);
  console.log(`✅ Passed: ${validationResults.barcodeScanner.passed}/${validationResults.barcodeScanner.checks.length}`);
  console.log(`❌ Failed: ${validationResults.barcodeScanner.failed}/${validationResults.barcodeScanner.checks.length}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All validation checks passed! The webcam implementation follows best practices from the research.');
  } else {
    console.log('\n⚠️ Some validation checks failed. Please review the issues above.');
  }
  
  return totalFailed === 0;
}

// Main execution
try {
  console.log('🔍 Validating webcam implementation fixes...\n');
  
  // Validate CameraPOC
  const cameraPOCPath = './src/components/camera/CameraPOC.tsx';
  if (checkFileExists(cameraPOCPath, 'CameraPOC')) {
    const cameraPOCContent = readFileSync(cameraPOCPath, 'utf8');
    validateCameraPOC(cameraPOCContent);
  }
  
  // Validate BarcodeScanner
  const barcodeScannerPath = './src/hooks/useBarcodeScanner.ts';
  if (checkFileExists(barcodeScannerPath, 'BarcodeScanner')) {
    const barcodeScannerContent = readFileSync(barcodeScannerPath, 'utf8');
    validateBarcodeScanner(barcodeScannerContent);
  }
  
  // Print summary
  const allPassed = printSummary();
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
  
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}