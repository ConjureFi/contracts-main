// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {defaultAbiCoder} = require("@ethersproject/abi");
const encoder = defaultAbiCoder
const {BigNumber} = require('@ethersproject/bignumber');
const errorDelta = 1e-4;

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

// test suite for Conjure
describe("Conjure Pricing Market Cap Tests", function () {

  // variable to store the deployed smart contract
  let conjureImplementation;
  let etherCollateralImplementation;
  let conjureFactory;
  let mock;
  let mock2000;
  let mock3000;
  let mockinverse;
  let mock18dec;
  let mockunioracle;
  let mocksupply;

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

    // deploy conjure factory
    conjureFactory = await deploy(
        'ConjureFactory',
        conjureImplementation.address,
        etherCollateralImplementation.address,
        owner.address
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

    MOCK = await ethers.getContractFactory("NDX_UNISWAP_ORACLE");
    mockunioracle = await MOCK.deploy();
    await mockunioracle.deployed();

    MOCK = await ethers.getContractFactory("ERC20_SUPPLY_MOCK");
    mocksupply = await MOCK.deploy();
    await mocksupply.deployed();
  })

  it("Should get the price median right for a single oracle", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )


    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[18]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address], [mocksupply.address]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    const diff = calcRelativeDiff(lastprice, "32000000000000000000")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for index asset type (price * mcap)", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )


    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[18]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[1,2], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    const diff = calcRelativeDiff(lastprice, "32000000000000000000000000")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for index asset type and chainlink asset type (price * mcap)", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )


    const tx = await conjureFactory.ConjureMint(
        [[0],[0],[100],[8]],
        [parameters],
        ["chainlink call"],
        [[mock.address],[mocksupply.address]],
        [[1,2], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    const diff = calcRelativeDiff(lastprice, "1500000000000000000000000000")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for sqrt index asset type sqrt(price * mcap)", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[18]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[1,3], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // sqrt of 32000000000000000000000000 = 5656854249492
    const diff = calcRelativeDiff(lastprice, "5656854249492")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for sqrt index asset type sqrt(price * mcap) and type chainlink", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    const tx = await conjureFactory.ConjureMint(
        [[0],[0],[100],[8]],
        [parameters],
        ["chainlink call"],
        [[mock.address],[mocksupply.address]],
        [[1,3], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // sqrt of 1500000000000000000000000000 = 38729833462074
    const diff = calcRelativeDiff(lastprice, "38729833462074")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for index asset type (price * mcap) with index divisor set to 2", async function () {

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[18]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[2,2], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    const diff = calcRelativeDiff(lastprice, "16000000000000000000000000")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should get the price for sqrt index asset type sqrt(price * mcap) and supply 0", async function () {

    await mocksupply.setState(3)

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[18]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[1,3], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal(0)

  });

  it("Should get the price for index asset type (price * mcap) with index divisor set to 2 and total supply is 17 decimals", async function () {

    await mocksupply.setState(1)

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    const tx = await conjureFactory.ConjureMint(
        [[1],[0],[100],[17]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[2,2], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    const diff = calcRelativeDiff(lastprice, "16000000000000000000000000")
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should revert if the decimals of the token lookup is greater than 18", async function () {

    await mocksupply.setState(2)

    let parameters = encoder.encode(
        ["address","uint256","uint256"],
        [mocksupply.address,0, 60*60*24*7]
    )

    await expect(conjureFactory.ConjureMint(
        [[1],[0],[100],[17]],
        [parameters],
        ["computeAverageTokenPrice(address,uint256,uint256)"],
        [[mockunioracle.address],[mocksupply.address]],
        [[2,2], [100,"120000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    )).to.be.revertedWith("Decimals too high");

  });
});
