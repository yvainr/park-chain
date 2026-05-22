// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract OperatorRegistry {
    struct Operator {
        address wallet;
        string name;
        bool whitelisted;
        bool exists;
    }

    mapping(uint256 => Operator) private operators;
    mapping(uint256 => mapping(bytes32 => bool)) private supportedCategories;
    mapping(uint256 => mapping(bytes32 => uint256)) private pricePerHour;
    mapping(uint256 => uint256) private noShowFee;

    event OperatorRegistered(uint256 indexed operatorId, address indexed wallet, string name);
    event OperatorRemoved(uint256 indexed operatorId);
    event SupportedCategoryUpdated(uint256 indexed operatorId, bytes32 indexed category, bool supported);
    event PricePerHourUpdated(uint256 indexed operatorId, bytes32 indexed category, uint256 price);
    event NoShowFeeUpdated(uint256 indexed operatorId, uint256 fee);

    error OperatorAlreadyExists(uint256 operatorId);
    error OperatorNotFound(uint256 operatorId);
    error ZeroAddressNotAllowed();
    error NotOperatorWallet(uint256 operatorId, address caller);
    error OperatorNotWhitelisted(uint256 operatorId);
    error OwnableUnauthorizedAccount(address account);

    address public owner;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        owner = initialOwner;
    }

    function registerOperator(
        uint256 operatorId,
        address wallet,
        string calldata name,
        bytes32[] calldata categories
    ) external onlyOwner {
        if (wallet == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (operators[operatorId].exists) {
            revert OperatorAlreadyExists(operatorId);
        }

        operators[operatorId] = Operator({wallet: wallet, name: name, whitelisted: true, exists: true});

        for (uint256 index = 0; index < categories.length; index++) {
            supportedCategories[operatorId][categories[index]] = true;
            emit SupportedCategoryUpdated(operatorId, categories[index], true);
        }

        emit OperatorRegistered(operatorId, wallet, name);
    }

    function removeOperator(uint256 operatorId) external onlyOwner {
        Operator storage operator = _getExistingOperator(operatorId);
        operator.whitelisted = false;
        emit OperatorRemoved(operatorId);
    }

    function setSupportedCategory(uint256 operatorId, bytes32 category, bool supported) external {
        _requireOperatorWallet(operatorId);
        supportedCategories[operatorId][category] = supported;
        emit SupportedCategoryUpdated(operatorId, category, supported);
    }

    function setPricePerHour(uint256 operatorId, bytes32 category, uint256 price) external {
        _requireOperatorWallet(operatorId);
        pricePerHour[operatorId][category] = price;
        emit PricePerHourUpdated(operatorId, category, price);
    }

    function setNoShowFee(uint256 operatorId, uint256 fee) external {
        _requireOperatorWallet(operatorId);
        noShowFee[operatorId] = fee;
        emit NoShowFeeUpdated(operatorId, fee);
    }

    function isWhitelisted(uint256 operatorId) external view returns (bool) {
        return operators[operatorId].whitelisted;
    }

    function supportsCategory(uint256 operatorId, bytes32 category) external view returns (bool) {
        return supportedCategories[operatorId][category];
    }

    function getPricePerHour(uint256 operatorId, bytes32 category) external view returns (uint256) {
        return pricePerHour[operatorId][category];
    }

    function getNoShowFee(uint256 operatorId) external view returns (uint256) {
        return noShowFee[operatorId];
    }

    function getOperatorWallet(uint256 operatorId) external view returns (address) {
        return operators[operatorId].wallet;
    }

    function getOperator(uint256 operatorId) external view returns (Operator memory) {
        return operators[operatorId];
    }

    function _requireOperatorWallet(uint256 operatorId) internal view {
        Operator storage operator = _getExistingOperator(operatorId);
        if (!operator.whitelisted) {
            revert OperatorNotWhitelisted(operatorId);
        }
        if (operator.wallet != msg.sender) {
            revert NotOperatorWallet(operatorId, msg.sender);
        }
    }

    function _getExistingOperator(uint256 operatorId) internal view returns (Operator storage) {
        Operator storage operator = operators[operatorId];
        if (!operator.exists) {
            revert OperatorNotFound(operatorId);
        }
        return operator;
    }
}