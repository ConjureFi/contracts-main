// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for ConjureFactory
describe("Conjure Tests", function () {

  // variable to store the deployed smart contract
  let conjureImplementation;
  let etherCollateralImplementation;
  let conjureFactory;
  let mock;

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

    // deploy alchemy factory
    conjureFactory = await deploy(
        'ConjureFactory',
        conjureImplementation.address,
        etherCollateralImplementation.address,
        owner.address
    );

    // deploy oracle mock
    const MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
    mock = await MOCK.deploy();
    await mock.deployed();
  })

  // basic mints
  it("Should be able to mint a new Conjure Contract", async function () {
    // using 0 address for needed addresses we just check if the call works here
    const tx = await conjureFactory.ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["TEST", "SYMBOL"],
        0
    );
  });

  // check conjure implementation
  it("Should have the right conjureImplementation set", async function () {
    let conjureImplementations = await conjureFactory.conjureImplementation();
    expect(conjureImplementations).to.equal(conjureImplementation.address);
  });

  it("Should be able to change the conjureImplementation address", async function () {
    await conjureFactory.newConjureImplementation(addr1.address);
    let conjureImplementations = await conjureFactory.conjureImplementation();
    expect(conjureImplementations).to.equal(addr1.address);
  });

  it("Should revert if the newConjureImplementation in not called by the owner", async function () {
    await expect(conjureFactory.connect(addr2).newConjureImplementation(addr2.address)).to.be.revertedWith("Only factory owner");
  });

  // check ethercollateral implementation
  it("Should have the right etherCollateralImplementation set", async function () {
    let etherCollateralImplementations = await conjureFactory.etherCollateralImplementation();
    expect(etherCollateralImplementations).to.equal(etherCollateralImplementation.address);
  });

  it("Should be able to change the etherCollateralImplementation address", async function () {
    await conjureFactory.newEtherCollateralImplementation(addr1.address);
    let etherCollateralImplementations = await conjureFactory.etherCollateralImplementation();
    expect(etherCollateralImplementations).to.equal(addr1.address);
  });

  it("Should revert if the newEtherCollateralImplementation in not called by the owner", async function () {
    await expect(conjureFactory.connect(addr2).newEtherCollateralImplementation(addr2.address)).to.be.revertedWith("Only factory owner");
  });

  // check conjure router
  it("Should have the right conjurerouter set", async function () {
    let conjureRouter = await conjureFactory.conjureRouter();
    expect(conjureRouter).to.equal(owner.address);
  });

  it("Should be able to change the conjureRouter address", async function () {
    await conjureFactory.newConjureRouter(addr1.address);
    let conjureRouter = await conjureFactory.conjureRouter();
    expect(conjureRouter).to.equal(addr1.address);
  });

  it("Should revert if the newConjureRouter in not called by the owner", async function () {
    await expect(conjureFactory.connect(addr2).newConjureRouter(addr2.address)).to.be.revertedWith("Only factory owner");
  });

  // check owner
  it("Should have the right owner set", async function () {
    let factoryOwner = await conjureFactory.factoryOwner();
    expect(factoryOwner).to.equal(owner.address);
  });

  it("Should be able to change the owners address", async function () {
    await conjureFactory.newFactoryOwner(addr1.address);
    let factoryOwner = await conjureFactory.factoryOwner();
    expect(factoryOwner).to.equal(addr1.address);
  });

  it("Should revert if the newFactoryOwner in not called by the owner", async function () {
    await expect(conjureFactory.newFactoryOwner(addr2.address)).to.be.revertedWith("Only factory owner");
  });

  // return correct router
  it("Should return the correct router", async function () {
    let router = await conjureFactory.getConjureRouter();
    expect(router).to.equal(addr1.address);
  });
});
