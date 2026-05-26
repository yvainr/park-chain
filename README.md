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
- `OperatorRegistry`: admin registration/removal, category support, operator-only price updates, no-show fees, and revert cases.
- `OperatorTreasury`: allocator-only earnings, operator withdrawals, exchange-rate application, liquidity checks, and revert cases.

Run the full smart contract suite from the repository root:

```bash
forge test --root contracts
```

## CI

GitHub Actions installs Node dependencies, installs Foundry, and runs `forge test --root contracts` on every push and pull request.
