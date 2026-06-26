import { operatorRegistryAbi, operatorTreasuryAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { readContract, toUint } from "../lib/wallet";

export function OperatorPage({ app }: any) {
  return (
    <div className="dashboard-grid">
      <div className="stack">
        <SharedFields app={app} lockOperatorId />

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Maintain the prices for your operator ID and supported category.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Price per hour</span>
                <Input value={app.pricePerHour} onChange={(event: any) => app.setPricePerHour(event.target.value)} />
              </Label>
              <Label>
                <span>No-show fee</span>
                <Input value={app.noShowFee} onChange={(event: any) => app.setNoShowFee(event.target.value)} />
              </Label>
            </div>
            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Set price", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "setPricePerHour", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      toUint(app.pricePerHour, "Price per hour"),
                    ]),
                  )
                }
              >
                Set Price
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Set no-show fee", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "setNoShowFee", [
                      toUint(app.operatorId, "Operator ID"),
                      toUint(app.noShowFee, "No-show fee"),
                    ]),
                  )
                }
              >
                Set No-Show Fee
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parking Capacity</CardTitle>
            <CardDescription>Configure and review available slots for the selected operator ID and category.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <Label>
              <span>Category capacity</span>
              <Input
                min="1"
                type="number"
                value={app.categoryCapacity}
                onChange={(event: any) => app.setCategoryCapacity(event.target.value)}
              />
            </Label>
            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Set category capacity", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "setCategoryCapacity", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      toUint(app.categoryCapacity, "Category capacity"),
                    ]),
                  )
                }
              >
                Set Capacity
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Category capacity", () =>
                    readContract({
                      address: app.requireRegistry(),
                      abi: operatorRegistryAbi,
                      functionName: "getCategoryCapacity",
                      args: [toUint(app.operatorId, "Operator ID"), app.categoryHash],
                    }),
                  )
                }
              >
                Get Capacity
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
                app.run("Supports category", () =>
                  readContract({
                    address: app.requireRegistry(),
                    abi: operatorRegistryAbi,
                    functionName: "supportsCategory",
                    args: [toUint(app.operatorId, "Operator ID"), app.categoryHash],
                  }),
                )
              }
            >
              Supports Category
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("Price per hour", () =>
                  readContract({
                    address: app.requireRegistry(),
                    abi: operatorRegistryAbi,
                    functionName: "getPricePerHour",
                    args: [toUint(app.operatorId, "Operator ID"), app.categoryHash],
                  }),
                )
              }
            >
              Get Price
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                app.run("No-show fee", () =>
                  readContract({
                    address: app.requireRegistry(),
                    abi: operatorRegistryAbi,
                    functionName: "getNoShowFee",
                    args: [toUint(app.operatorId, "Operator ID")],
                  }),
                )
              }
            >
              Get No-Show Fee
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
