import { SharedVaultList } from "./shared-vault-list";

export const dynamic = "force-dynamic";

export default function SharedWithMePage() {
  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-headline-lg text-primary mb-4">
          Shared with me &<br />
          <span className="text-secondary">Vaults I Protect</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          People who designated you as a trusted contact. You hold an encrypted
          recovery shard for each — you cannot read their vault, but together
          with their other contacts you can help them regain access if they ever
          lose their credentials.
        </p>
      </header>

      <SharedVaultList />
    </div>
  );
}
