# Keeplas Design Pack

Ouvrir `index.html` après extraction. Tout fonctionne localement sans serveur ni installation.

## Contenu

- `design-system/` : documentation HTML, CSS partagé, tokens JSON.
- `assets/logo/logo.svg` : fichier SVG officiel fourni, conservé sans modification.
- `assets/icons/` : 20 icônes SVG originales, sprite réutilisable.
- `assets/illustrations/` : paysage SVG original et éditable.
- `fonts/` : DejaVu Serif / Sans regular et bold avec licence ; substitution locale explicitée.
- `wireframes/` : 44 écrans sous forme de données bilingues, moteur HTML/JS, pages d’entrée individuelles.
- `references/` : neuf planches PNG finales existantes.
- `docs/DECISIONS.md` : décisions produit et points à valider.

## Navigation

Choisir FR/EN, Mobile/Web et Light/Dark/Mixte dans la barre supérieure. Les écrans sont accessibles par leur URL `wireframes/index.html#screen-id`. Les boutons naviguent entre les étapes. Les champs sont éditables et certains contrôles simulent un état. Aucun appel réseau ; aucune donnée envoyée ou persistée.

## Limites

Ce sont des wireframes HTML éditables, pas une reproduction pixel par pixel des images. Les illustrations SVG sont originales et simplifiées. Les QR et médias sont des placeholders identifiés. Les actions de sécurité sont des démonstrations. Les données de personnes et documents sont fictives. Ne pas utiliser ces pages comme app de production.

## Licence

Code, icônes et illustration produits pour ce pack : utilisation libre par le projet Keeplas. Logo officiel : fourni par le propriétaire du projet, aucun droit de tiers présumé. Polices : licence incluse dans `fonts/LICENSE.txt`. Images de référence : assets du projet issus des rendus précédents.
