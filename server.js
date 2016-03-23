var express = require('express');
var scraper = require('./scraper.js');
var util = require('./util.js');

var app = express();
app.set('port', (process.env.PORT || 5000));


/* ENDPOINT: GET /scrapeSchoolCalendar
--------------------------
A scraper for the general school calendar.
Responds with the parsed calendar data as JSON.  The format is as follows:

{
    "CALENDAR_NAME": [
        ...
    ],
    "CALENDAR_NAME": [
        ...
    ]
}

The CALENDAR_NAME keys are determined by the SCHOOL_CALENDAR_URLS dictionary
specified in the constants file.  Each of its keys becomes a key in the JSON
returned from this endpoint, and the calendar data included with each key is
from the value (URL) for that key in the ATHLETICS_CALENDAR_URLS dictionary.

Values are arrays of (sorted, from earliest to latest) day dictionaries, 
where each day dictionary has the format:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

Each day dictionary has an array of event dictionaries, where each event
dictionary has the format:

{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00 PM",
    "endTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}

Note that only the eventName field is guaranteed to be non-null.  All calendars
are scraped in parallel.
--------------------------
*/
app.get('/scrapeSchoolCalendars', function(req, res) {
    "use strict";
    scrapeCalendars(util.constants.SCHOOL_CALENDAR_URLS,
        scraper.scrapeSchoolCalendar).then(function(calendarData) {
            res.json(calendarData);
    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });
});


/* ENDPOINT: GET /scrapeAthleticsCalendar
--------------------------
A scraper for the athletics calendar.
Responds with an array of (sorted, from earliest to latest) day dictionaries,
where each day dictionary has the format:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

Each day dictionary has an array of event dictionaries, where the event
dictionary format is the following:

{
    "eventID": 12543,
    "eventName": null,
    "teamName": "Girls' Varsity Soccer",
    "teamID": 12542,
    "opponent": "Froggie School",
    "startTime": "3:00 PM",
    "endTime": "4:00 PM",
    "dismissalTime": "2:00 PM",
    "returnTime": "5:00 PM",
    "isHome": false,
    "eventAddress": "1254 Lakeside Dr. Potomac, MD 20156"
    "eventLocation": null
}

eventID, teamName, teamID and isHome are guaranteed to be non-null.
eventID is a unique ID.  eventAddress is a mappable address.
eventLocation is only the name of a place.  Note that isHome can be true and
there can be a non-null eventLocation and eventAddress if the game is played at
a home facility besides the main school campus.  eventName is the special name
for this event (if any - most events will not have one, but some, such as cross
country meets, have names like "Cross Country Invitational".)
--------------------------
*/
app.get('/scrapeAthleticsCalendar', function(req, res) {
    "use strict";
    scraper.scrapeAthleticsTeams().then(function(teams) {

        /* Make a map from team ID to team name */
        var teamsMap = {};
        teams.forEach(function(team) {
            teamsMap[team.teamID] = team.teamName;
        });

        return teamsMap;

    }).then(function(athleticsTeamsMap) {
        var calendarDict = {"Athletics": util.constants.ATHLETICS_CALENDAR_URL};
        return scrapeCalendars(calendarDict, scraper.scrapeAthleticsCalendar,
            athleticsTeamsMap);
    }).then(function(calendarData) {
        res.json(calendarData["Athletics"]);
    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });
});


/* ENDPOINT: GET /scrapeAthleticsTeams
-----------------------------------------
A scraper for athletics teams information.  Responds with an array of athletics
teams objects (sorted by season - Fall, then Winter, then Spring), where each
object contains the following properties (all guaranteed to be non-null):

{
    teamName: "Cross Country",
    teamID: 1245,
    season: "Fall"
}
-----------------------------------------
*/
app.get('/scrapeAthleticsTeams', function(req, res) {
    "use strict";
    scraper.scrapeAthleticsTeams().then(function(teams) {
        res.json(teams);
    }, function(error) {
        console.log("Error: " + JSON.stringify(error));
        res.sendStatus(500);
    });
});


/* Start the server */
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


