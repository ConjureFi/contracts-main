// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for Conjure
describe("Conjure Pricing Core Tests", function () {

  // variable to store the deployed smart contract
  let conjureImplementation;
  let etherCollateralImplementation;
  let conjureFactory;
  let mock;
  let mock2000;
  let mock3000;
  let mockinverse;
  let mock18dec;

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
  })

  it("Revert when a call to non the existing fallback function is initiated via the custom call of Conjure", async function () {
    await expect(conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        [""],
        [[mock.address],[zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    )).to.be.revertedWith("Call unsuccessful");
  });

  it("Should get the price median right for a single chainlink oracle", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the right median price for 3 custom call oracles", async function () {
    const tx = await conjureFactory.conjureMint(
        [[2,2,2],[0,0,0],[30,30,40],[8,8,8]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock.address, mock2000.address, mock3000.address],[zeroaddress, zeroaddress, zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return the middle price (2000)
    expect(lastprice).to.be.equal("2000000000000000000000");
 });

  it("Should get the right median price for 2 custom call oracles", async function () {
    const tx = await conjureFactory.conjureMint(
        [[2,2],[0,0],[30,30],[8,8]],
        [0x00, 0x00],
        ["latestAnswer()", "latestAnswer()"],
        [[mock.address, mock2000.address],[zeroaddress,zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return the avg price of 1500 and 2000 (1750)
    expect(lastprice).to.be.equal("1750000000000000000000");
  });

  it("Should get the right median price for 2 mixed oracles with maximum decimals (18)", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,2],[0,0],[30,30],[18,18]],
        [0x00, 0x00],
        ["latestAnswer()", "latestAnswer()"],
        [[mock18dec.address, mock18dec.address],[zeroaddress,zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return the avg price of 1500 and 1500
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the right median price for 3 mixed oracles", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,2,0],[0,0,0],[30,30,30],[8,8,18]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock2000.address, mock3000.address , mock18dec.address],[zeroaddress,zeroaddress,zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return the avg price of 2000,3000,1500
    expect(lastprice).to.be.equal("2000000000000000000000");
  });

  it("Should get the right median price for 4 mixed oracles", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,2,0,0],[0,0,0,0],[30,30,30,10],[8,8,18,8]],
        [0x00, 0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock2000.address, mock3000.address , mock18dec.address, mock2000.address],
        [zeroaddress,zeroaddress,zeroaddress,zeroaddress]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return the avg price of 2000,3000,1500,2000
    expect(lastprice).to.be.equal("2000000000000000000000");
  });

  it("Should get the right average price for a single oracle for a basket asset type", async function () {
    const tx = await conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        ["latestAnswer()"],
        [[mock3000.address],[zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // only 1 asset so should return the same value (3000)
    expect(lastprice).to.be.equal("3000000000000000000000");
  });

  it("Should revert if basket asset weights do not sum up to 100", async function () {
    await expect(  conjureFactory.conjureMint(
        [[0,0,0],[0,0,0],[30,30,59],[8,8,8]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock.address, mock2000.address, mock3000.address],
        [zeroaddress,zeroaddress,zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    )).to.be.revertedWith("Weights not 100")

  });

  it("Should revert if the call of custom oracle is not ok (wrong payload)", async function () {
    await expect(  conjureFactory.conjureMint(
        [[2,2,2],[0,0,0],[30,30,40],[8,8,8]],
        [0x123, 0x456, 0x00],
        ["testwrongcall()", "latestAnswer()", "latestAnswer()"],
        [[mock.address, mock2000.address, mock3000.address],
        [zeroaddress,zeroaddress,zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    )).to.be.revertedWith("Call unsuccessful")

  });

  it("Should revert with no oracle data provided", async function () {
    await expect(  conjureFactory.conjureMint(
        [[],[],[],[]],
        [],
        [],
        [[],[]],
        [[1,0], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    )).to.be.revertedWith("No oracle feeds supplied")

  });

  it("Should get the right average price for a 3 chainlink oracle for a basket asset type", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,0,0],[0,0,0],[30,30,40],[8,8,8]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock.address, mock2000.address, mock3000.address],
        [zeroaddress,zeroaddress,zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return avg (0.3 * 1500, 0.3 * 2000, 0.4 * 3000)
    expect(lastprice).to.be.equal("2250000000000000000000");
  });

  it("Should get the right average price for a single oracle for a basket asset type --> testing the sort function and providing mixed inputs", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,0,0],[0,0,0],[30,30,40],[8,8,8]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock2000.address, mock.address, mock3000.address],
        [zeroaddress,zeroaddress,zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return avg (0.3 * 2000, 0.3 * 1500, 0.4 * 3000)
    expect(lastprice).to.be.equal("2250000000000000000000");
  });

  it("Should get the right average price for a single oracle for a basket asset type --> testing the sort function and providing mixed inputs starting high", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0,0,0],[0,0,0],[30,30,40],[8,8,8]],
        [0x00, 0x00, 0x00],
        ["latestAnswer()", "latestAnswer()", "latestAnswer()"],
        [[mock3000.address, mock.address, mock2000.address],
        [zeroaddress,zeroaddress,zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        false
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()

    // should return avg (0.3 * 3000, 0.3 * 1500, 0.4 * 2000)
    expect(lastprice).to.be.equal("2150000000000000000000");
  });

  it("Should get the right average price for an INVERSE single basket", async function () {
    const tx = await conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        ["latestAnswer()"],
        [[mockinverse.address],[zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        true
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");

    // now set the inverse asset to increase the price
    await mockinverse.setState(1);

    // call price update on the conjure asset
    conjure.updatePrice();

    lastprice = await conjure.getLatestPrice()

    // expect the price to be 1500 * 2 - 2000
    expect(lastprice).to.be.equal("1000000000000000000000");

    // call price update on the conjure asset
    conjure.updatePrice();
  });

  it("Should get the right average price for an INVERSE single basket with while decreasing price", async function () {
    // set back the inverse mock
    await mockinverse.setState(0);

    const tx = await conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        ["latestAnswer()"],
        [[mockinverse.address],[zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        true
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");

    // now set the inverse asset to increase the price
    await mockinverse.setState(2);

    // call price update on the conjure asset
    conjure.updatePrice();

    lastprice = await conjure.getLatestPrice()

    // expect the price to be 1500 * 2 - 1000
    expect(lastprice).to.be.equal("2000000000000000000000");

    // call price update on the conjure asset
    conjure.updatePrice();
  });

  it("Should get the right average price for an INVERSE single basket increasing setting value to min inverse and closing the asset", async function () {
    // set back the inverse mock
    await mockinverse.setState(0);

    const tx = await conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        ["latestAnswer()"],
        [[mockinverse.address],[zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        true
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    let inverseLowerCap = await conjure.inverseLowerCap()

    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");
    expect(inverseLowerCap).to.be.equal(deplprice.div(10))

    // check collateral if asset is closed
    let opencheck = await ethercollateral.assetClosed();
    expect(opencheck).to.be.equal(false);

    // now set the inverse asset to increase the price
    await mockinverse.setState(3);

    // call price update on the conjure asset
    conjure.updatePrice();

    lastprice = await conjure.getLatestPrice()

    // expect the price to be 1500 * 2 - 3000
    expect(lastprice).to.be.equal(inverseLowerCap);

    // asset should now be closed
    opencheck = await ethercollateral.assetClosed()
    expect(opencheck).to.be.equal(true);

    // should not be able to open a new loan now
    // get amount needed
    const amountToBorrow = "1000000000000000000";

    // send ether
    let overrides = {
      value: "1600000000000000000"
    };

    // should get loan for 1 arb asset
    await expect(ethercollateral.openLoan(amountToBorrow,overrides)).to.be.revertedWith("Asset closed");

    await expect(ethercollateral.depositCollateral(owner.address, 1,overrides)).to.be.revertedWith("Asset closed for deposit collateral");
  });


  it("Should get the right average price for an INVERSE single basket increasing setting value to max inverse and closing the asset", async function () {
    // set back the inverse mock
    await mockinverse.setState(0);

    const tx = await conjureFactory.conjureMint(
        [[2],[0],[100],[8]],
        [0x00],
        ["latestAnswer()"],
        [[mockinverse.address],[zeroaddress]],
        [[1,1], [100,"120000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        true
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    let lastprice = await conjure.getLatestPrice()
    let deplprice = await conjure._deploymentPrice()
    let inverseLowerCap = await conjure.inverseLowerCap()

    expect(lastprice).to.be.equal("1500000000000000000000");
    expect(deplprice).to.be.equal("1500000000000000000000");
    expect(inverseLowerCap).to.be.equal(deplprice.div(10))

    // check collateral if asset is closed
    let opencheck = await ethercollateral.assetClosed();
    expect(opencheck).to.be.equal(false);

    // now set the inverse asset to increase the price
    await mockinverse.setState(4);

    // call price update on the conjure asset
    conjure.updatePrice();

    lastprice = await conjure.getLatestPrice()

    // expect the price to be upperBound
    expect(lastprice).to.be.equal(deplprice.mul(2).sub(0));

    // asset should now be closed
    opencheck = await ethercollateral.assetClosed()
    expect(opencheck).to.be.equal(false);
  });

});
