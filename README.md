# MyMaret-Calendar-Scraper
A scraper for the Maret Upper School and athletics calendar sites.
This is a node server that scrapes the mobile Upper School calendar site
(https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School)
and the main athletics page calendar
(http://www.maret.org/athletics-center/index.aspx).
To run the server, just run

```javascript
npm start
```

The main file, server.js, will run.  There are multiple endpoints:
    
### GET /scrapeSchoolCalendars

This sends back a JSON response containing information about the events in
all the main school calendars.  With the given util.js settings, the format
is as follows:

```javascript
{
    "Upper School": [
        ...
    ],
    "Middle School": [
        ...
    ],
    "Lower School": [
        ...
    ]
}
```

Values are arrays of day dictionaries, where each day dictionary has the format:

```javascript
{
    "month": "September",
    "date": 9,
    "day": "Wednesday",
    "year": 2015,
    "events": [
        ...
    ]
}
```

Each day dictionary has an array of event dictionaries, where the event
dictionary format is the following:

```javascript
{
    "eventName": "US Leadership Workshop",
    "startTime": "6:00 PM",
    "endTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}
```

Note that only the eventName field is guaranteed to be non-null.  The calendars
are fetched in parallel.

### GET /scrapeAthleticsCalendar

This sends back a JSON response containing information about the events in the
athletics calendar.  The response format is an array of day dictionaries, which
are identical to the day dictionaries in GET /scrapeSchoolCalendars.  The only
difference is that the event dictionaries inside the days are defined as:

```javascript
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
```

eventID, teamName, teamID and isHome are guaranteed to be non-null.
eventID is a unique ID.  eventAddress is a mappable address.
eventLocation is only the name of a place.  Note that isHome can be true and
there can be a non-null eventLocation and eventAddress if the game is played at
a home facility besides the main school campus.  eventName is the special name
for this event (if any - most events will not have one, but some, such as cross
country meets, have names like "Cross Country Invitational".)

### GET /ScrapeAthleticsTeams

This sends back an array of athletics teams objects sorted by season - Fall,
then Winter, then Spring.  Each object contains the following properties 
(all guaranteed to be non-null):

{
    teamName: "Cross Country",
    teamID: 1245,
    season: "Fall"
}

