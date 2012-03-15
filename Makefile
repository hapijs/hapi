REPORTER = dot

test:
	@NODE_ENV=test ./node_modules/.bin/mocha --reporter $(REPORTER)

lib-cov: rm-lib-cov
	@#jscoverage lib lib-cov
	@node ./node_modules/jscoverage/jscoverage.node lib lib-cov

rm-lib-cov:
	@rm -rf ./lib-cov/

test-cov:
	@$(MAKE) test EXPRESS_COV=1 REPORTER=json-cov > coverage.json

test-cov-html:
	@$(MAKE) test EXPRESS_COV=1 REPORTER=html-cov > coverage.html

tap:
	@NODE_ENV=test ./node_modules/.bin/mocha -R tap > results.tap

unit:
	@NODE_ENV=test ./node_modules/.bin/mocha -R xunit > results.xml

.PHONY: test tap