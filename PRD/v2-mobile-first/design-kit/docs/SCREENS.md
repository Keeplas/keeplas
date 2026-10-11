# Keeplas screen inventory

46 screens across 8 boards. Source mockups are in `mockups/`.

## Board 01: Mobile setup (Mobile)

Mockup: `mockups/01-mobile-setup.png`

### M01-1 · Set up your account

_FR: Configurer votre compte_

- **Goal**: Start sign-up with a phone number only, no email.
- **Elements**: Required stepper 0/3 (Verify phone, Create passkey, Create vault); phone field with country picker; reassurance note.
- **Actions**: Verify with WhatsApp
- **States / notes**: Invalid number, unsupported country, WhatsApp unavailable (to design).

### M01-2 · Verify your number

_FR: Vérifier votre numéro_

- **Goal**: Confirm the OTP code received on WhatsApp.
- **Elements**: 6 OTP boxes with focus; Resend code link; note: WhatsApp is only used for notifications.
- **Actions**: Confirm number, Resend code
- **States / notes**: Wrong code, expired code, resend cooldown (to design).

### M01-3 · Create your passkey

_FR: Créer votre passe-clé_

- **Goal**: Create the device-bound passkey (Face ID or fingerprint).
- **Elements**: Stepper 1/3; pulsing biometric illustration; copy: the passkey never leaves the device.
- **Actions**: Create passkey
- **States / notes**: Biometrics refused, device without biometrics (to design).

### M01-4 · Create your private vault

_FR: Créer votre coffre privé_

- **Goal**: Generate the encrypted vault locally.
- **Elements**: Stepper 2/3; phone + orbiting shield illustration; lock note.
- **Actions**: Create my vault
- **States / notes**: Progress screen while keys are generated (to plan).

### M01-5 · Add trust contacts (optional)

_FR: Ajouter des contacts de confiance (facultatif)_

- **Goal**: Offer optional protection right after setup.
- **Elements**: Stepper 3/3 done; Optional protection 0/2; 3 Add contact slots; amber warning about lock-out risk.
- **Actions**: Invite contacts, Skip for now
- **States / notes**: The role does not give access to files.

### M01-6 · Setup complete

_FR: Configuration terminée_

- **Goal**: Confirm the account is ready and recall the options.
- **Elements**: Summary 3/3; Add contacts and Export recovery kit cards with Optional badge; Language row.
- **Actions**: Open my vault

## Board 02: Recovery and life check (Mobile)

Mockup: `mockups/02-recovery-life-check.png`

### M02-1 · Lost access to your vault?

_FR: Accès perdu à votre coffre ?_

- **Goal**: Choose a recovery method.
- **Elements**: 3 options: another signed-in device, trust contacts, recovery kit (24 words); note: an SMS/WhatsApp code cannot unlock the vault; Help link.
- **Actions**: One row per method
- **States / notes**: Methods not set up should be greyed out with an explanation.

### M02-2 · Recovery request

_FR: Demande de récupération_

- **Goal**: Track an ongoing request from the owner's side.
- **Elements**: Progress 1 of 2 approvals; contact list (Approved, Pending) with timestamps; 48 h protection window with countdown; code to compare (4729).
- **Actions**: Cancel request
- **States / notes**: Rejected, expired, completed.

### M02-3 · Alex needs help recovering access

_FR: Alex a besoin d'aide pour récupérer son accès_

- **Goal**: Trust contact's screen to approve a recovery.
- **Elements**: Phone-call illustration; recovery code; checkbox 'I verified Alex and the code by phone or video call'; note: you cannot read their files.
- **Actions**: Approve (enabled after the checkbox), Reject

### M02-4 · Vault restored

_FR: Coffre restauré_

- **Goal**: Confirm the restoration.
- **Elements**: Laptop + shield illustration; confirmations: new passkey, protection renewed, data still encrypted.
- **Actions**: Check my devices, Open my vault

### M02-5 · Are you okay?

_FR: Tout va bien ?_

- **Goal**: Regular life check, English version.
- **Elements**: Full-screen landscape; a single action; no snooze; note: a missed check never releases data.
- **Actions**: Yes, I'm okay
- **States / notes**: Confirmation after answering (to design).

### M02-6 · Are you okay? (FR)

_FR: Tout va bien ?_

- **Goal**: Same screen in French.
- **Elements**: Same as M02-5.
- **Actions**: Oui, je vais bien

## Board 03: Shared vault and QR (Mobile)

Mockup: `mockups/03-shared-vault-qr.png`

### M03-1 · Shared with me

_FR: Partagé avec moi_

- **Goal**: See folders other people shared with me.
- **Elements**: My vault / Shared with me segment; available folder card (Access now); locked folder card (access after verification, 2 confirmations).
- **Actions**: Access now, open a card
- **States / notes**: Empty state: nothing shared yet (to design).

### M03-2 · Shared folder

_FR: Dossier partagé_

- **Goal**: Browse a shared folder.
- **Elements**: Owner with avatar; note 'Access to this folder only'; document list (type, size); Your permission: View.
- **Actions**: Open, download

### M03-3 · Not available yet

_FR: Pas encore disponible_

- **Goal**: Explain why scheduled access is not open yet.
- **Elements**: Envelope + clock + lock illustration; timeline: assigned, 2 confirmations, 72 h grace period.
- **Actions**: None

### M03-4 · Scan the QR code

_FR: Scanner le QR code_

- **Goal**: Link a browser by scanning the QR code shown on the computer.
- **Elements**: Full camera view; viewfinder; flash; gallery; 'Camera allowed' chip; manual pairing link.
- **Actions**: Scan, Pair manually
- **States / notes**: Camera denied, QR expired, invalid QR.

### M03-5 · Link this browser?

_FR: Associer ce navigateur ?_

- **Goal**: Approve a new device with step-up verification.
- **Elements**: Browser, OS, city, time; Face ID block; amber warning: approve only if this is your computer.
- **Actions**: Approve, Cancel

### M03-6 · Browser connected

_FR: Navigateur connecté_

- **Goal**: Confirm the link.
- **Elements**: Laptop + check illustration; device card; note: all your devices were notified; Manage device access link.
- **Actions**: Done

## Board 04: Web app (Web)

Mockup: `mockups/04-web-app.png`

### W04-1 · Sign in to Keeplas

_FR: Se connecter à Keeplas_

- **Goal**: Passwordless web sign-in.
- **Elements**: Landscape hero + card: passkey, Link with my phone, optional phone number to identify the account.
- **Actions**: Continue with passkey, Link with my phone, Lost access?
- **States / notes**: Mobile-only sign-up: add 'New to Keeplas? Get the app' for visitors without an account; the phone number field becomes unnecessary; 'Lost access?' should point to the phone app.

### W04-2 · Connect with my phone

_FR: Connecter avec mon téléphone_

- **Goal**: Link the browser by QR.
- **Elements**: 3 steps; QR with logo; expiry 01:42; 'Trust this browser' checkbox (off on shared computers).
- **Actions**: Use a passkey
- **States / notes**: QR expired: Generate a new code button.

### W04-3 · Dashboard

_FR: Tableau de bord_

- **Goal**: Vault overview.
- **Elements**: Greeting; required setup 3/3; optional protection cards; category tiles; recent items table.
- **Actions**: Add item, open an item

### W04-4 · Shared with me

_FR: Partagé avec moi_

- **Goal**: Web version of the shared folder.
- **Elements**: Folder header + 'Permission: View' badge; file table (type, size, date); locked block 'Access after verification'.
- **Actions**: Row menu

### W04-5 · Recovery center

_FR: Centre de récupération_

- **Goal**: Manage recovery on the web.
- **Elements**: Account identified by phone number; recovery options; in-progress banner (1 of 2, code, hours left).
- **Actions**: Cancel request
- **States / notes**: Recovery starts on the phone; on the web this page shows the status and allows cancelling a request, nothing more.

### W04-6 · Devices and security

_FR: Appareils et sécurité_

- **Goal**: Manage devices and security settings.
- **Elements**: Device list (This device, Revoke); new sign-in alert; PIN code toggle; recent activity.
- **Actions**: Revoke, It wasn't me?

## Board 05: Web setup and life check (Web)

Mockup: `mockups/05-web-setup-life-check.png`

### W05-1 · Let's set up your account

_FR: Configurons votre compte_

- **Goal**: Web setup, initial state.
- **Elements**: Required 0/3 with inline WhatsApp verification; optional 0/2; side illustration.
- **Actions**: Verify with WhatsApp
- **States / notes**: Out of scope: sign-up and setup are mobile-only. Replace with the 'Get the app' screen, or keep only as a read-only 'finish setup on your phone' reminder.

### W05-2 · Required setup done

_FR: Configuration obligatoire terminée_

- **Goal**: State 3/3 with optional protection offered.
- **Elements**: Rows checked in green; optional 0/2; amber warning.
- **Actions**: Skip for now
- **States / notes**: Same as W05-1: optional protection is set up on the phone; the web can only show its status.

### W05-3 · Life check (web, EN)

_FR: Vérification de vie (web)_

- **Goal**: Modal over the dashboard.
- **Elements**: Dimmed background; illustrated modal; one action.
- **Actions**: Yes, I'm okay

### W05-4 · Life check (web, FR)

_FR: Vérification de vie (web)_

- **Goal**: Same modal in French.
- **Elements**: Same as W05-3.
- **Actions**: Oui, je vais bien

## Board 06: People and sharing (Mobile)

Mockup: `mockups/06-people-sharing.png`

### M06-1 · Trusted people

_FR: Personnes de confiance_

- **Goal**: Overview of the two roles.
- **Elements**: Trust contacts card (up to 3, any 2 required); Beneficiaries card (sand background).
- **Actions**: Manage trust contacts, Manage beneficiaries

### M06-2 · Add trusted person

_FR: Ajouter une personne de confiance_

- **Goal**: Invite someone and choose their roles.
- **Elements**: Contact card (email, WhatsApp); role checkboxes Trust contact / Beneficiary (both allowed); permissions summary.
- **Actions**: Send invitation

### M06-3 · Trust contacts

_FR: Contacts de confiance_

- **Goal**: Manage the 3 slots.
- **Elements**: Status 2 of 3 ready; rows with Active / Invited status; Replace; ⋮ menu; note that replacing renews protection.
- **Actions**: Replace

### M06-4 · Share content

_FR: Partager du contenu_

- **Goal**: Give access to a folder.
- **Elements**: Folder; people selection; scope 'This folder only'; timing Now / After verification and waiting period.
- **Actions**: Create private access

### M06-5 · Alex invited you

_FR: Alex vous a invité_

- **Goal**: Recipient's view of an invitation.
- **Elements**: Envelope illustration; ticked roles; folder; access condition.
- **Actions**: Accept invitation
- **States / notes**: Decline invitation: action missing, to add.

### M06-6 · Access management

_FR: Gestion des accès_

- **Goal**: See and revoke access to a folder.
- **Elements**: People with status Active now / Scheduled; Edit, Revoke; note: copies already saved cannot be removed.
- **Actions**: Edit, Revoke, Add another person

## Board 07: Capture and devices (Mobile)

Mockup: `mockups/07-capture-devices.png`

### M07-1 · Add to Keeplas

_FR: Ajouter à Keeplas_

- **Goal**: Add sheet opened from the + button.
- **Elements**: Bottom sheet: Document, Photo, Voice, Note, Video (colour tiles per type); filter chips.
- **Actions**: One row per type

### M07-2 · Scan document

_FR: Scanner un document_

- **Goal**: Document capture with edge detection.
- **Elements**: Frame with handles; 'Encrypted on your device' banner; Auto / Manual; gallery.
- **Actions**: Shutter

### M07-3 · Voice note

_FR: Note vocale_

- **Goal**: Record a voice memo.
- **Elements**: Pulsing mic; timer; waveform; encryption note.
- **Actions**: Pause, Save

### M07-4 · Securing your item

_FR: Sécurisation de l'élément_

- **Goal**: Show the securing steps.
- **Elements**: Sequential states: encrypting, uploading encrypted copy, protected; progress bars.
- **Actions**: None
- **States / notes**: Upload failure, offline (to design).

### M07-5 · Item details

_FR: Détails de l'élément_

- **Goal**: Organise an item and manage its access.
- **Elements**: Suggested title; category; folder; access; add people; activity history.
- **Actions**: Edit each row, Add people

### M07-6 · Sync and devices

_FR: Synchronisation et appareils_

- **Goal**: See devices and optional backups.
- **Elements**: Devices (current); Link browser; toggles for Keeplas, iCloud and Google backups.
- **Actions**: Toggles, Link
- **States / notes**: All toggles are on although backup is optional: to decide.

## Board 08: Home, unlock and security (Mobile)

Mockup: `mockups/08-home-unlock-security.png`

### M08-1 · Welcome

_FR: Bienvenue_

- **Goal**: First screen of the app.
- **Elements**: Night background + landscape; title 'Your life, well kept'; language selector.
- **Actions**: Get started, I already have an account

### M08-2 · Set up your succession plan

_FR: Configurer votre plan de succession_

- **Goal**: Explain the rules before setup.
- **Elements**: 4-dot indicator; owner reminders; 2 contacts confirm a death; 72 h grace period; only assigned content is released.
- **Actions**: Set up succession plan

### M08-3 · Privacy and security

_FR: Confidentialité et sécurité_

- **Goal**: Security hub.
- **Elements**: Passkey, PIN code (optional), Recovery kit, Devices, Account activity.
- **Actions**: One row per setting

### M08-4 · New device detected

_FR: Nouvel appareil détecté_

- **Goal**: New sign-in alert.
- **Elements**: Laptop + red shield illustration; location; device.
- **Actions**: It was me, It wasn't me
- **States / notes**: 'It wasn't me' flow to design (revoke + advice).

### M08-5 · Home

_FR: Accueil_

- **Goal**: Vault home.
- **Elements**: Greeting; recovery health 2 of 3; tiles Documents, Accounts, Instructions, Other; encrypted inbox; recent items; tab bar.
- **Actions**: +, tiles, see all
- **States / notes**: New empty account (to design).

### M08-6 · Unlock your vault

_FR: Déverrouiller votre coffre_

- **Goal**: Biometric unlock.
- **Elements**: Pulsing fingerprint; 6-digit Keeplas code (if enabled, after biometrics).
- **Actions**: Continue with passkey, Lost access?
- **States / notes**: Biometrics failure, wrong code, temporary lock-out.
