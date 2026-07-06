import { Badge, Button } from "../components/ui";

export function LoginPage({ app }: any) {
  const isWalletConnected = Boolean(app.account);

  return (
    <main className="login-shell">
      <section className={`login-panel${isWalletConnected ? " is-wallet-connected" : ""}`}>
        <img className="login-logo" src="/park-chain-logo-no-background.svg" alt="ParkChain" />

        <div className="login-copy">
          <h1>Sign in</h1>
          <p>Connect your wallet, then choose the interface authorized for that on-chain account.</p>
        </div>

        <div className="login-actions">
          {isWalletConnected ? (
            <Badge className="login-connected-badge" variant="success">
              <span>Wallet connected</span>
              <small>
                {app.account.slice(0, 6)}...{app.account.slice(-4)}
              </small>
            </Badge>
          ) : (
            <Button className="login-connect-button" onClick={() => app.run("Connect wallet", app.connect)}>
              Connect Wallet
            </Button>
          )}
        </div>

        <button
          className="role-card customer-login-card"
          disabled={!app.account}
          onClick={() => app.loginAs("customer")}
        >
          <span>Customer</span>
          <strong>Find your next parking space</strong>
          <small>Buy memberships, reserve parking or EV charging, check in, and track your monthly usage.</small>
          <b>Open Customer Portal →</b>
        </button>

        {(app.canAccessAdmin || app.canAccessOperator) && (
          <div className="privileged-login-section">
            <p>Additional workspaces available for this wallet</p>
            <div className="privileged-role-row">
              {app.canAccessAdmin && (
                <button className="role-card privileged-role-card" onClick={() => app.loginAs("admin")}>
                  <span>Admin</span>
                  <strong>Configure platform</strong>
                  <small>Register operators, manage tiers, and set treasury parameters.</small>
                </button>
              )}
              {app.canAccessOperator && (
                <button className="role-card privileged-role-card" onClick={() => app.loginAs("operator")}>
                  <span>Operator</span>
                  <strong>Manage parking operations</strong>
                  <small>Update prices, capacity, fees, and operator earnings.</small>
                </button>
              )}
            </div>
          </div>
        )}

        {app.walletAccessPending && (
          <p className="wallet-access-status" role="status">
            Checking for additional wallet permissions…
          </p>
        )}
      </section>
    </main>
  );
}
