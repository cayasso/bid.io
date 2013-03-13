REPORTER = spec

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

docs:
	@./node_modules/.bin/doxx \
		--source lib \
		--target docs

.PHONY: test docs