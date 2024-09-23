const puppeteer = require('puppeteer');
const fs = require('fs');
const { Parser } = require('json2csv');

// Helper function to delay execution
function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time);
  });
}

async function scrapeReviews(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Increase timeout for slow loading pages
  await page.setDefaultNavigationTimeout(60000); // 60 seconds
  await page.goto(url);

  let reviews = [];
  let hasNextPage = true;
  let pageNum = 1;

  while (hasNextPage && pageNum<6) {
    console.log(`Scraping page ${pageNum}`);

     // Simulate pressing the 'Esc' key to close any popup dialogs
     try {
        await page.keyboard.press('Escape');
        console.log('Esc key pressed to close the dialog');
      } catch (error) {
        console.log('Failed to press Esc key or no dialog found');
      }

    // Wait for the reviews to load
    await page.waitForSelector('.jdgm-rev-widg__reviews', { timeout: 60000 }); // 60 seconds

    // Extract reviews from the current page
    const reviewsOnPage = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.jdgm-rev');
      return Array.from(reviewElements).map(review => ({
        rating: review.querySelector('.jdgm-rev__rating')?.getAttribute('data-score') || 'N/A',
        author: review.querySelector('.jdgm-rev__author')?.innerText.trim() || 'No Author',
        title: review.querySelector('.jdgm-rev__title')?.innerText.trim() || 'No Title',
        description: review.querySelector('.jdgm-rev__body')?.innerText.trim() || 'No Description'
      }));
    });

    reviews = reviews.concat(reviewsOnPage);
    console.log(`Scraped ${reviewsOnPage.length} reviews from page ${pageNum}`);

    // Check if there's a next page
    hasNextPage = await page.evaluate(() => {
      const nextButton = document.querySelector('.jdgm-paginate__next-page');
      return nextButton && !nextButton.classList.contains('jdgm-paginate__page-inactive');
    });

    if (hasNextPage) {
      // Click the next page button
      try {
        await page.click('.jdgm-paginate__next-page');
        console.log(`Navigating to page ${pageNum + 1}`);
        
        // Wait for the reviews to load on the next page
        await page.waitForSelector('.jdgm-rev-widg__reviews', { timeout: 60000 });
        
        await delay(3000); // Give extra time for content to load
        pageNum++;
      } catch (error) {
        console.log('Error navigating to the next page:', error);
        hasNextPage = false;
      }
    } else {
      console.log('No more pages or last page reached.');
    }
  }

  await browser.close();
  return reviews;
}

async function main() {
  const url = 'https://milky-mama.com/pages/customer-reviews';
  const reviews = await scrapeReviews(url);

  // Convert to CSV and save to file
  const fields = ['rating', 'author', 'title', 'description'];
  const parser = new Parser({ fields });
  const csv = parser.parse(reviews);

  fs.writeFileSync('reviews.csv', csv);
  console.log(`Scraped a total of ${reviews.length} reviews and saved to reviews.csv`);
}

main().catch(console.error);
