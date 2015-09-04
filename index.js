var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var Promise = require('promise');
var app = express();
app.set('port', (process.env.PORT || 5000));


var UPPER_SCHOOL_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School";
var ATHLETICS_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=126&t=Athletic%20Events";

var AWAY_TEAM_IDS = [1185, 1186]; // XC, Golf are always away


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
    "year": 2015,
    "day": "Wednesday",
    "events": [
        ...
    ]
}

Each day dictionary has an array of event dictionaries, where the event dictionary format
depends on the calendar the event is from.  Athletic events have the format:

{
    "maretTeam": "Girls' Varsity Soccer",
    "opponent": "Potomac School",
    "gameTime": "3:00pm",
    "isHome": false,
    "gameLocation": "1301 Potomac School Road, McLean, VA 22101"
    "hasAddress": true
}

Note that opponent, gameTime, gameLocation, and hasAdress may be null (if gameLocation is null,
indicating a standard home game, then hasAddress will also be null).  For off-campus games,
the game location can be an address (hasAddress is true) or a name of a place if 
there is no address provided (hasAddress is false).  Note that isHome can be true 
and there can be a non-null gameLocation if the game is played at a home facility 
besides the main school campus.  

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
    var upperSchoolCalendarPromise = scrapeMaretCalendar(UPPER_SCHOOL_CALENDAR_URL, parseUpperSchoolCalendarEvent);
    var athleticsCalendarPromise = scrapeMaretCalendar(ATHLETICS_CALENDAR_URL, parseAthleticsCalendarEvent);

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
    calendarURL - URL of the Maret calendar page to parse
    parseCalendarEvent - function that takes a Cheerio DOM element representing
                        a single calendar event, and the Cheerio DOM parser for
                        this page, and returns a JS object containing all the
                        event information.

Returns: a promise passing back the JS representation of the given calendar.

Scrapes the HTML from the given calendar page, and passes back (via promise) 
the JS representation.  The format consists of an array containing a dictionary 
for each day's events.  The JS dictonary format for each day is defined by the 
parseMaretCalendarDay function.
----------------------------------------
*/
function scrapeMaretCalendar(calendarURL, parseCalendarEvent) {
    return getHTMLForURL(calendarURL).then(function(html) {
        var $ = cheerio.load(html);

        var promise = Promise.resolve();

        // Gather up event data for each day
        var dayList = [];
        $('.calendar-day').each(function(index, elem) {
            var savedThis = this;
            promise = promise.then(function() {
                return parseMaretCalendarDay($(savedThis), $, parseCalendarEvent);
            }).then(function(calendarDayInfo) {
                dayList.push(calendarDayInfo);
                return dayList;
            });
        });

        return promise;
    });
}


/* FUNCTION: parseMaretCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element representing a single day in the calendar.
    $ - the Cheerio object to use to traverse this DOM
    parseCalendarEvent - function that takes a Cheerio DOM element representing
                        a single calendar event, and the Cheerio DOM parser for
                        this page, and returns a JS object containing all the
                        event information.

Returns: a promise passing along the JS representation of this day.  The data
        format is as follows:

{
    "month": "September",
    "date": 9,
    "year": 2015,
    "day": "Wednesday",
    "events": [
        ...
    ]
}

The JS dictonary format for each event is defined by the return value of
the given parseCalendarEvent function.
--------------------------------------
*/
function parseMaretCalendarDay(calendarDay, $, parseCalendarEvent) {

    // Make the JSON object for this day (list of events,
    // and date information that's added later)
    var calendarDayInfo = {
        events: []
    };

    calendarDay.find("li").each(function(i, elem) {
        var savedThis = this;
        var li = $(savedThis);
        // First elem is date header
        if (i == 0) {
            calendarDayInfo.month = li.find(".month").text().trim();
            calendarDayInfo.date = parseInt(li.find(".date").text())
            calendarDayInfo.year = parseInt(li.find(".year").text());
            calendarDayInfo.day = li.text().split(" - ")[1];

        // Otherwise, call the given event parser to generate a dictionary
        } else {
            var eventJSON = parseCalendarEvent(li, $);
            calendarDayInfo.events.push(eventJSON);
        }
    });

    return calendarDayInfo;
}


/* FUNCTION: parseUpperSchoolCalendarEvent
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
function parseUpperSchoolCalendarEvent(calendarEvent, $) {

    var eventJSON = {
        eventName: calendarEvent.find("h3").text().trim(),
        eventStartTime: null,
        eventEndTime: null,
        eventLocation: null
    }

    // If there's an h6 header, that contains the start, end,
    // and location of the event.  Eg. "3:30pm - 4:30pm - Old Gym"
    var eventInfoArray = calendarEvent.find("h6").text().split(" - ");
    if (eventInfoArray.length == 3) {
        eventJSON.eventStartTime = eventInfoArray[0].trim();
        eventJSON.eventEndTime = eventInfoArray[1].trim();
        eventJSON.eventLocation = eventInfoArray[2].trim(); 
    }

    return eventJSON;
}


/* FUNCTION: parseAthleticsCalendarEvent
----------------------------------------
Parameters:
    calendarEvent - the DOM element representing a single calendar event from
                the Athletics calendar.
    $ - the Cheerio object to use to traverse this DOM

Returns: a JSON representation of the information about this event.
        The JSON returned has the format:

{
    "maretTeam": "Girls' Varsity Soccer",
    "maretTeamID": 1204
    "opponent": "Potomac School",
    "gameTime": "3:00pm",
    "isHome": false,
    "gameLocation": "1301 Potomac School Road, McLean, VA 22101"
    "hasAddress": true
}

Note that opponent, gameTime, gameLocation, and hasAdress may be null (if gameLocation is null,
indicating a standard home game, then hasAddress will also be null).  For off-campus games,
the game location can be an address (hasAddress is true) or a name of a place if 
there is no address provided (hasAddress is false).  Note that isHome can be true 
and there can be a non-null gameLocation if the game is played at a home facility 
besides the main school campus.  
-----------------------------------------
*/
function parseAthleticsCalendarEvent(calendarEvent, $) {
    
    var gameJSON = {
        maretTeam: null,
        maretTeamID: null,
        opponent: null,
        gameTime: null,
        isHome: null,
        gameLocation: null,
        hasAddress: null
    };

    // "Varsity Golf vs. Potomac School" + gameDetails
    var gameTitle = calendarEvent.find("a").text().trim();

    // "3:00pm" or "3:00pm At Falls Road" or ""
    var gameDetails = calendarEvent.find("a h6").text().trim();    

    // If there's event details text, we need to remove it from the event title
    if (gameDetails != "") gameTitle = gameTitle.split(gameDetails)[0].trim();


    // STEP 1: parse the team names
    // ------------------------------
    var teamNames;
    if (gameTitle.indexOf(" vs. ") != -1) {
        teamNames = gameTitle.split(" vs. ");
        gameJSON.isHome = true;
    } else if (gameTitle.indexOf(" at ") != -1) {
        teamNames = gameTitle.split(" at ");
        gameJSON.isHome = false;
    } else {
        teamNames = [gameTitle];
        gameJSON.isHome = false;
    }

    gameJSON.maretTeam = teamNames[0].trim();
    if (teamNames.length > 1) gameJSON.opponent = teamNames[1].trim();


    // STEP 2: parse the detail label for game time and optional location
    // -----------------------------
    if (gameDetails != "" && gameDetails.indexOf("At") != -1) {
        var detailsList = gameDetails.split("At");
        gameJSON.gameTime = detailsList[0].trim();
        gameJSON.gameLocation = detailsList[1].trim();
        gameJSON.hasAddress = false;
    } else if (gameDetails != "") {
        gameJSON.gameTime = gameDetails;
    }


    // STEP 3: parse the game detail url
    // -----------------------------------
    var gameURL = calendarEvent.find("a").attr("href");
    gameJSON.maretTeamID = parseInt(gameURL.split("TeamID=")[1]);

    // Some teams are always away
    if (AWAY_TEAM_IDS.indexOf(gameJSON.maretTeamID) != -1) gameJSON.isHome = false;


    // STEP 4: parse the game detail screen
    // -------------------------------------


    return gameJSON;
}


// Start the server
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});