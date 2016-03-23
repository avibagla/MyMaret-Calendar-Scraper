var scraper = require('../scraper.js');
var testUtil = require('./testUtil.js');


var testCalendars = {
    UpperSchool: {
        htmlFilename: "./files/calendars/uscalendar.html",
        jsonFilename: "./files/calendars/uscalendar.json"
    },
    MiddleSchool: {
        htmlFilename: "./files/calendars/mscalendar.html",
        jsonFilename: "./files/calendars/mscalendar.json"
    },
    LowerSchool: {
        htmlFilename: "./files/calendars/lscalendar.html",
        jsonFilename: "./files/calendars/lscalendar.json"
    }
};

var testCalendarEvents = {
    Basic: {
        htmlFilename: "./files/calendarEvents/basic.html",
        jsonFilename: "./files/calendarEvents/basic.json"
    },
    Normal: {
        htmlFilename: "./files/calendarEvents/normal.html",
        jsonFilename: "./files/calendarEvents/normal.json"
    },
    Thru: {
        htmlFilename: "./files/calendarEvents/thru.html",
        jsonFilename: "./files/calendarEvents/thru.json"
    },
    StartTime: {
        htmlFilename: "./files/calendarEvents/startTime.html",
        jsonFilename: "./files/calendarEvents/startTime.json"
    },
    StartTimeLocation: {
        htmlFilename: "./files/calendarEvents/startTimeLocation.html",
        jsonFilename: "./files/calendarEvents/startTimeLocation.json"
    },
    NoLocation: {
        htmlFilename: "./files/calendarEvents/noLocation.html",
        jsonFilename: "./files/calendarEvents/noLocation.json"
    }
};

var testCalendarDays = {
    Normal: {
        htmlFilename: "./files/calendarDays/normal.html",
        jsonFilename: "./files/calendarDays/normal.json"
    },
    ExtraSpaces: {
        htmlFilename: "./files/calendarDays/extraSpace.html",
        jsonFilename: "./files/calendarDays/extraSpace.json"
    }
};


/* FUNCTION: run
-------------------
Parameters: NA
Returns: NA

Runs all tests for the school calendar scraper, including tests for scraping
individual events, days, and full calendars.
-------------------
*/
module.exports.run = function() {

    /* Tests for scraping a single school calendar event.  Includes
     * tests for different structures of events.
     */
    describe('scrapeSchoolCalendarEvent', function() {
        testUtil.runTestCases(testCalendarEvents, "Scrape Calendar Event: ",
            scraper.scrapeSchoolCalendarEvent);
    });


    /* Tests for scraping a single calendar day.  Includes a normal test
     * and a test for extra spacing around date information.
     */
     describe('scrapeSchoolCalendarDay', function() {
        testUtil.runTestCases(testCalendarDays, "Scrape Calendar Day: ",
            scraper.scrapeSchoolCalendarDay);
     });


    /* Tests for the main school calendar scraper.  Tests scraping saved
     * webpages of school calendars and checking them against a hand-scraped JSON
     * file.
     */
    describe('scrapeSchoolCalendar', function() {
        testUtil.runTestCases(testCalendars, "Scrape Calendar: ",
            scraper.scrapeSchoolCalendar);
    });
}

