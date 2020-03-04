const puppeteer = require('puppeteer')
const mariadb = require('mariadb')

const DB = {
  _pool: null,
  _connection: null,

  async createSchema () {
    const ddl = `
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories (
      name 
    );`
  },

  async init () {
    const pool = mariadb.createPool({
      host: 'mydb.com',
      user: 'myUser',
      password: 'myPassword',
      connectionLimit: 5
    })
    try {
      DB._connection = await pool.getConnection()
    } catch (error) {
      console.error(`DB.init(): ${error.message}`)
      throw error
    }
  },

  async asyncFunction () {}
}

const BASE_CATEGORY_URL =
  'https://search.shopping.naver.com/category/category.nhn?cat_id='

;(async () => {
  // DB.init()

  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  let totalCount = 0

  for (let i = 0; i < 11; i++) {
    const url = `${BASE_CATEGORY_URL}${50000000 + i}`
    const waitFor = page.waitForNavigation({
      waitUntil: 'networkidle0',
      timeout: 5000
    })

    // Goto top level category page
    await page.goto(url)
    await waitFor
    const topCatTitle = await page.$eval(
      'h2.category_tit',
      h2 => h2.textContent
    )
    console.log(topCatTitle)

    // Find <a> tags from the current page are having a <strong> tag.
    const atags = await page.$x(
      '//div[@class="category_cell"]//a/strong/parent::a'
    )
    let subCount = 0
    for (const atag of atags) {
      totalCount++
      subCount++
      // Get an object has name and url properties.
      const a = await page.evaluate(a => {
        return {
          name: a.textContent,
          url: a.href
        }
      }, atag)
      console.log(`count: ${subCount}, ${JSON.stringify(a)}`)
    }
  }

  console.log(`total categories = ${totalCount}`)

  await browser.close()
})()
