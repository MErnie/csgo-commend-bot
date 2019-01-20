const Account = require("./helpers/account.js");
const fs = require("fs");

module.exports = class WorkerHandler {
	constructor(work, config) {
		this.work = work;
		this.config = config;
	};

	execute() {
		return new Promise(async (resolve, reject) => {
			// TODO: Actually useful stuff
		});
	};
}
