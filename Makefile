build:
	docker build --tag openscadapi .

run:
	docker run -p 5000:5000 -it --env PORT=5000 --env GOOGLE_APPLICATION_CREDENTIALS="/usr/src/app/firebase_key.json" openscadapi

stop:
	docker stop $(shell docker ps -q --filter ancestor=openscadapi)

