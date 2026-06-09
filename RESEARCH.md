# ParkChain Research Notes

## 1. Task Tracker – Linear.app

We used Linear as our task tracker. Its advantage is integration with developer tools, especially GitHub: Linear issues can be connected to commits, branches, and pull requests, so every code change can be linked back to a concrete task. Linear can also integrate with tools such as Slack, Notion, GitLab, Sentry, and coding agents, which makes it a good coordination layer between planning, communication, debugging, and implementation.

Useful links:

- Linear official website: https://linear.app/
- Linear GitHub integration: https://linear.app/integrations/github

## 2. Entry point contract / address registry

A problem in blockchain development is that every new contract deployment creates a new contract address. If an application stores contract addresses directly, then every redeployment requires updating its configuration. The solution is an entry point contract, or address registry: the application knows only the stable address of this registry and asks it for the current address of the required contract. This idea is related to upgradeability patterns, but it is simpler. A proxy forwards calls to another implementation contract, while an address registry only stores and returns current contract addresses. The main risk is access control, because whoever can update the registry can redirect users to another contract, so this role must be protected.


Useful links:

- OpenZeppelin proxy upgrade pattern: https://docs.openzeppelin.com/upgrades-plugins/proxies
- OpenZeppelin proxy contracts: https://docs.openzeppelin.com/contracts/5.x/api/proxy
- OpenZeppelin guide to writing upgradeable contracts: https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable

## 3. Gas tracking in CI/CD

Gas cost is part of the blockchain applications, to control this, gas usage can be measured automatically in CI/CD by running contract tests in GitHub Actions with a tool such as hardhat-gas-reporter, which compiles the contracts, runs the tests, and prints a gas table showing whether recent changes made functions more expensive.

Useful links:

- GitHub Actions documentation: https://docs.github.com/actions
- GitHub Actions continuous integration guide: https://docs.github.com/en/actions/get-started/continuous-integration
- Hardhat gas reporter: https://github.com/cgewecke/hardhat-gas-reporter

Example CI idea:

```yaml
name: Contract checks

on:
  push:
  pull_request:

jobs:
  hardhat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx hardhat test
```

With `hardhat-gas-reporter` enabled in the Hardhat configuration, the test run also prints a gas usage table.

## 4. Payment confirmation with signed QR permits

A key real-world problem in ParkChain is payment confirmation. The blockchain may know that a reservation was paid, but a gate attendant should not be expected to manually verify a transaction hash. Our solution is to give the user a QR code after payment. The QR code contains a signed parking permit with the needed data: reservation id, parking id, spot id, validity time, a hash of the car registration number, a nonce, and the operator's signature.

The important idea is that the QR code should not be only a short OTP. A signed permit is stronger because the gate attendant can verify that the permit was issued by the parking operator and that the data was not changed. The gatekeeper scans the QR code, checks the operator signature with the public key, checks the validity time, checks that the reservation is paid, and then marks the permit as used.

Useful links:

- EIP-712: Typed structured data hashing and signing: https://eips.ethereum.org/EIPS/eip-712
- ERC-191: Signed Data Standard: https://eips.ethereum.org/EIPS/eip-191
- OpenZeppelin cryptography utilities: https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography
- OpenZeppelin ECDSA source/library: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol

Suggested permit payload example:

```json
{
  "reservationId": "0x...",
  "parkingId": "TU-BERLIN-P1",
  "spotId": "A-14",
  "validFrom": 1710000000,
  "validUntil": 1710007200,
  "plateHash": "0x...",
  "nonce": "0x...",
  "signature": "0x..."
}
```

Suggested verification logic:

1. Parse the QR code payload.
2. Verify the operator signature with the operator public key/address.
3. Check that the current time is inside `validFrom` and `validUntil`.
4. Check that the reservation is paid.
5. Check that the permit has not already been used.
6. Mark the reservation or permit as used after successful entry.

## References

1. Linear official website — https://linear.app/
2. Linear GitHub integration — https://linear.app/integrations/github
3. OpenZeppelin proxy upgrade pattern — https://docs.openzeppelin.com/upgrades-plugins/proxies
4. OpenZeppelin proxy contracts — https://docs.openzeppelin.com/contracts/5.x/api/proxy
5. OpenZeppelin guide to writing upgradeable contracts — https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable
6. GitHub Actions documentation — https://docs.github.com/actions
7. GitHub Actions continuous integration guide — https://docs.github.com/en/actions/get-started/continuous-integration
8. Hardhat gas reporter — https://github.com/cgewecke/hardhat-gas-reporter
9. EIP-712 — https://eips.ethereum.org/EIPS/eip-712
10. ERC-191 — https://eips.ethereum.org/EIPS/eip-191
11. OpenZeppelin cryptography utilities — https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography
12. OpenZeppelin ECDSA source/library — https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/ECDSA.sol
