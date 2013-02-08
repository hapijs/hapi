REPORTER = dot

test:
	@NODE_ENV=test ./node_modules/.bin/mocha --require blanket --recursive --reporter $(REPORTER) --ignore-leaks --timeout 3000

tests: test

test-cov:
	@NODE_ENV=test ./node_modules/.bin/mocha --require blanket --recursive --ignore-leaks --timeout 3000 -R travis-cov

test-cov-html:
	@NODE_ENV=test ./node_modules/.bin/mocha --require blanket --recursive --ignore-leaks --timeout 3000 -R html-cov > coverage.html

.PHONY: test tap test-cov test-cov-html unit lib-cov rm-lib-cov