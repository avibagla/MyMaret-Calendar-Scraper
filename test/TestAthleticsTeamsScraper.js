var assert = require('assert');
var scraper = require('../scraper.js');
var testUtil = require('./testUtil.js');

var TEST_TEAMS_HTML_FILENAME = "./files/athleticsteams.html";
var TEST_TEAMS_JSON_FILENAME = "./files/athleticsteams.json";


/* FUNCTION: run
--------------------
Parameters: NA
Returns: NA

Runs all tests for the athletics teams scraper, which currently only includes
one test that scrapes a sample athletics calendar/teams page.
--------------------
*/
module.exports.run = function() {
	"use strict";
	describe('scrapeAthleticsTeams', function() {
		it('Scrape Athletics Teams', function() {
			var $ = testUtil.loadTestHTMLNamed(TEST_TEAMS_HTML_FILENAME);
			var actual = scraper.scrapeAthleticsTeamsDOM($);
			var correct = testUtil.loadTestJSONNamed(TEST_TEAMS_JSON_FILENAME);
			assert.deepStrictEqual(actual, correct, "JSON should match.");
		});
	});
}