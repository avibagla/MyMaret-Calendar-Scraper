var assert = require('assert');
var cheerio = require('cheerio');
var fs = require('fs');


/* FUNCTION: loadTestHTMLNamed
--------------------------------
Parameters:
    filename - the name of the HTML file to read in

Returns: A Cheerio DOM parser containing the HTML in
the given file.
--------------------------------
*/
function loadTestHTMLNamed(filename) {
    "use strict";
    var fileString = fs.readFileSync(filename, 'utf8');
    return cheerio.load(fileString);
}


/* FUNCTION: loadTestJSONNamed
--------------------------------
Parameters:
    filename - the name of the JSON file to read in

Returns: the Javascript object contained in the given
JSON file.
--------------------------------
*/
function loadTestJSONNamed(filename) {
    "use strict";
    var fileString = fs.readFileSync(filename, 'utf8');
    return JSON.parse(fileString);
}


/* FUNCTION: testParserEquality
---------------------------------
Parameters:
    htmlFilename - the name of the html filename to try scraping
    jsonFilename - the name of the file containing the correct scraper output
                    for the given html file.
    scraperFn - the function to use to scrape the html.  The function should
                take two parameters, the Cheerio DOM element for the html
                to be parsed, and the Cheerio DOM parser itself.

Returns: NA

Checks that the given html file is scraped correctly.  Uses
assert.deepStrictEqual to ensure the correctness of the scraped JSON against
the given correct JSON output.
----------------------------------
*/
function testParserEquality(htmlFilename, jsonFilename, scraperFn) {
    "use strict";
    var $ = loadTestHTMLNamed(htmlFilename);
    var actual = scraperFn($.root(), $);
    var correct = loadTestJSONNamed(jsonFilename);
    assert.deepStrictEqual(actual, correct, "JSON should match.");
}


/* FUNCTION: runTestCases
----------------------------
Parameters:
    testCases - a map of test case names to test case objects.  Each name is a
                string, and each test case object should have an htmlFilename
                and jsonFilename property, each containing the filename of that
                test case's html file and correct JSON output file.
    testPrefix - a prefix printed before each test case name when the test is
                 run.
    scraperFn - the function to use to scrape the html.  The function should
                take two parameters, the Cheerio DOM element for the html
                to be parsed, and the Cheerio DOM parser itself.

Returns: NA

Runs a Mocha test for each of the test cases contained in the testCases map,
using the given scraperFn to scrape each test case's html.
----------------------------
*/
function runTestCases(testCases, testPrefix, scraperFn) {
    "use strict";

    for (var testCaseName in testCases) {
        if (testCases.hasOwnProperty(testCaseName)) {
            var testCase = testCases[testCaseName];
            runTestCase(testPrefix + testCaseName, testCase.htmlFilename,
                testCase.jsonFilename, scraperFn)
        }
    }
}


/* FUNCTION: runTestCase
--------------------------
Parameters:
    testName - the name displayed for this test
    htmlFilename - the name of the html file to scrape
    jsonFilename - the name of the file with the correct scraper output
    scraperFn - the function to use to scrape the html.  The function should
                take two parameters, the Cheerio DOM element for the html
                to be parsed, and the Cheerio DOM parser itself.

Returns: NA

Runs a Mocha test for the given html file, using the given scraperFn to scrape
it and comparing it against the given correct JSON output.

Note: this is decomposed because of JS weirdness with scope when putting
this directly inside runTestCases (weird things happen with the it closure
referencing outside variables that get changed later in the loop).
--------------------------
*/
function runTestCase(testName, htmlFilename, jsonFilename, scraperFn) {
    it(testName, function() {
        testParserEquality(htmlFilename, jsonFilename, scraperFn);
    });
}


/* Exports */
module.exports.runTestCases = runTestCases;
module.exports.loadTestHTMLNamed = loadTestHTMLNamed;
module.exports.loadTestJSONNamed = loadTestJSONNamed;


