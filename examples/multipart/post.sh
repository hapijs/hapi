#!/bin/sh
curl --form file=@data.csv --form user=hueniverse http://localhost:8000/submit
