test:
	@NODE_PATH=./test/integration/pack/node_modules \
	node node_modules/lab/bin/lab
test-cov: 
	@NODE_PATH=./test/integration/pack/node_modules \
	node node_modules/lab/bin/lab -r threshold -t 100
test-cov-html:
	@NODE_PATH=./test/integration/pack/node_modules \
	node node_modules/lab/bin/lab -r html -o coverage.html
complexity:
	@node node_modules/complexity-report/src/cli.js -o complexity.md -f markdown lib

.PHONY: test test-cov test-cov-html complexity

