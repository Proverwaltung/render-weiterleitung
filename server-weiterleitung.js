// Eine stillgelegte Instanz, die nur noch weiterleitet.
//
// ANLASS (2026-09-22): Nach dem Umzug auf Exoscale zeigen Lesezeichen und
// die Symbole auf den Telefonen weiterhin auf die alte Adresse. Ein
// abgeschalteter Dienst antwortet dort mit einer Fehlerseite - und wer die
// nicht deuten kann, meldet sich nicht, sondern arbeitet erst einmal nicht.
//
// WARUM EINE EIGENE DATEI und kein Schalter in server.js: Eine
// Umgebungsvariable, die JEDE Anfrage umleitet, ist das gefaehrlichste
// Stueck Konfiguration, das man einer laufenden Instanz geben kann. Steht
// sie versehentlich in der falschen Umgebung, ist die Anwendung fuer alle
// weg, und zwar lautlos - der Dienst laeuft ja. Als eigene Datei muss man
// sie im START-BEFEHL benennen; das passiert nicht aus Versehen.
//
// Der Nebeneffekt ist, dass diese Fassung NICHTS sonst laedt: keine
// Datenbank, keinen Objektspeicher, keine Routen. Sie startet auch dann,
// wenn der alten Umgebung die halbe Konfiguration fehlt - und genau das ist
// dort der Fall, seit der Code den neuen Objektspeicher erwartet.
//
// AUFRUF (Render: Settings » Start Command):
//   node server-weiterleitung.js
// dazu die Umgebungsvariable:
//   WEITERLEITUNG_ZIEL=https://neue-adresse.example.com
const express = require('express');

const ZIEL = (process.env.WEITERLEITUNG_ZIEL || '').replace(/\/+$/, '');
const PORT = process.env.PORT || 3001;

if (!ZIEL) {
  // Ohne Ziel gar nicht erst starten. Eine Weiterleitung ins Leere waere
  // schlimmer als eine Fehlerseite: der Browser landet auf sich selbst und
  // dreht sich im Kreis, bis er aufgibt.
  console.error(
    '[weiterleitung] WEITERLEITUNG_ZIEL ist nicht gesetzt. Beispiel: '
      + 'WEITERLEITUNG_ZIEL=https://neue-adresse.example.com'
  );
  process.exit(1);
}

const app = express();

// ============================================================================
// Der Service Worker, der sich selbst abmeldet
// ============================================================================
// EINE WEITERLEITUNG ALLEIN GENUEGT NICHT, und das ist die Ueberraschung
// dieses Umzugs (2026-09-22, sofort nach dem Umstellen bemerkt): Die
// Anwendung ist eine PWA. Wer sie je aufgerufen hat, traegt rund
// zweihundert Dateien im Browser-Speicher, und der Service Worker
// beantwortet Navigationen DARAUS - ohne den Server zu fragen. Eine
// Pruefung von aussen sieht brav den 302; der Browser der betroffenen
// Person sieht weiterhin die alte Anmeldemaske und laesst sich sogar
// bedienen. Das ist die gefaehrlichste Form des Weiterlebens: es sieht aus
// wie Normalbetrieb.
//
// Deshalb liefert diese Instanz unter demselben Pfad wie frueher einen
// Service Worker aus, der genau eines tut: aufraeumen und verschwinden.
// Der Browser holt ihn beim naechsten Aufruf von selbst (er prueft die
// Datei bei jeder Registrierung auf Aenderungen), stellt fest, dass sie
// sich unterscheidet, und fuehrt sie aus. Danach ist der Speicher leer,
// die Registrierung weg, und die Navigation geht wieder an den Server -
// wo sie weitergeleitet wird.
//
// Ohne das muesste jede Person von Hand in die Entwicklerwerkzeuge oder
// ihre Browserdaten loeschen. Das tut niemand.
const ABMELDE_WORKER = `// Diese Instanz ist stillgelegt. Dieser Service Worker
// raeumt auf und meldet sich ab; danach greift die Weiterleitung.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil((async () => {
    for (const name of await caches.keys()) {
      await caches.delete(name);
    }
    await self.registration.unregister();
    // Offene Seiten neu laden: erst dadurch landen sie beim Server und
    // damit in der Weiterleitung.
    for (const fenster of await self.clients.matchAll({ type: 'window' })) {
      fenster.navigate(fenster.url);
    }
  })());
});
`;

// Beide Namen, unter denen die Anwendung je einen Worker registriert hat.
for (const pfad of ['/sw.js', '/push-sw.js']) {
  app.get(pfad, (req, res) => {
    // Kein Zwischenspeichern: sonst bekaeme der Browser womoeglich noch
    // einmal die alte Fassung aus seinem eigenen HTTP-Speicher.
    res.set('Cache-Control', 'no-store');
    res.type('application/javascript').send(ABMELDE_WORKER);
  });
}

app.use((req, res) => {
  // Pfad und Abfrageteil bleiben erhalten: wer ein Lesezeichen auf eine
  // bestimmte Belegung hat, landet auch drueben dort.
  const ziel = ZIEL + req.originalUrl;

  // 302, nicht 301: Eine dauerhafte Umleitung merkt sich der Browser auf
  // unbestimmte Zeit, und zwar auch dann, wenn sich die Adresse spaeter noch
  // einmal aendert - danach ist sie nur noch ueber das Leeren des
  // Browserspeichers loszuwerden. Bei einer Handvoll Nutzender ist der
  // Geschwindigkeitsgewinn einer dauerhaften Umleitung bedeutungslos, das
  // Risiko dagegen real.
  res.redirect(302, ziel);
});

app.listen(PORT, () => {
  console.log(`[weiterleitung] Diese Instanz ist stillgelegt. Alle Anfragen -> ${ZIEL}`);
  console.log('[weiterleitung] Es laufen KEINE Datenbank- und Speicherverbindungen.');
});
