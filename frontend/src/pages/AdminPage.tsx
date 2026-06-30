import { useEffect, useMemo, useState } from "react";
import { membershipManagerAbi, operatorRegistryAbi, operatorTreasuryAbi, parkingLedgerAbi } from "../abi/contracts";
import { ContractPanel, OutputPanel, SharedFields } from "../components/shared-panels";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import { readContract, toAddress, toUint } from "../lib/wallet";

export function AdminPage({ app }: any) {
  const [savedCategoryAccess, setSavedCategoryAccess] = useState<Record<string, boolean>>({});
  const [draftCategoryAccess, setDraftCategoryAccess] = useState<Record<string, boolean>>({});
  const [registrationCategorySetup, setRegistrationCategorySetup] = useState<
    Record<string, { pricePerHour: string; capacity: string }>
  >({});
  const [categoryAccessLoading, setCategoryAccessLoading] = useState(false);

  async function readCategoryAccess(operatorId: string) {
    const entries = await Promise.all(
      app.categoryNames.map(async (name: string) => {
        const supported = await readContract({
          address: app.requireRegistry(),
          abi: operatorRegistryAbi,
          functionName: "supportsCategory",
          args: [toUint(operatorId, "Active operator"), app.categoryHashForName(name)],
        });
        return [name, Boolean(supported)] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, boolean>;
  }

  useEffect(() => {
    let cancelled = false;
    if (!app.operatorForCategoryId) {
      setSavedCategoryAccess({});
      setDraftCategoryAccess({});
      setCategoryAccessLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setCategoryAccessLoading(true);
    readCategoryAccess(app.operatorForCategoryId)
      .then((access) => {
        if (!cancelled) {
          setSavedCategoryAccess(access);
          setDraftCategoryAccess(access);
        }
      })
      .finally(() => {
        if (!cancelled) setCategoryAccessLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [app.operatorForCategoryId, app.registryAddress]);

  useEffect(() => {
    setRegistrationCategorySetup((current) => {
      const next = { ...current };
      for (const name of app.categoryNames) {
        if (!next[name]) {
          next[name] = { pricePerHour: app.pricePerHour, capacity: app.categoryCapacity };
        }
      }
      return next;
    });
  }, [app.categoryNames, app.pricePerHour, app.categoryCapacity]);

  const changedCategories = useMemo(
    () =>
      app.categoryNames.filter(
        (name: string) => Boolean(draftCategoryAccess[name]) !== Boolean(savedCategoryAccess[name]),
      ),
    [app.categoryNames, draftCategoryAccess, savedCategoryAccess],
  );

  function updateRegistrationCategorySetup(
    name: string,
    patch: Partial<{ pricePerHour: string; capacity: string }>,
  ) {
    setRegistrationCategorySetup({
      ...registrationCategorySetup,
      [name]: {
        pricePerHour: registrationCategorySetup[name]?.pricePerHour ?? app.pricePerHour,
        capacity: registrationCategorySetup[name]?.capacity ?? app.categoryCapacity,
        ...patch,
      },
    });
  }

  return (
    <div className="dashboard-grid">
      <div className="stack">
        <ContractPanel app={app} />
        <SharedFields app={app} />

        <Card>
          <CardHeader>
            <CardTitle>Operator Management</CardTitle>
            <CardDescription>Whitelist operators and select the supported categories.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <section className="operator-action-block">
              <div className="operator-action-heading">
                <h3>Register an operator</h3>
                <p>The wallet address entered here becomes the authorized operator wallet for the numeric ID.</p>
              </div>
              <div className="grid three">
                <Label>
                  <span>Operator ID</span>
                  <Input value={app.operatorId} onChange={(event: any) => app.setOperatorId(event.target.value)} />
                </Label>
                <Label>
                  <span>Operator wallet address</span>
                  <Input
                    placeholder="0x..."
                    value={app.operatorWallet}
                    onChange={(event: any) => app.setOperatorWallet(event.target.value)}
                  />
                </Label>
                <Label>
                  <span>Operator name</span>
                  <Input value={app.operatorName} onChange={(event: any) => app.setOperatorName(event.target.value)} />
                </Label>
                <Label>
                  <span>No-show fee</span>
                  <Input
                    min="0"
                    type="number"
                    value={app.noShowFee}
                    onChange={(event: any) => app.setNoShowFee(event.target.value)}
                  />
                </Label>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supported</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Initial price per hour</TableHead>
                    <TableHead>Initial slot capacity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {app.categoryNames.map((name: string) => {
                    const setup = registrationCategorySetup[name] ?? {
                      pricePerHour: app.pricePerHour,
                      capacity: app.categoryCapacity,
                    };
                    return (
                      <TableRow key={name}>
                        <TableCell className="category-access-column">
                          <Checkbox
                            aria-label={`Register ${name}`}
                            checked={app.selectedCategories[name]}
                            onChange={(event: any) =>
                              app.setSelectedCategories({ ...app.selectedCategories, [name]: event.target.checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <strong>{name}</strong>
                          <code title={app.categoryHashForName(name)}>
                            {`${app.categoryHashForName(name).slice(0, 10)}…${app.categoryHashForName(name).slice(-8)}`}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={!app.selectedCategories[name]}
                            min="0"
                            type="number"
                            value={setup.pricePerHour}
                            onChange={(event: any) =>
                              updateRegistrationCategorySetup(name, { pricePerHour: event.target.value })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            disabled={!app.selectedCategories[name]}
                            min="1"
                            type="number"
                            value={setup.capacity}
                            onChange={(event: any) =>
                              updateRegistrationCategorySetup(name, { capacity: event.target.value })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Button
                onClick={() =>
                  app.run("Register operator", async () => {
                    const selectedCategoryNames = app.categoryNames.filter(
                      (name: string) => app.selectedCategories[name],
                    );
                    if (selectedCategoryNames.length === 0) {
                      throw new Error("Select at least one supported category");
                    }

                    for (const name of selectedCategoryNames) {
                      const capacity = toUint(
                        registrationCategorySetup[name]?.capacity ?? app.categoryCapacity,
                        `${name} slot capacity`,
                      );
                      if (capacity === 0n) throw new Error(`${name} slot capacity must be greater than zero`);
                    }

                    const categoryHashes = selectedCategoryNames.map((name: string) => app.categoryHashForName(name));
                    const pricesPerHour = selectedCategoryNames.map((name: string) =>
                      toUint(
                        registrationCategorySetup[name]?.pricePerHour ?? app.pricePerHour,
                        `${name} price per hour`,
                      ),
                    );
                    const capacities = selectedCategoryNames.map((name: string) =>
                      toUint(
                        registrationCategorySetup[name]?.capacity ?? app.categoryCapacity,
                        `${name} slot capacity`,
                      ),
                    );

                    const transactionHash = await app.txBase(
                      app.requireRegistry(),
                      operatorRegistryAbi,
                      "registerOperatorWithSetup",
                      [
                      toUint(app.operatorId, "Operator ID"),
                      toAddress(app.operatorWallet, "Operator wallet"),
                      app.operatorName,
                        categoryHashes,
                        pricesPerHour,
                        capacities,
                        toUint(app.noShowFee, "No-show fee"),
                      ],
                    );

                    await app.refreshRegisteredOperators();
                    app.setOperatorForCategoryId(app.operatorId);
                    return { transactionHash, configuredCategories: selectedCategoryNames };
                  })
                }
              >
                Register and Configure Operator
              </Button>
            </section>

            <section className="operator-action-block operator-removal-block">
              <div className="operator-action-heading">
                <h3>Remove an active operator</h3>
                <p>Select the registered operator. Removal is performed by its Operator ID.</p>
              </div>
              <Label>
                <span>Registered operator</span>
                <Select
                  value={app.operatorToRemoveId}
                  onValueChange={(value: string) => app.setOperatorToRemoveId(value)}
                >
                  <SelectTrigger aria-label="Registered operator">
                    <SelectValue placeholder="Select an active operator…" />
                  </SelectTrigger>
                  <SelectContent>
                    {app.registeredOperators.map((operator: any) => (
                      <SelectItem key={operator.id.toString()} value={operator.id.toString()}>
                        #{operator.id.toString()} — {operator.name} — {operator.wallet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Button
                disabled={!app.operatorToRemoveId}
                variant="secondary"
                onClick={() =>
                  app.run("Remove operator", async () => {
                    const hash = await app.txBase(app.requireRegistry(), operatorRegistryAbi, "removeOperator", [
                      toUint(app.operatorToRemoveId, "Registered operator"),
                    ]);
                    app.setOperatorToRemoveId("");
                    await app.refreshRegisteredOperators();
                    return hash;
                  })
                }
              >
                Remove Operator
              </Button>
            </section>

            <section className="operator-action-block">
              <div className="operator-action-heading">
                <h3>Operator category access</h3>
                <p>Select an operator, check every supported category, then save the changes.</p>
              </div>
              <Label>
                <span>Active operator</span>
                <Select
                  value={app.operatorForCategoryId}
                  onValueChange={(value: string) => app.setOperatorForCategoryId(value)}
                >
                  <SelectTrigger aria-label="Operator for category access">
                    <SelectValue placeholder="Select an active operator…" />
                  </SelectTrigger>
                  <SelectContent>
                    {app.registeredOperators.map((operator: any) => (
                      <SelectItem key={operator.id.toString()} value={operator.id.toString()}>
                        #{operator.id.toString()} — {operator.name} — {operator.wallet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Category identifier</TableHead>
                    <TableHead className="category-access-column">Supported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {app.categoryNames.map((name: string) => {
                    const categoryHash = app.categoryHashForName(name);
                    const changed = Boolean(draftCategoryAccess[name]) !== Boolean(savedCategoryAccess[name]);
                    return (
                      <TableRow className={changed ? "is-dirty" : ""} key={name}>
                        <TableCell>
                          <strong>{name}</strong>
                          {changed && <span className="category-change-label">Changed</span>}
                        </TableCell>
                        <TableCell>
                          <code title={categoryHash}>{`${categoryHash.slice(0, 10)}…${categoryHash.slice(-8)}`}</code>
                        </TableCell>
                        <TableCell className="category-access-column">
                          <Checkbox
                            aria-label={`Allow ${name}`}
                            checked={Boolean(draftCategoryAccess[name])}
                            disabled={!app.operatorForCategoryId || categoryAccessLoading}
                            onChange={(event: any) =>
                              setDraftCategoryAccess({ ...draftCategoryAccess, [name]: event.target.checked })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="actions">
                <Button
                  disabled={
                    !app.operatorForCategoryId || categoryAccessLoading || changedCategories.length === 0
                  }
                  onClick={() =>
                    app.run("Set categories", async () => {
                      const transactionHashes: string[] = [];
                      try {
                        for (const name of changedCategories) {
                          transactionHashes.push(
                            await app.txBase(
                              app.requireRegistry(),
                              operatorRegistryAbi,
                              "setSupportedCategory",
                              [
                                toUint(app.operatorForCategoryId, "Active operator"),
                                app.categoryHashForName(name),
                                Boolean(draftCategoryAccess[name]),
                              ],
                            ),
                          );
                        }
                        return { updatedCategories: changedCategories, transactionHashes };
                      } finally {
                        const refreshed = await readCategoryAccess(app.operatorForCategoryId);
                        setSavedCategoryAccess(refreshed);
                        setDraftCategoryAccess(refreshed);
                      }
                    })
                  }
                >
                  {categoryAccessLoading
                    ? "Loading Categories…"
                    : `Set Categories${changedCategories.length ? ` (${changedCategories.length})` : ""}`}
                </Button>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership and Treasury</CardTitle>
            <CardDescription>Define tiers, platform grace period, and credit-to-ETH conversion.</CardDescription>
          </CardHeader>
          <CardContent className="tab-panel">
            <section className="operator-action-block">
              <div className="operator-action-heading">
                <h3>Define Tiers</h3>
                <p> </p>
              </div>
              <div className="grid two">
                <Label>
                  <span>Name</span>
                  <Input value={app.tierName} onChange={(event: any) => app.setTierName(event.target.value)} />
                </Label>
                <Label>
                  <span>Monthly ParkCredits</span>
                  <Input value={app.tierCredits} onChange={(event: any) => app.setTierCredits(event.target.value)} />
                </Label>
                <Label>
                  <span>Price in wei</span>
                  <Input value={app.tierPriceWei} onChange={(event: any) => app.setTierPriceWei(event.target.value)} />
                </Label>
                <Label>
                  <span>Monthly hour cap</span>
                  <Input value={app.tierHourCap} onChange={(event: any) => app.setTierHourCap(event.target.value)} />
                </Label>
              </div>

              <div className="actions">
                <Label className="switch-row">
                  <Checkbox checked={app.tierActive} onChange={(event: any) => app.setTierActive(event.target.checked)} />
                  <span>active</span>
                </Label>

                <Button
                  onClick={() =>
                    app.run("Set membership tier", async () => {
                      const result = await app.txBase(app.requireMembership(), membershipManagerAbi, "setTier", [
                        toUint(app.tierId, "Tier ID"),
                        app.tierName,
                        toUint(app.tierCredits, "Monthly ParkCredits"),
                        toUint(app.tierPriceWei, "Price in wei"),
                        toUint(app.tierHourCap, "Monthly hour cap"),
                        app.tierActive,
                      ]);
                      await app.refreshMembershipTiers();
                      return result;
                    })
                  }
                >
                  Create Tier
                </Button>
              </div>
              <Label><span>Existing Membership Tiers</span></Label>
                
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>ParkCredits</TableHead>
                      <TableHead>Hour Cap</TableHead>
                      <TableHead>Price (wei)</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {app.membershipTiers.map((tier: any) => (
                      <TableRow key={tier.id.toString()}>
                        <TableCell>{tier.id.toString()}</TableCell>
                        <TableCell>
                          <strong>{tier.name}</strong>
                        </TableCell>
                        <TableCell>{tier.monthlyCredits.toString()}</TableCell>
                        <TableCell>{tier.monthlyHourCap.toString()}</TableCell>
                        <TableCell>{tier.priceWei.toString()}</TableCell>
                        <TableCell>{tier.active ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

              </section>

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
