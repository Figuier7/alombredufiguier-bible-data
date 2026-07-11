# A l'ombre du figuier - Bible Data

Repo public de donnees bibliques francaises destine aux sites, apps et outils de recherche biblique.

Ce depot contient des donnees runtime documentees et versionnees, sans dependance WordPress : dictionnaire biblique interactif, corpus BYM/Easton/Smith/ISBE/Watson, lexique hebreu/BDB, index Strong et Bible interlineaire AT.

## Donnees disponibles

- `data/dictionaries/` : concepts, slugs, liens entre concepts et entrees, index browse/search, corpus BYM, Easton, Smith, ISBE et Watson.
- `data/hebrew/` : lexique hebreu compact, concordance Strong, familles de racines et mappings Strong/concepts.
- `data/greek/` : lexique Strong grec francais relu, derive du Strong original public domain.
- `data/interlinear/` : livres interlineaires de l'Ancien Testament et index de recherche AT.
- `data/indexes/` : artefacts de recherche globaux pour les concepts du dictionnaire biblique.
- `schemas/` : schemas JSON indicatifs pour integrateurs.
- `examples/javascript/` : exemples sans dependance Node.js.

## Installation

Aucune dependance obligatoire. Les fichiers JSON/JSONL peuvent etre servis tels quels depuis un CDN, une API, une app mobile ou un backend.

```bash
git clone https://github.com/<organisation>/alombredufiguier-bible-data.git
cd alombredufiguier-bible-data
node tools/validate-release.mjs
```

## Utilisation rapide

Charger une fiche concept :

```bash
node examples/javascript/load-concept.mjs blanchiment
node examples/javascript/load-concept.mjs versions-coptes
```

Chercher une entree Strong :

```bash
node examples/javascript/search-strong.mjs H4714
node examples/javascript/search-strong.mjs Mitsrayim
```

Chercher dans l'interlineaire AT :

```bash
node examples/javascript/interlinear-search.mjs H4714
node examples/javascript/interlinear-search.mjs Mitsrayim
```

## Identifiants recommandes

- Concept : `concept_id` stable, par exemple `whitewash`; slug public via `data/dictionaries/concept-url-slugs.json`.
- Entree dictionnaire : `entry_id`, par exemple `isbe-008774`.
- Strong hebreu : `H####`, par exemple `H4714`.
- Passage interlineaire : `book/chapter/verse`, par exemple `Gen 1:1`.

## Attribution

Attribution courte recommandee :

> Donnees bibliques francaises fournies par A l'ombre du figuier - https://alombredufiguier.org - licence CC BY-NC-SA 4.0.

Voir `NOTICE.md` et `THIRD_PARTY_NOTICES.md` pour le detail des droits, sources et attributions.

## Licence

Sauf mention contraire, les traductions francaises, adaptations, enrichissements, annotations, index, mappings, structurations et compilations produits par A l'ombre du figuier sont publies sous licence Creative Commons Attribution - Pas d'Utilisation Commerciale - Partage dans les Memes Conditions 4.0 International (CC BY-NC-SA 4.0). Les oeuvres sources appartenant au domaine public conservent leur statut propre.

Vous pouvez copier, partager, adapter, transformer et redistribuer ces elements uniquement dans un cadre non commercial, a condition de citer clairement la source et de republier toute adaptation sous la meme licence.

Toute utilisation commerciale, directe ou indirecte, est interdite sans autorisation ecrite prealable du titulaire des droits.

Licence officielle : https://creativecommons.org/licenses/by-nc-sa/4.0/

Certains textes sources, donnees externes ou ressources tierces peuvent relever d'autres statuts juridiques, notamment le domaine public ou des licences tierces. La presente licence s'applique uniquement aux elements sur lesquels le projet detient des droits : selection, arrangement, structuration, traduction, enrichissement, annotation, indexation, mappings et compilation.

Ce depot ne concede aucun droit sur les marques, logos, noms de projet, habillages graphiques ou ressources externes non incluses.

## Regeneration depuis le repo source

Le dossier `data/` est genere par script depuis le repo de travail prive/local :

```bash
SOURCE_ROOT=../dictionnaire-biblique-v2 node tools/build-public-package.mjs
node tools/validate-release.mjs
```

Ne copiez pas manuellement des fichiers internes, backups, exports WordPress ou dossiers de chantier.

## Release

Procedure recommandee :

1. Generer `data/` avec `tools/build-public-package.mjs`.
2. Valider avec `tools/validate-release.mjs`.
3. Creer un tag `vYYYY.MM.DD`.
4. Publier une GitHub Release avec une archive `alombredufiguier-bible-data-vYYYY.MM.DD.zip` et `SHA256SUMS.txt`.

Note : une verification juridique documentaire finale reste recommandee avant toute publication publique.
