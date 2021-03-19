require("@nomiclabs/hardhat-waffle");
require('hardhat-contract-sizer');
require('dotenv').config()
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
      forking: {
       url: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_ID
		}
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
      }
    ]
  }
};

