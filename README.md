# UpDate

Une fiche de culture générale par jour : photo, explications détaillées, sources, lecture audio (deux voix), quiz et révision espacée.
Application web installable (PWA) sur Android et iPhone, avec comptes par e-mail et synchronisation (Supabase).

## Mise en ligne, en bref
1. **Supabase** : créer un projet, exécuter `supabase/setup.sql` dans le SQL Editor, noter l'adresse du projet et la clé publique (publishable / anon).
2. **GitHub** : déposer ce dossier dans un dépôt public `update`, remplir `config.js`, activer **Settings › Pages** (branche `main`, dossier racine).
3. **Supabase › Authentication › URL Configuration** : mettre l'adresse GitHub Pages dans *Site URL* et *Redirect URLs*.
4. Ouvrir l'adresse sur le téléphone et l'installer (Android : « Installer » ; iPhone : Partager › Sur l'écran d'accueil).

Le guide détaillé, pas à pas, est dans le document « Installer UpDate sur votre téléphone ».

## Contenu
| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application |
| `config.js` | Adresse et clé publique Supabase (jamais la clé secrète) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation et fonctionnement hors ligne |
| `fiches.json`, `img/`, `audio/` | Les fiches, leurs photos (Wikimedia Commons, licences libres) et leurs enregistrements |
| `supabase/setup.sql` | Tables, règles de sécurité, suppression de compte, totaux anonymes des thèmes |
| `tools/gen_audio.py` | Génération de l'audio d'une fiche (voix Piper : siwis et tom) |

## Ajouter une fiche
Ajouter l'entrée dans `fiches.json` (même format que les autres, avec une `date` AAAA-MM-JJ), sa photo dans `img/`, puis lancer
`python3 tools/gen_audio.py . <id>` pour créer `audio/<id>-f.mp3`, `audio/<id>-h.mp3` et les repères de lecture.

Les totaux anonymes des thèmes préférés se lisent avec :
`POST <adresse du projet>/rest/v1/rpc/theme_totals` et les en-têtes `apikey: <clé publique>` et `Content-Type: application/json`.
