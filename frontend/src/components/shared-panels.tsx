import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, Info } from "lucide-react";
import type { CategoryName } from "../types";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, NativeSelect } from "./ui";

function isConfigured(address: string) {
  return Boolean(address && !/^0x0{40}$/i.test(address));
}

function ConnectionBadge({ connected, connectedLabel, disconnectedLabel }: any) {
  return (
    <Badge variant={connected ? "success" : "error"}>
      {connected ? (
        <CircleCheck aria-hidden="true" size={16} />
      ) : (
        <CircleX aria-hidden="true" size={16} />
      )}
      {connected ? connectedLabel : disconnectedLabel}
    </Badge>
  );
}

export function StatusStrip({ app }: any) {
  return (
    <div className="status-strip" aria-label="Connection status">
      <ConnectionBadge
        connected={Boolean(app.account)}
        connectedLabel="Wallet connected"
        disconnectedLabel="Wallet disconnected"
      />
      <ConnectionBadge
        connected={isConfigured(app.routerAddress)}
        connectedLabel="Router configured"
        disconnectedLabel="Router missing"
      />
      <ConnectionBadge
        connected={isConfigured(app.creditAddress)}
        connectedLabel="ParkCredit resolved"
        disconnectedLabel="ParkCredit missing"
      />
      <ConnectionBadge
        connected={isConfigured(app.membershipAddress)}
        connectedLabel="Membership resolved"
        disconnectedLabel="Membership missing"
      />
      <ConnectionBadge
        connected={isConfigured(app.registryAddress)}
        connectedLabel="Registry resolved"
        disconnectedLabel="Registry missing"
      />
      <ConnectionBadge
        connected={isConfigured(app.treasuryAddress)}
        connectedLabel="Treasury resolved"
        disconnectedLabel="Treasury missing"
      />
      <ConnectionBadge
        connected={isConfigured(app.ledgerAddress)}
        connectedLabel="Ledger resolved"
        disconnectedLabel="Ledger missing"
      />
    </div>
  );
}

export function ContractPanel({ app }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="dev-panel-card">
      <CardHeader className="dev-panel-header">
        <div className="dev-panel-heading">
          <div className="dev-panel-title-row">
            <CardTitle>Contracts</CardTitle>
            <Badge>Developer feature</Badge>
          </div>
          <CardDescription>Resolved from VITE_PARKCHAIN_ROUTER_ADDRESS.</CardDescription>
        </div>
        <Button
          variant="ghost"
          className="dev-panel-toggle"
          aria-expanded={isOpen}
          aria-controls="contract-address-fields"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Hide" : "Show"}
          {isOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        </Button>
      </CardHeader>
      <div
        id="contract-address-fields"
        className={`dev-panel-content${isOpen ? " is-open" : ""}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="dev-panel-content-inner">
          <CardContent className="grid two">
            <Label>
              <span>ParkChainRouter address</span>
              <Input value={app.routerAddress} readOnly />
            </Label>
            <Label>
              <span>ParkCredit address</span>
              <Input value={app.creditAddress} readOnly />
            </Label>
            <Label>
              <span>MembershipManager address</span>
              <Input value={app.membershipAddress} readOnly />
            </Label>
            <Label>
              <span>OperatorRegistry address</span>
              <Input value={app.registryAddress} readOnly />
            </Label>
            <Label>
              <span>OperatorTreasury address</span>
              <Input value={app.treasuryAddress} readOnly />
            </Label>
            <Label>
              <span>ParkingLedger address</span>
              <Input value={app.ledgerAddress} readOnly />
            </Label>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

export function SharedFields({ app, includeCustomerLookup = false, lockOperatorId = false }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="dev-panel-card">
      <CardHeader className="dev-panel-header">
        <div className="dev-panel-heading">
          <div className="dev-panel-title-row">
            <CardTitle>Shared Inputs</CardTitle>
            <Badge>Developer feature</Badge>
            <span className="info-tooltip">
              <button
                type="button"
                className="info-tooltip-trigger"
                aria-label="About Shared Inputs"
                aria-describedby="shared-inputs-description"
              >
                <Info aria-hidden="true" size={16} />
              </button>
              <span id="shared-inputs-description" className="info-tooltip-content" role="tooltip">
                Reusable contract parameters for the actions on this page. Changing a value affects every action that
                uses the corresponding tier, operator, category, or customer address.
              </span>
            </span>
          </div>
          <p className="ui-card-description">Advanced contract parameters shared across workspace actions.</p>
        </div>
        <Button
          variant="ghost"
          className="dev-panel-toggle"
          aria-expanded={isOpen}
          aria-controls="shared-inputs-fields"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Hide" : "Show"}
          {isOpen ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        </Button>
      </CardHeader>
      <div
        id="shared-inputs-fields"
        className={`dev-panel-content${isOpen ? " is-open" : ""}`}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="dev-panel-content-inner">
          <CardContent className="grid three">
            <Label>
              <span>Tier ID</span>
              <Input value={app.tierId} onChange={(event: any) => app.setTierId(event.target.value)} />
            </Label>
            <Label>
              <span>{lockOperatorId ? "Detected operator ID" : "Operator ID"}</span>
              <Input
                disabled={lockOperatorId}
                value={app.operatorId}
                onChange={(event: any) => app.setOperatorId(event.target.value)}
              />
            </Label>
            <Label>
              <span>Category</span>
              <NativeSelect value={app.categoryName} onChange={(event: any) => app.setCategoryName(event.target.value as CategoryName)}>
                {app.categoryNames.map((name: CategoryName) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <Label>
              <span>Custom category bytes32</span>
              <Input value={app.customCategory} onChange={(event: any) => app.setCustomCategory(event.target.value)} />
            </Label>
            {includeCustomerLookup && (
              <Label>
                <span>Customer address for reads</span>
                <Input
                  placeholder="Defaults to connected wallet"
                  value={app.memberLookup}
                  onChange={(event: any) => app.setMemberLookup(event.target.value)}
                />
              </Label>
            )}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

export function OutputPanel({ app }: any) {
  return (
    <Card className="output-card">
      <CardHeader>
        <CardTitle>Output</CardTitle>
        <CardDescription>Transaction hashes, read results, and wallet errors appear here.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre>{app.output}</pre>
      </CardContent>
    </Card>
  );
}
