/**
 * Only keeps "contractName", "abi", "sourcePath", "compiler", "networks",
 * "schemaVersion" and "updatedAt".
 */

var glob = require("glob");
var fs = require("fs");

const networks = ["testnet", "devnet", "localnet"];

for (const network of networks) {
    glob(`./build/${network}/*.json`, function (err, files) { // read the folder or folders if you want: example json/**/*.json
        if (err) {
            console.log("cannot read the folder, something goes wrong with glob", err);
        }
        files.forEach(function (file) {
            fs.readFile(file, 'utf8', function (err, data) { // Read each file
                if (err) {
                    console.log("cannot read the file, something goes wrong with the file", err);
                }
                var obj = JSON.parse(data);
                const newObj = {
                    contractName: obj.contractName,
                    abi: obj.abi,
                    sourcePath: obj.sourcePath,
                    compiler: obj.compiler,
                    networks: obj.networks,
                    schemaVersion: obj.schemaVersion,
                    updatedAt: obj.updatedAt,
                }

                fs.writeFile(file, JSON.stringify(newObj, null, "  "), function (err) {
                    if (err) return console.log(err);
                    console.log(` Updated \x1b[33m${file}\x1b[0m.`);
                });
            });
        });
    });
}