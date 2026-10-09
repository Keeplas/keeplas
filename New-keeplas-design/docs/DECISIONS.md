# Keeplas — décisions de référence

- Direction retenue : bleu nuit de la landing, primary #041632, gradient vers #1B2B48. Les essais verts sont supersédés.
- Wireframes : titres avec empattements ; landing : Manrope / Inter. Les deux choix sont distingués, non fusionnés silencieusement.
- Compte : téléphone seul, sans email. Trois étapes requises : vérifier téléphone, créer passkey, créer coffre. Contacts et kit facultatifs et reportables.
- Authentification et déchiffrement : distincts. Un OTP téléphone seul ne déchiffre pas le coffre.
- Récupération par contacts : deux approbations et délai de 48 h qui commence dès la demande.
- Transmission : confirmations de décès par deux contacts, puis délai de grâce de 72 h ; contenu attribué uniquement transmis aux bénéficiaires. Un check-in manqué ne suffit jamais.
- Life check : seul bouton « Yes, I’m okay » / « Oui, je vais bien » ; aucun snooze.
- Les contacts de confiance ne lisent pas les fichiers du fait de ce rôle. Les bénéficiaires ont uniquement le contenu attribué.
- Partage immédiat : actif dès l’acceptation. Partage différé : après conditions de vérification, jamais une date fixe inventée.
- QR : autorisation du navigateur depuis le téléphone, contrôle biométrique et notification des autres appareils.
- Capture : documents, photo, note, audio, vidéo mobile, écran desktop.
- Les pages HTML simulent les opérations. Pas d’auth réelle, chiffrement réel, caméra, QR, envoi d’invitation ou export de secret.

## À valider techniquement

Modèle de stockage des passkeys et clés, PIN applicatif, renouvellement après récupération, formats exacts du kit, prise en charge de capture navigateur, notifications, stratégie de classification compatible zero-knowledge, garanties de release keys et métadonnées. Ces wireframes ne constituent pas une implémentation cryptographique.
