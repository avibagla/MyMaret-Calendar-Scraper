/* MAIN TEST FILE
------------------
Tests for:
	- school calendar scraper
	- athletics calendar scraper
	- athletics team scraper

All tests are imported and run from their respective files.  Each file
must export a run() method that takes no arguments and runs all of its tests.
------------------
*/

/* Tests for school calendar scraper */
var schoolCalendarTester = require('./TestSchoolCalendarScraper.js');
schoolCalendarTester.run();

/* Tests for athletics teams scraper */
var athleticsTeamsTester = require('./TestAthleticsTeamsScraper.js');
athleticsTeamsTester.run();

/* Tests for athletics calendar scraper */
var athleticsCalendarTester = require('./TestAthleticsCalendarScraper.js');
athleticsCalendarTester.run();