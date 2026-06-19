import type { CategoryName } from "../types";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select } from "./ui";

export function StatusStrip({ app }: any) {
  return (
    <div className="status-strip">
      <Badge variant={app.account ? "success" : "secondary"}>
        {app.account ? "Wallet connected" : "Wallet disconnected"}
      </Badge>
      <span>{app.routerAddress ? "Router configured" : "Router missing"}</span>
      <span>{app.creditAddress ? "ParkCredit resolved" : "ParkCredit missing"}</span>
      <span>{app.membershipAddress ? "Membership resolved" : "Membership missing"}</span>
      <span>{app.registryAddress ? "Registry resolved" : "Registry missing"}</span>
      <span>{app.treasuryAddress ? "Treasury resolved" : "Treasury missing"}</span>
      <span>{app.ledgerAddress ? "Ledger resolved" : "Ledger missing"}</span>
    </div>
  );
}

export function ContractPanel({ app }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contracts</CardTitle>
        <CardDescription>Resolved from VITE_PARKCHAIN_ROUTER_ADDRESS.</CardDescription>
      </CardHeader>
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
    </Card>
  );
}

export function SharedFields({ app, includeCustomerLookup = false }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared Inputs</CardTitle>
        <CardDescription>These fields are reused by the active workspace actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid three">
        <Label>
          <span>Tier ID</span>
          <Input value={app.tierId} onChange={(event: any) => app.setTierId(event.target.value)} />
        </Label>
        <Label>
          <span>Operator ID</span>
          <Input value={app.operatorId} onChange={(event: any) => app.setOperatorId(event.target.value)} />
        </Label>
        <Label>
          <span>Category</span>
          <Select value={app.categoryName} onChange={(event: any) => app.setCategoryName(event.target.value as CategoryName)}>
            {app.categoryNames.map((name: CategoryName) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
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
