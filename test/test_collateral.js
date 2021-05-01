// imports
const {expect} = require("chai");
const {ethers} = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const errorDelta = 1e-4;
const {waffle} = require("hardhat");
const provider = waffle.provider;

function calcRelativeDiff(expected, actual) {
    const diff = BigNumber.from(expected).sub(actual).toNumber();
    return Math.abs(diff / expected);
}

// test suite for EtherCollateral Factory
describe("EtherCollateral Tests", function () {

    // variable to store the deployed smart contract
    let conjureImplementation;
    let etherCollateralImplementation;
    let conjureFactory;
    let mock;
    let mock2000;
    let mock3000;
    let mockinverse;
    let mock18dec;
    let pool;
    let router;

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

        // deploy staking pool
        const POOL = await ethers.getContractFactory("StakingRewards");

        pool = await POOL.deploy(owner.address, owner.address, zeroaddress);
        await pool.deployed();

        // deploy router
        const ROUTER = await ethers.getContractFactory("ConjureRouter");

        router = await ROUTER.deploy(pool.address, owner.address);
        await router.deployed();

        // set rewards distribution
        await pool.setRewardsDistribution(router.address)

        // deploy conjure factory
        conjureFactory = await deploy(
            'ConjureFactory',
            conjureImplementation.address,
            etherCollateralImplementation.address,
            router.address
        );

        // deploy oracle mock
        let MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK");
        mock = await MOCK.deploy();
        await mock.deployed();

        MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_2000");
        mock2000 = await MOCK.deploy();
        await mock2000.deployed();

        MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_3000");
        mock3000 = await MOCK.deploy();
        await mock3000.deployed();

        MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK_INVERSE_TEST");
        mockinverse = await MOCK.deploy();
        await mockinverse.deployed();

        MOCK = await ethers.getContractFactory("ETHUSDOracle_MOCK18Decimals");
        mock18dec = await MOCK.deploy();
        await mock18dec.deployed();
    })

    it("Should init the contract", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);
    });

    it("Should be able to find the generated COLLATERAL CONTRACT", async function () {
        let ratio = await ethercollateral.collateralizationRatio();
        expect(ratio).to.equal("120000000000000000000");
    });

    it("Should not be able to open a loan with too low collateralization ratio", async function () {
        // send 1 eth
        let overrides = {
            //value: "49000000000000000"
            value: "49000000000000000"
        };

        // should get loan for 1 arb asset
        await expect(ethercollateral.openLoan("1000000000000000000", overrides)).to.be.revertedWith("Not enough ETH to create this loan. Please see the minLoanCollateralSize");
    });

    it("Should not to increase the minting fee and also not to set it too high", async function () {
        await expect(ethercollateral.setIssueFeeRate(200)).to.be.revertedWith("Fee can only be lowered");
    });

    it("Should not be able to call asset closed", async function () {
        await expect(ethercollateral.setAssetClosed()).to.be.revertedWith("Only Conjure contract can call");
    });

    it("Should be able to lower the minting fee", async function () {
        await ethercollateral.setIssueFeeRate(0);

        const fee = await ethercollateral.issueFeeRate();
        expect(fee).to.equal(0);
    });

    it("Should be able to open a loan", async function () {
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 1.6 eth so 150% c-ratio
        let overrides = {
            value: "1600000000000000000"
        };

        // should get loan for 1 arb asset
        await ethercollateral.openLoan(amountToBorrow, overrides);

        let numloans = await ethercollateral.totalOpenLoanCount()
        let totalLoansCreated = await ethercollateral.totalLoansCreated()
        let totalIssuedSynths = await ethercollateral.totalIssuedSynths()
        let openLoanIDsByAccount = await ethercollateral.getOpenLoanIDsByAccount(owner.address)
        let getLoan = await ethercollateral.getLoan(owner.address, openLoanIDsByAccount[0])

        expect(numloans).to.be.equal("1");
        expect(totalLoansCreated).to.be.equal("1");
        expect(totalIssuedSynths).to.be.equal("1000000000000000000");
        expect(openLoanIDsByAccount.length).to.be.equal(1);
        expect(getLoan.loanID).to.be.equal("1");

    });

    it("check loan Properties", async function () {
        const loan = await (ethercollateral.getLoan(owner.address, 1));
        const ratio = await ethercollateral.getLoanCollateralRatio(owner.address, 1);
        const collateralizationRatio = await ethercollateral.collateralizationRatio();
        const issueratio = await ethercollateral.issuanceRatio();
        const mintingfee = await ethercollateral.getMintingFee(owner.address, 1);
        const openloans = await ethercollateral.getOpenLoanIDsByAccount(owner.address);

        const unit = BigNumber.from("1000000000000000000");
        const calc_ratio = BigNumber.from("100000000000000000000").mul(unit).div(collateralizationRatio);

        expect(loan.account).to.equal(owner.address);
        expect(ratio).to.equal("1600000000000000000");

        const diff = calcRelativeDiff(calc_ratio, issueratio);
        expect(diff).to.be.lessThan(errorDelta);
        expect(mintingfee).to.be.equal(0);
        expect(openloans.length).to.be.equal(1);
    });

    it("should be able to close a loan", async function () {
        const tx = await (ethercollateral.closeLoan(1));
        const {blockNumber} = await tx.wait();
        const block = await provider.getBlock(blockNumber);


        const loan = await (ethercollateral.getLoan(owner.address, 1));
        expect(loan.timeClosed).to.be.equal(block.timestamp);
    });

    it("should not be able to close a loan with insufficient funds", async function () {
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 1.6 eth
        let overrides = {
            value: "1600000000000000000"
        };

        // should get loan for 1 arb asset
        await ethercollateral.openLoan(amountToBorrow, overrides);
        await conjure.transfer(addr1.address, "500000000000000000")

        await expect(ethercollateral.closeLoan(2)).to.be.revertedWith("You do not have the required Synth balance to close this loan.");
        const loan = await (ethercollateral.getLoan(owner.address, 2));

        // loan is still open
        expect(loan.timeClosed).to.equal(0);
    });

    it("should be able to repay a loan", async function () {
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 2 eth so 200%
        let overrides = {
            value: "2000000000000000000"
        };

        // should get loan for 1 arb asset
        await ethercollateral.openLoan(amountToBorrow, overrides);
        const ratio = await ethercollateral.getLoanCollateralRatio(owner.address, 3);

        expect(ratio).to.equal("2000000000000000000");

        await ethercollateral.repayLoan(owner.address, 3, "500000000000000000")
        const ratioafter = await ethercollateral.getLoanCollateralRatio(owner.address, 3);

        expect(ratioafter).to.be.equal("4000000000000000000")
    });

    it("should be able to deposit collateral", async function () {
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 2.0
        let overrides = {
            value: "2000000000000000000"
        };

        let overrides0 = {
            value: "0"
        };

        // should get loan for 1 arb asset
        await ethercollateral.openLoan(amountToBorrow, overrides);
        const ratio = await ethercollateral.getLoanCollateralRatio(owner.address, 4);
        expect(ratio).to.equal("2000000000000000000");

        // deposit more than 0
        await expect(ethercollateral.depositCollateral(owner.address, 4, overrides0)).to.be.revertedWith("Deposit amount must be greater than 0");

        await ethercollateral.depositCollateral(owner.address, 4, overrides)
        const ratioafter = await ethercollateral.getLoanCollateralRatio(owner.address, 4);

        expect(ratioafter).to.be.equal("4000000000000000000")
    });

    it("should be able to withdraw collateral", async function () {
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 2.0 eth
        let overrides = {
            value: "2000000000000000000"
        };

        // should get loan for 1 arb asset
        await ethercollateral.openLoan(amountToBorrow, overrides);
        const ratio = await ethercollateral.getLoanCollateralRatio(owner.address, 5);
        expect(ratio).to.equal("2000000000000000000");

        // withdraw more than 0
        await expect(ethercollateral.withdrawCollateral(5, "0")).to.be.revertedWith("Amount to withdraw must be greater than 0");
        // dont allow to withdraw below c-ratio
        await expect(ethercollateral.withdrawCollateral(5, "2000000000000000000")).to.be.revertedWith("Collateral ratio below liquidation after withdraw");

        // withdraw now
        await ethercollateral.withdrawCollateral(5, "100000000000000000");
        const ratioafter = await ethercollateral.getLoanCollateralRatio(owner.address, 5);

        expect(ratioafter).to.be.equal("1900000000000000000")
    });

    /**
     * @dev Gets the amount to liquidate which can potentially fix the c ratio given this formula:
     * r = target issuance ratio
     * D = debt balance
     * V = Collateral
     * P = liquidation penalty
     * Calculates amount of synths = (D - V * r) / (1 - (1 + P) * r)
     * */
    it("should be able to return the right liquidation amount", async function () {
        // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
        let loanvalue = BigNumber.from("1000000000000000000")
        let collateralvalue = BigNumber.from("1200000000000000000")
        const liquiratio = await ethercollateral.liquidationRatio();

        // calc amount to liquidate and fix c ratio
        const amounttoliquidate = await ethercollateral.calculateAmountToLiquidate(loanvalue, collateralvalue);

        // get loan amount after
        const loanamountafter = loanvalue.sub(amounttoliquidate)

        // get collateral after (add 10% penalty)
        const collateralafter = collateralvalue.sub(amounttoliquidate.div(100).mul(110))

        // get new c ratio
        const newCRatio = collateralafter.mul("1000000000000000000").div(loanamountafter);

        // target should be around 150%
        const diff = calcRelativeDiff(newCRatio, liquiratio);
        expect(diff).to.be.lessThan(errorDelta);
    });

    it("should return 0 for correct minimum c ratio", async function () {
        // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
        let loanvalue = BigNumber.from("1000000000000000000")
        let collateralvalue = BigNumber.from("1200000000000000000")

        // calc amount to liquidate and fix c ratio
        const amounttoliquidate = await ethercollateral.calculateAmountToLiquidate(loanvalue, collateralvalue);
        expect(amounttoliquidate).to.be.equal(0);

    });

    it("should not fix a loan with c ratio below 110", async function () {
        // 120% c-ratio should be able to get fixed cause we should have it at 150% at creation time
        let loanvalue = BigNumber.from("1000000000000000000")
        let collateralvalue = BigNumber.from("1000000000000000000")

        // calc amount to liquidate and fix c ratio
        const amounttoliquidate = await ethercollateral.calculateAmountToLiquidate(loanvalue, collateralvalue);

        // get loan amount after
        const loanamountafter = loanvalue.sub(amounttoliquidate)

        // check if result is less than 0 and then evaluate the test case
        if (loanamountafter < 0) {
            expect(true).to.be.true
        } else {
            expect(false).to.be.true
        }
    });

    it("should not be able to call liquidate with no funds", async function () {
        await expect(ethercollateral.connect(addr1).liquidateLoan(owner.address, 5, "1000000000000000000")).to.be.revertedWith("Not enough balance");
    });

    it("should not be able to call liquidate on a healthy loan", async function () {
        // open a loan for addr1 to have some funds
        // get amount needed
        const amountToBorrow = "1000000000000000000";

        // send 1.6 eth
        let overrides = {
            value: "1600000000000000000"
        };

        // should get loan for 1 arb asset
        await ethercollateral.connect(addr1).openLoan(amountToBorrow, overrides);
        await expect(ethercollateral.connect(addr1).liquidateLoan(owner.address, 5, "1000000000000000000")).to.be.revertedWith("Collateral ratio above liquidation ratio");
    });

    it("Should be able to call get contract info", async function () {
        await ethercollateral.connect(addr1).getContractInfo();
    });

    it("Should be able to distribute the minting fee", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);


        // get amount needed
        const amountToBorrow = "1";
        const ethvalue = BigNumber.from("1010000000000000000")

        // send 1.01 eth
        let overrides = {
            value: ethvalue
        };

        let contractBalanceBefore = await provider.getBalance(conjure.address);
        let routerBalanceBefore = await provider.getBalance(router.address);

        // should get loan for 1 asset
        await ethercollateral.openLoan(amountToBorrow, overrides);

        let contractBalanceAfter = await provider.getBalance(conjure.address);
        let routerBalanceAfter = await provider.getBalance(router.address);

        const routerfee = ethvalue.mul("100").div("10100").div("4")
        const expectrouter = routerBalanceBefore.add(routerfee)

        expect(routerBalanceAfter.toString()).to.be.equal(expectrouter.toString())
        expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(ethvalue.mul(100).div(100 + 10000).sub(routerfee)))
    });

    it("Should be reverted cause setup with too high minting fee", async function () {
        await expect(conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [251, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        )).to.be.revertedWith("Minting fee too high");
    });

    it("should be reverted cause call from non owner", async function () {
        await expect(ethercollateral.connect(addr1).setIssueFeeRate("50")).to.be.revertedWith("Only the contract owner may perform this action");
    });

    it("should get actual synth loans", async function () {

        await ethercollateral.closeLoan(1);
        let loans = await ethercollateral.getOpenLoanIDsByAccount(owner.address)

        expect(loans.length).to.be.equal(0);
    });

    it("should not be able to open a loan exceeding max borrowing power", async function () {
        // get amount needed
        const amountToBorrow = "1100000000000000000";

        // send 1.6 eth
        let overrides = {
            value: "1200000000000000000"
        };

        await expect(ethercollateral.connect(addr1).openLoan(amountToBorrow, overrides)).to.be.revertedWith("Loan amount exceeds max borrowing power");
    });

    it("should not be able to close a loan that doesnt exist or which is already closed", async function () {
        await expect(ethercollateral.closeLoan(99)).to.be.revertedWith("Loan does not exist");
        await expect(ethercollateral.closeLoan(1)).to.be.revertedWith("Loan already closed");
    });

    it("should not be able to open a loan with too less funds sent to cover fee + collateral", async function () {
        // get amount needed
        const amountToBorrow = "999999999999999999";

        let overrides = {
            value: "1200000000000000000"
        };

        await expect(ethercollateral.openLoan(amountToBorrow, overrides)).to.be.revertedWith("Not enough funds sent to cover fee and collateral");
    });

    it("Should not be able to repay a loan with not enough funds", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

        // get amount needed
        const amountToBorrow = "1";

        let overrides = {
            value: "50000000000000000"
        };

        // open a loan
        await ethercollateral.openLoan(amountToBorrow, overrides)

        // send away the funds
        await conjure.transfer(addr1.address, "1")

        await expect(ethercollateral.repayLoan(owner.address, 1, "1")).to.be.revertedWith("Not enough balance")
    });

    it("Should not be able to have more than 50 loans in the system per user", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

        // get amount needed
        const amountToBorrow = "1";

        let overrides = {
            value: "50000000000000000"
        };

        let i;
        for (i = 0; i < 50; i++) {
            await ethercollateral.openLoan(amountToBorrow, overrides)
        }
        await expect(ethercollateral.openLoan(amountToBorrow, overrides)).to.be.revertedWith("Each account is limited to 50 loans")
    });

    it("Basic ERC20 Tests for Conjure asset", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

        // get amount needed
        const amountToBorrow = "2";

        let overrides = {
            value: "50000000000000000"
        };

        // open a loan
        await ethercollateral.openLoan(amountToBorrow, overrides)

        // check allowance
        let allow = await conjure.allowance(owner.address, addr1.address)
        expect(allow).to.be.equal(0)

        // not approve 0 address
        await expect(conjure.approve(zeroaddress, "1")).to.be.revertedWith("ERC20: approve to the zero address")

        // approve 1 asset
        await conjure.approve(addr1.address, "2")
        allow = await conjure.allowance(owner.address, addr1.address)
        expect(allow).to.be.equal("2")

        // transfer checks
        await expect(conjure.transfer(zeroaddress, "1")).to.be.revertedWith("ERC20: transfer to the zero address")
        await expect(conjure.transfer(addr1.address, "3")).to.be.revertedWith("ERC20: transfer amount exceeds balance")

        // transfer from
        await expect(conjure.connect(addr1).transferFrom(owner.address, addr2.address, "3")).to.be.revertedWith("CONJURE::transferFrom: transfer amount exceeds spender allowance")

        await conjure.transferFrom(owner.address, addr1.address, "1");
        let amount = await conjure.balanceOf(addr1.address);
        expect(amount).to.be.equal("1")

        conjure.connect(addr1).transferFrom(owner.address, addr2.address, "1")
        amount = await conjure.balanceOf(addr1.address);
        expect(amount).to.be.equal("1")

    });

    it("Should be able to change the owner", async function () {
        const tx = await conjureFactory.ConjureMint(
            [[0], [0], [100], [8]],
            [0x00],
            ["signature1"],
            [[mock.address],[zeroaddress]],
            [[1, 0], [100, "120000000000000000000"]],
            [owner.address, mock.address],
            ["NAME", "SYMBOL"],
            false
        );

        const {events} = await tx.wait();
        const [event] = events.filter(e => e.event === "NewConjure");
        conjure = await ethers.getContractAt("Conjure", event.args.conjure);
        ethercollateral = await ethers.getContractAt("EtherCollateral", event.args.etherCollateral);

        await expect(ethercollateral.connect(addr1).changeOwner(addr1.address)).to.be.revertedWith("Only the contract owner may perform this action");

        await ethercollateral.changeOwner(addr1.address)

        let owneraddress = await ethercollateral.owner();

        expect(addr1.address).to.be.equal(owneraddress);

    });
});
