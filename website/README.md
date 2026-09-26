# Firmenwebseite – Luca Paglia | ERP- & proALPHA-Beratung

Einseitige, statische Firmenwebseite (kein Build-Prozess nötig) mit Kontaktformular.

## Dateien
- `index.html` – die Hauptseite
- `style.css` – Design (unterstützt hell/dunkel automatisch)
- `script.js` – Mobilmenü + Kontaktformular-Logik
- `impressum.html`, `datenschutz.html` – rechtlich nötige Seiten (Platzhalter, siehe unten)

## Kontaktformular: Wie die E-Mails ankommen
Das Formular sendet direkt (ohne eigenen Server) über den kostenlosen Dienst
[FormSubmit.co](https://formsubmit.co) an **info@lucapaglia.ch**.

**Wichtig – einmalige Aktivierung:**
1. Seite online stellen (siehe unten) und das Formular einmal testweise absenden.
2. FormSubmit schickt an `info@lucapaglia.ch` eine Bestätigungs-E-Mail
   ("Confirm Form Submission Activation"). Diesen Link einmal anklicken.
3. Danach werden alle weiteren Formular-Einsendungen automatisch per E-Mail zugestellt.

Falls du statt FormSubmit einen anderen Dienst nutzen willst (z. B. Formspree, Web3Forms,
oder ein eigenes Backend), muss in `script.js` nur die Konstante `FORMSUBMIT_ENDPOINT`
angepasst werden.

## Anpassungen, die du noch vornehmen solltest
- **Telefonnummer**: in `index.html` den Platzhalter `+41 00 000 00 00` ersetzen.
- **LinkedIn-Link**: in `index.html` die echte LinkedIn-URL eintragen.
- **Bio-Text / Werdegang**: Abschnitt "Über mich" in `index.html` mit echten Erfahrungen
  (Referenzen, Jahre Erfahrung, Branchen) ergänzen.
- **Impressum & Datenschutz**: In `impressum.html` und `datenschutz.html` die Platzhalter
  (Adresse, ggf. UID) ausfüllen. Als selbständig Erwerbender in der Schweiz solltest du
  ein korrektes Impressum sowie eine Datenschutzerklärung veröffentlichen (Schweizer DSG,
  ggf. EU-DSGVO falls du auch EU-Kunden ansprichst). Die vorhandenen Texte sind nur
  Platzhalter und ersetzen keine rechtliche Prüfung.
- **Logo/Favicon**: aktuell ein einfaches "LP"-Icon; kann bei Bedarf durch ein echtes Logo
  ersetzt werden.

## Hosting / Veröffentlichung unter lucapaglia.ch
Die Seite ist rein statisch (HTML/CSS/JS) und lässt sich z. B. so veröffentlichen:

- **GitHub Pages**: Repo/Ordner `website/` als Pages-Quelle einstellen, danach die
  Domain `lucapaglia.ch` bei deinem Domain-Provider per CNAME auf GitHub Pages zeigen lassen.
- **Netlify / Vercel**: Ordner `website/` als Projekt-Root hochladen bzw. verbinden,
  danach eigene Domain hinterlegen.
- **Klassisches Webhosting**: Dateien aus `website/` per FTP/SFTP in den Webspace
  deines Hosting-Anbieters hochladen.

Lokal testen: einfach `website/index.html` im Browser öffnen, oder z. B.
`python3 -m http.server` im Ordner `website/` ausführen und `http://localhost:8000` öffnen.
