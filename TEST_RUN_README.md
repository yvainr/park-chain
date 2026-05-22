# ParkChain Local Test Run Guide

This guide explains how to install the required tools, run the local blockchain, deploy the current contracts, connect a wallet, and interact with the frontend.

## 1. Install Required Tools

You need:

- Node.js and npm for the frontend.
- Foundry for Solidity contracts.
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

### Install Foundry

Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Restart your terminal after installation.

Verify installation:

```bash
forge --version
anvil --version
cast --version
```

Foundry tools:

- `forge`: builds, tests, and deploys Solidity contracts.
- `anvil`: runs a local Ethereum development chain.
- `cast`: sends transactions and reads contract data from the command line.

### Install MetaMask

Install MetaMask from:

```text
https://metamask.io/
```

MetaMask is used by the frontend to sign local transactions.

## 2. Install Project Dependencies

From the repository root:

```bash
cd frontend
npm install
```

The contracts currently use Foundry without external Solidity package dependencies.

## 3. Start a Local Blockchain

In terminal 1:

```bash
anvil
```

Keep this terminal running.

Anvil starts a local Ethereum chain at:

```text
http://127.0.0.1:8545
```

The default chain ID is:

```text
31337
```

Anvil also prints test accounts and private keys. These accounts have local test ETH.

Common first Anvil account:

```text
Address:
0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266

Private key:
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Common second Anvil account:

```text
Address:
0x70997970c51812dc3a010c7d01b50e0d17dc79c8

Private key:
0x59c6995e998f97a5a0044966f094538d6e2e8e9dffedc28397b0f6054d76b4
```

Never use Anvil private keys on real networks.

## 4. Build and Test Contracts

In terminal 2, from the repository root:

```bash
cd contracts
forge build
forge test
```

## 5. Deploy Contracts Locally

Use the first Anvil account as the deployer/admin account:

```bash
cd contracts

forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

After successful deployment, Foundry prints contract addresses like:

```text
registry: contract OperatorRegistry 0x...
treasury: contract OperatorTreasury 0x...
```

Copy both addresses. You will paste them into the frontend.

If deployment fails with:

```text
You seem to be using Foundry's default sender. Be sure to set your own --sender.
```

then you did not provide a usable transaction sender. Use the `--private-key` command shown above.

## 6. Configure MetaMask

Add a custom network:

```text
Network name: Anvil Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
Block explorer: leave empty
```

Import the first Anvil account into MetaMask:

```text
Account menu -> Import account -> Private key
```

Paste:

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This account is the deployer/admin account if you deployed with the command above.

Optionally import the second Anvil account too:

```text
0x59c6995e998f97a5a0044966f094538d6e2e8e9dffedc28397b0f6054d76b4
```

Use this as an operator wallet during testing.

## 7. Start the Frontend

In terminal 3, from the repository root:

```bash
cd frontend
npm run dev
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
3. Make sure MetaMask is connected to `Anvil Local`.
4. Paste the deployed `OperatorRegistry` address.
5. Paste the deployed `OperatorTreasury` address.

## 9. Role Rules

The connected wallet determines which contract actions are allowed.

Admin/deployer wallet:

- Register operator.
- Remove operator.
- Set supported category.
- Set treasury allocator.
- Set exchange rate.

Operator wallet:

- Set price per hour.
- Set no-show fee.
- Withdraw earnings.

Any wallet:

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
2. Set `Operator wallet` to the second Anvil account:

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

## 11. Current Limitation

The current frontend can call all methods currently exposed for `OperatorRegistry` and `OperatorTreasury`.

However, `allocateEarnings` is not exposed as a normal frontend button because it is intended to be called later by `ParkingLedger`.

For now, treasury earnings can be fully tested through Foundry tests. Once `ParkingLedger` exists, it will become the allocator and will call:

```solidity
OperatorTreasury.allocateEarnings(operatorId, amountCredits)
```
