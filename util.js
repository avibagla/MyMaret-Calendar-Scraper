var Promise = require('promise');
var request = require('request');


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
module.exports.getURL = function(url) {
    return new Promise(function(resolve, reject) {
        request(url, function(error, response, body) {
            if(error) reject(error);
            else resolve(body);
        });
    });
}


/* FUNCTION: getParameterByName
--------------------------------
Parameters:
    url - the url to search
    name - the name of the URL parameter for which to get the value

Returns: the value of the given parameter in the given url (returns null
        if the parameter wasn't found)

Thanks to StackOverflow question 901115.
--------------------------------
*/
module.exports.getParameterByName = function(url, name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(url);
    return results === null ? null : 
    		decodeURIComponent(results[1].replace(/\+/g, " "));
}


/* A constants object containing all the URLs used by the parser. */
module.exports.constants = {
	SCHOOL_URL_BASE: "http://www.maret.org"
};

/* URLs for the athletics calendar and teams info pages, for the
 * /scrapeAthleticsCalendars endpoint. */
module.exports.constants.ATHLETICS_CALENDAR_URL = 
	module.exports.constants.SCHOOL_URL_BASE + "/athletics-center/index.aspx";
module.exports.constants.ATHLETICS_TEAMS_URL =
	module.exports.constants.ATHLETICS_CALENDAR_URL;

/* Map of names of general calendars to calendar URLs.  This object
 * defines the output of the /scrapeSchoolCalendars endpoint.  Each
 * key below will be a key in the returned JSON, with its value being
 * an array of day dictionaries containing info from the associated 
 * calendar link below.
 */
module.exports.constants.SCHOOL_CALENDAR_URLS = {
	"Lower School": module.exports.constants.SCHOOL_URL_BASE +
							"/mobile/index.aspx?v=c&mid=121&t=Lower%20School",
	"Middle School": module.exports.constants.SCHOOL_URL_BASE +
							"/mobile/index.aspx?v=c&mid=122&t=Middle%20School",
	"Upper School": module.exports.constants.SCHOOL_URL_BASE + 
                            "/mobile/index.aspx?v=c&mid=120&t=Upper%20School"												
};