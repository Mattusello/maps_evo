# Installare mapsEvo su iPhone senza Apple Developer Program

Piano operativo per la strada **"Mac una volta sola, poi Windows"**: il Mac serve solo per
produrre l'`.ipa`; da lì in avanti l'installazione e i rinnovi settimanali si fanno da Windows
con AltServer e un Apple ID gratuito.

## Perché questa strada

Expo Go sull'App Store non è installabile per SDK 57 (da maggio 2026 Apple consente solo
l'ultima versione pubblicata di Expo Go, che resta indietro rispetto all'SDK). EAS Build può
produrre build iOS **per dispositivo fisico solo con un Apple Developer Program a pagamento**;
senza account l'unica build possibile è quella per simulatore. L'unico modo di ottenere un
pacchetto installabile senza i 99 $/anno è compilare in locale con Xcode.

## Cosa serve

| | Requisito | Note |
|---|---|---|
| Mac | macOS con **Xcode ≥ 26.4** | SDK 57 = React Native 0.86; iOS minimo 16.4 |
| Mac | **Node ≥ 22.13** | su Windows qui gira Node 24.15 |
| iPhone | **iOS ≥ 16.4** | serve *Modalità sviluppatore* attiva |
| Account | **Apple ID gratuito** | nessun costo; certificato valido 7 giorni |
| Windows | iTunes e iCloud **scaricati da apple.com** | AltServer non funziona con le versioni Microsoft Store |

Limiti dell'Apple ID gratuito, da mettere in conto: **3 app** attive alla volta, **10 App ID
a settimana**, e il certificato **scade dopo 7 giorni** (l'app smette di aprirsi finché non
la si rinnova).

---

## Prima di partire: decidere sugli aggiornamenti OTA

**Da valutare adesso, non dopo.** Il bundle JavaScript finisce *dentro* l'`.ipa`: senza
aggiornamenti over-the-air, ogni modifica al codice — anche una sola riga di TypeScript —
richiede di ricompilare, quindi di tornare al Mac.

Con `expo-updates` + EAS Update pubblichi invece gli aggiornamenti JS da Windows e l'app già
installata li scarica da sola. Serve un account Expo (il piano gratuito basta per un uso
personale). Gli aggiornamenti OTA coprono **solo JS e asset**: cambiare dipendenze native o
la configurazione nativa richiede comunque una nuova build.

Aggiungere `expo-updates` modifica il progetto nativo, quindi va fatto **prima** di generare
l'`.ipa`, altrimenti il Mac serve una seconda volta:

```bash
npx expo install expo-updates
npx eas update:configure          # richiede: npm i -g eas-cli && eas login
```

Se preferisci rimandare, salta pure: il piano funziona lo stesso, ma ogni modifica al codice
vorrà dire rifare i passi 3 e 4 su un Mac.

---

## Passo 1 — Preparare il Mac

1. Installa **Xcode** dall'App Store, poi aprilo una volta: accetta la licenza e lascia che
   installi i componenti aggiuntivi.
2. Verifica gli strumenti da riga di comando:
   ```bash
   xcode-select --install          # se non già presenti
   xcodebuild -version             # deve dire 26.4 o superiore
   node -v                         # deve dire v22.13 o superiore
   ```

## Passo 2 — Portare il progetto sul Mac

```bash
git clone https://github.com/Mattusello/maps_evo.git maps_evo
cd maps_evo
git checkout staging              # il ramo di lavoro corrente
npm ci
```

Se hai modifiche non ancora spinte su GitHub, fai prima `git push` da Windows: è più affidabile
che copiare la cartella (e non trascina `node_modules`, che va comunque reinstallato sul Mac).

## Passo 3 — Generare il progetto nativo iOS

```bash
npx expo prebuild --platform ios --clean
```

Crea la cartella `ios/` (esclusa da git di proposito: è rigenerabile) ed esegue `pod install`.
Il bundle identifier è già impostato in `app.json` come `com.mymappa.app` — cambialo lì se
preferisci un dominio tuo, **prima** di lanciare il prebuild.

## Passo 4 — Verificare che l'app giri davvero sull'iPhone

Prima di impacchettare conviene provare che compili e funzioni:

1. Sull'iPhone: **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** → attiva e riavvia.
2. Collega l'iPhone al Mac via cavo e concedi *Autorizza* quando lo chiede.
3. Apri `ios/mapsEvo.xcworkspace` in Xcode, seleziona il target **mapsEvo** →
   **Signing & Capabilities** → *Team*: scegli il tuo **Personal Team** (l'Apple ID gratuito).
   Se Xcode segnala che il bundle identifier è già usato, cambialo aggiungendo un suffisso
   (es. `com.mymappa.app.matti`) e riporta la stessa modifica in `app.json`.
4. Compila e installa:
   ```bash
   npx expo run:ios --device --configuration Release
   ```

`--configuration Release` non è un dettaglio: in Debug il codice JavaScript viene servito da
Metro, quindi l'app funzionerebbe solo col Mac acceso e sulla stessa rete. In Release il bundle
è incorporato e l'app è autonoma.

A questo punto l'app è già sul telefono e funziona — ma scade in 7 giorni e il rinnovo
richiederebbe il Mac. Per questo si prosegue con l'`.ipa`.

## Passo 5 — Creare l'`.ipa` da rifirmare con AltStore

Serve un `.ipa` **non firmato**: sarà AltStore a firmarlo col tuo Apple ID. Si compila senza
firma e si impacchetta a mano.

```bash
cd ios

xcodebuild -workspace mapsEvo.xcworkspace \
  -scheme mapsEvo \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  build

cd build/Build/Products/Release-iphoneos
mkdir -p Payload
cp -R mapsEvo.app Payload/
zip -r ~/Desktop/mapsEvo.ipa Payload
```

La struttura `Payload/NomeApp.app` dentro uno zip rinominato `.ipa` è esattamente ciò che
AltStore si aspetta. Se il nome dello schema o dell'`.app` non fosse `mapsEvo`, guarda il
contenuto di `ios/` e di `Release-iphoneos/` e usa quello che trovi.

Copia `mapsEvo.ipa` su Windows (cloud, chiavetta, quello che preferisci). **Da qui il Mac non
serve più**, finché non cambi dipendenze o configurazione nativa.

## Passo 6 — Installare da Windows con AltServer

1. Installa **iTunes** e **iCloud** prendendoli da `apple.com` (le versioni del Microsoft Store
   non espongono le API che AltServer usa).
2. Scarica **AltServer per Windows** da [altstore.io](https://altstore.io), estrai
   `AltInstaller.zip` ed esegui `Setup.exe`.
3. Collega l'iPhone via USB, sbloccalo e autorizza il computer.
4. Dall'icona di AltServer nella barra delle applicazioni: **Install AltStore** → scegli il tuo
   iPhone → inserisci l'**Apple ID gratuito**.
5. Sull'iPhone: **Impostazioni → Generali → VPN e gestione dispositivo** → fidati del profilo
   appena installato.
6. Apri **AltStore** sull'iPhone → **My Apps** → **+** in alto a sinistra → scegli
   `mapsEvo.ipa`. L'installazione richiede qualche minuto.

## Passo 7 — Tenere viva l'app (ogni 7 giorni)

Il certificato gratuito scade dopo una settimana. Due modi per rinnovarlo:

- **AltStore**: con AltServer in esecuzione sul PC e iPhone sulla stessa rete Wi-Fi (o collegato
  via USB), apri AltStore → **Refresh All**. Non ricompila nulla: rinnova solo la firma.
- **SideStore**: variante di AltStore che rinnova direttamente dall'iPhone, senza tenere il PC
  acceso. Più comodo se il Mac/PC non è sempre disponibile.

Se ti dimentichi e l'app smette di aprirsi, non perdi nulla: basta un Refresh (o reinstallare
lo stesso `.ipa`).

---

## Quando serve tornare al Mac

| Modifica | Serve il Mac? |
|---|---|
| Codice TypeScript/React, stili, traduzioni | **No**, se hai configurato EAS Update; altrimenti sì |
| Nuova dipendenza solo JS | **No**, con EAS Update |
| Nuova dipendenza **nativa** (moduli Expo, librerie con codice nativo) | **Sì** |
| Modifiche a `app.json` che toccano il nativo (icone, splash, permessi, bundle id) | **Sì** |
| Aggiornamento dell'SDK Expo | **Sì** |

## Se un giorno prendi l'Apple Developer Program

Tutto questo decade: con l'account a pagamento si builda in cloud da Windows con
`eas build --profile development --platform ios`, si installa via QR senza cavi, il certificato
dura un anno invece di 7 giorni e cade il limite delle 3 app. Il lavoro fatto qui non va perso:
`bundleIdentifier` ed `expo-updates` restano validi.
