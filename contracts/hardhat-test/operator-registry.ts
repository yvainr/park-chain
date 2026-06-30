import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EV_CHARGING,
  FAMILY_SLOT,
  STANDARD,
  WOMEN_SLOT,
  networkHelpers,
  viem,
} from "./helpers.js";

async function deployRegistryFixture() {
  const [, operator, stranger] = await viem.getWalletClients();
  const registry = await viem.deployContract("OperatorRegistry");

  return { registry, operator, stranger };
}

describe("OperatorRegistry", function () {
  it("lets the admin register and remove an operator", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([
      1n,
      operator.account.address,
      "Central Garage",
      [STANDARD, EV_CHARGING, FAMILY_SLOT, WOMEN_SLOT],
    ]);

    assert.equal(await registry.read.isWhitelisted([1n]), true);
    assert.equal(await registry.read.supportsCategory([1n, STANDARD]), true);
    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), true);
    assert.equal(await registry.read.supportsCategory([1n, FAMILY_SLOT]), true);
    assert.equal(await registry.read.supportsCategory([1n, WOMEN_SLOT]), true);
    assert.equal((await registry.read.getOperatorWallet([1n])).toLowerCase(), operator.account.address);
    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 1n);

    await registry.write.removeOperator([1n]);

    assert.equal(await registry.read.isWhitelisted([1n]), false);
    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 0n);
  });

  it("lets the admin register and configure an operator in one transaction", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperatorWithSetup([
      1n,
      operator.account.address,
      "Central Garage",
      [STANDARD, EV_CHARGING],
      [10n, 12n],
      [100n, 20n],
      5n,
    ]);

    assert.equal(await registry.read.isWhitelisted([1n]), true);
    assert.equal(await registry.read.supportsCategory([1n, STANDARD]), true);
    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), true);
    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 10n);
    assert.equal(await registry.read.getPricePerHour([1n, EV_CHARGING]), 12n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 100n);
    assert.equal(await registry.read.getCategoryCapacity([1n, EV_CHARGING]), 20n);
    assert.equal(await registry.read.getNoShowFee([1n]), 5n);
    assert.equal((await registry.read.getOperatorWallet([1n])).toLowerCase(), operator.account.address);
  });

  it("keeps wallet-to-operator IDs and operator IDs unique", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.registerOperator([2n, operator.account.address, "Second Garage", [STANDARD]]),
      "OperatorRegistry: wallet already registered",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, stranger.account.address, "New Central Garage", [STANDARD]]),
      "OperatorRegistry: operator ID already exists",
    );

    assert.equal(await registry.read.operatorIdByWallet([operator.account.address]), 1n);
    assert.equal(await registry.read.operatorIdByWallet([stranger.account.address]), 0n);
    assert.equal((await registry.read.getOperatorWallet([1n])).toLowerCase(), operator.account.address);
  });

  it("rejects non-admin registration and removal", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]], {
        account: stranger.account,
      }),
      "OperatorRegistry: not owner",
    );

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.removeOperator([1n], { account: stranger.account }),
      "OperatorRegistry: not owner",
    );
  });

  it("rejects invalid registration and unknown operator admin actions", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, "0x0000000000000000000000000000000000000000", "Central Garage", [STANDARD]]),
      "OperatorRegistry: zero wallet",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperator([1n, operator.account.address, "", [STANDARD]]),
      "OperatorRegistry: empty name",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperatorWithSetup([
        1n,
        operator.account.address,
        "Central Garage",
        [STANDARD],
        [],
        [100n],
        5n,
      ]),
      "OperatorRegistry: price length mismatch",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperatorWithSetup([
        1n,
        operator.account.address,
        "Central Garage",
        [STANDARD],
        [10n],
        [],
        5n,
      ]),
      "OperatorRegistry: capacity length mismatch",
    );

    await viem.assertions.revertWith(
      registry.write.registerOperatorWithSetup([
        1n,
        operator.account.address,
        "Central Garage",
        [STANDARD],
        [10n],
        [0n],
        5n,
      ]),
      "OperatorRegistry: invalid capacity",
    );

    await viem.assertions.revertWith(registry.write.removeOperator([404n]), "OperatorRegistry: unknown operator");
    await viem.assertions.revertWith(
      registry.write.setSupportedCategory([404n, STANDARD, true]),
      "OperatorRegistry: unknown operator",
    );
  });

  it("lets the admin and operator wallet set price, no-show fee, and capacity", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, STANDARD, 10n], { account: stranger.account }),
      "OperatorRegistry: not owner or operator wallet",
    );

    await viem.assertions.revertWith(
      registry.write.setNoShowFee([1n, 3n], { account: stranger.account }),
      "OperatorRegistry: not owner or operator wallet",
    );

    await viem.assertions.revertWith(
      registry.write.setCategoryCapacity([1n, STANDARD, 10n], { account: stranger.account }),
      "OperatorRegistry: not owner or operator wallet",
    );

    await registry.write.setPricePerHour([1n, STANDARD, 8n]);
    await registry.write.setNoShowFee([1n, 2n]);
    await registry.write.setCategoryCapacity([1n, STANDARD, 9n]);

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 8n);
    assert.equal(await registry.read.getNoShowFee([1n]), 2n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 9n);

    await registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account });
    await registry.write.setNoShowFee([1n, 3n], { account: operator.account });
    await registry.write.setCategoryCapacity([1n, STANDARD, 10n], { account: operator.account });

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 10n);
    assert.equal(await registry.read.getNoShowFee([1n]), 3n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 10n);
  });

  it("lets the operator update all supported category settings in one transaction", async function () {
    const { registry, operator, stranger } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperatorWithSetup([
      1n,
      operator.account.address,
      "Central Garage",
      [STANDARD, EV_CHARGING],
      [10n, 12n],
      [100n, 20n],
      5n,
    ]);

    await viem.assertions.revertWith(
      registry.write.updateOperatorSettings([1n, [STANDARD], [11n], [90n], 6n], { account: stranger.account }),
      "OperatorRegistry: not owner or operator wallet",
    );

    await viem.assertions.revertWith(
      registry.write.updateOperatorSettings([1n, [STANDARD], [], [90n], 6n], { account: operator.account }),
      "OperatorRegistry: price length mismatch",
    );

    await viem.assertions.revertWith(
      registry.write.updateOperatorSettings([1n, [STANDARD], [11n], [], 6n], { account: operator.account }),
      "OperatorRegistry: capacity length mismatch",
    );

    await viem.assertions.revertWith(
      registry.write.updateOperatorSettings([1n, [FAMILY_SLOT], [11n], [90n], 6n], { account: operator.account }),
      "OperatorRegistry: unsupported category",
    );

    await viem.assertions.revertWith(
      registry.write.updateOperatorSettings([1n, [STANDARD], [11n], [0n], 6n], { account: operator.account }),
      "OperatorRegistry: invalid capacity",
    );

    await registry.write.updateOperatorSettings(
      [1n, [STANDARD, EV_CHARGING], [11n, 13n], [90n, 25n], 6n],
      { account: operator.account },
    );

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 11n);
    assert.equal(await registry.read.getPricePerHour([1n, EV_CHARGING]), 13n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 90n);
    assert.equal(await registry.read.getCategoryCapacity([1n, EV_CHARGING]), 25n);
    assert.equal(await registry.read.getNoShowFee([1n]), 6n);

    await registry.write.updateOperatorSettings([1n, [STANDARD], [12n], [95n], 7n]);

    assert.equal(await registry.read.getPricePerHour([1n, STANDARD]), 12n);
    assert.equal(await registry.read.getCategoryCapacity([1n, STANDARD]), 95n);
    assert.equal(await registry.read.getNoShowFee([1n]), 7n);
  });

  it("rejects pricing unsupported categories and removed operators", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, EV_CHARGING, 10n], { account: operator.account }),
      "OperatorRegistry: unsupported category",
    );

    await registry.write.removeOperator([1n]);

    await viem.assertions.revertWith(
      registry.write.setPricePerHour([1n, STANDARD, 10n], { account: operator.account }),
      "OperatorRegistry: not whitelisted",
    );

    await viem.assertions.revertWith(
      registry.write.setNoShowFee([1n, 3n], { account: operator.account }),
      "OperatorRegistry: not whitelisted",
    );
  });

  it("lets the admin update category support", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [STANDARD]]);

    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), false);

    await registry.write.setSupportedCategory([1n, EV_CHARGING, true]);
    assert.equal(await registry.read.supportsCategory([1n, EV_CHARGING]), true);

    await registry.write.setSupportedCategory([1n, STANDARD, false]);
    assert.equal(await registry.read.supportsCategory([1n, STANDARD]), false);
  });

  it("supports family and women slot categories", async function () {
    const { registry, operator } = await networkHelpers.loadFixture(deployRegistryFixture);

    assert.equal(await registry.read.FAMILY_SLOT_CATEGORY(), FAMILY_SLOT);
    assert.equal(await registry.read.WOMEN_SLOT_CATEGORY(), WOMEN_SLOT);

    await registry.write.registerOperator([1n, operator.account.address, "Central Garage", [FAMILY_SLOT, WOMEN_SLOT]]);

    await registry.write.setPricePerHour([1n, FAMILY_SLOT, 12n], { account: operator.account });
    await registry.write.setPricePerHour([1n, WOMEN_SLOT, 9n], { account: operator.account });

    assert.equal(await registry.read.supportsCategory([1n, FAMILY_SLOT]), true);
    assert.equal(await registry.read.supportsCategory([1n, WOMEN_SLOT]), true);
    assert.equal(await registry.read.getPricePerHour([1n, FAMILY_SLOT]), 12n);
    assert.equal(await registry.read.getPricePerHour([1n, WOMEN_SLOT]), 9n);
  });
});
