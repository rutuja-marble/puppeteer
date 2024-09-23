const puppeteer = require('puppeteer');

async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        let totalHeight = 0;
        let distance = 100; // Adjust scroll distance as needed
        let scrollAttempts = 0; // To limit the number of scroll attempts
        let maxAttempts = 50; // Set max scroll attempts

        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollAttempts++;

          if (
            totalHeight >= document.body.scrollHeight ||
            scrollAttempts > maxAttempts
          ) {
            clearInterval(timer);
            resolve();
          }
        }, 200); // Adjust scrolling speed if necessary
      });
    });
  } catch (error) {
    console.error('Error during auto-scroll:', error.message);
  }
}

async function scrapeReviews(page) {
  try {
    console.log('Scraping reviews...');

    // Auto-scroll and scrape logic
    await autoScroll(page);

    // Your scraping logic here
    // Example: const reviews = await page.$$eval('.review', nodes => nodes.map(n => n.innerText));
    console.log('Reviews scraped successfully.');
  } catch (error) {
    console.error('Error during scraping:', error.message);

    // Retry logic
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        console.log(`Retry attempt ${attempt} of 5`);
        await page.reload({ waitUntil: 'networkidle2' });
        await scrapeReviews(page);
        break; // Exit retry loop on success
      } catch (retryError) {
        console.error('Error during retry:', retryError.message);
        if (attempt === 5) {
          console.error('Max retry attempts reached. Exiting.');
        }
      }
    }
  }
}

async function main() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, // Set to false for better stability
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null, // Prevents viewport issues
    });

    const page = await browser.newPage();
    await page.goto('https://milky-mama.com/pages/customer-reviews', { waitUntil: 'domcontentloaded' });

    // Start scraping
    await scrapeReviews(page);
  } catch (mainError) {
    console.error('Error in main function:', mainError.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
