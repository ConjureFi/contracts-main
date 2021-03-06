// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const provider = waffle.provider;
const errorDelta = 1e-4;

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

// test suite for ConjureFactory
describe("EtherCollateral Liquidations Tests", function () {

  // variable to store the deployed smart contract
  let conjure;
  let collateralFactory;
  let conjureFactory;
  let collateral;
  let mock;
  let owner, addr1, addr2, addr3, addr4;

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();

    // deploy conjure factory
    const COLLATERALFACTORY = await ethers.getContractFactory("EtherCollateralFactory",
        {
          libraries: {SafeDecimalMath: temp.address}
        }
    );

    // deploy conjure factory
    const CONJUREFACTORY = await ethers.getContractFactory("ConjureFactory");
    conjureFactory = await CONJUREFACTORY.deploy();
    await conjureFactory.deployed();

    collateralFactory = await COLLATERALFACTORY.deploy();
    await collateralFactory.deployed();

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        conjureFactory.address,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

  })

  // get mock price of eth for liquidation
  //TODO maybe have to be adopted when price changes
  it("Should init the contract", async function () {
    await conjure.init(
        0,
        0,
        ["1", "150000000000000000000"],
        false,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    // get the created contract
    let return_collateral = await conjure._collateralContract();
    collateral = await ethers.getContractAt("EtherCollateral", return_collateral)
  });


  it("Should be able to open a loan", async function () {
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);
  });

  it("should be able to liquidate loan", async function () {
    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.connect(addr1).openLoan(amountToBorrow,overrides);

    //update price
    await conjure.getPrice();

    // get loan info before
    const loan_info_before = await collateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await collateral.connect(addr1).liquidateLoan(owner.address,1,"1000000000000000000")

    // get loan info after
    const loan_info_after = await collateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // do assertions
    expect(loan_info_before.collateralAmount).to.not.equal(loan_info_after.collateralAmount);
    expect(loan_info_before.loanAmount).to.not.equal(loan_info_after.loanAmount);
    expect(wallet_before).to.not.equal(wallet_after);
    expect(balance).to.not.equal(balance_after);

    // loan can still be closed
    await collateral.closeLoan(1);
  });
});
