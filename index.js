const SteamIDParser = require("./helpers/steamIDParser.js");
const WorkerHandler = require("./helpers/WorkerHandler.js");
const config = require("./config.json");
const colors = {
	general: "\x1b[37m",
	login: "\x1b[36m",
	loggedIn: "\x1b[33m",
	connectedToGC: "\x1b[35m",
	success: "\x1b[32m",
	error: "\x1b[31m"
};

try {
	const WorkerThreads = require("worker_threads");

	if (!WorkerThreads.isMainThread) {
		console.log("You cannot run this bot as Worker");
		process.exit(1);
	}
} catch(err) {
	console.log("You cannot run this bot without using NodeJS v10 Experimental Workers");
	process.exit(1);
}

// Add all accounts to the config
config.accounts = require("./accounts.json");

(async () => {
	// Parse "AccountToCommend" to accountID
	console.log(colors.general + "Parsing account from " + config.AccountToCommend);

	let output = await SteamIDParser(config.AccountToCommend, config.SteamAPIKey).catch((err) => {
		console.error(err);
	});

	// An error occured
	if (!output) {
		return;
	}

	config.AccountToCommend = output.accountid;

	console.log(colors.general + "Successfully parsed account to " + config.AccountToCommend);

	console.log(colors.general + "Getting " + config.CommendsToSend + " account" + (config.CommendsToSend === 1 ? "" : "s"));

	// First we get all available accounts (You can commend once every 12 hours)
	let available = config.accounts.filter(a => a.operational === true && a.requiresSteamGuard === false && !a.commended.includes(config.AccountToCommend) && (new Date().getTime() - a.lastCommend) >= config.AccountCooldown);

	// Check if we have enough available accounts
	if (available.length < config.CommendsToSend) {
		console.log(colors.general + available.length + "/" + config.accounts.length + " account" + (config.accounts.length === 1 ? "" : "s") + " available but we need " + config.CommendsToSend + " account" + (config.CommendsToSend === 1 ? "" : "s"));
		return;
	}

	// Get needed accounts
	let accountsToUse = available.slice(0, config.CommendsToSend);

	// Split accounts into chunks, do "CommendsPerChunk" at a time
	let chunks = chunkArray(accountsToUse, config.Chunks.CommendsPerChunk);
	let workerChunks = chunkArray(chunks, config.Chunks.WorkersAtOnce);

	// Wait 5 seconds before starting the actual process
	await new Promise(r => setTimeout(r, (5 * 1000)));

	Promise.all(workerChunks.map(w => new WorkerHandler(w, config).execute())).then(() => {
		console.log("Done");
	});
})();

// Copied from: https://ourcodeworld.com/articles/read/278/how-to-split-an-array-into-chunks-of-the-same-size-easily-in-javascript
function chunkArray(myArray, chunk_size) {
	var tempArray = [];

	for (let index = 0; index < myArray.length; index += chunk_size) {
		myChunk = myArray.slice(index, index + chunk_size);
		tempArray.push(myChunk);
	}

	return tempArray;
}
