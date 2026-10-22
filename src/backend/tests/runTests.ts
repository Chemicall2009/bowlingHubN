import { runAllScoringTests } from './scoring.test';
import { runAllFeatureTests } from './features.test';

console.log('====================================================');
console.log('🎳 BOWLINGHUB SCORING & REGRESSION TEST SUITE');
console.log('====================================================');

const scoringResult = runAllScoringTests();
console.log(`USBC Scoring Results: ${scoringResult.passed}/${scoringResult.total} Tests Passed`);

const featureResult = runAllFeatureTests();
console.log(`Operator Tasks Results: ${featureResult.passed}/${featureResult.total} Tests Passed`);

const allFailures = [...scoringResult.failedCases, ...featureResult.failedCases];

if (allFailures.length > 0) {
  console.error('\n❌ Failures:');
  allFailures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log(`\n✅ All USBC ${scoringResult.passed}/${scoringResult.total} and Operator Tasks ${featureResult.passed}/${featureResult.total} tests PASSED successfully!`);
  process.exit(0);
}
