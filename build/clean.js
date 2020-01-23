/**
 * Only keeps "contractName", "abi", "sourcePath", "compiler", "networks",
 * "schemaVersion" and "updatedAt".
 */

const glob = require("glob");
const fs = require("fs");

const networks = ["testnet", "devnet", "localnet", "chaosnet"];

const path = require('path');
const dirname = path.dirname(__filename);

for (const network of networks) {
    const directory = path.join(dirname, `./${network}/*.json`);
    glob(directory, function (err, files) { // read the folder or folders if you want: example json/**/*.json
        if (err) {
            console.error(`error while reading the files in ${directory}`, err);
        }
        files.forEach(function (file) {
            fs.readFile(file, 'utf8', function (err, data) { // Read each file
                if (err) {
                    console.error(`error while reading the contents of ${file}`, err);
                }
                var obj = JSON.parse(data);
                const newObj = {
                    contractName: obj.contractName,
                    abi: obj.abi,
                    sourcePath: obj.sourcePath,
                    compiler: obj.compiler,
                    networks: obj.networks,
                    schemaVersion: obj.schemaVersion,

                    // Included for Etherscan verification
                    // bytecode: obj.bytecode,
                }
                const newData = JSON.stringify(newObj, null, "  ");

                if (data !== newData) {
                    fs.writeFile(file, JSON.stringify(newObj, null, "  "), function (err) {
                        if (err) return console.error(err);
                        console.info(` Updated \x1b[33m${file}\x1b[0m.`);
                    });
                }
            });
        });
    });
}
