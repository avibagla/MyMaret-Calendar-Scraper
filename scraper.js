var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var Promise = require('promise');
var app = express();
app.set('port', (process.env.PORT || 5000));


var MARET_URL_BASE = "http://www.maret.org";
var UPPER_SCHOOL_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School";
var ATHLETICS_CALENDAR_URL = "http://www.maret.org/athletics-center/index.aspx";

var PARSE_CONFIG_URL = "https://" + process.env.PARSE_APP_ID + ":javascript-key=" + 
                        process.env.PARSE_JAVASCRIPT_KEY + "@api.parse.com/1/config";



/* ENDPOINT: /scrape
--------------------------
A scraper for the Maret Upper School and athletics calendar sites. 
Responds with the parsed calendar data as JSON.  The format is as follows:

{
    "Upper School": [
        ...
    ],
    "Athletics": [
        ...
    ]
}

Values are arrays of day dictionaries, where each day dictionary has the format:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

Each day dictionary has an array of event dictionaries, where the event dictionary format
depends on the calendar the event is from.  Athletic events have the format:

{
    "eventID": 12543,
    "eventName": null,
    "maretTeam": "Girls' Varsity Soccer",
    "maretTeamID": 12542,
    "opponent": "Froggie School",
    "startTime": "3:00 PM",
    "dismissalTime": "2:00 PM",
    "returnTime": "5:00 PM",
    "isHome": false,
    "eventAddress": "1254 Lakeside Dr. Potomac, MD 20156"
    "eventLocation": null
}

eventID, maretTeam, maretTeamID and isHome are guaranteed to be non-null.  eventID is a unique ID.
eventAddress is a mappable address.  eventLocation is only the name of a place.  
Note that isHome can be true and there can be a non-null eventLocation and eventAddress 
if the game is played at a home facility besides the main school campus.  
eventName is the special name for this event (if any - most games will not have one, 
but some, such as cross country meets, have names like "Cross Country Invitational".)

Upper School calendar events have the format:

{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00 PM",
    "endTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}

Note that only the eventName field is guaranteed to be non-null.  Both calendars are fetched
in parallel.
--------------------------
*/
app.get('/scrapeCalendars', function(req, res) {

    console.log("----- Got request for scraping calendars ------");

    getURL(PARSE_CONFIG_URL).then(function(responseText) {
        var config = JSON.parse(responseText);
        return config.params.ATHLETICS_TEAMS;
    }).then(function(ATHLETICS_TEAMS) {

        // Scrape both the upper school and athletics calendars, and send back the parsed data
        var upperSchoolCalendarPromise = scrapeMaretCalendar(UPPER_SCHOOL_CALENDAR_URL, scrapeUpperSchoolCalendarDay);
        var athleticsCalendarPromise = scrapeMaretCalendar(ATHLETICS_CALENDAR_URL, scrapeAthleticsCalendarDay, ATHLETICS_TEAMS);

        return Promise.all([upperSchoolCalendarPromise, athleticsCalendarPromise]).then(function(response) {
            var upperSchoolCalendarData = response[0];
            var athleticsCalendarData = response[1];

            console.log("----- Finished scraping calendars -----");

            res.json({
                "Upper School": upperSchoolCalendarData,
                "Athletics": athleticsCalendarData
            });
        });

    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });  
});


/* FUNCTION: getURL
--------------------------
Parameters:
    url - the url to GET

Returns: a promise containing the GET response from the given url

Uses 'request' within a promise.  If there's an error, the
error will be passed back in a promise.  Otherwise, the response
is passed back.
--------------------------
*/
function getURL(url) {
    return new Promise(function(resolve, reject) {
        request(url, function(error, response, body) {
            if(error) reject(error);
            else resolve(body);
        });
    });
}


/* FUNCTION: scrapeMaretCalendar
----------------------------------------
Parameters:
    calendarURL - URL of the Maret calendar page to scrape
    scrapeCalendarDay - function that takes a Cheerio DOM element representing
                        a single calendar day, and the Cheerio DOM parser for
                        the page, and returns a JS object containing all the
                        day information.
    ATHLETICS_TEAMS - optional - if non-null, passed as the 3rd param to the
                scrapeCalendarDay function.  A map from teamID to team name 
                used for parsing athletics events.

Returns: a promise passing back the JS representation of the given calendar.

Scrapes the HTML from the given calendar page, and passes back (via promise) 
the JS representation.  The format consists of an array containing a dictionary 
for each day's events.  The JS dictonary format for each day is defined by the 
scrapeCalendarDay function.  All days are fetched in parallel.
----------------------------------------
*/
function scrapeMaretCalendar(calendarURL, scrapeCalendarDay, ATHLETICS_TEAMS) {

    return getURL(calendarURL).then(function(html) {
        console.log("Scraping calendar at URL: " + calendarURL);

        var $ = cheerio.load(html);

        // Gather up event data for each day in parallel
        var promises = [];
        $('.calendar-day').each(function(index, elem) {
            var savedThis = this;

            // Pass along the team names dictionary if there is one
            var newPromise = ATHLETICS_TEAMS ? scrapeCalendarDay($(savedThis), $, ATHLETICS_TEAMS) : 
                            scrapeCalendarDay($(savedThis), $);
            newPromise = newPromise.then(function(calendarDayInfo) {
                console.log("Scraped day " + index);
                return calendarDayInfo;
            });
            promises.push(newPromise);
        });

        return Promise.all(promises);
    });
}


/* FUNCTION: scrapeUpperSchoolCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element for a single day in the Upper School calendar.
    $ - the Cheerio object to use to traverse this DOM

Returns: a promise passing along the JS representation of this day.  The data
        format is as follows:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

The JS dictonary format for each event is defined by
the scrapeUpperSchoolCalendarEvent function.
--------------------------------------
*/
function scrapeUpperSchoolCalendarDay(calendarDay, $) {

    // Make the JSON object for this day (list of events,
    // and date information that's added later)
    var calendarDayInfo = {
        month: null,
        date: null,
        day: null,
        year: null,
        events: []
    };

    var promises = [];
    calendarDay.find("li").each(function(i, elem) {
        var savedThis = this;
        var li = $(savedThis);

        // First elem is date header
        if(i == 0) {
            calendarDayInfo.month = li.find(".month").text().trim();
            calendarDayInfo.date = parseInt(li.find(".date").text());
            calendarDayInfo.day = li.text().split(" - ")[1];
            calendarDayInfo.year = parseInt(li.find(".year").text());

        // Otherwise, call the given event parser to generate a dictionary
        } else {
            promises.push(scrapeUpperSchoolCalendarEvent(li, $));
        }
    });

    return Promise.all(promises).then(function(eventsInfo) {
        calendarDayInfo.events = eventsInfo;
        return calendarDayInfo;
    });
}


/* FUNCTION: scrapeUpperSchoolCalendarEvent
------------------------------
Parameters:
    calendarEvent - the DOM element representing a single calendar event from
                    the Upper School calendar.
    $ - the Cheerio object to use to traverse this DOM

Returns: a JS representation of the information about this event.
        The dictionary returned has the format:

{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00pm",
    "endTime": "7:30pm",
    "eventLocation": "Theatre,Theatre Lobby"
}

Only the eventName field is guaranteed to be non-null.
-----------------------------
*/
function scrapeUpperSchoolCalendarEvent(calendarEvent, $) {

    var eventInfo = {
        eventName: null,
        startTime: null,
        endTime: null,
        eventLocation: null
    }

    // h6 header containing event time and location Eg. "3:30pm - 4:30pm - Old Gym"
    var h6SearchResults = calendarEvent.find("h6");
    var h6EventInfo = h6SearchResults.length > 0 ? $(h6SearchResults[0]) : undefined;

    // If there's an h6 header, parse the event info
    var eventInfoArray = h6EventInfo ? h6EventInfo.text().split(" - ") : [];
    if(eventInfoArray.length == 3) {

        // Convert the start time ("3:00pm") to the format "3:00 PM"
        var startTime = eventInfoArray[0].trim().toUpperCase();
        eventInfo.startTime = startTime.substring(0, startTime.length - 2) + " " + 
            startTime.substring(startTime.length - 2);

        // Convert the end time ("3:00pm") to the format "3:00 PM"
        var endTime = eventInfoArray[1].trim().toUpperCase();
        eventInfo.endTime = endTime.substring(0, endTime.length - 2) + " " + 
            endTime.substring(endTime.length - 2);

        eventInfo.eventLocation = eventInfoArray[2].trim(); 
    }

    // See if this is a linked event (with an <a> tag) or not (just <h3> and <h6> tags)
    var linkSearchResults = calendarEvent.find("a");
    var link = linkSearchResults.length > 0 ? $(linkSearchResults[0]) : undefined;
    if(link && h6EventInfo) {
        // Event name is the full link text minus the event time/location
        eventInfo.eventName = link.text().split(h6EventInfo.text())[0].trim();
    } else if(link) {
        eventInfo.eventName = link.text().trim();
    } else {
        eventInfo.eventName = $(calendarEvent.find("h3")[0]).text().trim();
    }

    console.log("Scraping Upper School event: " + eventInfo.eventName);

    return eventInfo;
}


/* FUNCTION: scrapeAthleticsCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element for a single day in the Athletics calendar.
    $ - the Cheerio object to use to traverse this DOM
    ATHLETICS_TEAMS - the map of teamID strings to team names.

Returns: a promise passing along the JS representation of this day.  The data
        format is as follows:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

The JS dictonary format for each event is defined by the return value of
the scrapeAthleticsCalendarEvent function.  Because of the way dates are
displayed, we're not able to get the full date from the calendar day itself.  
Instead, we have to get the date out of scraping a calendar event.  All events
within a given day are scraped in parallel.
--------------------------------------
*/
function scrapeAthleticsCalendarDay(calendarDay, $, ATHLETICS_TEAMS) {

    // Make the JSON object for this day (list of events,
    // and date information that's added later)
    var calendarDayInfo = {
        month: null,
        date: null,
        day: null,
        year: null,
        events: []
    };

    var promises = [];

    calendarDay.find("dd").each(function(i, elem) {
        var savedThis = this;
        var dd = $(savedThis);

        // If this event's been cancelled, ignore it
        var cancelledString = $(dd.find("h4 .cancelled")[0]).text().trim();
        if(cancelledString !== "") return;

        promises.push(scrapeAthleticsCalendarEvent(dd, $, ATHLETICS_TEAMS));
    });

    return Promise.all(promises).then(function(eventsInfo) {
        eventsInfo.forEach(function(info) {

            // If it's non-null, then we should add it to our list
            if(info) {

                // Unpack the JS objects containing info
                var eventInfo = info.eventInfo;
                calendarDayInfo.events.push(eventInfo);

                // If we haven't added the date yet, add it
                if(!calendarDayInfo.month) {
                    var dateInfo = info.dateInfo;
                    calendarDayInfo.month = dateInfo.month;
                    calendarDayInfo.date = dateInfo.date;
                    calendarDayInfo.day = dateInfo.day;
                    calendarDayInfo.year = dateInfo.year;
                }
            }
        });

        return calendarDayInfo;
    });
}


/* FUNCTION: scrapeAthleticsCalendarEvent
----------------------------------------
Parameters:
    calendarEvent - the DOM element representing a single calendar event from
                the Athletics calendar.
    $ - the Cheerio object to use to traverse this DOM
    ATHLETICS_TEAMS - a dictionary of teamID (string) to team name (string).  Used to
                look up team names and make sure we scrape only the right events.

Returns: a JSON representation of the information about this event.
        The JSON returned has the format:

{
    "eventInfo": {
        "eventID": 12546,
        "eventName": null,
        "maretTeam": "Girls' Varsity Soccer",
        "maretTeamID": 52235,
        "opponent": "Froggie School",
        "startTime": "3:00 PM",
        "dismissalTime": "2:00 PM",
        "returnTime": "5:00 PM",
        "isHome": false,
        "eventAddress": "1254 Lakeside Dr. Potomac, MD 20152"
        "eventLocation": null
    },
    "dateInfo": {
        "month": "September",
        "date": 25,
        "day": "Friday",
        "year": 2015
    }
}

We return two objects - one containing information about the game itself, and 
the other about the date on which it occurs (because the full date information is 
only available on the event detail page).  For the dateInfo, all fields are 
guaranteed non-null.  For the eventInfo, eventID, maretTeam, maretTeamID and isHome are guaranteed 
to be non-null.  eventID is a unique ID.  eventAddress is a mappable address.  
eventLocation is only the name of a place (e.g. Jelleff).  Note that isHome can be 
true with a non-null eventLocation and eventAddress if the game is played at a home 
facility besides the main school campus.  eventName is the special name for this 
event (if any - most games will not have one, but some, such as cross country meets, 
have names like "Cross Country Invitational".)
-----------------------------------------
*/
function scrapeAthleticsCalendarEvent(calendarEvent, $, ATHLETICS_TEAMS) {

    var info = {
        eventInfo: {
            eventID: null,
            eventName: null,
            maretTeam: null,
            maretTeamID: null,
            opponent: null,
            startTime: null,
            dismissalTime: null,
            returnTime:null,
            isHome: calendarEvent.hasClass("home"),
            eventLocation: null,
            eventAddress: null
        },
        dateInfo: {
            month: null,
            date: null,
            day: null,
            year: null
        }
    }

    var detailPageURL = calendarEvent.find("a").attr("href");

    // Use the teamID in the URL to get the team name - 
    // and return if we don't know the team
    var teamID = parseInt(getParameterByName(detailPageURL, "TeamID"));
    if(ATHLETICS_TEAMS[teamID]) {
        info.eventInfo.maretTeam = ATHLETICS_TEAMS[teamID];
        info.eventInfo.maretTeamID = teamID;
    } else {
        return Promise.resolve();
    }

    // Get the eventID
    info.eventInfo.eventID = parseInt(getParameterByName(detailPageURL, "LinkID"));

    // Get the rest of the info from the detail page
    return getURL(MARET_URL_BASE + detailPageURL).then(function(html) {

        $ = cheerio.load(html);

        // Parse the full date string (e.g. "Thursday, September 10, 2015")
        var dateString = $(".calendar-detail .date").text().trim();
        var dateComponents = dateString.split(" ");
        info.dateInfo.day = dateComponents[0].substr(0, dateComponents[0].length - 1);
        info.dateInfo.month = dateComponents[1];
        info.dateInfo.date = parseInt(dateComponents[2].substr(0, dateComponents[2].length - 1));
        info.dateInfo.year = parseInt(dateComponents[3]);

        // e.g. "Varsity Golf vs. Potomac School"
        var gameTitleString = $(".calendar-detail h1").text().trim();
        console.log("Scraping athletics event: " + gameTitleString);

        // Check if there's a game location attached (e.g. "team at team at Wilson" or
        // "team vs. team at Wilson")
        var hasEventLocation = (gameTitleString.match(/ at /g) || []).length > 1;
        hasEventLocation = hasEventLocation || (gameTitleString.indexOf(" at ") != -1 && 
            gameTitleString.indexOf(" vs. ") != -1);

        // Parse the game title down to just the team names.  Check if there's a dash
        // (meaning there's an event name) or hasEventLocation is true
        if(gameTitleString.indexOf(" - ") != -1) {
            var dashComponents = gameTitleString.split(" - ");
            gameTitleString = dashComponents[0].trim();
            info.eventInfo.eventName = dashComponents[1].trim();
        } else if(hasEventLocation) {
            var atIndex = gameTitleString.lastIndexOf(" at ");
            info.eventInfo.eventLocation = gameTitleString.substring(atIndex + " at ".length).trim();
            gameTitleString = gameTitleString.substring(0, atIndex).trim();
        }

        // Parse the team names by splitting by " vs. " or " at "
        var teamNames;
        if(gameTitleString.indexOf(" vs. ") != -1) {
            teamNames = gameTitleString.split(" vs. ");
        } else if(gameTitleString.indexOf(" at ") != -1) {
            teamNames = gameTitleString.split(" at ");
        } else teamNames = [gameTitleString];

        // We get the Maret team name from the teamID, so we just need the opponent
        if(teamNames.length > 1) info.eventInfo.opponent = teamNames[1].trim();

        // Convert the game time string ("Time: 4:00PM") to "4:00 PM"
        var timeString = $(".calendar-detail .time").text().trim();
        if(timeString != "") {
            timeString = timeString.split("Time:")[1];

            // If it's a time range, just get the start time
            timeString = timeString.split(" - ")[0].trim();
            
            info.eventInfo.startTime = timeString.substring(0, timeString.length - 2) + " " +
                timeString.substring(timeString.length - 2);
        }

        // Convert the dismissal time string ("Dismissal: 2:40PM") to "2:40 PM"
        var dismissalString = $(".calendar-detail .dismissal").text().trim();
        if(dismissalString != "") {
            dismissalString = dismissalString.split("Dismissal:")[1].trim();
            info.eventInfo.dismissalTime = dismissalString.substring(0, dismissalString.length - 2) + " " +
                dismissalString.substring(dismissalString.length - 2);
        }

        // Convert the return time string ("Return: 6:00PM") to "6:00 PM"
        var returnString = $(".calendar-detail .return").text().trim();
        if(returnString != "") {
            returnString = returnString.split("Return:")[1].trim();
            info.eventInfo.returnTime = returnString.substring(0, returnString.length - 2) + " " +
                returnString.substring(returnString.length - 2);
        }

        // If there's an address field, scrape the address
        var addressString = $(".calendar-detail address").text().trim();
        if(addressString != "") {
            info.eventInfo.eventAddress = addressString;
        }

        return info;
    });
}


/* FUNCTION: getParameterByName
--------------------------------
Parameters:
    url - the url to search in
    name - the name of the URL parameter to get the value for

Returns: the value of the given parameter in the given url (returns null
        if the parameter wasn't found)

Thanks to http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
--------------------------------
*/
function getParameterByName(url, name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(url);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
}


// Start the server
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});