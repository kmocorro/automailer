# !/bin/bash
# Automailer
# Xtranghero
# VERSION 1.0
# 2017-12-21

# Checker every 06:33 and 18:33

# varbs
PATH=$PATH:/c/xampp/mysql/bin
APIRES=$(wget --server-response http://10.3.95.227:9000/upload -O /c/sandbox/nodejs-automailer/public/reslog.txt 2>&1 | grep -c 'HTTP/1.1 200 OK')
HOST="localhost"
USER="root"
PASS="2qhls34r"
DB="dbauth"
POSTU=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT user FROM tbl_cloud_details;")
POSTP=$(mysql -h$HOST -u $USER -p$PASS $DB -s<<<"SELECT pass FROM tbl_cloud_details;")

echo "Checking web service response..."

# check
if [ $APIRES != 1 ]; # not equal to 202
    then
        echo "Cannot access API"
        curl -d "gg=Error404" http://localhost:8000/404
        sleep 11
    else
        echo "Server is active"
        curl -d "user=$POSTU&pass=$POSTP" http://localhost:8000/202
        sleep 11
fi

echo "Done!"