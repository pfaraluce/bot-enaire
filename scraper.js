const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TARGET_TEXT = 'CONVOCATORIA EXTERNA CONTROLADORES 2025';
const TARGET_URL = 'https://empleo.enaire.es/empleo/';
const SCREENSHOT_PATH = path.join(__dirname, 'latest_update.png');

async function checkUpdates() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    
    console.log(`[${new Date().toISOString()}] Checking updates at ${TARGET_URL}...`);
    
    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait for the table row
        const rowSelector = `tr:has-text("${TARGET_TEXT}")`;
        const row = page.locator(rowSelector).first();
        
        if (await row.count() > 0) {
            const rowText = await row.innerText();
            const hasStar = await row.locator('span.icon-enaire.enaire-star').count() > 0;
            
            console.log(`Found call: ${TARGET_TEXT}`);
            console.log(`Star icon present: ${hasStar}`);
            
            // Take a screenshot of the row
            await row.screenshot({ path: SCREENSHOT_PATH });
            
            return {
                found: true,
                hasStar: hasStar,
                text: rowText.replace(/\s+/g, ' ').trim(),
                screenshot: SCREENSHOT_PATH
            };
        } else {
            console.log(`Call "${TARGET_TEXT}" not found on page.`);
            return { found: false };
        }
    } catch (error) {
        console.error('Error during scraping:', error);
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

// For manual testing
if (require.main === module) {
    checkUpdates().then(result => {
        console.log('Result:', JSON.stringify(result, null, 2));
    });
}

module.exports = { checkUpdates };
