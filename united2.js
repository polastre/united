const puppeteer = require('puppeteer')
const colors = require('colors')
const args = process.argv.slice(2)
const _ = require('lodash')
const fs = require('fs')

/**
 * Convert the date into a string format that can be used in requests
 */
function getDateString(date, separator = '/') {
  var d = ('0' + date.getDate()).slice(-2)
  var m = ('0' + (date.getMonth() + 1)).slice(-2)
  var y = date.getFullYear()
  return m + separator + d + separator + y
}

/**
 * Parse the resulting data from United
 */
function parseResults(data) {
  let upgrades = []
  let flights = data.data['Trips'][0]['Flights']
  if (flights == undefined) {
    return []
  }
  for (let i = 0; i < flights.length; i++) {
    let products = flights[i]['Products']
    if (products[1]['UpgradeInfo'] &&
        products[1]['UpgradeInfo']['Available'] === true &&
        products[1]['UpgradeInfo']['Waitlisted'] === false) {
      upgrades.push(flights[i])
    }
  }
  return upgrades
}

/**
 * Pretty print the results so that they are human readable
 */
function printResults(result) {
  console.log('==============================')
  if (result.upgrades.length > 0) {
    console.log(getDateString(result.date).green.bold)
  } else {
    console.log(getDateString(result.date).red.bold)
  }
  let templateFile = fs.readFileSync('united_template.ejs')
  let template = _.template(templateFile)
  for (let i = 0; i < result.upgrades.length; i++) {
    console.log(template({ data: result.upgrades[i] }))
  }
}

async function processDate(date) {
    const browser = await puppeteer.launch()
    function timeout(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36')
    let results = null
    let xhrRequests = 0
    let ready = false
    await page.goto('https://www.united.com/ual/en/us/flight-search/book-a-flight', {waitUntil: 'networkidle0'})

    page.on('response', async msg => {
      // console.log('r:', msg.request().url)
      if (msg.request().resourceType == 'xhr') {
        xhrRequests++
        // console.log(msg.request().url)
        if (msg.request().url.startsWith('https://www.united.com/ual/en/us/default/autocomplete/affinityseach')) {
          ready = true
        }
        if (msg.request().url == 'https://www.united.com/ual/en/us/flight-search/book-a-flight/flightshopping/getflightresults/rev') {
          try {
            const data = await msg.json()
            results = parseResults(data)
            // console.log('results1:', results)
          }
          catch (error) {}
        }
      }
    })

    await page.evaluate(() => {
      const ow = document.querySelector("#TripTypes_ow")
      ow.click()
      document.querySelector("#Trips_0__NonStop").click()
      document.querySelector("#Trips_0__OneStop").click()
      document.querySelector("#Trips_0__TwoPlusStop").click()
    })
    await page.click('#TripTypes_ow')
    await timeout(100)
    await page.evaluate(function() {
      document.querySelector('#Trips_0__Origin').value = ''
      document.querySelector('#Trips_0__Destination').value = ''
      document.querySelector('#Trips_0__DepartDate').value = ''
    })
    await timeout(100)
    await page.type('#Trips_0__Origin', config.origin, {delay: 100})
    await timeout(100)
    await page.click('#fare-preference')
    await timeout(100)
    await page.type('#Trips_0__Destination', config.destination, {delay: 100})
    await timeout(100)
    await page.click('#fare-preference')
    await timeout(100)
    await page.type('#Trips_0__DepartDate', getDateString(date), {delay: 100})
    await timeout(100)
    await page.click('#fare-preference')
    await timeout(100)
    await page.select('#select-upgrade-type', 'MUA')
    await timeout(100)
    await page.click('#fare-preference')
    await timeout(100)
    await page.focus('#ClassofService')
    await timeout(100)
    // check if date is valid
    let valid = await page.$eval('#Trips_0__DepartDate', el => el.getAttribute('aria-invalid'))
    if (valid == 'true') {
      console.log('INVALID DATE')
      return []
    }
    while ((xhrRequests < 3) || (ready === false)) {
      await timeout(500)
    }
    await timeout(1000)
    await page.evaluate(() => {
      const btn = document.querySelector("#btn-search")
      btn.click()
    })

    let retries = 0
    while (results === null && retries < 60) {
      process.stdout.write('.')
      await timeout(500)
      retries++
    }
    console.log('')
    if (retries == 60) {
      console.log('TIMEOUT! ', getDateString(date))
    }
    await page.close()
    await browser.close()
    if (results === null) {
      return []
    }
    // await timeout(2000)
    return results
}

// set data based on args
if (args.length < 4) {
  console.log('Not enough arguments. Format: [ORG] [DST] [FRM] [TO]')
  process.exit(1)
}

const config = {
  origin: args[0],
  destination: args[1],
  start: new Date(args[2]),
  end: new Date(args[3])
}

async function runDates() {
  let dates = []
  let results = []
  for (let d = new Date(config.start); d <= config.end; d.setDate(d.getDate() + 1)) {
    let newDate = new Date(d)
    dates.push(newDate)
    results.push(await processDate(d))
  }
  for (let i = 0; i < results.length; i++) {
    printResults({
      date: dates[i],
      upgrades: results[i]
    })
  }
}

runDates()
