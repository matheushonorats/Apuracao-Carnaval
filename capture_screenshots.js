const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Ensure assets/manual exists
    const dir = path.join(__dirname, 'assets', 'manual');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport for consistent screenshots
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Navigating to Admin Panel...');
        await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });

        // Admin Home / Agremiações (Default active tab might be 'schools' based on HTML class="active")
        // But let's check.
        // In the HTML provided in Step 2125:
        // <a href="#" class="nav-link active" data-tab="schools"> (Line 46)
        // <div id="schoolsTab" class="tab-content active"> (Line 71)
        // So Schools is the default.

        console.log('Capturing Admin Schools...');
        await page.screenshot({ path: path.join(dir, 'admin_schools.png') });

        // Click Judges
        console.log('Switching to Judges...');
        await page.click('[data-tab="judges"]');
        await new Promise(r => setTimeout(r, 500)); // Wait for transition
        await page.screenshot({ path: path.join(dir, 'admin_judges.png') });

        // Click Categories
        console.log('Switching to Categories...');
        await page.click('[data-tab="categories"]');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(dir, 'admin_categories.png') });

        // Click Scores
        console.log('Switching to Scores...');
        await page.click('[data-tab="scores"]');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(dir, 'admin_scores.png') });

        // Click Settings
        console.log('Switching to Settings...');
        await page.click('[data-tab="settings"]');
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: path.join(dir, 'admin_settings.png') });

        // Public Display
        console.log('Navigating to Public Display...');
        await page.goto('http://localhost:3000/display.html', { waitUntil: 'networkidle0' });
        await page.screenshot({ path: path.join(dir, 'public_display.png') });

        console.log('All screenshots captured successfully.');

    } catch (e) {
        console.error('Error capturing screenshots:', e);
    } finally {
        await browser.close();
    }
})();
