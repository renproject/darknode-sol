
#./ganache 35&
#pid=$!
#truffle test
#result=$?
#kill $pid


# Run tests
./node_modules/.bin/solidity-coverage
result=$?

# Coverage
cat coverage/lcov.info | ./node_modules/.bin/coveralls

exit $result
