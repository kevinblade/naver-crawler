const puppeteer = require("puppeteer");
const sleep = require("sleep");
const mariadb = require("mariadb");
const moment = require("moment");

let startTime, endTime;
let pageStartTime, pageEndTime;
let currentPage = 0;

let browser = null;
let page = null;
let catURLs = [];
let products = [];

const DB = {
  _pool: null,
  _connection: null,

  async createSchema() {
    const ddl = `
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories (
      name 
    );`;
  },

  async init() {
    const pool = mariadb.createPool({
      host: "mydb.com",
      user: "myUser",
      password: "myPassword",
      connectionLimit: 5
    });
    try {
      DB._connection = await pool.getConnection();
    } catch (error) {
      console.error(`DB.init(): ${error.message}`);
      throw error;
    }
  },

  async asyncFunction() {}
};

const BASE_CATEGORY_URL =
  "https://search.shopping.naver.com/category/category.nhn?cat_id=";

async function goto(url) {
  const promise = page.waitForNavigation({ timeout: 0 });
  await page.goto(url);
  await promise;
  while (true) {
    const title = await page.title();
    if (!title.includes("서비스 접근 권한이 없습니다")) {
      break;
    }
    sleep.sleep(30);
    await page.goto(url);
  }
}

function start() {
  startTime = new Date();
}

function end() {
  endTime = new Date();
  let timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds
  const seconds = Math.round(timeDiff);
  console.log(`Total elapsed time = ${seconds}`);
}

function startPage() {
  pageStartTime = new Date();
}

function endPage() {
  pageEndTime = new Date();
  let timeDiff = pageEndTime - pageStartTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds
  const seconds = Math.round(timeDiff);
  console.log(`Page elapsed time = ${seconds}`);
  console.log("");
}

async function getCategoriesURL() {
  let catURLs = [];
  // 새로운 페이지 객체 생성
  page = await browser.newPage();
  // UserAgent 설정
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
  );
  for (let i = 0; i < 11; i++) {
    // Goto top level category page
    const url = `${BASE_CATEGORY_URL}${50000000 + i}`;
    await goto(url);
    const urls = await page.$$eval("div.category_cell > h3 > a", atags =>
      atags.map(atag => atag.href)
    );
    catURLs = catURLs.concat(urls);
  }
  console.log(`total categories: ${catURLs.length}`);
  // 페이지 종료
  await page.close();
  return catURLs;
}

async function getProducts() {
  const products = [];
  // 상품정보 조회
  // id
  const ids = await page.$$eval("li._itemSection", lis =>
    lis.map(li => li.getAttribute("data-expose-id"))
  );
  console.log(`processProductsURL: ids = ${ids.length}`);
  // image url
  const imgs = await page.$$eval("li._itemSection > div.img_area > a", imgs =>
    imgs.map(img => img.href)
  );
  console.log(`processProductsURL: imgs = ${imgs.length}`);
  // title
  const titles = await page.$$eval("li._itemSection div.tit a", alinks =>
    alinks.map(alink => alink.textContent)
  );
  console.log(`processProductsURL: titles = ${titles.length}`);
  // price
  const prices = await page.$$eval(
    "li._itemSection span._price_reload",
    spans => spans.map(span => span.textContent)
  );
  console.log(`processProductsURL: prices = ${prices.length}`);
  // category(depth)
  const categories = await page.$$eval("li._itemSection span.depth", spans =>
    spans.map(span => {
      const alinks = span.getElementsByTagName("a");
      const categories = [];
      for (const alink of alinks) {
        categories.push(alink.textContent);
      }
      return categories;
    })
  );
  console.log(`processProductsURL: categories = ${categories.length}`);
  // review count & sale count
  const etcs = await page.$$eval("li._itemSection span.etc", spans =>
    spans.map(span => {
      const alinks = span.getElementsByClassName("graph");
      let review = "";
      let sale = "";
      for (const alink of alinks) {
        if (alink.textContent.includes("리뷰")) {
          review = alink.getElementsByTagName("em")[0].textContent;
        } else if (alink.textContent.includes("구매건수")) {
          sale = alink.getElementsByTagName("em")[0].textContent;
        }
      }
      return {
        review,
        sale
      };
    })
  );
  // registered at
  const regDates = await page.$$eval(
    "li._itemSection span.etc span.date",
    spans => spans.map(span => span.textContent)
  );
  console.log(`processProductsURL: regDates = ${regDates.length}`);

  for (let i = 0; i < ids.length; i++) {
    products.push({
      id: ids[i],
      image: imgs[i],
      title: titles[i],
      categories: categories[i],
      review: etcs[i].review,
      sale: etcs[i].sale,
      registeredAt: regDates[i] ? moment(regDates[i]).format("YYYY-MM-DD") : ""
    });
  }

  console.log(JSON.stringify(products[0], null, 4))

  return products;
}

async function processProductsURL(url) {
  console.log(`processProductsURL: url = ${url}`);
  // 페이지 처리 시간 체크 시작
  startPage();
  // 새로운 페이지 객체 생성
  page = await browser.newPage();
  // UserAgent 설정
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
  );
  // 상품 목록 페이지로 이동
  await goto(url);
  // 현재 페이지에 있는 상품들의 정보 추출 및 전체 목록에 추가.
  products = products.concat(await getProducts());
  console.log(`processProductsURL: products.length = ${products.length}`);
  // 다음 페이지 버튼이 있는지 조회
  const next = await page.$("a.next");
  if (next) {
    // 다음 페이지 버튼이 있을 경우 버튼을 Click
    const promise = page.waitForNavigation({ timeout: 5000 });
    await page.click("a.next");
    await promise;
    // Click으로 이동한 페이지의 URL을 조회
    const nextURL = page.url();
    console.log(`processProductsURL: next page URL = ${nextURL}`);
    // 조회된 URL을 카테고리 URL 배열의 앞에 추가
    catURLs.unshift(nextURL);
  }
  console.log(`Current page = ${++currentPage}`);
  // 페이지 종료
  await page.close();
  // 페이지 처리 시간 체크 종료
  endPage();
  sleep.sleep(Math.floor(Math.random() * 15));
}

(async () => {
  // DB.init()

  // 전체 처리 시간 체크 시작
  start();
  // 새로운 브라우저 객체 생성
  browser = await puppeteer.launch({ headless: true, slowMo: 200 });
  // browser = await puppeteer.launch({ headless: true });
  // 2레벨 카테고리 목록 페이지의 URL들을 조회
  catURLs = await getCategoriesURL();
  // 2레벨 카테고리 목록 페에지의 URL들을 순회하며 상품정보 조회
  while (catURLs.length > 0) {
    // 카테고리 URL 배열의 첫번재 항목을 추출
    const url = catURLs.shift();
    // 상품목록 페이지로 이동하고 상품별 정보 조회
    await processProductsURL(url);
  }
  // 브라우저 종료
  await browser.close();
  // 전체 처리 시간 체크 종료
  end();
})();
