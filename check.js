require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { checkUpdates } = require('./scraper');

const STATE_FILE = path.join(__dirname, 'state.json');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            return JSON.parse(data || '{}');
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function run() {
    console.log('Starting one-off check...');
    const currentState = loadState();
    const result = await checkUpdates();

    if (result.error) {
        console.error('Check failed:', result.error);
        process.exit(1);
    }

    if (!result.found) {
        console.log('Call not found.');
        return;
    }

    const previousHasStar = currentState.hasStar || false;
    const currentHasStar = result.hasStar;
    const previousText = currentState.text || '';
    const currentText = result.text;

    let message = '';
    let shouldSend = false;

    if (currentHasStar && !previousHasStar) {
        message = `🚀 <b>¡HAY NOVEDADES EN ENAIRE!</b> 🚀\n\n⭐ Se ha detectado la <b>estrella de actualización</b>.\n\n📝 <b>Contenido:</b>\n<i>${currentText}</i>\n\n🔗 <a href="https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025">Ver convocatoria</a>`;
        shouldSend = true;
    } else if (currentText !== previousText && currentText.length > 0) {
        message = `📢 <b>CAMBIO EN LA CONVOCATORIA</b> 📢\n\nEl texto ha sido modificado.\n\n🆕 <b>Nuevo contenido:</b>\n<i>${currentText}</i>\n\n⭐ <b>Estrella:</b> ${currentHasStar ? 'ACTIVA ✅' : 'NO DETECTADA ❌'}`;
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
            console.log('Notification sent.');
        } catch (e) {
            console.error('Error sending message:', e);
        }
    } else {
        console.log('No changes detected.');
    }

    saveState({
        hasStar: currentHasStar,
        text: currentText,
        lastCheck: new Date().toISOString()
    });
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
