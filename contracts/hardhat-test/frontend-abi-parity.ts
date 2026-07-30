import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  membershipManagerAbi,
  operatorRegistryAbi,
  operatorTreasuryAbi,
  parkChainRouterAbi,
  parkCreditAbi,
  parkingLedgerAbi,
} from "../../frontend/src/abi/contracts.js";

type AbiParameter = {
  type: string;
  components?: readonly AbiParameter[];
};

type AbiFunction = {
  type: string;
  name: string;
  stateMutability: string;
  inputs: readonly AbiParameter[];
  outputs: readonly AbiParameter[];
};

function parameterType(parameter: AbiParameter): string {
  if (!parameter.type.startsWith("tuple")) {
    return parameter.type;
  }

  const suffix = parameter.type.slice("tuple".length);
  return `(${(parameter.components ?? []).map(parameterType).join(",")})${suffix}`;
}

function functionSignature(item: AbiFunction): string {
  return `${item.name}(${item.inputs.map(parameterType).join(",")})`;
}

async function loadCompiledAbi(contractName: string): Promise<AbiFunction[]> {
  const artifactUrl = new URL(
    `../hardhat-artifacts/contracts/src/${contractName}.sol/${contractName}.json`,
    import.meta.url,
  );
  const artifact = JSON.parse(await readFile(artifactUrl, "utf8"));
  return artifact.abi.filter((item: AbiFunction) => item.type === "function");
}

const frontendContracts = [
  ["ParkChainRouter", parkChainRouterAbi],
  ["ParkCredit", parkCreditAbi],
  ["MembershipManager", membershipManagerAbi],
  ["OperatorRegistry", operatorRegistryAbi],
  ["ParkingLedger", parkingLedgerAbi],
  ["OperatorTreasury", operatorTreasuryAbi],
] as const;

describe("Frontend ABI parity", function () {
  for (const [contractName, frontendAbi] of frontendContracts) {
    it(`matches every ${contractName} frontend function to the compiled artifact`, async function () {
      const compiledAbi = await loadCompiledAbi(contractName);
      const compiledBySignature = new Map(compiledAbi.map((item) => [functionSignature(item), item]));

      for (const frontendItem of frontendAbi) {
        const frontendFunction = frontendItem as AbiFunction;
        const signature = functionSignature(frontendFunction);
        const compiledFunction = compiledBySignature.get(signature);

        assert.ok(compiledFunction, `${contractName}.${signature} is missing from the compiled artifact`);
        assert.equal(
          frontendFunction.stateMutability,
          compiledFunction.stateMutability,
          `${contractName}.${signature} has ABI state-mutability drift`,
        );
        assert.deepEqual(
          frontendFunction.outputs.map(parameterType),
          compiledFunction.outputs.map(parameterType),
          `${contractName}.${signature} has ABI output drift`,
        );
      }
    });
  }
});
