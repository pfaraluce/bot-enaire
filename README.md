# bot-enaire 🚀

Monitor automático de la convocatoria de **Controladores Aéreos de Enaire
2025**.

Este bot monitoriza la web de empleo de Enaire buscando actualizaciones
específicas (como el icono de la estrella de novedades) y notifica
inmediatamente a través de un bot de Telegram con capturas de pantalla y
detalles.

## ✨ Características

- 🔍 **Scraping inteligente**: Detecta cambios en el texto y la presencia de la
  estrella de actualización.
- 📸 **Capturas de pantalla**: Envía una captura de la línea específica de la
  convocatoria cuando hay novedades.
- 🤖 **Notificaciones de Telegram**: Alertas en tiempo real con enlaces
  directos.
- 🔄 **Ejecución periódica**: Configurable para revisar la web cada X minutos.
- 🛠️ **Integración con PM2**: Preparado para ejecutarse en segundo plano de
  forma robusta.

## 📋 Requisitos Previos

- **Node.js** (v16 o superior recomendado)
- **Token de Bot de Telegram** (obtenido vía
  [@BotFather](https://t.me/BotFather))
- **ID de Chat de Telegram** (donde el bot enviará las alertas)

## 🚀 Instalación

1. Clona el repositorio o descarga los archivos.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Instala los navegadores necesarios para Playwright:
   ```bash
   npx playwright install chromium
   ```

## ⚙️ Configuración

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
CHECK_INTERVAL_MINUTES=15
```

## 💻 Uso

### Iniciar el bot (Modo normal)

```bash
npm start
```

### Probar la conexión

Envía un mensaje de prueba al chat para verificar que el bot está operativo:

```bash
npm run test-bot
```

### Ejecutar en segundo plano (PM2)

Si tienes PM2 instalado, puedes usar los scripts incluidos:

```bash
npm run background  # Inicia el bot con PM2
npm run logs        # Ver logs en tiempo real
npm run stop        # Detener el bot
```

## 🛠️ Estructura del Proyecto

- `scraper.js`: Motor de scraping usando Playwright.
- `check.js`: Script principal optimizado para ejecuciones en GitHub Actions.
- `state.json`: Almacena el último estado conocido para detectar cambios
  (importante para GitHub Actions).

## 🚀 Ejecución Perpetua (GitHub Actions)

Este proyecto está configurado para ejecutarse gratis y "para siempre" usando
GitHub Actions.

### Pasos para Activar:

1. Sube este repositorio a tu **GitHub**.
2. Ve a la pestaña **Settings** > **Secrets and variables** > **Actions**.
3. Asegúrate de:
   - Ir a la pestaña **Secrets** (arriba, junto a Variables).
   - Buscar la sección **Repository secrets** (abajo del todo).
   - **NO** lo pongas en "Environment secrets" a menos que sepas configurar
     entornos.
4. Añade estos dos **Repository secrets**:
   - `TELEGRAM_BOT_TOKEN`: Tu token de bot.
   - `TELEGRAM_CHAT_ID`: Tu ID de chat.
5. (Opcional) Ve a la pestaña **Actions**, selecciona "Check Enaire Updates" y
   pulsa **Run workflow** para probarlo manualmente.

El bot se ejecutará cada 15 minutos automáticamente y guardará su estado en el
repo para no repetir notificaciones.

## 🌐 Despliegue en VPS / Plesk

Para que el bot responda a comandos como `/star` 24/7, debes ejecutarlo en un
servidor (VPS).

### 1. Instalación de dependencias en Linux

En servidores Linux (Ubuntu/Debian), Playwright necesita librerías adicionales.
Ejecuta esto vía SSH:

```bash
npx playwright install-deps chromium
```

### 2. Configuración en Plesk

1. Sube los archivos al servidor.
2. Abre el panel de **Node.js** en Plesk.
3. **Application Startup File**: Cambia `app.js` por `bot.js` (Plesk pone
   `app.js` por defecto y dará error si no lo cambias).
4. Configura las variables (`TELEGRAM_BOT_TOKEN`, etc.) en el panel o sube el
   `.env`.
5. Pulsa "Run npm install" y "Restart Node.js".

### 3. Mantenerlo vivo (PM2)

Si usas terminal, te recomiendo **PM2**:

```bash
npm install -g pm2
pm2 start bot.js --name bot-enaire
```

### 4. Notificaciones en iPhone (ntfy.sh)

Si quieres avisos directos en el iPhone sin depender solo de Telegram:

1. Instala la app **ntfy** desde la App Store.
2. Pulsa el botón **+** (Subscribe to topic).
3. Inventa un nombre único (ej: `secreto-enaire-pablo`).
4. Pon ese mismo nombre en tu `.env` como `NTFY_TOPIC`.

---

_Desarrollado para facilitar el seguimiento de la convocatoria de
Controladores 2025._ ✈️
