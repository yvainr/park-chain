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

contract FuzzParkChainTest {
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

    /// @notice Fuzz test for reservation fee calculation and credit flow
    /// @param duration number of hours reserved (1..24)
    /// @param price price per hour in credits (1..100)
    function testFuzz_reservationFee(uint8 duration, uint128 price) public {
        // bounds
        if (duration == 0) return;
        if (duration > 24) return;
        if (price == 0) return;
        if (price > 100) return; // keep fee small so it fits into initial credits

        setUp();

        // set operator price as operator wallet
        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, STANDARD, uint256(price));

        // member purchases membership
        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        // create reservation
        uint256 startTime = block.timestamp + 1 hours;
        vm.prank(member);
        ledger.reserve(OPERATOR_ID, ParkingLedger.SlotCategory.Standard, startTime, duration);

        // check-in at startTime
        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(0);

        uint256 expectedFee = uint256(price) * uint256(duration);
        // skip randomized cases where member doesn't have enough credits
        uint256 memberBalance = credit.balanceOf(member, credit.PARK_CREDIT());
        if (expectedFee > memberBalance) return;
        // burn credits and allocate earnings
        credit.burn(member, expectedFee);
        treasury.allocateEarnings(OPERATOR_ID, expectedFee);

        // assertions: credits decreased and earnings increased
        require(credit.balanceOf(member, credit.PARK_CREDIT()) + expectedFee == 100, "credit arithmetic mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == expectedFee, "treasury earnings mismatch");
    }
}
