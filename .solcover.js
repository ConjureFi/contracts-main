module.exports = {
  mocha: {
    enableTimeouts: false,
    timeout: 250000
  },
  skipFiles: [
    'mocks/',
    'MockContracts/',
    'examples/',
    'interfaces/',
    'lib/FixedPoint.sol',
    'SafeDecimalMath.sol',
	'ConjureRouter.sol',
	'Owned.sol',
	'Pausable.sol',
	'RewardsDistributionRecipient.sol',
	'StakingRewards.sol'
  ]
}
