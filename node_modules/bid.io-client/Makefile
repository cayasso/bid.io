REPORTER = spec
FILE = dist/bid.io-client.js
MINFILE = dist/bid.io-client.min.js

clean: 
	rm -fr dist/
	mkdir dist/

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail

min:
	@./node_modules/.bin/uglifyjs $(FILE) \
	 	--compress \
	 	> $(MINFILE)

concat:
	@./node_modules/.bin/browserbuild \
		--debug \
		--main index.js \
		--global bio \
		--basepath lib/ `find lib -name '*.js'` \
		> $(FILE)

docs:
	@./node_modules/.bin/doxx \
		--source lib \
		--target docs

build: clean concat min docs

.PHONY: test build min concat docs