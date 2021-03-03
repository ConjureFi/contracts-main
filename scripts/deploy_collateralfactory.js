async function main() {
	// deploy safemath lib
    const SAFELIB = await ethers.getContractFactory("SafeDecimalMath");
    let temp = await SAFELIB.deploy();
    await temp.deployed();
    console.log("SafeDecimalMath deployed to:", temp.address);
	
	// We get the contract to deploy
    const EtherCollateralFactory = await ethers.getContractFactory("EtherCollateralFactory",
	        {
          libraries: {SafeDecimalMath: temp.address}
        }
	);
    const factory = await EtherCollateralFactory.deploy();
    await factory.deployed();
    console.log("EtherCollateralFactory deployed to:", factory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
