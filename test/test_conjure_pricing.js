// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for ConjureFactory
describe("Conjure Pricing Core Tests", function () {

  // variable to store the deployed smart contract
  let conjure;
  let collateralFactory;
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

    collateralFactory = await COLLATERALFACTORY.deploy();
    await collateralFactory.deployed();
  })

  it("Should get the price median right for a single oracle", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        0,
        ["1", "120000000000000000000"],
        false,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the price median right for a 2 oracles", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        0,
        ["1", "120000000000000000000"],
        false,
        [mock.address,mock.address],
        [2,2],
        ["latestAnswer()","latestAnswer()"],
        [0x00,0x00],
        [0,0],
        [0,0],
        [8,8]
    );

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the right avg price for a single basket", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        1,
        ["1", "120000000000000000000"],
        false,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the price avg right for a 2 oracles", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        1,
        ["1", "120000000000000000000"],
        false,
        [mock.address,mock.address],
        [2,2],
        ["latestAnswer()","latestAnswer()"],
        [0x00,0x00],
        [0,0],
        [50,50],
        [8,8]
    );

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the right avg price for an INVERSE single basket", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        1,
        ["1", "120000000000000000000"],
        true,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");

    // now query price 4 times to see the mock effect
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();

    lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1200000000000000000000");
  });

  it("Should get the right avg price for an INVERSE single basket with decrease", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("PriceTestOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        1,
        ["1", "120000000000000000000"],
        true,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");

    // now query price 4 times to see the mock effect
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();

    lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("3000000000000000000000");
  });

  it("Should get the right avg price for an INVERSE single basket increasing setting value to 0", async function () {

    // deploy conjure factory
    const CONJURE = await ethers.getContractFactory("Conjure");
    conjure = await CONJURE.deploy(
        "NAME",
        "SYMBOL",
        owner.address,
        zeroaddress,
        zeroaddress,
        collateralFactory.address
    );
    await conjure.deployed();

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("PriceTestOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();

    await conjure.init(
        0,
        1,
        ["1", "120000000000000000000"],
        true,
        [mock.address],
        [2],
        ["latestAnswer()"],
        [0x00],
        [0],
        [100],
        [8]
    );

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");

    // check collateral if asset is closed
    let return_collateral = await conjure._collateralContract();
    let collateral = await ethers.getContractAt("EtherCollateral", return_collateral);
    let opencheck = await collateral.assetClosed();
    expect(opencheck).to.be.equal(false);

    // now query price 4 times to see the mock effect
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();
    await conjure.getPrice();

    // asset should be 0 now
    lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("0");

    // asset should now be closed
    opencheck = await collateral.assetClosed()
    expect(opencheck).to.be.equal(true);

    // should not be able to open a new loan now
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send 1.6 eth so 150% c-ratio
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await expect(collateral.openLoan(amountToBorrow,overrides)).to.be.reverted;
  });


});
