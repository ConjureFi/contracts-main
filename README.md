# Conjure
[![Twitter Follow](https://img.shields.io/twitter/follow/ConjureFi?label=Conjure.Finance&style=social)](https://twitter.com/ConjureFi/)
[![Build Status](https://travis-ci.com/ConjureFi/contracts-main.svg?branch=main)](https://travis-ci.com/ConjureFi/contracts-main)

Repository for the Conjure Contracts


## Gitbook
The technical documentation can be found here: [https://docs.conjure.finance/](https://docs.conjure.finance/)

## Dapps
You can find the rinkeby version of the Conjure Dapp here: [https://rinkeby.conjure.finance/](https://rinkeby.conjure.finance/)

# Setup

## Install the dependencies
```
npm install
```

## Testing
The contracts can be tested by running the corresponding tests from the hardhat test folder with a total of 51 unit tests.
```
npx hardhat test
```

## Coverage
The contracts coverage can be run through:
```
npx hardhat coverage
```

## Deployment
The 2 Solidity Files which act as the Factory Contracts for all assets can be deployed by using the scripts in the scripts folder using
```
npx hardhat run --network NETWORK scripts/deploy_conjurefactory.js
npx hardhat run --network NETWORK scripts/deploy_collateralfactory.js
```

## UML Class Diagrams

### ConjureFactory.sol

![01](classdiagrams/ConjureFactory.svg)

### EtherCollateralFactory.sol

![02](classdiagrams/EtherCollateralFactory.svg)

## Flow Diagrams

### Conjure Functions

![03](flowdiagrams/conjurefunctions.png)

### EtherCollateral Functions

![04](flowdiagrams/ethercollateralfunctions.png)

### Asset Creation

![5](flowdiagrams/assetcreation.png)

### Mint and Burn

![06](flowdiagrams/loancreation.png)
