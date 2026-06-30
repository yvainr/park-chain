import { useEffect, useState } from "react";
import { operatorRegistryAbi, operatorTreasuryAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import { readContract, toUint } from "../lib/wallet";

type OperatorCategorySetting = {
  capacity: string;
  pricePerHour: string;
  supported: boolean;
};

export function OperatorPage({ app }: any) {
  const [categorySettings, setCategorySettings] = useState<Record<string, OperatorCategorySetting>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function loadOperatorSettings() {
    setSettingsLoading(true);
    setSettingsError("");

    try {
      const operatorId = toUint(app.operatorId, "Operator ID");
      const noShowFee = await readContract({
        address: app.requireRegistry(),
        abi: operatorRegistryAbi,
        functionName: "getNoShowFee",
        args: [operatorId],
      });
      const entries = await Promise.all(
        app.categoryNames.map(async (name: string) => {
          const categoryHash = app.categoryHashForName(name);
          const [supported, pricePerHour, capacity] = await Promise.all([
            readContract({
              address: app.requireRegistry(),
              abi: operatorRegistryAbi,
              functionName: "supportsCategory",
              args: [operatorId, categoryHash],
            }),
            readContract({
              address: app.requireRegistry(),
              abi: operatorRegistryAbi,
              functionName: "getPricePerHour",
              args: [operatorId, categoryHash],
            }),
            readContract({
              address: app.requireRegistry(),
              abi: operatorRegistryAbi,
              functionName: "getCategoryCapacity",
              args: [operatorId, categoryHash],
            }),
          ]);
          return [
            name,
            {
              capacity: String(capacity),
              pricePerHour: String(pricePerHour),
              supported: Boolean(supported),
            },
          ] as const;
        }),
      );

      app.setNoShowFee(String(noShowFee));
      setCategorySettings(Object.fromEntries(entries));
      return { noShowFee, categories: Object.fromEntries(entries) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSettingsError(message);
      throw error;
    } finally {
      setSettingsLoading(false);
    }
  }

  useEffect(() => {
    if (!app.registryAddress || !app.operatorId) return;
    void loadOperatorSettings().catch(() => undefined);
  }, [app.registryAddress, app.operatorId]);

  function updateCategorySetting(name: string, patch: Partial<OperatorCategorySetting>) {
    setCategorySettings({
      ...categorySettings,
      [name]: {
        capacity: categorySettings[name]?.capacity ?? "0",
        pricePerHour: categorySettings[name]?.pricePerHour ?? "0",
        supported: Boolean(categorySettings[name]?.supported),
        ...patch,
      },
    });
  }

  async function saveOperatorSettings() {
    const supportedNames = app.categoryNames.filter((name: string) => categorySettings[name]?.supported);
    if (supportedNames.length === 0) throw new Error("This operator has no supported categories to update");

    const categories = supportedNames.map((name: string) => app.categoryHashForName(name));
    const pricesPerHour = supportedNames.map((name: string) =>
      toUint(categorySettings[name]?.pricePerHour ?? "0", `${name} price per hour`),
    );
    const capacities = supportedNames.map((name: string) =>
      toUint(categorySettings[name]?.capacity ?? "0", `${name} slot capacity`),
    );

    for (let index = 0; index < capacities.length; index += 1) {
      if (capacities[index] === 0n) throw new Error(`${supportedNames[index]} slot capacity must be greater than zero`);
    }

    const result = await app.txBase(app.requireRegistry(), operatorRegistryAbi, "updateOperatorSettings", [
      toUint(app.operatorId, "Operator ID"),
      categories,
      pricesPerHour,
      capacities,
      toUint(app.noShowFee, "No-show fee"),
    ]);
    await loadOperatorSettings();
    return result;
  }

  return (
    <div className="dashboard-grid">
      <div className="stack">
        <SharedFields app={app} lockOperatorId />

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Category Settings</CardTitle>
              <CardDescription>Manage pricing and slot capacity for every category assigned by the admin.</CardDescription>
            </div>
            <Button variant="secondary" onClick={() => app.run("Refresh operator settings", loadOperatorSettings)}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>No-show fee</span>
                <Input
                  min="0"
                  type="number"
                  value={app.noShowFee}
                  onChange={(event: any) => app.setNoShowFee(event.target.value)}
                />
              </Label>
              <div className="operator-settings-status">
                {settingsLoading && <Badge variant="secondary">Loading settings</Badge>}
                {settingsError && <Badge variant="error">Settings unavailable</Badge>}
              </div>
            </div>

            {settingsError && <p className="operator-settings-error">{settingsError}</p>}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price per hour</TableHead>
                  <TableHead>Slot capacity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.categoryNames.map((name: string) => {
                  const setting = categorySettings[name] ?? {
                    capacity: "0",
                    pricePerHour: "0",
                    supported: false,
                  };
                  return (
                    <TableRow key={name}>
                      <TableCell>
                        <strong>{name}</strong>
                        <code title={app.categoryHashForName(name)}>
                          {`${app.categoryHashForName(name).slice(0, 10)}...${app.categoryHashForName(name).slice(-8)}`}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={setting.supported ? "success" : "secondary"}>
                          {setting.supported ? "Supported" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={!setting.supported || settingsLoading}
                          min="0"
                          type="number"
                          value={setting.pricePerHour}
                          onChange={(event: any) =>
                            updateCategorySetting(name, { pricePerHour: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={!setting.supported || settingsLoading}
                          min="1"
                          type="number"
                          value={setting.capacity}
                          onChange={(event: any) => updateCategorySetting(name, { capacity: event.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="actions">
              <Button disabled={settingsLoading} onClick={() => app.run("Save operator settings", saveOperatorSettings)}>
                Save Category Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
            <CardDescription>Review operator setup, accumulated credits, and payout configuration.</CardDescription>
          </CardHeader>
          <CardContent className="read-grid">
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Operator wallet", () =>
                  readContract({
                    address: app.requireRegistry(),
                    abi: operatorRegistryAbi,
                    functionName: "getOperatorWallet",
                    args: [toUint(app.operatorId, "Operator ID")],
                  }),
                )
              }
            >
              Get Wallet
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Whitelisted", () =>
                  readContract({
                    address: app.requireRegistry(),
                    abi: operatorRegistryAbi,
                    functionName: "isWhitelisted",
                    args: [toUint(app.operatorId, "Operator ID")],
                  }),
                )
              }
            >
              Is Whitelisted
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Accumulated earnings", () =>
                  readContract({
                    address: app.requireTreasury(),
                    abi: operatorTreasuryAbi,
                    functionName: "getAccumulatedEarnings",
                    args: [toUint(app.operatorId, "Operator ID")],
                  }),
                )
              }
            >
              Get Earnings
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Exchange rate", () =>
                  readContract({
                    address: app.requireTreasury(),
                    abi: operatorTreasuryAbi,
                    functionName: "getCreditToEthRate",
                  }),
                )
              }
            >
              Get Rate
            </Button>
            <Button
              onClick={() =>
                app.run("Withdraw earnings", () =>
                  app.txBase(app.requireTreasury(), operatorTreasuryAbi, "withdraw", [toUint(app.operatorId, "Operator ID")]),
                )
              }
            >
              Withdraw
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="side-stack">
        <ContractPanel app={app} />
        <OutputPanel app={app} />
      </aside>
    </div>
  );
}
