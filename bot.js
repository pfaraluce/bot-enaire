require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { checkUpdates } = require('./scraper');
const axios = require('axios'); // Movido arriba

const STATE_FILE = path.join(__dirname, 'state.json');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NTFY_TOPIC = process.env.NTFY_TOPIC; // Nuevo: Tópico para ntfy.sh
// Configuración de intervalo: por defecto 10 minutos
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 10;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env file.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

console.log(`[Sistema] Iniciando bot con Node.js ${process.version}`);

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf8').trim();
            if (!data) return {}; // Si el archivo está vacío, devolvemos objeto vacío
            return JSON.parse(data);
        } catch (e) {
            console.error('[Sistema] Error leyendo state.json (posiblemente corrupto):', e.message);
            return {};
        }
    }
    return {};
}

function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

async function sendNtfyNotification(title, message, priority = 'high') {
    if (!NTFY_TOPIC) return;
    try {
        console.log(`[ntfy] Enviando a tópico: ${NTFY_TOPIC}...`);
        await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, message, {
            headers: {
                'Title': title,
                'Priority': priority,
                'Tags': 'airplane,star'
            },
            timeout: 5000 // Timeout de 5 seg para no bloquear el bot
        });
        console.log('[ntfy] Notificación enviada correctamente.');
    } catch (e) {
        console.error('[ntfy] Error:', e.message);
    }
}

async function performCheck(notifyOnlyOnChange = true) {
    console.log(`[${new Date().toISOString()}] Iniciando comprobación...`);
    const currentState = loadState();
    const result = await checkUpdates();

    if (result.error) {
        console.error('Error en el scraping:', result.error);
        return { error: result.error };
    }

    if (!result.found) {
        console.log('Convocatoria no encontrada.');
        return { found: false };
    }

    const previousHasStar = currentState.hasStar || false;
    const currentHasStar = result.hasStar;
    const previousText = currentState.text || '';
    const currentText = result.text;

    let message = '';
    let shouldSend = false;

    console.log(`[Lógica] Prev: ${previousHasStar ? '⭐' : '❌'}, Actual: ${currentHasStar ? '⭐' : '❌'}`);

    if (currentHasStar && !previousHasStar) {
        console.log('[Lógica] ¡Novedad detectada! Preparando mensaje de estrella.');
        message = `🚀 <b>¡HAY NOVEDADES EN ENAIRE!</b> 🚀\n\n⭐ Se ha detectado la <b>estrella de actualización</b>.\n\n📝 <b>Contenido:</b>\n<i>${currentText}</i>\n\n🔗 <a href="https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025">Ver convocatoria</a>`;
        shouldSend = true;
    } else if (currentText !== previousText && currentText.length > 0) {
        console.log('[Lógica] Cambio de texto detectado.');
        message = `📢 <b>CAMBIO EN LA CONVOCATORIA</b> 📢\n\nEl texto ha sido modificado.\n\n🆕 <b>Nuevo contenido:</b>\n<i>${currentText}</i>\n\n⭐ <b>Estrella:</b> ${currentHasStar ? 'ACTIVA ✅' : 'NO DETECTADA ❌'}`;
        shouldSend = true;
    } else {
        console.log('[Lógica] Sin cambios relevantes.');
    }

    if (shouldSend && message) {
        try {
            if (result.screenshot && fs.existsSync(result.screenshot)) {
                await bot.telegram.sendPhoto(CHAT_ID, { source: result.screenshot }, {
                    caption: message,
                    parse_mode: 'HTML'
                });
            } else {
                await bot.telegram.sendMessage(CHAT_ID, message, { parse_mode: 'HTML' });
            }
            // Enviar a ntfy también
            const ntfyTitle = currentHasStar ? '⭐ NOVEDAD ENAIRE' : '📢 CAMBIO ENAIRE';
            await sendNtfyNotification(ntfyTitle, currentText);
            
            console.log('Notificación enviada.');
        } catch (e) {
            console.error('Error enviando mensaje:', e);
        }
    }

    saveState({
        hasStar: currentHasStar,
        text: currentText,
        lastCheck: new Date().toISOString()
    });

    return result;
}

// Comandos
bot.command('star', async (ctx) => {
    console.log(`[${new Date().toISOString()}] Solicitud manual /star.`);
    ctx.reply('Comprobando estado actual de la web... ⏳');
    const result = await checkUpdates();
    if (result.error) return ctx.reply('Error al consultar la web. ❌');
    if (!result.found) return ctx.reply('No se encuentra la convocatoria. ❌');
    
    const response = result.hasStar ? 'SÍ hay estrella de novedades. ⭐' : 'No hay estrella de novedades en este momento. ❌';
    ctx.reply(response);
});

// Lógica de comprobación periódica
let isChecking = false;
async function scheduledCheck() {
    if (isChecking) return;
    isChecking = true;
    try {
        await performCheck(true);
    } catch (e) {
        console.error('[scheduledCheck] Error inesperado:', e.message);
    } finally {
        isChecking = false;
    }
}

// Capturar errores del bot (ej: 409 conflict) sin matar el proceso
bot.catch((err) => {
    console.error('[Bot] Error interno (ignorado):', err.message);
});

// Iniciar servidor
bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log(`Bot iniciado. Revisión automática cada ${CHECK_INTERVAL_MINUTES} minutos.`);
    scheduledCheck();
    setInterval(scheduledCheck, CHECK_INTERVAL_MINUTES * 60 * 1000);
});

// Parada elegante
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
