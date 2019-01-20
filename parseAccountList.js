const AppendToFile = true; // Set this to "false" if you want to fully override the account list in accounts.json instead of appending to it

// Actual stuff
const fs = require("fs");
var accounts = AppendToFile === true ? JSON.parse(fs.readFileSync("./accounts.json")) : [];

fs.readFile("./input.txt", (err, data) => {
	if (err) {
		throw err;
	}

	data = data.toString();

	data.split("\n").forEach(a => {
		var accpw = a.trim().split(":");
		var username = accpw.shift();
		var password = accpw.join(":");

		//Check if account is already present in our list
		if (accounts.map(a => a.username).indexOf(username) >= 0) {
			console.log("Account already present: " + username);
			return;
		}

		console.log(username);

		accounts.push({
			username: username,
			password: password,
			sharedSecret: "",
			operational: true,
			lastCommend: -1,
			lastReport: -1,
			lastServerReport: -1,
			requiresSteamGuard: false,
			commended: []
		});
	});

	fs.writeFile("./accounts.json", JSON.stringify(accounts, null, 4), err => {
		if (err) {
			throw err;
		}

		console.log("Done");
	});
});
