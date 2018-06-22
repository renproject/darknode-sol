const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const Orderbook = artifacts.require("Orderbook");
const TraderAccounts = artifacts.require("TraderAccounts");
const fs = require('fs');

async function deploy() {
    const republicToken = await RepublicToken.new();
    const darknodeRegistry = await DarknodeRegistry.new(republicToken.address, 0, 8, 60);
    const orderbook = await Orderbook.new(0, republicToken.address, darknodeRegistry.address);
    const traderAccounts = await TraderAccounts.new(orderbook.address);

    contracts = {
        "republicToken": republicToken.address,
        "darknodeRegistry": darknodeRegistry.address,
        "orderbook": orderbook.address,
        "traderAccounts": traderAccounts.address,
    }

    fs.writeFile("config.json", contracts, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });

}
