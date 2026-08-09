# Generare un APK di mapsEvo installabile su qualsiasi Android

L'APK prodotto qui è **autonomo**: contiene il bundle JavaScript, quindi funziona senza PC
acceso, senza Metro e senza Expo Go. Si installa su qualunque dispositivo con **Android 7
(API 24) o superiore**, che è il minimo richiesto da SDK 57.

Due strade: **EAS Build in cloud** (consigliata, nulla da installare a parte la CLI) e
**build locale** (nessun account, ma serve tutto il toolchain Android sul PC).

---

## Strada A — EAS Build in cloud *(consigliata)*

Non serve Android Studio, né Java, né l'SDK Android: compila Expo sui propri server. Serve solo
un account Expo, che per questo uso è gratuito.

### 1. Installare la CLI e accedere

```bash
npm install -g eas-cli
eas login
```

Se non hai un account, crealo su [expo.dev/signup](https://expo.dev/signup) — è gratuito.

### 2. Collegare il progetto

```bash
eas init
```

Crea il progetto su EAS e scrive `extra.eas.projectId` in `app.json`. Va fatto una volta sola:
il file va poi committato.

### 3. Lanciare la build

```bash
eas build --platform android --profile preview
```

Il profilo `preview` è già configurato in `eas.json` con `"buildType": "apk"`, quindi produce un
APK e non un AAB (l'AAB è il formato dello store, **non installabile** direttamente su un
telefono).

Alla prima esecuzione EAS chiede di **generare un keystore**: rispondi di sì. Lo conserva lui e
lo riusa a ogni build successiva — vedi la nota sulla firma più sotto.

La build finisce in coda (nel piano gratuito i tempi di attesa sono variabili). Al termine la CLI
stampa un link alla pagina della build, con un QR e il pulsante di download dell'APK.

### 4. Installare sul telefono

1. Apri il link della build dal telefono (o inquadra il QR) e scarica l'APK.
2. Alla prima installazione Android chiede di consentire l'installazione da **fonti sconosciute**
   per il browser o il gestore file che stai usando: è la normale procedura di sideload.
3. Installa e apri.

Per distribuirlo ad altri basta condividere il link della build o il file `.apk`.

---

## Strada B — Build locale *(nessun account, ma toolchain da installare)*

Ha senso se vuoi lavorare offline o mettere mano al codice nativo. Sul PC oggi non c'è nulla di
tutto questo, quindi metti in conto diversi GB di installazione.

### 1. Prerequisiti

- **JDK 17**
- **Android Studio** con SDK Platform 36 e Build-Tools
- variabile `ANDROID_HOME` che punta all'SDK (di solito `%LOCALAPPDATA%\Android\Sdk`)

### 2. Generare un keystore

Un APK di release non firmato non si installa. Creane uno una volta sola e **conservalo**:

```bash
keytool -genkeypair -v -keystore mymappa-release.keystore \
  -alias mymappa -keyalg RSA -keysize 2048 -validity 10000
```

Poi in `android/gradle.properties` (dopo il prebuild del passo 3):

```properties
MYAPP_RELEASE_STORE_FILE=mymappa-release.keystore
MYAPP_RELEASE_KEY_ALIAS=mymappa
MYAPP_RELEASE_STORE_PASSWORD=<la password scelta>
MYAPP_RELEASE_KEY_PASSWORD=<la password scelta>
```

e collega queste proprietà al `signingConfig` di release in `android/app/build.gradle`.
Il keystore **non va committato**: `.gitignore` esclude già `*.jks` e `*.p12`.

### 3. Compilare

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

L'APK esce in `android/app/build/outputs/apk/release/app-release.apk`.

> Non usare `assembleDebug` per distribuire: in debug il JavaScript viene servito da Metro, quindi
> l'app funzionerebbe solo col PC acceso sulla stessa rete.

---

## Cose da sapere

**La firma è un impegno duraturo.** Android consente di aggiornare un'app installata solo con un
APK firmato con lo **stesso** keystore. Se cambi keystore, l'aggiornamento fallisce e l'utente
deve disinstallare e reinstallare, perdendo i dati locali (qui: gli itinerari salvati, che in
Fase 1 stanno in AsyncStorage). Con EAS il keystore è custodito nel progetto: puoi scaricarne una
copia di sicurezza con `eas credentials`.

**Ogni modifica al codice richiede una nuova build.** Il bundle JS è dentro l'APK. Se vuoi poter
aggiornare l'app già installata senza ricompilare, aggiungi `expo-updates` + EAS Update — vale
sia per Android sia per iOS, e va fatto *prima* di generare i pacchetti (vedi
[IOS_INSTALL.md](./IOS_INSTALL.md), sezione sugli aggiornamenti OTA).

**Il numero di versione.** `eas.json` usa `"appVersionSource": "remote"`, quindi il `versionCode`
lo gestisce EAS e si incrementa da solo a ogni build di produzione. Per il profilo `preview` non
è un problema: puoi reinstallare sopra la versione precedente.

**Chi riceve il link può scaricare l'APK.** I link delle build EAS sono accessibili a chi li
possiede: trattali come un file privato, non pubblicarli se non vuoi che l'app circoli.
