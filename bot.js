require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { checkUpdates } = require('./scraper');

const STATE_FILE = path.join(__dirname, 'state.json');
const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 10;
const STAR_COOLDOWN_MS = 60 * 1000;
const starCooldowns = new Map();

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env file.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
console.log(`[Sistema] Iniciando bot con Node.js ${process.version}`);

// --- Suscriptores ---
function loadSubscribers() {
    try {
        const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8').trim();
        return new Set(JSON.parse(data));
    } catch {
        return new Set([ADMIN_CHAT_ID]);
    }
}
function saveSubscribers(subs) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([...subs]), 'utf8');
}

// --- Estado ---
function loadState() {
    try {
        const data = fs.readFileSync(STATE_FILE, 'utf8').trim();
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}
function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

// --- Comparar listas de documentos ---
// Usa URL como clave única de cada documento
function docsMap(docs) {
    const map = {};
    (docs || []).forEach(d => { map[d.url] = d; });
    return map;
}

function diffDocuments(prevDocs, currDocs) {
    const prev = docsMap(prevDocs);
    const curr = docsMap(currDocs);
    const added = Object.values(curr).filter(d => !prev[d.url]);
    const removed = Object.values(prev).filter(d => !curr[d.url]);
    return { added, removed };
}

// --- Broadcast ---
async function broadcast(message, screenshotPath) {
    const subs = loadSubscribers();
    for (const chatId of subs) {
        try {
            if (screenshotPath && fs.existsSync(screenshotPath)) {
                await bot.telegram.sendPhoto(chatId, { source: screenshotPath }, {
                    caption: message,
                    parse_mode: 'HTML'
                });
            } else {
                await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
            }
        } catch (e) {
            console.error(`[Broadcast] Error a ${chatId}:`, e.message);
        }
    }
    console.log(`[Broadcast] Enviado a ${subs.size} suscriptor(es).`);
}

// --- Comprobación principal ---
async function performCheck() {
    console.log(`[${new Date().toISOString()}] Iniciando comprobación...`);
    const state = loadState();
    const result = await checkUpdates();

    if (result.error) { console.error('Error scraping:', result.error); return; }
    if (!result.found) { console.log('Convocatoria no encontrada.'); return; }

    const prevDocs = state.documents || [];
    const currDocs = result.documents || [];
    const { added, removed } = diffDocuments(prevDocs, currDocs);
    const prevHasStar = state.hasStar || false;

    console.log(`[Lógica] Docs: ${currDocs.length} | Añadidos: ${added.length} | Eliminados: ${removed.length} | Estrella: ${result.hasStar}`);

    let message = '';

    if (added.length > 0 || removed.length > 0) {
        const lines = [`📋 <b>CAMBIOS EN LA CONVOCATORIA ENAIRE 2025</b>\n`];

        if (added.length > 0) {
            lines.push('✅ <b>NUEVOS DOCUMENTOS:</b>');
            added.forEach(d => {
                lines.push(`• <b>${d.section}</b>\n  <a href="${d.url}">${d.name}</a> <i>(${d.date})</i>`);
            });
        }
        if (removed.length > 0) {
            lines.push('\n🗑️ <b>DOCUMENTOS ELIMINADOS:</b>');
            removed.forEach(d => {
                lines.push(`• <b>${d.section}</b>\n  ${d.name} <i>(${d.date})</i>`);
            });
        }
        lines.push(`\n🔗 <a href="https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025">Ver convocatoria completa</a>`);
        message = lines.join('\n');

    } else if (result.hasStar && !prevHasStar) {
        // La estrella aparece sin cambios de documentos detectados aún
        message = `⭐ <b>¡Estrella detectada en la convocatoria!</b>\n\nHay novedades recientes. Comprueba la convocatoria:\n\n🔗 <a href="https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025">Ver convocatoria</a>`;
    } else {
        console.log('[Lógica] Sin cambios relevantes.');
    }

    if (message) {
        await broadcast(message, result.screenshot);
    }

    saveState({ hasStar: result.hasStar, documents: currDocs, lastCheck: new Date().toISOString() });
}

// --- Comandos ---
bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const subs = loadSubscribers();
    if (subs.has(chatId)) return ctx.reply('Ya estás suscrito. Te avisaré cuando haya novedades. ✅');
    subs.add(chatId);
    saveSubscribers(subs);
    console.log(`[Subs] Nuevo: ${chatId}`);
    ctx.reply('¡Suscrito! 🎉 Te avisaré automáticamente cuando haya documentos nuevos o cambios en la convocatoria de controladores Enaire 2025.');
});

bot.command('stop', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (chatId === ADMIN_CHAT_ID) return ctx.reply('El admin no puede desuscribirse. 🛡️');
    const subs = loadSubscribers();
    subs.delete(chatId);
    saveSubscribers(subs);
    ctx.reply('Te has dado de baja. Ya no recibirás notificaciones. 👋');
});

bot.command('star', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const now = Date.now();
    if (now - (starCooldowns.get(chatId) || 0) < STAR_COOLDOWN_MS) {
        const secs = Math.ceil((STAR_COOLDOWN_MS - (now - starCooldowns.get(chatId))) / 1000);
        return ctx.reply(`⏳ Espera ${secs}s antes de volver a consultar.`);
    }
    starCooldowns.set(chatId, now);
    ctx.reply('Comprobando... ⏳');
    const result = await checkUpdates();
    if (result.error) {
        console.error('[Bot /star] Error:', result.error);
        return ctx.reply(`Error al consultar. ❌\nDetalles: ${result.error}`);
    }
    if (!result.found) return ctx.reply('No se encuentra la convocatoria. ❌');
    const docs = result.documents || [];
    const newDocs = docs.filter(d => d.isNew);
    let reply = result.hasStar ? '⭐ <b>Hay novedades</b> (estrella activa)\n\n' : '❌ Sin novedades en este momento.\n\n';
    if (newDocs.length > 0) {
        reply += '<b>Documentos marcados como nuevos:</b>\n';
        newDocs.forEach(d => { reply += `• <a href="${d.url}">${d.name}</a> (${d.date})\n`; });
    }
    ctx.reply(reply.trim(), { parse_mode: 'HTML' });
});

bot.command('subs', async (ctx) => {
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
    ctx.reply(`Suscriptores activos: ${loadSubscribers().size} 👥`);
});

bot.command('settings', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const isAdmin = chatId === ADMIN_CHAT_ID;
    const state = loadState();
    const subs = loadSubscribers();
    
    let reply = `⚙️ <b>Configuración y Estado del Bot</b>\n\n`;
    reply += `• <b>Frecuencia de comprobación:</b> cada ${CHECK_INTERVAL_MINUTES} ${CHECK_INTERVAL_MINUTES === 1 ? 'minuto' : 'minutos'}\n`;
    
    if (state.lastCheck) {
        const lastCheckDate = new Date(state.lastCheck);
        const formattedDate = lastCheckDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
        reply += `• <b>Última comprobación:</b> ${formattedDate} (hora peninsular)\n`;
    } else {
        reply += `• <b>Última comprobación:</b> Ninguna registrada aún\n`;
    }
    
    reply += `• <b>Estado convocatoria:</b> ${state.hasStar ? '⭐ Novedades detectadas' : '❌ Sin novedades'}\n`;
    
    if (isAdmin) {
        reply += `\n🛡️ <b>Información de Administrador:</b>\n`;
        reply += `• <b>Admin Chat ID:</b> <code>${ADMIN_CHAT_ID}</code>\n`;
        reply += `• <b>Suscriptores activos:</b> ${subs.size} 👥\n`;
        reply += `• <b>Documentos en caché:</b> ${state.documents ? state.documents.length : 0}\n`;
    }
    
    ctx.reply(reply, { parse_mode: 'HTML' });
});

// --- Scheduler ---
let isChecking = false;
async function scheduledCheck() {
    if (isChecking) return;
    isChecking = true;
    try { await performCheck(); }
    catch (e) { console.error('[scheduledCheck] Error:', e.message); }
    finally { isChecking = false; }
}

bot.catch((err) => console.error('[Bot] Error interno:', err.message));

console.log(`[Sistema] Iniciando checks cada ${CHECK_INTERVAL_MINUTES} minutos...`);
scheduledCheck();
setInterval(scheduledCheck, CHECK_INTERVAL_MINUTES * 60 * 1000);

// --- Servidor HTTP Dummy para Plesk (Passenger) ---
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('El bot de Enaire está en funcionamiento. 🤖\n');
}).listen(PORT, () => {
    console.log(`[Sistema] Servidor dummy escuchando en el puerto ${PORT}`);
});

bot.launch({ dropPendingUpdates: true })
    .then(() => console.log('[Bot] Comandos activos.'))
    .catch(err => console.error('[Bot] Launch fallido (no fatal):', err.message));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
