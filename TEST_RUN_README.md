# ParkChain Local Test Run Guide

This guide explains how to install the required tools, run Hardhat tests, deploy the current contracts locally, connect a wallet, and interact with the frontend.

## 1. Install Required Tools

You need:

- Node.js and npm.
- MetaMask or another browser wallet that supports custom RPC networks.

### Install Node.js

Install the current LTS version from:

```text
https://nodejs.org/
```

Verify installation:

```bash
node --version
npm --version
```

This project uses Hardhat 3, which requires Node.js v22 or later.

### Install MetaMask

Install MetaMask from:

```text
https://metamask.io/
```

MetaMask is used by the frontend to sign local transactions.

## 2. Install Project Dependencies

From the repository root:

```bash
npm install
cd frontend
npm install
cd ..
```

The root `package.json` contains Hardhat and contract testing dependencies.

The `frontend/package.json` contains the Vite and React frontend dependencies.

## 3. Build and Test Contracts With Hardhat

From the repository root:

```bash
npm run build:contracts
npm run test:contracts
```

Expected Hardhat test result:

```text
all contract tests passing
```

The Hardhat tests are TypeScript `node:test` tests using viem. They live in:

```text
contracts/hardhat-test/
```

The CI contract suite uses Hardhat. Run it from the repository root with:

```bash
npm run test:contracts
```

Generate the gas table with:

```bash
npm run gas:contracts
```

## 4. Start a Local Hardhat Blockchain

In terminal 1, from the repository root:

```bash
npm run node:contracts
```

Keep this terminal running.

Hardhat starts a local Ethereum chain at:

```text
http://127.0.0.1:8545
```

The default chain ID is:

```text
31337
```

Hardhat prints local test accounts and private keys. These accounts have local test ETH.

Common first local account:

```text
Address:
0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

Private key:
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Common second local account:

```text
Address:
0x70997970c51812dc3a010c7d01b50e0d17dc79c8

Private key:
0x59c6995e998f97a5a0044966f094538d6e2e8e9dffedc28397b0f6054d76b4
```

Never use local development private keys on real networks.

## 5. Deploy Contracts Locally With Hardhat

In terminal 2, from the repository root:

```bash
npm run deploy:contracts:local
```

After successful deployment, Hardhat prints contract addresses like:

```text
ParkCredit: 0x...
MembershipManager: 0x...
OperatorRegistry: 0x...
OperatorTreasury: 0x...
ParkingLedger: 0x...
```

The script also grants `MembershipManager` the ParkCredit minter role, grants `ParkingLedger` the ParkCredit burner role, sets `ParkingLedger` as the treasury allocator, configures a 15-minute grace period, and configures the Urban, Commuter, and Unlimited tiers.

Copy the addresses. You will paste them into the frontend.

## 6. Configure MetaMask

Add a custom network:

```text
Network name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
Block explorer: leave empty
```

Import the first local account into MetaMask:

```text
Account menu -> Import account -> Private key
```

Paste:

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This account is the deployer/admin account if you deployed with the command above.

Optionally import the second local account too:

```text
0x59c6995e998f97a5a0044966f094538d6e2e8e9dffedc28397b0f6054d76b4
```

Use this as an operator wallet during testing.

## 7. Start the Frontend

In terminal 3, from the repository root:

```bash
npm run frontend:dev
```

The default frontend URL is:

```text
http://localhost:5173/
```

Open that URL in the browser where MetaMask is installed.

## 8. Connect Wallet and Paste Addresses

In the frontend:

1. Click `Connect Wallet`.
2. Select MetaMask.
3. Make sure MetaMask is connected to `Hardhat Local`.
4. Paste the deployed `ParkCredit` address.
5. Paste the deployed `MembershipManager` address.
6. Paste the deployed `OperatorRegistry` address.
7. Paste the deployed `OperatorTreasury` address.
8. Paste the deployed `ParkingLedger` address.

## 9. Role Rules

The connected wallet determines which contract actions are allowed.

Admin/deployer wallet:

- Set membership tiers.
- Register operator.
- Remove operator.
- Set supported category.
- Set treasury allocator.
- Set exchange rate.
- Set booking grace period.

Operator wallet:

- Set price per hour.
- Set no-show fee.
- Withdraw earnings.

Any wallet:

- Purchase or renew a membership by sending the exact tier price.
- Reserve, cancel, check in, check out, and mark no-shows through `ParkingLedger`.
- Read ParkCredit balance.
- Read membership activity, tier, cap, and expiry.
- Read reservations and monthly usage.
- Read whitelist status.
- Read category support.
- Read price.
- Read no-show fee.
- Read operator wallet.
- Read accumulated earnings.
- Read exchange rate.

## 10. Example Manual Test Flow

### A. Register an Operator

In MetaMask, select the admin/deployer account:

```text
0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
```

In the frontend:

1. Set `Operator ID` to `1`.
2. Set `Operator wallet` to the second local account:

```text
0x70997970c51812dc3a010c7d01b50e0d17dc79c8
```

3. Set `Operator name` to any name, for example:

```text
Central Garage
```

4. Select one or more registration categories.
5. Click `Register Operator`.
6. Confirm the transaction in MetaMask.

### B. Check Registration

In the `Reads` tab:

1. Click `Is Whitelisted`.
2. Expected output:

```text
true
```

3. Click `Supports Category`.
4. Expected output for a selected category:

```text
true
```

### C. Set Operator Price

Switch MetaMask to the operator account:

```text
0x70997970c51812dc3a010c7d01b50e0d17dc79c8
```

In the frontend:

1. Open the `Operator` tab.
2. Set `Price per hour`, for example:

```text
10
```

3. Click `Set Price`.
4. Confirm the transaction in MetaMask.

Then open the `Reads` tab and click `Get Price`.

Expected output:

```text
10
```

### D. Set No-Show Fee

Still using the operator account:

1. Open the `Operator` tab.
2. Set `No-show fee`, for example:

```text
5
```

3. Click `Set No-Show Fee`.
4. Confirm the transaction in MetaMask.

Then open the `Reads` tab and click `Get No-Show Fee`.

Expected output:

```text
5
```

### E. Reserve and Settle a Booking

Switch MetaMask to a member account and purchase a membership with the exact tier price. Then:

1. Set `Operator ID`, `Category`, `Start timestamp`, and `Duration hours`.
2. Click `Reserve`.
3. Use `Get Reservations` or `Get Reservation` to inspect the stored booking.
4. At or after the start timestamp, click `Check In`.
5. Click `Check Out` after the occupancy period.

Check `Get Credit Balance` and `Get Earnings` to confirm credits were burned and operator earnings were allocated.
