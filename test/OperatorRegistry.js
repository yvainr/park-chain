import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("OperatorRegistry", function () {
  async function deployFixture() {
    const [owner, operator, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("contracts/src/OperatorRegistry.sol:OperatorRegistry", owner);
    const registry = await factory.deploy();
    return { registry, owner, operator, other };
  }

  const categoryStandard = ethers.keccak256(ethers.toUtf8Bytes("standard"));
  const categoryDisabled = ethers.keccak256(ethers.toUtf8Bytes("disabled"));

  it("registers an operator with initial categories", async function () {
    const { registry, owner, operator, other } = await deployFixture();

    await expect(registry.registerOperator(1, operator.address, "Central Garage", [categoryStandard, categoryDisabled]))
      .to.emit(registry, "OperatorRegistered")
      .withArgs(1, operator.address, "Central Garage");
    await registry.registerOperator(2, operator.address, "Another Garage", [categoryStandard]);
    expect(await registry.supportsCategory(2, categoryStandard)).to.equal(true);

    expect(await registry.isWhitelisted(1)).to.equal(true);
    expect(await registry.getOperatorWallet(1)).to.equal(operator.address);
    expect(await registry.supportsCategory(1, categoryStandard)).to.equal(true);
    expect(await registry.supportsCategory(1, categoryDisabled)).to.equal(true);

    const stored = await registry.operators(1);
    expect(stored.name).to.equal("Central Garage");
    expect(stored.whitelisted).to.equal(true);
    expect(stored.wallet).to.equal(operator.address);

    await registry.connect(owner).registerOperator(1, other.address, "Duplicate", []);
    const overwritten = await registry.operators(1);
    expect(overwritten.name).to.equal("Duplicate");
    expect(overwritten.wallet).to.equal(other.address);
  });

  it("rejects zero address and non-owner registration", async function () {
    const { registry, operator } = await deployFixture();

    await expect(registry.registerOperator(1, ethers.ZeroAddress, "Broken", [])).to.be.revertedWith(
      "OperatorRegistry: zero wallet",
    );

    await expect(registry.registerOperator(1, operator.address, "", [])).to.be.revertedWith(
      "OperatorRegistry: empty name",
    );

    await expect(registry.connect(operator).registerOperator(1, operator.address, "Broken", [])).to.be.revertedWith(
      "OperatorRegistry: not owner",
    );

    await expect(registry.connect(operator).removeOperator(1)).to.be.revertedWith("OperatorRegistry: not owner");
  });

  it("allows operator self-service updates only for the registered wallet", async function () {
    const { registry, owner, operator, other } = await deployFixture();

    await registry.registerOperator(1, operator.address, "Central Garage", [categoryStandard]);

    await expect(registry.connect(other).setPricePerHour(1, categoryStandard, 100)).to.be.revertedWith(
      "OperatorRegistry: not operator wallet",
    );

    await expect(registry.connect(other).setNoShowFee(1, 25)).to.be.revertedWith(
      "OperatorRegistry: not operator wallet",
    );

    await registry.connect(owner).setSupportedCategory(1, categoryDisabled, true);
    await registry.connect(operator).setPricePerHour(1, categoryStandard, 100);
    await registry.connect(operator).setNoShowFee(1, 25);

    expect(await registry.supportsCategory(1, categoryDisabled)).to.equal(true);
    expect(await registry.getPricePerHour(1, categoryStandard)).to.equal(100);
    expect(await registry.getNoShowFee(1)).to.equal(25);

    await registry.connect(owner).removeOperator(1);
    expect(await registry.isWhitelisted(1)).to.equal(false);

    await expect(registry.connect(operator).setPricePerHour(1, categoryStandard, 200)).to.be.revertedWith(
      "OperatorRegistry: not whitelisted",
    );
  });

  it("preserves operator record after removal and blocks unknown operators", async function () {
    const { registry, owner, operator } = await deployFixture();

    await expect(registry.removeOperator(1)).to.be.revertedWith("OperatorRegistry: unknown operator");

    await registry.registerOperator(1, operator.address, "Central Garage", []);
    await expect(registry.removeOperator(1)).to.emit(registry, "OperatorRemoved").withArgs(1);

    const stored = await registry.operators(1);
    expect(stored.wallet).to.equal(operator.address);
    expect(stored.whitelisted).to.equal(false);

    await expect(registry.connect(owner).removeOperator(1)).to.emit(registry, "OperatorRemoved").withArgs(1);
    expect(await registry.isWhitelisted(1)).to.equal(false);
  });

  it("returns zero values for unknown operators", async function () {
    const { registry } = await deployFixture();

    expect(await registry.isWhitelisted(99)).to.equal(false);
    expect(await registry.supportsCategory(99, categoryStandard)).to.equal(false);
    expect(await registry.getPricePerHour(99, categoryStandard)).to.equal(0);
    expect(await registry.getNoShowFee(99)).to.equal(0);
    expect(await registry.getOperatorWallet(99)).to.equal(ethers.ZeroAddress);
  });
});
