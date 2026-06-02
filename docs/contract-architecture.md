# Contract Architecture

ParkChain is split into focused contracts so membership policy, operator setup, reservation lifecycle, and operator settlement can evolve independently.

## Implemented Contracts

### ParkCredit

`ParkCredit` is the ERC-1155 accounting token for platform credits. It exposes role-guarded mint and burn functions and uses token ID `1` for all ParkCredits.

Current integrations:

- `MembershipManager` must be granted the minter role so purchases and renewals can mint monthly credits.
- Future `ParkingLedger` can be granted burner rights or use another authorized settlement path when reservation charges are implemented.

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

### OperatorTreasury

`OperatorTreasury` accumulates operator earnings in ParkCredits and pays operators in ETH at the configured exchange rate.

Responsibilities:

- Owner sets the credit-to-ETH exchange rate.
- Owner sets the authorized allocator.
- Allocator records operator earnings.
- Registered operator wallet withdraws accumulated earnings.

Future `ParkingLedger` should become the allocator after deployment.

## Planned Contract

### ParkingLedger

`ParkingLedger` is still a stub. It should become the reservation lifecycle contract.

Planned dependencies:

- Reads `MembershipManager` to verify active membership and monthly hour caps.
- Reads `OperatorRegistry` to verify whitelist status, supported categories, prices, no-show fee, and operator wallet.
- Charges ParkCredits on check-in, overstay, and no-show.
- Allocates operator earnings through `OperatorTreasury`.

Planned lifecycle:

1. Reserve a slot after membership, operator, category, overlap, and cap validation.
2. Check in at or after reservation start.
3. Charge reserved duration.
4. Check out and charge overstay only beyond the grace period.
5. Mark missed reservations as no-shows after the start time.

## Deployment Order

1. Deploy `ParkCredit`.
2. Deploy `MembershipManager` with the `ParkCredit` address.
3. Grant `MembershipManager` the ParkCredit minter role.
4. Configure membership tiers.
5. Deploy `OperatorRegistry`.
6. Deploy `OperatorTreasury` with the registry address.
7. When implemented, deploy `ParkingLedger` and grant it the required settlement permissions.
