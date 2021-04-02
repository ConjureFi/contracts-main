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
  let cnj;

  let owner, addr1, addr2, addr3, addr4;
  const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();

    console.log(temp.address)

    conjureImplementation = await deploy('Conjure');

    // deploy conjure factory
    const COLLATERAL = await ethers.getContractFactory("EtherCollateral",
        {
          libraries: {SafeDecimalMath: temp.address}
        }
    );

    etherCollateralImplementation = await COLLATERAL.deploy();
    await etherCollateralImplementation.deployed();


    // deploy cnj token
    cnj = await deploy('CNJ', owner.address, owner.address, Date.now());

    // deploy alchemy factory
    conjureFactory = await deploy(
        'ConjureFactory',
        conjureImplementation.address,
        etherCollateralImplementation.address,
        owner.address,
        cnj.address
    );
  })

  // basic mints
  it("Should be able to mint a new Conjure Contract", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await conjureFactory.ConjureMint(
        "UNIT",
        "TEST",
        owner.address,
        "0xFa5a44D3Ba93D666Bf29C8804a36e725ecAc659A",
        0,
        "120000000000000000000"
    )
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
    await expect(conjureFactory.connect(addr2.address).newConjureImplementation(addr2.address)).to.be.reverted;
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
    await expect(conjureFactory.connect(addr2.address).newEtherCollateralImplementation(addr2.address)).to.be.reverted;
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
    await expect(conjureFactory.connect(addr2.address).newConjureRouter(addr2.address)).to.be.reverted;
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
    await expect(conjureFactory.newFactoryOwner(addr2.address)).to.be.reverted;
  });

  // return correct router
  it("Should return the correct router", async function () {
    let router = await conjureFactory.getConjureRouter();
    expect(router).to.equal(addr1.address);
  });
});
