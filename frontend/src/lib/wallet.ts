import { type Abi, type Address, createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat } from "viem/chains";

declare global {
  interface Window {
    ethereum?: {
      request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
    };
  }
}

export function requireEthereum() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found");
  }

  return window.ethereum;
}

export async function connectWallet() {
  const accounts = await requireEthereum().request<Address[]>({ method: "eth_requestAccounts" });
  return accounts[0] ?? "";
}

export function toAddress(value: string, label = "Address") {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`${label} must be a 20-byte hex address`);
  }

  return trimmed as Address;
}

export function toUint(value: string | number | bigint, label = "Value") {
  try {
    const parsed = BigInt(value || 0);
    if (parsed < 0n) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

const HARDHAT_TX_GAS_CAP = 16_000_000n;

function walletClient(account: Address) {
  return createWalletClient({
    account,
    chain: hardhat,
    transport: custom(requireEthereum()),
  });
}

export async function readContract(args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}) {
  return publicClient.readContract({
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
  } as any);
}

export async function writeContract(args: {
  account: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}) {
  const client = walletClient(args.account);
  const estimatedGas = await publicClient.estimateContractGas({
    account: args.account,
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
    value: args.value,
  } as any);
  const gas = estimatedGas + estimatedGas / 5n + 10_000n;

  if (gas > HARDHAT_TX_GAS_CAP) {
    throw new Error(`Estimated gas ${gas.toString()} exceeds the local Hardhat transaction cap`);
  }

  const hash = await client.writeContract({
    account: args.account,
    address: args.address,
    abi: args.abi,
    functionName: args.functionName,
    args: args.args ?? [],
    value: args.value,
    gas,
  } as any);

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}
