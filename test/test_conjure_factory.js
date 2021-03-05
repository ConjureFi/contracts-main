// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for ConjureFactory
describe("ConjureFactory Tests", function () {

  // variable to store the deployed smart contract
  let conjureFactory;
  let owner, addr1, addr2, addr3, addr4;

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy conjure factory
    const CONJUREFACTORY = await ethers.getContractFactory("ConjureFactory");
    conjureFactory = await CONJUREFACTORY.deploy();
    await conjureFactory.deployed();
  })

  it("Should have the right owner set", async function () {
    let factoryOwner = await conjureFactory.getFactoryOwner();
    expect(factoryOwner).to.equal(owner.address);
  });

  it("Should be able to change the owners address", async function () {
    await conjureFactory.newFactoryOwner(addr1.address);
    let factoryOwner = await conjureFactory.getFactoryOwner();
    expect(factoryOwner).to.equal(addr1.address);
  });

  it("Should revert if the newFactoryOwner in not called by the owner", async function () {
    await expect(conjureFactory.newFactoryOwner(addr2.address)).to.be.reverted;
  });

  it("Should be able to mint a new Conjure Contract", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await conjureFactory.ConjureMint(
        "UNIT",
        "TEST",
        owner.address,
        zeroaddress,
        zeroaddress
    )
  });
});
