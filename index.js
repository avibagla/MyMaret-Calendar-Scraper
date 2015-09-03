var request = require('request');
var cheerio = require('cheerio');
var express = require('express');
var app = express();

var UPPER_SCHOOL_CALENDAR_URL = "https://www.maret.org/mobile/index.aspx?v=c&mid=120&t=Upper%20School";

app.set('port', (process.env.PORT || 5000));

app.get('/scrape', function(req, res) {
    request(UPPER_SCHOOL_CALENDAR_URL, function(error, response, html) {
        if (!error) {
            var $ = cheerio.load(html);

            // Gather up event names
            var events = [];
            $('.calendar-day').filter(function() {
                var data = $(this);
                var lastEventTitle = data.children().last().children().first().text().trim();
                events.push(lastEventTitle);
            });

            res.json(events);
        } else res.json("error");
    });
});

app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});