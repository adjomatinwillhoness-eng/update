// UpDate — envoi de la notification du matin à tous les appareils abonnés.
// Lancé chaque matin par .github/workflows/notify.yml (GitHub Actions).
// Secrets nécessaires (Settings › Secrets and variables › Actions) :
//   SUPABASE_SERVICE_ROLE_KEY : clé « secret » / « service_role » de Supabase (lecture des abonnements)
//   VAPID_PRIVATE_KEY         : clé privée des notifications (fournie avec UpDate)
import fs from "node:fs";
import webpush from "web-push";

const VAPID_PUBLIC = "BKA47zWA3V_-xXNv_Hl1AP2rB9ybN4CQm_Q1XxOXFQeg69hUfvfHega5QHn5lVZsbR7N3z7Q_ZVFlIShUIevhdM";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const FORCE = process.env.FORCE_SEND === "true";
const TZ = "Europe/Paris";
const SEND_HOUR = 7; // heure de Paris visée (le workflow tourne à 5 h 15 et 6 h 15 UTC pour couvrir l'heure d'été et d'hiver)

function fail(msg) { console.error("Erreur : " + msg); process.exit(1); }
if (!SERVICE_KEY) fail("le secret SUPABASE_SERVICE_ROLE_KEY est absent.");
if (!VAPID_PRIVATE) fail("le secret VAPID_PRIVATE_KEY est absent.");

const parisHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
if (!FORCE && parisHour !== SEND_HOUR) {
  console.log(`Il est ${parisHour} h à Paris : ce n'est pas l'heure d'envoi (${SEND_HOUR} h), rien à faire.`);
  process.exit(0);
}

// Adresse du site, déduite du nom du dépôt.
const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const o = (owner || "").toLowerCase();
const SITE = repo && repo.toLowerCase() === `${o}.github.io` ? `https://${o}.github.io/` : `https://${o}.github.io/${repo}/`;

// Adresse Supabase, lue dans config.js.
const cfg = fs.readFileSync("config.js", "utf8");
const SUPA_URL = (cfg.match(/supabaseUrl:\s*"([^"]+)"/) || [])[1];
if (!SUPA_URL) fail("adresse Supabase introuvable dans config.js.");

// Fiche du jour (ou la plus récente déjà passée).
const today = new Intl.DateTimeFormat("fr-CA", { timeZone: TZ }).format(new Date()); // AAAA-MM-JJ
const fiches = JSON.parse(fs.readFileSync("fiches.json", "utf8")).sort((a, b) => a.date.localeCompare(b.date));
const fiche = fiches.find(f => f.date === today) || fiches.filter(f => f.date <= today).pop();
if (!fiche) fail("aucune fiche disponible.");
const dimanche = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long" }).format(new Date()) === "dimanche";
const payload = JSON.stringify({
  title: `Fiche du jour · ${fiche.cat}`,
  body: fiche.title + (dimanche ? " — Et c'est dimanche : pensez à la révision de la semaine." : ""),
  url: SITE,
  tag: "update-" + today
});

// Abonnements (lecture avec la clé de service : les règles de sécurité réservent sinon chaque ligne à son propriétaire).
const headers = { apikey: SERVICE_KEY, "Content-Type": "application/json" };
if (SERVICE_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SERVICE_KEY}`;
const res = await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth`, { headers });
if (!res.ok) fail(`lecture des abonnements impossible (HTTP ${res.status}) : ${await res.text()}`);
const subs = await res.json();
console.log(`Fiche « ${fiche.title} » (${fiche.date}) → ${subs.length} appareil(s).`);

webpush.setVapidDetails(SITE, VAPID_PUBLIC, VAPID_PRIVATE);
let ok = 0, gone = 0, err = 0;
for (const s of subs) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: "normal" });
    ok++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      // Appareil désabonné ou application désinstallée : on retire l'abonnement.
      await fetch(`${SUPA_URL}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: "DELETE", headers });
      gone++;
    } else { err++; console.error(`Échec pour un appareil (HTTP ${e.statusCode || "?"}) : ${e.body || e.message}`); }
  }
}
console.log(`Envoyées : ${ok} · abonnements expirés retirés : ${gone} · échecs : ${err}`);
