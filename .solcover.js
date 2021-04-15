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
    'ConjureGovernorAlpha.sol',
    'ConjureTimeLock.sol',
    'CNJ.sol',
    'SafeDecimalMath.sol'
  ]
}
