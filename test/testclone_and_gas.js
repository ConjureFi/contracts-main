// imports
const {defaultAbiCoder} = require("@ethersproject/abi");
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const provider = waffle.provider;

const encoder = defaultAbiCoder

// test suite for Alchemy
describe("Test Conjure Functions", function () {

    // variable to store the deployed smart contract
    let conjureImplementation;
    let etherCollateralImplementation;
    let conjureFactory;
    let cnj;

    let owner, addr1, addr2, addr3, addr4;
    const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

    it('CloneLibrary works', async () => {
        const test = await deploy('TestClone');
        await test.deployed();
    })

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

    describe('Implementations locked', () => {
        it('Conjure', async () => {
            expect(await conjureImplementation._factoryContract()).to.eq(`0x${'00'.repeat(19)}01`);
        })

        it('EtherCollateral', async () => {
            expect(await etherCollateralImplementation._factoryContract()).to.eq(`0x${'00'.repeat(19)}01`);
        })
    })

    describe('ConjureMint()', async () => {
        let conjure, ethercollateral;

        it('Should deploy conjure contract', async () => {
            const tx = await conjureFactory.ConjureMint(
                "TEST",
                "SYMBOL",
                owner.address,
                owner.address,
                100,
                "150000000000000000000"
            );
            const {events, cumulativeGasUsed, gasUsed} = await tx.wait();
            console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
            console.log(`Gas: ${gasUsed.toNumber()}`)
            const [event] = events.filter(e => e.event === "NewConjure");
            conjure = await ethers.getContractAt("Conjure", event.args.conjure);
            ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);
        })


        it('Should deploy init conjure contract', async () => {
            const tx = await conjure.init(
                1,
                0,
                0,
                ["0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"],
                [0],
                ["signature1"],
                [0x00],
                [0],
                [100],
                [8]
            );
            const {events, cumulativeGasUsed, gasUsed} = await tx.wait();
            console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
            console.log(`Gas: ${gasUsed.toNumber()}`)
        })

    })


});
