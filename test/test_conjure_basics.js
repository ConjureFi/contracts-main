// imports
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const {deployContract, solidity} = waffle;
const provider = waffle.provider;
const zeroaddress = "0x0000000000000000000000000000000000000000";

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
  it("Should be able to mint a new Conjure Contract", async function () {
    const tx = await conjureFactory.ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    );

    const {events, cumulativeGasUsed, gasUsed} = await tx.wait();
    const [event] = events.filter(e => e.event === "NewConjure");
    conjure = await ethers.getContractAt("Conjure", event.args.conjure);
    ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);
  });

  it("Should be deployed", async function () {
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


  it("Should revert if the newOwner in not called by the owner", async function () {
    await expect(conjure.connect(addr1).changeOwner(addr1.address)).to.be.revertedWith("Only the contract owner may perform this action");
  });

  it("Should be able to change owner", async function () {
    await conjure.changeOwner(addr1.address);
    let owner = await conjure._owner();
    expect(owner).to.equal(addr1.address);
  });

  it("Should revert if the collect fees is called by non owner", async function () {
    await expect(conjure.collectFees()).to.be.revertedWith("Only the contract owner may perform this action");
  });

  async function getgas(transaction) {
    let {gasUsed} = await transaction.wait();

    return gasUsed;
  }

  it("Should be able to call collect fees", async function () {

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

    expect(walletafter).to.be.equal(walletbefore.sub(ethers.utils.parseEther("1.0")).sub(txsgas))
    expect(walletaftercollect).to.be.equal(walletbefore.sub(txsgas).sub(txsgascollect));
  });

  it("Should not init with odd array values", async function () {
    // check if it reverts when we take a wrong input type
    await expect(conjureFactory.connect(addr1).ConjureMint(
        [[0],[0],["abc"],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.reverted;
  });

  it("Should not init with 0 divisor", async function () {
    await expect(conjureFactory.connect(addr1).ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[0,1], [100,"150000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("Divisor should not be 0");
  });

  it("Should not init with too low c ratio", async function () {
    await expect(conjureFactory.connect(addr1).ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"110000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("C-Ratio Too low");
  });

  it("Should not init with too high c ratio", async function () {
    await expect(conjureFactory.connect(addr1).ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"1000000000000000000001"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("C-Ratio Too high");
  });

  it("Should init the contract", async function () {
    const tx = await conjureFactory.ConjureMint(
        [[0],[0],[100],[8]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"150000000000000000000"]],
        [owner.address,owner.address,mock.address],
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

  it("Should not be able to call mint from non collateral contract", async function () {
    await expect(conjure.connect(addr1).mint(
        addr1.address,
        1
    )).to.be.revertedWith("Only Collateral Contract");
  });

  it("Should not be able to call burn from non collateral contract", async function () {
    await expect(conjure.connect(addr1).burn(
        addr1.address,
        1
    )).to.be.revertedWith("Only Collateral Contract");
  });

  it("Should be able to get the price", async function () {
    await conjure.connect(addr1).updatePrice();
    let lastprice = await conjure.getLatestPrice()
    expect(lastprice).to.be.equal("1500000000000000000000");
  });

  it("Init can only be called by the factory", async function () {
    await expect(conjure.connect(addr1).init(
        true,
        [1,1],
        [],
        [[],[],[],[]],
        ["test", "symbol"],
        [0x00]
    )).to.be.revertedWith("can only be called by factory contract");
  });

  it("Should not init with decimals too high", async function () {
    await expect(conjureFactory.connect(addr1).ConjureMint(
        [[0],[0],[100],[19]],
        [0x00],
        ["signature1"],
        [mock.address],
        [[1,1], [100,"1000000000000000000000"]],
        [owner.address,owner.address,mock.address],
        ["NAME", "SYMBOL"],
        0
    )).to.be.revertedWith("Decimals too high");
  });

  it("Should be able to get the latest ethusdprice", async function () {
    let ethusdprice = await conjure.getLatestETHUSDPrice()
    expect(ethusdprice).to.be.equal("1500000000000000000000");
  });

  it("Should get the correct latest time observed", async function () {
    const tx = await conjure.connect(addr1).updatePrice();
    const {blockNumber  } = await tx.wait();
    const block = await provider.getBlock(blockNumber);

    let lastpricetime = await conjure.getLatestPriceTime()
    expect(lastpricetime).to.be.equal(block.timestamp);
  });

  it("Confirm Decimals", async function () {
    let decimals = await conjure.decimals()
    expect(decimals).to.be.equal(18);
  });
});
