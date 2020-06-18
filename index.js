/**
 * Crawl hypercores from seed input and index discovered hyperdrives
 * @param {object} options Command options
 */
export async function pleco(options = {}) {

	// Display version and return early
	if (options.version) return this.out("Pleco v0.1.0");

	const cwd = this.env.resolve(".");
	const indexDrive = await beaker.hyperdrive.drive(cwd);
	const indexMounts = await filterMounts(
		indexDrive,
		await indexDrive.readdir()
	);
	const queue = new CrawlQueue;
	const start = Date.now();
	let mounted = 0;

	queue.add(cwd);

	// Exhaust queue
	for (const key of queue) {
		this.out(key, `(${ queue.size } Queued, ${ queue.crawled } Crawled)`);

		// Index
		if (options.mount && !indexMounts.includes(key)) {
			try {
				await indexDrive.mount(key, key);
				++mounted;
				this.out("Mounted");
			} catch (mountError) {}
		}

		// Crawl
		try {
			const drive = await beaker.hyperdrive.drive(key);
			const entries = await drive.readdir("/", { recursive: true });

			// Scrape target files
			const targets = filterScrapable(entries);
			for (const target of targets) {
				try {
					const text = await drive.readFile(target);
					const uriList = scrapeHyperAddresses(text);
					queue.add(...uriList);
				} catch (scrapeError) {}
			}

			// Queue mounts
			const mounts = await filterMounts(drive, entries);
			queue.add(...mounts);
		} catch (crawlError) {}
	}

	const ellapsed = Date.now() - start;
	this.out(`Found ${ queue.crawled } drives in ${ formatTime(ellapsed) }`);
	if (mounted > 0) this.out(`Mounted ${ mounted } drives in working directory`);
}

/**
 * Hypercore Crawl Queue
 */
class CrawlQueue {
	#crawlSet = new Set;
	#queue = [];

	/**
	 * Queue iterator
	 */
	*[Symbol.iterator]() {
		while (this.#queue.length) {
			const key = this.#queue.pop();
			this.#crawlSet.add(key);
			yield key;
		}
	}

	/**
	 * Remaining keys queued
	 */
	get size() {
		return this.#queue.length;
	}

	/**
	 * Number of hyperdrives crawled
	 */
	get crawled() {
		return this.#crawlSet.size;
	}

	/**
	 * Add hypercore keys to the crawl queue
	 * @param  {...string} uriList Hypercore URIs
	 * @return {number} Actual number of keys added to queue
	 */
	add(...uriList) {
		let count = 0;
		for (const uri of uriList) {
			const key = extractKey(uri);
			if (key == null) continue;
			if (this.#queue.includes(key)) continue;
			if (this.#crawlSet.has(key)) continue;
			this.#queue.push(key);
			++count;
		}
		return count;
	}
}

/**
 * Collect all hypercore addresses in a body of text
 * @param {string} text Body of text
 * @return {string[]} Hypercore addresses
 */
function scrapeHyperAddresses(text) {
	return text.match(/hyper:\/\/[0-9a-f]{64}/g) || [];
}

/**
 * Extract key from a hypercore URI
 * @param {string} uri Hypercore URI
 * @return {string} Hypercore key
 */
function extractKey(uri) {
	const key = uri.match(/^hyper:/)
		? uri.slice(8, 72)
		: uri.slice(0, 64);
	return key.match(/^[0-9a-f]{64}$/)
		? key
		: null;
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
 * Filter the scrapable subset of entries
 * @param {string[]} entries Hyperdrive entries
 */
function filterScrapable(entries) {
	return entries
		// Ignore contents of `node_modules` and `.git` directories
		.filter(entry => !entry.match(/(^|\/)(node_modules|.git)/))
		// Match only files with select extensions
		.filter(entry => entry.match(/\.(html?|md|xml|js(on)?|css)$/));
}

/**
 * Filter the mount subset of entries
 * @param {object} drive Hyperdrive interface
 * @param {string[]} entries Hyperdrive entries
 */
async function filterMounts(drive, entries) {
	const mounts = [];
	for (const entry of entries) {
		try {
			const stat = await drive.stat(`/${ entry }`);
			if (stat.mount) mounts.push(stat.mount.key);
		} catch (statError) {}
	}
	return mounts;
}
