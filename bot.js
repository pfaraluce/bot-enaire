require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { checkUpdates } = require('./scraper');

const STATE_FILE = path.join(__dirname, 'state.json');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 15;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env file.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            if (!data.trim()) return {};
            return JSON.parse(data);
        } catch (e) {
            console.error('Error parsing state.json. Resetting to empty state.');
            return {};
        }
    }
    return {};
}

function saveState(state) {
    try {
        const data = JSON.stringify(state, null, 2);
        fs.writeFileSync(STATE_FILE, data, 'utf8');
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

async function performCheck(notifyOnlyOnChange = true) {
    console.log(`[${new Date().toISOString()}] Starting check...`);
    const currentState = loadState();
    const result = await checkUpdates();

    if (result.error) {
        console.error('Scraping error:', result.error);
        return { error: result.error };
    }

    if (!result.found) {
        console.log('Call not found. No updates.');
        return { found: false };
    }

    const previousHasStar = currentState.hasStar || false;
    const currentHasStar = result.hasStar;
    const previousText = currentState.text || '';
    const currentText = result.text;

    let message = '';
    let shouldSend = false;

    if (currentHasStar && !previousHasStar) {
        message = `🚀 <b>¡HAY NOVEDADES EN ENAIRE!</b> 🚀\n\n⭐ Se ha detectado la <b>estrella de actualización</b> en el proceso de Controladores 2025.\n\n📝 <b>Contenido actual:</b>\n<i>${currentText}</i>\n\n🔗 <b>Enlace directo:</b>\n<a href="https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025">Ver convocatoria</a>\n\n¡A darle caña! 💪🔥`;
        shouldSend = true;
    } else if (currentText !== previousText && currentText.length > 0) {
        message = `📢 <b>CAMBIO EN LA CONVOCATORIA</b> 📢\n\nEl texto del proceso ha sido modificado.\n\n🆕 <b>Nuevo contenido:</b>\n<i>${currentText}</i>\n\n⭐ <b>Estado de la estrella:</b> ${currentHasStar ? 'ACTIVA ✅' : 'NO DETECTADA ❌'}\n\nRevisa si hay nuevos documentos. 🧐`;
        shouldSend = true;
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
        } catch (e) {
            console.error('Error sending Telegram message:', e);
        }
    }

    saveState({
        hasStar: currentHasStar,
        text: currentText,
        lastCheck: new Date().toISOString()
    });

    return result;
}

// Commands
bot.command('star', async (ctx) => {
    console.log(`[${new Date().toISOString()}] User requested /star status.`);
    // Simple check, no photo, no fluff
    const result = await checkUpdates();
    if (result.error) {
        return ctx.reply('Error al comprobar la web. Inténtalo más tarde.');
    }
    if (!result.found) {
        return ctx.reply('No he encontrado la convocatoria en la web. ❌');
    }
    const response = result.hasStar ? 'SÍ hay estrella. ⭐' : 'NO hay estrella. ❌';
    ctx.reply(response);
});

// Periodic check logic
let isChecking = false;
async function scheduledCheck() {
    if (isChecking) return;
    isChecking = true;
    await performCheck(true);
    isChecking = false;
}

// Start bot
if (process.argv.includes('--test')) {
    bot.telegram.sendMessage(CHAT_ID, '✅ <b>CONEXIÓN ESTABLECIDA</b> ✅\n\nEl bot está operativo y escuchando comandos.', { parse_mode: 'HTML' })
        .then(() => console.log('Test message sent.'))
        .catch(e => console.error('Test message failed:', e));
} else {
    bot.launch().then(() => {
        console.log('Bot launched and listening for commands...');
        // Initial check
        scheduledCheck();
        // Set interval
        setInterval(scheduledCheck, CHECK_INTERVAL_MINUTES * 60 * 1000);
    });
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
