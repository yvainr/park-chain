// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";
import {ParkCredit} from "../src/ParkCredit.sol";
import {ParkingLedger} from "../src/ParkingLedger.sol";

interface IntegrationVm {
    function deal(address account, uint256 newBalance) external;
    function deployCode(string calldata artifactPath) external returns (address deployedAddress);
    function deployCode(
        string calldata artifactPath,
        bytes calldata constructorArgs
    ) external returns (address deployedAddress);
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes calldata revertData) external;
}

contract ParkChainIntegrationTest {
    IntegrationVm private constant vm =
        IntegrationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private membership;
    OperatorRegistry private registry;
    OperatorTreasury private treasury;
    ParkingLedger private ledger;

    address private member = address(0xA11CE);
    address private operatorWallet = address(0xB0B);
    address private stranger = address(0xBAD);

    uint256 private constant URBAN = 1;
    uint256 private constant OPERATOR_ID = 77;
    bytes32 private constant STANDARD = keccak256("standard");
    bytes32 private constant EV_CHARGING = keccak256("ev-charging");

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(member, 10 ether);
        vm.deal(operatorWallet, 1 ether);
        vm.deal(stranger, 1 ether);

        credit = ParkCredit(vm.deployCode("src/ParkCredit.sol:ParkCredit"));
        membership = MembershipManager(
            vm.deployCode("src/MembershipManager.sol:MembershipManager", abi.encode(IMembershipParkCredit(address(credit))))
        );
        registry = OperatorRegistry(vm.deployCode("src/OperatorRegistry.sol:OperatorRegistry"));
        treasury = OperatorTreasury(
            payable(
                vm.deployCode(
                    "src/OperatorTreasury.sol:OperatorTreasury", abi.encode(IOperatorRegistry(address(registry)), 0.001 ether)
                )
            )
        );
        ledger = ParkingLedger(vm.deployCode("src/ParkingLedger.sol:ParkingLedger"));

        credit.setMinter(address(membership), true);
        credit.setBurner(address(this), true);

        membership.setTier(URBAN, "Urban", 100, 0.01 ether, 20, true);
        ledger.setGracePeriod(15);
        treasury.setAllocator(address(this));

        bytes32[] memory categories = new bytes32[](2);
        categories[0] = STANDARD;
        categories[1] = EV_CHARGING;
        registry.registerOperator(OPERATOR_ID, operatorWallet, "Central Garage", categories);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, STANDARD, 10);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, EV_CHARGING, 15);

        vm.prank(operatorWallet);
        registry.setNoShowFee(OPERATOR_ID, 4);
    }

    function testCompleteMvpSystemFlowAcrossAllContracts() public {
        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        require(membership.isMemberActive(member), "member should be active");
        require(membership.getMemberTier(member) == URBAN, "tier mismatch");
        require(membership.getMemberMonthlyHourCap(member) == 20, "hour cap mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 100, "initial credits mismatch");

        require(registry.isWhitelisted(OPERATOR_ID), "operator should be whitelisted");
        require(registry.supportsCategory(OPERATOR_ID, STANDARD), "standard category unsupported");
        require(registry.getPricePerHour(OPERATOR_ID, STANDARD) == 10, "standard price mismatch");
        require(registry.getNoShowFee(OPERATOR_ID) == 4, "no-show fee mismatch");

        uint256 startTime = block.timestamp + 1 hours;

        vm.prank(member);
        ledger.reserve(OPERATOR_ID, ParkingLedger.SlotCategory.Standard, startTime, 2);

        uint256[] memory reservations = ledger.getActiveReservation(member);
        require(reservations.length == 1, "reservation list length mismatch");
        require(reservations[0] == 0, "reservation id mismatch");

        ParkingLedger.Reservation memory reserved = ledger.getReservation(0);
        require(reserved.member == member, "reservation member mismatch");
        require(reserved.operatorID == OPERATOR_ID, "reservation operator mismatch");
        require(uint256(reserved.category) == uint256(ParkingLedger.SlotCategory.Standard), "category mismatch");
        require(reserved.status == ParkingLedger.ReservationStatus.Reserved, "reservation should be reserved");

        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(0);

        uint256 reservedFee = registry.getPricePerHour(OPERATOR_ID, STANDARD) * reserved.duration;
        credit.burn(member, reservedFee);
        treasury.allocateEarnings(OPERATOR_ID, reservedFee);

        ParkingLedger.Reservation memory checkedIn = ledger.getReservation(0);
        require(checkedIn.checkInTime == startTime, "check-in time mismatch");
        require(checkedIn.status == ParkingLedger.ReservationStatus.CheckedIn, "reservation should be checked in");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 80, "credits after check-in mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 20, "earnings after check-in mismatch");

        vm.warp(startTime + 2 hours + 10 minutes);
        vm.prank(member);
        ledger.checkOut(0);

        ParkingLedger.Reservation memory checkedOut = ledger.getReservation(0);
        require(checkedOut.status == ParkingLedger.ReservationStatus.CheckedOut, "reservation should be checked out");

        vm.deal(address(treasury), 1 ether);
        uint256 operatorBalanceBefore = operatorWallet.balance;

        vm.prank(operatorWallet);
        treasury.withdraw(OPERATOR_ID);

        require(operatorWallet.balance == operatorBalanceBefore + 0.02 ether, "withdraw amount mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 0, "earnings should be cleared");
    }

    function testSystemSupportsCancellationAndNoShowSettlementPaths() public {
        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        uint256 cancelStart = block.timestamp + 1 hours;
        vm.prank(member);
        ledger.reserve(OPERATOR_ID, ParkingLedger.SlotCategory.EVCharging, cancelStart, 1);

        vm.prank(member);
        ledger.cancelReservation(0);

        ParkingLedger.Reservation memory cancelled = ledger.getReservation(0);
        require(cancelled.status == ParkingLedger.ReservationStatus.Cancelled, "reservation should be cancelled");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 100, "free cancellation should not burn credits");

        uint256 noShowStart = block.timestamp + 2 hours;
        vm.prank(member);
        ledger.reserve(OPERATOR_ID, ParkingLedger.SlotCategory.Standard, noShowStart, 1);

        vm.warp(noShowStart);
        ledger.markNoShow(1);

        uint256 noShowFee = registry.getNoShowFee(OPERATOR_ID);
        credit.burn(member, noShowFee);
        treasury.allocateEarnings(OPERATOR_ID, noShowFee);

        ParkingLedger.Reservation memory noShow = ledger.getReservation(1);
        require(noShow.status == ParkingLedger.ReservationStatus.NoShow, "reservation should be no-show");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 96, "credits after no-show mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 4, "no-show earnings mismatch");
    }

    function testCrossContractGuardsProtectTheSystemSetup() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("MembershipManager: not owner"));
        membership.setTier(2, "Commuter", 200, 0.02 ether, 60, true);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not owner"));
        registry.removeOperator(OPERATOR_ID);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorRegistry: not operator wallet"));
        registry.setPricePerHour(OPERATOR_ID, STANDARD, 99);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorTreasury: not owner"));
        treasury.setCreditToEthRate(0.002 ether);

        vm.prank(stranger);
        vm.expectRevert(bytes("OperatorTreasury: not allocator"));
        treasury.allocateEarnings(OPERATOR_ID, 1);

        vm.prank(stranger);
        vm.expectRevert(bytes("Not authorized to burn"));
        credit.burn(member, 1);
    }

    function testRemovedOperatorCannotBeConfiguredForNewBusiness() public {
        registry.removeOperator(OPERATOR_ID);
        require(!registry.isWhitelisted(OPERATOR_ID), "operator should be removed");

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorRegistry: not whitelisted"));
        registry.setPricePerHour(OPERATOR_ID, STANDARD, 12);

        vm.prank(operatorWallet);
        vm.expectRevert(bytes("OperatorRegistry: not whitelisted"));
        registry.setNoShowFee(OPERATOR_ID, 5);
    }
}
