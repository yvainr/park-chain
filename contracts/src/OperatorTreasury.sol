// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOperatorRegistry {
    function getOperatorWallet(uint256 operatorId) external view returns (address);
}

contract OperatorTreasury {
    IOperatorRegistry public immutable operatorRegistry;

    address public owner;
    address public allocator;
    uint256 public creditToEthRate;
    uint256 public totalAccumulatedEarnings;

    mapping(uint256 => uint256) private accumulatedEarnings;

    bool private locked;

    event EarningsAllocated(uint256 indexed operatorId, uint256 amountCredits);
    event EarningsWithdrawn(
        uint256 indexed operatorId,
        address indexed operatorWallet,
        uint256 amountCredits,
        uint256 amountWei
    );
    event CreditToEthRateUpdated(uint256 weiPerCredit);
    event AllocatorUpdated(address indexed allocator);
    event TreasuryFunded(address indexed sender, uint256 amountWei);

    modifier onlyOwner() {
        require(msg.sender == owner, "OperatorTreasury: not owner");
        _;
    }

    modifier onlyAllocator() {
        require(msg.sender == allocator, "OperatorTreasury: not allocator");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "OperatorTreasury: reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor(IOperatorRegistry registry, uint256 initialCreditToEthRate) {
        require(address(registry) != address(0), "OperatorTreasury: zero registry");

        owner = msg.sender;
        allocator = msg.sender;
        operatorRegistry = registry;
        creditToEthRate = initialCreditToEthRate;

        emit CreditToEthRateUpdated(initialCreditToEthRate);
        emit AllocatorUpdated(msg.sender);
    }

    receive() external payable {
        emit TreasuryFunded(msg.sender, msg.value);
    }

    function fundTreasury() external payable {
        require(msg.value > 0, "OperatorTreasury: zero funding");
        emit TreasuryFunded(msg.sender, msg.value);
    }

    function setAllocator(address newAllocator) external onlyOwner {
        require(newAllocator != address(0), "OperatorTreasury: zero allocator");
        allocator = newAllocator;

        emit AllocatorUpdated(newAllocator);
    }

    function allocateEarnings(uint256 operatorId, uint256 amountCredits) external onlyAllocator {
        require(amountCredits > 0, "OperatorTreasury: zero amount");
        require(operatorRegistry.getOperatorWallet(operatorId) != address(0), "OperatorTreasury: unknown operator");

        accumulatedEarnings[operatorId] += amountCredits;
        totalAccumulatedEarnings += amountCredits;

        emit EarningsAllocated(operatorId, amountCredits);
    }

    function withdraw(uint256 operatorId) external nonReentrant {
        address operatorWallet = operatorRegistry.getOperatorWallet(operatorId);
        require(operatorWallet != address(0), "OperatorTreasury: unknown operator");
        require(msg.sender == operatorWallet, "OperatorTreasury: not operator wallet");
        require(creditToEthRate > 0, "OperatorTreasury: zero exchange rate");

        uint256 amountCredits = accumulatedEarnings[operatorId];
        require(amountCredits > 0, "OperatorTreasury: no earnings");

        uint256 liquidityCredits = address(this).balance / creditToEthRate;
        uint256 withdrawnCredits = amountCredits < liquidityCredits ? amountCredits : liquidityCredits;
        require(withdrawnCredits > 0, "OperatorTreasury: insufficient liquidity");

        uint256 amountWei = withdrawnCredits * creditToEthRate;
        accumulatedEarnings[operatorId] -= withdrawnCredits;
        totalAccumulatedEarnings -= withdrawnCredits;

        (bool sent, ) = operatorWallet.call{value: amountWei}("");
        require(sent, "OperatorTreasury: withdraw failed");

        emit EarningsWithdrawn(operatorId, operatorWallet, withdrawnCredits, amountWei);
    }

    function setCreditToEthRate(uint256 weiPerCredit) external onlyOwner {
        creditToEthRate = weiPerCredit;

        emit CreditToEthRateUpdated(weiPerCredit);
    }

    function getAccumulatedEarnings(uint256 operatorId) external view returns (uint256) {
        return accumulatedEarnings[operatorId];
    }

    function getWithdrawableEarnings(uint256 operatorId) external view returns (uint256) {
        if (creditToEthRate == 0) {
            return 0;
        }

        uint256 liquidityCredits = address(this).balance / creditToEthRate;
        uint256 earnings = accumulatedEarnings[operatorId];
        return earnings < liquidityCredits ? earnings : liquidityCredits;
    }

    function getAvailableLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    function getRequiredLiquidity() public view returns (uint256) {
        return totalAccumulatedEarnings * creditToEthRate;
    }

    function getLiquidityShortfall() external view returns (uint256) {
        uint256 requiredLiquidity = getRequiredLiquidity();
        uint256 availableLiquidity = address(this).balance;
        return requiredLiquidity > availableLiquidity ? requiredLiquidity - availableLiquidity : 0;
    }

    function getCreditToEthRate() external view returns (uint256) {
        return creditToEthRate;
    }
}
