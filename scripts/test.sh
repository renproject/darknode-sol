
# Coverage
result=$(./node_modules/.bin/solidity-coverage)

# Coverage
cat coverage/lcov.info | ./node_modules/.bin/coveralls

exit $result
