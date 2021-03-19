// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const errorDelta = 1e-4;

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

// test suite for ConjureFactory
describe("EtherCollateral Tests", function () {

  // variable to store the deployed smart contract
  let conjure;
  let collateralFactory;
  let conjureFactory;
  let collateral;
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
  })

  it("Should init the contract", async function () {
    await conjure.init(
        100,
        0,
        ["1", "150000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    );

    // get the created contract
    let return_collateral = await conjure._collateralContract();
    collateral = await ethers.getContractAt("EtherCollateral", return_collateral)
  });

  it("Should be able to find the generated COLLATERAL CONTRACT", async function () {
    let ratio = await collateral.collateralizationRatio();
    expect(ratio).to.equal("150000000000000000000");
  });

  it("Should not be able to open a loan with too low collateral ratio", async function () {
    // send 1 eth
    let overrides = {
      value: "1000000000000000000"
    };

    // should get loan for 1 arb asset
    await expect(collateral.openLoan("1000000000000000000",overrides)).to.be.reverted;
  });

  it("Should not to increase the minting fee and also not to set it too high", async function () {
    await expect(collateral.setIssueFeeRate(200)).to.be.reverted;
    await expect(collateral.setIssueFeeRate(300)).to.be.reverted;
  });

  it("Should not be able to call asset closed", async function () {
    await expect(collateral.setAssetClosed()).to.be.reverted;
  });

  it("Should be able to lower the minting fee", async function () {
    await collateral.setIssueFeeRate(0);

    const fee = await collateral.issueFeeRate();
    expect(fee).to.equal(0);
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

  it("check loan Properties", async function () {
    const loan = await (collateral.getLoan(owner.address, 1));
    const ratio = await collateral.getLoanCollateralRatio(owner.address, 1);
    const collateralizationRatio = await collateral.collateralizationRatio();
    const issueratio = await collateral.issuanceRatio();
    const mintingfee = await collateral.getMintingFee(owner.address, 1);
    const openloans = await collateral.openLoanIDsByAccount(owner.address);

    const unit = BigNumber.from("1000000000000000000");
    const calc_ratio = BigNumber.from("100000000000000000000").mul(unit).div(collateralizationRatio);

    expect(loan.account).to.equal(owner.address);
    expect(ratio).to.equal("1600000000000000000");

    const diff = calcRelativeDiff(calc_ratio, issueratio);
    expect(diff).to.be.lessThan(errorDelta);
    expect(mintingfee).to.be.equal(0);
    expect(openloans.length).to.be.equal(1);
  });

  it("should be able to close a loan", async function () {
    await (collateral.closeLoan(1));
    const loan = await (collateral.getLoan(owner.address, 1));
    expect(loan.timeClosed).to.not.equal(0);
  });

  it("should not be able to close a loan with insuffiecient funds", async function () {
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);

    //send some funds to another address
    let asset = await collateral.arbasset();
    let conjure_asset = await ethers.getContractAt("Conjure", asset)
    await conjure_asset.transfer(addr1.address,"500000000000000000")

    await expect(collateral.closeLoan(2)).to.be.reverted;
    const loan = await (collateral.getLoan(owner.address, 2));
    expect(loan.timeClosed).to.equal(0);
  });

  it("should be able to repay a loan", async function () {
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "2000000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);
    const ratio = await collateral.getLoanCollateralRatio(owner.address, 3);

    await collateral.repayLoan(owner.address,3,"500000000000000000")
    const ratioafter = await collateral.getLoanCollateralRatio(owner.address, 3);

    expect(ratio).to.not.be.equal(ratioafter)
  });

  it("should be able to deposit collateral", async function () {
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "2000000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);

    const ratio = await collateral.getLoanCollateralRatio(owner.address, 4);

    await collateral.depositCollateral(owner.address,4, overrides)
    const ratioafter = await collateral.getLoanCollateralRatio(owner.address, 4);

    expect(ratio).to.not.be.equal(ratioafter)
  });

  it("should be able to withdraw collateral", async function () {
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "2000000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);

    const ratio = await collateral.getLoanCollateralRatio(owner.address, 5);

    // dont allow to withdraw below c-ratio
    await expect(collateral.withdrawCollateral(5, "2000000000000000000")).to.be.reverted;

    // withdraw now
    await collateral.withdrawCollateral(5, "100000000000000000");
    const ratioafter = await collateral.getLoanCollateralRatio(owner.address, 5);

    expect(ratio).to.not.be.equal(ratioafter)
  });

  /**
   * @dev Gets the amount to liquidate which can potentially fix the c ratio given this formula:
   * r = target issuance ratio
   * D = debt balance
   * V = Collateral
   * P = liquidation penalty
   * Calculates amount of synths = (D - V * r) / (1 - (1 + P) * r)
   * */
  it("should be able to return the right liquidation amount", async function () {
    // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
    let loanvalue = BigNumber.from("1000000000000000000")
    let collateralvalue = BigNumber.from("1200000000000000000")
    const liquiratio = await collateral.liquidationRatio();

    // calc amount to liquidate and fix c ratio
    const amounttoliquidate = await collateral.calculateAmountToLiquidate(loanvalue, collateralvalue);

    // get loan amount after
    const loanamountafter = loanvalue.sub(amounttoliquidate)

    // get collateral after (add 10% penalty)
    const collateralafter = collateralvalue.sub(amounttoliquidate.div(100).mul(110))

    // get new c ratio
    const newCRatio = collateralafter.mul("1000000000000000000").div(loanamountafter);

    // target shoule be around 150%
    const diff = calcRelativeDiff(newCRatio, liquiratio);
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("should return 0 for correct minimum c ratio", async function () {
    // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
    let loanvalue = BigNumber.from("1000000000000000000")
    let collateralvalue = BigNumber.from("1500000000000000000")

    // calc amount to liquidate and fix c ratio
    const amounttoliquidate = await collateral.calculateAmountToLiquidate(loanvalue, collateralvalue);
    expect(amounttoliquidate).to.be.equal(0);

  });

  it("should not fix a loan with c ratio below 110", async function () {
    // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
    let loanvalue = BigNumber.from("1000000000000000000")
    let collateralvalue = BigNumber.from("1000000000000000000")

    // calc amount to liquidate and fix c ratio
    const amounttoliquidate = await collateral.calculateAmountToLiquidate(loanvalue, collateralvalue);

    // get loan amount after
    const loanamountafter = loanvalue.sub(amounttoliquidate)

    // check if result is less than 0 and then evaluate the test case
    if (loanamountafter < 0) {
      expect(true).to.be.true
    } else {
      expect(false).to.be.true
    }
  });

  it("should not be able to call liquidate with no funds", async function () {
       await expect(collateral.connect(addr1).liquidateLoan(owner.address,5,"1000000000000000000")).to.be.revertedWith("Not enough balance");
  });

  it("should not be able to call liquidate on a healthy loan", async function () {
    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.connect(addr1).openLoan(amountToBorrow,overrides);
    await expect(collateral.connect(addr1).liquidateLoan(owner.address,5,"1000000000000000000")).to.be.revertedWith("Collateral ratio above liquidation ratio");
  });

  it("Should be able to change the account loan limit", async function () {

    let currentLimit = await collateral.accountLoanLimit();
    expect(currentLimit).to.be.equal(50);

    await collateral.setAccountLoanLimit(10);

    currentLimit = await collateral.accountLoanLimit();
    expect(currentLimit).to.be.equal(10);

  });

  it("Should be able to call get contract info", async function () {
    await collateral.connect(addr1).getContractInfo();
  });

  it("Should be able to distribute the minting fee", async function () {
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

    await conjure.init(
        100,
        0,
        ["1", "150000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    );

    // get the created contract
    let return_collateral = await conjure._collateralContract();
    collateral = await ethers.getContractAt("EtherCollateral", return_collateral)

    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await collateral.openLoan(amountToBorrow,overrides);
  });

});





