const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OperatorRegistry", function () {
  async function deployFixture() {
    const [owner, operator, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("OperatorRegistry", owner);
    const registry = await factory.deploy(owner.address);
    return { registry, owner, operator, other };
  }

  const categoryStandard = ethers.encodeBytes32String("STANDARD");
  const categoryDisabled = ethers.encodeBytes32String("DISABLED");

  it("registers an operator with initial categories", async function () {
    const { registry, owner, operator } = await deployFixture();

    await expect(registry.registerOperator(1, operator.address, "Central Garage", [categoryStandard, categoryDisabled]))
      .to.emit(registry, "OperatorRegistered")
      .withArgs(1, operator.address, "Central Garage");
    await expect(registry.registerOperator(2, operator.address, "Another Garage", [categoryStandard]))
      .to.emit(registry, "SupportedCategoryUpdated")
      .withArgs(2, categoryStandard, true);

    expect(await registry.isWhitelisted(1)).to.equal(true);
    expect(await registry.getOperatorWallet(1)).to.equal(operator.address);
    expect(await registry.supportsCategory(1, categoryStandard)).to.equal(true);
    expect(await registry.supportsCategory(1, categoryDisabled)).to.equal(true);

    const stored = await registry.getOperator(1);
    expect(stored.name).to.equal("Central Garage");
    expect(stored.whitelisted).to.equal(true);
    expect(stored.wallet).to.equal(operator.address);

    await expect(registry.connect(owner).registerOperator(1, operator.address, "Duplicate", [])).to.be.revertedWithCustomError(
      registry,
      "OperatorAlreadyExists",
    );
  });

  it("rejects zero address and non-owner registration", async function () {
    const { registry, operator } = await deployFixture();

    const [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("OperatorRegistry", owner);
    await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(registry, "ZeroAddressNotAllowed");

    await expect(registry.registerOperator(1, ethers.ZeroAddress, "Broken", [])).to.be.revertedWithCustomError(
      registry,
      "ZeroAddressNotAllowed",
    );

    await expect(registry.connect(operator).registerOperator(1, operator.address, "Broken", [])).to.be.revertedWithCustomError(
      registry,
      "OwnableUnauthorizedAccount",
    );

    await expect(registry.connect(operator).removeOperator(1)).to.be.revertedWithCustomError(
      registry,
      "OwnableUnauthorizedAccount",
    );
  });

  it("allows operator self-service updates only for the registered wallet", async function () {
    const { registry, owner, operator, other } = await deployFixture();

    await registry.registerOperator(1, operator.address, "Central Garage", [categoryStandard]);

    await expect(registry.connect(other).setPricePerHour(1, categoryStandard, 100)).to.be.revertedWithCustomError(
      registry,
      "NotOperatorWallet",
    );

    await expect(registry.connect(other).setSupportedCategory(1, categoryDisabled, true)).to.be.revertedWithCustomError(
      registry,
      "NotOperatorWallet",
    );

    await expect(registry.connect(other).setNoShowFee(1, 25)).to.be.revertedWithCustomError(
      registry,
      "NotOperatorWallet",
    );

    await registry.connect(operator).setSupportedCategory(1, categoryDisabled, true);
    await registry.connect(operator).setPricePerHour(1, categoryStandard, 100);
    await registry.connect(operator).setNoShowFee(1, 25);

    expect(await registry.supportsCategory(1, categoryDisabled)).to.equal(true);
    expect(await registry.getPricePerHour(1, categoryStandard)).to.equal(100);
    expect(await registry.getNoShowFee(1)).to.equal(25);

    await registry.connect(owner).removeOperator(1);
    expect(await registry.isWhitelisted(1)).to.equal(false);

    await expect(registry.connect(operator).setPricePerHour(1, categoryStandard, 200)).to.be.revertedWithCustomError(
      registry,
      "OperatorNotWhitelisted",
    );
  });

  it("preserves operator record after removal and blocks unknown operators", async function () {
    const { registry, owner, operator } = await deployFixture();

    await expect(registry.removeOperator(1)).to.be.revertedWithCustomError(registry, "OperatorNotFound");

    await registry.registerOperator(1, operator.address, "Central Garage", []);
    await expect(registry.removeOperator(1)).to.emit(registry, "OperatorRemoved").withArgs(1);

    const stored = await registry.getOperator(1);
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