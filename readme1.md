const puppeteer = require('puppeteer');
const fs = require('fs');
const { Parser } = require('json2csv');

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function autoScroll(page) {
  console.log('Starting autoScroll function...');
  
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    console.log('Auto-scroll completed.');
  } catch (error) {
    console.error('Error during auto-scroll:', error);
  }
}

async function scrapeReviews(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  let reviews = [];
  let allReview = []
  let hasMoreReviews = true;
  let reviewCount = 0;
  let retryCount = 0;
  const maxRetries = 5;

  while (hasMoreReviews && reviewCount < 2000 && retryCount < maxRetries) {
    console.log(`Scraping reviews (${reviewCount} so far)`);

    try {
      await page.keyboard.press('Escape');
    } catch (error) {
      console.log('Failed to press Esc key or no dialog found');
    }

    try {
      await page.waitForSelector('.jdgm-rev', { timeout: 10000 });
      await autoScroll(page);

      const newReviews = await page.evaluate(() => {
        const reviewElements = document.querySelectorAll('.jdgm-rev');
        return Array.from(reviewElements).map((review) => ({
          productName: review.querySelector('.jdgm-rev__prod-link')?.innerText.trim() || 'N/A',
          rating: review.querySelector('.jdgm-rev__rating')?.getAttribute('data-score') || 'N/A',
          author: review.querySelector('.jdgm-rev__author')?.innerText.trim() || 'No Author',
          date: review.querySelector('.jdgm-rev__timestamp')?.innerText.trim() || 'No Date',
          title: review.querySelector('.jdgm-rev__title')?.innerText.trim() || 'No Title',
          body: review.querySelector('.jdgm-rev__body')?.innerText.trim() || 'No Description',
          verifiedBuyer: review.getAttribute('data-verified-buyer') === 'true',
          upvotes: review.getAttribute('data-thumb-up-count') || '0',
          downvotes: review.getAttribute('data-thumb-down-count') || '0',
        }));
      });

      const uniqueNewReviews = newReviews.filter(
        (newReview) => !reviews.some((existingReview) => 
          existingReview.author === newReview.author && 
          existingReview.date === newReview.date && 
          existingReview.body === newReview.body
        )
      );

      reviews = reviews.concat(uniqueNewReviews);
      allReview = allReview.concat(newReviews)
      reviewCount = reviews.length;
      console.log(`Scraped ${uniqueNewReviews.length} new unique reviews`);


      const fields = ['productName', 'rating', 'author', 'date', 'title', 'body', 'verifiedBuyer', 'upvotes', 'downvotes'];
    const parser = new Parser({ fields });
    const csv1 = parser.parse(reviews);
    const csv2 = parser.parse(allReview);

    fs.writeFileSync('milky_mama_unique_reviews.csv', csv1);
    fs.writeFileSync('milky_mama_all_reviews.csv', csv2);


      hasMoreReviews = uniqueNewReviews.length > 0;
      retryCount = 0; // Reset retry count on successful scrape

      if (hasMoreReviews) {
        await delay(2000);
      } else {
        console.log('No more new reviews to load.');
      }
    } catch (error) {
      console.error('Error during scraping:', error);
      retryCount++;
      console.log(`Retry attempt ${retryCount} of ${maxRetries}`);
      await delay(5000); // Wait longer before retrying
    }
  }

  return reviews;
}

async function main() {
  const url = 'https://milky-mama.com/pages/customer-reviews';
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null,
  });
  const page = await browser.newPage();

  try {
    const reviews = await scrapeReviews(page, url);
    const fields = ['productName', 'rating', 'author', 'date', 'title', 'body', 'verifiedBuyer', 'upvotes', 'downvotes'];
    const parser = new Parser({ fields });
    const csv = parser.parse(reviews);

    fs.writeFileSync('milky_mama_reviews.csv', csv);
    console.log(`Scraped a total of ${reviews.length} unique reviews and saved to milky_mama_reviews.csv`);
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main().catch(console.error);