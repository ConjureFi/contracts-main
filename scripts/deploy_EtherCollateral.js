async function main() {
    // We get the contract to deploy

    // deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();
    console.log("SafeDecimalMath deployed to:", temp.address);

    const EtherCollateral = await ethers.getContractFactory("EtherCollateral",
        {
            libraries: {SafeDecimalMath: temp.address}
        });
    const ethercollateral = await EtherCollateral.deploy();
    await ethercollateral.deployed();
    console.log("EtherCollateral deployed to:", ethercollateral.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
