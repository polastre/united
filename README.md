United Upgrades
======

A tool to find upgrade availability on United Airlines. Includes web front-end implementation.

## united.js tool

The main component is a CasperJS script that goes through the United.com search process.

You will need to install:
* [CasperJS](http://casperjs.org/installation.html)
* PhantomJS (follow the instructions in CasperJS)

Run the tool with:

    casperjs united.js [options] ORIGIN DESTINATION START END
    
Where options are:
* `--json` : Output as JSON format
* `--csv` : Output as CSV file (useful for importing to Google Docs or Excel)
* ORIGIN and DESTINATION should be a 3-letter airport code
* START and END should be US-formatted dates, eg MM/DD/YYY

Example

    casperjs united.js --json SFO NRT 5/3/2013 6/1/2013

## Web tool

Inside of `www/` is a Flask based web app frontend with 10 threads to run the united.js script remotely.
