// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {OperatorRegistry} from "../src/OperatorRegistry.sol";
import {IOperatorRegistry, OperatorTreasury} from "../src/OperatorTreasury.sol";
import {ParkCredit} from "../src/ParkCredit.sol";

interface DeployVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract Deploy {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            ParkCredit credit,
            MembershipManager membership,
            OperatorRegistry registry,
            OperatorTreasury treasury
        )
    {
        vm.startBroadcast();
        credit = new ParkCredit();
        membership = new MembershipManager(IMembershipParkCredit(address(credit)));
        credit.setMinter(address(membership), true);

        membership.setTier(1, "Urban", 80, 0.01 ether, 20, true);
        membership.setTier(2, "Commuter", 200, 0.02 ether, 60, true);
        membership.setTier(3, "Unlimited", 400, 0.03 ether, 120, true);

        registry = new OperatorRegistry();
        treasury = new OperatorTreasury(IOperatorRegistry(address(registry)), 0.001 ether);
        vm.stopBroadcast();
    }
}
