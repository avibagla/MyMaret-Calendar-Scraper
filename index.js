var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var Promise = require('promise');
var app = express();
app.set('port', (process.env.PORT || 5000));


var UPPER_SCHOOL_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School";


/* ENDPOINT: /scrape
--------------------------
Scrapes the Maret mobile site displaying the Upper School and Athletics
calendars, and responds with the parsed calendar data displayed.
--------------------------
*/
app.get('/scrapeCalendars', function(req, res) {

    // Scrape both the upper school and athletics calendars, and send back the parsed data
    Promise.all([scrapeUpperSchoolCalendar()]).then(function(response) {
        var upperSchoolCalendarData = response[0];
        
        res.json({
            "Upper School": upperSchoolCalendarData
        });
    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });  
});


/* FUNCTION: scrapeUpperSchoolCalendar
----------------------------------------
Parameters: NA
Returns: a promise passing back the JSON representation of the
        Upper School calendar data.

Scrapes the HTML from the Upper School calendar page, and passes
back (via promise) the JSON representation of the calendar.  The format
consists of an array containing a dictionary for each day's events.  The
JSON format for each day is as follows:

{
    "month": "September",
    "date": 9,
    "year": 2015,
    "day": "Wednesday",
    "events": [
        {
            "eventName": "US Photo Day"
            "eventStartTime": null,
            "eventEndTime": null,
            "eventLocation": null
        },
        {
            "eventName": "US Leadership Workshop",
            "eventStartTime": "6:00pm",
            "eventEndTime": "7:30pm",
            "eventLocation": "Theatre,Theatre Lobby"
        }
    ]
}
----------------------------------------
*/
function scrapeUpperSchoolCalendar() {
    return getHTMLForURL(UPPER_SCHOOL_CALENDAR_URL).then(function(html) {
        var $ = cheerio.load(html);

        // Gather up event data for each day
        var eventsData = [];
        $('.calendar-day').each(function(index, elem) {
            var calendarDay = $(this);
            eventsData.push(parseCalendarDay(calendarDay, $));
        });

        return eventsData;
    });
}


/* FUNCTION: parseCalendarDay
------------------------------
Parameters:
    calendarDay - the DOM element representing a single calendar day,
                and containing event information.
    $ - the Cheerio object to use to traverse this DOM

Returns: a JSON representation of the information about this day and
        all events on this day.  The JSON returned has the format:

{
    "month": "September",
    "date": 9,
    "year": 2015,
    "day": "Wednesday",
    "events": [
        {
            "eventName": "US Photo Day"
            "eventStartTime": null,
            "eventEndTime": null,
            "eventLocation": null
        },
        {
            "eventName": "US Leadership Workshop",
            "eventStartTime": "6:00pm",
            "eventEndTime": "7:30pm",
            "eventLocation": "Theatre,Theatre Lobby"
        }
    ]
}
-----------------------------
*/
function parseCalendarDay(calendarDay, $) {

    var calendarDayJSON = {
        events: []
    };

    calendarDay.find("li").each(function(i, elem) {
        var li = $(this);

        // First elem is date header
        if (i == 0) {
            calendarDayJSON.month = li.find(".month").text().trim();
            calendarDayJSON.date = parseInt(li.find(".date").text())
            calendarDayJSON.year = parseInt(li.find(".year").text());
            calendarDayJSON.day = li.text().split(" - ")[1];
        } else {

            // The rest are events
            var eventJSON = {
                eventName: li.find("h3").text().trim(),
                eventStartTime: null,
                eventEndTime: null,
                eventLocation: null
            }

            // If there's an h6 header, that contains the start, end,
            // and location of the event.  Eg. "3:30pm - 4:30pm - Old Gym"
            var eventInfoArray = li.find("h6").text().split(" - ");
            if (eventInfoArray.length == 3) {
                eventJSON.eventStartTime = eventInfoArray[0].trim();
                eventJSON.eventEndTime = eventInfoArray[1].trim();
                eventJSON.eventLocation = eventInfoArray[2].trim(); 
            }

            calendarDayJSON.events.push(eventJSON);
        }
    });

    return calendarDayJSON;
}


function scrapeAthleticsCalendar() {

}



/* FUNCTION: getHTMLForURL
--------------------------
Parameters:
    url - the url to GET the html for

Returns: a promise containing the HTML of the given url

Uses 'request' within a promise.  If there's an error, the
error will be passed back in a promise.  Otherwise, the html
is passed back.
--------------------------
*/
function getHTMLForURL(url) {
    return new Promise(function(resolve, reject) {
        request(url, function(error, response, html) {
            if (error) reject(error);
            else resolve(html);
        });
    });
}


// Start the server
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});