import * as chai from "chai";

import * as Web3 from "web3";

// Chai helper for comparing addresses
// tslint:disable:only-arrow-functions
chai.use(function (newChai: any, utils: any): void {
    const property = "address";

    const toChecksumAddress = (new (Web3 as any)()).utils.toChecksumAddress;

    newChai.Assertion.addProperty(property, function () {
        utils.flag(this, property, true);
    });

    const override = function (fn) {
        // tslint:disable-next-line:variable-name
        return function (_super) {
            return function (value, ...args) {
                if (utils.flag(this, property)) {
                    const expected = value;
                    const actual = this._obj;
                    fn.apply(this, [expected, actual]);
                } else {
                    _super.apply(this, [value, ...args]);
                }
            };
        };
    };

    const equal = override(function (expected: string, actual: string) {
        this.assert(
            toChecksumAddress(expected) === toChecksumAddress(actual),
            "expected address #{act} to equal #{exp}",
            "expected address #{act} to be different from #{exp}",
            toChecksumAddress(expected),
            toChecksumAddress(actual),
        );
    });
    newChai.Assertion.overwriteMethod("equal", equal);
});
