// imports
const {expect} = require("chai");
const {ethers} = require("hardhat");

// test suite for Conjure Factory
describe("Test Conjure Factory Deploy Functions (Gas)", function () {

    // variable to store the deployed smart contract
    let conjureImplementation;
    let etherCollateralImplementation;
    let conjureFactory;
    let mock;

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
        it('Should show the deployed conjure contracts gas consumption', async () => {
            const tx = await conjureFactory.ConjureMint(
                [[0], [0], [100], [8]],
                [0x00],
                ["signature1"],
                [mock.address],
                [[1, 1], [100, "150000000000000000000"]],
                [owner.address, owner.address, mock.address],
                ["TEST", "SYMBOL"],
                0
            );
            const {events, cumulativeGasUsed, gasUsed,} = await tx.wait();
            console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
            console.log(`Gas: ${gasUsed.toNumber()}`)
            const [event] = events.filter(e => e.event === "NewConjure");
            conjure = await ethers.getContractAt("Conjure", event.args.conjure);
            ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);


        })

        it('Check initialize Conjure', async () => {
            await expect(conjureImplementation.initialize(
                ["NAME", "SYMBOL"],
                [],
                owner.address,
                owner.address
            )).to.be.revertedWith("already initialized");
        })

        it('Check initialize EtherCollateral', async () => {
            await expect(etherCollateralImplementation.initialize(
                owner.address,
                owner.address,
                owner.address,
                [1,1]
            )).to.be.revertedWith("already initialized");
        })

    })
});
