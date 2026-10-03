# Weiterleitung einer stillgelegten Instanz

Ein Express-Server, der alle Anfragen auf eine neue Adresse umleitet **und
dabei den Service Worker einer früheren PWA-Installation abmeldet**.

## Warum nicht einfach ein 301

Wer eine Progressive Web App aufgerufen hat, trägt deren Dateien im
Browser-Speicher, und der Service Worker beantwortet Navigationen daraus —
ohne den Server zu fragen. Eine Prüfung von aussen sieht brav die
Weiterleitung; der Browser der betroffenen Person sieht weiterhin die alte
Oberfläche und lässt sich sogar bedienen.

Deshalb liefert dieser Server unter `/sw.js` und `/push-sw.js` einen Service
Worker aus, der genau eines tut: Caches löschen, sich abmelden, offene
Fenster neu laden. Danach geht die Navigation wieder an den Server und wird
umgeleitet.

Eine rein statische Seite kann das nicht leisten: Ihre Redirect-Regel würde
auch `/sw.js` umleiten, und ein umgeleiteter Worker-Abruf lässt die
bestehende Registrierung unangetastet stehen.

## Betrieb

```
Build Command:  npm install
Start Command:  node server-weiterleitung.js
```

Dazu die Umgebungsvariable:

```
WEITERLEITUNG_ZIEL=https://beispiel.example.com
```

Ohne sie startet der Server bewusst gar nicht und schreibt den Grund ins
Log — eine Weiterleitung ins Leere wäre schlimmer als eine Fehlerseite: der
Browser landet auf sich selbst und dreht sich im Kreis.

Umgeleitet wird mit **302**, nicht 301: Eine dauerhafte Weiterleitung merkt
sich der Browser auf unbestimmte Zeit, auch wenn sich die Adresse später
noch einmal ändert. Pfad und Abfrageteil bleiben erhalten.
