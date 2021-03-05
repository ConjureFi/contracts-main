// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for ConjureFactory
describe("Conjure Basic Tests", function () {

  // variable to store the deployed smart contract
  let conjure;
  let collateralFactory;
  let conjureFactory;
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

  it("Should be deployed", async function () {
    let name = await conjure.name();
    let symbol = await conjure.symbol();
    let totalSupply = await conjure.totalSupply();
    expect(name).to.equal("NAME");
    expect(symbol).to.equal("SYMBOL");
    expect(totalSupply).to.equal("0");
  });

  it("Should revert with not inited contract", async function () {
    await expect(conjure.getPrice()).to.be.reverted;
  });

  it("Should revert if the newOwner in not called by the owner", async function () {
    await expect(conjure.connect(addr1).changeOwner(addr1.address)).to.be.reverted;
  });

  it("Should be able to change owner", async function () {
    await conjure.changeOwner(addr1.address);
    let owner = await conjure._owner();
    expect(owner).to.equal(addr1.address);
  });

  it("Should revert if the collect fees is called by non owner", async function () {
    await expect(conjure.collectFees()).to.be.reverted;
  });

  it("Should be able to call collect fees", async function () {
    await conjure.connect(addr1).collectFees();
  });

  it("Should revert if non owner calls init", async function () {
    await expect(conjure.init()).to.be.reverted;
  });

  it("Should not init with odd array values", async function () {
    await expect(conjure.connect(addr1).init(
        0,
        0,
        ["1", "120000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    )).to.be.reverted;
  });

  it("Should not init with 0 divisor", async function () {
    await expect(conjure.connect(addr1).init(
        0,
        0,
        ["0", "120000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    )).to.be.reverted;
  });

  it("Should not init with too low c ratio", async function () {
    await expect(conjure.connect(addr1).init(
        0,
        0,
        ["1", "12000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    )).to.be.reverted;
  });

  it("Should not init with too high c ratio", async function () {
    await expect(conjure.connect(addr1).init(
        0,
        0,
        ["1", "1200000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    )).to.be.reverted;
  });

  it("Should init the contract", async function () {
    let inited = await conjure._inited();
    expect(inited).to.equal(false);

    await conjure.connect(addr1).init(
        0,
        0,
        ["1", "120000000000000000000"],
        false,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["signature1"],
        [0x00],
        [0],
        [100],
        [8]
    );

    inited = await conjure._inited();
    expect( inited).to.equal(true);
    let inverse = await conjure._inverse();
    expect( inverse).to.equal(false);

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.not.equal(0);
  });

  it("Should not be able to call mint from non collateral contract", async function () {
    await expect(conjure.connect(addr1).mint(
        addr1.address,
        1
    )).to.be.reverted;
  });

  it("Should not be able to call burn from non collateral contract", async function () {
    await expect(conjure.connect(addr1).burn(
        addr1.address,
        1
    )).to.be.reverted;
  });

  it("Should be able to get the price", async function () {
    await conjure.connect(addr1).getPrice();
  });
});
