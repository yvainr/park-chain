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

contract ParkChainInvariantTest {
    IntegrationVm private constant vm = IntegrationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private membership;
    OperatorRegistry private registry;
    OperatorTreasury private treasury;
    ParkingLedger private ledger;

    address private member = address(0xA11CE);
    address private operatorWallet = address(0xB0B);

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
    }

    /// @notice Invariant: per-member active reservation count never exceeds global nextReservationID
    function invariant_reservationCountsConservative() public view {
        uint256[] memory reservations = ledger.getActiveReservation(member);
        uint256 nextId = ledger.nextReservationID();
        assert(reservations.length <= nextId);
    }

    /// @notice Invariant: accumulated earnings for operator fits a reasonable upper bound (safety check)
    function invariant_treasuryBounded() public view {
        uint256 acc = treasury.getAccumulatedEarnings(OPERATOR_ID);
        // sanity bound: ensure test-run allocations (if any) are not absurdly large
        assert(acc <= 1_000_000);
    }
}
