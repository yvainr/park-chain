# Contract Architecture

ParkChain is split into focused contracts so membership policy, operator setup, reservation lifecycle, and operator settlement can evolve independently.

## Implemented Contracts

### ParkCredit

`ParkCredit` is the ERC-1155 accounting token for platform credits. It exposes role-guarded mint and burn functions and uses token ID `1` for all ParkCredits.

Current integrations:

- `MembershipManager` must be granted the minter role so purchases and renewals can mint monthly credits.
- `ParkingLedger` must be granted the burner role so booking, overstay, and no-show charges can burn member credits.

### MembershipManager

`MembershipManager` stores tier policy and each member's active membership state.

Responsibilities:

- Admin defines and updates tiers with name, monthly credits, ETH price, monthly hour cap, and active state.
- Members purchase a tier by sending the exact ETH price.
- Members renew a tier by sending the exact ETH price.
- Purchases and renewals mint monthly ParkCredits through `ParkCredit`.
- Renewals before expiry extend from the existing expiry.
- Renewals after expiry extend from the current block timestamp.
- Read methods expose membership status and monthly cap for `ParkingLedger`.

Key read methods for future ledger integration:

- `isMemberActive(address member)`
- `getMemberTier(address member)`
- `getMemberMonthlyHourCap(address member)`
- `getMembershipExpiry(address member)`

The current implementation treats the exact expiry timestamp as expired. `getMemberMonthlyHourCap` returns `0` when the membership is expired or the tier is inactive.

### OperatorRegistry

`OperatorRegistry` stores whitelisted parking and EV charging operators.

Responsibilities:

- Admin registers and removes operators.
- Admin manages supported categories.
- Operator wallets set their own category prices and no-show fee.
- Read methods expose whitelist, category support, price, fee, and wallet information for `ParkingLedger` and the frontend.

The current category catalog is `standard`, `disabled`, `ev-charging`, `motorbike`, `family`, and `women`, each represented on-chain as `keccak256` hashes.

### ParkingLedger

`ParkingLedger` is the reservation lifecycle and settlement contract.

Responsibilities:

- Reads `MembershipManager` to verify active membership and monthly hour caps.
- Reads `OperatorRegistry` to verify whitelist status, supported categories, prices, and no-show fee.
- Prevents overlapping active reservations for the same member, operator, and category.
- Tracks used hours by category and by operator for a simple `timestamp / 30 days` month key.
- Charges ParkCredits on check-in, overstay, and no-show.
- Allocates operator earnings through `OperatorTreasury`.

Lifecycle:

1. Reserve a slot after membership, operator, category, overlap, and cap validation.
2. Check in at or after reservation start and charge reserved-duration credits.
3. Check out and charge rounded-up overstay hours only beyond the grace period.
4. Cancel before start for free and release reserved monthly usage.
5. Cancel after start or mark a missed reservation as no-show, charge the no-show fee, and release reserved monthly usage.

### OperatorTreasury

`OperatorTreasury` accumulates operator earnings in ParkCredits and pays operators in ETH at the configured exchange rate.

Responsibilities:

- Owner sets the credit-to-ETH exchange rate.
- Owner sets the authorized allocator.
- Allocator records operator earnings.
- Registered operator wallet withdraws accumulated earnings.

`ParkingLedger` should become the allocator after deployment.

### ParkChainRouter

`ParkChainRouter` stores the latest deployed ParkChain contract addresses under stable `bytes32` keys. It is owned by the deployer by default and is used by the frontend as an address discovery layer.

- First deployment creates the router and prints its address.
- Future deployments can pass `ROUTER_ADDRESS=0x...` to reuse the same router.
- The router points the frontend to the latest contract addresses, but it does not preserve or migrate contract state.

## Deployment Order

1. Deploy `ParkCredit`.
2. Deploy `MembershipManager` with the `ParkCredit` address.
3. Grant `MembershipManager` the ParkCredit minter role.
4. Configure membership tiers.
5. Deploy `OperatorRegistry`.
6. Deploy `OperatorTreasury` with the registry address.
7. Deploy `ParkingLedger` with the membership, registry, credit, and treasury addresses.
8. Grant `ParkingLedger` the ParkCredit burner role.
9. Set `ParkingLedger` as the treasury allocator.
10. Configure the booking grace period.
11. Deploy or connect to `ParkChainRouter`.
12. Store the current `ParkCredit`, `MembershipManager`, `OperatorRegistry`, `OperatorTreasury`, and `ParkingLedger` addresses in the router.
