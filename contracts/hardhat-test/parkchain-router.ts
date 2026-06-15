import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keccak256, stringToBytes, zeroAddress } from "viem";
import { networkHelpers, viem } from "./helpers.js";

const PARK_CREDIT = keccak256(stringToBytes("ParkCredit"));
const MEMBERSHIP_MANAGER = keccak256(stringToBytes("MembershipManager"));
const OPERATOR_REGISTRY = keccak256(stringToBytes("OperatorRegistry"));
const OPERATOR_TREASURY = keccak256(stringToBytes("OperatorTreasury"));
const PARKING_LEDGER = keccak256(stringToBytes("ParkingLedger"));
const ZERO_KEY = "0x0000000000000000000000000000000000000000000000000000000000000000";
const CONTRACT_ADDRESS_UPDATED_TOPIC = keccak256(stringToBytes("ContractAddressUpdated(bytes32,address)"));

function addressTopic(address: `0x${string}`) {
  return `0x${"0".repeat(24)}${address.slice(2)}`.toLowerCase();
}

async function deployRouterFixture() {
  const [owner, stranger, targetOne, targetTwo, targetThree, targetFour, targetFive] = await viem.getWalletClients();
  const router = await viem.deployContract("ParkChainRouter");

  return { owner, stranger, targetOne, targetTwo, targetThree, targetFour, targetFive, router };
}

describe("ParkChainRouter", function () {
  it("sets owner and exposes stable contract keys", async function () {
    const { owner, router } = await networkHelpers.loadFixture(deployRouterFixture);

    assert.equal((await router.read.owner()).toLowerCase(), owner.account.address);
    assert.equal(await router.read.PARK_CREDIT(), PARK_CREDIT);
    assert.equal(await router.read.MEMBERSHIP_MANAGER(), MEMBERSHIP_MANAGER);
    assert.equal(await router.read.OPERATOR_REGISTRY(), OPERATOR_REGISTRY);
    assert.equal(await router.read.OPERATOR_TREASURY(), OPERATOR_TREASURY);
    assert.equal(await router.read.PARKING_LEDGER(), PARKING_LEDGER);
  });

  it("lets the owner set and read a single contract address", async function () {
    const { targetOne, router } = await networkHelpers.loadFixture(deployRouterFixture);
    const publicClient = await viem.getPublicClient();

    const hash = await router.write.setContract([PARK_CREDIT, targetOne.account.address]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    assert.equal((await router.read.getContract([PARK_CREDIT])).toLowerCase(), targetOne.account.address);
    assert.equal((await router.read.requireContract([PARK_CREDIT])).toLowerCase(), targetOne.account.address);
    assert.equal(receipt.logs.length, 1);
    assert.equal(receipt.logs[0].topics[0], CONTRACT_ADDRESS_UPDATED_TOPIC);
    assert.equal(receipt.logs[0].topics[1], PARK_CREDIT);
    assert.equal(receipt.logs[0].topics[2]?.toLowerCase(), addressTopic(targetOne.account.address));
  });

  it("lets the owner batch set all known contract addresses", async function () {
    const { targetOne, targetTwo, targetThree, targetFour, targetFive, router } =
      await networkHelpers.loadFixture(deployRouterFixture);
    const publicClient = await viem.getPublicClient();
    const keys = [PARK_CREDIT, MEMBERSHIP_MANAGER, OPERATOR_REGISTRY, OPERATOR_TREASURY, PARKING_LEDGER];
    const addresses = [
      targetOne.account.address,
      targetTwo.account.address,
      targetThree.account.address,
      targetFour.account.address,
      targetFive.account.address,
    ];

    const hash = await router.write.setContracts([keys, addresses]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(receipt.logs.length, keys.length);
    for (let i = 0; i < keys.length; i++) {
      assert.equal((await router.read.getContract([keys[i]])).toLowerCase(), addresses[i]);
      assert.equal(receipt.logs[i].topics[0], CONTRACT_ADDRESS_UPDATED_TOPIC);
      assert.equal(receipt.logs[i].topics[1], keys[i]);
      assert.equal(receipt.logs[i].topics[2]?.toLowerCase(), addressTopic(addresses[i]));
    }
  });

  it("rejects non-owner address updates", async function () {
    const { stranger, targetOne, router } = await networkHelpers.loadFixture(deployRouterFixture);

    await viem.assertions.revertWithCustomError(
      router.write.setContract([PARK_CREDIT, targetOne.account.address], { account: stranger.account }),
      router,
      "OwnableUnauthorizedAccount",
    );

    await viem.assertions.revertWithCustomError(
      router.write.setContracts([[PARK_CREDIT], [targetOne.account.address]], { account: stranger.account }),
      router,
      "OwnableUnauthorizedAccount",
    );
  });

  it("rejects zero keys, zero addresses, and mismatched batch lengths", async function () {
    const { targetOne, router } = await networkHelpers.loadFixture(deployRouterFixture);

    await viem.assertions.revertWith(
      router.write.setContract([ZERO_KEY, targetOne.account.address]),
      "ParkChainRouter: zero key",
    );

    await viem.assertions.revertWith(
      router.write.setContract([PARK_CREDIT, zeroAddress]),
      "ParkChainRouter: zero address",
    );

    await viem.assertions.revertWith(
      router.write.setContracts([[PARK_CREDIT, MEMBERSHIP_MANAGER], [targetOne.account.address]]),
      "ParkChainRouter: length mismatch",
    );

    await viem.assertions.revertWith(
      router.write.setContracts([[PARK_CREDIT, ZERO_KEY], [targetOne.account.address, targetOne.account.address]]),
      "ParkChainRouter: zero key",
    );

    await viem.assertions.revertWith(
      router.write.setContracts([[PARK_CREDIT], [zeroAddress]]),
      "ParkChainRouter: zero address",
    );
  });

  it("returns zero for unset keys and reverts when requiring an unset key", async function () {
    const { router } = await networkHelpers.loadFixture(deployRouterFixture);

    assert.equal(await router.read.getContract([PARK_CREDIT]), zeroAddress);

    await viem.assertions.revertWith(
      router.read.requireContract([PARK_CREDIT]),
      "ParkChainRouter: contract not set",
    );
  });
});
