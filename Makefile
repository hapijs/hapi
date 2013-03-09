test:
	@NODE_ENV=test ./node_modules/.bin/lab

test-cov:
	@NODE_ENV=test ./node_modules/.bin/lab -c -r coverage

test-cov-html:
	@NODE_ENV=test ./node_modules/.bin/lab -c -r html > coverage.html

complexity:
	./node_modules/.bin/cr -o complexity.md -f markdown lib

.PHONY: test test-cov test-cov-html

