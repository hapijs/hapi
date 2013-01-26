REPORTER = dot

test:
	@NODE_ENV=test ./node_modules/.bin/mocha --recursive --reporter $(REPORTER) --ignore-leaks --timeout 3000

tests: test

test-cov:
	@NODE_ENV=test ./node_modules/.bin/mocha --require blanket --recursive --ignore-leaks --timeout 3000 -R json-cov > coverage.json

test-cov-html:
	@NODE_ENV=test ./node_modules/.bin/mocha --require blanket --recursive --ignore-leaks --timeout 3000 -R html-cov > coverage.html

tap:
	@NODE_ENV=test ./node_modules/.bin/mocha -R tap > results.tap

unit:
	@NODE_ENV=test ./node_modules/.bin/mocha --recursive -R xunit --ignore-leaks > results.xml --timeout 3000


.PHONY: test tap test-cov test-cov-html unit lib-cov rm-lib-cov