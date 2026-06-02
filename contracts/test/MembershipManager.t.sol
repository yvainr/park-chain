// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MembershipManager, IMembershipParkCredit} from "../src/MembershipManager.sol";
import {ParkCredit} from "../src/ParkCredit.sol";

interface MembershipVm {
    function deal(address account, uint256 newBalance) external;
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes calldata revertData) external;
}

interface IMembershipReader {
    function isMemberActive(address member) external view returns (bool);
    function getMemberMonthlyHourCap(address member) external view returns (uint256);
}

contract MembershipReaderHarness {
    IMembershipReader private immutable membershipManager;

    constructor(IMembershipReader manager) {
        membershipManager = manager;
    }

    function canReserve(address member, uint256 requestedHours) external view returns (bool) {
        return membershipManager.isMemberActive(member)
            && requestedHours <= membershipManager.getMemberMonthlyHourCap(member);
    }
}

contract MembershipManagerTest {
    MembershipVm private constant vm = MembershipVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ParkCredit private credit;
    MembershipManager private manager;

    address private member = address(0x1001);
    address private stranger = address(0x2002);

    uint256 private constant URBAN = 1;
    uint256 private constant COMMUTER = 2;
    uint256 private constant UNLIMITED = 3;

    function setUp() public {
        credit = new ParkCredit();
        manager = new MembershipManager(IMembershipParkCredit(address(credit)));
        credit.setMinter(address(manager), true);

        manager.setTier(URBAN, "Urban", 80, 0.01 ether, 20, true);
        manager.setTier(COMMUTER, "Commuter", 200, 0.02 ether, 60, true);
        manager.setTier(UNLIMITED, "Unlimited", 400, 0.03 ether, 120, true);

        vm.deal(member, 10 ether);
        vm.deal(stranger, 10 ether);
        vm.warp(1_700_000_000);
    }

    function testConstructorStoresOwnerAndParkCredit() public view {
        require(manager.owner() == address(this), "owner mismatch");
        require(address(manager.parkCredit()) == address(credit), "credit mismatch");
    }

    function testConstructorRejectsZeroCreditAddress() public {
        vm.expectRevert(bytes("MembershipManager: zero credit"));
        new MembershipManager(IMembershipParkCredit(address(0)));
    }

    function testAdminCanCreateAndUpdateTiers() public {
        manager.setTier(URBAN, "Urban Plus", 90, 0.011 ether, 25, true);

        (
            string memory name,
            uint256 monthlyCredits,
            uint256 priceWei,
            uint256 monthlyHourCap,
            bool active
        ) = manager.tiers(URBAN);

        require(keccak256(bytes(name)) == keccak256(bytes("Urban Plus")), "name mismatch");
        require(monthlyCredits == 90, "credits mismatch");
        require(priceWei == 0.011 ether, "price mismatch");
        require(monthlyHourCap == 25, "cap mismatch");
        require(active, "tier should be active");
    }

    function testNonAdminCannotSetTiers() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("MembershipManager: not owner"));
        manager.setTier(4, "Student", 50, 0.005 ether, 15, true);
    }

    function testSetTierRejectsEmptyName() public {
        vm.expectRevert(bytes("MembershipManager: empty name"));
        manager.setTier(4, "", 50, 0.005 ether, 15, true);
    }

    function testMemberCanPurchaseUrbanCommuterAndUnlimitedMemberships() public {
        _purchase(member, URBAN, 0.01 ether);
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 80, "urban credits mismatch");
        require(manager.getMemberTier(member) == URBAN, "urban tier mismatch");

        _purchase(member, COMMUTER, 0.02 ether);
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 280, "commuter credits mismatch");
        require(manager.getMemberTier(member) == COMMUTER, "commuter tier mismatch");

        _purchase(member, UNLIMITED, 0.03 ether);
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 680, "unlimited credits mismatch");
        require(manager.getMemberTier(member) == UNLIMITED, "unlimited tier mismatch");
    }

    function testWrongEthAmountReverts() public {
        vm.prank(member);
        vm.expectRevert(bytes("MembershipManager: wrong ETH amount"));
        manager.purchaseMembership{value: 0.02 ether}(URBAN);

        vm.prank(member);
        vm.expectRevert(bytes("MembershipManager: wrong ETH amount"));
        manager.renewMembership{value: 0.02 ether}(URBAN);
    }

    function testInactiveTierCannotBePurchasedOrRenewed() public {
        manager.setTier(URBAN, "Urban", 80, 0.01 ether, 20, false);

        vm.prank(member);
        vm.expectRevert(bytes("MembershipManager: inactive tier"));
        manager.purchaseMembership{value: 0.01 ether}(URBAN);

        vm.prank(member);
        vm.expectRevert(bytes("MembershipManager: inactive tier"));
        manager.renewMembership{value: 0.01 ether}(URBAN);
    }

    function testPurchaseMintsCreditsAndStoresExpiry() public {
        uint256 start = block.timestamp;

        _purchase(member, URBAN, 0.01 ether);

        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 80, "credits mismatch");
        require(manager.getMembershipExpiry(member) == start + manager.MEMBERSHIP_PERIOD(), "expiry mismatch");
        require(manager.isMemberActive(member), "member should be active");
        require(manager.getMemberMonthlyHourCap(member) == 20, "cap mismatch");
    }

    function testRenewalBeforeExpiryExtendsFromCurrentExpiry() public {
        uint256 start = block.timestamp;
        _purchase(member, URBAN, 0.01 ether);

        vm.warp(start + 10 days);
        _renew(member, URBAN, 0.01 ether);

        require(
            manager.getMembershipExpiry(member) == start + (2 * manager.MEMBERSHIP_PERIOD()),
            "renewal should extend from old expiry"
        );
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 160, "renewal credits mismatch");
    }

    function testRenewalAfterExpiryExtendsFromCurrentTimestamp() public {
        _purchase(member, URBAN, 0.01 ether);

        vm.warp(block.timestamp + 40 days);
        uint256 renewalTime = block.timestamp;
        _renew(member, COMMUTER, 0.02 ether);

        require(
            manager.getMembershipExpiry(member) == renewalTime + manager.MEMBERSHIP_PERIOD(),
            "renewal should extend from current time"
        );
        require(manager.getMemberTier(member) == COMMUTER, "renewed tier mismatch");
        require(credit.balanceOf(member, credit.PARK_CREDIT()) == 280, "renewal credits mismatch");
    }

    function testExpiredOrInactiveMembershipIsNotActiveAndHasZeroCap() public {
        _purchase(member, URBAN, 0.01 ether);

        vm.warp(manager.getMembershipExpiry(member));
        require(!manager.isMemberActive(member), "member should expire at expiry timestamp");
        require(manager.getMemberMonthlyHourCap(member) == 0, "expired cap should be zero");

        _renew(member, URBAN, 0.01 ether);
        manager.setTier(URBAN, "Urban", 80, 0.01 ether, 20, false);

        require(!manager.isMemberActive(member), "inactive tier should deactivate member");
        require(manager.getMemberMonthlyHourCap(member) == 0, "inactive cap should be zero");
    }

    function testPurchaseRevertsIfManagerIsNotParkCreditMinter() public {
        credit.setMinter(address(manager), false);

        vm.prank(member);
        vm.expectRevert(bytes("Not authorized to mint"));
        manager.purchaseMembership{value: 0.01 ether}(URBAN);
    }

    function testFutureLedgerCanReadMembershipStatusAndCap() public {
        MembershipReaderHarness reader = new MembershipReaderHarness(IMembershipReader(address(manager)));

        require(!reader.canReserve(member, 1), "inactive member should not reserve");

        _purchase(member, COMMUTER, 0.02 ether);

        require(reader.canReserve(member, 60), "member should reserve inside cap");
        require(!reader.canReserve(member, 61), "member should not reserve above cap");

        vm.warp(manager.getMembershipExpiry(member));
        require(!reader.canReserve(member, 1), "expired member should not reserve");
    }

    function _purchase(address account, uint256 tierId, uint256 value) private {
        vm.prank(account);
        manager.purchaseMembership{value: value}(tierId);
    }

    function _renew(address account, uint256 tierId, uint256 value) private {
        vm.prank(account);
        manager.renewMembership{value: value}(tierId);
    }
}
