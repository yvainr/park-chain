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
import {ParkChainRouter} from "../src/ParkChainRouter.sol";

interface DeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
    function envOr(string calldata name, address defaultValue) external view returns (address value);
}

contract Deploy {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            ParkCredit credit,
            MembershipManager membership,
            OperatorRegistry registry,
            OperatorTreasury treasury,
            ParkingLedger ledger,
            ParkChainRouter router
        )
    {
        vm.startBroadcast();
        credit = new ParkCredit();
        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.001 ether);
        membership = new MembershipManager(IMembershipParkCredit(address(credit)), payable(address(treasury)));
        credit.setMinter(address(membership), true);

        membership.setTier(1, "Urban", 80, 0.01 ether, 20, true);
        membership.setTier(2, "Commuter", 200, 0.02 ether, 60, true);
        membership.setTier(3, "Unlimited", 400, 0.03 ether, 120, true);

        ledger = new ParkingLedger(
            IParkingMembershipManager(address(membership)),
            IParkingOperatorRegistry(address(registry)),
            IParkingParkCredit(address(credit)),
            IParkingOperatorTreasury(address(treasury))
        );
        credit.setBurner(address(ledger), true);
        treasury.setAllocator(address(ledger));
        ledger.setGracePeriodMinutes(15);

        address existingRouter = vm.envOr("ROUTER_ADDRESS", address(0));
        router = existingRouter == address(0) ? new ParkChainRouter() : ParkChainRouter(existingRouter);
        bytes32[] memory keys = new bytes32[](5);
        keys[0] = router.PARK_CREDIT();
        keys[1] = router.MEMBERSHIP_MANAGER();
        keys[2] = router.OPERATOR_REGISTRY();
        keys[3] = router.OPERATOR_TREASURY();
        keys[4] = router.PARKING_LEDGER();

        address[] memory addresses_ = new address[](5);
        addresses_[0] = address(credit);
        addresses_[1] = address(membership);
        addresses_[2] = address(registry);
        addresses_[3] = address(treasury);
        addresses_[4] = address(ledger);
        router.setContracts(keys, addresses_);
        vm.stopBroadcast();
    }
}
