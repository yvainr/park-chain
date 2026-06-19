import { membershipManagerAbi, operatorRegistryAbi, operatorTreasuryAbi, parkingLedgerAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label } from "../components/ui";
import { toAddress, toUint } from "../lib/wallet";

export function AdminPage({ app }: any) {
  return (
    <div className="dashboard-grid">
      <div className="stack">
        <ContractPanel app={app} />
        <SharedFields app={app} />

        <Card>
          <CardHeader>
            <CardTitle>Operator Management</CardTitle>
            <CardDescription>Whitelist operators and control the categories they can offer.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Operator wallet</span>
                <Input value={app.operatorWallet} onChange={(event: any) => app.setOperatorWallet(event.target.value)} />
              </Label>
              <Label>
                <span>Operator name</span>
                <Input value={app.operatorName} onChange={(event: any) => app.setOperatorName(event.target.value)} />
              </Label>
            </div>

            <div className="category-card">
              <div>
                <h3>Registration categories</h3>
                <p>Selected categories are hashed to bytes32 before registration.</p>
              </div>
              <div className="checks">
                {app.categoryNames.map((name: string) => (
                  <Label className="check-row" key={name}>
                    <Checkbox
                      checked={app.selectedCategories[name]}
                      onChange={(event: any) =>
                        app.setSelectedCategories({ ...app.selectedCategories, [name]: event.target.checked })
                      }
                    />
                    <span>{name}</span>
                  </Label>
                ))}
              </div>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Register operator", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "registerOperator", [
                      toUint(app.operatorId, "Operator ID"),
                      toAddress(app.operatorWallet, "Operator wallet"),
                      app.operatorName,
                      app.selectedCategoryHashes(),
                    ]),
                  )
                }
              >
                Register Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Remove operator", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "removeOperator", [
                      toUint(app.operatorId, "Operator ID"),
                    ]),
                  )
                }
              >
                Remove Operator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Set supported category", () =>
                    app.txBase(app.requireRegistry(), operatorRegistryAbi, "setSupportedCategory", [
                      toUint(app.operatorId, "Operator ID"),
                      app.categoryHash,
                      app.categoryEnabled,
                    ]),
                  )
                }
              >
                Set Category
              </Button>
              <Label className="switch-row">
                <Checkbox checked={app.categoryEnabled} onChange={(event: any) => app.setCategoryEnabled(event.target.checked)} />
                <span>Category enabled</span>
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership and Treasury</CardTitle>
            <CardDescription>Define tiers, platform grace period, and credit-to-ETH conversion.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <div className="grid two">
              <Label>
                <span>Tier name</span>
                <Input value={app.tierName} onChange={(event: any) => app.setTierName(event.target.value)} />
              </Label>
              <Label>
                <span>Monthly credits</span>
                <Input value={app.tierCredits} onChange={(event: any) => app.setTierCredits(event.target.value)} />
              </Label>
              <Label>
                <span>Tier price wei</span>
                <Input value={app.tierPriceWei} onChange={(event: any) => app.setTierPriceWei(event.target.value)} />
              </Label>
              <Label>
                <span>Monthly hour cap</span>
                <Input value={app.tierHourCap} onChange={(event: any) => app.setTierHourCap(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                onClick={() =>
                  app.run("Set membership tier", () =>
                    app.txBase(app.requireMembership(), membershipManagerAbi, "setTier", [
                      toUint(app.tierId, "Tier ID"),
                      app.tierName,
                      toUint(app.tierCredits, "Monthly credits"),
                      toUint(app.tierPriceWei, "Tier price wei"),
                      toUint(app.tierHourCap, "Monthly hour cap"),
                      app.tierActive,
                    ]),
                  )
                }
              >
                Set Tier
              </Button>
              <Label className="switch-row">
                <Checkbox checked={app.tierActive} onChange={(event: any) => app.setTierActive(event.target.checked)} />
                <span>Tier active</span>
              </Label>
            </div>

            <div className="grid two">
              <Label>
                <span>Treasury allocator</span>
                <Input value={app.allocator} onChange={(event: any) => app.setAllocator(event.target.value)} />
              </Label>
              <Label>
                <span>Wei per credit</span>
                <Input value={app.creditRate} onChange={(event: any) => app.setCreditRate(event.target.value)} />
              </Label>
              <Label>
                <span>Grace period minutes</span>
                <Input value={app.gracePeriodMinutes} onChange={(event: any) => app.setGracePeriodMinutes(event.target.value)} />
              </Label>
            </div>

            <div className="actions">
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Set allocator", () =>
                    app.txBase(app.requireTreasury(), operatorTreasuryAbi, "setAllocator", [
                      toAddress(app.allocator, "Treasury allocator"),
                    ]),
                  )
                }
              >
                Set Allocator
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Set exchange rate", () =>
                    app.txBase(app.requireTreasury(), operatorTreasuryAbi, "setCreditToEthRate", [
                      toUint(app.creditRate, "Wei per credit"),
                    ]),
                  )
                }
              >
                Set Exchange Rate
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  app.run("Set grace period", () =>
                    app.txBase(app.requireLedger(), parkingLedgerAbi, "setGracePeriodMinutes", [
                      toUint(app.gracePeriodMinutes, "Grace period minutes"),
                    ]),
                  )
                }
              >
                Set Grace Period
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="side-stack">
        <OutputPanel app={app} />
      </aside>
    </div>
  );
}
