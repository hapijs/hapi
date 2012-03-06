test:
	@NODE_ENV=test ./node_modules/.bin/mocha

tap:
	@NODE_ENV=test ./node_modules/.bin/mocha -R tap > results.tap

.PHONY: test tap