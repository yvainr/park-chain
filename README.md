# park-chain

### Run Tests

```bash
npx hardhat test test/OperatorRegistry.js
```

### Run Coverage

```bash
npx hardhat coverage --testfiles test/OperatorRegistry.js
```

### Deploy to Sepolia

Set `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY`, then run:

```bash
npx hardhat run scripts/deploy-operator-registry.js --network sepolia
```