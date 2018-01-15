
./ganache 35&
pid=$!
truffle test
result=$?
kill $pid

# Coverage
./node_modules/.bin/solidity-coverage
cat coverage/lcov.info | ./node_modules/.bin/coveralls

exit $result
