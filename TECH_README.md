# ParkChain Technical Guide

This is the canonical technical, build, run, deployment, and test guide for ParkChain. Run all commands from the repository root unless a section says otherwise.

## Contents

1. [System overview](#system-overview)
2. [Repository structure](#repository-structure)
3. [Smart-contract architecture](#smart-contract-architecture)
4. [Prerequisites and installation](#prerequisites-and-installation)
5. [Build and automated tests](#build-and-automated-tests)
6. [Run the complete application locally](#run-the-complete-application-locally)
7. [Run each service separately](#run-each-service-separately)
8. [Configure local wallets](#configure-local-wallets)
9. [Local-chain time control](#local-chain-time-control)
10. [Sepolia deployment](#sepolia-deployment)
11. [CI/CD](#cicd)

## System overview

ParkChain is a decentralized parking and EV-charging reservation application. Members buy a monthly membership with ETH, receive ERC-1155 ParkCredits, reserve an operator's parking place, and settle reservation, no-show, and overstay charges on-chain. Operators configure their inventory and withdraw collected earnings. Administrators configure membership, operator, and treasury policy.

The mono-repository contains:

- six Solidity contracts compiled and tested with Hardhat 3;
- a React 19 and Vite 7 single-page application;
- TypeScript contract, integration, stress, and ABI-parity tests;
- Hardhat and Foundry deployment scripts;
- requirements decisions, architecture, process, research, diagram, and poster artifacts.

The browser communicates directly with the contracts through the connected EIP-1193 wallet. There is no application backend or database. `ParkChainRouter` gives the frontend one stable address from which it discovers the five current application-contract addresses.

```text
Admin ───────────────┐
Member ── Wallet ────┼── React/Vite frontend ── JSON-RPC ── ParkChain contracts
Operator ────────────┘                                 │
                                                       └── ParkChainRouter
                                                           ├── ParkCredit
                                                           ├── MembershipManager
                                                           ├── OperatorRegistry
                                                           ├── OperatorTreasury
                                                           └── ParkingLedger
```

## Repository structure

```text
park-chain/
├── contracts/
│   ├── src/                    Solidity contracts
│   ├── hardhat-test/           TypeScript/viem tests
│   └── script/Deploy.s.sol     Foundry deployment script
├── frontend/
│   ├── src/abi/                Frontend contract ABIs
│   ├── src/components/         Shared UI and charts
│   ├── src/pages/              Admin, member, operator, and login pages
│   └── src/lib/wallet.ts       Chain and wallet integration
├── scripts/
│   ├── deploy-hardhat.ts       Hardhat deployment/configuration
│   ├── generate-hardhat-gas-table.ts
│   └── start-local.mjs         Local stack orchestrator
├── docs/
│   ├── contract-architecture.md
│   ├── process-model.md
│   └── requirements-decisions.md
├── hardhat.config.ts
├── package.json
└── TECH_README.md
```

Hardhat writes generated artifacts and cache files to `contracts/hardhat-artifacts/` and `contracts/hardhat-cache/`.

## Smart-contract architecture

### `ParkCredit`

The ERC-1155 ParkCredit accounting token. All credits use token ID `1`.

- `MembershipManager` receives the minter role.
- `ParkingLedger` receives the burner role.
- Unauthorized callers cannot mint or burn credits.

### `MembershipManager`

Stores membership tiers and member state.

- The owner creates and updates tiers.
- Purchase and renewal require the exact configured ETH price.
- Purchase and renewal mint the tier's monthly ParkCredits.
- Membership ETH is forwarded atomically to `OperatorTreasury`.
- Renewal before expiry extends the current period; renewal after expiry starts a new period.
- Expired memberships cannot create reservations.

### `OperatorRegistry`

Stores operator identity, whitelist state, supported categories, prices, capacity, no-show fees, and individual slot state.

- Only the owner registers and removes operators.
- The operator wallet manages its own prices, capacity, no-show fee, and slot availability.
- The owner may also perform administrative slot and configuration actions.
- A removed operator cannot receive new reservations.
- Existing reservations remain actionable after removal.
- A removed operator can be reactivated by registering the same operator ID with the same wallet.
- An active duplicate ID and a reactivation attempt with a different wallet revert.

Supported category labels are hashed to `bytes32` values:

- `standard`
- `disabled`
- `ev-charging`
- `motorbike`
- `family`
- `women`

### `ParkingLedger`

Owns the reservation lifecycle and settlement logic.

- Validates active membership, operator whitelist, category support, available slot, balance, overlaps, and monthly caps.
- Supports explicit slot selection and automatic free-slot assignment.
- Prevents overlapping active reservations for the same member, operator, and category.
- Tracks usage by category and operator using `timestamp / 30 days` as the month key.
- Charges the reserved duration at check-in.
- Charges rounded-up overstay hours only after the configured grace period.
- Settles missed reservations as no-shows.
- Releases reserved monthly usage when a reservation is cancelled or becomes a no-show.
- Records one 1–5 rating per checked-out reservation and exposes the operator average multiplied by 100.

Reservation status values are stable:

| Value | Status |
|---:|---|
| `0` | Reserved |
| `1` | CheckedIn |
| `2` | CheckedOut |
| `3` | Cancelled |
| `4` | NoShow |

### `OperatorTreasury`

Tracks collected operator earnings in credits and pays ETH at the current exchange rate.

- Only `ParkingLedger` allocates earnings.
- The default rate is `0.001 ETH` per credit.
- Membership purchases and renewals automatically fund the treasury.
- Anyone can add liquidity with `fundTreasury()`.
- A withdrawal pays the maximum whole-credit amount supported by current liquidity.
- Unpaid earnings remain recorded for a later withdrawal.
- Reads expose accumulated earnings, withdrawable earnings, available liquidity, required liquidity, and shortfall.

### `ParkChainRouter`

Stores the latest application-contract addresses under stable keys.

- The frontend needs only the router address.
- A redeployment can reuse the router and replace its stored contract addresses.
- Repointing the router does not migrate state from old contracts.

### Deployment order and permissions

The deployment script performs these operations:

1. Deploy `ParkCredit`.
2. Deploy `OperatorRegistry`.
3. Deploy `OperatorTreasury` with the registry and `0.001 ETH/credit` rate.
4. Deploy `MembershipManager` with the credit and payable treasury addresses.
5. Grant `MembershipManager` the ParkCredit minter role.
6. Configure the default membership tiers.
7. Deploy `ParkingLedger` with membership, registry, credit, and treasury addresses.
8. Grant `ParkingLedger` the ParkCredit burner role.
9. Set `ParkingLedger` as the treasury allocator.
10. Configure a 15-minute grace period.
11. Deploy or reuse `ParkChainRouter`.
12. Write the five application-contract addresses into the router.

Default local tiers:

| ID | Tier | Credits | Price | Monthly hour cap |
|---:|---|---:|---:|---:|
| `1` | Urban | 80 | 0.01 ETH | 20 |
| `2` | Commuter | 200 | 0.02 ETH | 60 |
| `3` | Unlimited | 400 | 0.03 ETH | 120 |


## Prerequisites and installation

Required:

- Node.js 22 or newer;
- npm;
- MetaMask or another browser wallet supporting custom networks.

Optional:

- Foundry `cast`, for convenient local-chain inspection and time manipulation;
- a Sepolia RPC provider and funded deployer wallet, for testnet deployment.

Verify the required tools:

```bash
node --version
npm --version
```

Install deterministic dependency versions from both lockfiles:

```bash
npm ci
npm ci --prefix frontend
```

Use `npm install` instead of `npm ci` only when intentionally updating dependencies or lockfiles.

## Build and automated tests

Run the complete verification sequence before starting the persistent local stack:

```bash
npm run build:contracts
npm run test:contracts
npm run gas:contracts
npm run frontend:build
```

The commands perform:

| Command | Purpose |
|---|---|
| `npm run build:contracts` | Compile Solidity `0.8.28` contracts and write Hardhat artifacts. |
| `npm run test:contracts` | Compile as needed and run all TypeScript/viem Hardhat tests. |
| `npm run gas:contracts` | Execute representative flows and print the gas table; compiled artifacts must exist. |
| `npm run frontend:build` | Type-check the React application and create the production Vite bundle. |

A successful test run must end with every test passing. The suite covers:

- ParkCredit roles and ERC-1155 behavior;
- membership administration, exact payment, renewal, expiry, minting, and treasury forwarding;
- operator registration, removal/reactivation, authorization, categories, prices, capacity, and slot state;
- reservations, automatic assignment, overlap prevention, caps, cancellation, check-in/out, no-show, overstay, partial settlement, and ratings;
- treasury allocation, exchange rates, liquidity reads, partial withdrawal, and top-up completion;
- router address management;
- full-contract integration and deterministic stress/invariant cases;
- every frontend ABI function signature against the compiled contract artifacts.

Hardhat tests are located in `contracts/hardhat-test/` and use the Node test runner with viem.

### Run one test file

Pass the file path after `--`:

```bash
npm run test:contracts -- contracts/hardhat-test/operator-registry.ts
```

Examples:

```bash
npm run test:contracts -- contracts/hardhat-test/parking-ledger.ts
npm run test:contracts -- contracts/hardhat-test/operator-treasury.ts
npm run test:contracts -- contracts/hardhat-test/frontend-abi-parity.ts
```

### Production frontend preview

After `npm run frontend:build`, preview the generated bundle:

```bash
npm --prefix frontend run preview
```

The preview server is for inspecting the built frontend. It does not start or deploy a blockchain.

## Run the complete application locally

The recommended development and manual-test workflow is:

```bash
npm start
```

This single command:

1. verifies that the Hardhat and Vite executables are installed;
2. refuses to continue if port `8545` is already serving an Ethereum node;
3. starts Hardhat at `http://127.0.0.1:8545` with chain ID `31337`;
4. waits for the node to become ready;
5. deploys and configures all contracts;
6. deploys `ParkChainRouter`;
7. passes the generated router address directly to Vite;
8. starts the frontend at [http://localhost:5173](http://localhost:5173).

Keep the terminal open while testing. Press `Ctrl+C` once to stop the frontend and local node.

Every fresh Hardhat node starts a new in-memory chain. Contract addresses, memberships, operators, reservations, and transaction history from the previous run no longer exist.

## Run each service separately

Use this workflow when developing contracts and the frontend in independent terminals.

### Terminal 1: local blockchain

```bash
npm run node:contracts
```

Wait until the Hardhat accounts and private keys are printed.

### Terminal 2: deployment

```bash
npm run deploy:contracts:local
```

Copy the printed `ParkChainRouter` address.

### Terminal 3: frontend

Either create `frontend/.env`:

```dotenv
VITE_PARKCHAIN_CHAIN_ID=31337
VITE_PARKCHAIN_RPC_URL=http://127.0.0.1:8545
VITE_PARKCHAIN_ROUTER_ADDRESS=0xYourRouterAddress
```

Then run:

```bash
npm run frontend:dev
```

Or pass the values for one process:

```bash
VITE_PARKCHAIN_CHAIN_ID=31337 \
VITE_PARKCHAIN_RPC_URL=http://127.0.0.1:8545 \
VITE_PARKCHAIN_ROUTER_ADDRESS=0xYourRouterAddress \
npm run frontend:dev
```

### Redeploy while keeping the same running chain

Reuse the router so the frontend can keep the same discovery address:

```bash
ROUTER_ADDRESS=0xYourRouterAddress npm run deploy:contracts:local
```

Refresh the frontend after deployment. This updates the router to new contracts; it does not migrate old state.

Do not reuse a router address after restarting the Hardhat node. The old router exists only on the discarded chain.

## Configure local wallets

Add this custom network to MetaMask:

```text
Network name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
Block explorer: leave empty
```

The first three standard Hardhat development accounts are:

| Role | Address | Private key |
|---|---|---|
| Admin/deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Operator | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Member | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

> These well-known keys are for the local Hardhat network only. Never fund or use them on a public network.

After importing the accounts:

1. open [http://localhost:5173](http://localhost:5173);
2. connect the wallet;
3. approve or switch to `Hardhat Local`;
4. confirm the application reports that the contracts were resolved from the router.

The connected address determines the available workspace:

- admin/deployer: tier, operator, grace-period, exchange-rate, allocator, and treasury controls;
- registered operator: price, capacity, no-show fee, slot, statistics, earnings, and withdrawal controls;
- member: membership, balance, reservation, lifecycle, rating, and usage controls.

## Local-chain time control

Reservation lifecycle scenarios depend on block time. With Foundry installed:

```bash
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

Without Foundry, use JSON-RPC directly:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"evm_increaseTime","params":[3600]}'

curl -X POST http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"evm_mine","params":[]}'
```

The example advances one hour and mines a block. Adjust the seconds for the scenario.

## Sepolia deployment

Create and fund a dedicated Sepolia deployer. Never commit its private key.

Required shell variables:

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc-url
SEPOLIA_PRIVATE_KEY=0xYourDeployerPrivateKey
```

Deploy:

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc-url \
SEPOLIA_PRIVATE_KEY=0xYourDeployerPrivateKey \
npm run deploy:contracts:sepolia
```

Copy the printed router address and configure the frontend:

```dotenv
VITE_PARKCHAIN_CHAIN_ID=11155111
VITE_PARKCHAIN_RPC_URL=https://your-sepolia-rpc-url
VITE_PARKCHAIN_ROUTER_ADDRESS=0xYourSepoliaRouter
```

For later deployments, reuse the router:

```bash
SEPOLIA_RPC_URL=https://your-sepolia-rpc-url \
SEPOLIA_PRIVATE_KEY=0xYourDeployerPrivateKey \
ROUTER_ADDRESS=0xYourSepoliaRouter \
npm run deploy:contracts:sepolia
```

The deployer becomes owner/admin of the new contracts. Reusing the router changes discovery addresses but does not migrate memberships, operators, reservations, credits, or earnings.

Only public `VITE_*` values belong in frontend hosting configuration. Never expose `SEPOLIA_PRIVATE_KEY` to Vite, Vercel, or any client bundle.

## CI/CD

GitHub Actions runs on pushes and pull requests. The workflow:

1. checks out the repository;
2. installs root and frontend dependencies;
3. compiles contracts;
4. runs the Hardhat suite;
5. generates the gas report;
6. builds the frontend.

The local equivalent is:

```bash
npm ci
npm ci --prefix frontend
npm run build:contracts
npm run test:contracts
npm run gas:contracts
npm run frontend:build
```
