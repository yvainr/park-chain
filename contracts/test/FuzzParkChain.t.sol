// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";
import {ParkCredit} from "../src/ParkCredit.sol";
import {
    IParkingMembershipManager,
    IParkingOperatorRegistry,
    IParkingOperatorTreasury,
    IParkingParkCredit,
    ParkingLedger
} from "../src/ParkingLedger.sol";

interface IntegrationVm {
    function deal(address account, uint256 newBalance) external;
    function deployCode(string calldata artifactPath) external returns (address deployedAddress);
    function deployCode(
        string calldata artifactPath,
        bytes calldata constructorArgs
    ) external returns (address deployedAddress);
    function expectRevert(bytes calldata revertData) external;
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
        ledger = ParkingLedger(
            vm.deployCode(
                "src/ParkingLedger.sol:ParkingLedger",
                abi.encode(
                    IParkingMembershipManager(address(membership)),
                    IParkingOperatorRegistry(address(registry)),
                    IParkingParkCredit(address(credit)),
                    IParkingOperatorTreasury(address(treasury))
                )
            )
        );

        credit.setMinter(address(membership), true);
        credit.setBurner(address(ledger), true);

        membership.setTier(URBAN, "Urban", 100, 0.01 ether, 20, true);
        ledger.setGracePeriod(15);
        treasury.setAllocator(address(ledger));

        bytes32[] memory categories = new bytes32[](1);
        categories[0] = STANDARD;
        registry.registerOperator(OPERATOR_ID, operatorWallet, "Central Garage", categories);
    }

    /// @notice Fuzz test for reservation fee calculation and credit flow
    /// @param duration number of hours reserved (1..24)
    /// @param price price per hour in credits (1..100)
    function testFuzz_reservationFee(uint8 duration, uint128 price) public {
        uint256 boundedDuration = (uint256(duration) % 20) + 1;
        uint256 boundedPrice = (uint256(price) % (100 / boundedDuration)) + 1;

        // set operator price as operator wallet
        vm.prank(operatorWallet);
        registry.setPricePerHour(OPERATOR_ID, STANDARD, boundedPrice);

        // member purchases membership
        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        // create reservation
        uint256 startTime = block.timestamp + 1 hours;
        vm.prank(member);
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, boundedDuration);

        // check-in at startTime
        vm.warp(startTime);
        vm.prank(member);
        ledger.checkIn(0);

        uint256 expectedFee = boundedPrice * boundedDuration;
        // assertions: credits decreased and earnings increased
        require(credit.balanceOf(member, credit.PARK_CREDIT()) + expectedFee == 100, "credit arithmetic mismatch");
        require(treasury.getAccumulatedEarnings(OPERATOR_ID) == expectedFee, "treasury earnings mismatch");
    }

    function testFuzz_membershipRenewalExtendsFromCurrentExpiry(uint32 elapsedSeconds) public {
        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        uint256 firstExpiry = membership.getMembershipExpiry(member);
        uint256 elapsed = uint256(elapsedSeconds) % 29 days;
        vm.warp(block.timestamp + elapsed);

        vm.prank(member);
        membership.renewMembership{value: 0.01 ether}(URBAN);

        require(membership.getMembershipExpiry(member) == firstExpiry + membership.MEMBERSHIP_PERIOD(), "expiry mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 200, "renewal credits mismatch");
    }

    function testFuzz_reserveRejectsZeroDuration(uint256 operatorId, uint256 startOffset) public {
        uint256 startTime = block.timestamp + (startOffset % 30 days) + 1;

        vm.prank(member);
        vm.expectRevert(bytes("ParkingLedger: invalid duration"));
        ledger.reserve(operatorId, STANDARD, startTime, 0);
    }

    function testFuzz_nonBookerCannotMutateReservation(address nonBooker) public {
        if (nonBooker == member) return;

        vm.prank(member);
        membership.purchaseMembership{value: 0.01 ether}(URBAN);

        uint256 startTime = block.timestamp + 1 hours;
        vm.prank(member);
        ledger.reserve(OPERATOR_ID, STANDARD, startTime, 1);

        vm.prank(nonBooker);
        vm.expectRevert(bytes("ParkingLedger: not member"));
        ledger.cancelReservation(0);

        vm.warp(startTime);

        vm.prank(nonBooker);
        vm.expectRevert(bytes("ParkingLedger: not member"));
        ledger.checkIn(0);
    }
}
