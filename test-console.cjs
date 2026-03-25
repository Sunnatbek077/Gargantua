const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
        
        await page.goto('http://localhost:4321/', { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
    } catch (err) {
        console.error('PUPPETEER EXCEPTION:', err);
    }
})();
