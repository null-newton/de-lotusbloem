# Nefertem

Nederlandstalige praktijkwebsite voor **Veronique Wostyn**, schoonheidsspecialist en thuisverpleegkundige in Roeselare. Adres: Stationsdreef 215, 8800 Roeselare, België.

## Stack

De toepasselijke frameworks uit [null-newton/toolbox](https://github.com/null-newton/toolbox): React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, Lucide React en Supabase JS 2. Functies zoals video-muxers en achtergrondverwijdering uit de toolbox zijn niet nodig voor deze praktijkwebsite.

## Lokaal starten

Node.js 22.12+ of een recente Node.js 24 en pnpm zijn vereist.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Vul in `.env.local` de Supabase-project-URL en publieke publishable/anon-key in. Gebruik **nooit** een service-role-key in een `VITE_`-variabele. `.env.local` staat buiten versiebeheer. `pnpm-workspace.yaml` en `.npmrc` gebruiken `nodeLinker: hoisted`, zodat het project ook op een exFAT-schijf zonder symlinks kan worden geïnstalleerd.

```sh
pnpm build
pnpm test
```

## Supabase activeren

1. Open het Supabase-dashboard van je project, ga naar **SQL Editor** en voer [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) eenmalig uit. Dit maakt de tabellen, rechten, policies en atomaire voorraadfunctie aan. De migratie bevat alleen praktijkgegevens, geen fictief aanbod.
2. Maak je beheerder via **Authentication → Users → Add user**. Gebruik een eigen wachtwoord. Er is bewust geen openbare registratiepagina.
3. Kopieer het gebruikers-ID en voer als projecteigenaar in de SQL Editor uit:

```sql
insert into public.admins(user_id) values ('HIER-HET-GEBRUIKERS-ID');
```

4. Schakel openbare registratie uit bij de Auth-instellingen als deze niet nodig is. Stel de uiteindelijke Site URL in op je eigen domein.
5. Ga naar `/admin`, log in en vul onder **Praktijkgegevens** het e-mailadres en telefoonnummer aan. Je kunt daar ook de HTTPS-link naar het toekomstige logo invoeren.
6. Voeg producten, diensten en berichten toe. Nieuwe inhoud begint als concept; vink zichtbaarheid/publicatie aan wanneer de inhoud klaar is.

De publieke sleutel geeft geen beheerrechten. Alleen gebruikers in `admins` kunnen wijzigen. Bezoekers lezen uitsluitend gepubliceerd aanbod, gepubliceerde berichten en openbare praktijkgegevens. Voorraad en voorraadgeschiedenis zijn afzonderlijke tabellen met beheerdersrechten. Voorraadwijzigingen gaan via `adjust_stock`, met rijvergrendeling, reden, gebruiker en logboek. Een negatieve voorraad wordt geweigerd.

## Pagina’s en functies

- `/`: praktijkintroductie, schoonheid, thuisverpleging en recente berichten.
- `/schoonheid`: filterbaar aanbod met prijzen, behandeltijd en contactlink.
- `/thuisverpleging`: zorgintroductie en diensten.
- `/over`: Veronique en de praktijk.
- `/journal` en `/journal/:id`: blogs en aankondigingen.
- `/contact`: adres, route, telefoon en e-mail. Het formulier opent de eigen e-mailapp zodra een e-mailadres is ingevuld; het verzendt zelf geen berichten en doet geen automatische boekingen.
- `/admin`: Supabase-login, overzicht, producten/diensten toevoegen/bewerken/verwijderen, berichten toevoegen/bewerken/verwijderen/publiceren, voorraad wijzigen, minimumvoorraad en artikelnummers instellen, voorraadlogboek en praktijkgegevens.

Op het inlogscherm kan een expliciete **voorbeeldomgeving** worden geopend. Deze gebruikt fictieve inhoud in browser-localStorage, geen Supabase-login of database. Die gegevens zijn duidelijk gemarkeerd. Afsluiten herlaadt de echte omgeving. Zonder Supabase-configuratie opent de publieke site met gemarkeerde voorbeeldinhoud. Met configuratie worden fouten getoond in plaats van stilzwijgend fictieve databasegegevens te gebruiken.

## Publicatie

`pnpm build` maakt `dist/`. De workflow `.github/workflows/deploy.yml` bouwt en publiceert automatisch na een push naar `main`.

Ga eenmalig in GitHub naar **Settings → Pages → Build and deployment → Source → GitHub Actions**. Start daarna bij **Actions → Website bouwen en publiceren → Run workflow** de workflow als de eerste automatische run plaatsvond voordat Pages geactiveerd was.

De website gebruikt HashRouter en relatieve assetpaden, zodat zowel de project-URL als een later eigen domein werkt. Voorbeeld: `https://null-newton.github.io/de-lotusbloem/#/admin`.

De workflow bevat de door jou aangeleverde **publieke** Supabase-project-URL en publishable-key als standaardwaarden. Deze key is bedoeld voor de browser en verleent geen beheerrechten. Repository-variabelen `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` kunnen de waarden overschrijven. Service-role-keys en wachtwoorden horen nooit in deze workflow of de frontend. `.env.local` blijft buiten de repository.

Op andere hosts zijn geen SPA-rewrites nodig dankzij de hashrouter; de meegeleverde `_redirects` en `vercel.json` kunnen desgewenst worden verwijderd.
## Ontwerp en inhoud

Inspiratie: [Maison Les Grands Chênes](https://www.maisonlesgrandschenes.com), [Fume](https://fume-studio.com), [Alicia Dubuis](https://aliciadubuis.com), [Jakobsen Copenhagen](https://jakobsencopenhagen.com), [Norma](https://nor.ma). Eigen compositie met warme zandkleuren, rustige fotografie, seriftypografie en sober lijnwerk.

De gebruikte sfeerfoto’s worden geladen van Unsplash; lettertypen van Google Fonts. Deze externe verzoeken kunnen in productie worden vervangen door eigen lokaal gehoste bestanden. De foto’s tonen geen portret van Veronique en zijn geen afbeeldingen van de echte praktijk. Alle demo-behandelingen, prijzen en berichten zijn illustratief en moeten door eigen inhoud worden vervangen. Er worden geen medische dossiers of patiëntgegevens bijgehouden.

## Verificatiegrenzen

De build en validatietests controleren de frontend. Echte login, CRUD en databasebeveiliging moeten na installatie van het schema met een beheeraccount worden gecontroleerd. SQL-tests staan in `supabase/tests/access.sql`; voer ze uit met de Supabase CLI en pgTAP in een ontwikkelomgeving. Browsercontroles in de voorbeeldomgeving bewijzen geen rechten in de echte Supabase-database.
