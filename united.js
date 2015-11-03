var _ = require('lodash')
var fs = require('fs')
var request = require('request')
var async = require ('async')
var colors = require('colors');
var args = process.argv.slice(2);

// load the default json blob
var formData = require('./united_request.json')

// these are the final result datasets
var finalResults = []

// set data based on args
var config = {
  origin: args[0],
  destination: args[1],
  start: new Date(args[2]),
  end: new Date(args[3])
}

var headers = {
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36"
}

/**
 * Gets the right referer URL for where the XHR request is coming from
 */
var getReferer = function (origin, destination, dateString) {
  return 'https://www.united.com/ual/en/us/flight-search/book-a-flight/results/rev?f=' +
    origin +
    '&t=' +
    destination +
    '&d=' +
    dateString +
    '&tt=1&st=bestmatches&cbm=-1&cbm2=-1&ut=MUA&sc=7&px=1&taxng=1&idx=1'
}

/**
 * Get the URL for making the XHR request
 */
var getUrl = function (origin, destination, dateString) {
  return 'https://www.united.com/ual/en/us/flight-search/book-a-flight/flightshopping/getflightresults/rev'
}

/**
 * Convert the date into a string format that can be used in requests
 */
var getDateString = function (date) {
  var d = ('0' + date.getDate()).slice(-2)
  var m = ('0' + (date.getMonth() + 1)).slice(-2)
  var y = date.getFullYear()
  return y + '-' + m + '-' + d
}

/**
 * Clone the default data payload and set options for this search
 */
var setData = function (inputData, origin, destination, dateString) {
  var data = _.cloneDeep(inputData)
  data['Origin'] = origin
  data['Destination'] = destination
  data['DepartDate'] = dateString
  data['ReturnDate'] = dateString
  data['Trips'][0]['Origin'] = origin
  data['Trips'][0]['Destination'] = destination
  data['Trips'][0]['DepartDate'] = dateString
  data['Trips'][0]['ReturnDate'] = dateString
  return data
}

/**
 * Parse the resulting data from United
 */
var parseResults = function (data) {
  var upgrades = []
  var flights = data.data['Trips'][0]['Flights']
  for (var i = 0; i < flights.length; i++) {
    var products = flights[i]['Products']
    if (products[1]['UpgradeInfo'] &&
        products[1]['UpgradeInfo']['Available'] === true &&
        products[1]['UpgradeInfo']['Waitlisted'] === false) {
      upgrades.push(flights[i])
    }
  }
  return upgrades
}

/**
 * Load, process, and return results for a given date
 */
var loadResults = function (origin, destination, date, cb) {
  var dateString = getDateString(date)
  var options = {
    url: getUrl(origin, destination, dateString),
    headers: _.clone(headers),
    method: 'POST'
  }
  options.headers['Referer'] = getReferer(origin, destination, dateString)
  data = setData(formData, origin, destination, dateString)
  options.json = data
  request(options, function (error, response, body) {
    var upgrades = []
    if (!error) {
      // update results
      upgrades = parseResults(body)
    }
    finalResults.push({
      date: date,
      upgrades: upgrades,
      error: error
    })
    return cb(error)
  })
}

/**
 * Helper function for async call
 */
var loadResultsByDate = function (date, cb) {
  return loadResults(config.origin, config.destination, date, cb)
}

/**
 * Pretty print the results so that they are human readable
 */
var printResults = function (result) {
  console.log('==============================')
  if (result.upgrades.length > 0) {
    console.log(getDateString(result.date).green.bold)
  } else {
    console.log(getDateString(result.date).red.bold)
  }
  var templateFile = fs.readFileSync('united_template.ejs')
  var template = _.template(templateFile)
  for (var i = 0; i < result.upgrades.length; i++) {
    console.log(template({ data: result.upgrades[i] }))
  }
}

var dates = []
for (var d = new Date(config.start); d <= config.end; d.setDate(d.getDate() + 1)) {
  dates.push(new Date(d))
}

async.each(dates, loadResultsByDate, function (err) {
  finalResults.sort(function (a,b) { return a.date - b.date })
  for (var i = 0; i < finalResults.length; i++) {
    printResults(finalResults[i])
  }
})
