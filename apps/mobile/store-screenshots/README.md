# Store screenshots

`render.sh` and `gallery.html` build the App Store and Google Play images: six panels, each with a headline, a phone and a callout, over one of two backgrounds (`horizon` or `fil`).

## Real captures only

Apple (guideline 2.3.3) wants screenshots of the app in use, and Google Play refuses misleading metadata. Each phone must show a capture taken on a real phone, not a Figma mockup.

- A missing capture renders a striped **MISSING CAPTURE** placeholder. Never upload a render that still shows one.
- Until you capture them, panels 02 and 03 of the English App Store set show their Figma frame, which matches the app.
- The other Figma frames show things the app doesn't have: a Search tab, folder sharing, "Access now". Those panels have no stand-in.

## Where the captures go

Use these exact names:

```text
captures/ios/en/01.png … 06.png       iPhone, English  → App Store
captures/ios/fr/01.png … 06.png       iPhone, French   → App Store
captures/android/en/01.png … 06.png   Android, English → Google Play and the feature graphic
captures/android/fr/01.png … 06.png   Android, French  → Google Play and the feature graphic
```

- **Any phone works.** Each capture is scaled to the frame width, and its shape sets the frame height.
- **Each store gets its own phone.** The App Store set uses an iPhone frame. The Play set uses a plain frame with no Apple hardware, so it needs Android captures.
- **Dark panels.** Each background shows some panels dark: 01 to 03 on `horizon`, 01, 03 and 05 on `fil`. For those, you can add `0N-dark.png`, captured after Settings → Appearance → Dark. Without it, the light capture is used. Skip 03: the scan screen is always dark.

## Before capturing

1. Sign in to **Demo Owner** (`+44 7700 900101`) on the phone, as in [`APP_REVIEW.md`](../APP_REVIEW.md#how-reviewers-sign-in). Its rules apply here too: never create a kit or rotate keys on a demo account.
2. Pick the language from the EN / FR menu at the top of Home. Capture all six screens in English, then all six in French.
3. Keep the status bar clean: full battery, Wi-Fi, no notification icons (turn on Do Not Disturb). On Android, turn on System UI demo mode in Developer options.
4. Take the screenshot: side button and volume up on iPhone, power and volume down on Android. Copy the files to this folder and rename them as above.

## The six screens

| #   | Headline (EN / FR)                                       | Screen                                                                        | What to show                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Your life, well kept / Votre vie, bien gardée            | Home tab (`src/app/(app)/(tabs)/home.tsx`)                                    | Top of Home: greeting, Recovery health, the Your vault tiles (Family, Paperwork, Accounts…) and Recent items. The tab bar shows Home, Vault, +, People, Settings.                                                                                                                                        |
| 02  | Everything important, together / Tout l'essentiel, réuni | Tap + in the tab bar on Home (`src/features/capture/add-sheet.tsx`)           | The Add to Keeplas sheet open: Document, Photo, Voice, Note, Video.                                                                                                                                                                                                                                      |
| 03  | Private before upload / Chiffré avant l'envoi            | + → Document (`src/app/(app)/capture/scan.tsx`)                               | The system scanner opens first: tap Cancel. Keeplas's scan screen stays open in Manual, with the "Encrypted on this phone" banner. Point the camera at a printed page, such as `scripts/review-seed/insurance-policy.pdf` (stamped SAMPLE). Then go back without taking a picture.                       |
| 04  | Your people, your rules / Vos proches, vos règles        | People tab (`src/app/(app)/(tabs)/people.tsx`)                                | "2 ready", with Alex Demo and Sam Demo both Active.                                                                                                                                                                                                                                                      |
| 05  | Check in your way / Le Life check, à votre rythme        | Settings → Life check (`src/app/(app)/life-check.tsx`)                        | The Next check-in card, Weekly / Monthly / Quarterly (Quarterly selected) and Travel mode On. Travel mode stays on for the review until 26 November 2026, so the card reads "Check-ins are paused". Change nothing on this screen: a tap on a frequency or on the reset button changes the demo account. |
| 06  | Continuity, prepared / Demain, préparé                   | Vault tab → "Summer at the lake" → Access row (`src/app/(app)/item/[id].tsx`) | The "Who can see it" sheet open: Alex Demo checked, Sam Demo not. Close it without saving.                                                                                                                                                                                                               |

The callouts match this demo data:

- Panel 04: Alex receives all six items and Sam three.
- Panel 06: two contacts confirm, then 72 hours pass, and each item opens only for the people chosen on it.

## Render

```sh
sh render.sh horizon en preview   # out/horizon/preview-en.png: the six iOS panels side by side, to check
sh render.sh horizon en ios       # out/horizon/ios/en/01..06.png   1290x2796 (App Store 6.9")
sh render.sh horizon en play      # out/horizon/play/en/01..06.png  1080x1920 (Google Play phone)
sh render.sh horizon en fg        # out/horizon/play/en/feature-graphic.png 1024x500
```

Run the same commands with `fr`, and with `fil` for the other background. `out/` is gitignored.
