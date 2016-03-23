var cheerio = require('cheerio');
var Promise = require('promise');
var util = require('./util.js');


/* FUNCTION: scrapeAthleticsTeams
-----------------------------------
Parameters: NA
Returns: a promise passing back a sorted (by season - Fall, then Winter, then
Spring) array of objects for each of the teams included in the athletics teams
page at ATHLETICS_TEAMS_URL (see util.js).  Each team object contains 3 fields:

{
    teamName: "Cross Country",
    teamID: 4124,
    season: "Fall"    
}

where season is either "Fall", "Winter", or "Spring".
-----------------------------------
*/
function scrapeAthleticsTeams() {
    return util.getURL(util.constants.ATHLETICS_TEAMS_URL).then(function(html) {
        var $ = cheerio.load(html);
        return scrapeAthleticsTeamsDOM($);
    });
}


/* FUNCTION: scrapeAthleticsTeamsDOM
-------------------------------------
Parameters:
    $ - the Cheerio DOM parser for the athletics teams page.

Returns: a promise passing back a sorted (by season - Fall, then Winter, then
Spring) array of objects for each of the teams included in the athletics teams
page at ATHLETICS_TEAMS_URL (see util.js).  Each team object contains 3 fields:

{
    teamName: "Cross Country",
    teamID: 4124,
    season: "Fall"    
}

where season is either "Fall", "Winter", or "Spring".
--------------------------------------
*/
function scrapeAthleticsTeamsDOM($) {
    var teamsList = [];

    // Each team has a link to its schedule - find each link element
    $('.teamlist .content-group a').each(function() {

        // The team ID is in the team's link URL 
        // (.../athletics-center/list/team/schedule/index.aspx?TeamID=1228)
        var teamIDStr = $(this).attr("href").match(/TeamID=([0-9]+)/)[1];
        var teamID = parseInt(teamIDStr);

        // The team name is the link text
        var teamName = $(this).text();

        // The season is in the containing content-group, as its last class
        var classAttr = $(this).closest(".content-group").attr("class");
        var season = classAttr.split(/\s+/).pop();
        season = season.charAt(0).toUpperCase() + season.slice(1);

        teamsList.push({
            teamName: teamName,
            teamID: teamID,
            season: season
        });
    });

    return teamsList;
}


/* FUNCTION: scrapeCalendars
------------------------------
Parameters:
    calendarsDictionary - a dictionary of calendar names to calendar urls.
                        Each entry specifies a single calendar to
                        scrape.
    calendarScraperFn - a function responsible for scraping a single calendar.
                        It should take the Cheerio DOM element for a single
                        calendar page as a parameter, along with optional
                        auxiliary data (see auxData below) and should return a
                        promise passing back a JS array of day objects for the
                        given calendar.  Each object should have the following
                        properties:

                        {
                            "month": "September",
                            "date": 9,
                            "day": "Wednesday",
                            "year": 2015,
                            "events": [
                                ...
                            ]
                        }

                        Where each element in the events array is an object
                        describing a single calendar event on that day.
    auxData - optional auxiliary data that is passed to the calendarScraperFn.

Returns: a promise passing back a JS dictionary containing all of the scraped
calendar data.  The format is as follows:

{
    "CALENDAR_NAME": [
        ...
    ],
    "CALENDAR_NAME": [
        ...
    ]
}

Where each CALENDAR_NAME is a key from a calendarsDictionary entry, and the
value array is the return value from the calendarScraperFn run on the HTML at
the url associated with that calendarsDictionary key.

All calendars are scraped in parallel.
------------------------------
*/
function scrapeCalendars(calendarsDictionary, calendarScraperFn, auxData) {

    var calendarPromises = [];
    var calendarNames = [];

    /* Scrape each calendar */
    for (var calendarName in calendarsDictionary) {
      if (calendarsDictionary.hasOwnProperty(calendarName)) {
        var calendarURL = calendarsDictionary[calendarName];
        var promise = getURL(calendarURL).then(function(html) {
            var $ = cheerio.load(html);
            return calendarScraperFn($.root(), $, auxData);
        });

        calendarPromises.push(promise);
        calendarNames.push(calendarName);
      }
    }

    return Promise.all(calendarPromises).then(function(promiseResponses) {
        var calendarsData = {};
        promiseResponses.forEach(function(response, index) {
            calendarsData[calendarNames[index]] = response;
        });

        return calendarsData;
    });
}


/* FUNCTION: scrapeSchoolCalendar
----------------------------------------
Parameters:
    calendar - the Cheerio DOM element for a single calendar.
    $ - the Cheerio DOM parser for a single school calendar.

Returns: a JS array of day objects for the given calendar.
Each object has the following properties:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

Where each element in the events array is an object describing a single calendar
event on that day.  Each event object has the format:

{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00 PM",
    "endTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}

Note that only the eventName field is guaranteed to be non-null.
----------------------------------------
*/
function scrapeSchoolCalendar(calendar, $) {

    var calendarDaysData = [];
    calendar.find('.calendar-day').each(function(index, elem) {
        var savedThis = this;
        calendarDaysData.push(scrapeSchoolCalendarDay($(savedThis), $));
    });

    return calendarDaysData;
}


/* FUNCTION: scrapeSchoolCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element for a single day in a school calendar.
    $ - the Cheerio object to use to traverse this DOM.

Returns: a JS object containing information about this calendar day.  The
object has the following properties:

{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}

The "events" array is an array of event dictionaries, where each event
dictionary has the format:

{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00 PM",
    "endTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}

Note that only the eventName field is guaranteed to be non-null.
--------------------------------------
*/
function scrapeSchoolCalendarDay(calendarDay, $) {

    /* Make the JSON object for this day (list of events,
     * and date information that's added later) */
    var calendarDayInfo = {
        month: null,
        date: null,
        day: null,
        year: null,
        events: []
    };

    calendarDay.find("li").each(function(i, elem) {
        var savedThis = this;
        var li = $(savedThis);

        /* First elem is date header */
        if (i == 0) {
            calendarDayInfo.month = li.find(".month").text().trim();
            calendarDayInfo.date = parseInt(li.find(".date").text());
            calendarDayInfo.day = li.text().split("-")[1].trim();
            calendarDayInfo.year = parseInt(li.find(".year").text());

        /* Otherwise, call the given event parser to generate a dictionary */
        } else {
            calendarDayInfo.events.push(scrapeSchoolCalendarEvent(li, $));
        }
    });

    return calendarDayInfo;
}


/* FUNCTION: scrapeSchoolCalendarEvent
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
function scrapeSchoolCalendarEvent(calendarEvent, $) {

    var eventInfo = {
        eventName: null,
        startTime: null,
        endTime: null,
        eventLocation: null
    }

    /* h6 containing event time and location Eg. "3:30pm - 4:30pm - Old Gym" */
    var h6SearchResults = calendarEvent.find("h6");
    var h6EventInfo = h6SearchResults.length > 0 ? $(h6SearchResults[0]) :
                        undefined;

    /* If there's an h6 header, parse the event info */
    var eventInfoArray = h6EventInfo ? h6EventInfo.text().split(" - ") : [];

    /* Convert the start time ("3:00pm") to the format "3:00 PM" */
    if (eventInfoArray.length > 0 && eventInfoArray[0].trim() != "") {
        var startTime = eventInfoArray[0].trim().toUpperCase();
        eventInfo.startTime = startTime.substring(0, startTime.length - 2) +
                            " " + startTime.substring(startTime.length - 2);
    }

    /* Convert the end time ("3:00pm") to the format "3:00 PM" */
    if (eventInfoArray.length > 1 && eventInfoArray[1].trim() != "") {

        /* If the whole string is like " - Thru 2/5/2016", we just want the date
         * portion of it.  Otherwise, if the whole string is like "8:30am - Gym",
         * then the second element is actually the LOCATION, not the end time.
         * Otherwise, the second element is the end time. 
         */
        if (eventInfoArray[1].toLowerCase().indexOf("thru") != -1) {
            eventInfo.endTime = eventInfoArray[1].trim().split(" ")[1].trim();
        } else if (eventInfoArray[1].toLowerCase().indexOf("am") == -1 &&
            eventInfoArray[1].toLowerCase().indexOf("pm") == -1) { 
            eventInfo.eventLocation = eventInfoArray[1].trim();
        } else {
            var endTime = eventInfoArray[1].trim().toUpperCase();
            eventInfo.endTime = endTime.substring(0, endTime.length - 2) + " " +
                            endTime.substring(endTime.length - 2);
        }
    }

    /* Get the event location */
    if (eventInfoArray.length > 2 && eventInfoArray[2].trim() != "") {
        eventInfo.eventLocation = eventInfoArray[2].trim();
    }

    /* See if this is a linked event (w/ <a> tag) or not
     * (just h3 and h6 tags).
     */
    var linkSearchResults = calendarEvent.find("a");
    var link = linkSearchResults.length > 0 ? $(linkSearchResults[0]) :
                undefined;
    if (link && h6EventInfo) {
        /* Event name is the full link text minus the event time/location */
        eventInfo.eventName = link.text().split(h6EventInfo.text())[0].trim();
    } else if (link) {
        /* Event name is just the link text */
        eventInfo.eventName = link.text().trim();
    } else {
        /* No link and no description header */
        eventInfo.eventName = $(calendarEvent.find("h3")[0]).text().trim();
    }

    return eventInfo;
}


/* FUNCTION: scrapeAthleticsCalendar
----------------------------------------
Parameters:
    calendar - the DOM element for a single athletics calendar.
    $ - the Cheerio DOM parser for this calendar.
    athleticsTeamsMap - a map from teamID strings to team name strings
                        for all the teams included in the calendar.

Returns: a JS array of day objects for the given calendar.
Each object in the array has the following properties:

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
for this event (if any - most games will not have one, but some, such as cross
country meets, have names like "Cross Country Invitational".)
----------------------------------------
*/
function scrapeAthleticsCalendar(calendar, $, athleticsTeamsMap) {

    var calendarDaysData = [];
    calendar.find('.calendar-day').each(function(index, elem) {
        var savedThis = this;
        calendarDaysData.push(scrapeAthleticsCalendarDay($(savedThis), $,
            athleticsTeamsMap));
    });

    return calendarDaysData;
}


/* FUNCTION: scrapeAthleticsCalendarDay
-------------------------------------
Parameters:
    calendarDay - the DOM element for a single day in the Athletics calendar.
    $ - the Cheerio object to use to traverse this DOM
    athleticsTeamsMap - the map of teamID strings to team names.

Returns: a promise passing along the a JS object with the following properties:

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
for this event (if any - most games will not have one, but some, such as cross
country meets, have names like "Cross Country Invitational".)

Because of the way dates are displayed, we're not able to get the full date from
the calendar day itself.  Instead, we have to get the date out of scraping a
calendar event's detail page.  All events within a given day are scraped in
parallel.
--------------------------------------
*/
function scrapeAthleticsCalendarDay(calendarDay, $, athleticsTeamsMap) {

    var promises = [];

    /* Parse each event listed on this day (each dd elem) */
    calendarDay.find("dd").each(function(i, elem) {
        var savedThis = this;
        var dd = $(savedThis);

        /* If this event's been cancelled, ignore it */
        if (dd.children().first().children().first().hasClass("cancelled")) {
            return;
        }

        promises.push(scrapeAthleticsCalendarEvent(dd, $, athleticsTeamsMap));
    });

    return Promise.all(promises).then(function(eventsInfo) {

        /* Make the JSON object for this day (list of events,
         * and date information that's added later). */
        var calendarDayInfo = {
            month: null,
            date: null,
            day: null,
            year: null,
            events: []
        };

        eventsInfo.forEach(function(info) {

            /* If it's non-null, then we should add it to our list */
            if (info) {

                /* Unpack the JS objects containing info */
                var eventInfo = info.eventInfo;
                calendarDayInfo.events.push(eventInfo);

                /* If we haven't added the date yet, add it */
                if (!calendarDayInfo.month) {
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
    athleticsTeamsMap - a dictionary of teamID (string) to team name (string).
                        Used to look up team names.

Returns: an event object containing the following properties:

{
    "eventInfo": {
        "eventID": 12546,
        "eventName": null,
        "teamName": "Girls' Varsity Soccer",
        "teamID": 52235,
        "opponent": "Froggie School",
        "startTime": "3:00 PM",
        "endTime": "4:00 PM",
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

We return two sub-objects - one containing information about the athletic event
itself, and the other about the date on which it occurs.  For the dateInfo, all
fields are guaranteed non-null.  For the eventInfo object eventID, teamName,
teamID and isHome are guaranteed to be non-null.  eventID is a unique ID.
eventAddress is a mappable address.  eventLocation is only the name of a place
(e.g. Jelleff).  Note that isHome can be true with a non-null eventLocation and
eventAddress if the game is played at a home facility besides the main school
campus.  eventName is the special name for this event (if any - most games will
not have one, but some, such as cross country meets, have names like "Cross
Country Invitational".)
-----------------------------------------
todo: finish
*/
function scrapeAthleticsCalendarEvent(calendarEvent, $, athleticsTeamsMap) {

    var info = {
        eventInfo: {
            eventID: null,
            eventName: null,
            teamName: null,
            teamID: null,
            opponent: null,
            startTime: null,
            endTime: null,
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
    var teamID = parseInt(util.getParameterByName(detailPageURL, "TeamID"));
    info.eventInfo.teamName = athleticsTeamsMap[teamID];
    info.eventInfo.teamID = teamID;

    // Get the eventID
    info.eventInfo.eventID = parseInt(util.getParameterByName(detailPageURL,
        "LinkID"));

    // Get the rest of the info from the detail page
    return getURL(util.constants.MARET_URL_BASE +
        detailPageURL).then(function(html) {

        $ = cheerio.load(html);

        // Parse the full date string (e.g. "Thursday, September 10, 2015"),
        // removing commas from the ends of the day name and number
        var dateString = $(".calendar-detail .date").text().trim();
        var dateComponents = dateString.split(" ");
        info.dateInfo.day = dateComponents[0].slice(0, -1);
        info.dateInfo.month = dateComponents[1];
        info.dateInfo.date = parseInt(dateComponents[2].slice(0, -1));
        info.dateInfo.year = parseInt(dateComponents[3]);

        // e.g. "Varsity Golf vs. Potomac School".  Remove span text (if any)
        var gameTitleString = $(".calendar-detail h1").text().trim();
        if ($(".calendar-detail h1").children().length > 0) {
            var textToRemove = $(".calendar-detail h1").children().text();
            gameTitleString = gameTitleString.replace(textToRemove, "");
        }

        // Check if there's a game location attached
        // (e.g. "team at team at Wilson" or "team vs. team at Wilson")
        var hasEventLocation = (gameTitleString.match(/ at /g) || []).length > 1;
        hasEventLocation = hasEventLocation ||
            (gameTitleString.indexOf(" at ") != -1 &&
                gameTitleString.indexOf(" vs. ") != -1);

        // Parse the game title down to just the team names.  Check if there's a
        // dash (meaning there's an event name) or hasEventLocation is true
        if (gameTitleString.indexOf(" - ") != -1) {
            var dashComponents = gameTitleString.split(" - ");
            gameTitleString = dashComponents[0].trim();
            info.eventInfo.eventName = dashComponents[1].trim();
        } else if (hasEventLocation) {
            var atIndex = gameTitleString.lastIndexOf(" at ");
            info.eventInfo.eventLocation = gameTitleString.substring(atIndex + " at ".length).trim();
            gameTitleString = gameTitleString.substring(0, atIndex).trim();
        }

        // Parse the team names by splitting by " vs. " or " at "
        var teamNames;
        if (gameTitleString.indexOf(" vs. ") != -1) {
            teamNames = gameTitleString.split(" vs. ");
        } else if (gameTitleString.indexOf(" at ") != -1) {
            teamNames = gameTitleString.split(" at ");
        } else teamNames = [gameTitleString];

        // We get the Maret team name from the teamID, so we just need the opponent
        if (teamNames.length > 1) info.eventInfo.opponent = teamNames[1].trim();

        // Convert the game time string ("Time: 4:00PM") to "4:00 PM"
        var timeString = $(".calendar-detail .time").text().trim();
        if (timeString != "") {
            timeString = timeString.split("Time:")[1];

            // If it's a time range, just get the start time
            timeString = timeString.split(" - ")[0].trim();
            info.eventInfo.startTime = timeString.substring(0, timeString.length - 2) + " " +
                timeString.substring(timeString.length - 2);
        }

        // Convert the dismissal time string ("Dismissal: 2:40PM") to "2:40 PM"
        var dismissalString = $(".calendar-detail .dismissal").text().trim();
        if (dismissalString != "") {
            dismissalString = dismissalString.split("Dismissal:")[1].trim();
            info.eventInfo.dismissalTime = dismissalString.substring(0, dismissalString.length - 2) + " " +
                dismissalString.substring(dismissalString.length - 2);
        }

        // Convert the return time string ("Return: 6:00PM") to "6:00 PM"
        var returnString = $(".calendar-detail .return").text().trim();
        if (returnString != "") {
            returnString = returnString.split("Return:")[1].trim();
            info.eventInfo.returnTime = returnString.substring(0, returnString.length - 2) + " " +
                returnString.substring(returnString.length - 2);
        }

        // If there's an address field, scrape the address
        var addressString = $(".calendar-detail address").text().trim();
        if (addressString != "") {
            info.eventInfo.eventAddress = addressString;
        }

        return info;
    });
}


/* Exports */
module.exports.scrapeAthleticsTeams = scrapeAthleticsTeams;
module.exports.scrapeAthleticsTeamsDOM = scrapeAthleticsTeamsDOM;
module.exports.scrapeCalendars = scrapeCalendars;
module.exports.scrapeSchoolCalendar = scrapeSchoolCalendar;
module.exports.scrapeSchoolCalendarDay = scrapeSchoolCalendarDay;
module.exports.scrapeSchoolCalendarEvent = scrapeSchoolCalendarEvent;
module.exports.scrapeAthleticsCalendar = scrapeAthleticsCalendar;
module.exports.scrapeAthleticsCalendarDay = scrapeAthleticsCalendarDay;
module.exports.scrapeAthleticsCalendarEvent = scrapeAthleticsCalendarEvent;
