const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const RenLedger = artifacts.require("RenLedger");
const TraderAccounts = artifacts.require("TraderAccounts");
const fs = require('fs');

async function deploy() {
    const republicToken = await RepublicToken.new();
    const darknodeRegistry = await DarknodeRegistry.new(republicToken.address, 0, 8, 60);
    const renLedger = await RenLedger.new(0, republicToken.address, darknodeRegistry.address);
    const traderAccounts = await TraderAccounts.new(renLedger.address);

    contracts = {
        "republicToken": republicToken.address,
        "darknodeRegistry": darknodeRegistry.address,
        "renLedger": renLedger.address,
        "traderAccounts": traderAccounts.address,
    }

    fs.writeFile("config.json", contracts, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });

}
