# ParkChain

ParkChain is a mono-repository for the Urban Parking and EV Charging Network assignment. It contains Solidity contracts, Foundry tests, frontend code, and project documentation.

## Install Dependencies

`ParkCredit` imports OpenZeppelin contracts, so install the Node dependencies before compiling or testing:

```bash
npm install
```

## Run Contract Tests

The Foundry tests live in `contracts/test` and cover:

- `ParkCredit`: ownership, minter/burner role management, role guards, and inherited ERC-1155 behavior through a test harness.
- `MembershipManager`: tier administration, membership purchase and renewal, expiry behavior, ParkCredit mint integration, and future ParkingLedger read integration.
- `OperatorRegistry`: admin registration/removal, category support, operator-only price updates, no-show fees, and revert cases.
- `ParkingLedger`: integrated reservation validation, overlap prevention, monthly caps, check-in charging, overstay settlement, no-show settlement, and treasury allocation.
- `OperatorTreasury`: allocator-only earnings, operator withdrawals, exchange-rate application, liquidity checks, and revert cases.

Run the full smart contract suite from the repository root:

```bash
forge test --root contracts
```

## Local Deployment

The Hardhat deployment script deploys:

- `ParkCredit`
- `MembershipManager`
- `OperatorRegistry`
- `OperatorTreasury`
- `ParkingLedger`

It also grants `MembershipManager` the ParkCredit minter role and configures the default tiers:

- Urban: 80 credits, 0.01 ETH, 20 hours/month
- Commuter: 200 credits, 0.02 ETH, 60 hours/month
- Unlimited: 400 credits, 0.03 ETH, 120 hours/month

The script grants `ParkingLedger` the ParkCredit burner role, sets it as the treasury allocator, and configures a default 15-minute grace period.

Run a local chain and deploy:

```bash
npm run node:contracts
npm run deploy:contracts:local
```

Paste the printed contract addresses into the frontend.

Supported slot category keys are hashed as `bytes32`: `standard`, `disabled`, `ev-charging`, `motorbike`, `family`, and `women`.

## Frontend

The Vite frontend supports the current MVP contract surfaces:

- Admin: set membership tiers, register/remove operators, configure categories, allocator, and exchange rate.
- Admin: set the booking grace period.
- Member: purchase/renew membership, reserve slots, cancel, check in, check out, mark no-shows, and read ParkCredit balance, membership status, tier, cap, expiry, reservations, and monthly usage.
- Operator: set prices/no-show fees and withdraw earnings.
- Reads: operator, treasury, ledger month key, and monthly usage checks.

Start it with:

```bash
npm run frontend:dev
```

## CI

GitHub Actions installs Node dependencies, installs Foundry, and runs `forge test --root contracts` on every push and pull request.
