var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var Promise = require('promise');
var app = express();
app.set('port', (process.env.PORT || 5000));


var MARET_URL_BASE = "http://www.maret.org";
var UPPER_SCHOOL_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School";
var ATHLETICS_CALENDAR_URL = "http://www.maret.org/athletics-center/index.aspx";

// All the teams we care about, stored as a mapping of a TeamID (used
// by the Maret athletics page) to team name.  If we find an athletic
// event with another TeamID, it's ignored.  Also helps protect against
// typos screwing up our event categorization.
var TEAM_NAMES = [];
TEAM_NAMES[1185] = "Cross Country";
TEAM_NAMES[1199] = "Varsity Football";
TEAM_NAMES[1200] = "JV Football";
TEAM_NAMES[1186] = "Varsity Golf";
TEAM_NAMES[1208] = "Boys' Varsity Soccer";
TEAM_NAMES[1224] = "Girls' Varsity Soccer";
TEAM_NAMES[1209] = "Boys' JV Soccer";
TEAM_NAMES[1225] = "Girls' JV Soccer";
TEAM_NAMES[1233] = "Girls' Varsity Tennis";
TEAM_NAMES[1234] = "Varsity Volleyball";
TEAM_NAMES[1235] = "JV Volleyball";
TEAM_NAMES[1195] = "Basketball Boys (Varsity)";
TEAM_NAMES[1216] = "Basketball Girls (Varsity)";
TEAM_NAMES[1196] = "Basketball Boys (Junior Varsity)";
TEAM_NAMES[1217] = "Basketball Girls (Junior Varsity)";
TEAM_NAMES[1187] = "Swimming Coed (Varsity)";
TEAM_NAMES[1232] = "Swimming Girls (Varsity)";
TEAM_NAMES[1213] = "Wrestling Boys (Varsity)";
TEAM_NAMES[1191] = "Baseball Boys (Varsity)";
TEAM_NAMES[1192] = "JV Baseball";
TEAM_NAMES[1203] = "Boys' Varsity Lacrosse";
TEAM_NAMES[1220] = "Girls' Varsity Lacrosse";
TEAM_NAMES[1204] = "Boys' JV Lacrosse";
TEAM_NAMES[1221] = "Girls' JV Lacrosse";
TEAM_NAMES[1228] = "Varsity Softball";
TEAM_NAMES[1229] = "JV Softball";
TEAM_NAMES[1212] = "Boys' Varsity Tennis";
TEAM_NAMES[1188] = "Varsity Track";
TEAM_NAMES[1189] = "Ultimate Frisbee";


/* ENDPOINT: /scrape
--------------------------
Scrapes the Maret mobile site displaying the Upper School and Athletics
calendars, and responds with the parsed calendar data as JSON.  The format is as follows:

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
    "gameName": null,
    "maretTeam": "Girls' Varsity Soccer",
    "opponent": "Potomac School",
    "gameTime": "3:00pm",
    "dismissalTime": "2:00pm",
    "returnTime": "5:00pm",
    "isHome": false,
    "gameAddress": "1301 Potomac School Road, McLean, VA 22101"
    "gameLocation": null
}

maretTeam and isHome are guaranteed to be non-null.  gameAddress is a mappable address.
gameLocation is only the name of a place (e.g. Jelleff).  Note that isHome can be 
true and there can be a non-null gameLocation and gameAddress if the game is 
played at a home facility besides the main school campus.  gameName is the special 
name for this event (if any - most games will not have one, but some, such as 
cross country meets, have names like "Landon Invitational".)

Upper School calendar events have the format:

{
    "eventName": "US Leadership Workshop",
    "eventStartTime": "6:00pm",
    "eventEndTime": "7:30pm",
    "eventLocation": "Theatre,Theatre Lobby"
}

Note that only the eventName field is guaranteed to be non-null.
--------------------------
*/
app.get('/scrapeCalendars', function(req, res) {

    // Scrape both the upper school and athletics calendars, and send back the parsed data
    var upperSchoolCalendarPromise = scrapeMaretCalendar(UPPER_SCHOOL_CALENDAR_URL, scrapeUpperSchoolCalendarDay);
    var athleticsCalendarPromise = scrapeMaretCalendar(ATHLETICS_CALENDAR_URL, scrapeAthleticsCalendarDay);

    Promise.all([upperSchoolCalendarPromise, athleticsCalendarPromise]).then(function(response) {
        var upperSchoolCalendarData = response[0];
        var athleticsCalendarData = response[1];

        res.json({
            "Upper School": upperSchoolCalendarData,
            "Athletics": athleticsCalendarData
        });
    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });  
});


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


/* FUNCTION: scrapeMaretCalendar
----------------------------------------
Parameters:
    calendarURL - URL of the Maret calendar page to scrape
    scrapeCalendarDay - function that takes a Cheerio DOM element representing
                        a single calendar day, and the Cheerio DOM parser for
                        the page, and returns a JS object containing all the
                        day information.

Returns: a promise passing back the JS representation of the given calendar.

Scrapes the HTML from the given calendar page, and passes back (via promise) 
the JS representation.  The format consists of an array containing a dictionary 
for each day's events.  The JS dictonary format for each day is defined by the 
scrapeCalendarDay function.
----------------------------------------
*/
function scrapeMaretCalendar(calendarURL, scrapeCalendarDay) {
    return getHTMLForURL(calendarURL).then(function(html) {
        var $ = cheerio.load(html);

        var promise = Promise.resolve();

        // Gather up event data for each day
        var dayList = [];
        $('.calendar-day').each(function(index, elem) {
            var savedThis = this;
            promise = promise.then(function() {
                return scrapeCalendarDay($(savedThis), $);
            }).then(function(calendarDayInfo) {
                dayList.push(calendarDayInfo);
                return dayList;
            });
        });

        return promise;
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

The JS dictonary format for each event is defined by the return value of
the scrapeUpperSchoolCalendarEvent function.
--------------------------------------
*/
function scrapeUpperSchoolCalendarDay(calendarDay, $) {

    // Make the JSON object for this day (list of events,
    // and date information that's added later)
    var calendarDayInfo = {
        events: []
    };

    var promise = Promise.resolve();

    calendarDay.find("li").each(function(i, elem) {
        var savedThis = this;
        var li = $(savedThis);
        // First elem is date header
        if (i == 0) {
            calendarDayInfo.month = li.find(".month").text().trim();
            calendarDayInfo.date = parseInt(li.find(".date").text());
            calendarDayInfo.day = li.text().split(" - ")[1];
            calendarDayInfo.year = parseInt(li.find(".year").text());

        // Otherwise, call the given event parser to generate a dictionary
        } else {
            promise = promise.then(function() {
                return scrapeUpperSchoolCalendarEvent(li, $);
            }).then(function(eventInfo) {
                calendarDayInfo.events.push(eventInfo);
                return calendarDayInfo;
            });
        }
    });

    return promise;
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
    "eventStartTime": "6:00pm",
    "eventEndTime": "7:30pm",
    "eventLocation": "Theatre,Theatre Lobby"
}

The start time, end time, and event location are optional and may be null.
-----------------------------
*/
function scrapeUpperSchoolCalendarEvent(calendarEvent, $) {

    var eventInfo = {
        eventName: calendarEvent.find("h3").text().trim(),
        eventStartTime: null,
        eventEndTime: null,
        eventLocation: null
    }

    // If there's an h6 header, that contains the start, end,
    // and location of the event.  Eg. "3:30pm - 4:30pm - Old Gym"
    var eventInfoArray = calendarEvent.find("h6").text().split(" - ");
    if (eventInfoArray.length == 3) {
        eventInfo.eventStartTime = eventInfoArray[0].trim();
        eventInfo.eventEndTime = eventInfoArray[1].trim();
        eventInfo.eventLocation = eventInfoArray[2].trim(); 
    }

    return eventInfo;
}


/* FUNCTION: scrapeAthleticsCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element for a single day in the Athletics calendar.
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

The JS dictonary format for each event is defined by the return value of
the scrapeAthleticsCalendarEvent function.  Because of the way dates are
displayed, we're not able to get the full date from the calendar day itself.  
Instead, we have to get the date out of scraping a calendar event.
--------------------------------------
*/
function scrapeAthleticsCalendarDay(calendarDay, $) {

    // Make the JSON object for this day (list of events,
    // and date information that's added later)
    var calendarDayInfo = {
        events: []
    };

    var promise = Promise.resolve();

    calendarDay.find("dd").each(function(i, elem) {
        var savedThis = this;
        var dd = $(savedThis);

        // If this event's been cancelled, ignore it
        var cancelledString = $(dd.find("h4 .cancelled")[0]).text().trim();
        if (cancelledString !== "") return;
        
        promise = promise.then(function() {
            return scrapeAthleticsCalendarEvent(dd, $);
        }).then(function(info) {
            // If it's non-null, then we should add it to our list
            if (info) {

                // Unpack the JS objects containing info
                var eventInfo = info.eventInfo;
                calendarDayInfo.events.push(eventInfo);

                // If we haven't added the date yet, add it
                if (!calendarDayInfo.month) {
                    var dateInfo = info.dateInfo;
                    calendarDayInfo.month = dateInfo.month;
                    calendarDayInfo.date = dateInfo.date;
                    calendarDayInfo.day = dateInfo.day;
                    calendarDayInfo.year = dateInfo.year;
                }
            }

            // This is only needed for the last promise in the chain,
            // but it's an easy way to guarantee that the promise returned
            // at the end of this function passes back the calendarDayInfo.
            return calendarDayInfo;
        });
    });

    return promise;
}


/* FUNCTION: scrapeAthleticsCalendarEvent
----------------------------------------
Parameters:
    calendarEvent - the DOM element representing a single calendar event from
                the Athletics calendar.
    $ - the Cheerio object to use to traverse this DOM

Returns: a JSON representation of the information about this event.
        The JSON returned has the format:

{
    "eventInfo": {
        "gameName": null,
        "maretTeam": "Girls' Varsity Soccer",
        "opponent": "Potomac School",
        "gameTime": "3:00pm",
        "dismissalTime": "2:00pm",
        "returnTime": "5:00pm",
        "isHome": false,
        "gameAddress": "1301 Potomac School Road, McLean, VA 22101"
        "gameLocation": null
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
guaranteed non-null.  For the eventInfo, maretTeam and isHome are guaranteed 
to be non-null.  gameAddress is a mappable address.  gameLocation is only the name 
of a place (e.g. Jelleff).  Note that isHome can be true and there can be a non-null 
gameLocation and gameAddress if the game is played at a home facility besides the 
main school campus.  gameName is the special name for this event (if any - most games
will not have one, but some, such as cross country meets, have names like "Landon
Invitational".)
-----------------------------------------
*/
function scrapeAthleticsCalendarEvent(calendarEvent, $) {

    var detailPageURL = calendarEvent.find("a").attr("href");

    // Get the rest of the info from the detail page
    return getHTMLForURL(MARET_URL_BASE + detailPageURL).then(function(html) {

        var info = {
            eventInfo: {
                gameName: null,
                maretTeam: null,
                opponent: null,
                gameTime: null,
                dismissalTime: null,
                returnTime:null,
                isHome: calendarEvent.hasClass("home"),
                gameLocation: null,
                gameAddress: null
            },
            dateInfo: {
                month: null,
                date: null,
                day: null,
                year: null
            }
        }

        // Use the teamID in the URL to get the team name
        var teamID = parseInt(detailPageURL.split("TeamID=")[1]);
        if (TEAM_NAMES[teamID]) info.eventInfo.maretTeam = TEAM_NAMES[teamID];
        else return null;

        $ = cheerio.load(html);

        // Parse the full date string (e.g. "Thursday, September 10, 2015")
        var dateString = $(".calendar-detail .date").text().trim();
        var dateComponents = dateString.split(" ");
        info.dateInfo.day = dateComponents[0].substr(0, dateComponents[0].length - 1);
        info.dateInfo.month = dateComponents[1];
        info.dateInfo.date = parseInt(dateComponents[2].substr(0, dateComponents[2].length - 1));
        info.dateInfo.year = parseInt(dateComponents[3]);

        // "Varsity Golf vs. Potomac School"
        var gameTitle = $(".calendar-detail h1").text().trim();
        console.log(gameTitle);

        // Parse the team names
        var teamNames;
        if (gameTitle.indexOf(" vs. ") != -1) {
            teamNames = gameTitle.split(" vs. ");
        } else if (gameTitle.indexOf(" at ") != -1) {
            teamNames = gameTitle.split(" at ");
        } else if (gameTitle.indexOf(" - ") != -1) {

            // If there's a dash, the first item is the Maret team, the second is the
            // event name
            var dashComponents = gameTitle.split(" - ");
            teamNames = [dashComponents[0]];
            info.eventInfo.gameName = dashComponents[1].trim();
        }

        // If there's an opponent listed, include it.  Watch out for the case
        // with the "at Jelleff Field" or something similar attached to the end
        if (teamNames.length > 1 && teamNames[1].indexOf(" at ") == -1) {
            info.eventInfo.opponent = teamNames[1].trim();
            if (!info.eventInfo.isHome) info.eventInfo.gameLocation = info.eventInfo.opponent;
        } else if (teamNames.length > 1) {
            var opponentAndLocationArray = teamNames[1].split(" at ");
            info.eventInfo.opponent = opponentAndLocationArray[0].trim();
            info.eventInfo.gameLocation = opponentAndLocationArray[1].trim();
        }

        // Parse the game time string ("Time: 4:00PM")
        var timeString = $(".calendar-detail .time").text().trim();
        if (timeString != "") {
            info.eventInfo.gameTime = timeString.split("Time:")[1].trim().toLowerCase();
        }

        // Parse the dismissal time string ("Dismissal: 2:40PM")
        var dismissalString = $(".calendar-detail .dismissal").text().trim();
        if (dismissalString != "") {
            info.eventInfo.dismissalTime = dismissalString.split("Dismissal:")[1].trim().toLowerCase();
        }

        // Parse the return time string ("Return: 6:00PM")
        var returnString = $(".calendar-detail .return").text().trim();
        if (returnString != "") {
            info.eventInfo.returnTime = returnString.split("Return:")[1].trim().toLowerCase();
        }

        // If there's an address field, scrape the address
        var addressString = $(".calendar-detail address").text().trim();
        if (addressString != "") {
            info.eventInfo.gameAddress = addressString;
        }

        return info;
    });
}


// Start the server
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});