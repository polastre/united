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
    
### Linux users:
Be sure to use option `--ignore-ssl-errors=yes` when you run casperjs

    casperjs --ignore-ssl-errors=yes united.js --json SFO NRT 5/3/2013 6/1/2013

## Web tool

Inside of `www/` is a Flask based web app frontend with 10 threads to run the united.js script remotely.

## FAQ

The relevant sections of the FAQ in [www/templates/index.html](www/templates/index.html) are copied here.

### Why can you only search one-way?

The best way to put together a successful upgrade plan for a round trip ticket is to be flexible on your dates.  By searching both directions separately, you can pick which dates in each direction are most convenient for you to travel.  Then you can combine the results for the final ticket that you intend to book.

### Why do I get no results?

Airlines are funny companies.  The "fare classes" available determines whether there's an upgrade or not.  This changes by time of day, day of week, how many other customers are booked in for the flight, number of days until the flight, and probably the phase of the moon.  The **best days to look for upgrades** are in the middle of the week when fewer people are buying airline tickets.

Keep in mind that upgrades are rarely available for peak travel periods, such as summer school vacation, unless booked exactly one year in advance.

### Who Is This For?

United Premier 1K members, Global Services, anyone holding an upgrade certificate (Global Premier Upgrade or Regional Upgrade), or anyone that wants to use miles and cash to upgrade can find flights and dates that have **immediate upgrade availability**.  If you book a flight with immediate upgrade availability, the agent on the phone can confirm you in the next class of service immediately after booking.  You can also book online and choose to use your upgrade certificate once the ticket is issued (this can take 10-15 minutes or more).

### How Do I Use This?

This tool searches for **one-way** availability between the two specified airports.  It looks at every date, and determines whether immediately upgradable seats are available.  You should put your outbound flight in a one query, and then your potential return flight (and date range) as another.  When you find both outbound and return flights with upgrade availability, then go to <a href="http://www.united.com">united.com</a> and search with those specific dates.

