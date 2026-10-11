import { SharedVaultList } from "./shared-vault-list";

export default function SharedWithMePage() {
  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-headline-lg text-primary mb-4">
          Shared with me &<br />
          <span className="text-secondary">Vaults I Protect</span>
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          People who designated you as a trusted contact. You cannot read their
          vault — you help confirm if something happens to them, so the items
          they chose reach the right people.
        </p>
      </header>

      <SharedVaultList />
    </div>
  );
}
