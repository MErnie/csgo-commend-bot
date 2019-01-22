const WorkerThreads = require("worker_threads");
const Account = require("./account.js");

const { accounts, config } = WorkerThreads.workerData;
const colors = {
	general: "\x1b[37m",
	login: "\x1b[36m",
	loggedIn: "\x1b[33m",
	connectedToGC: "\x1b[35m",
	success: "\x1b[32m",
	error: "\x1b[31m"
};

(async () => {
	for (let acc of accounts) {
		WorkerThreads.parentPort.postMessage(accounts);

		let result = await new Promise((resolve, reject) => {
			accountHandler(acc, resolve);
		});

		// If the result is "true" that means we have another one to do, if its false it means we are at the end and dont need to wait more
		if (result === true) {
			// Wait "BeautifyDelay" ms so the message actually appears at the bottom and not somewhere in the middle
			await new Promise(r => setTimeout(r, config.Chunks.BeautifyDelay));

			WorkerThreads.parentPort.postMessage(colors.general + "Waiting " + parseInt(config.Chunks.TimeBetweenChunks / 1000) + " second" + (parseInt(config.Chunks.TimeBetweenChunks / 60) === 1 ? "" : "s"));

			// Wait 60 seconds and then repeat the loop
			await new Promise(r => setTimeout(r, config.Chunks.TimeBetweenChunks));
		}
	}
})();

function accountHandler(account, resolve) {
	try {
		WorkerThreads.parentPort.postMessage(colors.login + WorkerThreads.threadId + " [" + account.username + "] Logging into account");

		const acc = new Account(account.username, account.password, account.sharedSecret);

		acc.on("loggedOn", () => {
			WorkerThreads.parentPort.postMessage(colors.loggedIn + WorkerThreads.threadId + " [" + account.username + "] Successfully logged into account");
		});

		acc.on("ready", async (hello) => {
			WorkerThreads.parentPort.postMessage(colors.connectedToGC + WorkerThreads.threadId + " [" + account.username + "] Connected to CSGO GameCoordinator");

			// Wait "TimeBetweenConnectionAndSending" ms before sending the commend
			await new Promise(r => setTimeout(r, config.Chunks.TimeBetweenConnectionAndSending));

			acc.commend(config.AccountToCommend, (30 * 1000), config.Commend.Friendly, config.Commend.Teacher, config.Commend.Leader).then((response) => {
				commendsSent += 1;

				WorkerThreads.parentPort.postMessage(colors.success + WorkerThreads.threadId + " [" + account.username + "] Successfully sent a commend " + commendsSent + "/" + config.CommendsToSend);

				acc.logout();

				var index = config.accounts.map(a => a.username).indexOf(account.username);
				if (index >= 0) {
					config.accounts[index].lastCommend = new Date().getTime();
					config.accounts[index].commended.push(config.AccountToCommend);
				}

				delete acc;
				checkComplete(resolve);
			}).catch((err) => {
				// Commending while not even being connected to the GC... Makes sense
				if (typeof err === "string" && err === "previously_timed_out") {
					return;
				}

				commendsFailed += 1;

				WorkerThreads.parentPort.postMessage(colors.error + WorkerThreads.threadId + " [" + account.username + "] Has encountered an error");
				console.error(err);

				acc.logout();

				var index = config.accounts.map(a => a.username).indexOf(account.username);
				if (index >= 0) {
					config.accounts[index].lastCommend = new Date().getTime();
					config.accounts[index].commended.push(config.AccountToCommend);
				}

				delete acc;
				checkComplete(resolve);
			});
		});

		acc.on("steamGuard", () => {
			commendsFailed += 1;

			WorkerThreads.parentPort.postMessage(colors.error + WorkerThreads.threadId + " [" + account.username + "] Requires a SteamGuard code");

			var index = config.accounts.map(a => a.username).indexOf(account.username);
			if (index >= 0) {
				config.accounts[index].requiresSteamGuard = true;
			}

			acc.logout();

			delete acc;
			checkComplete(resolve);
		});

		acc.on("error", (err) => {
			commendsFailed += 1;

			WorkerThreads.parentPort.postMessage(colors.error + WorkerThreads.threadId + " [" + account.username + "] Has encountered an error");
			console.error(err);

			if (err.eresult === 84) {
				// we have hit the ratelimit set "hitRatelimit" to true
				hitRatelimit = true;
			}

			var index = config.accounts.map(a => a.username).indexOf(account.username);
			if (index >= 0) {
				// If the error is "RateLimitExceeded" just ignore it, we can still use the account just fine after the ratelimit is over
				config.accounts[index].operational = isNaN(err.eresult) ? false : (err.eresult === 84 ? true : err.eresult);
			}

			acc.logout();

			delete acc;
			checkComplete(resolve);
		});
	} catch(err) {
		commendsFailed += 1;

		if (account) {
			WorkerThreads.parentPort.postMessage(colors.error + WorkerThreads.threadId + " [" + account.username + "] Has encountered an error");

			var index = config.accounts.map(a => a.username).indexOf(account.username);
			if (index >= 0) {
				config.accounts[index].operational = isNaN(err.eresult) ? false : err.eresult;
			}
		}

		console.error(err);

		if (typeof acc !== "undefined") {
			acc.logout();
		}

		delete acc;
		checkComplete(resolve);
	}
}

function checkComplete(resolve) {
	// Always increment this, as everytime we check one has finished (successfully or not doesnt matter in this case)
	chunkComplete++;

	// Global complete
	if ((commendsSent + commendsFailed) >= accounts.length) {
		resolve(false);

		// Update our accounts.json
		WorkerThreads.parentPort.postMessage({ type: "end", content: config.accounts });

		// We have successfully sent all commends and are now done here
		WorkerThreads.parentPort.postMessage(colors.general + WorkerThreads.threadId + " Successfully sent " + commendsSent + "/" + accounts.length + " commend" + (accounts.length === 1 ? "" : "s") + ", " + commendsFailed + " commend" + (commendsFailed === 1 ? "" : "s") + " failed");
		process.exit(100);
		return;
	}

	// Chunk complete
	if (chunkComplete >= chunkCompleteLimit) {
		resolve(true);
	}
}
