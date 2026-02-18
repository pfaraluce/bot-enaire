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

## 🤖 Comandos del Bot

- `/star`: Consulta manualmente el estado actual de la estrella en la
  convocatoria.

## 🛠️ Estructura del Proyecto

- `bot.js`: Lógica principal del bot y gestión de intervalos.
- `scraper.js`: Motor de scraping usando Playwright.
- `state.json`: Almacena el último estado conocido para detectar cambios
  (importante para GitHub Actions).
- `latest_update.png`: Última captura de pantalla generada.

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

> [!WARNING]
> En tu captura de pantalla, parece que los has puesto en **Environments**. El
> bot **no los verá** ahí. Borra esos y créalos en **Settings > Secrets and
> variables > Actions > Repository secrets**.

El bot se ejecutará cada 15 minutos automáticamente y guardará su estado en el
repo para no repetir notificaciones.

---

_Desarrollado para facilitar el seguimiento de la convocatoria de
Controladores 2025._ ✈️
