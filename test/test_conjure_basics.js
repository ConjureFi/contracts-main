// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const {deployContract, solidity} = waffle;
const provider = waffle.provider;
const zeroaddress = "0x0000000000000000000000000000000000000000";
const errorDelta = 1e-4;
const {BigNumber} = require('@ethersproject/bignumber');

function calcRelativeDiff(expected, actual) {
  const diff = BigNumber.from(expected).sub(actual).toNumber();
  return Math.abs(diff / expected);
}

// test suite for ConjureFactory
describe("Conjure Basic Tests", function () {

  // variable to store the deployed smart contract
  let conjureImplementation;
  let etherCollateralImplementation;
  let conjureFactory;
  let mock;

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
  it("Should be able to mint a new Conjure and EtherCollateral Contract", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address, mock.address],
        ["NAME", "SYMBOL"],
        0
    );

    const {events, cumulativeGasUsed, gasUsed} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);
  });

  it("Check if all values of the Conjure contract have been deployed and set right", async function () {
    let name = await conjure.name();
    let symbol = await conjure.symbol();
    let totalSupply = await conjure.totalSupply();
    let balanceOf = await conjure.balanceOf(owner.address);
    let allowance = await conjure.allowance(addr1.address, owner.address);
    expect(name).to.equal("NAME");
    expect(symbol).to.equal("SYMBOL");
    expect(totalSupply).to.equal("0");
    expect(balanceOf).to.equal("0");
    expect(allowance).to.equal("0");
  });


  it("Should revert if the newOwner function in not called by the owner", async function () {
    await expect(conjure.connect(addr1).changeOwner(addr1.address)).to.be.revertedWith("Only the contract owner may perform this action");
  });

  it("Should revert if the newOwner is the zero address", async function () {
    await expect(conjure.changeOwner(zeroaddress)).to.be.revertedWith("_newOwner can not be null");
  });

  it("Should be able to change owner", async function () {
    await conjure.changeOwner(addr1.address);
    let owner = await conjure._owner();
    expect(owner).to.equal(addr1.address);
  });

  it("Should revert if the collect fees functio is called by non owner", async function () {
    await expect(conjure.collectFees()).to.be.revertedWith("Only the contract owner may perform this action");
  });

  async function getgas(transaction) {
    let {gasUsed} = await transaction.wait();

    return gasUsed;
  }

  it("Should be able to call collect fees from the owner account and to withdraw the funds to the callers wallet", async function () {

    const gasprice = await provider.getGasPrice()

    const walletbefore = await provider.getBalance(addr1.address)

    // send 1 eth
    const tx = await addr1.sendTransaction({
      to: conjure.address,
      value: ethers.utils.parseEther("1.0")
    });

    let gasUsed = await getgas(tx);
    const txsgas = gasprice.mul(gasUsed);
    const walletafter = await provider.getBalance(addr1.address)

    const txcollect = await conjure.connect(addr1).collectFees();
    gasUsed = await getgas(txcollect);
    const txsgascollect = gasprice.mul(gasUsed);

    const walletaftercollect = await provider.getBalance(addr1.address)

    const diffwallet = calcRelativeDiff(walletafter, walletbefore.sub(ethers.utils.parseEther("1.0")).sub(txsgas))
    expect(diffwallet).to.be.lessThan(errorDelta);

    const diff = calcRelativeDiff(walletaftercollect, walletbefore.sub(txsgas).sub(txsgascollect))
    expect(diff).to.be.lessThan(errorDelta);
  });

  it("Should not init with odd array values and revert", async function () {
    // check if it reverts when we take a wrong input type
    await expect(conjureFactory.connect(addr1).conjureMint(
        [[0],[0],["abc"],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.reverted;
  });

  it("Should not init with 0 value as divisor", async function () {
    await expect(conjureFactory.connect(addr1).conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[0,1], [100,"150000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("Divisor should not be 0");
  });

  it("Should not init with a too low c ratio being set", async function () {
    await expect(conjureFactory.connect(addr1).conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"110000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("C-Ratio Too low");
  });

  it("Should not init with a too high C-ratio being set", async function () {
    await expect(conjureFactory.connect(addr1).conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"1000000000000000000001"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("C-Ratio Too high");
  });

  it("Should init the contracts with a valid specification and check the last price according to the mock contract", async function () {
    const tx = await conjureFactory.conjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    );

    const {events} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

    inited = await conjure._inited();
    expect( inited).to.equal(true);
    let inverse = await conjure._inverse();
    expect( inverse).to.equal(false);

    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Should not be able to call mint from a non collateral contract", async function () {
    await expect(conjure.connect(addr1).mint(
        addr1.address,
        1
    )).to.be.revertedWith("Only Collateral Contract");
  });

  it("Should not be able to call burn from a non collateral contract", async function () {
    await expect(conjure.connect(addr1).burn(
        addr1.address,
        1
    )).to.be.revertedWith("Only Collateral Contract");
  });

  it("Should be able to call updatePrice and then get the correct latest price of the asset", async function () {
    await conjure.connect(addr1).updatePrice();
    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Init can only be called by the factory contract and should revert otherwise", async function () {
    await expect(conjure.connect(addr1).init(
        true,
        [1,1],
        [[],[]],
        [[],[],[],[]],
        ["test", "symbol"],
        [0x00]
    )).to.be.revertedWith("can only be called by factory contract");
  });

  it("Should not init the contracts with decimals too high (above 18) and should revert otherwise", async function () {
    await expect(conjureFactory.connect(addr1).conjureMint(
        [[0],[0],[100],[19]],
        [0x00],
        ["signature1"],
        [[mock.address],[zeroaddress]],
        [[1,1], [100,"1000000000000000000000"]],
        [owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("Decimals too high");
  });

  it("Should be able to get the latest ethusdprice from the contract", async function () {
    let ethusdprice = await conjure.getLatestETHUSDPrice()
    expect(ethusdprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the correct latest time observed from the contract", async function () {
    const tx = await conjure.connect(addr1).updatePrice();
    const {blockNumber  } = await tx.wait();
    const block = await provider.getBlock(blockNumber);

    let lastpricetime = await conjure.getLatestPriceTime()
    expect(lastpricetime).to.be.equal(block.timestamp);
  });

  it("Should return the correct decimals of the Conjure Contract", async function () {
    let decimals = await conjure.decimals()
    expect(decimals).to.be.equal(18);
  });
});
