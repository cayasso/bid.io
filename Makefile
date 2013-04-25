REPORTER = spec

build:
	@rm -rf client
	@mkdir client
	@cp ./node_modules/bid.io-client/dist/bid.io-client.js client/bid.io.js
	@cp ./node_modules/bid.io-client/dist/bid.io-client.min.js client/bid.io.min.js
	@echo "… done"

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

docs:
	@./node_modules/.bin/doxx \
		--source lib \
		--target docs

.PHONY: test docs