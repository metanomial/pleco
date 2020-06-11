#!/usr/bin/env node

const { version, description } = require("./package.json");
const { HyperdriveClient } = require("hyperdrive-daemon-client");
const fetch = require("node-fetch");
const outdent = require("outdent");

// Regular expressions
const HTTP_SCHEME = /^https?:/;
const HYPER_SCHEME = /^hyper:/;
const ED25519_KEY = /^[0-9a-f]{64}$/;
const HYPER_URI_SCRAPER = /hyper:\/\/[0-9a-f]{64}/g;
const SCRAPABLE_EXTS = /\.(html?|md|json|xml|js|css)$/;

// Parse command line arguments
const argv = require("minimist")(process.argv.slice(2), {
	boolean: [ "help", "h", "version", "V" ],
	string: [ "endpoint", "e", "token", "t" ]
});

// Early exits
if (argv.help || argv.h) printUsage();
if (argv.version || argv.v) printVersion();
if (argv._.length == 0) printUsage();

// Instantiate hyperdrive daemon client
const client = new HyperdriveClient(
	argv.endpoint != null ? argv.endpoint : argv.e,
	argv.token != null ? argv.token : argv.t
);

// Working memory
const crawled = new Set;
const queue = [];

// Wait for client ready event
client.ready().then(main).catch(error => {
	console.error(error.message);
	console.log("Double-check that the Hyperdrive Daemon is running, and that Pleco is using the correct endpoint and token.");
	process.exit(1);
});

/**
 * Main routine
 */
async function main() {
	const start = Date.now();
	await exhaustInput();
	console.log(`Queued ${ queue.length } drives from seed input`);
	await exhaustQueue();
	const ellapsed = Date.now() - start;
	console.log(`Found ${ crawled.size } drives in ${ formatTime(ellapsed) }`);
}

/**
 * Crawl all inputed URIs
 */
async function exhaustInput() {
	for (const uri of argv._) {
		if (uri.match(HTTP_SCHEME)) await crawlHttp(uri).catch(error => {
			console.warn(error.message);
		});
		else if (uri.match(HYPER_SCHEME)) addQueue(uri);
		else console.warn(`Unknown URI "${ uri }", skipping`);
	}
}

/**
 * Crawl all queued hypercore keys
 */
async function exhaustQueue() {
	while (queue.length) {
		const key = queue.pop();
		await crawlHyper(key);
	}
}

/**
 * Fetch and search an HTTP resource for hypercore keys
 * @param {string} url URL string
 */
async function crawlHttp(url) {
	const response = await fetch(url);
	const text = await response.text();
	const uriList = scrapeURIs(text);
	addQueue(...uriList);
}

/**
 * Fetch, index, and search a hypercore for hypercore keys
 * @param {string} key Hypercore key
 */
async function crawlHyper(key) {
	try {
		console.group(`Crawling ${ key } (${ queue.length } Queued)`);
		const drive = await client.drive.get({ key });
		const entries = (await drive.readdir("/", { recursive: true }))
			.filter(entry => entry.match(SCRAPABLE_EXTS));
		console.log(`Discovered ${ entries.length } scrapable files`);
		for (const entry of entries) {
			try {
				console.group(`Scraping ${ entry }`);
				const text = await drive.readFile(entry, { encoding: "utf8" });
				const uriList = scrapeURIs(text);
				const count = addQueue(...uriList);
				if (count > 0) console.log(`Added ${ count } keys to queue.`);
			} catch (error) {
				console.warn(error.message);
				console.log(`Skipping file`);
			} finally {
				console.groupEnd();
			}
		}
	} catch (error) {
		console.warn(error.message);
		console.log(`Skipping drive`);
	} finally {
		crawled.add(key);
		console.groupEnd();
	}
}

/**
 * Add hypercore keys to the crawl queue
 * @param  {...string} uriList Hypercore URIs
 * @return {number} Actual number of keys added to queue
 */
function addQueue(...uriList) {
	let count = 0;
	for (const uri of uriList) {
		const key = extractKey(uri);
		if (key == null) continue;
		if (queue.includes(key)) continue;
		if (crawled.has(key)) continue;
		queue.push(key);
		++count;
	}
	return count;
}

/**
 * Extract key from a hypercore URI
 * @param {string} uri Hypercore URI
 * @return {string} Hypercore key
 */
function extractKey(uri) {
	const key = uri.match(HYPER_SCHEME)
		? uri.slice(8, 72)
		: uri.slice(0, 64);
	return key.match(ED25519_KEY)
		? key
		: null;
}

/**
 * Find all hypercore URIs in a body of text
 * @param {string} text Body of text
 * @return {string[]} Hypercore keys
 */
function scrapeURIs(text) {
	return text.match(HYPER_URI_SCRAPER) || [];
}

/**
 * Intelligently format milliseconds as seconds, minutes, or hours
 * @param {number} ms Milliseconds
 * @return {string} Formatted time
 */
function formatTime(ms) {
	if (ms < 60000) return `${ (ms / 1000).toFixed(2) } sec`;
	if (ms < 3600000) return `${ (ms / 60000).toFixed(2) } min`;
	return `${ (ms / 3600000).toFixed(2) } hr`;
}

/**
 * Print command usage message and terminate process
 */
function printUsage() {
	const options = {
		trimLeadingNewline: false,
		trimTrailingNewline: false
	};
	const message = outdent(options)`
		Pleco v${ version }
		${ description }

		Usage:
		  $ pleco [options] <uri> [<uri>...]

		Options:
		  -h, --help         Print command usage.
		  -V, --version      Print installed version.
		  -v, --verbose      Show extra debugging messages.
		  -e, --endpoint     Set the Hyperdrive Daemon endpoint. If not provided, the
		                       program will try to read the endpoint from
		                       "~/.hyperdrive/config.json" then default to
		                       "localhost:3101".
		  -t, --token        Set the Hyperdrive Daemon token. If not provided, the
		                       program will try to read the token from
		                       "~/.hyperdrive/config.json".

		Supported URI schemes:
		  http               Crawl-only
		  https              Crawl-only
		  hyper              Crawl and index

		Example:
		  $ pleco -v https://userlist.beakerbrowser.com
	`;
	console.log(message);
	process.exit(0);
}

/**
 * Print installed version and terminate process
 */
function printVersion() {
	console.log("Pleco v" + version);
	process.exit(0);
}
