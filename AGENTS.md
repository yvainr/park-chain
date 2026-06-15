# AGENTS.md

## Project: ParkChain — Urban Parking & EV Charging Network

This repository contains the smart contracts, frontend, tests, documentation, diagrams, and deployment configuration for the ParkChain assignment.

ParkChain is a decentralized parking and EV charging reservation platform. Members buy monthly memberships, receive ERC-1155 ParkCredits, reserve parking or charging slots, check in, check out, and pay operators through on-chain accounting.

## Current Development Goal

Build a running mono-repository implementation of the ParkChain platform.

The first implementation phase should focus on:

1. Smart contract architecture.
2. Core reservation lifecycle.
3. Membership and credit logic.
4. Operator registration and pricing.
5. Basic frontend for Admin, Member, and Operator actions.
6. Tests for the required user stories.
7. Documentation and diagrams.

Every Monday, the `main` branch must contain a running version of the current project state.

## Repository Structure

Recommended structure:

```text
parkchain/
├── AGENTS.md
├── ASSIGNMENT.md
├── README.md
├── contracts/
│   ├── src/
│   │   ├── ParkCredit.sol
│   │   ├── MembershipManager.sol
│   │   ├── OperatorRegistry.sol
│   │   ├── ParkingLedger.sol
│   │   └── OperatorTreasury.sol
│   ├── hardhat-test/
│   │   ├── park-credit.ts
│   │   ├── membership-manager.ts
│   │   ├── operator-registry.ts
│   │   ├── parking-ledger.ts
│   │   └── operator-treasury.ts
│   ├── script/
│   │   └── Deploy.s.sol
├── frontend/
│   ├── src/
│   │   ├── abi/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── contract-architecture.md
│   ├── process-model.md
│   ├── diagrams/
│   └── report/
├── posters/
│   ├── intermediary/
│   └── final/
└── .github/
    └── workflows/
        └── ci.yml
```

The exact framework may be changed if needed, but the repository must remain a mono-repository.

## Smart Contract Architecture

The platform should be implemented as several focused contracts instead of one large contract.

### 1. `ParkCredit.sol`

Purpose:

ERC-1155-compatible credit token used as the internal accounting unit of the platform.

Responsibilities:

- Mint monthly ParkCredits when a member purchases or renews a membership.
- Burn or transfer credits when members pay for reservations, overstays, and no-shows.
- Allow authorized platform contracts to mint, burn, and move credits.
- Expose balance checks for the frontend and other contracts.

Recommended methods:

```solidity
function mintCredits(address to, uint256 amount) external;
function burnCredits(address from, uint256 amount) external;
function transferCredits(address from, address to, uint256 amount) external;
function balanceOf(address account, uint256 id) public view returns (uint256);
```

Notes:

- A single ERC-1155 token ID may be used for all ParkCredits.
- Only authorized contracts should be able to mint or burn.
- Consider using OpenZeppelin ERC1155 and AccessControl.

### 2. `MembershipManager.sol`

Purpose:

Stores membership tiers, membership periods, monthly credit allowances, and monthly hour caps.

Responsibilities:

- Let admin define and update membership tiers.
- Let members purchase or renew a tier by paying ETH.
- Mint monthly ParkCredits through `ParkCredit`.
- Store membership expiry.
- Store the active tier of each member.
- Provide cap and membership validity checks to `ParkingLedger`.

Recommended data structures:

```solidity
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
```

Recommended methods:

```solidity
function setTier(
    uint256 tierId,
    string calldata name,
    uint256 monthlyCredits,
    uint256 priceWei,
    uint256 monthlyHourCap,
    bool active
) external;

function purchaseMembership(uint256 tierId) external payable;
function renewMembership(uint256 tierId) external payable;

function isMemberActive(address member) external view returns (bool);
function getMemberTier(address member) external view returns (uint256);
function getMemberMonthlyHourCap(address member) external view returns (uint256);
function getMembershipExpiry(address member) external view returns (uint256);
```

Key rules:

- Expired members must not be able to make new reservations.
- Renewal should extend the membership period and top up credits.
- If renewal happens before expiry, extend from the current expiry date.
- If renewal happens after expiry, extend from the current block timestamp.

### 3. `OperatorRegistry.sol`

Purpose:

Stores all whitelisted parking and EV charging operators.

Responsibilities:

- Admin registers operators.
- Admin removes or disables operators.
- Store operator wallet, operator ID, name, whitelist status, and supported slot categories.
- Operators set category-specific prices and no-show fee.

Recommended data structures:

```solidity
struct Operator {
    address wallet;
    string name;
    bool whitelisted;
}

mapping(uint256 => Operator) operators;
mapping(uint256 => mapping(bytes32 => bool)) supportedCategories;
mapping(uint256 => mapping(bytes32 => uint256)) pricePerHour;
mapping(uint256 => uint256) noShowFee;
```

Recommended methods:

```solidity
function registerOperator(
    uint256 operatorId,
    address wallet,
    string calldata name,
    bytes32[] calldata categories
) external;

function removeOperator(uint256 operatorId) external;

function setSupportedCategory(
    uint256 operatorId,
    bytes32 category,
    bool supported
) external;

function setPricePerHour(
    uint256 operatorId,
    bytes32 category,
    uint256 price
) external;

function setNoShowFee(uint256 operatorId, uint256 fee) external;

function isWhitelisted(uint256 operatorId) external view returns (bool);
function supportsCategory(uint256 operatorId, bytes32 category) external view returns (bool);
function getPricePerHour(uint256 operatorId, bytes32 category) external view returns (uint256);
function getNoShowFee(uint256 operatorId) external view returns (uint256);
function getOperatorWallet(uint256 operatorId) external view returns (address);
```

Key rules:

- Only admin can whitelist or remove operators.
- Only the registered operator wallet should update its own prices and no-show fee.
- Removed operators must not accept new reservations.
- Existing reservations may still be settled unless the team decides otherwise.

### 4. `ParkingLedger.sol`

Purpose:

Main business logic contract for reservation lifecycle, check-in, check-out, cancellation, monthly cap tracking, overlap prevention, and fee calculation.

Responsibilities:

- Create reservation records.
- Validate active membership.
- Validate operator whitelist and slot category support.
- Prevent overlapping reservations for the same member, operator, and category.
- Enforce monthly hour caps per category and per operator.
- Deduct reserved-duration credits at check-in.
- Deduct overstay fee at check-out if actual occupancy exceeds reserved duration plus grace period.
- Apply no-show fee when reservation is forfeited after start time.
- Close reservation records.

Recommended reservation statuses:

```solidity
enum ReservationStatus {
    Reserved,
    CheckedIn,
    CheckedOut,
    Cancelled,
    NoShow
}
```

Recommended data structures:

```solidity
struct Reservation {
    uint256 id;
    address member;
    uint256 operatorId;
    bytes32 slotCategory;
    uint256 startTime;
    uint256 durationHours;
    uint256 checkInTime;
    ReservationStatus status;
}
```

Recommended methods:

```solidity
function reserve(
    uint256 operatorId,
    bytes32 slotCategory,
    uint256 startTime,
    uint256 durationHours
) external returns (uint256 reservationId);

function cancelReservation(uint256 reservationId) external;
function checkIn(uint256 reservationId) external;
function checkOut(uint256 reservationId) external;
function markNoShow(uint256 reservationId) external;

function getReservation(uint256 reservationId) external view returns (Reservation memory);
function getMemberReservations(address member) external view returns (uint256[] memory);

function getUsedHoursByCategory(
    address member,
    bytes32 category,
    uint256 monthKey
) external view returns (uint256);

function getUsedHoursByOperator(
    address member,
    uint256 operatorId,
    uint256 monthKey
) external view returns (uint256);

function setGracePeriodMinutes(uint256 minutes_) external;
```

Key rules:

- `reserve()` must revert if the member has no active membership.
- `reserve()` must revert if the operator is not whitelisted.
- `reserve()` must revert if the category is not supported by the operator.
- `reserve()` must revert if the new time window overlaps with an active reservation by the same member at the same operator and category.
- `reserve()` must revert if the monthly cap would be exceeded for either the selected category or the selected operator.
- `checkIn()` can only happen at or after reservation start time.
- `checkIn()` deducts the reserved-duration price in ParkCredits and allocates it to the operator.
- `checkOut()` calculates actual duration from `block.timestamp - checkInTime`.
- Overstay is charged only when actual duration exceeds reserved duration plus grace period.
- `cancelReservation()` is free only before start time.
- After start time, a not-checked-in reservation becomes no-show and the operator receives the no-show fee.

### 5. `OperatorTreasury.sol`

Purpose:

Stores operator earnings and handles conversion from ParkCredits to ETH withdrawals.

Responsibilities:

- Accumulate operator earnings in ParkCredits.
- Convert accumulated credits to ETH using the configured credit-to-ETH exchange rate.
- Allow operators to withdraw their accumulated earnings.
- Let admin update the exchange rate.

Recommended methods:

```solidity
function allocateEarnings(uint256 operatorId, uint256 amountCredits) external;
function withdraw(uint256 operatorId) external;
function setCreditToEthRate(uint256 weiPerCredit) external;
function getAccumulatedEarnings(uint256 operatorId) external view returns (uint256);
function getCreditToEthRate() external view returns (uint256);
```

Key rules:

- Only `ParkingLedger` should allocate earnings.
- Only the registered operator wallet should withdraw for its operator ID.
- Withdrawals depend on the current exchange rate.
- The treasury must have enough ETH liquidity to pay withdrawals.

## Contract Interaction Schema

```text
Admin
  ├── OperatorRegistry.registerOperator()
  ├── OperatorRegistry.removeOperator()
  ├── MembershipManager.setTier()
  ├── ParkingLedger.setGracePeriodMinutes()
  └── OperatorTreasury.setCreditToEthRate()

Operator
  ├── OperatorRegistry.setPricePerHour()
  ├── OperatorRegistry.setNoShowFee()
  ├── OperatorTreasury.getAccumulatedEarnings()
  └── OperatorTreasury.withdraw()

Member
  ├── MembershipManager.purchaseMembership()
  │     └── ParkCredit.mintCredits()
  │
  ├── MembershipManager.renewMembership()
  │     └── ParkCredit.mintCredits()
  │
  ├── ParkingLedger.reserve()
  │     ├── MembershipManager.isMemberActive()
  │     ├── MembershipManager.getMemberMonthlyHourCap()
  │     ├── OperatorRegistry.isWhitelisted()
  │     ├── OperatorRegistry.supportsCategory()
  │     └── internal overlap and monthly cap checks
  │
  ├── ParkingLedger.checkIn()
  │     ├── OperatorRegistry.getPricePerHour()
  │     ├── ParkCredit.burnCredits() or transferCredits()
  │     └── OperatorTreasury.allocateEarnings()
  │
  ├── ParkingLedger.checkOut()
  │     ├── calculate overstay
  │     ├── ParkCredit.burnCredits() or transferCredits()
  │     └── OperatorTreasury.allocateEarnings()
  │
  └── ParkingLedger.cancelReservation()
        └── free before start, no-show fee after start
```

## Main Business Processes

### Admin Setup Process

1. Deploy contracts.
2. Configure contract permissions.
3. Define membership tiers.
4. Configure grace period.
5. Configure credit-to-ETH exchange rate.
6. Register and whitelist operators.
7. Define supported slot categories per operator.

### Member Reservation Process

1. Member purchases or renews membership.
2. Member receives ParkCredits.
3. Member calls `reserve(operatorId, category, startTime, durationHours)`.
4. `ParkingLedger` validates membership, operator, category, overlap, and caps.
5. Contract creates reservation.
6. Member checks in at or after start time.
7. Contract deducts reserved-duration credits.
8. Operator earnings increase.
9. Member checks out.
10. Contract calculates possible overstay fee.
11. Contract closes reservation.

### No-Show Process

1. Member creates reservation.
2. Member does not check in.
3. Reservation start time passes.
4. Reservation can no longer be cancelled for free.
5. Contract marks reservation as no-show.
6. Contract deducts no-show fee.
7. Operator earnings increase.
8. Reservation is closed.

### Operator Withdrawal Process

1. Operator checks accumulated earnings.
2. Operator calls `withdraw(operatorId)`.
3. Treasury validates caller is the operator wallet.
4. Treasury converts credits to ETH at current rate.
5. Treasury sends ETH to operator.
6. Accumulated credit earnings reset or decrease.

## Frontend Tasks

The frontend may be a simple TypeScript or JavaScript single-page application.

### Admin Page

Must support:

- register operator;
- remove operator;
- define or update membership tiers;
- set global grace period;
- set credit-to-ETH exchange rate.

### Member Page

Must support:

- purchase membership;
- renew membership;
- view credit balance;
- view membership expiry;
- reserve slot;
- cancel reservation;
- check in;
- check out;
- view active reservations;
- view remaining monthly hours by category and by operator.

### Operator Page

Must support:

- set price per hour by category;
- set no-show fee;
- view accumulated earnings;
- withdraw earnings.

## Testing Tasks

Tests should cover at least:

### Admin Tests

- admin can register operator;
- non-admin cannot register operator;
- admin can remove operator;
- removed operator cannot receive new reservations;
- admin can create or update tiers;
- admin can update grace period;
- admin can update exchange rate.

### Membership Tests

- member can purchase Urban, Commuter, and Unlimited memberships;
- wrong ETH amount reverts;
- credits are minted after purchase;
- renewal extends membership;
- expired membership cannot reserve.

### Reservation Tests

- valid reservation succeeds;
- reservation for unsupported category reverts;
- reservation at non-whitelisted operator reverts;
- overlapping reservation reverts;
- reservation exceeding category cap reverts;
- reservation exceeding operator cap reverts;
- cancellation before start is free;
- cancellation after start becomes no-show or reverts according to implementation choice.

### Check-In and Check-Out Tests

- check-in before start reverts;
- check-in at or after start succeeds;
- check-in deducts correct credits;
- check-out without overstay charges no extra fee;
- check-out after grace period charges overstay fee;
- reservation status changes correctly.

### Operator Treasury Tests

- operator receives reserved-duration earnings;
- operator receives overstay fee;
- operator receives no-show fee;
- operator can withdraw;
- non-operator cannot withdraw operator earnings;
- exchange rate is applied correctly.

## Suggested Events

Use events for frontend indexing and debugging.

```solidity
event OperatorRegistered(uint256 indexed operatorId, address indexed wallet, string name);
event OperatorRemoved(uint256 indexed operatorId);
event TierUpdated(uint256 indexed tierId, string name, uint256 monthlyCredits, uint256 priceWei, uint256 monthlyHourCap);
event MembershipPurchased(address indexed member, uint256 indexed tierId, uint256 expiresAt);
event MembershipRenewed(address indexed member, uint256 indexed tierId, uint256 expiresAt);
event ReservationCreated(uint256 indexed reservationId, address indexed member, uint256 indexed operatorId, bytes32 category);
event ReservationCancelled(uint256 indexed reservationId);
event CheckedIn(uint256 indexed reservationId, uint256 checkInTime, uint256 chargedCredits);
event CheckedOut(uint256 indexed reservationId, uint256 checkOutTime, uint256 overstayFee);
event NoShow(uint256 indexed reservationId, uint256 noShowFee);
event EarningsAllocated(uint256 indexed operatorId, uint256 amountCredits);
event EarningsWithdrawn(uint256 indexed operatorId, address indexed operatorWallet, uint256 amountCredits, uint256 amountWei);
event CreditToEthRateUpdated(uint256 weiPerCredit);
event GracePeriodUpdated(uint256 gracePeriodMinutes);
```

## Implementation Notes

- Use Solidity `^0.8.24` or a current stable version.
- Prefer OpenZeppelin contracts for ERC-1155, Ownable, AccessControl, ReentrancyGuard, and Pausable if needed.
- Keep the MVP simple.
- Avoid unnecessary upgradeability unless required later.
- Use `bytes32` for slot categories internally:
  - `keccak256("standard")`
  - `keccak256("disabled")`
  - `keccak256("ev-charging")`
  - `keccak256("motorbike")`
- Store readable names in the frontend or expose helper conversion utilities.
- Use integer hours for the first version because the assignment uses `durationHours`.
- Define a simple month key as `timestamp / 30 days` for the MVP, or implement calendar-month logic if required by the course.
- Be careful with loops over reservations. For the MVP this is acceptable, but document the gas limitation.
- Consider using events for frontend reservation lists, because returning large arrays on-chain can become expensive.

## Cherry-on-Top Feature Ideas

Add one unique feature per group member.

Possible small features:

1. Reservation transfer to another active member.
2. Dynamic peak-hour price multiplier.
3. Operator blacklist for repeat overstay offenders.
4. Green bonus for EV charging with renewable-energy operators.
5. Loyalty discount after a number of completed reservations.
6. Emergency cancellation allowance once per month.
7. Member rating based on no-shows and overstays.

Each feature should include:

- one short description;
- one or more contract methods;
- at least one test;
- one frontend control or display element.

## Definition of Done for the First Running Version

A minimal running version should include:

- contracts compile successfully;
- deployment script works locally;
- at least one admin can configure tiers and operators;
- one member can buy a membership;
- one member can reserve a slot;
- one member can check in and check out;
- operator earnings are allocated;
- operator can withdraw;
- frontend can connect to wallet and call the main methods;
- tests cover the happy path and the most important reverts;
- README explains how to run contracts, tests, and frontend.
