const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('Navigating to Enaire Employment page...');
    try {
        await page.goto('https://empleo.enaire.es/empleo/', { waitUntil: 'networkidle' });
        
        // Wait for the specific call to appear if needed, or look for it in the table
        const rowSelector = 'tr:has-text("CONVOCATORIA EXTERNA CONTROLADORES 2025")';
        const row = page.locator(rowSelector);
        
        if (await row.count() > 0) {
            console.log('Found the target row!');
            const starIcon = row.locator('span.icon-enaire.enaire-star');
            const hasStar = await starIcon.count() > 0;
            console.log(`Star icon present: ${hasStar}`);
            
            // Log row content for debugging
            const rowContent = await row.innerText();
            console.log('Row content:', rowContent.replace(/\s+/g, ' ').trim());
        } else {
            console.log('Target row NOT found. Trying to find it in the "Avisos" page if redirection is needed.');
            // Maybe it's in a specific section. Let's list all rows to see what's there.
            const rows = await page.locator('tr').all();
            console.log(`Found ${rows.length} rows in the main page.`);
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                console.log(`Row ${i}:`, (await rows[i].innerText()).replace(/\s+/g, ' ').trim());
            }
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
})();
