# !/bin/bash
# Automailer
# Xtranghero
# VERSION 1.0
# 2017-12-21

# Checker every 06:33 and 18:33

# varbs
PATH=$PATH:/c/xampp/mysql/bin
#checkFile= ../tmp/automailer.txt
APIRES=$(wget --server-response http://localhost:8000/ -O /c/sandbox/nodejs-automailer/public/reslog.txt 2>&1 | grep -c 'HTTP/1.1 200 OK') #check if automailer is online
HOST="localhost"
USER="root"
PASS="2qhls34r"
DB="dbauth"
POSTU=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT user FROM tbl_cloud_details;")
POSTP=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT pass FROM tbl_cloud_details;")

echo "Checking web service response..."

if [ -e "../tmp/automailer.txt" ]; then # file exists, don't do anythingx
    echo "automailer is already running"
    sleep 5
else
    touch ../tmp/automailer.txt #hoping that bash dosn't crash
    
    if [ $APIRES != 1 ]; then
        echo "Cannot access API"
        curl -d "gg=Error404" http://localhost:8000/404

        if [ "$?" = "7" ]; then
            echo "Connection refused. Server down"
            rm ../tmp/automailer.txt
            sleep 3600 # 1 HOUR WAITING
        fi

        echo "404. Check server"
        rm ../tmp/automailer.txt
        sleep 3600 # SAME

        sh ./automailer.sh
    else
        echo "Server is active"
        curl -d "user=$POSTU&pass=$POSTP" http://localhost:8000/202
        sleep 5
        rm ../tmp/automailer.txt
        # wait for next trigger 6:30 / 18:30
    fi

fi
