/**
 * Only keeps "contractName", "abi", "sourcePath", "compiler", "networks",
 * "schemaVersion" and "updatedAt".
 */

const glob = require("glob");
const fs = require("fs");

const networks = ["testnet", "devnet", "localnet", "chaosnet", "mainnet", "main"];

const path = require('path');
const dirname = path.dirname(__filename);

const cmp = (x, y) => x === y ? 0 : x > y ? 1 : -1;
const sortAbi = (l, r) => cmp(l.type, r.type) === 0 ? cmp(l.name, r.name) : cmp(l.type, r.type);

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
                try {
                    var obj = JSON.parse(data);
                    const newObj = {
                        contractName: obj.contractName,
                        abi: obj.abi.sort(sortAbi),
                        sourcePath: obj.sourcePath.replace(/.*\/ren-sol\//g, "~/github/renproject/ren-sol/"),
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
                } catch (error) {
                    console.error(`Error processing ${file}`, error);
                }
            });
        });
    });
}
