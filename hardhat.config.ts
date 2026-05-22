import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatViem, hardhatViemAssertions, hardhatNodeTestRunner, hardhatNetworkHelpers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.24",
      },
    },
  },
  paths: {
    sources: "./contracts/src",
    tests: "./contracts/hardhat-test",
    artifacts: "./contracts/hardhat-artifacts",
    cache: "./contracts/hardhat-cache",
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
  },
});
