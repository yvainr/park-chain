// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";
import {
    IParkingMembershipManager,
    IParkingOperatorRegistry,
    IParkingOperatorTreasury,
    IParkingParkCredit,
    ParkingLedger
} from "../src/ParkingLedger.sol";
import {ParkCredit} from "../src/ParkCredit.sol";

interface ParkingLedgerVm {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes calldata revertData) external;
}

contract ParkingLedgerTest {
    ParkingLedgerVm private constant vm = ParkingLedgerVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private membership;
    OperatorRegistry private registry;
    OperatorTreasury private treasury;
    ParkingLedger private ledger;

    address private member = address(0x1001);
    address private operatorWallet = address(0x2002);
    address private stranger = address(0x3003);

    bytes32 private constant STANDARD = keccak256("standard");
    bytes32 private constant EV_CHARGING = keccak256("ev-charging");
    bytes32 private constant FAMILY_SLOT = keccak256("family");
    bytes32 private constant WOMEN_SLOT = keccak256("women");

    uint256 private constant OPERATOR_ID = 1;
    uint256 private constant URBAN = 1;

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(member, 10 ether);

        credit = new ParkCredit();
        membership = new MembershipManager(IMembershipParkCredit(address(credit)));
        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.01 ether);
        ledger = new ParkingLedger(
            IParkingMembershipManager(address(membership)),
            IParkingOperatorRegistry(address(registry)),
            IParkingParkCredit(address(credit)),
            IParkingOperatorTreasury(address(treasury))
        );

        credit.setMinter(address(membership), true);
        credit.setBurner(address(ledger), true);
        treasury.setAllocator(address(ledger));
        ledger.setGracePeriodMinutes(15);

        membership.setTier(URBAN, "Urban", 80, 0.01 ether, 20, true);

        bytes32[] memory categories = new bytes32[](4);
        categories[0] = STANDARD;
        categories[1] = EV_CHARGING;
        categories[2] = FAMILY_SLOT;
        categories[3] = WOMEN_SLOT;
        registry.registerOperator(OPERATOR_ID, operatorWallet, "Central Garage", categories);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, STANDARD, 10);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, EV_CHARGING, 12);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, FAMILY_SLOT, 11);

        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, WOMEN_SLOT, 9);

        vm.prank(operatorWallet);
        registry.setNoShowFee(OPERATOR_ID, 5);
    }

    function testValidReservationSucceedsAndTracksMonthlyUsage() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;

        uint256 reservationID = _reserve(member, OPERATOR_ID, FAMILY_SLOT, startTime, 2);
        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);
        uint256 monthKey = ledger.getMonthKey(startTime);

        require(reservation.member == member, "member mismatch");
        require(reservation.operatorID == OPERATOR_ID, "operator mismatch");
        require(reservation.category == FAMILY_SLOT, "category mismatch");
        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.Reserved), "status mismatch");
        require(ledger.getUsedHoursByCategory(member, FAMILY_SLOT, monthKey) == 2, "category usage mismatch");
        require(ledger.getUsedHoursByOperator(member, OPERATOR_ID, monthKey) == 2, "operator usage mismatch");
    }

    function testReserveRevertsForInactiveMemberUnsupportedCategoryAndRemovedOperator() public {
        uint256 startTime = block.timestamp + 1 hours;

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: inactive member"));
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, 1);

        _purchaseUrban(member);

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: unsupported category"));
        ledger.reserve(OPERATOR_ID, keccak256("unknown"), startTime, 1);

        registry.removeOperator(OPERATOR_ID);

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: operator not whitelisted"));
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, 1);
    }

    function testExpiredMembershipCannotReserve() public {
        _purchaseUrban(member);
        vm.warp(membership.getMembershipExpiry(member));

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: inactive member"));
        ledger.reserve(OPERATOR_ID, STANDARD, block.timestamp + 1 hours, 1);
    }

    function testOverlappingReservationRevertsForSameMemberOperatorAndCategory() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;

        _reserve(member, OPERATOR_ID, STANDARD, startTime, 3);

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: overlap"));
        ledger.reserve(OPERATOR_ID, STANDARD, startTime + 1 hours, 2);
    }

    function testMonthlyCategoryCapAndOperatorCapAreEnforced() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;

        _reserve(member, OPERATOR_ID, STANDARD, startTime, 20);

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: category cap exceeded"));
        ledger.reserve(OPERATOR_ID, STANDARD, startTime + 21 hours, 1);

        address secondMember = address(0x4004);
        vm.deal(secondMember, 10 ether);
        _purchaseUrban(secondMember);

        _reserve(secondMember, OPERATOR_ID, STANDARD, startTime, 12);

        vm.prank(secondMember);
        vm.expectRevert(bytes("ParkingLedger: operator cap exceeded"));
        ledger.reserve(OPERATOR_ID, EV_CHARGING, startTime + 13 hours, 9);
    }

    function testCancellationBeforeStartIsFreeAndReleasesUsage() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 3);
        uint256 monthKey = ledger.getMonthKey(startTime);

        vm.prank(member);
        ledger.cancelReservation(reservationID);

        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);

        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.Cancelled), "status mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 80, "credits should be unchanged");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 0, "earnings should be zero");
        require(ledger.getUsedHoursByCategory(member, STANDARD, monthKey) == 0, "category usage should release");
        require(ledger.getUsedHoursByOperator(member, OPERATOR_ID, monthKey) == 0, "operator usage should release");
    }

    function testCheckInBeforeStartRevertsAndCheckInChargesCredits() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 2);

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: too early"));
        ledger.checkIn(reservationID);

        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(reservationID);

        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);

        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.CheckedIn), "status mismatch");
        require(reservation.checkInTime == startTime, "check-in mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 60, "reserved charge mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 20, "earnings mismatch");
    }

    function testCheckOutWithoutOverstayChargesNoExtraFee() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 2);

        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(reservationID);

        vm.warp(startTime + 2 hours + 10 minutes);
        vm.prank(member);
        ledger.checkOut(reservationID);

        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);

        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.CheckedOut), "status mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 60, "credits should only include check-in charge");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 20, "earnings should only include check-in charge");
    }

    function testCheckOutAfterGracePeriodChargesRoundedOverstayFee() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 2);

        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(reservationID);

        vm.warp(startTime + 3 hours);
        vm.prank(member);
        ledger.checkOut(reservationID);

        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 50, "overstay charge mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 30, "earnings mismatch");
    }

    function testNoShowChargesFeeAndReleasesUsage() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 2);
        uint256 monthKey = ledger.getMonthKey(startTime);

        vm.warp(startTime);
        vm.prank(stranger);
        ledger.markNoShow(reservationID);

        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);

        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.NoShow), "status mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 75, "no-show charge mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 5, "earnings mismatch");
        require(ledger.getUsedHoursByCategory(member, STANDARD, monthKey) == 0, "category usage should release");
        require(ledger.getUsedHoursByOperator(member, OPERATOR_ID, monthKey) == 0, "operator usage should release");
    }

    function testCancellationAfterStartSettlesAsNoShow() public {
        _purchaseUrban(member);
        uint256 startTime = block.timestamp + 1 hours;
        uint256 reservationID = _reserve(member, OPERATOR_ID, STANDARD, startTime, 2);

        vm.warp(startTime);
        vm.prank(member);
        ledger.cancelReservation(reservationID);

        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationID);

        require(uint256(reservation.status) == uint256(ParkingLedger.ReservationStatus.NoShow), "status mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 75, "no-show charge mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == 5, "earnings mismatch");
    }

    function _purchaseUrban(address account) private {
        vm.prank(account);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);
    }

    function _reserve(
        address account,
        uint256 operatorID,
        bytes32 category,
        uint256 startTime,
        uint256 duration
    ) private returns (uint256 reservationID) {
        vm.prank(account);
        reservationID = ledger.reserve(operatorID, category, startTime, duration);
    }
}
