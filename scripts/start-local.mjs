import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const LOCAL_CHAIN_ID = "31337";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const STARTUP_TIMEOUT_MS = 30_000;
const RETRY_INTERVAL_MS = 500;
const executableExtension = process.platform === "win32" ? ".cmd" : "";
const hardhatCommand = join(process.cwd(), "node_modules", ".bin", `hardhat${executableExtension}`);
const viteCommand = join(process.cwd(), "frontend", "node_modules", ".bin", `vite${executableExtension}`);
const children = new Set();

let stopping = false;

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    ...options,
  });

  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") {
      console.error(`Could not stop process ${child.pid}:`, error);
    }
  }
}

function stop(exitCode) {
  if (stopping) {
    return;
  }

  stopping = true;
  for (const child of children) {
    stopChild(child);
  }
  process.exitCode = exitCode;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function verifyDependencies() {
  if (!existsSync(hardhatCommand) || !existsSync(viteCommand)) {
    throw new Error(
      "Dependencies are missing. Run `npm install && npm install --prefix frontend`, then run `npm start` again.",
    );
  }
}

async function getLocalChainId() {
  try {
    const response = await fetch(LOCAL_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(1_000),
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
      }),
    });
    const payload = await response.json();
    return response.ok && typeof payload.result === "string" ? payload.result : null;
  } catch {
    return null;
  }
}

async function waitForLocalNode(nodeProcess) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (nodeProcess.exitCode !== null || nodeProcess.signalCode !== null) {
      throw new Error("The local Hardhat node exited before it became ready.");
    }

    if ((await getLocalChainId()) === "0x7a69") {
      return;
    }

    await delay(RETRY_INTERVAL_MS);
  }

  throw new Error(`The local Hardhat node was not ready within ${STARTUP_TIMEOUT_MS / 1_000} seconds.`);
}

function deployContracts() {
  return new Promise((resolve, reject) => {
    const deployment = run(hardhatCommand, ["run", "scripts/deploy-hardhat.ts", "--network", "localhost"], {
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";

    deployment.stdout.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    deployment.stderr.on("data", (chunk) => {
      output += chunk;
      process.stderr.write(chunk);
    });
    deployment.once("error", reject);
    deployment.once("close", (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Contract deployment failed${signal ? ` (${signal})` : ` with exit code ${code}`}.`));
        return;
      }

      const routerAddress = output.match(
        /(?:ParkChainRouter|Reusing ParkChainRouter):\s*(0x[a-fA-F0-9]{40})/,
      )?.[1];

      if (!routerAddress) {
        reject(new Error("Contract deployment did not report a ParkChainRouter address."));
        return;
      }

      resolve(routerAddress);
    });
  });
}

async function main() {
  verifyDependencies();

  if (await getLocalChainId()) {
    throw new Error(
      `Port 8545 is already serving an Ethereum JSON-RPC node. Stop it before running \`npm start\`.`,
    );
  }

  console.log("Starting the local Hardhat node...");
  const nodeProcess = run(hardhatCommand, ["node"], { stdio: "inherit" });
  nodeProcess.once("error", (error) => {
    console.error("Could not start the local Hardhat node:", error);
    stop(1);
  });
  nodeProcess.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(`The local Hardhat node stopped${signal ? ` (${signal})` : ` with exit code ${code}`}.`);
      stop(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : code && code > 0 ? code : 1);
    }
  });

  await waitForLocalNode(nodeProcess);
  console.log("\nLocal Hardhat node is ready. Deploying ParkChain...");
  const routerAddress = await deployContracts();

  console.log(`\nStarting the frontend with ParkChainRouter ${routerAddress}...`);
  const frontendProcess = run(viteCommand, [], {
    cwd: join(process.cwd(), "frontend"),
    env: {
      ...process.env,
      VITE_PARKCHAIN_CHAIN_ID: LOCAL_CHAIN_ID,
      VITE_PARKCHAIN_RPC_URL: LOCAL_RPC_URL,
      VITE_PARKCHAIN_ROUTER_ADDRESS: routerAddress,
    },
    stdio: "inherit",
  });

  frontendProcess.once("error", (error) => {
    console.error("Could not start the frontend:", error);
    stop(1);
  });
  frontendProcess.once("exit", (code, signal) => {
    if (!stopping) {
      stop(signal === "SIGINT" ? 130 : (code ?? 1));
    }
  });
}

process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
});
