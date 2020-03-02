const puppeteer = require('puppeteer')

;(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto('https://shopping.naver.com/')
  await page.waitForNavigation()

  console.log('Page loaded...')
  const names = await page.$$eval('ul.co_category_list em', ems => ems.map(em => em.textContent))
  console.log(`names = ${names}`)

  await browser.close()
})()
