# ParkChain

ParkChain is a mono-repository for the Urban Parking and EV Charging Network assignment. It contains Solidity contracts, Hardhat tests, frontend code, and project documentation.

## Install Dependencies

`ParkCredit` imports OpenZeppelin contracts, so install the Node dependencies before compiling or testing:

```bash
npm install
```

## Run Contract Tests

The Hardhat tests live in `contracts/hardhat-test` and cover:

- `ParkCredit`: ownership, minter/burner role management, role guards, and inherited ERC-1155 behavior.
- `MembershipManager`: tier administration, membership purchase and renewal, expiry behavior, ParkCredit mint integration, and future ParkingLedger read integration.
- `OperatorRegistry`: admin registration/removal, category support, operator-only price and capacity updates, no-show fees, and revert cases.
- `ParkingLedger`: integrated reservation validation, overlap prevention, monthly caps, check-in charging, overstay settlement, no-show settlement, and treasury allocation.
- `OperatorTreasury`: allocator-only earnings, operator withdrawals, exchange-rate application, liquidity checks, and revert cases.

Run the full smart contract suite from the repository root:

```bash
npm run test:contracts
```

Generate the gas usage table with:

```bash
npm run gas:contracts
```

## Local Deployment

The Hardhat deployment script deploys:

- `ParkCredit`
- `MembershipManager`
- `OperatorRegistry`
- `OperatorTreasury`
- `ParkingLedger`
- `ParkChainRouter`

It also grants `MembershipManager` the ParkCredit minter role and configures the default tiers:

- Urban: 80 credits, 0.01 ETH, 20 hours/month
- Commuter: 200 credits, 0.02 ETH, 60 hours/month
- Unlimited: 400 credits, 0.03 ETH, 120 hours/month

The script grants `ParkingLedger` the ParkCredit burner role, sets it as the treasury allocator, and configures a default 15-minute grace period.
It also deploys or reuses `ParkChainRouter` and writes the latest five contract addresses into the router.

Run a local chain and deploy:

```bash
npm run node:contracts
npm run deploy:contracts:local
```

Copy the printed router address into `frontend/.env`:

```bash
VITE_PARKCHAIN_ROUTER_ADDRESS=0x...
```

On future redeploys, keep the same router address and update the stored contract addresses:

```bash
ROUTER_ADDRESS=0x... npm run deploy:contracts:local
```

Restart or refresh the frontend after redeploying so it resolves the latest addresses from the router.

Supported slot category keys are hashed as `bytes32`: `standard`, `disabled`, `ev-charging`, `motorbike`, `family`, and `women`.

Before accepting reservations for a newly registered operator, connect the registered operator wallet in the Operator workspace. Select the operator ID and category, then configure both the price per hour and a category capacity greater than zero. Use **Get Capacity** to verify the stored value. Reservations for a category with zero capacity, or whose overlapping reservations have reached capacity, will revert.

## Frontend

The Vite frontend supports the current MVP contract surfaces:

- Admin: set membership tiers, register/remove operators, configure categories, allocator, and exchange rate.
- Admin: set the booking grace period.
- Member: purchase/renew membership, reserve slots, cancel, check in, check out, mark no-shows, and read ParkCredit balance, membership status, tier, cap, expiry, reservations, and monthly usage.
- Operator: automatically resolve the operator ID from the connected wallet, set prices, category capacities, and no-show fees; verify configuration; and withdraw earnings.
- Reads: operator, treasury, ledger month key, and monthly usage checks.

Start it with:

```bash
npm run frontend:dev
```

The frontend reads only `VITE_PARKCHAIN_ROUTER_ADDRESS` and resolves `ParkCredit`, `MembershipManager`, `OperatorRegistry`, `OperatorTreasury`, and `ParkingLedger` from-chain on startup.

## CI

GitHub Actions installs Node dependencies, builds contracts, runs the Hardhat contract tests, generates the gas usage table, and builds the frontend on every push and pull request.
