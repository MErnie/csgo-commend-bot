const fs = require("fs");
const WorkerThreads = require("worker_threads");

module.exports = class WorkerHandler {
	constructor(work, config) {
		this.work = work; // Array of accounts
		this.config = config; // Our config with already parsed AccountID
	};

	execute() {
		return new Promise(async (resolve, reject) => {
			const worker = new WorkerThreads.Worker(__dirname + "/worker.js", {
				workerData: {
					accounts: this.work,
					config: this.config
				}
			});

			worker.on("online", () => {
				console.log(worker.threadId + " Worker online");
			});

			worker.on("message", (msg) => {
				if (typeof msg === "string") {
					console.log(msg);
					return;
				}

				if (msg.type !== "end") {
					console.log(msg);
					return;
				}

				fs.writeFileSync("./accounts.json", JSON.stringify(msg.content, null, 4));
			});

			worker.on("error", (err) => {
				reject(err);
			});

			worker.on("exit", (code) => {
				console.log(" Worker exited with code " + code);

				worker.removeAllListeners();
				resolve();
			});
		});
	};
}
