// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const provider = waffle.provider;
const errorDelta = 1e-4;
const UNIT = "1000000000000000000"

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

function calculateTotalCollateralRedeemed(amountToLiquidate, ethprice, assetprice) {
  assetprice = assetprice.mul("10000000000")
  ethprice = ethprice.mul("10000000000")
  let unit = BigNumber.from("1000000000000000000");
  let liquidationPenalty = BigNumber.from("100000000000000000");

  // Collateral value to redeem in ETH
  let collateralRedeemed = amountToLiquidate.mul(assetprice).div(unit).mul(unit).div(ethprice)

  // Add penalty in ETH
  let totalCollateralLiquidated = collateralRedeemed.mul(
      unit.add(liquidationPenalty)
  ).div(unit);

  return totalCollateralLiquidated;
}

function calculateAmountToLiquidate(debtBalance, collateral, liquidationRatio) {
  let unit = BigNumber.from("1000000000000000000");
  let liquidationPenalty = BigNumber.from("100000000000000000");

  let dividend = debtBalance.sub(collateral.mul(UNIT).div(liquidationRatio));
  let divisor = unit.sub((unit.add(liquidationPenalty)).mul(UNIT).div(liquidationRatio));

  return dividend.mul(UNIT).div(divisor);
}

function getTotalLiquidatedAndAmount(synthloan, ethprice, assetprice, debtToCover, liquiRatio) {

  assetprice = assetprice.mul("10000000000")
  ethprice = ethprice.mul("10000000000")

  const loanvalue = synthloan.loanAmount.mul(assetprice).div(UNIT)
  const collvalue = synthloan.collateralAmount.mul(ethprice).div(UNIT)

  const amountToLiquidate = calculateAmountToLiquidate(loanvalue, collvalue, liquiRatio)
  const liquiamount =  amountToLiquidate.mul(UNIT).div(assetprice)

  return liquiamount.lt(debtToCover)  ? liquiamount : debtToCover
}

// test suite for ConjureFactory
describe("EtherCollateral Liquidations Tests", function () {

  // variable to store the deployed smart contract
  let conjureImplementation;
  let etherCollateralImplementation;
  let conjureFactory;
  let mock;
  let mock2000;
  let mock3000;
  let mockinverse;
  let mock18dec;
  let mockliquidation;
  let pool;
  let router;

  let conjure;
  let ethercollateral;

  let owner, addr1, addr2, addr3, addr4;
  const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();

    conjureImplementation = await deploy('Conjure');

    // deploy conjure factory
    const COLLATERAL = await ethers.getContractFactory("EtherCollateral",
        {
          libraries: {SafeDecimalMath: temp.address}
        }
    );

    etherCollateralImplementation = await COLLATERAL.deploy();
    await etherCollateralImplementation.deployed();

    // deploy staking pool
    const POOL = await ethers.getContractFactory("StakingRewards");

    pool = await POOL.deploy(owner.address, owner.address, zeroaddress);
    await pool.deployed();

    // deploy router
    const ROUTER = await ethers.getContractFactory("ConjureRouter");

    router = await ROUTER.deploy(pool.address, owner.address);
    await router.deployed();

    // set rewards distribution
    await pool.setRewardsDistribution(router.address)

    // deploy conjure factory
    conjureFactory = await deploy(
        'ConjureFactory',
        conjureImplementation.address,
        etherCollateralImplementation.address,
        router.address
    );

    // deploy oracle mock
    let MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_2000");
    mock2000 = await MOCK.deploy();
    await mock2000.deployed();

    MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_3000");
    mock3000 = await MOCK.deploy();
    await mock3000.deployed();

    MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_INVERSE_TEST");
    mockinverse = await MOCK.deploy();
    await mockinverse.deployed();

    MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK18Decimals");
    mock18dec = await MOCK.deploy();
    await mock18dec.deployed();

    MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_LIQUIDATION");
    mockliquidation = await MOCK.deploy();
    await mockliquidation.deployed();
  })

  it("should be able to partially liquidate loan", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let liquiRatio = await ethercollateral.liquidationRatio();

    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // change the price of the asset
    await mockliquidation.setState(1)

    //update price
    await conjure.updatePrice();

    // get loan info before
    const loan_info_before = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get balance of loan owner
    const owner_wallet_before = await conjure.balanceOf(owner.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsbefore = await ethercollateral.totalIssuedSynths()
    const synthsbeforeconjure = await conjure.totalSupply()

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"500000000000000000")

    // get loan info after
    const loan_info_after = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsafter = await ethercollateral.totalIssuedSynths()
    const synthsafterconjure = await conjure.totalSupply()

    // do own calculations
    let amountToLiquidate = getTotalLiquidatedAndAmount(loan_info_before,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer(),
        BigNumber.from("500000000000000000"),
        liquiRatio);

    let totalRedeemed = calculateTotalCollateralRedeemed(amountToLiquidate,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer())

    // calculate the difference between the wallet before and after the liquidation to see if the bonus came in
    const diff = calcRelativeDiff(balance_after, balance.add(totalRedeemed))

    // do assertions
    expect(loan_info_after.collateralAmount).to.be.equal(loan_info_before.collateralAmount.sub(totalRedeemed));
    expect(loan_info_after.loanAmount).to.be.equal(loan_info_before.loanAmount.sub(amountToLiquidate));
    expect(wallet_after).to.be.equal(wallet_before.sub(amountToLiquidate));
    expect(balance).to.not.equal(balance_after);
    expect(diff).to.be.lessThan(errorDelta)
    expect(synthsafter).to.be.equal(synthsbefore.sub(amountToLiquidate))
    expect(synthsafterconjure).to.be.equal(synthsbeforeconjure.sub(amountToLiquidate))

    // loan is not yet closed so only a partial liquidation
    expect(loan_info_after.timeClosed).to.be.equal(0)

    // loan can still be closed
    await ethercollateral.closeLoan(1);

    // get loan info after
    const loan_info_after_close = await ethercollateral.getLoan(owner.address,1)

    // get balance of owner after
    const owner_wallet_after = await conjure.balanceOf(owner.address);

    // loan is not yet closed
    expect(loan_info_after_close.timeClosed).to.not.equal(0)

    // owner still has some synths
    expect(owner_wallet_after).to.be.equal(owner_wallet_before.sub(owner_wallet_before.sub(amountToLiquidate)))
  });

  it("should be able to partially liquidate loan with less debt to cover", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let liquiRatio = await ethercollateral.liquidationRatio();

    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.3 eth
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // change the price of the asset
    await mockliquidation.setState(1)

    //update price
    await conjure.updatePrice();

    // get loan info before
    const loan_info_before = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get balance of loan owner
    const owner_wallet_before = await conjure.balanceOf(owner.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsbefore = await ethercollateral.totalIssuedSynths()
    const synthsbeforeconjure = await conjure.totalSupply()

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"100000000000000000")

    // get loan info after
    const loan_info_after = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsafter = await ethercollateral.totalIssuedSynths()
    const synthsafterconjure = await conjure.totalSupply()

    // do own calculations
    let amountToLiquidate = getTotalLiquidatedAndAmount(loan_info_before,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer(),
        BigNumber.from("100000000000000000"),
        liquiRatio);

    let totalRedeemed = calculateTotalCollateralRedeemed(amountToLiquidate,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer())

    // calculate the difference between the wallet before and after the liquidation to see if the bonus came in
    const diff = calcRelativeDiff(balance_after, balance.add(totalRedeemed))

    // do assertions
    expect(loan_info_after.collateralAmount).to.be.equal(loan_info_before.collateralAmount.sub(totalRedeemed));
    expect(loan_info_after.loanAmount).to.be.equal(loan_info_before.loanAmount.sub(amountToLiquidate));
    expect(wallet_after).to.be.equal(wallet_before.sub(amountToLiquidate));
    expect(balance).to.not.equal(balance_after);
    expect(diff).to.be.lessThan(errorDelta)
    expect(synthsafter).to.be.equal(synthsbefore.sub(amountToLiquidate))
    expect(synthsafterconjure).to.be.equal(synthsbeforeconjure.sub(amountToLiquidate))

    // loan is not yet closed so only a partial liquidation
    expect(loan_info_after.timeClosed).to.be.equal(0)

    // loan can still be closed
    await ethercollateral.closeLoan(1);

    // get loan info after
    const loan_info_after_close = await ethercollateral.getLoan(owner.address,1)

    // get balance of owner after
    const owner_wallet_after = await conjure.balanceOf(owner.address);

    // loan is not yet closed
    expect(loan_info_after_close.timeClosed).to.not.equal(0)

    // owner still has some synths
    expect(owner_wallet_after).to.be.equal(owner_wallet_before.sub(owner_wallet_before.sub(amountToLiquidate)))
  });

  it("should be able to partially liquidate loan with higher debt to cover", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let liquiRatio = await ethercollateral.liquidationRatio();

    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.3 eth
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // change the price of the asset
    await mockliquidation.setState(1)

    //update price
    await conjure.updatePrice();

    // get loan info before
    const loan_info_before = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get balance of loan owner
    const owner_wallet_before = await conjure.balanceOf(owner.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsbefore = await ethercollateral.totalIssuedSynths()
    const synthsbeforeconjure = await conjure.totalSupply()

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"700000000000000000")

    // get loan info after
    const loan_info_after = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // get total synths before
    const synthsafter = await ethercollateral.totalIssuedSynths()
    const synthsafterconjure = await conjure.totalSupply()

    // do own calculations
    let amountToLiquidate = getTotalLiquidatedAndAmount(loan_info_before,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer(),
        BigNumber.from("700000000000000000"),
        liquiRatio);

    let totalRedeemed = calculateTotalCollateralRedeemed(amountToLiquidate,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer())

    // calculate the difference between the wallet before and after the liquidation to see if the bonus came in
    const diff = calcRelativeDiff(balance_after, balance.add(totalRedeemed))

    // do assertions
    expect(loan_info_after.collateralAmount).to.be.equal(loan_info_before.collateralAmount.sub(totalRedeemed));
    expect(loan_info_after.loanAmount).to.be.equal(loan_info_before.loanAmount.sub(amountToLiquidate));
    expect(wallet_after).to.be.equal(wallet_before.sub(amountToLiquidate));
    expect(balance).to.not.equal(balance_after);
    expect(diff).to.be.lessThan(errorDelta)
    expect(synthsafter).to.be.equal(synthsbefore.sub(amountToLiquidate))
    expect(synthsafterconjure).to.be.equal(synthsbeforeconjure.sub(amountToLiquidate))

    // loan is not yet closed so only a partial liquidation
    expect(loan_info_after.timeClosed).to.be.equal(0)

    // loan can still be closed
    await ethercollateral.closeLoan(1);

    // get loan info after
    const loan_info_after_close = await ethercollateral.getLoan(owner.address,1)

    // get balance of owner after
    const owner_wallet_after = await conjure.balanceOf(owner.address);

    // loan is not yet closed
    expect(loan_info_after_close.timeClosed).to.not.equal(0)

    // owner still has some synths
    expect(owner_wallet_after).to.be.equal(owner_wallet_before.sub(owner_wallet_before.sub(amountToLiquidate)))
  });

  it("cant liquidate healthy loan", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);


    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.3 eth
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await expect(ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"700000000000000000")).to.be
        .revertedWith("Collateral ratio above liquidation ratio")
  });

  it("cant liquidate if too less liquidator funds", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);


    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // get less funds for liquidator
    const amountToBorrowLiqui = "300000000000000000";

    // send 1.3 eth
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 0.3 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrowLiqui,overrides);

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await expect(ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"700000000000000000")).to.be
        .revertedWith("Not enough balance")
  });

  it("should be able to full liquidate a loan with a too high debt to cover if c-ratio is below 110%", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let liquiRatio = await ethercollateral.liquidationRatio();

    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.3 eth
    let overrides = {
      value: "1300000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // change the price of the asset
    await mockliquidation.setState(1)

    //update price
    await conjure.updatePrice();

    // get loan info before
    const loan_info_before = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get balance of loan owner
    const owner_wallet_before = await conjure.balanceOf(owner.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // get eth balance of loan creator before
    const balanceowner = await provider.getBalance(owner.address);

    // get total synths before
    const synthsbefore = await ethercollateral.totalIssuedSynths()
    const synthsbeforeconjure = await conjure.totalSupply()

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"900000000000000000")

    // get loan info after
    const loan_info_after = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // get eth balance of owner after
    const balance_after_owner = await provider.getBalance(owner.address);

    // get total synths before
    const synthsafter = await ethercollateral.totalIssuedSynths()
    const synthsafterconjure = await conjure.totalSupply()

    // do own calculations
    let amountToLiquidate = getTotalLiquidatedAndAmount(loan_info_before,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer(),
        BigNumber.from("900000000000000000"),
        liquiRatio);

    // calculate the difference between the wallet before and after the liquidation to see if the bonus came in
    const diff = calcRelativeDiff(balance_after, balance.add(loan_info_before.collateralAmount))

    // do assertions
    expect(loan_info_after.collateralAmount).to.be.equal(0);
    expect(loan_info_after.loanAmount).to.be.equal(loan_info_before.loanAmount.sub(amountToLiquidate));
    expect(wallet_after).to.be.equal(wallet_before.sub(amountToLiquidate));
    expect(balance).to.not.equal(balance_after);
    expect(diff).to.be.lessThan(errorDelta)
    expect(synthsafter).to.be.equal(synthsbefore.sub(amountToLiquidate))
    expect(synthsafterconjure).to.be.equal(synthsbeforeconjure.sub(amountToLiquidate))
    expect(balanceowner).to.be.equal(balance_after_owner)

    // loan is not yet closed so only a partial liquidation
    expect(loan_info_after.timeClosed).to.not.be.equal(0)

    // loan cannot be closed we had a full closure
    await expect(ethercollateral.closeLoan(1)).to.be.revertedWith("Loan already closed");
  });

  it("should be able to do a full closure of a loan", async function () {
    // change the price of the asset
    await mockliquidation.setState(0)

    const tx = await conjureFactory.conjureMint(
        [[2], [0], [100], [8]],
        [0x00],
        ["latestAnswer()"],
        [[mockliquidation.address],[zeroaddress]],
        [[1, 0], [100, "120000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let liquiRatio = await ethercollateral.liquidationRatio();

    // open a loan for addr1 to have some funds
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.45 eth
    let overrides = {
      value: "1450000000000000000"
    };

    // should get loan for 1 arb asset for owner
    await ethercollateral.openLoan(amountToBorrow,overrides);

    // should get loan for 1 arb asset
    await ethercollateral.connect(addr1).openLoan(amountToBorrow,overrides);

    // change the price of the asset
    await mockliquidation.setState(1)

    //update price
    await conjure.updatePrice();

    // get loan info before
    const loan_info_before = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator before
    const wallet_before = await conjure.balanceOf(addr1.address);

    // get balance of loan owner
    const owner_wallet_before = await conjure.balanceOf(owner.address);

    // get eth balance of liquidator before
    const balance = await provider.getBalance(addr1.address);

    // get eth balance of loan creator before
    const balanceowner = await provider.getBalance(owner.address);

    // get total synths before
    const synthsbefore = await ethercollateral.totalIssuedSynths()
    const synthsbeforeconjure = await conjure.totalSupply()

    // call liquidation to fix the c ratio of the owner.address and get a reward
    await ethercollateral.connect(addr1).liquidateLoan(owner.address,1,"1000000000000000000")

    // get loan info after
    const loan_info_after = await ethercollateral.getLoan(owner.address,1)

    // get balance of liquidator after
    const wallet_after = await conjure.balanceOf(addr1.address);

    // get eth balance of liquidator after
    const balance_after = await provider.getBalance(addr1.address);

    // get eth balance of owner after
    const balance_after_owner = await provider.getBalance(owner.address);

    // get total synths before
    const synthsafter = await ethercollateral.totalIssuedSynths()
    const synthsafterconjure = await conjure.totalSupply()

    // do own calculations
    let amountToLiquidate = getTotalLiquidatedAndAmount(loan_info_before,
        await mock.latestAnswer(),
        await mockliquidation.latestAnswer(),
        BigNumber.from("1000000000000000000"),
        liquiRatio);

    // calculate the difference between the wallet before and after the liquidation to see if the bonus came in
    const diff = calcRelativeDiff(balance_after, balance.add(loan_info_before.collateralAmount))

    // do assertions
    expect(loan_info_after.collateralAmount).to.be.equal(0);
    expect(loan_info_after.loanAmount).to.be.equal(loan_info_before.loanAmount.sub(amountToLiquidate));
    expect(wallet_after).to.be.equal(wallet_before.sub(amountToLiquidate));
    expect(balance).to.not.equal(balance_after);
    expect(diff).to.be.lessThan(errorDelta)
    expect(synthsafter).to.be.equal(synthsbefore.sub(amountToLiquidate))
    expect(synthsafterconjure).to.be.equal(synthsbeforeconjure.sub(amountToLiquidate))
    expect(balanceowner).to.be.equal(balance_after_owner)

    // loan is not yet closed so only a partial liquidation
    expect(loan_info_after.timeClosed).to.not.be.equal(0)

    // loan cannot be closed we had a full closure
    await expect(ethercollateral.closeLoan(1)).to.be.revertedWith("Loan already closed");
  });
});
