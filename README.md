# MyMaret-Calendar-Scraper
A scraper for the Maret Upper School and athletics calendar sites.  This is a node server 
that scrapes the mobile Upper School calendar site (https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School) 
and the main athletics page calendar (http://www.maret.org/athletics-center/index.aspx).  To run the server, just run

```javascript
npm start
```

The main file, scraper.js, will run.  There's 1 endpoint, /scrapeCalendars, which sends back a JSON response
containing information about the events that were scraped.  The format is as follows:

```javascript
{
    "Upper School": [
        ...
    ],
    "Athletics": [
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

Each day dictionary has an array of event dictionaries, where the event dictionary format
depends on the calendar the event is from.  Athletic events have the format:

```javascript
{
    "gameName": null,
    "maretTeam": "Girls' Varsity Soccer",
    "opponent": "Froggie School",
    "gameTime": "3:00 PM",
    "dismissalTime": "2:00 PM",
    "returnTime": "5:00 PM",
    "isHome": false,
    "gameAddress": "1254 Lakeside Dr. Potomac, MD 20156"
    "gameLocation": null
}
```


Upper School calendar events have the format:

```javascript
{
    "eventName": "US Leadership Workshop",
    "eventStartTime": "6:00 PM",
    "eventEndTime": "7:30 PM",
    "eventLocation": "Theatre,Theatre Lobby"
}
```

Note that only the eventName field is guaranteed to be non-null.
