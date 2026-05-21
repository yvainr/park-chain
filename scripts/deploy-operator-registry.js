const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("OperatorRegistry", deployer);
  const registry = await factory.deploy(deployer.address);
  await registry.waitForDeployment();

  console.log(`OperatorRegistry deployed to ${await registry.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});