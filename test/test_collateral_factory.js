// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";

// test suite for ConjureFactory
describe("CollateralFactory Tests", function () {

  // variable to store the deployed smart contract
  let collateralFactory;
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

  it("Should be able to mint a new EtherCollateral Contract", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await collateralFactory.EtherCollateralMint(
        zeroaddress,
        owner.address,
        zeroaddress,
        0,
        "120000000000000000000"
    )
  });

  it("Should not be able to mint cause minting fee too high", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await expect(collateralFactory.EtherCollateralMint(
        zeroaddress,
        owner.address,
        zeroaddress,
        251,
        "120000000000000000000"
    )).to.be.reverted;
  });

  it("Should not be able to mint cause C-Ratio too high", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await expect(collateralFactory.EtherCollateralMint(
        zeroaddress,
        owner.address,
        zeroaddress,
        0,
        "1000000000000000000001"
    )).to.be.reverted;
  });

  it("Should not be able to mint cause C-Ratio too low", async function () {
    // using 0 address for needed addresses we just check if the call works here
    await expect(collateralFactory.EtherCollateralMint(
        zeroaddress,
        owner.address,
        zeroaddress,
        0,
        "99000000000000000000"
    )).to.be.reverted;
  });
});
