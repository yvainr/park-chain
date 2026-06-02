export const parkCreditAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const membershipManagerAbi = [
  {
    type: "function",
    name: "setTier",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tierId", type: "uint256" },
      { name: "name", type: "string" },
      { name: "monthlyCredits", type: "uint256" },
      { name: "priceWei", type: "uint256" },
      { name: "monthlyHourCap", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "purchaseMembership",
    stateMutability: "payable",
    inputs: [{ name: "tierId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "renewMembership",
    stateMutability: "payable",
    inputs: [{ name: "tierId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isMemberActive",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getMemberTier",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMemberMonthlyHourCap",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMembershipExpiry",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const operatorRegistryAbi = [
  {
    type: "function",
    name: "registerOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "name", type: "string" },
      { name: "categories", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "removeOperator",
    stateMutability: "nonpayable",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setSupportedCategory",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "category", type: "bytes32" },
      { name: "supported", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setPricePerHour",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "category", type: "bytes32" },
      { name: "price", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setNoShowFee",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "fee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isWhitelisted",
    stateMutability: "view",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "supportsCategory",
    stateMutability: "view",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "category", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getPricePerHour",
    stateMutability: "view",
    inputs: [
      { name: "operatorId", type: "uint256" },
      { name: "category", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getNoShowFee",
    stateMutability: "view",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getOperatorWallet",
    stateMutability: "view",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const operatorTreasuryAbi = [
  {
    type: "function",
    name: "setAllocator",
    stateMutability: "nonpayable",
    inputs: [{ name: "newAllocator", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setCreditToEthRate",
    stateMutability: "nonpayable",
    inputs: [{ name: "weiPerCredit", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAccumulatedEarnings",
    stateMutability: "view",
    inputs: [{ name: "operatorId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getCreditToEthRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
