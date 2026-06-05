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
}

contract ParkChainInvariantHandler {
    IntegrationVm private constant vm = IntegrationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkingLedger public immutable ledger;
    OperatorTreasury public immutable treasury;

    address private immutable ledgerOwner;
    uint256 private immutable operatorId;

    uint256 public createdReservations;
    uint256 public allocatedCredits;

    constructor(ParkingLedger ledger_, OperatorTreasury treasury_, address ledgerOwner_, uint256 operatorId_) {
        ledger = ledger_;
        treasury = treasury_;
        ledgerOwner = ledgerOwner_;
        operatorId = operatorId_;
    }

    function reserve(uint256 startOffset, uint8 duration) external {
        uint256 boundedDuration = (uint256(duration) % 24) + 1;
        uint256 startTime = block.timestamp + (startOffset % 30 days) + 1;

        ledger.reserve(operatorId, ParkingLedger.SlotCategory.Standard, startTime, boundedDuration);
        createdReservations++;
    }

    function cancel(uint256 seed) external {
        if (createdReservations == 0) return;

        uint256 reservationId = seed % createdReservations;
        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationId);
        if (reservation.member != address(this) || reservation.status != ParkingLedger.ReservationStatus.Reserved) return;
        if (block.timestamp >= reservation.startTime) return;

        ledger.cancelReservation(reservationId);
    }

    function checkIn(uint256 seed) external {
        if (createdReservations == 0) return;

        uint256 reservationId = seed % createdReservations;
        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationId);
        if (reservation.member != address(this) || reservation.status != ParkingLedger.ReservationStatus.Reserved) return;

        vm.warp(reservation.startTime);
        ledger.checkIn(reservationId);
    }

    function checkOut(uint256 seed) external {
        if (createdReservations == 0) return;

        uint256 reservationId = seed % createdReservations;
        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationId);
        if (reservation.member != address(this) || reservation.status != ParkingLedger.ReservationStatus.CheckedIn) return;

        ledger.checkOut(reservationId);
    }

    function markNoShow(uint256 seed) external {
        if (createdReservations == 0) return;

        uint256 reservationId = seed % createdReservations;
        ParkingLedger.Reservation memory reservation = ledger.getReservation(reservationId);
        if (reservation.member != address(this) || reservation.status != ParkingLedger.ReservationStatus.Reserved) return;

        vm.warp(reservation.startTime);
        vm.prank(ledgerOwner);
        ledger.markNoShow(reservationId);
    }

    function allocate(uint96 amount) external {
        uint256 boundedAmount = (uint256(amount) % 1_000) + 1;

        treasury.allocateEarnings(operatorId, boundedAmount);
        allocatedCredits += boundedAmount;
    }
}

contract ParkChainInvariantTest {
    IntegrationVm private constant vm = IntegrationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private membership;
    OperatorRegistry private registry;
    OperatorTreasury private treasury;
    ParkingLedger private ledger;

    address private member = address(0xA11CE);
    address private operatorWallet = address(0xB0B);
    ParkChainInvariantHandler private handler;

    uint256 private constant URBAN = 1;
    uint256 private constant OPERATOR_ID = 77;
    bytes32 private constant STANDARD = keccak256("standard");

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(member, 10 ether);
        vm.deal(operatorWallet, 1 ether);

        credit = ParkCredit(vm.deployCode("src/ParkCredit.sol:ParkCredit"));
        membership = MembershipManager(
            vm.deployCode("src/MembershipManager.sol:MembershipManager", abi.encode(IMembershipParkCredit(address(credit))))
        );
        registry = OperatorRegistry(vm.deployCode("src/OperatorRegistry.sol:OperatorRegistry"));
        treasury = OperatorTreasury(
            payable(vm.deployCode("src/OperatorTreasury.sol:OperatorTreasury", abi.encode(IOperatorRegistry(address(registry)), 0.001 ether)))
        );
        ledger = ParkingLedger(vm.deployCode("src/ParkingLedger.sol:ParkingLedger"));

        credit.setMinter(address(membership), true);
        credit.setBurner(address(this), true);

        membership.setTier(URBAN, "Urban", 100, 0.01 ether, 20, true);
        ledger.setGracePeriod(15);
        treasury.setAllocator(address(this));

        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(OPERATOR_ID, operatorWallet, "Central Garage", categories);

        handler = new ParkChainInvariantHandler(ledger, treasury, address(this), OPERATOR_ID);
        treasury.setAllocator(address(handler));
    }

    /// @notice Invariant: every created reservation is stored at its sequential ID.
    function invariant_reservationIdsAreSequential() public view {
        uint256 nextId = ledger.nextReservationID();

        uint256[] memory reservations = ledger.getActiveReservation(address(handler));
        assert(reservations.length == handler.createdReservations());

        for (uint256 i = 0; i < nextId; i++) {
            ParkingLedger.Reservation memory reservation = ledger.getReservation(i);
            assert(reservation.reservationID == i);
            assert(reservation.member != address(0));
            assert(reservation.duration > 0);
        }

        for (uint256 i = 0; i < reservations.length; i++) {
            ParkingLedger.Reservation memory reservation = ledger.getReservation(reservations[i]);
            assert(reservation.member == address(handler));
        }
    }

    /// @notice Invariant: treasury accounting matches all successful handler allocations.
    function invariant_treasuryMatchesAllocatedCredits() public view {
        assert(treasury.getAccumulatedEarnings(OPERATOR_ID) == handler.allocatedCredits());
    }
}
