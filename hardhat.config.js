require("@nomiclabs/hardhat-waffle");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {

  defaultNetwork: "hardhat",
  networks: {

    // do a mainnet fork to work with oracle data
    hardhat: {
	}
  },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: { }
      },
	        {
        version: "0.6.5",
        settings: { }
      }
    ]
  }
};
