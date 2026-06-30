// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMembershipParkCredit {
    function mint(address to, uint256 amount) external;
}

contract MembershipManager {
    struct Tier {
        string name;
        uint256 monthlyCredits;
        uint256 priceWei;
        uint256 monthlyHourCap;
        bool active;
    }

    struct Membership {
        uint256 tierId;
        uint256 expiresAt;
    }

    uint256 public constant MEMBERSHIP_PERIOD = 30 days;

    address public owner;
    IMembershipParkCredit public immutable parkCredit;

    mapping(uint256 => Tier) public tiers;
    mapping(address => Membership) public memberships;

    uint256[] public tierIds;
    mapping(uint256 => bool) private tierExists;

    event TierUpdated(
        uint256 indexed tierId,
        string name,
        uint256 monthlyCredits,
        uint256 priceWei,
        uint256 monthlyHourCap, 
        bool active
    );
    event MembershipPurchased(address indexed member, uint256 indexed tierId, uint256 expiresAt);
    event MembershipRenewed(address indexed member, uint256 indexed tierId, uint256 expiresAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "MembershipManager: not owner");
        _;
    }

    constructor(IMembershipParkCredit credit) {
        require(address(credit) != address(0), "MembershipManager: zero credit");

        owner = msg.sender;
        parkCredit = credit;
    }

    function setTier(
        uint256 tierId,
        string calldata name,
        uint256 monthlyCredits,
        uint256 priceWei,
        uint256 monthlyHourCap,
        bool active
    ) external onlyOwner {
        require(bytes(name).length > 0, "MembershipManager: empty name");

        if (!tierExists[tierId]) {
            tierExists[tierId] = true;
            tierIds.push(tierId);
        }

        tiers[tierId] = Tier({
            name: name,
            monthlyCredits: monthlyCredits,
            priceWei: priceWei,
            monthlyHourCap: monthlyHourCap,
            active: active
        });

        emit TierUpdated(tierId, name, monthlyCredits, priceWei, monthlyHourCap, active);
    }

    function purchaseMembership(uint256 tierId) external payable {
        Tier memory tier = _validatedTier(tierId);
        require(msg.value == tier.priceWei, "MembershipManager: wrong ETH amount");

        uint256 expiresAt = block.timestamp + MEMBERSHIP_PERIOD;
        memberships[msg.sender] = Membership({tierId: tierId, expiresAt: expiresAt});
        parkCredit.mint(msg.sender, tier.monthlyCredits);

        emit MembershipPurchased(msg.sender, tierId, expiresAt);
    }

    function renewMembership(uint256 tierId) external payable {
        Tier memory tier = _validatedTier(tierId);
        require(msg.value == tier.priceWei, "MembershipManager: wrong ETH amount");

        uint256 baseTime = memberships[msg.sender].expiresAt > block.timestamp
            ? memberships[msg.sender].expiresAt
            : block.timestamp;
        uint256 expiresAt = baseTime + MEMBERSHIP_PERIOD;

        memberships[msg.sender] = Membership({tierId: tierId, expiresAt: expiresAt});
        parkCredit.mint(msg.sender, tier.monthlyCredits);

        emit MembershipRenewed(msg.sender, tierId, expiresAt);
    }

    function isMemberActive(address member) external view returns (bool) {
        Membership memory membership = memberships[member];
        return membership.expiresAt > block.timestamp && tiers[membership.tierId].active;
    }

    function getMemberTier(address member) external view returns (uint256) {
        return memberships[member].tierId;
    }

    function getMemberMonthlyHourCap(address member) external view returns (uint256) {
        Membership memory membership = memberships[member];

        if (membership.expiresAt <= block.timestamp || !tiers[membership.tierId].active) {
            return 0;
        }

        return tiers[membership.tierId].monthlyHourCap;
    }

    function getMembershipExpiry(address member) external view returns (uint256) {
        return memberships[member].expiresAt;
    }

    function _validatedTier(uint256 tierId) private view returns (Tier memory tier) {
        tier = tiers[tierId];
        require(tier.active, "MembershipManager: inactive tier");
    }

    function getTierIds() external view returns (uint256[] memory){
        return tierIds;
    }
}
