async function main() {
    // We get the contract to deploy
    const ConjureFactory = await ethers.getContractFactory("ConjureFactory");
    const conjure = await ConjureFactory.deploy();
    await conjure.deployed();
    console.log("ConjureFactory deployed to:", conjure.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
