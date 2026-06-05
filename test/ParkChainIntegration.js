import { expect } from "chai";
import hardhat from "hardhat";

const { ethers, network } = hardhat;

describe("ParkChain integration", function () {
  const URBAN = 1;
  const OPERATOR_ID = 77;
  const STANDARD = ethers.keccak256(ethers.toUtf8Bytes("standard"));
  const EV_CHARGING = ethers.keccak256(ethers.toUtf8Bytes("ev-charging"));

  async function deploySystemFixture() {
    const [admin, member, operator, stranger] = await ethers.getSigners();

    const Credit = await ethers.getContractFactory("contracts/src/ParkCredit.sol:ParkCredit", admin);
    const credit = await Credit.deploy();

    const Membership = await ethers.getContractFactory("contracts/src/MembershipManager.sol:MembershipManager", admin);
    const membership = await Membership.deploy(await credit.getAddress());

    const Registry = await ethers.getContractFactory("contracts/src/OperatorRegistry.sol:OperatorRegistry", admin);
    const registry = await Registry.deploy();

    const Treasury = await ethers.getContractFactory("contracts/src/OperatorTreasury.sol:OperatorTreasury", admin);
    const treasury = await Treasury.deploy(await registry.getAddress(), ethers.parseEther("0.001"));

    const Ledger = await ethers.getContractFactory("contracts/src/ParkingLedger.sol:ParkingLedger", admin);
    const ledger = await Ledger.deploy();

    await credit.setMinter(await membership.getAddress(), true);
    await credit.setBurner(admin.address, true);
    await membership.setTier(URBAN, "Urban", 100, ethers.parseEther("0.01"), 20, true);
    await ledger.setGracePeriod(15);
    await treasury.setAllocator(admin.address);

    await registry.registerOperator(OPERATOR_ID, operator.address, "Central Garage", [STANDARD, EV_CHARGING]);
    await registry.connect(operator).setPricePerHour(OPERATOR_ID, STANDARD, 10);
    await registry.connect(operator).setPricePerHour(OPERATOR_ID, EV_CHARGING, 15);
    await registry.connect(operator).setNoShowFee(OPERATOR_ID, 4);

    return { admin, member, operator, stranger, credit, membership, registry, treasury, ledger };
  }

  it("runs the member reservation and operator payout flow across all contracts", async function () {
    const { admin, member, operator, credit, membership, registry, treasury, ledger } = await deploySystemFixture();

    await membership.connect(member).purchaseMembership(URBAN, { value: ethers.parseEther("0.01") });

    expect(await membership.isMemberActive(member.address)).to.equal(true);
    expect(await membership.getMemberTier(member.address)).to.equal(URBAN);
    expect(await membership.getMemberMonthlyHourCap(member.address)).to.equal(20);
    expect(await credit.balanceOf(member.address, await credit.PARK_CREDIT())).to.equal(100);

    expect(await registry.isWhitelisted(OPERATOR_ID)).to.equal(true);
    expect(await registry.supportsCategory(OPERATOR_ID, STANDARD)).to.equal(true);
    expect(await registry.getPricePerHour(OPERATOR_ID, STANDARD)).to.equal(10);

    const latest = await ethers.provider.getBlock("latest");
    const startTime = latest.timestamp + 3600;

    await ledger.connect(member).reserve(OPERATOR_ID, 0, startTime, 2);

    const reservationIds = await ledger.getActiveReservation(member.address);
    expect(reservationIds.length).to.equal(1);
    expect(reservationIds[0]).to.equal(0);

    const reserved = await ledger.getReservation(0);
    expect(reserved.member).to.equal(member.address);
    expect(reserved.operatorID).to.equal(OPERATOR_ID);
    expect(reserved.category).to.equal(0);
    expect(reserved.status).to.equal(0);

    await network.provider.send("evm_setNextBlockTimestamp", [startTime]);
    await ledger.connect(member).checkIn(0);

    const reservedFee = (await registry.getPricePerHour(OPERATOR_ID, STANDARD)) * reserved.duration;
    await credit.connect(admin).burn(member.address, reservedFee);
    await treasury.allocateEarnings(OPERATOR_ID, reservedFee);

    const checkedIn = await ledger.getReservation(0);
    expect(checkedIn.checkInTime).to.equal(startTime);
    expect(checkedIn.status).to.equal(1);
    expect(await credit.balanceOf(member.address, await credit.PARK_CREDIT())).to.equal(80);
    expect(await treasury.getAccumulatedEarnings(OPERATOR_ID)).to.equal(20);

    await network.provider.send("evm_setNextBlockTimestamp", [startTime + 2 * 3600 + 10 * 60]);
    await ledger.connect(member).checkOut(0);

    const checkedOut = await ledger.getReservation(0);
    expect(checkedOut.status).to.equal(2);

    await admin.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("1") });
    await expect(treasury.connect(operator).withdraw(OPERATOR_ID)).to.changeEtherBalance(
      operator,
      ethers.parseEther("0.02"),
    );
    expect(await treasury.getAccumulatedEarnings(OPERATOR_ID)).to.equal(0);
  });

  it("runs cancellation, no-show settlement, and cross-contract guard paths", async function () {
    const { member, operator, stranger, credit, membership, registry, treasury, ledger } = await deploySystemFixture();

    await membership.connect(member).purchaseMembership(URBAN, { value: ethers.parseEther("0.01") });

    const latest = await ethers.provider.getBlock("latest");
    const cancelStart = latest.timestamp + 3600;
    await ledger.connect(member).reserve(OPERATOR_ID, 2, cancelStart, 1);
    await ledger.connect(member).cancelReservation(0);

    const cancelled = await ledger.getReservation(0);
    expect(cancelled.status).to.equal(3);
    expect(await credit.balanceOf(member.address, await credit.PARK_CREDIT())).to.equal(100);

    const noShowStart = cancelStart + 3600;
    await ledger.connect(member).reserve(OPERATOR_ID, 0, noShowStart, 1);

    await network.provider.send("evm_setNextBlockTimestamp", [noShowStart]);
    await ledger.markNoShow(1);

    const noShowFee = await registry.getNoShowFee(OPERATOR_ID);
    await credit.burn(member.address, noShowFee);
    await treasury.allocateEarnings(OPERATOR_ID, noShowFee);

    const noShow = await ledger.getReservation(1);
    expect(noShow.status).to.equal(4);
    expect(await credit.balanceOf(member.address, await credit.PARK_CREDIT())).to.equal(96);
    expect(await treasury.getAccumulatedEarnings(OPERATOR_ID)).to.equal(4);

    await expect(
      membership.connect(stranger).setTier(2, "Commuter", 200, ethers.parseEther("0.02"), 60, true),
    ).to.be.revertedWith("MembershipManager: not owner");
    await expect(registry.connect(stranger).removeOperator(OPERATOR_ID)).to.be.revertedWith(
      "OperatorRegistry: not owner",
    );
    await expect(registry.connect(stranger).setPricePerHour(OPERATOR_ID, STANDARD, 99)).to.be.revertedWith(
      "OperatorRegistry: not operator wallet",
    );
    await expect(treasury.connect(stranger).allocateEarnings(OPERATOR_ID, 1)).to.be.revertedWith(
      "OperatorTreasury: not allocator",
    );
    await expect(credit.connect(stranger).burn(member.address, 1)).to.be.revertedWith("Not authorized to burn");

    await registry.removeOperator(OPERATOR_ID);
    await expect(registry.connect(operator).setNoShowFee(OPERATOR_ID, 5)).to.be.revertedWith(
      "OperatorRegistry: not whitelisted",
    );
  });
});
