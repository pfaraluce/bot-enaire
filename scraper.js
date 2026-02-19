const { chromium } = require('playwright');
const path = require('path');

const TARGET_TEXT = 'CONVOCATORIA EXTERNA CONTROLADORES 2025';
const LISTING_URL = 'https://empleo.enaire.es/empleo/';
const DETAIL_URL = 'https://empleo.enaire.es/empleo/PFSrv?accion=avisos&codigo=20251120&titulo=CONVOCATORIA%20EXTERNA%20CONTROLADORES%202025';
const BASE_URL = 'https://empleo.enaire.es/empleo/';
const SCREENSHOT_PATH = path.join(__dirname, 'latest_update.png');

async function checkUpdates() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 }
    });

    try {
        // 1. Comprobar si la estrella está activa en el listado principal
        const listPage = await context.newPage();
        await listPage.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60000 });

        const row = listPage.locator(`tr:has-text("${TARGET_TEXT}")`).first();
        if (await row.count() === 0) {
            return { found: false };
        }
        const hasStar = await row.locator('span.icon-enaire.enaire-star').count() > 0;
        await listPage.close();

        // 2. Navegar a la página de detalle y extraer documentos
        const detailPage = await context.newPage();
        await detailPage.goto(DETAIL_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // Captura de pantalla de la sección principal
        const section = detailPage.locator('section.col-md-8').first();
        if (await section.count() > 0) {
            await section.screenshot({ path: SCREENSHOT_PATH });
        }

        // Extraer todos los documentos agrupados por sección
        const documents = await detailPage.evaluate((baseUrl) => {
            const result = [];
            const principals = document.querySelectorAll('div[id^="principal"]');

            principals.forEach((principal) => {
                // Título de la sección
                const sectionTitleEl = principal.querySelector('.collapsible__panel--link');
                const sectionTitle = sectionTitleEl
                    ? sectionTitleEl.textContent.replace(/\s+/g, ' ').trim()
                    : principal.id;

                // ¿Tiene estrella la sección?
                const sectionHasStar = !!principal.querySelector('.collapsible__panel--link .enaire-star, h3 .enaire-star');

                // Filas de documentos
                const rows = principal.querySelectorAll('table.tabla__responsive tbody tr');
                rows.forEach((tr) => {
                    const anchor = tr.querySelector('td.width75 a');
                    const dateEl = tr.querySelector('td.width17');
                    const rowHasStar = !!tr.querySelector('.enaire-star');

                    if (anchor) {
                        const href = anchor.getAttribute('href') || '';
                        const fullUrl = href.startsWith('http') ? href : baseUrl + href;
                        // Limpiar iconos del texto del enlace
                        const name = anchor.textContent.replace(/\s+/g, ' ').trim()
                            .replace(' El enlace se abre en una nueva ventana', '')
                            .trim();
                        const date = dateEl ? dateEl.textContent.trim() : '';

                        result.push({
                            section: sectionTitle,
                            sectionHasStar,
                            name,
                            url: fullUrl,
                            date,
                            isNew: rowHasStar
                        });
                    }
                });
            });
            return result;
        }, BASE_URL);

        await detailPage.close();

        return {
            found: true,
            hasStar,
            documents,
            screenshot: SCREENSHOT_PATH
        };

    } catch (error) {
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = { checkUpdates };
