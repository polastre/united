var flights = [];
var title = '';
var fs = require("fs");
var casper = require('casper').create({
	clientScripts: [fs.workingDirectory + "/jquery-1.9.1.min.js"],
	timeout: 1000*60*30, // 30-minute total timeout
	onTimeout: function() { casper.echo("[{ error:'timeout'}] ]").exit(); }
});
var colorizer = require('colorizer').create('Colorizer');

if (casper.cli.args.length < 4) {
	casper.echo("syntax: united.js ORIGIN DEST START END");
	casper.exit();
}

var origin = casper.cli.get(0);
var destination = casper.cli.get(1);
var start = new Date(Date.parse(casper.cli.get(2)));
var current = start;
var end = new Date(Date.parse(casper.cli.get(3)));

var csv = false;
var json = false;
if (casper.cli.has("csv")) {
	csv = true;
	casper.echo('Date,Price,Flight 1,Departure,Departure Time,Arrival,Arrival Time,Flight 2,Departure,Departure Time,Arrival,Arrival Time,Flight 3,Departure,Departure Time,Arrival,Arrival Time');
} else if (casper.cli.has("json")) {
	json = true;
	casper.echo('[');
} else {
	casper.echo(origin + ' > ' + destination);
}

//================================================================================
//================================================================================
// SEE: https://github.com/yotsumoto/casperjs-goto
//
// Extending Casper functions for realizing label() and goto()
// 
// Functions:
//   checkStep()   Revised original checkStep()
//   then()        Revised original then()
//   label()       New function for making empty new navigation step and affixing the new label on it.
//   goto()        New function for jumping to the labeled navigation step that is affixed by label()
//   dumpSteps()   New function for Dump Navigation Steps. This is very helpful as a flow control debugging tool.
// 

var utils = require('utils');
var f = utils.format;

/**
 * Revised checkStep() function for realizing label() and goto()
 * Every revised points are commented.
 *
 * @param  Casper    self        A self reference
 * @param  function  onComplete  An options callback to apply on completion
 */
casper.checkStep = function checkStep(self, onComplete) {
    if (self.pendingWait || self.loadInProgress) {
        return;
    }
    self.current = self.step;                 // Added:  New Property.  self.current is current execution step pointer
    var step = self.steps[self.step++];
    if (utils.isFunction(step)) {
        self.runStep(step);
        step.executed = true;                 // Added:  This navigation step is executed already or not.
    } else {
        self.result.time = new Date().getTime() - self.startTime;
        self.log(f("Done %s steps in %dms", self.steps.length, self.result.time), "info");
        clearInterval(self.checker);
        self.emit('run.complete');
        if (utils.isFunction(onComplete)) {
            try {
                onComplete.call(self, self);
            } catch (err) {
                self.log("Could not complete final step: " + err, "error");
            }
        } else {
            // default behavior is to exit
            self.exit();
        }
    }
};


/**
 * Revised then() function for realizing label() and goto()
 * Every revised points are commented.
 *
 * @param  function  step  A function to be called as a step
 * @return Casper
 */
casper.then = function then(step) {
    if (!this.started) {
        throw new CasperError("Casper not started; please use Casper#start");
    }
    if (!utils.isFunction(step)) {
        throw new CasperError("You can only define a step as a function");
    }
    // check if casper is running
    if (this.checker === null) {
        // append step to the end of the queue
        step.level = 0;
        this.steps.push(step);
        step.executed = false;                 // Added:  New Property. This navigation step is executed already or not.
        this.emit('step.added', step);         // Moved:  from bottom
    } else {

      if( !this.steps[this.current].executed ) {  // Added:  Add step to this.steps only in the case of not being executed yet.
        // insert substep a level deeper
        try {
//          step.level = this.steps[this.step - 1].level + 1;   <=== Original
            step.level = this.steps[this.current].level + 1;   // Changed:  (this.step-1) is not always current navigation step
        } catch (e) {
            step.level = 0;
        }
        var insertIndex = this.step;
        while (this.steps[insertIndex] && step.level === this.steps[insertIndex].level) {
            insertIndex++;
        }
        this.steps.splice(insertIndex, 0, step);
        step.executed = false;                    // Added:  New Property. This navigation step is executed already or not.
        this.emit('step.added', step);            // Moved:  from bottom
      }                                           // Added:  End of if() that is added.

    }
//    this.emit('step.added', step);   // Move above. Because then() is not always adding step. only first execution time.
    return this;
};


/**
 * Adds a new navigation step by 'then()'  with naming label
 *
 * @param    String    labelname    Label name for naming execution step
 */
casper.label = function label( labelname ) {
  var step = new Function('"empty function for label: ' + labelname + ' "');   // make empty step
  step.label = labelname;                                 // Adds new property 'label' to the step for label naming
  this.then(step);                                        // Adds new step by then()
};

/**
 * Goto labeled navigation step
 *
 * @param    String    labelname    Label name for jumping navigation step
 */
casper.goto = function goto( labelname ) {
  for( var i=0; i<this.steps.length; i++ ){         // Search for label in steps array
      if( this.steps[i].label == labelname ) {      // found?
        this.step = i;                              // new step pointer is set
      }
  }
};
// End of Extending Casper functions for realizing label() and goto()
//================================================================================
//================================================================================



//================================================================================
//================================================================================
// Extending Casper functions for dumpSteps()

/**
 * Dump Navigation Steps for debugging
 * When you call this function, you cat get current all information about CasperJS Navigation Steps
 * This is compatible with label() and goto() functions already.
 *
 * @param   Boolen   showSource    showing the source code in the navigation step?
 *
 * All step No. display is (steps array index + 1),  in order to accord with logging [info] messages.
 *
 */
casper.dumpSteps = function dumpSteps( showSource ) {
  this.echo( "=========================== Dump Navigation Steps ==============================", "RED_BAR");
  if( this.current ){ this.echo( "Current step No. = " + (this.current+1) , "INFO"); }
  this.echo( "Next    step No. = " + (this.step+1) , "INFO");
  this.echo( "steps.length = " + this.steps.length , "INFO");
  this.echo( "================================================================================", "WARNING" );

  for( var i=0; i<this.steps.length; i++){
    var step  = this.steps[i];
    var msg   = "Step: " + (i+1) + "/" + this.steps.length + "     level: " + step.level
    if( step.executed ){ msg = msg + "     executed: " + step.executed }
    var color = "PARAMETER";
    if( step.label    ){ color="INFO"; msg = msg + "     label: " + step.label }

    if( i == this.current ) {
      this.echo( msg + "     <====== Current Navigation Step.", "COMMENT");
    } else {
      this.echo( msg, color );
    }
    if( showSource ) {
      this.echo( "--------------------------------------------------------------------------------" );
      this.echo( this.steps[i] );
      this.echo( "================================================================================", "WARNING" );
    }
  }
};

// End of Extending Casper functions for dumpSteps()
//================================================================================
//================================================================================


function dateToMDY(date) {
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    return '' + (m<=9 ? '0' + m : m) + '/' + (d <= 9 ? '0' + d : d) + '/' + y;
}

// United makes extensive use of cookies, enable them.
phantom.cookiesEnabled = true;

casper.start();

casper.label("LOOP_START");

casper.thenOpen('http://www.united.com/web/en-US/apps/booking/flight/searchOW.aspx?CS=N', function() {
	// fill in form
    this.fill('form#aspnetForm', 
			  { ctl00$ContentInfo$SearchForm$Airports1$Origin$txtOrigin: origin,
				ctl00$ContentInfo$SearchForm$Airports1$Destination$txtDestination: destination,
				ctl00$ContentInfo$SearchForm$DateTimeCabin1$Depdate$txtDptDate: dateToMDY(current),
				ctl00$ContentInfo$SearchForm$Opupg$chkOPUpg: true
				},
			  false);
	this.click('#ctl00_ContentInfo_SearchForm_searchbutton');
});

casper.then(function() {
	this.fill('form#aspnetForm', 
			  { 'ctl00$ContentInfo$ShowTrips$ShowTrip$ctl00$chkUpgrade': true },
			  false);
	this.click('#ctl00_ContentInfo_continuebutton');
});

casper.then(function() {
	flights = this.evaluate(function(current_date) {
		var f = [];
		$("td.tdSegmentBlock").each(function (i, v) {
			var errors = $(v).find('.tdEquipMsg');
			if (errors.length == 0) {
				var f_local = {
					price: -1,
					segments: [],
					depart_time: [],
					arrive_time: [],
					departure: [],
					arrival: [],
					date: current_date,
				};
				var segments = [];
				$(v).find('.fResultsPrice').each(function (iter, val) {
					if (iter == 0) {
						f_local.price = $(val).text();
					}
				});
				$(v).find('.timeDepart').each(function (iter, val) {
					f_local.depart_time.push($(val).text());
				});
				$(v).find('.timeArrive').each(function (iter, val) {
					f_local.arrive_time.push($(val).text());
				});
				$(v).find('.tdDepart').each(function (j, row) {
					$(row).children().each(function (iter, val) {
						if (iter == 3) {
							f_local.departure.push($(val).text());
						}
					});
				});
				$(v).find('.tdArrive').each(function (j, row) {
					$(row).children().each(function (iter, val) {
						if (iter == 3) {
							f_local.arrival.push($(val).text());
						}
					});
				});
				$(v).find('.tdSegmentDtl').each(function (iter, val) {
					$(val).children().each(function(j, w) {
						if (j == 0) {
							f_local.segments.push($(w).text().replace('Flight: ',''));
						}
					});
				});
				f.push(f_local);
			}
		});
		return f;
	}, dateToMDY(current));
});

casper.then(function() {
	if (flights.length == 0) {
		if ((csv == false) && (json == false)) {
			this.echo(colorizer.colorize(dateToMDY(current), "WARNING"))
		}
	} else{
		if (csv == true) {
			// format CSV results for up to 3 flight segments
			for (var i=0; i < flights.length; i++) {
				var output = '' + dateToMDY(current) + ',"' + flights[i].price + '"';
				for (var j=0; j < 3; j++) {
					if (typeof(flights[i].segments[j]) === "undefined") {
						output += ',,,,,';
					}
					else {
						output += ',' + flights[i].segments[j] + ',';
 						output += '"' + flights[i].departure[j] + '",';
						output += flights[i].depart_time[j] + ',';
						output += '"' + flights[i].arrival[j] + '",';
						output += flights[i].arrive_time[j];
					}
				}
				this.echo(output);
			}
		} else if (json == true) {
			// JSONify
			if (current != start) {
				this.echo(",");
			}
			this.echo(JSON.stringify(flights));
		} else {
			// Human readable output
			this.echo(colorizer.colorize(dateToMDY(current), "INFO"))
			for (var i=0; i < flights.length; i++) {
				this.echo(flights[i].price);
				for (var j=0; j < flights[i].segments.length; j++) {
					this.echo(flights[i].segments[j] + ' ' + flights[i].depart_time[j] + ' > ' + flights[i].arrive_time[j]);
					this.echo(flights[i].departure[j] + ' > ' + flights[i].arrival[j]);
				}
				this.echo('------------------------------');
			}
		}
	}
});

casper.then(function() {
	current = new Date(current.getTime() + 86400000);
    if( current.getTime() <= end.getTime() ){ this.goto( "LOOP_START" ); } 
});

casper.run(function() {
	if (json == true) {
		this.echo(']');
	}
	this.exit();
});
