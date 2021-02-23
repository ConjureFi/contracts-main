// imports
const {expect} = require("chai");
const {waffle} = require("hardhat");
const { ethers } = require("hardhat");
const {deployContract, solidity} = waffle;
const provider = waffle.provider;
const {BigNumber} = require('@ethersproject/bignumber');

const zeroaddress = "0x0000000000000000000000000000000000000000";

const errorDelta = 1e-4;

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

// test suite for the NFT DAO contract
describe("Constructor", function () {

  // variable to store the deployed smart contract
  let collateral;
  let conjure;
  let collateralfactory;

  let owner, addr1, addr2, addr3, addr4;

  // initial deployment of Dist Pool
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();

    // deploy ether collateral
    const ETHERCOLLATERALFACTORY = await ethers.getContractFactory("EtherCollateralFactory",
        {
          libraries: {SafeDecimalMath: temp.address}
        });

    collateralfactory = await  ETHERCOLLATERALFACTORY.deploy();
    await collateralfactory.deployed();



    // deploy conjure
    const CONJURE = await ethers.getContractFactory("TConjure");
    conjure = await CONJURE.deploy(
        "Test",
        "TST",
        owner.address,
        owner.address,
        "0xFa5a44D3Ba93D666Bf29C8804a36e725ecAc659A",
        collateralfactory.address
    );
    await conjure.deployed();


    // deploy ether collateral
    const ETHERCOLLATERAL = await ethers.getContractFactory("TEtherCollateral",
        {
          libraries: {SafeDecimalMath: temp.address}
        });

    collateral = await  ETHERCOLLATERAL.deploy(
        conjure.address,
        owner.address,
        400
    )
    await collateral.deployed();

  })

  it("Should be able to find the generated contract", async function () {
    let name = await conjure.name();
    expect(name).to.equal("Test");
  });

  it("Should be able to find the generated COLLATERAL CONTRACT", async function () {
    let ratio = await collateral.collateralizationRatio();
    expect(ratio).to.equal("120000000000000000000");
  });

  it("Should be able to init the conjure contract", async function () {
    let inited = await conjure._inited();
    expect( inited).to.equal(false);

    await conjure.init(
        400,
        1,
        ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
        [0],
        ["123"],
        [0x00],
        [0],
        [100],
        [8]
    );

    inited = await conjure._inited();
    expect( inited).to.equal(true);

  });


  it("Should have the right collateral contract set", async function () {
    const col_address = await  conjure._collateralContract();
    expect( collateral.address).to.equal(col_address);
  });

  it("Should not be able to open a loan with exceeding", async function () {

    // send 10 eth
    let overrides = {
      value: "10000000000000000000"
    };

    await expect(collateral.connect(addr1).openLoan(9,overrides)).to.be.reverted;
  });


  it("Should be able to open a loan", async function () {

    // send 10 eth
    let overrides = {
      value: "10000000000000000000"
    };

    // should get loan for 1 arb asset
    await (collateral.connect(addr1).openLoan(1,overrides));
  });

  it("check loan id", async function () {

    const loan = await (collateral.getLoan(addr1.address, 1));
    console.log(loan);
  });

  it("close loan", async function () {
    let balance_addr1 = await provider.getBalance(addr1.address);
    console.log(balance_addr1);

    await (collateral.connect(addr1).closeLoan(1));

    balance_addr1 = await provider.getBalance(addr1.address);
    console.log(balance_addr1);
  });

});
