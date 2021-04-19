// imports
const {expect} = require("chai");
const {ethers} = require("hardhat");
const hre = require("hardhat");

// test suite for Conjure Factory
describe("Test Setup", function () {

    // variable to store the deployed smart contract
    let conjureImplementation;
    let etherCollateralImplementation;
    let conjureFactory;
    let mock;
    let clonemock;

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
        let MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
        mock = await MOCK.deploy();
        await mock.deployed();

        MOCK = await ethers.getContractFactory("ConjureFactoryMock");
        clonemock = await MOCK.deploy(
            conjureImplementation.address,
            etherCollateralImplementation.address
        );
        await clonemock.deployed();
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


        it('Should revert if Conjure already inited', async () => {

            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [conjureFactory.address]}
            )

            // send 1 eth
            const tx = await owner.sendTransaction({
                to: conjureFactory.address,
                value: ethers.utils.parseEther("1.0")
            });

            const signer = await ethers.provider.getSigner(conjureFactory.address)

            await expect(conjure.connect(signer).init(
                false,
                [1,1],
                [],
                [[],[],[],[]],
                [],
                []
            )).to.be.revertedWith("Contract already inited");

            await hre.network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [conjureFactory.address]}
            )
        })

        it('Should revert if tried to init the clone contracts with zero address', async () => {
            const tx = await clonemock.getClones();
            const {events} = await tx.wait();
            const [event] = events.filter(e => e.event === "NewConjure");
            conjure = await ethers.getContractAt("Conjure", event.args.conjure);
            ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

            await expect(conjure.initialize(
                ["test","symbol"],
                [],
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000"
            )).to.be.revertedWith("factory can not be null");

            await expect(ethercollateral.initialize(
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
                [1,500]
            )).to.be.revertedWith("factory can not be null");

        })

    })
});
