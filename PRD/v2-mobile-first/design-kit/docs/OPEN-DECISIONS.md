# Open decisions before coding

1. **Mobile-only sign-up (decided)**: Sign-up only in the iOS / Android app; the computer is linked by QR. To do: design the desktop 'Get the Keeplas app' screen (store badges, QR to the store, 'I already have the app → Link with my phone'), drop W05-1 / W05-2 from scope, and remove web sign-up from the repo (finding F8).
2. **Shamir threshold**: The PRD says Shamir 3-of-5. The code splits into 4 shares (1 on the device, 3 for contacts) with threshold 2 or 3; the designs show 3 contacts, any 2 enough. See findings F1 and F2 in Security, then align the PRD.
3. **48 h or 72 h**: Recovery: 48 h protection window. Succession: 72 h grace period. Confirm this is intended and keep these two names everywhere.
4. **Mobile navigation**: In French, 'Personnes' on some boards and 'Contacts' on others. Pick one label.
5. **Web navigation**: Three different sidebars across boards. Proposal: My vault, Shared with me, People, Life check, Devices, Settings, plus Recovery center reachable from Settings.
6. **Life check name**: In French, 'Vie continue' and 'vérification de vie' coexist. Pick one term.
7. **Language selector**: English by default is decided. The selector still needs unifying: EN | FR segment, dropdown and 'Language' row coexist. Proposal: compact dropdown in the header, row in Settings. Several FR mockups show FR preselected: in production, EN is preselected until the user chooses.
8. **Life-check frequency**: Frequency, number of reminders and what happens after a long silence are not defined in the designs (the repo uses weekly / monthly / quarterly).
9. **Optional backups**: All 3 toggles are on in the mockup. Decide the default state.
10. **Declining an invitation**: The invitation screen has no Decline action.
11. **Brands and photos**: The mockups use the Chrome logo and portraits. The kit uses a generic browser icon and initials avatars; plan licensed visuals if needed.
12. **Undesigned states**: OTP error, passkey failure, camera denied, offline, upload failure, expired invitation, rejected request, empty states, 'It wasn't me' flow.
13. **Dark mode and tablet**: Not designed. Tokens are ready for a dark theme but values remain to be defined.
