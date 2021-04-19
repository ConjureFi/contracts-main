async function main() {
    // We get the contract to deploy

    const Conjure = await ethers.getContractFactory("Conjure");
    const conjure = await Conjure.deploy();
    await conjure.deployed();
    console.log("Conjure deployed to:", conjure.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
